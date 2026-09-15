import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import type { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { customPeriod, periodBoundsUtc } from '../metrics/analytics-period';
import type { OrderWithLifecycle } from '../metrics/metrics-compute';
import { AnalyticsGrowthService, cohortsFor } from './analytics-growth.service';

/**
 * Сервис этапа 11 без базы: Prisma подменён хранилищем в памяти. Проверяем
 * реестр (валидация, фиксация первичной метрики), версии оценок, когорты с
 * датой наблюдения, хук расписания (снимки только для неустоявшихся окон,
 * переоценка только при новом полном дне) и отсутствие обращений к Метрике при чтении.
 */

type Row = Record<string, unknown> & { id: string };

function memoryPrisma(now: () => Date) {
  const changes: Row[] = [];
  const evaluations: Row[] = [];
  const snapshots: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'OR')
        return (v as Record<string, unknown>[]).some((w) => matches(row, w));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const cond = v as Record<string, unknown>;
        const val = row[k] as never;
        if ('in' in cond) return (cond.in as unknown[]).includes(val);
        if ('not' in cond) return val !== cond.not;
        if ('lt' in cond) return (val as Date) < (cond.lt as Date);
        if ('gt' in cond)
          return val !== null && (val as Date) > (cond.gt as Date);
        return true;
      }
      return row[k] === v;
    });
  const prisma = {
    analyticsChange: {
      findMany: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) =>
        Promise.resolve(changes.filter((r) => !where || matches(r, where))),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(changes.find((r) => r.id === where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `chg-${++seq}`,
          createdAt: now(),
          updatedAt: now(),
          primaryLockedAt: null,
          endedAt: null,
          deploymentRef: null,
          hypothesis: null,
          maturityDays: null,
          evaluationDays: null,
          audienceDefinition: null,
          ...data,
        };
        changes.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = changes.find((r) => r.id === where.id)!;
          Object.assign(row, data, { updatedAt: now() });
          return Promise.resolve(row);
        },
      ),
      groupBy: jest.fn(() => {
        const counts = new Map<string, number>();
        for (const c of changes)
          counts.set(
            c.status as string,
            (counts.get(c.status as string) ?? 0) + 1,
          );
        return Promise.resolve(
          [...counts].map(([status, n]) => ({ status, _count: { _all: n } })),
        );
      }),
    },
    analyticsChangeEvaluation: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          evaluations
            .filter((r) => matches(r, where))
            .sort((a, b) => (b.version as number) - (a.version as number)),
        ),
      ),
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          evaluations
            .filter((r) => matches(r, where))
            .sort((a, b) => (b.version as number) - (a.version as number))[0] ??
            null,
        ),
      ),
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { changeId_version: { changeId: string; version: number } };
        }) =>
          Promise.resolve(
            evaluations.find(
              (r) =>
                r.changeId === where.changeId_version.changeId &&
                r.version === where.changeId_version.version,
            ) ?? null,
          ),
      ),
      aggregate: jest.fn(({ where }: { where: { changeId: string } }) =>
        Promise.resolve({
          _max: {
            version:
              Math.max(
                0,
                ...evaluations
                  .filter((r) => r.changeId === where.changeId)
                  .map((r) => r.version as number),
              ) || null,
          },
        }),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ev-${++seq}`, ...data };
        evaluations.push(row);
        return Promise.resolve(row);
      }),
    },
    metrikaSyncRun: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 'run-7',
          finishedAt: new Date(now().getTime() - 600_000),
        }),
      ),
    },
    metrikaDailyTraffic: {
      aggregate: jest.fn(() =>
        Promise.resolve({
          _max: { date: new Date('2026-10-02T00:00:00.000Z') },
        }),
      ),
    },
    metrikaPeriodSnapshot: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            periodStart_periodEnd_metricScope: {
              periodStart: Date;
              periodEnd: Date;
            };
          };
        }) =>
          Promise.resolve(
            snapshots.find(
              (s) =>
                (s.periodStart as Date).getTime() ===
                  where.periodStart_periodEnd_metricScope.periodStart.getTime() &&
                (s.periodEnd as Date).getTime() ===
                  where.periodStart_periodEnd_metricScope.periodEnd.getTime(),
            ) ?? null,
          ),
      ),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return {
    prisma: prisma as unknown as PrismaService,
    changes,
    evaluations,
    snapshots,
  };
}

function order(
  leadAt: string | null,
  acceptedAt: string | null,
  paidAt: string | null,
  totalOrder = 1000,
): OrderWithLifecycle {
  return {
    order: { totalOrder } as never,
    lifecycle: {
      leadAt: leadAt ? new Date(leadAt) : null,
      acceptedAt: acceptedAt ? new Date(acceptedAt) : null,
      paidAt: paidAt ? new Date(paidAt) : null,
    } as never,
  };
}

const ORDERS: OrderWithLifecycle[] = [
  // заявка и принятие в окне «до» (17–23.09), оплата позже
  order(
    '2026-09-18T09:00:00Z',
    '2026-09-18T12:00:00Z',
    '2026-09-30T10:00:00Z',
    1500,
  ),
  order('2026-09-20T09:00:00Z', '2026-09-21T12:00:00Z', null, 2000),
  // окно «после» (25.09–01.10)
  order(
    '2026-09-26T09:00:00Z',
    '2026-09-26T12:00:00Z',
    '2026-09-27T10:00:00Z',
    2500,
  ),
  order('2026-09-27T09:00:00Z', null, null, 900),
  // оплата после даты наблюдения — не считается
  order(
    '2026-09-28T09:00:00Z',
    '2026-09-28T12:00:00Z',
    '2026-10-05T10:00:00Z',
    3000,
  ),
];

function fakeMetrics(): AnalyticsMetricsService {
  const q = { completeness: 'complete', notes: [] };
  const ov = (period: { from: string; to: string }) => ({
    period,
    traffic: {
      visits: 700,
      periodUsers: null,
      sumDailyUsers: 500,
      pageviews: 0,
      pageviewsSession: 0,
      pageviewsPage: 0,
      daysWithTraffic: 7,
      quality: q,
    },
    siteFunnel: {
      visits: 700,
      siteLeads: period.from < '2026-09-25' ? 20 : 26,
      matchedAccepted: 1,
      matchedPaid: 0,
      quality: q,
    },
    financials: { realized: null },
    dataQuality: { clientIdCoverageAccepted: 60, notes: [], freshness: null },
  });
  const slice = () => ({ rows: [], totals: {}, quality: q });
  return {
    getOverview: jest.fn((p: { from: string; to: string }) =>
      Promise.resolve(ov(p)),
    ),
    getDevices: jest.fn(() => Promise.resolve(slice())),
    getTrafficSources: jest.fn(() => Promise.resolve(slice())),
    getLandings: jest.fn(() => Promise.resolve(slice())),
    getUtm: jest.fn(() => Promise.resolve(slice())),
    lifecycles: jest.fn(() => Promise.resolve(ORDERS)),
  } as unknown as AnalyticsMetricsService;
}

function fakeBehavior(): BehaviorMetricsService {
  return {
    loadInput: jest.fn((period: { from: string; to: string }) =>
      Promise.resolve({
        period,
        visits: 700,
        goalTotals: new Map([['form_started', { reaches: 40, visits: 30 }]]),
        byDevice: [],
        byLanding: [],
        params: [],
        behaviorRows: 5,
      }),
    ),
  } as unknown as BehaviorMetricsService;
}

const NOW = new Date('2026-10-03T08:00:00Z');
const INPUT = {
  name: 'Новая форма заявки',
  changeType: 'SITE' as const,
  startedAt: '2026-09-24T12:00:00Z',
  surface: 'site:form',
  primaryMetric: 'siteLeadRate' as const,
  expectedDirection: 'INCREASE' as const,
  status: 'ACTIVE' as const,
  evaluationDays: 7,
};

describe('AnalyticsGrowthService', () => {
  it('реестр: создание, валидация, cutover-день; первичная метрика фиксируется первой оценкой', async () => {
    const { prisma } = memoryPrisma(() => NOW);
    const s = new AnalyticsGrowthService({
      prisma,
      metrics: fakeMetrics(),
      behavior: fakeBehavior(),
      now: () => NOW,
    });
    const c = await s.createChange(INPUT);
    expect(c).toMatchObject({
      status: 'ACTIVE',
      cutoverDay: '2026-09-24',
      cutoverDayIsFull: false,
      primaryLockedAt: null,
      latestEvaluation: null,
    });
    await expect(
      s.createChange({ ...INPUT, primaryMetric: 'nope' as never }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      s.createChange({ ...INPUT, evaluationDays: 10 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      s.createChange({
        ...INPUT,
        audienceDefinition: { dimension: 'phone' as never, values: ['x'] },
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      s.createChange({ ...INPUT, endedAt: '2026-09-20T00:00:00Z' }),
    ).rejects.toThrow(BadRequestException);
    // до оценки метрику менять можно
    await s.updateChange(c.id, { primaryMetric: 'siteLeads' });
    await s.updateChange(c.id, { primaryMetric: 'siteLeadRate' });
    await s.evaluate(c.id, 'manual');
    const locked = await s.getChange(c.id);
    expect(locked.primaryLockedAt).not.toBeNull();
    await expect(
      s.updateChange(c.id, { primaryMetric: 'siteLeads' }),
    ).rejects.toThrow(/зафиксирована/);
    await expect(
      s.updateChange(c.id, { expectedDirection: 'DECREASE' }),
    ).rejects.toThrow(/зафиксировано/);
    // остальные поля — можно
    expect(
      (await s.updateChange(c.id, { description: 'уточнение' })).description,
    ).toBe('уточнение');
    await expect(s.getChange('missing')).rejects.toThrow(NotFoundException);
  });

  it('оценка: окна из настроек, когорты до даты наблюдения, версии растут, прежняя не меняется', async () => {
    const { prisma, evaluations } = memoryPrisma(() => NOW);
    const metrics = fakeMetrics();
    const s = new AnalyticsGrowthService({
      prisma,
      metrics,
      behavior: fakeBehavior(),
      now: () => NOW,
    });
    const c = await s.createChange({
      ...INPUT,
      secondaryMetrics: ['leadToPaidRate', 'paidAov'],
    });
    const e1 = await s.evaluate(c.id, 'manual');
    expect(e1.windows).toMatchObject({
      before: { from: '2026-09-17', to: '2026-09-23' },
      after: { from: '2026-09-25', to: '2026-10-01' },
      observationCutoff: '2026-10-02',
    });
    expect(e1.version).toBe(1);
    expect(e1.dataQuality.lastSyncRunId).toBe('run-7');
    // когорты: «до» 2 заявки (1 оплачена 30.09 — до даты наблюдения), «после» 3 заявки, оплачена 1 (оплата 05.10 не считается)
    const ltp = e1.secondary.find((m) => m.metric === 'leadToPaidRate')!;
    expect(ltp.before).toMatchObject({ numerator: 1, denominator: 2 });
    expect(ltp.after).toMatchObject({ numerator: 1, denominator: 3 });
    expect(ltp.verdict).toBe('IMMATURE');
    const aov = e1.secondary.find((m) => m.metric === 'paidAov')!;
    expect(aov.before).toMatchObject({ numerator: 1500, denominator: 1 });
    expect('values' in aov.before).toBe(false);
    // при чтении к API Метрики никто не обращается; lifecycles грузятся один раз на оценку
    expect((metrics.lifecycles as jest.Mock).mock.calls.length).toBe(1);
    const e2 = await s.evaluate(c.id, 'scheduler');
    expect(e2.version).toBe(2);
    expect(evaluations).toHaveLength(2);
    expect((await s.listEvaluations(c.id)).map((x) => x.version)).toEqual([
      2, 1,
    ]);
    expect((await s.getEvaluation(c.id, 1)).version).toBe(1);
    expect((await s.getEvaluation(c.id)).version).toBe(2);
    expect((await s.getChange(c.id)).latestEvaluation?.version).toBe(2);
    // отменённое изменение не оценивается; без полного дня после cutover — понятная ошибка
    await s.updateChange(c.id, { status: 'CANCELLED' });
    await expect(s.evaluate(c.id, 'manual')).rejects.toThrow(/Отменённое/);
    const fresh = await s.createChange({
      ...INPUT,
      startedAt: '2026-10-02T12:00:00Z',
    });
    await expect(s.evaluate(fresh.id, 'manual')).rejects.toThrow(
      /NO_COMPLETE_DAYS_AFTER/,
    );
  });

  it('cohortsFor: границы окна по Москве, исходы только до конца дня наблюдения', () => {
    const period = customPeriod('2026-09-25', '2026-10-01');
    const cutoffEnd = periodBoundsUtc({
      from: '2026-10-02',
      to: '2026-10-02',
    }).endExclusive;
    const c = cohortsFor(ORDERS, period, cutoffEnd);
    expect(c).toMatchObject({
      leads: 3,
      leadsAccepted: 2,
      leadsPaid: 1,
      accepted: 2,
      acceptedPaid: 1,
    });
    expect(c.acceptedContractValues).toEqual([2500, 3000]);
    expect(c.acceptedPaidValues).toEqual([2500]);
    // заявка 28.09 20:00 UTC = 23:00 MSK 28.09 — внутри окна; та же метка в 21:30 UTC — уже 29.09 MSK, тоже внутри
    const edge = cohortsFor(
      [order('2026-10-01T21:30:00Z', null, null)],
      period,
      cutoffEnd,
    );
    expect(edge.leads).toBe(0); // 02.10 00:30 MSK — за окном
  });

  it('afterSync: снимки только для неустоявшихся окон, переоценка только при новом полном дне, ошибки не выбрасываются', async () => {
    const { prisma, snapshots } = memoryPrisma(() => NOW);
    const refresh = jest.fn((range: { from: string; to: string }) => {
      snapshots.push({
        id: `snap-${range.from}`,
        periodStart: new Date(`${range.from}T00:00:00.000Z`),
        periodEnd: new Date(`${range.to}T00:00:00.000Z`),
      });
      return Promise.resolve({ requests: 2 });
    });
    const s = new AnalyticsGrowthService({
      prisma,
      metrics: fakeMetrics(),
      behavior: fakeBehavior(),
      snapshots: { refreshRange: refresh as never },
      now: () => NOW,
    });
    const active = await s.createChange(INPUT);
    await s.createChange({ ...INPUT, name: 'черновик', status: 'DRAFT' });
    const first = await s.afterSync();
    // оба окна без снимков → 2 снимка × 2 запроса; ACTIVE оценено один раз, DRAFT пропущен
    expect(first).toEqual({ evaluated: 1, snapshotRequests: 4, errors: 0 });
    expect(refresh).toHaveBeenCalledTimes(2);
    const second = await s.afterSync();
    // окна устоялись и снимки есть → без запросов; новый полный день не появился → без переоценки
    expect(second).toEqual({ evaluated: 0, snapshotRequests: 0, errors: 0 });
    expect(await s.listEvaluations(active.id)).toHaveLength(1);
  });

  it('status: возможности и настройки без обращения к Метрике; A/B — NO_VARIANT_ASSIGNMENT', async () => {
    const { prisma } = memoryPrisma(() => NOW);
    const s = new AnalyticsGrowthService({
      prisma,
      metrics: fakeMetrics(),
      behavior: fakeBehavior(),
      now: () => NOW,
    });
    await s.createChange(INPUT);
    const st = await s.status(true);
    expect(st).toMatchObject({
      enabled: true,
      abCapability: 'NO_VARIANT_ASSIGNMENT',
      evidenceTypes: ['OBSERVATIONAL_BEFORE_AFTER'],
      counts: { ACTIVE: 1, DRAFT: 0, COMPLETED: 0, CANCELLED: 0 },
    });
    expect(st.defaults).toMatchObject({
      alpha: 0.05,
      power: 0.8,
      targetRelativeEffect: 0.2,
      evaluationDaysOptions: [7, 14, 21, 28],
    });
    expect(st.metrics.map((m) => m.key)).toContain('siteLeadRate');
    expect(st.maturityPolicy.leadToAccepted.sufficient).toBe(false);
  });
});
