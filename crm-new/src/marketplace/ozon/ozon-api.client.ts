import { Injectable, Logger } from '@nestjs/common';

/**
 * Низкоуровневый клиент Ozon Seller API.
 *
 * Ozon авторизует не токеном, а парой заголовков `Client-Id` + `Api-Key`,
 * поэтому здесь нет ни OAuth, ни кеша токена (в отличие от Avito). Зато почти
 * все методы — POST с JSON-телом, даже там, где по смыслу чтение.
 *
 * Клиент намеренно не знает про базу: ключи приходят параметром. Так один и
 * тот же клиент обслуживает несколько кабинетов, а сервис решает, чьими
 * ключами ходить.
 *
 * Документация: https://docs.ozon.ru/api/seller
 */

const OZON_API = 'https://api-seller.ozon.ru';
/** Ozon отвечает быстро; всё, что дольше — уже проблема на его стороне. */
const REQUEST_TIMEOUT_MS = 20_000;

export interface OzonCredentials {
  clientId: string;
  apiKey: string;
}

/** Ошибка площадки с текстом, который не стыдно показать человеку. */
export class OzonApiError extends Error {
  constructor(
    /** HTTP-код ответа; 0 — до Ozon не дозвонились. */
    readonly status: number,
    /** Текст для интерфейса, по-русски. */
    readonly humanMessage: string,
    /** Сырой ответ Ozon — в лог и в детали, но не в лицо пользователю. */
    readonly details?: string,
  ) {
    super(humanMessage);
    this.name = 'OzonApiError';
  }
}

/** Тело ошибки Ozon: {"code":16,"message":"...","details":[...]}. */
interface OzonErrorBody {
  code?: number;
  message?: string;
}

function humanize(status: number, ozonMessage: string | undefined): string {
  switch (status) {
    case 401:
    case 403:
      return 'Ozon не принял доступы: проверьте Client-Id и Api-Key. Ключ мог быть отозван в кабинете продавца.';
    case 404:
      return 'Ozon не знает такой метод API — возможно, версия метода устарела.';
    case 429:
      return 'Ozon ограничил частоту запросов. Подождите минуту и повторите.';
    case 400:
      return ozonMessage
        ? `Ozon отклонил запрос: ${ozonMessage}`
        : 'Ozon отклонил запрос.';
    default:
      if (status >= 500) {
        return 'Ozon сейчас недоступен (ошибка на его стороне). Попробуйте позже.';
      }
      return ozonMessage
        ? `Ozon вернул ошибку ${status}: ${ozonMessage}`
        : `Ozon вернул ошибку ${status}.`;
  }
}

@Injectable()
export class OzonApiClient {
  private readonly logger = new Logger(OzonApiClient.name);

  /**
   * POST-запрос к Ozon Seller API. Тело по умолчанию `{}` — Ozon не принимает
   * запрос без JSON-объекта даже там, где параметров нет.
   */
  async post<T>(
    creds: OzonCredentials,
    path: string,
    body: unknown = {},
  ): Promise<T> {
    return this.request<T>(creds, 'POST', path, body);
  }

  /**
   * GET-запрос. Почти весь Seller API работает через POST, но отдельные
   * методы — например список акций `/v1/actions` — только GET, и с телом
   * запроса они отвечают ошибкой.
   */
  async get<T>(creds: OzonCredentials, path: string): Promise<T> {
    return this.request<T>(creds, 'GET', path);
  }

  private async request<T>(
    creds: OzonCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${OZON_API}${path}`, {
        method,
        headers: {
          'Client-Id': creds.clientId,
          'Api-Key': creds.apiKey,
          'Content-Type': 'application/json',
        },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Ozon ${path}: сеть недоступна — ${reason}`);
      throw new OzonApiError(
        0,
        'Не удалось связаться с Ozon: сеть недоступна или запрос вышел за таймаут.',
        reason,
      );
    }

    const raw = await res.text();

    if (!res.ok) {
      let ozonMessage: string | undefined;
      try {
        ozonMessage = (JSON.parse(raw) as OzonErrorBody).message;
      } catch {
        ozonMessage = raw.slice(0, 200) || undefined;
      }
      // Ключ в теле ошибки Ozon не эхоит, но на всякий случай логируем только
      // код и путь — тело уходит в детали ошибки, а не в общий лог.
      this.logger.warn(`Ozon ${path} → ${res.status}`);
      throw new OzonApiError(
        res.status,
        humanize(res.status, ozonMessage),
        raw.slice(0, 500),
      );
    }

    if (!raw) return {} as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new OzonApiError(
        res.status,
        'Ozon вернул ответ, который не разобрать как JSON.',
        raw.slice(0, 200),
      );
    }
  }
}
