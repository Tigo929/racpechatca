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
import { behaviorGoals, type BehaviorGoal } from './metrika-behavior-goals';
import { goalMetric } from './metrika-query-catalog';

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
 *
 * Этап 10: вторым запросом того же периода берутся посетители, достигшие
 * каждой поведенческой цели (`ym:s:goal<id>users`, ≤ 14 метрик + якорь) —
 * шаги воронки в уникальных посетителях периода (MetrikaPeriodGoalSnapshot).
 * Цели без достижений API в строке не отдаёт — тогда пишем 0 явно.
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
  /** Этап 10: сколько поведенческих целей получили снимок посетителей (null — цели не запрашивались). */
  goalUsers: number | null;
}

export type SnapshotsClient = Pick<
  YandexMetrikaClient,
  'getStats' | 'isConfigured' | 'getGoals'
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
        goalUsers: null,
      };
    }
    const counter = { requests: 0 };
    let goalUsers: number | null = null;
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
      goalUsers = await this.refreshGoalUsers(range, preset, counter);
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
        goalUsers,
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
        goalUsers,
      };
    }
  }

  /**
   * Посетители периода по поведенческим целям — один запрос на период.
   * Список целей берётся из Management API (кэшируется на время одного
   * обновления пресетов). Ошибка здесь не портит основной снимок:
   * она логируется, а посетители шагов остаются прежними.
   */
  private goalsCache: { at: number; goals: BehaviorGoal[] } | null = null;

  private async behaviorGoalList(): Promise<BehaviorGoal[]> {
    const now = this.now().getTime();
    if (this.goalsCache && now - this.goalsCache.at < 10 * 60_000)
      return this.goalsCache.goals;
    const goals = behaviorGoals(await this.client.getGoals());
    this.goalsCache = { at: now, goals };
    return goals;
  }

  private async refreshGoalUsers(
    range: DateRange,
    preset: PeriodPreset | null,
    counter: { requests: number },
  ): Promise<number | null> {
    try {
      const goals = await this.behaviorGoalList();
      if (goals.length === 0) return 0;
      const res = await this.fetcher.fetch(
        {
          dimensions: [],
          metrics: [
            'ym:s:visits',
            ...goals.map((g) => goalMetric(g.goalId, 'users')),
          ],
          sort: 'ym:s:visits',
          lang: 'ru',
        },
        range,
        counter,
      );
      const metrics = res.rows[0]?.metrics ?? [];
      const int = (v: number | null | undefined) =>
        Math.round(Number(v ?? 0)) || 0;
      const fetchedAt = this.now();
      for (const [i, g] of goals.entries()) {
        const data = {
          goalIdentifier: g.event,
          preset,
          users: int(metrics[1 + i]),
          fetchedAt,
          sampled: res.meta.sampled,
          sampleShare: res.meta.sampleShare,
        };
        await this.prisma.metrikaPeriodGoalSnapshot.upsert({
          where: {
            periodStart_periodEnd_goalId: {
              periodStart: isoToUtcDate(range.from),
              periodEnd: isoToUtcDate(range.to),
              goalId: g.goalId,
            },
          },
          create: {
            periodStart: isoToUtcDate(range.from),
            periodEnd: isoToUtcDate(range.to),
            goalId: g.goalId,
            ...data,
          },
          update: data,
        });
      }
      return goals.length;
    } catch (error) {
      this.logger.warn(
        `Метрика: снимок посетителей по целям ${range.from}..${range.to}${preset ? ` (${preset})` : ''} не обновлён — ${describe(error)}`,
      );
      return null;
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
