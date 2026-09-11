import { Injectable, Logger } from '@nestjs/common';
import { isMetrikaConfigured, type MetrikaConfig } from './metrika.config';
import type {
  MetrikaCounter,
  MetrikaCounterResponse,
  MetrikaErrorBody,
  MetrikaGoal,
  MetrikaGoalsResponse,
  MetrikaStatsQuery,
  MetrikaStatsResponse,
} from './metrika.types';

/**
 * Клиент API Яндекс Метрики — единственная точка, откуда CRM ходит
 * в Метрику (этап 05 плана аналитики).
 *
 * Пока только чтение: счётчик, его цели, отчёты. Запись (импорт заказов
 * из CRM) появится на этапе 06 в этом же классе — чтобы заголовок
 * авторизации, таймаут, разбор ошибок и повторные попытки жили в одном
 * месте, а не расползались по сервисам вместе с сырыми `fetch`.
 *
 * Авторизация: `Authorization: OAuth <token>`. Токен приходит из
 * конфигурации и наружу не выходит: ни в логи, ни в текст ошибок, ни
 * в объекты ошибок. В логе — операция, номер счётчика, код ответа и
 * длительность.
 *
 * Таймаут 10 секунд. Управляющие методы отвечают за доли секунды,
 * отчёты за период могут думать несколько секунд; десять — граница,
 * после которой ждать бессмысленно, а держать воркер занятым вредно.
 *
 * Повторы: до двух, только для чтения и только на 429, 5xx, сеть и
 * таймаут — то есть там, где повтор имеет шанс помочь и ничего не ломает.
 * 401 и 403 не повторяются: от повтора права не появятся. Полноценная
 * очередь с расписанием — не здесь (этап 06 для исходящих событий,
 * этап 13 для надёжности).
 *
 * Документация: https://yandex.ru/dev/metrika/
 */

export const METRIKA_API = 'https://api-metrika.yandex.net';
export const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [500, 1500];

export type MetrikaErrorKind =
  | 'not_configured'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'http';

export class MetrikaApiError extends Error {
  constructor(
    readonly kind: MetrikaErrorKind,
    /** HTTP-код; 0 — ответа не было. */
    readonly status: number,
    readonly humanMessage: string,
    /** Фрагмент тела ответа Метрики — для разбора, без секретов. */
    readonly details?: string,
  ) {
    super(humanMessage);
    this.name = 'MetrikaApiError';
  }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function kindOf(status: number): MetrikaErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'http';
}

function humanize(kind: MetrikaErrorKind, status: number, apiMessage?: string): string {
  switch (kind) {
    case 'not_configured':
      return 'Интеграция с Яндекс Метрикой не настроена: нет YANDEX_METRIKA_COUNTER_ID или YANDEX_METRIKA_OAUTH_TOKEN.';
    case 'unauthorized':
      return 'Метрика не приняла OAuth-токен: он отсутствует, недействителен или отозван.';
    case 'forbidden':
      return 'У аккаунта токена нет прав на этот счётчик или у приложения нет нужного разрешения (metrika:read).';
    case 'rate_limited':
      return 'Метрика ограничила частоту запросов. Повторите позже.';
    case 'server':
      return 'Метрика сейчас недоступна (ошибка на её стороне).';
    case 'timeout':
      return `Метрика не ответила за ${REQUEST_TIMEOUT_MS / 1000} секунд.`;
    case 'network':
      return 'Не удалось связаться с Метрикой: сеть недоступна.';
    default:
      return apiMessage
        ? `Метрика вернула ошибку ${status}: ${apiMessage}`
        : `Метрика вернула ошибку ${status}.`;
  }
}

const RETRYABLE: ReadonlySet<MetrikaErrorKind> = new Set([
  'rate_limited',
  'server',
  'timeout',
  'network',
]);

@Injectable()
export class YandexMetrikaClient {
  private readonly logger = new Logger(YandexMetrikaClient.name);

  constructor(
    private readonly config: MetrikaConfig,
    /** Подменяется в тестах; в бою — глобальный fetch. */
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    /** Пауза между повторами; в тестах — без ожидания. */
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  isConfigured(): boolean {
    return isMetrikaConfigured(this.config);
  }

  get counterId(): number | null {
    return this.config.counterId;
  }

  /** Счётчик и его параметры. `fields` — например ['goals'], чтобы получить цели тем же запросом. */
  async getCounter(fields: string[] = []): Promise<MetrikaCounter> {
    const id = this.requireCounter();
    const query = fields.length > 0 ? `?field=${encodeURIComponent(fields.join(','))}` : '';
    const body = await this.get<MetrikaCounterResponse>(
      'counter',
      `/management/v1/counter/${id}${query}`,
    );
    return body.counter;
  }

  /** Все цели счётчика. */
  async getGoals(): Promise<MetrikaGoal[]> {
    const id = this.requireCounter();
    const body = await this.get<MetrikaGoalsResponse>(
      'goals',
      `/management/v1/counter/${id}/goals`,
    );
    return body.goals ?? [];
  }

  /** Отчёт: метрики (и измерения) за период. */
  async getStats(query: MetrikaStatsQuery): Promise<MetrikaStatsResponse> {
    const id = this.requireCounter();
    const params = new URLSearchParams();
    params.set('ids', String(id));
    params.set('metrics', query.metrics.join(','));
    if (query.dimensions?.length) params.set('dimensions', query.dimensions.join(','));
    params.set('date1', query.date1);
    params.set('date2', query.date2);
    if (query.filters) params.set('filters', query.filters);
    if (query.sort) params.set('sort', query.sort);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    if (query.accuracy) params.set('accuracy', query.accuracy);
    return this.get<MetrikaStatsResponse>('stats', `/stat/v1/data?${params.toString()}`);
  }

  private requireCounter(): number {
    if (!this.isConfigured() || this.config.counterId === null) {
      throw new MetrikaApiError('not_configured', 0, humanize('not_configured', 0));
    }
    return this.config.counterId;
  }

  /**
   * GET с повторами. Единственное место, где формируется заголовок
   * авторизации, — и единственное, где он существует как строка.
   */
  private async get<T>(operation: string, path: string): Promise<T> {
    const token = this.config.token;
    if (!token) {
      throw new MetrikaApiError('not_configured', 0, humanize('not_configured', 0));
    }
    let attempt = 0;
    for (;;) {
      const startedAt = Date.now();
      try {
        const result = await this.once<T>(path, token);
        this.log(operation, 200, startedAt, true);
        return result;
      } catch (error) {
        const e = error instanceof MetrikaApiError ? error : this.wrapUnknown(error);
        this.log(operation, e.status, startedAt, false, e.kind);
        const delay = RETRY_DELAYS_MS[attempt];
        if (RETRYABLE.has(e.kind) && delay !== undefined) {
          attempt += 1;
          await this.sleep(delay);
          continue;
        }
        throw e;
      }
    }
  }

  private async once<T>(path: string, token: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${METRIKA_API}${path}`, {
        method: 'GET',
        headers: {
          Authorization: `OAuth ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new MetrikaApiError('timeout', 0, humanize('timeout', 0));
      }
      throw new MetrikaApiError(
        'network',
        0,
        humanize('network', 0),
        error instanceof Error ? error.message : String(error),
      );
    }

    const raw = await res.text();
    if (!res.ok) {
      let apiMessage: string | undefined;
      try {
        const body = JSON.parse(raw) as MetrikaErrorBody;
        apiMessage = body.message ?? body.errors?.[0]?.message;
      } catch {
        apiMessage = raw.slice(0, 200) || undefined;
      }
      const kind = kindOf(res.status);
      throw new MetrikaApiError(kind, res.status, humanize(kind, res.status, apiMessage), raw.slice(0, 500));
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new MetrikaApiError('http', res.status, 'Метрика вернула не JSON.', raw.slice(0, 200));
    }
  }

  private wrapUnknown(error: unknown): MetrikaApiError {
    return new MetrikaApiError(
      'network',
      0,
      humanize('network', 0),
      error instanceof Error ? error.message : String(error),
    );
  }

  /** Лог без секретов: операция, счётчик, код, длительность. */
  private log(
    operation: string,
    status: number,
    startedAt: number,
    ok: boolean,
    kind?: MetrikaErrorKind,
  ): void {
    const line = `Метрика ${operation} counter=${this.config.counterId} → ${status} за ${Date.now() - startedAt} мс${
      kind ? ` (${kind})` : ''
    }`;
    if (ok) this.logger.log(line);
    else this.logger.warn(line);
  }
}
