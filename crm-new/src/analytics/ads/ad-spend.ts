import type { SpendMetrics } from '../metrics/metrics-contract';

/** Расходы и результаты сайта — разные наборы. ClientID не доказывает
 * рекламное происхождение; окупаемость требует атрибутированной когорты. */
export interface AdSpendRow {
  /** День в московском календаре, ISO. */
  date: string;
  source: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number | null;
  vatBasis?: string;
}

export interface AdSpendTotals {
  spend: number;
  clicks: number;
  impressions: number | null;
  vatBasis?: string;
  days: number;
  campaigns: number;
}

export function sumAdSpend(rows: AdSpendRow[]): AdSpendTotals {
  return {
    spend: Math.round(rows.reduce((s, r) => s + r.spend, 0) * 10000) / 10000,
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    impressions: rows.some((r) => r.impressions === null)
      ? null
      : rows.reduce((s, r) => s + (r.impressions ?? 0), 0),
    vatBasis:
      new Set(rows.map((r) => r.vatBasis ?? 'UNKNOWN')).size === 1
        ? (rows[0]?.vatBasis ?? 'UNKNOWN')
        : 'MIXED',
    days: new Set(rows.map((r) => r.date)).size,
    campaigns: new Set(rows.map((r) => r.campaignId).filter(Boolean)).size,
  };
}

/** Все результаты сайта, включая органику и прямые заходы. */
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

export function computeSpendMetrics(
  totals: AdSpendTotals,
  outcome: WebsiteOutcome,
): SpendMetrics {
  if (totals.days === 0) {
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

  // ClientID identifies a visitor, not a paid advertising source. Even 100%
  // coverage cannot attribute organic/direct orders to these campaigns.
  // WebsiteOutcome contains all website outcomes, not an attributed cohort.
  void outcome;

  return {
    status: 'ATTRIBUTION_NOT_ESTABLISHED',
    spend: totals.spend,
    vatBasis: totals.vatBasis,
    clicks: totals.clicks,
    impressions: totals.impressions,
    cpl: null,
    cpa: null,
    cpo: null,
    roas: null,
    romi: null,
    attributionReliable: false,
  };
}
