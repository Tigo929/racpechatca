import { Injectable, Logger } from '@nestjs/common';

/**
 * Клиент Ozon Delivery API (Ozon Доставка для бизнеса, кабинет «фотки-доставка»).
 *
 * Что выяснено на живом API (21.11.2026), раз документация закрыта:
 *  • токен — POST xapi.ozon.ru/oauth/token, form-urlencoded,
 *    grant_type=client_credentials и ОБЯЗАТЕЛЬНЫЙ scope; ответ тоже
 *    form-urlencoded (access_token=…), живёт час;
 *  • api-delivery.ozon.ru стоит за анти-бот защитой: первый запрос получает
 *    307 с cookie __Secure-ETC, с ней запрос проходит. Cookie храним и
 *    при новом 307 обновляем;
 *  • ошибки валидации приходят как {"error":{"message":"…"}}, бизнес-ошибки —
 *    {"error":{"code":"…","message":"…"}}.
 *
 * Ключи — OZON_DELIVERY_CLIENT_ID / OZON_DELIVERY_CLIENT_SECRET в .env.
 */

const TOKEN_URL = 'https://xapi.ozon.ru/oauth/token';
const API = 'https://api-delivery.ozon.ru';
const SCOPE =
  'delivery-api.delivery delivery-api.delivery-point delivery-api.order delivery-api.posting';
const TIMEOUT_MS = 30_000;

export class OzonDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
  }
}

/** Понятный человеку текст для известных отказов Ozon. */
export function humanOzonError(code: string | null, message: string): string {
  const c = (code ?? '').toLowerCase();
  if (/balance/.test(c) || /баланс/i.test(message)) {
    return 'На балансе Ozon Доставки не хватает денег. Пополните баланс в кабинете «фотки-доставка» и повторите.';
  }
  if (/recipient/.test(c)) {
    return `Ozon не принял получателя: ${message}. Проверьте телефон — у клиента должен быть аккаунт Ozon на этот номер.`;
  }
  if (/deliverypoint|delivery_point/.test(c)) {
    return `Пункт выдачи не подходит: ${message}. Выберите другой пункт.`;
  }
  return message;
}

@Injectable()
export class OzonDeliveryClient {
  private readonly logger = new Logger(OzonDeliveryClient.name);
  private token: { value: string; expiresAt: number } | null = null;
  private cookie = '';

  get configured(): boolean {
    return Boolean(
      process.env.OZON_DELIVERY_CLIENT_ID?.trim() &&
      process.env.OZON_DELIVERY_CLIENT_SECRET?.trim(),
    );
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt - 60_000 > Date.now()) {
      return this.token.value;
    }
    if (!this.configured) {
      throw new OzonDeliveryError(
        'Ozon Доставка не подключена: нет ключей OZON_DELIVERY_CLIENT_ID / SECRET.',
        503,
      );
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OZON_DELIVERY_CLIENT_ID!.trim(),
      client_secret: process.env.OZON_DELIVERY_CLIENT_SECRET!.trim(),
      scope: SCOPE,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new OzonDeliveryError(
        `Ozon не выдал токен (${res.status}): ${text.slice(0, 200)}`,
        res.status,
      );
    }
    // Ответ бывает и form-urlencoded, и JSON — разбираем оба.
    let value: string | null = null;
    let ttl = 3600;
    try {
      const json = JSON.parse(text) as {
        access_token?: string;
        expires_in?: number;
      };
      value = json.access_token ?? null;
      ttl = json.expires_in ?? ttl;
    } catch {
      const p = new URLSearchParams(text);
      value = p.get('access_token');
      ttl = Number(p.get('expires_in')) || ttl;
    }
    if (!value) throw new OzonDeliveryError('Ozon вернул пустой токен', 502);
    this.token = { value, expiresAt: Date.now() + ttl * 1000 };
    return value;
  }

  private rememberCookie(res: Response) {
    const raw = res.headers.get('set-cookie');
    const m = raw && /(__Secure-ETC=[^;]+)/.exec(raw);
    if (m) this.cookie = m[1];
  }

  private async send(
    path: string,
    payload: unknown,
    token: string,
  ): Promise<Response> {
    return fetch(`${API}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/pdf',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  /** Сырой ответ: для этикетки (PDF) и для разбора JSON. */
  async raw(path: string, payload: unknown): Promise<Response> {
    let token = await this.getToken();
    let res = await this.send(path, payload, token);
    // Анти-бот: 307 с cookie — повторяем с ней (до двух раз).
    for (let i = 0; i < 2 && (res.status === 307 || res.status === 302); i++) {
      this.rememberCookie(res);
      res = await this.send(path, payload, token);
    }
    if (res.status === 401) {
      token = await this.getToken(true);
      res = await this.send(path, payload, token);
    }
    return res;
  }

  async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await this.raw(path, payload);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = json as {
        error?: { code?: string; message?: string };
        message?: string;
      } | null;
      const code = err?.error?.code ?? null;
      const message =
        err?.error?.message ??
        err?.message ??
        text.slice(0, 300) ??
        `HTTP ${res.status}`;
      this.logger.warn(`Ozon ${path} → ${res.status} ${code ?? ''} ${message}`);
      throw new OzonDeliveryError(
        humanOzonError(code, message),
        res.status,
        code,
      );
    }
    return json as T;
  }
}
