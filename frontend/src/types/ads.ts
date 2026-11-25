/** Экран «Реклама» — тот же контракт, что AdPerformanceResponse на бэкенде. */
export interface AdStats {
  /** С НДС, ₽. */
  spend: number;
  clicks: number;
  leads: number;
  paidOrders: number;
  cancelled: number;
  revenue: number;
  costPerLead: number | null;
  costPerOrder: number | null;
  /** Расход / выручка, %. */
  spendShare: number | null;
}
export interface AdKeywordRow extends AdStats {
  key: string;
  label: string;
}
export interface AdGroupRow extends AdStats {
  id: string;
  name: string;
  keywords: AdKeywordRow[];
}
export interface AdCampaignRow extends AdStats {
  id: string;
  name: string;
  groups: AdGroupRow[];
}
export interface AdPerformance {
  period: { from: string; to: string };
  spendDays: number;
  spendLastDate: string | null;
  totals: AdStats & {
    spendWithoutVat: number;
    siteLeads: number;
    nonAdLeads: number;
    adLeadsWithKeyword: number;
    adLeadsWithGroup: number;
  };
  campaigns: AdCampaignRow[];
}
