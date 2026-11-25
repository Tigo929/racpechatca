/**
 * Экран «Реклама»: расход Директа против заявок и оплаченных заказов —
 * по кампании, группе и ключевому слову.
 *
 * Правило привязки одно и строгое: заявка рекламная, если в ней есть метка
 * клика Директа (yclid) или utm от Директа (utm_source=yandex, utm_medium=cpc).
 * Ключ берётся из utm_term, объявление — из utm_content; по объявлению
 * находится группа (объявление живёт ровно в одной группе). Ничего не
 * распределяется «пропорционально»: чего метка не сказала, то показано
 * отдельной строкой «не определено».
 *
 * Деньги: Метрика отдаёт расход без НДС, кабинет и счёт — с НДС. Цены
 * заявки и заказа считаются с НДС — столько реально уходит с карты.
 *
 * Оплата — то же правило, что у P&L (isRevenueRealized в reports.service):
 * у фото «Отправлен» значит «отдан клиенту, деньги получены» (владелец,
 * 26.11.2026), у футболок и холстов — только «передан производителю», и
 * выручкой это ещё не является. Плюс стоит дата оплаты или «Ждём отзыв».
 *
 * Маржинальный доход до рекламы — прибыль заказа по методике P&L (addOrder):
 * выручка − себестоимость (order-cogs.ts) − начисленная зарплата + заработок
 * на доставке. Своей формулы здесь нет. Если себестоимость заказа неизвестна,
 * маржа строки не считается вовсе (null), а не берётся «как есть»: иначе
 * холст без цены подрядчика показал бы маржу 100 %.
 */

import { isRevenueRealized } from '../../reports/reports.service';

export const VAT_RATE = 0.2;

export interface SpendDetailInput {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  criterion: string;
  /** Без НДС. */
  spend: number;
  clicks: number;
}

export interface LeadInput {
  status: string;
  productCategory: string;
  /** Прибыль заказа по методике P&L, ₽; null — себестоимость неизвестна. */
  margin: number | null;
  clientPaidAt: Date | null;
  totalOrder: number;
  hasYclid: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface AdStats {
  /** С НДС, ₽. */
  spend: number;
  clicks: number;
  leads: number;
  paidOrders: number;
  cancelled: number;
  /** Сумма оплаченных заказов, ₽. */
  revenue: number;
  /** Цена заявки, ₽ с НДС; null — заявок нет. */
  costPerLead: number | null;
  /** Цена оплаченного заказа, ₽ с НДС; null — оплат нет. */
  costPerOrder: number | null;
  /** Расход / выручка, %; null — выручки нет. */
  spendShare: number | null;
  /** Выручка / расход, %. */
  roas: number | null;
  /** Маржинальный доход до рекламы, ₽; null — у части оплат нет себестоимости. */
  marginBeforeAds: number | null;
  /** Маржинальный доход после рекламы (минус расход с НДС), ₽. */
  marginAfterAds: number | null;
  /** Маржа после рекламы / расход, %. */
  romi: number | null;
  /** Оплаченных заказов без надёжной себестоимости. */
  paidWithoutCogs: number;
}

export interface KeywordRow extends AdStats {
  key: string;
  label: string;
}
export interface GroupRow extends AdStats {
  id: string;
  name: string;
  keywords: KeywordRow[];
}
export interface CampaignRow extends AdStats {
  id: string;
  name: string;
  groups: GroupRow[];
}

export interface AdPerformance {
  totals: AdStats & {
    spendWithoutVat: number;
    siteLeads: number;
    nonAdLeads: number;
    adLeadsWithKeyword: number;
    adLeadsWithGroup: number;
  };
  campaigns: CampaignRow[];
}

export const AUTOTARGETING = 'autotargeting';
export const UNKNOWN = '';

/** utm_term и условие показа из Метрики → один вид для сравнения. */
export function normalizeKeyword(raw: string | null | undefined): string {
  if (!raw) return UNKNOWN;
  let s = raw;
  try {
    s = decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    // битая %-последовательность — сравниваем как есть
  }
  s = s.toLowerCase().replace(/ё/g, 'е').trim();
  if (/^-*autotargeting$/.test(s)) return AUTOTARGETING;
  // минус-слова в utm_term не передаются — отрезаем их и у условия показа
  s = s.replace(/\s+-\S.*$/, '');
  s = s
    .replace(/["[\]!+]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export function isAdLead(l: LeadInput): boolean {
  if (l.hasYclid) return true;
  const src = (l.utmSource ?? '').toLowerCase();
  const med = (l.utmMedium ?? '').toLowerCase();
  return (
    (src.startsWith('ya') || src === 'direct') &&
    (med === 'cpc' || med === 'ppc')
  );
}

export function isPaid(
  l: Pick<LeadInput, 'status' | 'productCategory' | 'clientPaidAt'>,
): boolean {
  if (l.status === 'CANCELLED') return false;
  return (
    l.clientPaidAt !== null ||
    l.status === 'READY_FOR_REVIEW' ||
    isRevenueRealized(l.status, l.productCategory)
  );
}

/**
 * Экономика по готовым суммам — одна функция на строку, итог и тест ТЗ
 * (25 000 расхода, 80 000 выручки, 30 000 себестоимости → маржа после
 * рекламы 25 000, ROAS 320 %, ДРР 31,25 %, ROMI 100 %).
 */
export function economics(
  spend: number,
  revenue: number,
  marginBeforeAds: number | null,
): Pick<
  AdStats,
  'spendShare' | 'roas' | 'marginBeforeAds' | 'marginAfterAds' | 'romi'
> {
  const pct = (n: number) => Math.round(n * 100) / 100;
  const marginAfterAds =
    marginBeforeAds === null ? null : marginBeforeAds - spend;
  return {
    spendShare: spend && revenue ? pct((spend / revenue) * 100) : null,
    roas: spend ? pct((revenue / spend) * 100) : null,
    marginBeforeAds,
    marginAfterAds,
    romi:
      spend && marginAfterAds !== null
        ? pct((marginAfterAds / spend) * 100)
        : null,
  };
}

interface Acc {
  spendNet: number;
  clicks: number;
  leads: number;
  paidOrders: number;
  cancelled: number;
  revenue: number;
  margin: number;
  paidWithoutCogs: number;
}
const acc = (): Acc => ({
  spendNet: 0,
  clicks: 0,
  leads: 0,
  paidOrders: 0,
  cancelled: 0,
  revenue: 0,
  margin: 0,
  paidWithoutCogs: 0,
});

const round = (n: number) => Math.round(n);

function finish(a: Acc): AdStats {
  const spend = a.spendNet * (1 + VAT_RATE);
  return {
    spend: round(spend),
    clicks: a.clicks,
    leads: a.leads,
    paidOrders: a.paidOrders,
    cancelled: a.cancelled,
    revenue: round(a.revenue),
    // Без расхода цены нет вовсе: строка «не определено» несёт заявки, но
    // не деньги — «0 ₽ за заявку» читалось бы как бесплатная реклама.
    costPerLead: spend && a.leads ? round(spend / a.leads) : null,
    costPerOrder: spend && a.paidOrders ? round(spend / a.paidOrders) : null,
    ...economics(
      round(spend),
      round(a.revenue),
      a.paidWithoutCogs ? null : round(a.margin),
    ),
    paidWithoutCogs: a.paidWithoutCogs,
  };
}

function addLead(a: Acc, l: LeadInput) {
  a.leads += 1;
  if (l.status === 'CANCELLED') a.cancelled += 1;
  else if (isPaid(l)) {
    a.paidOrders += 1;
    a.revenue += l.totalOrder || 0;
    if (l.margin === null) a.paidWithoutCogs += 1;
    else a.margin += l.margin;
  }
}

export function computeAdPerformance(
  spend: SpendDetailInput[],
  leads: LeadInput[],
): AdPerformance {
  type K = { acc: Acc; label: string; labelSpend: number };
  type G = { acc: Acc; name: string; keywords: Map<string, K> };
  type C = { acc: Acc; name: string; groups: Map<string, G> };
  const campaigns = new Map<string, C>();
  const adToGroup = new Map<string, { campaignId: string; groupId: string }>();
  /** campaignId → ключ → множество групп, где этот ключ есть. */
  const keywordGroups = new Map<string, Map<string, Set<string>>>();

  const campaign = (id: string, name = '') => {
    let c = campaigns.get(id);
    if (!c) campaigns.set(id, (c = { acc: acc(), name, groups: new Map() }));
    if (!c.name && name) c.name = name;
    return c;
  };
  const group = (c: C, id: string, name = '') => {
    let g = c.groups.get(id);
    if (!g) c.groups.set(id, (g = { acc: acc(), name, keywords: new Map() }));
    if (!g.name && name) g.name = name;
    return g;
  };
  const keyword = (g: G, key: string) => {
    let k = g.keywords.get(key);
    if (!k)
      g.keywords.set(key, (k = { acc: acc(), label: '', labelSpend: -1 }));
    return k;
  };

  for (const r of spend) {
    const c = campaign(r.campaignId, r.campaignName);
    const g = group(c, r.adGroupId, r.adGroupName);
    const key = normalizeKeyword(r.criterion);
    const k = keyword(g, key);
    for (const a of [c.acc, g.acc, k.acc]) {
      a.spendNet += r.spend;
      a.clicks += r.clicks;
    }
    if (r.spend > k.labelSpend) {
      k.label = r.criterion;
      k.labelSpend = r.spend;
    }
    if (r.adId)
      adToGroup.set(r.adId, { campaignId: r.campaignId, groupId: r.adGroupId });
    let byKey = keywordGroups.get(r.campaignId);
    if (!byKey) keywordGroups.set(r.campaignId, (byKey = new Map()));
    let groups = byKey.get(key);
    if (!groups) byKey.set(key, (groups = new Set()));
    groups.add(r.adGroupId);
  }

  const total = acc();
  let siteLeads = 0;
  let nonAdLeads = 0;
  let withKeyword = 0;
  let withGroup = 0;
  const knownCampaigns = [...campaigns.keys()];

  for (const l of leads) {
    siteLeads += 1;
    if (!isAdLead(l)) {
      nonAdLeads += 1;
      continue;
    }
    addLead(total, l);
    const key = normalizeKeyword(l.utmTerm);
    if (key) withKeyword += 1;
    const byAd = l.utmContent ? adToGroup.get(l.utmContent.trim()) : undefined;
    let campaignId =
      byAd?.campaignId ??
      (l.utmCampaign && campaigns.has(l.utmCampaign.trim())
        ? l.utmCampaign.trim()
        : knownCampaigns.length === 1
          ? knownCampaigns[0]
          : UNKNOWN);
    let groupId = byAd?.groupId ?? UNKNOWN;
    if (!groupId && key) {
      const groups = keywordGroups.get(campaignId)?.get(key);
      if (groups?.size === 1) groupId = [...groups][0];
    }
    if (!campaignId) campaignId = UNKNOWN;
    if (groupId) withGroup += 1;
    const c = campaign(campaignId);
    const g = group(c, groupId);
    const k = keyword(g, key);
    for (const a of [c.acc, g.acc, k.acc]) addLead(a, l);
  }

  const bySpend = <T extends { acc: Acc }>(a: [string, T], b: [string, T]) =>
    b[1].acc.spendNet - a[1].acc.spendNet || b[1].acc.leads - a[1].acc.leads;

  return {
    totals: {
      ...finish({
        ...total,
        spendNet: [...campaigns.values()].reduce(
          (s, c) => s + c.acc.spendNet,
          0,
        ),
        clicks: [...campaigns.values()].reduce((s, c) => s + c.acc.clicks, 0),
      }),
      spendWithoutVat: round(
        [...campaigns.values()].reduce((s, c) => s + c.acc.spendNet, 0),
      ),
      siteLeads,
      nonAdLeads,
      adLeadsWithKeyword: withKeyword,
      adLeadsWithGroup: withGroup,
    },
    campaigns: [...campaigns.entries()].sort(bySpend).map(([id, c]) => ({
      id,
      name: c.name || (id ? `Кампания ${id}` : 'Кампания не определена'),
      ...finish(c.acc),
      groups: [...c.groups.entries()].sort(bySpend).map(([gid, g]) => ({
        id: gid,
        name: g.name || (gid ? `Группа ${gid}` : 'Группа не определена'),
        ...finish(g.acc),
        keywords: [...g.keywords.entries()].sort(bySpend).map(([key, k]) => ({
          key,
          label:
            key === AUTOTARGETING
              ? 'Автотаргетинг'
              : key === UNKNOWN
                ? 'Ключ не передан'
                : k.label || key,
          ...finish(k.acc),
        })),
      })),
    })),
  };
}
