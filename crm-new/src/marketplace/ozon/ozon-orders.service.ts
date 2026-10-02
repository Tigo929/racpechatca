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
  /**
   * Сколько отправлений скрыто фильтром «только наши принты».
   *
   * Отдаём числом, а не молча: скрытый заказ — это заказ, которого человек
   * не увидит, и он должен знать, что они есть. Ноль — скрывать было нечего.
   */
  hiddenByCatalog: number;
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
    options: {
      sinceDays?: number;
      limit?: number;
      offset?: number;
      /**
       * Артикулы нашего каталога. Пусто — не фильтруем вовсе: пустой список
       * значит «каталог ещё не завели», и прятать по нему всё подряд нельзя.
       */
      knownOfferIds?: ReadonlySet<string>;
    } = {},
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
    const all = postings.map((p) => this.toView(p));

    /*
     * Фильтр «только наши принты».
     *
     * В кабинете лежат не только футболки с нашей печатью, и в списке
     * отправлений они перемешаны. Печатнику и менеджеру нужны свои —
     * остальные только мешают искать. Узнаём своё по артикулу: он есть
     * в каталоге CRM, из которого мы эти товары и завели.
     *
     * Отправление считается нашим, если наш артикул есть хотя бы у одной
     * позиции: в сборном заказе рядом с нашей футболкой может лежать чужой
     * товар, и терять такое отправление нельзя — печатать-то надо.
     */
    const known = options.knownOfferIds;
    const orders =
      known && known.size > 0
        ? all.filter((o) => o.items.some((i) => known.has(i.offerId)))
        : all;

    return {
      orders,
      hasNext: Boolean(res.result?.has_next),
      hiddenByCatalog: all.length - orders.length,
    };
  }

  /**
   * Одно отправление по номеру.
   *
   * Список сюда не годится: заказ заводят в CRM и через неделю после
   * оформления, а список отдаёт только последние страницы. Да и брать
   * двести отправлений ради одного — лишний запрос к площадке.
   */
  async get(
    creds: OzonCredentials,
    postingNumber: string,
  ): Promise<OzonOrderView | null> {
    const res = await this.api.post<{ result?: RawPosting }>(
      creds,
      '/v3/posting/fbs/get',
      {
        posting_number: postingNumber,
        with: { financial_data: true },
      },
    );
    const posting = res.result;
    if (!posting?.posting_number) return null;
    return this.toView(posting);
  }

  /**
   * Ярлык отправления (стикер) в PDF — тот самый, который клеят на посылку.
   *
   * Печатаем ярлык площадки, а не свой: по нему посылку принимает Ozon,
   * и второй наклейки на коробке быть не должно. Ярлык готов не сразу
   * после оформления — до сборки отправления площадка отвечает ошибкой,
   * и текст этой ошибки уходит человеку как есть.
   */
  async packageLabel(
    creds: OzonCredentials,
    postingNumber: string,
  ): Promise<Buffer> {
    return this.api.postBinary(creds, '/v2/posting/fbs/package-label', {
      posting_number: [postingNumber],
    });
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
