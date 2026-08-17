import { Injectable } from '@nestjs/common';
import { OzonApiClient, type OzonCredentials } from './ozon-api.client';
import {
  groupForStatus,
  isShipmentOverdue,
  statusLabel,
  type OzonOrderGroup,
} from './ozon-order-status';

/**
 * Заказы Ozon по схеме FBS (продавец отгружает сам) — именно она у продавца:
 * товары числятся с `has_fbs_stocks`, отгрузка идёт со склада «первомай».
 *
 * Наружу отдаём не сырое отправление Ozon (там под 40 полей, из которых
 * оператору нужны пять), а нормализованную форму: что заказали, до когда
 * отгрузить и горит ли срок.
 */

const OZON_MAX_LIMIT = 1000;

interface RawPostingProduct {
  offer_id?: string;
  name?: string;
  sku?: number;
  quantity?: number;
  price?: string;
}

interface RawPosting {
  posting_number?: string;
  order_number?: string;
  status?: string;
  substatus?: string;
  in_process_at?: string;
  shipment_date?: string;
  delivering_date?: string;
  tracking_number?: string;
  products?: RawPostingProduct[];
  delivery_method?: { name?: string; warehouse?: string };
  cancellation?: { cancel_reason?: string };
  financial_data?: {
    products?: { payout?: number; commission_amount?: number }[];
  };
}

interface RawPostingListResponse {
  result?: { postings?: RawPosting[]; has_next?: boolean };
}

export interface OzonOrderItem {
  offerId: string;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
}

export interface OzonOrderView {
  postingNumber: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  group: OzonOrderGroup;
  /** Когда заказ оформлен. */
  createdAt: string | null;
  /** До какого момента продавец обязан отгрузить. */
  shipmentDate: string | null;
  /** Срок отгрузки уже прошёл, а заказ всё ещё не отгружен. */
  shipmentOverdue: boolean;
  deliveringDate: string | null;
  trackingNumber: string | null;
  deliveryMethod: string | null;
  warehouse: string | null;
  cancelReason: string | null;
  items: OzonOrderItem[];
  /** Сумма по позициям, ₽. */
  total: number;
  /** Сколько Ozon выплатит продавцу; 0, пока заказ не доставлен. */
  payout: number;
}

export interface OzonOrdersPage {
  orders: OzonOrderView[];
  hasNext: boolean;
}

@Injectable()
export class OzonOrdersService {
  constructor(private readonly api: OzonApiClient) {}

  /**
   * Список отправлений за период. Ozon фильтрует по одному статусу, а нам
   * нужна группа (несколько статусов сразу), поэтому фильтруем на своей
   * стороне: запрашиваем всё за период и раскладываем по группам.
   */
  async list(
    creds: OzonCredentials,
    options: { sinceDays?: number; limit?: number; offset?: number } = {},
  ): Promise<OzonOrdersPage> {
    const sinceDays = options.sinceDays ?? 90;
    const limit = Math.min(options.limit ?? 100, OZON_MAX_LIMIT);
    const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);

    const res = await this.api.post<RawPostingListResponse>(
      creds,
      '/v3/posting/fbs/list',
      {
        dir: 'DESC',
        filter: { since: since.toISOString(), to: new Date().toISOString() },
        limit,
        offset: options.offset ?? 0,
        with: { financial_data: true },
      },
    );

    const postings = res.result?.postings ?? [];
    return {
      orders: postings.map((p) => this.toView(p)),
      hasNext: Boolean(res.result?.has_next),
    };
  }

  private toView(p: RawPosting): OzonOrderView {
    const status = p.status ?? 'unknown';
    const group = groupForStatus(status);
    const shipmentDate = p.shipment_date ?? null;

    const items: OzonOrderItem[] = (p.products ?? []).map((prod) => ({
      offerId: prod.offer_id ?? '',
      name: prod.name ?? '',
      // sku приходит числом, но это идентификатор, а не величина —
      // в JSON наружу отдаём строкой, чтобы не потерять точность в JS.
      sku: prod.sku !== undefined ? String(prod.sku) : null,
      quantity: prod.quantity ?? 0,
      price: Number(prod.price ?? 0),
    }));

    return {
      postingNumber: p.posting_number ?? '',
      orderNumber: p.order_number ?? '',
      status,
      statusLabel: statusLabel(status),
      group,
      createdAt: p.in_process_at ?? null,
      shipmentDate,
      shipmentOverdue: isShipmentOverdue(group, shipmentDate),
      deliveringDate: p.delivering_date ?? null,
      trackingNumber: p.tracking_number || null,
      deliveryMethod: p.delivery_method?.name ?? null,
      warehouse: p.delivery_method?.warehouse ?? null,
      cancelReason: p.cancellation?.cancel_reason || null,
      items,
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      payout: (p.financial_data?.products ?? []).reduce(
        (sum, f) => sum + (f.payout ?? 0),
        0,
      ),
    };
  }
}
