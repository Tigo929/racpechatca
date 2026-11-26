import {
  AUTOTARGETING,
  VAT_RATE,
  normalizeKeyword,
  type AdPerformance,
} from './ad-performance';

/**
 * Поисковые запросы для экрана «Реклама»: что набирали люди, по какому ключу
 * и в какой группе показалось объявление, сколько это стоило.
 *
 * Заявка сама запрос не несёт (в метке только ключ), поэтому заявки у запроса
 * не выдумываются: рядом показано, сколько заявок и оплат принёс ключ, по
 * которому этот запрос показался. Запрос с кликами под ключом без заявок —
 * первый кандидат в минус-слова.
 */

export interface SearchQueryInput {
  campaignId: string;
  adGroupId: string;
  query: string;
  criterion: string;
  matchType: string;
  impressions: number;
  clicks: number;
  /** Без НДС. */
  spend: number;
}

export interface SearchQueryStat {
  query: string;
  groupId: string;
  groupName: string;
  /** Ключ, как на экране выше: «Автотаргетинг» или текст ключа. */
  keyword: string;
  matchType: string;
  impressions: number;
  clicks: number;
  /** С НДС, ₽. */
  spend: number;
  /** Клики / показы, %; null — показов нет. */
  ctr: number | null;
  /** Заявки и оплаты ключа, под которым показался запрос (не самого запроса). */
  keywordLeads: number;
  keywordPaid: number;
}

export interface SearchQueriesBlock {
  /** Все запросы периода, не только показанные. */
  total: {
    queries: number;
    impressions: number;
    clicks: number;
    spend: number;
    /** Расход на запросы под ключами, у которых за период нет ни одной заявки. */
    spendUnderKeywordsWithoutLeads: number;
  };
  rows: SearchQueryStat[];
  /** Сколько запросов с расходом не поместилось в rows. */
  hidden: number;
}

export const SEARCH_QUERY_LIMIT = 300;

export function computeSearchQueries(
  input: SearchQueryInput[],
  perf: AdPerformance,
  limit = SEARCH_QUERY_LIMIT,
): SearchQueriesBlock {
  const groups = new Map<
    string,
    {
      name: string;
      keywords: Map<string, { label: string; leads: number; paid: number }>;
    }
  >();
  for (const c of perf.campaigns)
    for (const g of c.groups)
      groups.set(`${c.id}\u0001${g.id}`, {
        name: g.name,
        keywords: new Map(
          g.keywords.map((k) => [
            k.key,
            { label: k.label, leads: k.leads, paid: k.paidOrders },
          ]),
        ),
      });

  type Acc = Omit<SearchQueryStat, 'spend' | 'ctr'> & { spendNet: number };
  const merged = new Map<string, Acc>();
  for (const r of input) {
    const key = normalizeKeyword(r.criterion);
    const id = [r.campaignId, r.adGroupId, r.query.toLowerCase(), key].join(
      '\u0001',
    );
    let a = merged.get(id);
    if (!a) {
      const g = groups.get(`${r.campaignId}\u0001${r.adGroupId}`);
      const k = g?.keywords.get(key);
      a = {
        query: r.query,
        groupId: r.adGroupId,
        groupName: g?.name ?? `Группа ${r.adGroupId}`,
        keyword:
          k?.label ||
          (key === AUTOTARGETING ? 'Автотаргетинг' : r.criterion || '—'),
        matchType: r.matchType,
        impressions: 0,
        clicks: 0,
        spendNet: 0,
        keywordLeads: k?.leads ?? 0,
        keywordPaid: k?.paid ?? 0,
      };
      merged.set(id, a);
    }
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    a.spendNet += r.spend;
  }

  const all = [...merged.values()];
  const vat = (n: number) => Math.round(n * (1 + VAT_RATE));
  const paidRows = all
    .filter((a) => a.spendNet > 0)
    .sort((a, b) => b.spendNet - a.spendNet || b.clicks - a.clicks);
  const sum = (f: (a: Acc) => number, rows = all) =>
    rows.reduce((s, a) => s + f(a), 0);

  return {
    total: {
      queries: all.length,
      impressions: sum((a) => a.impressions),
      clicks: sum((a) => a.clicks),
      spend: vat(sum((a) => a.spendNet)),
      spendUnderKeywordsWithoutLeads: vat(
        sum(
          (a) => a.spendNet,
          all.filter((a) => a.keywordLeads === 0),
        ),
      ),
    },
    rows: paidRows.slice(0, limit).map(({ spendNet, ...a }) => ({
      ...a,
      spend: vat(spendNet),
      ctr: a.impressions
        ? Math.round((a.clicks / a.impressions) * 10000) / 100
        : null,
    })),
    hidden: Math.max(0, paidRows.length - limit),
  };
}
