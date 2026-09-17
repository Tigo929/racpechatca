import type {
  BehaviorIssues,
  Funnel,
  FunnelStep,
} from '../behavior/behavior-contract';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import type { AnalyticsGrowthService } from '../growth/analytics-growth.service';
import type { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { AnalyticsInsightsService } from './analytics-insights.service';
import {
  DETECTORS,
  eventNotMeasuredDetector,
  payloadHash,
  runDetectors,
  type InsightContext,
} from './insights-engine';
import { violatesLanguagePolicy } from './insights-language';
import {
  EVENT_GAP_MIN_FUNNEL_VISITS,
  INSIGHT_THRESHOLDS,
} from './insights-rules';
import { makeContext, NOW } from './insights-fixture.spec-helper.spec';

/**
 * FIX_01 — EVENT_NOT_MEASURED: один агрегированный сигнал качества измерения на воронку, только
 * когда пропуск реально ограничивает анализ отвала; not_measured никогда не 0; шаги, которых нет на
 * сайте, карточки не дают; версии не плодятся; после появления измерения — RESOLVED; язык без причинности.
 */

const period = {
  from: '2026-09-26',
  to: '2026-10-02',
  kind: 'days' as const,
  preset: null,
};

function step(
  key: string,
  label: string,
  over: Partial<FunnelStep> = {},
): FunnelStep {
  return {
    key,
    label,
    event: null,
    basis: 'goal',
    availability: 'measured',
    availableFrom: null,
    measuredFrom: '2026-09-26',
    transition: null,
    events: 10,
    visits: 10,
    users: null,
    stepConversion: null,
    cumulativeConversion: null,
    dropoff: null,
    dropoffRate: null,
    note: null,
    ...over,
  };
}
const gap = (key: string, label: string, note: string): FunnelStep =>
  step(key, label, {
    availability: 'not_measured',
    events: null,
    visits: null,
    users: null,
    note,
  });

function funnel(
  key: Funnel['key'],
  title: string,
  steps: FunnelStep[],
): Funnel {
  return {
    key,
    title,
    description: '',
    steps,
    sample: { visits: steps[0].visits ?? 0, status: 'OK' },
    comparison: null,
    quality: { completeness: 'complete', notes: [] },
  };
}

const issues: BehaviorIssues = {
  period,
  previousPeriod: { ...period, from: '2026-09-19', to: '2026-09-25' },
  issues: [],
  skipped: [],
  thresholds: {},
  quality: { completeness: 'complete', notes: [] },
};

/** Футболки как на бою: два измеряемых пропуска внутри воронки. */
const tshirt = (entryVisits = 60) =>
  funnel('tshirt', 'Футболки', [
    step('view_custom_tshirt', 'Открыли конструктор', {
      visits: entryVisits,
      events: entryVisits,
    }),
    gap(
      'choose_type_color',
      'Выбрали крой / цвет',
      'События choose_shirt_type и choose_color отправляются, но целей в счётчике нет (gap G2).',
    ),
    step('choose_size', 'Выбрали размер', { visits: 30 }),
    step('add_tshirt_lead', 'Дошли до формы заявки', { visits: 12 }),
    gap(
      'submit_tshirt_order',
      'Отправили форму',
      'Событие submit_tshirt_order отправляется сайтом, но цели в счётчике нет (BEHAVIOR_EVENT_CONTRACT § 2.2, gap G2).',
    ),
    step('lead_submitted_tshirt', 'Заявка на футболку принята', { visits: 4 }),
  ]);
/** Холсты как на бою: единственный пропуск — шага на сайте не существует. */
const canvas = funnel('canvas', 'Холсты', [
  step('canvas_interaction', 'Выбирали формат / размер холста', {
    visits: 80,
    basis: 'param',
  }),
  gap(
    'canvas_upload',
    'Загрузили фото',
    'На сайте нет загрузки фото для холста: фото присылают в переписке (§ 2.3). Шаг не существует, а не «0».',
  ),
  step('lead_submitted_canvas', 'Заявка на холст принята', { visits: 3 }),
]);
/** Фото как на бою: не измерен входной шаг. */
const photo = (entryVisits = 50) =>
  funnel('photo', 'Фотопечать', [
    gap(
      'catalog',
      'Просмотр каталога / товара',
      'События просмотра каталога фото нет; есть только e-commerce «detail», который целью не является (§ 2.4).',
    ),
    step('form_started_photo', 'Начали форму фотопечати', {
      visits: entryVisits,
      basis: 'param',
    }),
    step('lead_submitted_photo', 'Заявка на фото принята', { visits: 5 }),
  ]);

const QUIET = { visits: 300, siteLeads: 12, formStarts: 40, formErrors: 2 };
const ctxWith = (
  funnels: Funnel[],
  over: Parameters<typeof makeContext>[2] = {},
): InsightContext =>
  makeContext(QUIET, QUIET, { behavior: { issues, funnels }, ...over });

describe('FIX_01 — EVENT_NOT_MEASURED', () => {
  it('1: анализ воронки с активностью + не измеряемый шаг → ОДНА агрегированная карточка DATA_QUALITY INFO', () => {
    const r = eventNotMeasuredDetector.evaluate(ctxWith([tshirt()]));
    expect(r.detected).toHaveLength(1);
    const p = r.detected[0].payload;
    expect(p.category).toBe('DATA_QUALITY');
    expect(p.severity).toBe('INFO');
    expect(p.scope).toBe('data');
    expect(p.entityKey).toBe('tshirt');
    expect(p.title).toMatch(
      /Футболки.*2 шага не измеряются.*анализ отвала ограничен/,
    );
    // FACT: какой анализ, какие шаги, not_measured ≠ 0, какие выводы нельзя
    expect(p.fact.text).toMatch(/Анализ отвала воронки «Футболки»/);
    expect(p.fact.text).toMatch(/«Выбрали крой \/ цвет»/);
    expect(p.fact.text).toMatch(/«Отправили форму»/);
    expect(p.fact.text).toMatch(/not_measured, не 0/);
    expect(p.fact.text).toMatch(
      /Нельзя сделать выводы: переход «Открыли конструктор» → «Выбрали размер» нельзя разложить через «Выбрали крой \/ цвет»/,
    );
    expect(p.fact.text).toMatch(
      /переход «Дошли до формы заявки» → «Заявка на футболку принята» нельзя разложить через «Отправили форму»/,
    );
    expect(p.hypothesis.status).toBe('NO_SUPPORTED_HYPOTHESIS');
    expect(p.hypothesis.text).toMatch(
      /настройки счётчика, а не поведение клиентов/,
    );
    expect(p.recommendation.kind).toBe('IMPROVE_DATA_QUALITY');
    expect(p.recommendation.text).toMatch(/завести на него цель/);
    expect(p.recommendation.text).toMatch(/web-photo.*не менять/);
    expect(p.limitations).toEqual(
      expect.arrayContaining(['NOT_MEASURED_STEPS']),
    );
    expect(p.link).toEqual({ tab: 'behavior' });
  });

  it('2: четыре не измеряемых шага одного анализа → одна карточка, не четыре; уровень не растёт с числом шагов', () => {
    const f = funnel('tshirt', 'Футболки', [
      step('a', 'Открыли конструктор', { visits: 100 }),
      gap('g1', 'Шаг 1', 'цели нет'),
      gap('g2', 'Шаг 2', 'цели нет'),
      step('b', 'Выбрали размер', { visits: 40 }),
      gap('g3', 'Шаг 3', 'цели нет'),
      gap('g4', 'Шаг 4', 'цели нет'),
      step('c', 'Заявка принята', { visits: 5 }),
    ]);
    const r = eventNotMeasuredDetector.evaluate(ctxWith([f]));
    expect(r.detected).toHaveLength(1);
    expect(r.detected[0].payload.severity).toBe('INFO');
    expect(r.detected[0].payload.evidence.context.map((c) => c.metric)).toEqual(
      ['step:g1', 'step:g2', 'step:g3', 'step:g4'],
    );
    expect(r.detected[0].payload.title).toMatch(/4 шага не измеряются/);
  });

  it('3: шаг, не нужный ни одному анализу (не существует на сайте) → карточки нет, причина объяснена; воронка без активности → LOW_SAMPLE с объяснением', () => {
    const r = eventNotMeasuredDetector.evaluate(
      ctxWith([canvas, tshirt(5), photo(3)]),
    );
    expect(r.detected).toEqual([]);
    const byEntity: Record<string, (typeof r.suppressed)[number]> =
      Object.fromEntries(r.suppressed.map((s) => [s.entityKey ?? '', s]));
    expect(byEntity.canvas.reason).toBe('NO_MATERIAL_CHANGE');
    expect(byEntity.canvas.detail).toMatch(
      /на сайте не существуют — ни одному анализу не нужны, карточка не создаётся/,
    );
    expect(byEntity.tshirt.reason).toBe('LOW_SAMPLE');
    expect(byEntity.tshirt.detail).toMatch(
      /5 визитов \(< 20\) — анализ отвала сейчас не идёт, пропуск ничего не ограничивает/,
    );
    expect(byEntity.photo.reason).toBe('LOW_SAMPLE');
    expect(EVENT_GAP_MIN_FUNNEL_VISITS).toBe(20);
  });

  it('входной не измеряемый шаг фото при активности → карточка с выводом «нельзя посчитать конверсию из просмотра»; шаг холста упомянут как не нужный, если есть и измеряемый пропуск', () => {
    const r = eventNotMeasuredDetector.evaluate(ctxWith([photo(50)]));
    expect(r.detected).toHaveLength(1);
    expect(r.detected[0].payload.fact.text).toMatch(
      /нельзя посчитать конверсию из «Просмотр каталога \/ товара» в «Начали форму фотопечати»/,
    );
    const mixed = funnel('canvas', 'Холсты', [
      ...canvas.steps.slice(0, 2),
      gap('canvas_step_x', 'Выбрали багет', 'цели нет'),
      canvas.steps[2],
    ]);
    const r2 = eventNotMeasuredDetector.evaluate(ctxWith([mixed]));
    expect(r2.detected).toHaveLength(1);
    expect(r2.detected[0].payload.fact.text).toMatch(
      /«Загрузили фото» на сайте не существуют и в анализе не нужны/,
    );
    expect(r2.detected[0].payload.fact.text).not.toMatch(/Загрузили фото» \(/);
  });

  it('4: not_measured никогда не превращается в 0 — в факте и evidence только null', () => {
    const p = eventNotMeasuredDetector.evaluate(ctxWith([tshirt()])).detected[0]
      .payload;
    expect(p.fact.current).toBeNull();
    expect(p.fact.baseline).toBeNull();
    expect(p.fact.absoluteDelta).toBeNull();
    for (const c of p.evidence.context) {
      expect(c.before).toBeNull();
      expect(c.after).toBeNull();
    }
    expect(p.fact.text).not.toMatch(/«Выбрали крой \/ цвет» 0/);
    expect(p.fact.text).not.toMatch(/«Отправили форму» 0/);
    expect(p.quality.notes.join(' ')).toMatch(/в 0 не превращаются/);
  });

  it('6: повторный запуск, другие дневные числа и другое окно → тот же отпечаток и хэш (version churn 0)', () => {
    const a = eventNotMeasuredDetector.evaluate(ctxWith([tshirt(60)]))
      .detected[0];
    const b = eventNotMeasuredDetector.evaluate(ctxWith([tshirt(60)]))
      .detected[0];
    const c = eventNotMeasuredDetector.evaluate(ctxWith([tshirt(75)]))
      .detected[0];
    const d = eventNotMeasuredDetector.evaluate(
      ctxWith([tshirt(60)], { now: new Date(NOW.getTime() + 86400e3) }),
    ).detected[0];
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(payloadHash(a.payload)).toBe(payloadHash(b.payload));
    // числа шагов и окно не входят в суть карточки — версия не растёт день за днём
    expect(payloadHash(c.payload)).toBe(payloadHash(a.payload));
    expect(payloadHash(d.payload)).toBe(payloadHash(a.payload));
    expect(d.payload.fact.period.to).not.toBe(a.payload.fact.period.to);
    // а вот состав пропусков — суть: другой набор → другой хэш, тот же отпечаток
    const e = eventNotMeasuredDetector.evaluate(
      ctxWith([
        funnel(
          'tshirt',
          'Футболки',
          tshirt().steps.filter((s) => s.key !== 'submit_tshirt_order'),
        ),
      ]),
    ).detected[0];
    expect(e.fingerprint).toBe(a.fingerprint);
    expect(payloadHash(e.payload)).not.toBe(payloadHash(a.payload));
  });

  it('7: никаких причинных / психологических формулировок; 8: реестр — 19 детекторов, hourly-набор прежний, порог в thresholds', () => {
    const r = runDetectors(ctxWith([tshirt(), photo(50), canvas]));
    expect(r.errors).toEqual([]);
    for (const d of r.detected)
      for (const t of [
        d.payload.title,
        d.payload.fact.text,
        d.payload.hypothesis.text ?? '',
        d.payload.recommendation.text,
      ])
        expect(violatesLanguagePolicy(t)).toBeNull();
    expect(DETECTORS).toHaveLength(19);
    expect(
      DETECTORS.filter((d) => d.refresh === 'hourly')
        .map((d) => d.id)
        .sort(),
    ).toEqual(['change.evaluation', 'quality.stale']);
    expect(INSIGHT_THRESHOLDS.eventGapMinFunnelVisits).toBe(20);
    // прежние детекторы дают тот же результат с funnels и без них
    const without = runDetectors(makeContext(QUIET, QUIET));
    const withF = runDetectors(ctxWith([tshirt()]));
    const ids = (x: typeof without) =>
      x.detected
        .filter((d) => d.payload.detectorId !== 'quality.eventNotMeasured')
        .map((d) => `${d.payload.detectorId}:${payloadHash(d.payload)}`)
        .sort();
    expect(ids(withF)).toEqual(ids(without));
  });
});

// ── 5: жизненный цикл — после появления измерения эпизод RESOLVED ────────────

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
        if ('gt' in cond) return (val as Date) > (cond.gt as Date);
        if ('lt' in cond) return (val as Date) < (cond.lt as Date);
        return true;
      }
      return row[k] === v;
    });
  const model = (
    rows: Row[],
    prefix: string,
    defaults: () => Record<string, unknown>,
  ) => ({
    findMany: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) =>
      Promise.resolve(rows.filter((r) => !where || matches(r, where))),
    ),
    findFirst: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) =>
      Promise.resolve(
        rows.filter((r) => !where || matches(r, where)).slice(-1)[0] ?? null,
      ),
    ),
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    ),
    findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id)!),
    ),
    count: jest.fn(() => Promise.resolve(rows.length)),
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
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data, { updatedAt: now() });
        return Promise.resolve({ count: hit.length });
      },
    ),
    groupBy: jest.fn(() => Promise.resolve([])),
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
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  return { prisma: prisma as unknown as PrismaService, insights, versions };
}

describe('FIX_01 — жизненный цикл карточки пропуска измерения', () => {
  it('5: карточка живёт, пока шаг не измеряется; повтор без изменений — версий 0; появилось измерение → RESOLVED', async () => {
    const clock = { now: new Date(NOW) };
    const mem = memoryPrisma(() => clock.now);
    let funnels: Funnel[] = [tshirt()];
    const s = new AnalyticsInsightsService({
      prisma: mem.prisma,
      metrics: {} as AnalyticsMetricsService,
      behavior: {} as BehaviorMetricsService,
      growth: {
        lastDataDay: jest.fn(() => Promise.resolve('2026-10-02')),
      } as unknown as AnalyticsGrowthService,
      now: () => clock.now,
    });
    jest
      .spyOn(s, 'buildContext')
      .mockImplementation(() => Promise.resolve(ctxWith(funnels)));
    await s.run('daily');
    const card = mem.insights.find(
      (i) => i.detectorId === 'quality.eventNotMeasured',
    )!;
    expect(card.status).toBe('OPEN');
    expect(card.entityKey).toBe('tshirt');
    const versionsBefore = mem.versions.filter(
      (v) => v.insightId === card.id,
    ).length;
    clock.now = new Date(NOW.getTime() + 3600e3);
    const r2 = await s.run('daily');
    expect(r2.versioned).toBe(0);
    expect(mem.versions.filter((v) => v.insightId === card.id)).toHaveLength(
      versionsBefore,
    );
    // измерение появилось: оба шага стали measured
    funnels = [
      funnel(
        'tshirt',
        'Футболки',
        tshirt().steps.map((st) =>
          st.availability === 'not_measured'
            ? {
                ...st,
                availability: 'measured' as const,
                visits: 20,
                events: 20,
                note: null,
              }
            : st,
        ),
      ),
    ];
    clock.now = new Date(NOW.getTime() + 86400e3);
    const r3 = await s.run('daily');
    expect(r3.resolved).toBeGreaterThanOrEqual(1);
    expect(card.status).toBe('RESOLVED');
    expect(card.resolvedReason).toMatch(/больше не выполняется/);
  });
});
