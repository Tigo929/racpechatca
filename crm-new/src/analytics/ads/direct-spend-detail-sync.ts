import type { PrismaService } from '../../prisma/prisma.service';
import type { YandexMetrikaClient } from '../../metrika/metrika-api.client';
import {
  assertRange,
  isoToUtcDate,
  type DateRange,
} from '../../metrika/analytics/metrika-dates';
import type { SyncLock } from '../../metrika/analytics/metrika-sync-lock';
import type { MetrikaStatsRow } from '../../metrika/metrika.types';
import type { DirectSpendConfig } from './direct-spend-sync';

/**
 * Расход Директа с детализацией до группы, объявления и ключа — для экрана
 * «Реклама». Тот же канал и те же правила, что у DirectSpendSync: только
 * чтение API Метрики (ym:ad:), только кампании из списка, полный
 * несэмплированный ответ, замена диапазона одной транзакцией.
 *
 * Объём крошечный (сотни строк за месяц), поэтому работает внутри обычного
 * расписания синхронизации Метрики, а не отдельной программой.
 */
export interface SpendDetailRow {
  date: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  adName: string;
  criterion: string;
  spend: number;
  clicks: number;
}

/** «M-1919748389799625446» → «1919748389799625446» (как в utm_content). */
export function bareAdId(id: string): string {
  return id.replace(/^[A-Z]-/, '');
}

export function parseDetailRow(
  row: MetrikaStatsRow,
  range: DateRange,
  campaignIds: string[],
): SpendDetailRow {
  const [day, order, group, banner, phrase] = row.dimensions;
  const date = day?.name ?? '';
  assertRange({ from: date, to: date });
  const campaignId = order?.id ?? '';
  const [spend, clicks] = row.metrics;
  if (
    date < range.from ||
    date > range.to ||
    !campaignIds.includes(campaignId) ||
    spend == null ||
    !Number.isFinite(spend) ||
    spend < 0 ||
    clicks == null ||
    !Number.isSafeInteger(clicks) ||
    clicks < 0
  )
    throw new Error('Invalid Direct spend detail row');
  return {
    date,
    campaignId,
    campaignName: order?.name ?? '',
    adGroupId: group?.id ?? '',
    adGroupName: group?.name ?? '',
    adId: bareAdId(banner?.id ?? ''),
    adName: banner?.name ?? '',
    criterion: phrase?.name ?? '',
    spend,
    clicks,
  };
}

export class DirectSpendDetailSync {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: Pick<YandexMetrikaClient, 'getStats'>,
    private readonly lock: SyncLock,
    private readonly config: DirectSpendConfig,
  ) {}

  async sync(
    range: DateRange,
  ): Promise<{ status: string; rows?: number; spend?: number }> {
    assertRange(range);
    const release = await this.lock.tryAcquire();
    if (!release) return { status: 'LOCKED' };
    try {
      const all: MetrikaStatsRow[] = [];
      const limit = 10000;
      for (let offset = 1; ; offset += limit) {
        const result = await this.client.getStats({
          date1: range.from,
          date2: range.to,
          direct_client_logins: [this.config.login],
          dimensions: [
            'ym:ad:date',
            'ym:ad:directOrder',
            'ym:ad:directBannerGroup',
            'ym:ad:directBanner',
            'ym:ad:directPhraseOrCond',
          ],
          metrics: ['ym:ad:RUBConvertedAdCost', 'ym:ad:clicks'],
          filters: this.config.campaignIds
            .map((id) => `ym:ad:directOrder=='${id}'`)
            .join(' OR '),
          sort: 'ym:ad:date',
          accuracy: 'full',
          limit,
          offset,
        });
        if (
          result.sampled ||
          (result.sample_share !== undefined && result.sample_share < 1)
        )
          throw new Error('Direct spend detail response is sampled');
        all.push(...result.data);
        if (result.data.length < limit) {
          if (
            result.total_rows !== undefined &&
            all.length !== result.total_rows
          )
            throw new Error('Incomplete Direct spend detail response');
          break;
        }
        if (offset >= 100000)
          throw new Error('Direct spend detail pagination limit exceeded');
      }
      // Одинаковый ключ бывает, когда у Метрики пустое измерение (нет имени
      // группы/объявления): суммируем, а не падаем — деньги не теряются.
      const merged = new Map<string, SpendDetailRow>();
      for (const raw of all) {
        const r = parseDetailRow(raw, range, this.config.campaignIds);
        const key = [
          r.date,
          r.campaignId,
          r.adGroupId,
          r.adId,
          r.criterion,
        ].join('\u0001');
        const prev = merged.get(key);
        if (prev) {
          prev.spend += r.spend;
          prev.clicks += r.clicks;
        } else merged.set(key, r);
      }
      const rows = [...merged.values()].map((r) => ({
        ...r,
        date: isoToUtcDate(r.date),
        source: 'YANDEX_DIRECT',
        vatBasis: 'EXCLUDED',
      }));
      await this.prisma.$transaction(async (tx) => {
        await tx.adSpendDetail.deleteMany({
          where: {
            source: 'YANDEX_DIRECT',
            campaignId: { in: this.config.campaignIds },
            date: {
              gte: isoToUtcDate(range.from),
              lte: isoToUtcDate(range.to),
            },
          },
        });
        if (rows.length) await tx.adSpendDetail.createMany({ data: rows });
      });
      return {
        status: 'SUCCESS',
        rows: rows.length,
        spend:
          Math.round(rows.reduce((s, r) => s + r.spend, 0) * 10000) / 10000,
      };
    } finally {
      await release();
    }
  }
}
