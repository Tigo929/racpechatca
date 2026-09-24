import type { SpendMetrics } from '../metrics/metrics-contract';

/**
 * Экономика рекламы: расход против результата.
 *
 * Отчёт умел считать выручку и прибыль, но не умел ответить на главный
 * вопрос — окупается ли реклама: в системе не было ни рубля расходов.
 * Здесь расход встречается с результатом.
 *
 * Правило, ради которого всё и делается: рекламе приписываются ТОЛЬКО
 * заказы сайта. Ручной заказ с Avito сайт не создавал, и делить на него
 * рекламный бюджет значит рисовать себе окупаемость, которой нет.
 *
 * Второе правило: считать можно лишь то, что измерено. Если у заказов
 * сайта нет идентификаторов визита (ClientID или yclid), связь «клик →
 * заказ» не доказана, и отчёт обязан сказать это прямо, а не показать
 * красивый ROAS «на всякий случай».
 */

/** Ниже этого покрытия связь «реклама → заказ» не доказана. */
export const ATTRIBUTION_MIN_COVERAGE_PCT = 50;

export interface AdSpendRow {
  /** День в московском календаре, ISO. */
  date: string;
  source: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
}

export interface AdSpendTotals {
  spend: number;
  clicks: number;
  impressions: number;
  days: number;
  campaigns: number;
}

export function sumAdSpend(rows: AdSpendRow[]): AdSpendTotals {
  return {
    spend: rows.reduce((s, r) => s + r.spend, 0),
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    days: new Set(rows.map((r) => r.date)).size,
    campaigns: new Set(rows.map((r) => r.campaignId).filter(Boolean)).size,
  };
}

/** Результат рекламы: только то, что принёс сайт. */
export interface WebsiteOutcome {
  /** Заявки с сайта (цель Метрики) — их и оптимизирует Директ. */
  siteLeads: number;
  /** Принятые заказы происхождения WEBSITE. */
  acceptedOrders: number;
  /** Оплаченные заказы происхождения WEBSITE. */
  paidOrders: number;
  /** Выручка заказов WEBSITE по канонической методике P&L. */
  revenue: number;
  /** Валовая прибыль заказов WEBSITE. */
  grossProfit: number;
  /** Доля заказов сайта, которые связаны с визитом (ClientID или yclid). */
  identityCoveragePct: number | null;
}

const ratio = (a: number, b: number): number | null =>
  b > 0 ? Math.round((a / b) * 100) / 100 : null;

/**
 * Показатели окупаемости.
 *
 * CPL — цена заявки, CPA — цена принятого заказа, CPO — цена оплаченного.
 * ROAS — выручка на рубль расхода, ROMI — сколько прибыли принёс рубль
 * расхода за вычетом самого расхода.
 *
 * Расход есть, а результата нет — это не ошибка и не ноль: деньги
 * потрачены, заявок нет, и такой месяц надо видеть. Нет расхода —
 * считать нечего, возвращаем статус, а не нули: ноль читается как
 * «реклама бесплатна».
 */
export function computeSpendMetrics(
  totals: AdSpendTotals,
  outcome: WebsiteOutcome,
): SpendMetrics {
  if (totals.spend <= 0) {
    return {
      status: 'UNAVAILABLE_NO_SPEND_DATA',
      spend: 0,
      clicks: 0,
      impressions: 0,
      cpl: null,
      cpa: null,
      cpo: null,
      roas: null,
      romi: null,
      attributionReliable: false,
    };
  }

  /*
   * Покрытие ниже порога — деньги считаем, окупаемость нет.
   *
   * ROAS при покрытии в треть означал бы «реклама окупается втрое», хотя
   * две трети заказов к рекламе отнесены наугад. Лучше честный пропуск,
   * чем уверенная неправда: по ней принимают решение о бюджете.
   */
  const reliable =
    outcome.identityCoveragePct !== null &&
    outcome.identityCoveragePct >= ATTRIBUTION_MIN_COVERAGE_PCT;

  return {
    status: reliable ? 'AVAILABLE' : 'ATTRIBUTION_COVERAGE_TOO_LOW',
    spend: totals.spend,
    clicks: totals.clicks,
    impressions: totals.impressions,
    cpl: ratio(totals.spend, outcome.siteLeads),
    cpa: ratio(totals.spend, outcome.acceptedOrders),
    cpo: ratio(totals.spend, outcome.paidOrders),
    roas: reliable ? ratio(outcome.revenue, totals.spend) : null,
    romi: reliable
      ? ratio(outcome.grossProfit - totals.spend, totals.spend)
      : null,
    attributionReliable: reliable,
  };
}
