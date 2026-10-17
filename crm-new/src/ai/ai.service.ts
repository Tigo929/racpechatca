import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * Разговор с ИИ-агентом.
 *
 * CRM сама ничего не придумывает: вопрос уходит шлюзу, который и ходит
 * в базу через MCP и читает код проектов. Здесь — только дверь: проверка
 * доступа (в контроллере), адрес, общий секрет и понятная ошибка вместо
 * молчания.
 *
 * Шлюз наружу не смотрит: он слушает внутреннюю сеть докера, и попасть
 * к нему можно только отсюда. Поэтому вся защита — на этой стороне.
 */

export interface AiAnswer {
  session: string;
  answer: string;
  /** Какими инструментами агент пользовался — видно, на чём основан ответ. */
  tools: string[];
  usage: Record<string, number>;
  requestId: string;
  durationMs: number;
}

/**
 * Полторы минуты: агент может сделать десяток обращений к базе и к коду,
 * прежде чем ответить. Короткий срок обрывал бы ровно сложные вопросы —
 * те, ради которых его и спрашивают.
 */
const TIMEOUT_MS = 180_000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private get url(): string {
    return (process.env.AI_GATEWAY_URL ?? 'http://ai-gateway:8010').replace(
      /\/$/,
      '',
    );
  }

  private get token(): string {
    return (process.env.AI_GATEWAY_TOKEN ?? '').trim();
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  async ask(
    question: string,
    session?: string,
    userId = 'unknown',
  ): Promise<AiAnswer> {
    if (!this.isConfigured()) {
      // Пустой секрет — это выключенная функция, а не открытая дверь.
      throw new ServiceUnavailableException(
        'ИИ-агент не настроен: не задан AI_GATEWAY_TOKEN.',
      );
    }

    const requestId = randomUUID();
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(`${this.url}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          'X-Request-Id': requestId,
          'X-CRM-User-Id': userId,
        },
        body: JSON.stringify({ question, session: session || undefined }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `AI request ${requestId} failed after ${Date.now() - startedAt} ms: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'ИИ-агент сейчас недоступен. Попробуйте позже.',
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.warn(
        `Шлюз ИИ ответил ${response.status}: ${detail.slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        response.status === 409
          ? 'Предыдущий вопрос ещё обрабатывается — подождите ответа.'
          : 'ИИ-агент не смог ответить. Попробуйте переформулировать вопрос.',
      );
    }

    const payload = (await response
      .json()
      .catch(() => null)) as Partial<AiAnswer> | null;
    if (
      !payload ||
      typeof payload.session !== 'string' ||
      typeof payload.answer !== 'string' ||
      !Array.isArray(payload.tools) ||
      payload.tools.some((tool) => typeof tool !== 'string')
    ) {
      this.logger.error(`AI request ${requestId} returned an invalid payload`);
      throw new ServiceUnavailableException(
        'ИИ-агент вернул некорректный ответ. Попробуйте позже.',
      );
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `AI request ${requestId} completed for user ${userId} in ${durationMs} ms; tools=${payload.tools.length}`,
    );
    return {
      session: payload.session,
      answer: payload.answer,
      tools: payload.tools,
      usage:
        payload.usage && typeof payload.usage === 'object' ? payload.usage : {},
      requestId,
      durationMs,
    };
  }

  /** Состояние шлюза: какие источники подключены и сколько инструментов. */
  async health(): Promise<Record<string, unknown>> {
    if (!this.isConfigured()) {
      return { status: 'disabled', configured: false };
    }
    try {
      const response = await fetch(`${this.url}/health`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return { status: 'unavailable', configured: true };
      }
      const health = (await response.json()) as Record<string, unknown>;
      return { ...health, configured: true };
    } catch {
      return { status: 'unavailable', configured: true };
    }
  }
}
