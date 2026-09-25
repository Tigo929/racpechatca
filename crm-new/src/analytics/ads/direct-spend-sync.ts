import type { PrismaService } from '../../prisma/prisma.service';
import type { YandexMetrikaClient } from '../../metrika/metrika-api.client';
import {
  assertRange,
  isoToUtcDate,
  type DateRange,
} from '../../metrika/analytics/metrika-dates';
import type { SyncLock } from '../../metrika/analytics/metrika-sync-lock';
import type { MetrikaStatsRow } from '../../metrika/metrika.types';

export interface DirectSpendConfig {
  login: string;
  campaignIds: string[];
}

export function directSpendConfig(
  env: Record<string, string | undefined> = process.env,
): DirectSpendConfig | null {
  const login = env.YANDEX_DIRECT_ANALYTICS_LOGIN?.trim();
  const campaignIds = (env.YANDEX_DIRECT_ANALYTICS_CAMPAIGNS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return login &&
    campaignIds.length &&
    campaignIds.every((id) => /^\d+$/.test(id))
    ? { login, campaignIds }
    : null;
}

/** Read-only API → local analytics; never creates financial expense records.
 * Only configured campaigns are replaced, after a complete unsampled response.
 * Source/campaign/day keys are shared with imports, so overlapping runs do not
 * duplicate spend. Unknown impressions remain null, not invented zeroes.
 */
export class DirectSpendSync {
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
          dimensions: ['ym:ad:date', 'ym:ad:directOrder'],
          metrics: ['ym:ad:RUBConvertedAdCost', 'ym:ad:clicks'],
          filters: this.config.campaignIds
            .map((id) => `ym:ad:directOrder=='${id}'`)
            .join(' OR '),
          sort: 'ym:ad:date,ym:ad:directOrder',
          accuracy: 'full',
          limit,
          offset,
        });
        if (
          result.sampled ||
          (result.sample_share !== undefined && result.sample_share < 1)
        )
          throw new Error('Direct spend response is sampled');
        all.push(...result.data);
        if (result.data.length < limit) {
          if (
            result.total_rows !== undefined &&
            all.length !== result.total_rows
          )
            throw new Error('Incomplete Direct spend response');
          break;
        }
        if (offset >= 100000)
          throw new Error('Direct spend pagination limit exceeded');
      }
      const seen = new Set<string>();
      const rows = all.map((row) => {
        const date = row.dimensions[0]?.name ?? '';
        const campaignId = row.dimensions[1]?.id ?? '';
        const [spend, clicks] = row.metrics;
        assertRange({ from: date, to: date });
        if (
          date < range.from ||
          date > range.to ||
          !this.config.campaignIds.includes(campaignId) ||
          spend == null ||
          !Number.isFinite(spend) ||
          spend < 0 ||
          clicks == null ||
          !Number.isSafeInteger(clicks) ||
          clicks < 0
        )
          throw new Error('Invalid Direct spend row');
        const key = `${date}:${campaignId}`;
        if (seen.has(key)) throw new Error('Duplicate Direct spend row');
        seen.add(key);
        return {
          date: isoToUtcDate(date),
          source: 'YANDEX_DIRECT',
          campaignId,
          campaignName: row.dimensions[1]?.name ?? '',
          spend,
          clicks,
          impressions: null,
          vatBasis: 'EXCLUDED',
        };
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.adSpend.deleteMany({
          where: {
            source: 'YANDEX_DIRECT',
            campaignId: { in: this.config.campaignIds },
            date: {
              gte: isoToUtcDate(range.from),
              lte: isoToUtcDate(range.to),
            },
          },
        });
        if (rows.length) await tx.adSpend.createMany({ data: rows });
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
