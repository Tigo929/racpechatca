import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { isoToUtcDate } from '../../metrika/analytics/metrika-dates';
import {
  periodBoundsUtc,
  type AnalyticsPeriod,
} from '../metrics/analytics-period';
import {
  costSettingsFrom,
  orderCostOfGoods,
  type CostSettings,
} from '../../reports/order-cogs';
import {
  addOrder,
  emptyBucket,
  type OrderRow,
} from '../../reports/reports.service';
import {
  computeAdPerformance,
  isAdLead,
  isPaid,
  normalizeKeyword,
  type AdPerformance,
  type LeadInput,
} from './ad-performance';
import {
  computeSearchQueries,
  type SearchQueriesBlock,
} from './ad-search-queries';

export interface AdDataQuality {
  /** Последний загруженный день расхода (YYYY-MM-DD) или null. */
  spendLastDate: string | null;
  /** Дней периода, за которые расход по объявлениям загружен. */
  spendDays: number;
  periodDays: number;
  /** Когда последний раз успешно прошёл синк Метрики (ISO) или null. */
  metrikaSyncedAt: string | null;
  /** Заявки с сайта: всего / с меткой клика / без метки, но с ClientID / без ничего. */
  siteLeads: number;
  adLeads: number;
  leadsClientIdOnly: number;
  leadsNoIdentity: number;
  adLeadsWithoutKeyword: number;
  adLeadsWithoutGroup: number;
  /** Оплаченные рекламные заказы без себестоимости — маржа по ним не считается. */
  paidWithoutCogs: number;
  /** Очередь «заказ → Метрика → Директ». */
  outboxPending: number;
  outboxFailed: number;
}

export interface AdPerformanceResponse extends AdPerformance {
  period: { from: string; to: string };
  spendDays: number;
  spendLastDate: string | null;
  quality: AdDataQuality;
  /** Поисковые запросы Директа; null — за период они не загружены. */
  searchQueries: SearchQueriesBlock | null;
}

/** Прибыль одного заказа по методике P&L: addOrder на пустую корзину. */
export function orderMargin(order: OrderRow, s: CostSettings): number | null {
  if (!orderCostOfGoods(order, s).reliable) return null;
  const b = emptyBucket();
  addOrder(b, order, s);
  return b.photoProfit + b.tshirtProfit + b.canvasProfit;
}

/**
 * Данные экрана «Реклама»: расход из AdSpendDetail, заявки — заказы
 * происхождения WEBSITE, созданные в периоде (по московскому дню).
 * Формулы — в computeAdPerformance и в P&L; здесь только чтение базы.
 */
@Injectable()
export class AdPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async get(period: AnalyticsPeriod): Promise<AdPerformanceResponse> {
    const dateWhere = {
      gte: isoToUtcDate(period.from),
      lte: isoToUtcDate(period.to),
    };
    const { start, endExclusive } = periodBoundsUtc(period);
    const [spend, orders, last, settings, sync, outbox, queries] =
      await Promise.all([
        this.prisma.adSpendDetail.findMany({ where: { date: dateWhere } }),
        this.prisma.orderPhoto.findMany({
          where: {
            sourceOrder: 'WEBSITE',
            createdAt: { gte: start, lt: endExclusive },
          },
          select: {
            status: true,
            yclid: true,
            yandexClientId: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmContent: true,
            utmTerm: true,
            // поля OrderRow — ровно то, что берёт P&L для прибыли заказа
            sourceOrder: true,
            sentAt: true,
            completedAt: true,
            statusChangedAt: true,
            createdAt: true,
            clientPaidAt: true,
            totalOrder: true,
            deliveryCost: true,
            deliveryMethod: true,
            ozonShipment: {
              select: {
                actualCost: true,
                estimatedCost: true,
                estimatedInsurance: true,
                status: true,
              },
            },
            productCategory: true,
            items: {
              select: {
                formatPaper: true,
                quantity: true,
                pricePosition: true,
                printOnClientItem: true,
                thermalCost: true,
                partnerPayout: true,
                partnerRateBasisPoints: true,
              },
            },
            tshirtItems: {
              select: {
                pricePosition: true,
                quantity: true,
                designCost: true,
                thermalCost: true,
                blankCost: true,
                clientItem: true,
              },
            },
            canvasItems: { select: { contractorCostPosition: true } },
            accruals: {
              where: { status: { not: 'REVERSED' } },
              select: { salaryAmount: true },
            },
          },
        }),
        this.prisma.adSpendDetail.findFirst({
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
        this.prisma.partnerSettings.findUnique({ where: { id: 'default' } }),
        this.prisma.metrikaSyncRun.findFirst({
          where: { status: 'SUCCESS', finishedAt: { not: null } },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true },
        }),
        this.prisma.metrikaOrderOutbox.groupBy({
          by: ['status'],
          where: { status: { in: ['pending', 'processing', 'failed'] } },
          _count: { _all: true },
        }),
        this.prisma.adSearchQueryDaily.groupBy({
          by: ['campaignId', 'adGroupId', 'query', 'criterion', 'matchType'],
          where: { date: dateWhere },
          _sum: { impressions: true, clicks: true, spend: true },
        }),
      ]);
    const s = costSettingsFrom(settings);

    const leads: LeadInput[] = orders.map((o) => {
      const base = {
        status: o.status,
        productCategory: o.productCategory,
        clientPaidAt: o.clientPaidAt,
      };
      return {
        ...base,
        totalOrder: o.totalOrder,
        // Прибыль нужна только оплаченным: у остальных её ещё нет.
        margin: isPaid(base) ? orderMargin(o, s) : null,
        hasYclid: !!o.yclid?.trim(),
        utmSource: o.utmSource,
        utmMedium: o.utmMedium,
        utmCampaign: o.utmCampaign,
        utmContent: o.utmContent,
        utmTerm: o.utmTerm,
      };
    });
    const result = computeAdPerformance(
      spend.map((r) => ({
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        adGroupId: r.adGroupId,
        adGroupName: r.adGroupName,
        adId: r.adId,
        criterion: r.criterion,
        spend: Number(r.spend),
        clicks: r.clicks,
      })),
      leads,
    );

    const spendDays = new Set(
      spend.map((r) => r.date.toISOString().slice(0, 10)),
    ).size;
    const spendLastDate = last ? last.date.toISOString().slice(0, 10) : null;
    const count = (st: string) =>
      outbox.find((r) => r.status === st)?._count._all ?? 0;
    const ad = leads.filter(isAdLead);
    const periodDays =
      (isoToUtcDate(period.to).getTime() -
        isoToUtcDate(period.from).getTime()) /
        86_400_000 +
      1;

    return {
      period: { from: period.from, to: period.to },
      spendDays,
      spendLastDate,
      ...result,
      searchQueries: queries.length
        ? computeSearchQueries(
            queries.map((q) => ({
              campaignId: q.campaignId,
              adGroupId: q.adGroupId,
              query: q.query,
              criterion: q.criterion,
              matchType: q.matchType,
              impressions: q._sum.impressions ?? 0,
              clicks: q._sum.clicks ?? 0,
              spend: Number(q._sum.spend ?? 0),
            })),
            result,
          )
        : null,
      quality: {
        spendLastDate,
        spendDays,
        periodDays,
        metrikaSyncedAt: sync?.finishedAt?.toISOString() ?? null,
        siteLeads: leads.length,
        adLeads: ad.length,
        leadsClientIdOnly: orders.filter(
          (o, i) => !isAdLead(leads[i]) && !!o.yandexClientId?.trim(),
        ).length,
        leadsNoIdentity: orders.filter(
          (o, i) => !isAdLead(leads[i]) && !o.yandexClientId?.trim(),
        ).length,
        adLeadsWithoutKeyword: ad.filter((l) => !normalizeKeyword(l.utmTerm))
          .length,
        adLeadsWithoutGroup:
          result.totals.leads - result.totals.adLeadsWithGroup,
        paidWithoutCogs: result.totals.paidWithoutCogs,
        outboxPending: count('pending') + count('processing'),
        outboxFailed: count('failed'),
      },
    };
  }
}
