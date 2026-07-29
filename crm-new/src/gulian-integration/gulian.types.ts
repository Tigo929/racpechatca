export type GulianProductionStatus =
  | 'sent'
  | 'in_progress'
  | 'ready'
  | 'problem'
  | 'cancelled';

export type GulianResultName =
  | 'created'
  | 'updated'
  | 'duplicate'
  | 'unchanged'
  | 'stale'
  | 'ignored';

export interface GulianOrderPayload {
  external_order_id: string;
  external_internal_id: string;
  source_revision: number;
  quantity: number;
  payout_calculation_mode: 'per_unit' | 'order_total';
  unit_payout_amount_kopecks: number | null;
  total_payout_amount_kopecks: number;
  currency: 'RUB';
  production_status: GulianProductionStatus;
  telegram_chat_id: string | null;
  telegram_message_id: string | null;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface GulianUpsertEvent {
  event_id: string;
  event_type: 'order.upsert';
  source: 'raspechatka';
  occurred_at: string;
  order: GulianOrderPayload;
}

export interface GulianItemResult {
  success?: boolean;
  result?: GulianResultName;
  reason?: string;
  index?: number;
  external_order_id?: string;
  settlement_order_id?: number;
  settlement_order_number?: string;
  position_id?: number;
  applied_revision?: number;
  message?: string;
}

export interface GulianHttpResponse {
  requestId: string;
  statusCode: number;
  rawBody: string;
  json: unknown;
}