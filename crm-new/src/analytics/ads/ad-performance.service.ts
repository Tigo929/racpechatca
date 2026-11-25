import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { isoToUtcDate } from '../../metrika/analytics/metrika-dates';
import {
  periodBoundsUtc,
  type AnalyticsPeriod,
} from '../metrics/analytics-period';
import { computeAdPerformance, type AdPerformance } from './ad-performance';

export interface AdPerformanceResponse extends AdPerformance {
  period: { from: string; to: string };
  /** Дней периода, за которые расход по объявлениям загружен. */
  spendDays: number;
  /** Последний загруженный день расхода (YYYY-MM-DD) или null. */
  spendLastDate: string | null;
}

/**
 * Данные экрана «Реклама»: расход из AdSpendDetail, заявки — заказы
 * происхождения WEBSITE, созданные в периоде (по московскому дню).
 * Формулы — в computeAdPerformance; здесь только чтение базы.
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
    const [spend, orders, last] = await Promise.all([
      this.prisma.adSpendDetail.findMany({ where: { date: dateWhere } }),
      this.prisma.orderPhoto.findMany({
        where: {
          sourceOrder: 'WEBSITE',
          createdAt: { gte: start, lt: endExclusive },
        },
        select: {
          status: true,
          clientPaidAt: true,
          totalOrder: true,
          yclid: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
        },
      }),
      this.prisma.adSpendDetail.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);
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
      orders.map((o) => ({
        status: o.status,
        clientPaidAt: o.clientPaidAt,
        totalOrder: o.totalOrder,
        hasYclid: !!o.yclid?.trim(),
        utmSource: o.utmSource,
        utmMedium: o.utmMedium,
        utmCampaign: o.utmCampaign,
        utmContent: o.utmContent,
        utmTerm: o.utmTerm,
      })),
    );
    return {
      period: { from: period.from, to: period.to },
      spendDays: new Set(spend.map((r) => r.date.toISOString().slice(0, 10)))
        .size,
      spendLastDate: last ? last.date.toISOString().slice(0, 10) : null,
      ...result,
    };
  }
}
