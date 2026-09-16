import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import type { AnalyticsGrowthService } from '../growth/analytics-growth.service';
import type { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import {
  AnalyticsInsightsService,
  compareForFeed,
} from './analytics-insights.service';
import type { InsightRecord } from './insights-contract';
import type { InsightContext } from './insights-engine';
import {
  fakeEvaluation,
  FRESH,
  makeContext,
  NOW,
} from './insights-fixture.spec-helper.spec';

/**
 * Жизненный цикл сигналов без базы: Prisma подменён хранилищем в памяти, контекст
 * — фикстурой. Проверяем: создание / версия при изменении / без версии при том же
 * содержимом / RESOLVED, когда условие исчезло / переоткрытие в окне /
 * новый эпизод после кулдауна / лимит активных / acknowledge и resolve /
 * порядок ленты / выбор daily vs hourly в хуке / изоляция ошибок.
 */

type Row = Record<string, unknown> & { id: string };

function memoryPrisma(now: () => Date) {
  const insights: Row[] = [];
  const versions: Row[] = [];
  const runs: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const cond = v as Record<string, unknown>;
        const val = row[k] as never;
        if ('in' in cond) return (cond.in as unknown[]).includes(val);
        if ('not' in cond) return val !== cond.not;
        return true;
      }
      return row[k] === v;
    });
  const model = (
    rows: Row[],
    prefix: string,
    defaults: () => Record<string, unknown>,
  ) => ({
    findMany: jest.fn(
      ({
        where,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, string> | Record<string, string>[];
      } = {}) => {
        let out = rows.filter((r) => !where || matches(r, where));
        const ob = Array.isArray(orderBy) ? orderBy[0] : orderBy;
        if (ob) {
          const [k, dir] = Object.entries(ob)[0];
          out = [...out].sort(
            (a, b) =>
              ((a[k] as number) > (b[k] as number) ? 1 : -1) *
              (dir === 'desc' ? -1 : 1),
          );
        }
        return Promise.resolve(out);
      },
    ),
    findFirst: jest.fn(
      ({
        where,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, string>;
      } = {}) => {
        let out = rows.filter((r) => !where || matches(r, where));
        if (orderBy) {
          const [k, dir] = Object.entries(orderBy)[0];
          out = [...out].sort(
            (a, b) =>
              ((a[k] as number) > (b[k] as number) ? 1 : -1) *
              (dir === 'desc' ? -1 : 1),
          );
        }
        return Promise.resolve(out[0] ?? null);
      },
    ),
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    ),
    findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id)!),
    ),
    count: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) =>
      Promise.resolve(rows.filter((r) => !where || matches(r, where)).length),
    ),
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `${prefix}-${++seq}`,
        createdAt: now(),
        updatedAt: now(),
        ...defaults(),
        ...data,
      };
      rows.push(row);
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
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data, { updatedAt: now() });
        return Promise.resolve(row);
      },
    ),
    groupBy: jest.fn(
      ({ by, where }: { by: string[]; where?: Record<string, unknown> }) => {
        const counts = new Map<string, number>();
        for (const r of rows.filter((x) => !where || matches(x, where)))
          counts.set(
            r[by[0]] as string,
            (counts.get(r[by[0]] as string) ?? 0) + 1,
          );
        return Promise.resolve(
          [...counts].map(([k, n]) => ({ [by[0]]: k, _count: { _all: n } })),
        );
      },
    ),
  });
  const prisma = {
    analyticsInsight: model(insights, 'ins', () => ({
      resolvedAt: null,
      resolvedReason: null,
      acknowledgedAt: null,
      link: null,
      episode: 1,
      latestVersion: 1,
    })),
    analyticsInsightVersion: model(versions, 'ver', () => ({})),
    analyticsInsightRun: model(runs, 'run', () => ({
      finishedAt: null,
      observationCutoff: null,
      syncRunId: null,
      detectors: 0,
      detected: 0,
      created: 0,
      versioned: 0,
      unchanged: 0,
      resolved: 0,
      reopened: 0,
      suppressed: [],
      errors: [],
      durationMs: null,
      queryCount: null,
      seenEvaluations: {},
    })),
    analyticsChange: { findMany: jest.fn(() => Promise.resolve([])) },
    metrikaSyncRun: {
      findFirst: jest.fn(() =>
        Promise.resolve({ id: 'sync-1', finishedAt: NOW }),
      ),
    },
    $queryRaw: jest.fn(() => Promise.resolve([{ locked: true }])),
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  return {
    prisma: prisma as unknown as PrismaService,
    insights,
    versions,
    runs,
  };
}

function service(
  mem: ReturnType<typeof memoryPrisma>,
  ctxFactory: () => InsightContext | null,
  clock: { now: Date },
) {
  const growth = {
    lastDataDay: jest.fn(() => Promise.resolve('2026-10-02')),
  } as unknown as AnalyticsGrowthService;
  const s = new AnalyticsInsightsService({
    prisma: mem.prisma,
    metrics: {} as AnalyticsMetricsService,
    behavior: {} as BehaviorMetricsService,
    growth,
    now: () => clock.now,
  });
  jest
    .spyOn(s, 'buildContext')
    .mockImplementation(() => Promise.resolve(ctxFactory()));
  return s;
}

const DROP = {
  before: { visits: 500, siteLeads: 40, formStarts: 80, formErrors: 2 },
  after: { visits: 500, siteLeads: 5, formStarts: 80, formErrors: 20 },
};
const QUIET = { visits: 300, siteLeads: 12, formStarts: 40, formErrors: 2 };

describe('AnalyticsInsightsService — жизненный цикл', () => {
  it('создание → повтор без изменений не даёт версии → новые данные дают версию → условие исчезло → RESOLVED', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    let ctx = makeContext(DROP.before, DROP.after, { now: clock.now });
    const s = service(mem, () => ctx, clock);

    const r1 = await s.run('daily');
    expect(r1.status).toBe('SUCCESS');
    expect(r1.created).toBeGreaterThanOrEqual(1);
    const lead = mem.insights.find((i) => i.detectorId === 'site.leadRate')!;
    expect(lead.status).toBe('OPEN');
    expect(lead.latestVersion).toBe(1);
    const versionsBefore = mem.versions.length;

    // тот же контекст через час — версий не прибавилось, lastDetectedAt обновился
    clock.now = new Date(NOW.getTime() + 3600e3);
    ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const r2 = await s.run('daily');
    expect(r2.created).toBe(0);
    expect(r2.versioned).toBe(0);
    expect(r2.unchanged).toBeGreaterThanOrEqual(1);
    expect(mem.versions.length).toBe(versionsBefore);
    expect(lead.lastDetectedAt).toEqual(clock.now);

    // данные изменились — новая версия той же карточки
    ctx = makeContext(
      DROP.before,
      { ...DROP.after, siteLeads: 6 },
      { now: NOW },
    );
    const r3 = await s.run('daily');
    expect(r3.versioned).toBeGreaterThanOrEqual(1);
    expect(lead.latestVersion).toBe(2);
    expect(
      mem.versions.filter((v) => v.insightId === lead.id).map((v) => v.version),
    ).toEqual([1, 2]);
    // старая версия неизменна
    expect(
      (
        mem.versions.find((v) => v.insightId === lead.id && v.version === 1)!
          .payload as { fact: { current: number } }
      ).fact.current,
    ).toBeCloseTo(1, 5);

    // сигнал пропал — RESOLVED
    ctx = makeContext(QUIET, QUIET, { now: NOW });
    const r4 = await s.run('daily');
    expect(r4.resolved).toBeGreaterThanOrEqual(1);
    expect(lead.status).toBe('RESOLVED');
    expect(lead.resolvedReason).toMatch(/больше не выполняется/);
  });

  it('переоткрытие в окне 7 дней — тот же эпизод; после кулдауна — новый эпизод, старый SUPERSEDED', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    let ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const s = service(mem, () => ctx, clock);
    await s.run('daily');
    const lead = mem.insights.find((i) => i.detectorId === 'site.leadRate')!;
    ctx = makeContext(QUIET, QUIET, { now: NOW });
    await s.run('daily');
    expect(lead.status).toBe('RESOLVED');

    clock.now = new Date(NOW.getTime() + 3 * 86400e3);
    ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const r = await s.run('daily');
    expect(r.reopened).toBeGreaterThanOrEqual(1);
    expect(lead.status).toBe('OPEN');
    expect(lead.episode).toBe(1);
    expect(lead.latestVersion).toBe(2);

    ctx = makeContext(QUIET, QUIET, { now: NOW });
    await s.run('daily');
    clock.now = new Date(NOW.getTime() + 30 * 86400e3);
    ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const r2 = await s.run('daily');
    expect(r2.created).toBeGreaterThanOrEqual(1);
    expect(lead.status).toBe('SUPERSEDED');
    const ep2 = mem.insights.find(
      (i) => i.detectorId === 'site.leadRate' && i.episode === 2,
    )!;
    expect(ep2.fingerprint).toBe(`${lead.baseFingerprint as string}#2`);
    expect(ep2.status).toBe('OPEN');
  });

  it('кулдаун: сигнал вернулся через 8 дней после закрытия — COOLDOWN, карточки нет', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    let ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const s = service(mem, () => ctx, clock);
    await s.run('daily');
    ctx = makeContext(QUIET, QUIET, { now: NOW });
    await s.run('daily');
    clock.now = new Date(NOW.getTime() + 8 * 86400e3);
    ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const r = await s.run('daily');
    expect(
      r.suppressed.some(
        (x) => x.reason === 'COOLDOWN' && x.detectorId === 'site.leadRate',
      ),
    ).toBe(true);
    expect(
      mem.insights.filter((i) => i.detectorId === 'site.leadRate'),
    ).toHaveLength(1);
  });

  it('acknowledge и ручной resolve с причиной; повторные действия — 400', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    const ctx = makeContext(DROP.before, DROP.after, { now: NOW });
    const s = service(mem, () => ctx, clock);
    await s.run('daily');
    const lead = mem.insights.find((i) => i.detectorId === 'site.leadRate')!;
    const ack = await s.acknowledge(lead.id);
    expect(ack.status).toBe('ACKNOWLEDGED');
    expect(ack.acknowledgedAt).toBe(clock.now.toISOString());
    await expect(s.acknowledge(lead.id)).rejects.toThrow(BadRequestException);
    const res = await s.resolve(lead.id, 'проверили форму, ошибок нет');
    expect(res.status).toBe('RESOLVED');
    expect(res.resolvedReason).toBe('вручную: проверили форму, ошибок нет');
    await expect(s.resolve(lead.id, 'ещё раз')).rejects.toThrow(
      BadRequestException,
    );
    // лента по умолчанию — только активные
    const feed = await s.feed();
    expect(feed.items.find((i) => i.id === lead.id)).toBeUndefined();
    const all = await s.feed({ status: 'all' });
    expect(all.items.find((i) => i.id === lead.id)?.status).toBe('RESOLVED');
  });

  it('оценки этапа 11: новая версия поднимается один раз (seenEvaluations), карточка не закрывается пока изменение в реестре', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    const change = {
      id: 'chg-1',
      name: 'Деплой 12.09',
      status: 'ACTIVE',
      surface: 'site:forms',
      startedAt: '2026-09-12T10:19:00Z',
      endedAt: null,
      latest: fakeEvaluation({ version: 9 }),
      seenVersion: null as number | null,
    };
    let ctx = makeContext(QUIET, QUIET, { now: NOW, changes: [change] });
    const s = service(mem, () => ctx, clock);
    const r1 = await s.run('daily');
    expect(r1.created).toBeGreaterThanOrEqual(1);
    const card = mem.insights.find(
      (i) => i.detectorId === 'change.evaluation',
    )!;
    expect(card.entityKey).toBe('chg-1');
    const lastRun = mem.runs[mem.runs.length - 1];
    expect(lastRun.seenEvaluations).toEqual({ 'chg-1': 9 });
    // следующий запуск видит seen=9 → DUPLICATE, карточка остаётся OPEN (не RESOLVED)
    ctx = makeContext(QUIET, QUIET, {
      now: NOW,
      changes: [{ ...change, seenVersion: 9 }],
    });
    const r2 = await s.run('hourly');
    expect(r2.suppressed.some((x) => x.reason === 'DUPLICATE')).toBe(true);
    expect(card.status).toBe('OPEN');
    // версия 10 — новая версия карточки
    ctx = makeContext(QUIET, QUIET, {
      now: NOW,
      changes: [
        {
          ...change,
          seenVersion: 9,
          latest: fakeEvaluation({
            version: 10,
            verdict: 'IMMATURE',
            maturity: 'IMMATURE',
          }),
        },
      ],
    });
    const r3 = await s.run('hourly');
    expect(r3.versioned).toBe(1);
    expect(card.latestVersion).toBe(2);
  });

  it('лимит активных карточек на детектор — лишние в COOLDOWN', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    const sources = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        source: `src${i}`,
        visits: 300,
        leads: 30,
      }));
    const ctx = makeContext(
      { visits: 1500, siteLeads: 150, sources: sources(5) },
      {
        visits: 1500,
        siteLeads: 15,
        sources: sources(5).map((x) => ({ ...x, leads: 3 })),
      },
      { now: NOW },
    );
    const s = service(mem, () => ctx, clock);
    const r = await s.run('daily');
    const active = mem.insights.filter(
      (i) => i.detectorId === 'source.performance' && i.status === 'OPEN',
    );
    expect(active).toHaveLength(3);
    expect(
      r.suppressed.filter(
        (x) => x.detectorId === 'source.performance' && x.reason === 'COOLDOWN',
      ),
    ).toHaveLength(2);
  });

  it('ошибка контекста и занятый lock не ломают процесс — запуск записан как FAILED / LOCKED', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    const s = service(
      mem,
      () => {
        throw new Error('база недоступна');
      },
      clock,
    );
    const r = await s.run('daily');
    expect(r.status).toBe('FAILED');
    expect(r.errors[0]).toMatch(/база недоступна/);
    (
      mem.prisma as unknown as { $queryRaw: jest.Mock }
    ).$queryRaw.mockImplementationOnce(() =>
      Promise.resolve([{ locked: false }]),
    );
    const s2 = service(
      mem,
      () => makeContext(QUIET, QUIET, { now: NOW }),
      clock,
    );
    const r2 = await s2.run('daily');
    expect(r2.status).toBe('LOCKED');
    expect(mem.insights).toHaveLength(0);
  });

  it('хук после тика: без успешного дневного запуска — daily; при том же cutoff — hourly', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    const s = service(
      mem,
      () => makeContext(QUIET, QUIET, { now: NOW }),
      clock,
    );
    const first = await s.afterSync();
    expect(first.kind).toBe('daily');
    expect(first.status).toBe('SUCCESS');
    const second = await s.afterSync();
    expect(second.kind).toBe('hourly');
    expect(mem.runs.map((r) => r.kind)).toEqual(['daily', 'hourly']);
  });

  it('нет двух полных окон данных — SKIPPED без записей', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    const s = service(mem, () => null, clock);
    const r = await s.run('daily');
    expect(r.status).toBe('SKIPPED');
    expect(mem.insights).toHaveLength(0);
  });
});

describe('порядок ленты', () => {
  const rec = (over: Partial<InsightRecord>): InsightRecord =>
    ({
      id: 'x',
      severity: 'INFO',
      scope: 'site',
      lastDetectedAt: '2026-10-01T00:00:00Z',
      ...over,
    }) as InsightRecord;
  it('CRITICAL данных → CRITICAL деловые → ATTENTION → INFO; внутри уровня — свежее выше', () => {
    const items = [
      rec({
        id: 'a',
        severity: 'INFO',
        lastDetectedAt: '2026-10-03T00:00:00Z',
      }),
      rec({ id: 'b', severity: 'CRITICAL', scope: 'site' }),
      rec({ id: 'c', severity: 'ATTENTION' }),
      rec({ id: 'd', severity: 'CRITICAL', scope: 'data' }),
      rec({
        id: 'e',
        severity: 'INFO',
        lastDetectedAt: '2026-10-02T00:00:00Z',
      }),
    ].sort(compareForFeed);
    expect(items.map((i) => i.id)).toEqual(['d', 'b', 'c', 'a', 'e']);
    expect(FRESH.status).toBe('FRESH');
  });
});
