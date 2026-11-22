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
const PARALLEL = 2;
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

  async sync(): Promise<{ total: number; saved: number }> {
    if (this.syncing) return { total: 0, saved: 0 };
    this.syncing = true;
    const started = new Date();
    try {
      const ids: number[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 500; page++) {
        const res = await this.ozon.post<ListResponse>(
          '/v1/delivery-point/list',
          {
            pagination: { limit: 1000, ...(cursor ? { cursor } : {}) },
          },
        );
        const batch = res.delivery_points ?? [];
        ids.push(...batch.map((p) => p.delivery_point_id));
        if (!res.next_cursor || batch.length < 1000) break;
        cursor = res.next_cursor;
      }

      const chunks: number[][] = [];
      for (let i = 0; i < ids.length; i += 100)
        chunks.push(ids.slice(i, i + 100));
      let saved = 0;
      let failed = 0;
      let next = 0;
      const worker = async () => {
        while (next < chunks.length) {
          const chunk = chunks[next++];
          for (let attempt = 0; ; attempt++) {
            try {
              saved += await this.saveChunk(chunk);
              break;
            } catch (e) {
              const delay = RETRY_DELAYS_MS[attempt];
              if (delay === undefined) {
                failed++;
                const err = e as Error & { status?: number };
                this.logger.warn(
                  `Пункты Ozon: пачка не сохранена после повторов (HTTP ${err.status ?? '?'}): ${err.message || 'пустой ответ'}`,
                );
                break;
              }
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));

      // Пропавшие из списка — гасим. Только если список пришёл целиком.
      if (ids.length > 1000 && saved > ids.length * 0.9) {
        await this.prisma.ozonPickupPoint.updateMany({
          where: { updatedAt: { lt: started } },
          data: { isActive: false },
        });
      }
      this.logger.log(
        `Пункты Ozon: в списке ${ids.length}, сохранено ${saved}, не загружено пачек ${failed}`,
      );
      return { total: ids.length, saved };
    } catch (e) {
      this.logger.error('Пункты Ozon: загрузка не удалась', e as Error);
      return { total: 0, saved: 0 };
    } finally {
      this.syncing = false;
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
    await this.prisma.$transaction(
      rows.map((p) => {
        const address = shortAddress(p.full_address!);
        const data = {
          number: p.delivery_point_number ?? null,
          name: p.name ?? null,
          type: p.type ?? null,
          address,
          search: `${address} ${p.delivery_point_number ?? ''}`
            .toLowerCase()
            .replace(/ё/g, 'е'),
          lat: p.coordinates!.latitude!,
          lng: p.coordinates!.longitude!,
          schedule: scheduleText(p.schedule),
          storageDays: p.storage_period_days ?? null,
          maxWeightG: p.restrictions?.max_weight_g ?? null,
          isActive: p.is_active !== false,
        };
        return this.prisma.ozonPickupPoint.upsert({
          where: { id: p.delivery_point_id },
          create: { id: p.delivery_point_id, ...data },
          update: data,
        });
      }),
    );
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

  async count(): Promise<number> {
    return this.prisma.ozonPickupPoint.count({ where: { isActive: true } });
  }
}
