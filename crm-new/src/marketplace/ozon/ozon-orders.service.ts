import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type OzonOrderSnapshot } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { matchesLineup } from './article-lineup';
import {
  OzonApiClient,
  OzonApiError,
  type OzonCredentials,
} from './ozon-api.client';
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

/**
 * Сколько отправлений Ozon отдаёт за один запрос.
 *
 * Сотня — потолок четвёртой версии метода, и он жёсткий: запрос на
 * большее отбивается целиком, а список выглядит пустым. Третья версия
 * разрешала тысячу, и на этом держался прежний расчёт — одна большая
 * страница и фильтр линейки у себя.
 */
const OZON_PAGE_LIMIT = 100;

/**
 * Докуда листаем.
 *
 * Фильтр линейки применяется уже у нас, после выдачи страницы: нужные
 * «papa» могут лежать за сотнями чужих отправлений, и остановка на
 * первой странице просто теряет заказы. Потолок всё же нужен — иначе
 * кабинет с тысячами отправлений выгребался бы целиком на каждый вход
 * в раздел.
 */
const OZON_MAX_POSTINGS = 1000;
/** Не дёргаем один и тот же список отдельно для экрана и фонового опроса. */
const ORDERS_CACHE_FRESH_MS = 6 * 60_000;
/** При 429 лучше показать недавний снимок, чем снова спрятать все заказы. */
const ORDERS_CACHE_STALE_MS = 7 * 24 * 60 * 60_000;

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
    products?: { payout?: number }[];
  };
}

/**
 * Ответ v4: отправления лежат в корне, без обёртки `result`, а страницы
 * идут курсором. У v3 было `{result: {postings, has_next}}` — разница
 * тихая: читать старое поле значит получить пустой список и показать
 * «заказов нет» вместо поломки.
 */
interface RawPostingListResponse {
  postings?: RawPosting[];
  has_next?: boolean;
  cursor?: string;
}

interface OrdersCacheEntry {
  response: RawPostingListResponse;
  refreshedAt: Date;
  freshUntil: number;
  staleUntil: number;
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
  /** Ozon временно отказал, поэтому отдан последний успешный снимок. */
  stale: boolean;
  /** Когда снимок был действительно получен от Ozon. */
  refreshedAt: string;
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
  private readonly logger = new Logger(OzonOrdersService.name);
  private readonly cache = new Map<string, OrdersCacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<{
      response: RawPostingListResponse;
      stale: boolean;
      refreshedAt: Date;
    }>
  >();

  constructor(
    private readonly api: OzonApiClient,
    private readonly prisma?: PrismaService,
  ) {}

  /**
   * Список отправлений за период. Ozon фильтрует по одному статусу, а нам
   * нужна группа (несколько статусов сразу), поэтому фильтруем на своей
   * стороне: запрашиваем всё за период и раскладываем по группам.
   *
   * Версия метода — четвёртая. Третью Ozon выключил: она отвечает
   * `400 {"code":9,"message":"obsolete method cannot be used"}`, и раздел
   * заказов переставал работать целиком. Поля отправления в v4 те же,
   * изменились конверт ответа и предел страницы: сотня вместо тысячи.
   *
   * `limit` здесь — сколько отправлений просмотреть всего. Страницы по
   * сотне собираются внутри, курсором: наружу это по-прежнему один
   * список, а не забота вызывающего.
   */
  async list(
    creds: OzonCredentials,
    options: {
      sinceDays?: number;
      /** Сколько отправлений просмотреть всего, а не за один запрос. */
      limit?: number;
      /**
       * Какими буквами начинается артикул нужной линейки («papa-»).
       * Пусто — не фильтруем вовсе: пустой список значит «показывать всё»,
       * а не «спрятать всё».
       */
      articlePrefixes?: readonly string[];
    } = {},
  ): Promise<OzonOrdersPage> {
    const sinceDays = options.sinceDays ?? 90;
    const limit = Math.min(options.limit ?? OZON_PAGE_LIMIT, OZON_MAX_POSTINGS);
    const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);

    const cached = await this.postings(creds, sinceDays, limit, since);
    const res = cached.response;

    const postings = res.postings ?? [];
    const all = postings.map((p) => this.toView(p));

    /*
     * Фильтр по началу артикула.
     *
     * В кабинете лежит несколько линеек, и в списке отправлений они
     * перемешаны. Владелец ведёт в CRM одну и просил показывать только её:
     * остальные мешают искать нужное.
     *
     * Сравнение не по буквам, а по тому, как артикул читается: «papa-»,
     * «PAPA-» и «ПАПА-» — одна линейка (правило в article-lineup.ts).
     * Прятать заказ из-за раскладки клавиатуры нельзя: его просто
     * не напечатают.
     *
     * Отправление остаётся, если подходит хотя бы одна позиция: в сборном
     * заказе рядом с нашей футболкой может лежать другой товар, и терять
     * такое отправление нельзя.
     */
    const prefixes = options.articlePrefixes ?? [];
    const orders =
      prefixes.length > 0
        ? all.filter((o) =>
            o.items.some((i) => matchesLineup(i.offerId, prefixes)),
          )
        : all;

    return {
      orders,
      hasNext: Boolean(res.has_next),
      hiddenByCatalog: all.length - orders.length,
      stale: cached.stale,
      refreshedAt: cached.refreshedAt.toISOString(),
    };
  }

  /**
   * Один запрос на кабинет и страницу обслуживает и экран, и фоновую сверку.
   *
   * Без этого фоновый опрос и React почти одновременно били в один метод
   * Ozon. При лимите площадки первый запрос проходил, а экран получал 429 и
   * выглядел пустым. Одновременные обращения объединяем, успешный ответ на
   * несколько минут переиспользуем, а при 429 отдаём последний снимок.
   */
  private postings(
    creds: OzonCredentials,
    sinceDays: number,
    limit: number,
    since: Date,
  ): Promise<{
    response: RawPostingListResponse;
    stale: boolean;
    refreshedAt: Date;
  }> {
    const key = JSON.stringify([creds.clientId, sinceDays, limit]);
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.freshUntil > now) {
      return Promise.resolve({
        response: cached.response,
        stale: false,
        refreshedAt: cached.refreshedAt,
      });
    }

    const running = this.inFlight.get(key);
    if (running) return running;

    const request = (async () => {
      const fallback = cached ?? (await this.loadPersisted(key));
      if (fallback && fallback.freshUntil > Date.now()) {
        return {
          response: fallback.response,
          stale: false,
          refreshedAt: fallback.refreshedAt,
        };
      }

      try {
        const response = await this.fetchAllPages(creds, limit, since);
        const refreshedAt = new Date();
        const entry: OrdersCacheEntry = {
          response,
          refreshedAt,
          freshUntil: refreshedAt.getTime() + ORDERS_CACHE_FRESH_MS,
          staleUntil: refreshedAt.getTime() + ORDERS_CACHE_STALE_MS,
        };
        this.cache.set(key, entry);
        await this.savePersisted(key, creds.clientId, entry);
        return { response, stale: false, refreshedAt };
      } catch (error: unknown) {
        if (
          error instanceof OzonApiError &&
          error.status === 429 &&
          fallback &&
          fallback.staleUntil > Date.now()
        ) {
          this.logger.warn(
            `Ozon ограничил запросы кабинета ${creds.clientId}; отдаю снимок от ${fallback.refreshedAt.toISOString()}`,
          );
          return {
            response: fallback.response,
            stale: true,
            refreshedAt: fallback.refreshedAt,
          };
        }
        throw error;
      }
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, request);
    return request;
  }

  /** Поднять последний снимок после перезапуска backend. */
  private async loadPersisted(
    key: string,
  ): Promise<OrdersCacheEntry | undefined> {
    if (!this.prisma) return undefined;
    let row: OzonOrderSnapshot | null;
    try {
      row = await this.prisma.ozonOrderSnapshot.findUnique({
        where: { cacheKey: key },
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось прочитать снимок заказов Ozon: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
    if (!row || row.staleUntil.getTime() <= Date.now()) return undefined;

    const entry: OrdersCacheEntry = {
      response: row.response as unknown as RawPostingListResponse,
      refreshedAt: row.refreshedAt,
      freshUntil: row.refreshedAt.getTime() + ORDERS_CACHE_FRESH_MS,
      staleUntil: row.staleUntil.getTime(),
    };
    this.cache.set(key, entry);
    return entry;
  }

  /** Сохранение кеша не должно превращать успешный ответ Ozon в ошибку. */
  private async savePersisted(
    key: string,
    clientId: string,
    entry: OrdersCacheEntry,
  ): Promise<void> {
    if (!this.prisma) return;
    try {
      await this.prisma.ozonOrderSnapshot.upsert({
        where: { cacheKey: key },
        create: {
          cacheKey: key,
          clientId,
          response: entry.response as unknown as Prisma.InputJsonValue,
          refreshedAt: entry.refreshedAt,
          staleUntil: new Date(entry.staleUntil),
        },
        update: {
          response: entry.response as unknown as Prisma.InputJsonValue,
          refreshedAt: entry.refreshedAt,
          staleUntil: new Date(entry.staleUntil),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось сохранить снимок заказов Ozon: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

  /**
   * Собирает страницы по сотне в один ответ.
   *
   * Фильтр линейки применяется уже у нас, после выдачи страницы, и
   * нужные отправления могут лежать за чужими. Поэтому листаем курсором,
   * пока площадка говорит «есть ещё» и пока не набрали столько, сколько
   * просили.
   *
   * Смещение здесь не годится: v4 его молча игнорирует — запрос с
   * offset=3 отдаёт ту же первую страницу.
   */
  private async fetchAllPages(
    creds: OzonCredentials,
    limit: number,
    since: Date,
  ): Promise<RawPostingListResponse> {
    const postings: RawPosting[] = [];
    let cursor = '';
    let hasNext = false;

    while (postings.length < limit) {
      const page = await this.api.post<RawPostingListResponse>(
        creds,
        '/v4/posting/fbs/list',
        {
          dir: 'DESC',
          filter: {
            since: since.toISOString(),
            to: new Date().toISOString(),
          },
          limit: Math.min(OZON_PAGE_LIMIT, limit - postings.length),
          // Пустой курсор — не «с начала», а неизвестно что: не шлём.
          ...(cursor ? { cursor } : {}),
          with: { financial_data: true },
        },
      );

      postings.push(...(page.postings ?? []));
      hasNext = Boolean(page.has_next);
      cursor = page.cursor ?? '';
      /*
        Площадка сказала «больше нет» — или перестала двигать курсор.
        Второе проверяем отдельно: без этого ошибка на её стороне
        превратилась бы в вечный цикл запросов.
      */
      if (!hasNext || !cursor || (page.postings ?? []).length === 0) break;
    }

    return { postings, has_next: hasNext };
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
