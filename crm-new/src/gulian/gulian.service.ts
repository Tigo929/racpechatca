import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

export interface GulianOrderPayload {
  externalOrderId: string;
  externalInternalId: string;
  sourceRevision: number;
  quantity: number;
  payoutCalculationMode: 'per_unit' | 'order_total';
  unitPayoutAmountKopecks: number | null;
  totalPayoutAmountKopecks: number;
  productionStatus: string;
  telegramChatId: string | null;
  telegramMessageId: string | null;
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GulianResponse {
  success: boolean;
  result: 'created' | 'updated' | 'duplicate' | 'unchanged' | 'stale' | 'ignored';
  externalOrderId?: string;
  settlementOrderId?: number;
  settlementOrderNumber?: string;
  positionId?: number;
  appliedRevision?: number;
  reason?: string;
}

@Injectable()
export class GulianService {
  private readonly logger = new Logger(GulianService.name);
  readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('GULIAN_INTEGRATION_ENABLED') === 'true';
    this.baseUrl = (config.get<string>('GULIAN_INTEGRATION_BASE_URL') ?? '').replace(/\/+$/, '');
    this.secret = config.get<string>('GULIAN_INTEGRATION_SECRET') ?? '';
    this.timeoutMs = Number(config.get('GULIAN_INTEGRATION_TIMEOUT_SECONDS') ?? 10) * 1000;
  }

  async upsertOrder(eventId: string, order: GulianOrderPayload): Promise<GulianResponse> {
    if (!this.enabled) {
      this.logger.log(`Gulian disabled — skip ${eventId}`);
      return { success: true, result: 'unchanged' };
    }
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000);
    const body = JSON.stringify({
      event_id: eventId,
      event_type: 'order.upsert',
      source: 'raspechatka',
      occurred_at: now.toISOString(),
      order: this.toApiOrder(order),
    });
    const sig = this.sign(ts, eventId, body);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/integrations/raspechatka/v1/orders/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-Timestamp': String(ts),
          'X-Integration-Request-ID': eventId,
          'X-Integration-Signature': sig,
        },
        body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { code: res.status, body: text });
      return JSON.parse(text) as GulianResponse;
    } finally {
      clearTimeout(t);
    }
  }

  async bulkUpsert(
    requestId: string,
    orders: Array<{ eventId: string; payload: GulianOrderPayload }>,
  ): Promise<Map<string, GulianResponse | { error: string }>> {
    if (!this.enabled) {
      const m = new Map<string, GulianResponse>();
      orders.forEach((o) => m.set(o.eventId, { success: true, result: 'unchanged' }));
      return m;
    }
    const now = new Date();
    const ts = Math.floor(now.getTime() / 1000);
    const body = JSON.stringify({
      request_id: requestId,
      source: 'raspechatka',
      occurred_at: now.toISOString(),
      orders: orders.map((o) => ({ event_id: o.eventId, event_type: 'order.upsert', ...this.toApiOrder(o.payload) })),
    });
    const sig = this.sign(ts, requestId, body);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/integrations/raspechatka/v1/orders/bulk-upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-Timestamp': String(ts),
          'X-Integration-Request-ID': requestId,
          'X-Integration-Signature': sig,
        },
        body,
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
      const parsed = JSON.parse(text) as { results?: Array<{ event_id: string } & GulianResponse> };
      const map = new Map<string, GulianResponse | { error: string }>();
      orders.forEach((o) => {
        const r = parsed.results?.find((x) => x.event_id === o.eventId);
        map.set(o.eventId, r ?? { error: 'no result' });
      });
      return map;
    } finally {
      clearTimeout(t);
    }
  }

  private toApiOrder(o: GulianOrderPayload) {
    return {
      external_order_id: o.externalOrderId,
      external_internal_id: o.externalInternalId,
      source_revision: o.sourceRevision,
      quantity: o.quantity,
      payout_calculation_mode: o.payoutCalculationMode,
      unit_payout_amount_kopecks: o.unitPayoutAmountKopecks,
      total_payout_amount_kopecks: o.totalPayoutAmountKopecks,
      currency: 'RUB',
      production_status: o.productionStatus,
      telegram_chat_id: o.telegramChatId,
      telegram_message_id: o.telegramMessageId,
      source_url: o.sourceUrl,
      created_at: o.createdAt.toISOString(),
      updated_at: o.updatedAt.toISOString(),
    };
  }

  private sign(ts: number, requestId: string, body: string): string {
    return createHmac('sha256', this.secret).update(`${ts}\n${requestId}\n${body}`).digest('hex');
  }
}