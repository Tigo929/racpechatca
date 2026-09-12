import { Logger } from '@nestjs/common';
import type { PrismaService } from 'src/prisma/prisma.service';
import {
  PERIOD_PRESETS,
  periodFromPreset,
  type PeriodPreset,
} from '../../analytics/metrics/analytics-period';
import { METRIKA_SCOPE_COUNTER } from '../../analytics/metrics/analytics-constants';
import type { YandexMetrikaClient } from '../metrika-api.client';
import { describe } from './metrika-analytics-sync.service';
import { isoToUtcDate, utcDateToIso, type DateRange } from './metrika-dates';
import { MetrikaReportFetcher } from './metrika-report-fetcher';

/**
 * Снимки метрик за целый период (этап 08, разделы 8–9).
 *
 * Уникальные посетители периода — не сумма дневных: один человек за неделю
 * даёт семь дневных уникальных и одного недельного. Метрика считает
 * периодные уникальные сама, отдельным запросом без измерений; результат
 * кладётся в MetrikaPeriodSnapshot, и дашборд читает таблицу, а не API.
 *
 * Обновляются восемь пресетов (сегодня, вчера, 7 и 30 дней с предыдущими,
 * текущий и прошлый месяц) — каждый часовой тик расписания и по ручной
 * команде. Произвольный период — только ручной командой: снимок для него
 * создаётся контролируемо, а не из запроса интерфейса.
 */

export interface SnapshotOutcome {
  preset: PeriodPreset | null;
  range: DateRange;
  status: 'SUCCESS' | 'FAILED';
  users: number | null;
  visits: number | null;
  pageviews: number | null;
  sampled: boolean | null;
  requests: number;
  error: string | null;
}

export type SnapshotsClient = Pick<
  YandexMetrikaClient,
  'getStats' | 'isConfigured'
>;

export class MetrikaPeriodSnapshotService {
  private readonly logger = new Logger(MetrikaPeriodSnapshotService.name);
  private readonly fetcher: MetrikaReportFetcher;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SnapshotsClient,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.fetcher = new MetrikaReportFetcher(client as YandexMetrikaClient);
  }

  /** Все пресеты, по одному запросу на каждый; ошибки не прерывают остальные. */
  async refreshPresets(): Promise<SnapshotOutcome[]> {
    const now = this.now();
    const out: SnapshotOutcome[] = [];
    for (const preset of PERIOD_PRESETS) {
      out.push(await this.refreshRange(periodFromPreset(preset, now), preset));
    }
    const failed = out.filter((o) => o.status === 'FAILED').length;
    this.logger.log(
      `Метрика: снимки периодов обновлены — ${out.length - failed}/${out.length}, запросов ${out.reduce((s, o) => s + o.requests, 0)}`,
    );
    return out;
  }

  async refreshRange(
    range: DateRange,
    preset: PeriodPreset | null = null,
  ): Promise<SnapshotOutcome> {
    if (!this.client.isConfigured()) {
      return {
        preset,
        range,
        status: 'FAILED',
        users: null,
        visits: null,
        pageviews: null,
        sampled: null,
        requests: 0,
        error: 'клиент Метрики не настроен',
      };
    }
    const counter = { requests: 0 };
    try {
      const res = await this.fetcher.fetch(
        {
          dimensions: [],
          metrics: ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews'],
          sort: 'ym:s:visits',
          lang: 'ru',
        },
        range,
        counter,
      );
      const metrics = res.rows[0]?.metrics ?? [0, 0, 0];
      const int = (v: number | null | undefined) =>
        Math.round(Number(v ?? 0)) || 0;
      const visits = int(metrics[0]);
      const users = int(metrics[1]);
      const pageviews = int(metrics[2]);
      const data = {
        users,
        visits,
        pageviews,
        fetchedAt: this.now(),
        sampled: res.meta.sampled,
        sampleShare: res.meta.sampleShare,
        requestCount: res.meta.requests,
        preset,
      };
      await this.prisma.metrikaPeriodSnapshot.upsert({
        where: {
          periodStart_periodEnd_metricScope: {
            periodStart: isoToUtcDate(range.from),
            periodEnd: isoToUtcDate(range.to),
            metricScope: METRIKA_SCOPE_COUNTER,
          },
        },
        create: {
          periodStart: isoToUtcDate(range.from),
          periodEnd: isoToUtcDate(range.to),
          metricScope: METRIKA_SCOPE_COUNTER,
          ...data,
        },
        update: data,
      });
      return {
        preset,
        range,
        status: 'SUCCESS',
        users,
        visits,
        pageviews,
        sampled: res.meta.sampled,
        requests: counter.requests,
        error: null,
      };
    } catch (error) {
      const message = describe(error);
      this.logger.warn(
        `Метрика: снимок ${range.from}..${range.to}${preset ? ` (${preset})` : ''} не обновлён — ${message}`,
      );
      return {
        preset,
        range,
        status: 'FAILED',
        users: null,
        visits: null,
        pageviews: null,
        sampled: null,
        requests: counter.requests,
        error: message,
      };
    }
  }

  /** Снимки, что есть в базе, — для диагностики. */
  async list(): Promise<
    {
      range: DateRange;
      preset: string | null;
      users: number;
      visits: number;
      pageviews: number;
      fetchedAt: Date;
      sampled: boolean;
    }[]
  > {
    const rows = await this.prisma.metrikaPeriodSnapshot.findMany({
      orderBy: [{ periodStart: 'desc' }, { periodEnd: 'desc' }],
    });
    return rows.map((r) => ({
      range: {
        from: utcDateToIso(r.periodStart),
        to: utcDateToIso(r.periodEnd),
      },
      preset: r.preset,
      users: r.users,
      visits: r.visits,
      pageviews: r.pageviews,
      fetchedAt: r.fetchedAt,
      sampled: r.sampled,
    }));
  }
}
