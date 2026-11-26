import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { OzonDeliveryClient } from './ozon-delivery.client';
import { scheduleText } from './ozon-shipment';

/**
 * Справочник пунктов выдачи Ozon для карты на сайте.
 *
 * Ozon отдаёт список по 1000 штук и подробности по 100 (проверено
 * 22.11.2026), а пунктов около 90 тысяч. Поэтому раз в сутки скачиваем всё
 * к себе, а сайт ищет в нашей базе: быстро и без лимитов Ozon. Пункты,
 * которых не стало в списке, гасим (isActive = false), а не удаляем: у
 * старых заказов может остаться ссылка на них.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 3 * 60 * 1000;
/** Меньше — справочник скачался не весь (в России ~90 тысяч пунктов). */
const MIN_COMPLETE = 60_000;
/**
 * Паузы перед повторами пачки. 22.11.2026 при трёх параллельных запросах
 * Ozon отказал примерно в половине пачек (пустой ответ — ограничение
 * частоты): из ~90 тысяч сохранилось 34 400. Повторяем с нарастающей паузой.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000];

interface ListResponse {
  delivery_points?: { delivery_point_id: number }[];
  next_cursor?: string | null;
}

interface InfoPoint {
  delivery_point_id: number;
  name?: string;
  delivery_point_number?: string;
  type?: string;
  full_address?: string;
  coordinates?: { latitude?: number; longitude?: number };
  is_active?: boolean;
  storage_period_days?: number;
  schedule?: {
    date?: string;
    periods?: { from_local?: string; to_local?: string }[];
  }[];
  restrictions?: { max_weight_g?: number };
}

export interface PointSearch {
  q?: string;
  lat?: number;
  lng?: number;
  /** Видимая область карты: юг, запад, север, восток. */
  bbox?: [number, number, number, number];
  limit?: number;
}

export interface PublicPoint {
  id: number;
  number: string | null;
  name: string | null;
  type: string | null;
  address: string;
  lat: number;
  lng: number;
  schedule: string | null;
  storageDays: number | null;
}

/** «Россия, Москва, …» → без страны: она одна и только занимает место. */
export function shortAddress(address: string): string {
  return address.replace(/^Россия,\s*/i, '').trim();
}

/** Слова запроса для поиска: «сиреневый 4/1» → ['сиреневый', '4/1']. */
export function queryWords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[,.;]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 6);
}

/**
 * Служебные слова, с которыми клиенты присылают адрес: «г. Москва, ул. …,
 * д. 4/1, пункт выдачи Ozon». В справочнике Ozon их нет или они написаны
 * иначе («ул» против «улица»), и поиск по ним ничего бы не нашёл.
 */
const ADDRESS_NOISE = new Set([
  'россия',
  'рф',
  'г',
  'город',
  'ул',
  'улица',
  'д',
  'дом',
  'стр',
  'пвз',
  'озон',
  'ozon',
  'пункт',
  'выдачи',
  'заказов',
  'пункта',
]);

/** Слова вставленного адреса без служебных: «г. Москва, ул. Ленина, д. 5» → ['москва', 'ленина', '5']. */
export function addressWords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[,.;:()«»"]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !ADDRESS_NOISE.has(w))
    .slice(0, 8);
}

@Injectable()
export class OzonPointsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OzonPointsService.name);
  private timers: NodeJS.Timeout[] = [];
  private syncing = false;
  private lastAttempt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ozon: OzonDeliveryClient,
  ) {}

  onModuleInit() {
    /*
     * Внутри CRM справочник по умолчанию НЕ качаем. 24.11.2026 загрузка
     * ~90 тысяч пунктов в процессе CRM упиралась в лимит памяти контейнера,
     * CRM падала каждые ~9 минут и после перезапуска начинала заново —
     * не работали задачи, поиск, всё. Теперь справочник качает отдельная
     * программа в своём контейнере (ozon-points-cli.ts, cron на сервере).
     */
    if (process.env.OZON_POINTS_SYNC_IN_APP !== 'true') return;
    if (process.env.NODE_ENV === 'test' || !this.ozon.configured) return;
    this.timers.push(
      setTimeout(() => void this.syncIfStale(), STARTUP_DELAY_MS),
      setInterval(() => void this.syncIfStale(), 60 * 60 * 1000),
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
  }

  /** Обновить, если справочник пуст или старше суток. */
  async syncIfStale(): Promise<void> {
    const latest = await this.prisma.ozonPickupPoint.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    // Справочник неполный (часть пачек Ozon не отдал) — догружаем, не ждём суток.
    const count = await this.prisma.ozonPickupPoint.count();
    const fresh = latest && Date.now() - latest.updatedAt.getTime() < DAY_MS;
    if (fresh && count >= MIN_COMPLETE) return;
    // Неполный — пробуем снова, но не чаще раза в 6 часов: если пунктов у
    // Ozon на самом деле меньше порога, не гоняем справочник каждый час.
    if (fresh && Date.now() - this.lastAttempt < 6 * 60 * 60 * 1000) return;
    this.lastAttempt = Date.now();
    await this.sync();
  }

  /**
   * Скачать справочник: страница списка (1000 id) → подробности по 100 →
   * сразу в базу. Список целиком в памяти не держим, пачки идут по одной.
   */
  async sync(
    opts: { from?: string } = {},
  ): Promise<{ total: number; saved: number; failed: number }> {
    if (this.syncing) return { total: 0, saved: 0, failed: 0 };
    this.syncing = true;
    const started = new Date();
    let total = 0;
    let saved = 0;
    let failed = 0;
    let complete = false;
    try {
      // Список идёт по возрастанию id, курсор — последний id: с него и
      // продолжаем, если прошлый запуск оборвался.
      let cursor: string | undefined = opts.from;
      if (cursor) this.logger.log(`Пункты Ozon: продолжаю после id ${cursor}`);
      for (let page = 0; page < 500; page++) {
        const res = await this.withRetry(() =>
          this.ozon.post<ListResponse>('/v1/delivery-point/list', {
            pagination: { limit: 1000, ...(cursor ? { cursor } : {}) },
          }),
        );
        const ids = (res.delivery_points ?? []).map((p) => p.delivery_point_id);
        total += ids.length;
        for (let k = 0; k < ids.length; k += 100) {
          const chunk = ids.slice(k, k + 100);
          try {
            saved += await this.withRetry(() => this.saveChunk(chunk));
          } catch (e) {
            failed++;
            const err = e as Error & { status?: number };
            this.logger.warn(
              `Пункты Ozon: пачка не сохранена (HTTP ${err.status ?? '?'}): ${err.message || 'пустой ответ'}`,
            );
          }
        }
        if (page % 10 === 9) {
          this.logger.log(
            `Пункты Ozon: обработано ${total}, сохранено ${saved}, память ${Math.round(process.memoryUsage().heapUsed / 1048576)} МБ`,
          );
        }
        if (!res.next_cursor || ids.length < 1000) {
          complete = true;
          break;
        }
        cursor = res.next_cursor;
      }

      // Пропавшие из списка — гасим, только если список пройден целиком.
      if (!opts.from && complete && total > 1000 && saved > total * 0.9) {
        await this.prisma.ozonPickupPoint.updateMany({
          where: { updatedAt: { lt: started } },
          data: { isActive: false },
        });
      }
      this.logger.log(
        `Пункты Ozon: в списке ${total}, сохранено ${saved}, не загружено пачек ${failed}`,
      );
      return { total, saved, failed };
    } catch (e) {
      this.logger.error('Пункты Ozon: загрузка не удалась', e as Error);
      return { total, saved, failed };
    } finally {
      this.syncing = false;
    }
  }

  private async withRetry<T>(job: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await job();
      } catch (e) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) throw e;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  private async saveChunk(ids: number[]): Promise<number> {
    const res = await this.ozon.post<{ delivery_points?: InfoPoint[] }>(
      '/v1/delivery-point/info',
      { delivery_point_ids: ids },
    );
    const rows = (res.delivery_points ?? []).filter(
      (p) =>
        p.full_address && p.coordinates?.latitude && p.coordinates?.longitude,
    );
    if (!rows.length) return 0;
    /*
     * Одним запросом на пачку, а не сотней upsert в транзакции: на ~400
     * пачках Prisma-транзакции копили память (24.11.2026 программа дошла до
     * 820 МБ и упала на ~35 тысячах пунктов).
     */
    const values = rows.map((p) => {
      const address = shortAddress(p.full_address!);
      return Prisma.sql`(${p.delivery_point_id}, ${p.delivery_point_number ?? null}, ${p.name ?? null}, ${p.type ?? null}, ${address}, ${`${address} ${p.delivery_point_number ?? ''}`.toLowerCase().replace(/ё/g, 'е')}, ${p.coordinates!.latitude!}, ${p.coordinates!.longitude!}, ${scheduleText(p.schedule)}, ${p.storage_period_days ?? null}, ${p.restrictions?.max_weight_g ?? null}, ${p.is_active !== false}, NOW())`;
    });
    await this.prisma.$executeRaw`
      INSERT INTO "OzonPickupPoint"
        ("id", "number", "name", "type", "address", "search", "lat", "lng", "schedule", "storageDays", "maxWeightG", "isActive", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("id") DO UPDATE SET
        "number" = EXCLUDED."number", "name" = EXCLUDED."name", "type" = EXCLUDED."type",
        "address" = EXCLUDED."address", "search" = EXCLUDED."search", "lat" = EXCLUDED."lat",
        "lng" = EXCLUDED."lng", "schedule" = EXCLUDED."schedule", "storageDays" = EXCLUDED."storageDays",
        "maxWeightG" = EXCLUDED."maxWeightG", "isActive" = EXCLUDED."isActive", "updatedAt" = NOW()
    `;
    return rows.length;
  }

  /**
   * Поиск для сайта: по словам адреса, по видимой области карты или
   * ближайшие к точке. Всегда только действующие пункты, ближние — первыми.
   */
  async search(params: PointSearch): Promise<PublicPoint[]> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
    const conds: Prisma.Sql[] = [Prisma.sql`"isActive" = true`];
    for (const w of queryWords(params.q ?? '')) {
      conds.push(Prisma.sql`"search" LIKE ${'%' + w + '%'}`);
    }
    const box = params.bbox;
    if (box) {
      const [s, w, n, e] = box;
      conds.push(
        Prisma.sql`"lat" BETWEEN ${s} AND ${n} AND "lng" BETWEEN ${w} AND ${e}`,
      );
    }
    const lat = params.lat ?? (box ? (box[0] + box[2]) / 2 : null);
    const lng = params.lng ?? (box ? (box[1] + box[3]) / 2 : null);
    // Только координаты без запроса и области — ищем в окрестности ~30 км,
    // иначе база отсортирует все 90 тысяч ради десятка ближайших.
    if (lat !== null && lng !== null && !params.bbox && !params.q?.trim()) {
      conds.push(
        Prisma.sql`"lat" BETWEEN ${lat - 0.3} AND ${lat + 0.3} AND "lng" BETWEEN ${lng - 0.5} AND ${lng + 0.5}`,
      );
    }
    const order =
      lat !== null && lng !== null
        ? Prisma.sql`ORDER BY ("lat" - ${lat}) * ("lat" - ${lat}) + (("lng" - ${lng}) * ${Math.cos((lat * Math.PI) / 180)}) * (("lng" - ${lng}) * ${Math.cos((lat * Math.PI) / 180)})`
        : Prisma.sql`ORDER BY "address"`;
    return this.prisma.$queryRaw<PublicPoint[]>`
      SELECT "id", "number", "name", "type", "address", "lat", "lng", "schedule", "storageDays"
      FROM "OzonPickupPoint"
      WHERE ${Prisma.join(conds, ' AND ')}
      ${order}
      LIMIT ${limit}
    `;
  }

  /**
   * Поиск для CRM: менеджер вставляет адрес, который прислал клиент.
   * Сначала ищем по всем словам; не нашлось — отбрасываем слова с конца
   * (обычно это «корпус 1», «4к1» против «4/1» в справочнике) и показываем
   * пункты на той же улице с пометкой «точного совпадения нет».
   */
  async findByAddress(
    q: string,
    limit = 30,
  ): Promise<{ points: PublicPoint[]; exact: boolean }> {
    const words = addressWords(q);
    if (!words.length) return { points: [], exact: true };
    for (let n = words.length; n >= 1; n--) {
      const points = await this.search({
        q: words.slice(0, n).join(' '),
        limit,
      });
      if (points.length) return { points, exact: n === words.length };
      if (n <= 2 && words.length > 2) break; // одно-два слова — это уже весь город
    }
    return { points: [], exact: true };
  }

  async count(): Promise<number> {
    return this.prisma.ozonPickupPoint.count({ where: { isActive: true } });
  }
}
