import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import type { GulianHttpResponse, GulianUpsertEvent } from './gulian.types';

function envEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function signGulianBody(
  secret: string,
  timestamp: string,
  requestId: string,
  rawBody: Buffer,
): string {
  const signed = Buffer.concat([
    Buffer.from(timestamp, 'utf8'),
    Buffer.from('\n', 'utf8'),
    Buffer.from(requestId, 'utf8'),
    Buffer.from('\n', 'utf8'),
    rawBody,
  ]);
  return createHmac('sha256', secret).update(signed).digest('hex');
}

@Injectable()
export class GulianClient {
  readonly enabled: boolean;
  readonly timeoutSeconds: number;
  readonly maxAttempts: number;
  readonly bulkSize: number;
  readonly scanIntervalSeconds: number;

  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.enabled = envEnabled(config.get<string>('GULIAN_INTEGRATION_ENABLED'));
    this.baseUrl = (config.get<string>('GULIAN_INTEGRATION_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    this.secret = config.get<string>('GULIAN_INTEGRATION_SECRET') ?? '';
    this.timeoutSeconds = positiveInt(
      config.get<string>('GULIAN_INTEGRATION_TIMEOUT_SECONDS'),
      15,
    );
    this.maxAttempts = positiveInt(
      config.get<string>('GULIAN_INTEGRATION_MAX_ATTEMPTS'),
      20,
    );
    this.bulkSize = Math.min(
      100,
      positiveInt(config.get<string>('GULIAN_INTEGRATION_BULK_SIZE'), 100),
    );
    this.scanIntervalSeconds = positiveInt(
      config.get<string>('GULIAN_INTEGRATION_SCAN_INTERVAL_SECONDS'),
      10,
    );
  }

  assertConfigured(): void {
    if (!this.baseUrl) throw new Error('GULIAN_INTEGRATION_BASE_URL не задан');
    if (!this.secret) throw new Error('GULIAN_INTEGRATION_SECRET не задан');
  }

  async send(events: GulianUpsertEvent[]): Promise<GulianHttpResponse> {
    if (events.length === 0) throw new Error('Нет событий для отправки');
    if (events.length > this.bulkSize) {
      throw new Error(`Размер Gulian bulk превышает ${this.bulkSize}`);
    }
    this.assertConfigured();

    const single = events.length === 1;
    const requestId = single ? events[0].event_id : randomUUID();
    const payload = single ? events[0] : { events };
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signGulianBody(
      this.secret,
      timestamp,
      requestId,
      rawBody,
    );
    const endpoint = single
      ? '/api/integrations/raspechatka/v1/orders/upsert'
      : '/api/integrations/raspechatka/v1/orders/bulk-upsert';

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Integration-Timestamp': timestamp,
        'X-Integration-Request-ID': requestId,
        'X-Integration-Signature': signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
    });
    const rawResponse = await response.text();
    let json: unknown = null;
    try {
      json = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      json = null;
    }
    return {
      requestId,
      statusCode: response.status,
      rawBody: rawResponse,
      json,
    };
  }
}