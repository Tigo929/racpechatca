import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Клиент Avito API.
 *
 * Авито выдаёт токен по client_credentials на 24 часа. Просить новый токен на
 * каждый запрос нельзя — упрёмся в лимиты, поэтому держим его в памяти и
 * обновляем заранее. Ключи живут только в переменных окружения: в репозитории
 * их быть не должно.
 */

const AVITO_API = 'https://api.avito.ru';

/** Обновляем токен за 5 минут до истечения — чтобы не поймать 403 на границе. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface AvitoAccount {
  id: number;
  name: string;
  email: string;
  profile_url: string;
}

export interface AvitoRating {
  isEnabled: boolean;
  rating: { score: number; reviewsCount: number; reviewsWithScoreCount: number };
}

export interface AvitoReview {
  id: number;
  score: number;
  text: string;
  createdAt: number;
  canAnswer: boolean;
  sender?: { name?: string };
  item?: { id: number; title: string };
}

export class AvitoNotConfiguredError extends Error {
  constructor() {
    super('Avito API не настроен: нет AVITO_CLIENT_ID / AVITO_CLIENT_SECRET');
  }
}

@Injectable()
export class AvitoService {
  private readonly logger = new Logger(AvitoService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  private token: { value: string; expiresAt: number } | null = null;
  /** Незавершённый запрос токена — чтобы параллельные вызовы не плодили запросы. */
  private tokenInFlight: Promise<string> | null = null;
  private cachedUserId: number | null = null;

  constructor(private readonly config: ConfigService) {
    this.clientId = config.get<string>('AVITO_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('AVITO_CLIENT_SECRET') ?? '';
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Сбрасывает кеш токена — нужен после 403, когда токен отозвали досрочно. */
  private invalidateToken(): void {
    this.token = null;
  }

  private async getToken(): Promise<string> {
    if (!this.isConfigured) throw new AvitoNotConfiguredError();

    const cached = this.token;
    if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return cached.value;
    }
    if (this.tokenInFlight) return this.tokenInFlight;

    this.tokenInFlight = this.fetchToken().finally(() => {
      this.tokenInFlight = null;
    });
    return this.tokenInFlight;
  }

  private async fetchToken(): Promise<string> {
    const res = await fetch(`${AVITO_API}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      const body = await res.text();
      // Тело намеренно не логируем целиком в проде — там может быть эхо ключа.
      throw new Error(`Avito token failed [${res.status}]: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    this.logger.log(`Avito token обновлён, живёт ${data.expires_in} с`);
    return data.access_token;
  }

  /**
   * Запрос к Avito API с авторизацией. На 403 (токен протух раньше срока)
   * один раз пробуем заново с новым токеном — это штатная ситуация, а не сбой.
   */
  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${AVITO_API}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 403 && retry) {
      this.invalidateToken();
      return this.request<T>(path, init, false);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Avito ${path} [${res.status}]: ${body.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  }

  /** Профиль магазина. id аккаунта нужен почти всем ручкам, поэтому кешируем. */
  async getAccount(): Promise<AvitoAccount> {
    const account = await this.request<AvitoAccount>('/core/v1/accounts/self');
    this.cachedUserId = account.id;
    return account;
  }

  async getUserId(): Promise<number> {
    if (this.cachedUserId !== null) return this.cachedUserId;
    return (await this.getAccount()).id;
  }

  async getRating(): Promise<AvitoRating> {
    return this.request<AvitoRating>('/ratings/v1/info');
  }

  /** Отзывы магазина, свежие первыми. */
  async getReviews(limit = 20, offset = 0): Promise<{ total: number; reviews: AvitoReview[] }> {
    return this.request<{ total: number; reviews: AvitoReview[] }>(
      `/ratings/v1/reviews?offset=${offset}&limit=${limit}`,
    );
  }
}
