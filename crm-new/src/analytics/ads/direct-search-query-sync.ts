import type { PrismaService } from '../../prisma/prisma.service';
import {
  assertRange,
  isoToUtcDate,
  type DateRange,
} from '../../metrika/analytics/metrika-dates';
import type { SyncLock } from '../../metrika/analytics/metrika-sync-lock';

/**
 * Поисковые запросы Директа — что человек на самом деле набрал, когда
 * увидел объявление. Источник — Reports API Директа
 * (SEARCH_QUERY_PERFORMANCE_REPORT): у Метрики поисковая фраза есть только
 * у визитов, которые она увидела, — это ~80 % расхода, а не весь.
 *
 * Только чтение. Запускается отдельной программой (ads:search-queries) по
 * расписанию на сервере, в своём контейнере: backend её не держит.
 * Диапазон заменяется одной транзакцией и только после полного ответа.
 */

export interface DirectReportsConfig {
  token: string;
  login: string;
  campaignIds: string[];
}

export function directReportsConfig(
  env: Record<string, string | undefined> = process.env,
): DirectReportsConfig | null {
  const token = env.YANDEX_DIRECT_REPORTS_TOKEN?.trim();
  const login = env.YANDEX_DIRECT_ANALYTICS_LOGIN?.trim();
  const campaignIds = (env.YANDEX_DIRECT_ANALYTICS_CAMPAIGNS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return token &&
    login &&
    campaignIds.length &&
    campaignIds.every((id) => /^\d+$/.test(id))
    ? { token, login, campaignIds }
    : null;
}

export const SEARCH_QUERY_FIELDS = [
  'Date',
  'CampaignId',
  'AdGroupId',
  'Query',
  'Criterion',
  'CriterionType',
  'MatchType',
  'Impressions',
  'Clicks',
  'Cost',
] as const;

export interface SearchQueryRow {
  date: string;
  campaignId: string;
  adGroupId: string;
  query: string;
  criterion: string;
  criterionType: string;
  matchType: string;
  impressions: number;
  clicks: number;
  /** Без НДС, ₽. */
  spend: number;
}

const int = (s: string | undefined) => {
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error('Invalid integer in search query report');
  return n;
};

/**
 * TSV отчёта (без шапки с названием и без итоговой строки) → строки.
 * Одинаковые ключи (то же объявление в другой группе не бывает, но разные
 * объявления одной группы — бывают) складываются.
 */
export function parseSearchQueryTsv(
  tsv: string,
  range: DateRange,
  campaignIds: string[],
): SearchQueryRow[] {
  const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) throw new Error('Empty search query report');
  const head = lines[0].split('\t');
  const at = SEARCH_QUERY_FIELDS.map((f) => {
    const i = head.indexOf(f);
    if (i < 0) throw new Error(`Search query report misses column ${f}`);
    return i;
  });
  const merged = new Map<string, SearchQueryRow>();
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    const [date, campaignId, adGroupId, query, criterion, ctype, mtype] = at
      .slice(0, 7)
      .map((i) => (c[i] ?? '').trim());
    assertRange({ from: date, to: date });
    if (date < range.from || date > range.to)
      throw new Error('Search query row outside requested range');
    if (!campaignIds.includes(campaignId))
      throw new Error('Search query row from unexpected campaign');
    const spend = Number(c[at[9]]);
    if (!Number.isFinite(spend) || spend < 0)
      throw new Error('Invalid cost in search query report');
    const row: SearchQueryRow = {
      date,
      campaignId,
      adGroupId,
      query: query === '--' ? '' : query,
      criterion: criterion === '--' ? '' : criterion,
      criterionType: ctype === '--' ? '' : ctype,
      matchType: mtype === '--' ? '' : mtype,
      impressions: int(c[at[7]]),
      clicks: int(c[at[8]]),
      spend,
    };
    const key = [date, campaignId, adGroupId, row.query, row.criterion].join(
      '\u0001',
    );
    const prev = merged.get(key);
    if (prev) {
      prev.impressions += row.impressions;
      prev.clicks += row.clicks;
      prev.spend += row.spend;
    } else merged.set(key, row);
  }
  return [...merged.values()];
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

const REPORTS_URL = 'https://api.direct.yandex.com/json/v5/reports';

/**
 * Офлайн-отчёт Директа: 201/202 — «готовится, спросите через retryIn
 * секунд», 200 — готово. Ошибку API отдаём текстом без токена.
 */
export async function fetchSearchQueryReport(
  config: DirectReportsConfig,
  range: DateRange,
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
  maxAttempts = 40,
): Promise<string> {
  const body = JSON.stringify({
    params: {
      SelectionCriteria: {
        DateFrom: range.from,
        DateTo: range.to,
        Filter: [
          {
            Field: 'CampaignId',
            Operator: 'IN',
            Values: config.campaignIds,
          },
        ],
      },
      FieldNames: SEARCH_QUERY_FIELDS,
      // Имя отчёта должно быть уникальным для набора параметров: Директ
      // кэширует по имени и на те же параметры с другим именем не обижается.
      ReportName: `crm-search-queries-${range.from}-${range.to}-${Date.now()}`,
      ReportType: 'SEARCH_QUERY_PERFORMANCE_REPORT',
      DateRangeType: 'CUSTOM_DATE',
      Format: 'TSV',
      IncludeVAT: 'NO',
      IncludeDiscount: 'NO',
    },
  });
  const headers = {
    Authorization: `Bearer ${config.token}`,
    'Client-Login': config.login,
    'Accept-Language': 'ru',
    'Content-Type': 'application/json; charset=utf-8',
    processingMode: 'auto',
    returnMoneyInMicros: 'false',
    skipReportHeader: 'true',
    skipReportSummary: 'true',
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchImpl(REPORTS_URL, {
      method: 'POST',
      headers,
      body,
    });
    if (res.status === 200) return res.text();
    if (res.status === 201 || res.status === 202) {
      const retry = Number(res.headers.get('retryIn'));
      await sleep((Number.isFinite(retry) && retry > 0 ? retry : 10) * 1000);
      continue;
    }
    const text = await res.text();
    let detail = `HTTP ${res.status}`;
    try {
      const e = (
        JSON.parse(text) as {
          error?: { error_code?: string; error_detail?: string };
        }
      ).error;
      if (e)
        detail =
          `${detail} ${e.error_code ?? ''} ${e.error_detail ?? ''}`.trim();
    } catch {
      // не JSON — код ответа достаточно
    }
    throw new Error(`Direct Reports API: ${detail}`);
  }
  throw new Error('Direct Reports API: report not ready in time');
}

export class DirectSearchQuerySync {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: SyncLock,
    private readonly config: DirectReportsConfig,
    private readonly fetchReport: (range: DateRange) => Promise<string> = (
      range,
    ) => fetchSearchQueryReport(config, range),
  ) {}

  async sync(
    range: DateRange,
  ): Promise<{ status: string; rows?: number; spend?: number }> {
    assertRange(range);
    const release = await this.lock.tryAcquire();
    if (!release) return { status: 'LOCKED' };
    try {
      const tsv = await this.fetchReport(range);
      const rows = parseSearchQueryTsv(tsv, range, this.config.campaignIds).map(
        (r) => ({ ...r, date: isoToUtcDate(r.date) }),
      );
      await this.prisma.$transaction(
        async (tx) => {
          await tx.adSearchQueryDaily.deleteMany({
            where: {
              campaignId: { in: this.config.campaignIds },
              date: {
                gte: isoToUtcDate(range.from),
                lte: isoToUtcDate(range.to),
              },
            },
          });
          for (let i = 0; i < rows.length; i += 5000)
            await tx.adSearchQueryDaily.createMany({
              data: rows.slice(i, i + 5000),
            });
        },
        { timeout: 120_000 },
      );
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
