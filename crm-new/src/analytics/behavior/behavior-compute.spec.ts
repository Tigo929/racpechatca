import { customPeriod } from '../metrics/analytics-period';
import type { Freshness } from '../metrics/metrics-contract';
import {
  computeDevices,
  computeErrors,
  computeFunnel,
  computeIssues,
  computePages,
  computePaths,
  computeSummary,
  deviceGap,
  FUNNEL_KEYS,
  paramVisits,
  sampleStatus,
  type BehaviorInput,
  type GoalCount,
} from './behavior-compute';
import { MIN_SAMPLE_VISITS, THRESHOLDS } from './behavior-rules';

/**
 * Поведенческий слой (этап 10, раздел 23): воронки в трёх единицах,
 * нулевые знаменатели, отсутствие событий, cutover, недостаточная выборка,
 * сравнение и правила «Требует внимания» с прозрачными порогами и
 * контрактом FACT / HYPOTHESIS / RECOMMENDATION.
 */

const FRESH: Freshness = {
  lastMetrikaSyncAt: new Date('2026-09-14T17:16:36Z'),
  metrikaDataAgeSeconds: 61,
  status: 'FRESH',
  thresholdSeconds: 7200,
};
const STALE: Freshness = {
  ...FRESH,
  metrikaDataAgeSeconds: 23000,
  status: 'STALE',
};

const g = (reaches: number, visits: number): GoalCount => ({ reaches, visits });

function input(over: Partial<BehaviorInput> = {}): BehaviorInput {
  // Реальные цифры боя за 08–14.09.2026 (BEHAVIOR_EVENT_CONTRACT § 5), не выдуманные.
  const goals = new Map<string, GoalCount>([
    ['form_started', g(25, 13)],
    ['lead_submit_attempt', g(4, 4)],
    ['lead_submitted', g(4, 4)],
    ['form_error', g(3, 1)],
    ['lead_submitted_photo', g(2, 2)],
    ['view_custom_tshirt', g(21, 11)],
    ['choose_size', g(2, 2)],
    ['add_tshirt_lead', g(1, 1)],
    ['submit_tshirt_order_error', g(1, 1)],
  ]);
  const deviceGoals = (dev: 'desktop' | 'mobile') =>
    dev === 'desktop' ? goals : new Map<string, GoalCount>();
  return {
    period: customPeriod('2026-09-08', '2026-09-14'),
    visits: 145,
    sumDailyUsers: 118,
    periodUsers: 94,
    goalTotals: goals,
    goalUsers: new Map([
      ['form_started', 3],
      ['lead_submit_attempt', 1],
      ['lead_submitted', 1],
    ]),
    byDevice: [
      {
        deviceCategory: 'desktop',
        visits: 78,
        sumDailyUsers: 60,
        matchedAccepted: 1,
        goals: deviceGoals('desktop'),
        engagement: { bounces: 4, pageviews: 682, durationSeconds: 27662 },
      },
      {
        deviceCategory: 'mobile',
        visits: 64,
        sumDailyUsers: 55,
        matchedAccepted: 0,
        goals: deviceGoals('mobile'),
        engagement: { bounces: 4, pageviews: 208, durationSeconds: 7950 },
      },
      {
        deviceCategory: 'tablet',
        visits: 3,
        sumDailyUsers: 3,
        matchedAccepted: 0,
        goals: new Map(),
        engagement: null,
      },
    ],
    byLanding: [
      {
        normalizedPath: '/',
        visits: 105,
        sumDailyUsers: 74,
        matchedAccepted: 1,
        goals: new Map([
          ['form_started', g(24, 12)],
          ['lead_submit_attempt', g(4, 4)],
          ['lead_submitted', g(4, 4)],
          ['form_error', g(3, 1)],
        ]),
      },
      {
        normalizedPath: '/interer/holst',
        visits: 9,
        sumDailyUsers: 7,
        matchedAccepted: 0,
        goals: new Map(),
      },
      {
        normalizedPath: '/formaty',
        visits: 8,
        sumDailyUsers: 5,
        matchedAccepted: 0,
        goals: new Map(),
      },
    ],
    params: [
      {
        deviceCategory: 'desktop',
        key: 'field',
        value: 'contactValue',
        visits: 1,
        users: 1,
        paramsNumber: 3,
      },
      {
        deviceCategory: 'desktop',
        key: 'field',
        value: 'name',
        visits: 1,
        users: 1,
        paramsNumber: 1,
      },
      {
        deviceCategory: 'desktop',
        key: 'product',
        value: 'canvas',
        visits: 11,
        users: 5,
        paramsNumber: 62,
      },
      {
        deviceCategory: 'desktop',
        key: 'product',
        value: 'photo',
        visits: 3,
        users: 1,
        paramsNumber: 6,
      },
      {
        deviceCategory: 'desktop',
        key: 'productSlug',
        value: 'foto-10x15-bez-polej',
        visits: 20,
        users: 15,
        paramsNumber: 40,
      },
      {
        deviceCategory: 'mobile',
        key: 'productSlug',
        value: 'foto-10x15-s-polyami',
        visits: 8,
        users: 4,
        paramsNumber: 12,
      },
    ],
    paths: {
      entry_lead: [
        { normalizedPath: '/', visits: 4, pageviews: null, users: 1 },
      ],
      viewed_lead: [
        { normalizedPath: '/', visits: null, pageviews: 84, users: 1 },
        {
          normalizedPath: '/catalog/foto-10x15-s-polyami',
          visits: null,
          pageviews: 19,
          users: 1,
        },
      ],
      exit_all: [
        { normalizedPath: '/', visits: 73, pageviews: null, users: 52 },
        {
          normalizedPath: '/interer/holst',
          visits: 12,
          pageviews: null,
          users: 7,
        },
      ],
      exit_nolead: [
        { normalizedPath: '/', visits: 72, pageviews: null, users: 52 },
        {
          normalizedPath: '/interer/holst',
          visits: 12,
          pageviews: null,
          users: 7,
        },
      ],
    },
    behaviorRows: 200,
    freshness: FRESH,
    ...over,
  };
}

describe('воронка: три единицы и конверсии', () => {
  it('общая воронка: шаги в целевых визитах; события и посетители рядом, не вместо', () => {
    const f = computeFunnel('global', input(), null);
    expect(f.steps.map((s) => s.key)).toEqual([
      'visit',
      'form_started',
      'lead_submit_attempt',
      'lead_submitted',
    ]);
    const [visit, started, attempt, lead] = f.steps;
    expect(visit).toMatchObject({
      basis: 'visits',
      visits: 145,
      users: 94,
      events: null,
      stepConversion: null,
    });
    // 25 событий form_started, но 13 визитов и 3 посетителя — конверсия по визитам
    expect(started).toMatchObject({ events: 25, visits: 13, users: 3 });
    expect(started.stepConversion).toBeCloseTo((13 / 145) * 100, 6);
    expect(started.dropoff).toBe(145 - 13);
    expect(attempt).toMatchObject({ events: 4, visits: 4, users: 1 });
    expect(attempt.stepConversion).toBeCloseTo((4 / 13) * 100, 6);
    expect(lead.cumulativeConversion).toBeCloseTo((4 / 145) * 100, 6);
    expect(lead.stepConversion).toBe(100);
    expect(f.sample).toEqual({ visits: 145, status: 'OK' });
    // 08–09.09 — до появления целей: период частично измерим, сравнивать не с чем
    expect(f.quality.notes).toEqual([
      'PARTIAL_BEHAVIOR_PERIOD',
      'COMPARISON_UNAVAILABLE',
    ]);
  });

  it('повторные события (без дедупликации) не завышают шаг: визиты 13 при 25 событиях', () => {
    const f = computeFunnel(
      'global',
      input({
        goalTotals: new Map([
          ['form_started', g(250, 13)],
          ['lead_submitted', g(4, 4)],
        ]),
      }),
      null,
    );
    expect(f.steps[1].events).toBe(250);
    expect(f.steps[1].visits).toBe(13);
    expect(f.steps[1].stepConversion).toBeCloseTo((13 / 145) * 100, 6);
  });

  it('нулевые входы: конверсии null, не 0 % и не NaN', () => {
    const f = computeFunnel(
      'global',
      input({
        visits: 0,
        goalTotals: new Map(),
        goalUsers: null,
        periodUsers: null,
      }),
      null,
    );
    expect(f.steps[1].stepConversion).toBeNull();
    expect(f.steps[3].cumulativeConversion).toBeNull();
    expect(f.steps[1].dropoffRate).toBeNull();
    expect(f.sample.status).toBe('INSUFFICIENT_DATA');
    expect(f.quality.notes).toEqual(
      expect.arrayContaining(['LOW_SAMPLE', 'NO_PERIOD_GOAL_SNAPSHOT']),
    );
  });

  it('без снимка периода посетители шага — null, а не сумма дневных', () => {
    const f = computeFunnel(
      'global',
      input({ goalUsers: null, periodUsers: null }),
      null,
    );
    expect(f.steps.map((s) => s.users)).toEqual([null, null, null, null]);
    expect(f.quality.notes).toContain('NO_PERIOD_GOAL_SNAPSHOT');
  });

  it('футболки: неизмеримые шаги помечены not_measured с причиной и не участвуют в конверсиях', () => {
    const f = computeFunnel('tshirt', input(), null);
    const byKey = Object.fromEntries(f.steps.map((s) => [s.key, s]));
    expect(byKey.choose_type_color).toMatchObject({
      availability: 'not_measured',
      visits: null,
      stepConversion: null,
    });
    expect(byKey.choose_type_color.note).toMatch(/цел/);
    expect(byKey.submit_tshirt_order.availability).toBe('not_measured');
    // выбор размера считается от открывших конструктор (11), а не от неизмеримого шага
    expect(byKey.choose_size.stepConversion).toBeCloseTo((2 / 11) * 100, 6);
    expect(byKey.add_tshirt_lead.stepConversion).toBeCloseTo((1 / 2) * 100, 6);
    // заявок на футболку нет — 0 визитов, конверсия 0 % (знаменатель 1 > 0), не null
    expect(byKey.lead_submitted_tshirt).toMatchObject({
      visits: 0,
      stepConversion: 0,
    });
    expect(f.sample).toEqual({ visits: 11, status: 'LOW_SAMPLE' });
  });

  it('фото и холст: шаг по параметрам визита подписан basis=param, несуществующий шаг — not_measured', () => {
    const photo = computeFunnel('photo', input(), null);
    const started = photo.steps.find((s) => s.key === 'form_started_photo');
    expect(started).toMatchObject({ basis: 'param', visits: 28, events: 52 });
    expect(started?.note).toMatch(/параметр/);
    expect(
      photo.steps.find((s) => s.key === 'lead_submitted_photo')?.stepConversion,
    ).toBeCloseTo((2 / 28) * 100, 6);
    const canvas = computeFunnel('canvas', input(), null);
    expect(
      canvas.steps.find((s) => s.key === 'canvas_interaction'),
    ).toMatchObject({ basis: 'param', visits: 11 });
    expect(
      canvas.steps.find((s) => s.key === 'canvas_upload')?.availability,
    ).toBe('not_measured');
    expect(
      canvas.steps.find((s) => s.key === 'lead_submitted_canvas'),
    ).toMatchObject({ visits: 0, stepConversion: 0 });
  });

  it('cutover: период до появления целей — шаги insufficient_data, воронка unavailable', () => {
    const f = computeFunnel(
      'global',
      input({ period: customPeriod('2026-08-20', '2026-08-26') }),
      null,
    );
    expect(f.steps[0].availability).toBe('measured');
    expect(
      f.steps
        .slice(1)
        .every(
          (s) => s.availability === 'insufficient_data' && s.visits === null,
        ),
    ).toBe(true);
    expect(f.quality.completeness).toBe('unavailable');
    expect(f.quality.notes).toContain('PERIOD_BEFORE_BEHAVIOR_GOALS');
  });

  it('частичный период (задевает 10.09) — partial, а сравнение с периодом до целей недоступно', () => {
    const cur = input({ period: customPeriod('2026-09-08', '2026-09-14') });
    const prev = input({
      period: customPeriod('2026-09-01', '2026-09-07'),
      visits: 200,
    });
    const f = computeFunnel('global', cur, prev);
    expect(f.comparison).toBeNull();
    expect(f.quality.notes).toContain('COMPARISON_UNAVAILABLE');
    const partial = computeFunnel(
      'global',
      input({ period: customPeriod('2026-09-05', '2026-09-14') }),
      null,
    );
    expect(partial.quality.notes).toContain('PARTIAL_BEHAVIOR_PERIOD');
    expect(partial.quality.completeness).toBe('partial');
  });

  it('сравнение с сопоставимым периодом — по визитам и конверсии шага', () => {
    const cur = input({ period: customPeriod('2026-09-17', '2026-09-23') });
    const prev = input({
      period: customPeriod('2026-09-10', '2026-09-16'),
      visits: 100,
      goalTotals: new Map([
        ['form_started', g(10, 10)],
        ['lead_submit_attempt', g(2, 2)],
        ['lead_submitted', g(2, 2)],
      ]),
    });
    const f = computeFunnel('global', cur, prev);
    expect(f.comparison).not.toBeNull();
    const started = f.comparison?.find((c) => c.key === 'form_started');
    expect(started?.visits).toMatchObject({
      current: 13,
      previous: 10,
      delta: 3,
      changeKind: 'UP',
    });
    expect(started?.stepConversion.previous).toBeCloseTo(10, 6);
    expect(f.quality.notes).not.toContain('COMPARISON_UNAVAILABLE');
  });

  it('stale: заметка METRIKA_STALE у всех блоков', () => {
    const f = computeFunnel('global', input({ freshness: STALE }), null);
    expect(f.quality.notes).toContain('METRIKA_STALE');
    expect(
      computeErrors(input({ freshness: STALE }), null).quality.notes,
    ).toContain('METRIKA_STALE');
  });

  it('поведенческие наборы не синхронизированы — unavailable, а не нули', () => {
    const f = computeFunnel('global', input({ behaviorRows: 0 }), null);
    expect(f.quality.completeness).toBe('unavailable');
    expect(f.quality.notes).toContain('BEHAVIOR_NOT_SYNCED');
  });

  it('все пять воронок собираются', () => {
    for (const k of FUNNEL_KEYS)
      expect(computeFunnel(k, input(), null).steps.length).toBeGreaterThan(1);
  });
});

describe('ошибки форм', () => {
  it('итоги, доля от начавших, доля от попыток, поля и устройства', () => {
    const e = computeErrors(input(), null);
    expect(e.totals).toMatchObject({
      formErrorEvents: 3,
      formErrorVisits: 1,
      formStartedVisits: 13,
      attemptEvents: 4,
      serverErrorEvents: 1,
    });
    expect(e.totals.errorRate).toBeCloseTo((1 / 13) * 100, 6);
    expect(e.totals.errorsPerAttempt).toBeCloseTo((3 / 7) * 100, 6);
    expect(e.byField.map((f) => [f.key, f.events, f.label])).toEqual([
      ['contactValue', 3, 'Контакт (мессенджер / e-mail)'],
      ['name', 1, 'Имя'],
    ]);
    expect(e.byField[0].shareOfErrors).toBe(75);
    expect(e.byDevice[0]).toMatchObject({
      deviceCategory: 'desktop',
      formErrorVisits: 1,
      formStartedVisits: 13,
    });
    expect(
      e.byDevice.find((d) => d.deviceCategory === 'mobile')?.errorRate,
    ).toBeNull();
    expect(e.byLanding).toEqual([
      expect.objectContaining({
        normalizedPath: '/',
        formErrorVisits: 1,
        sample: 'OK',
      }),
    ]);
  });

  it('нет событий ошибок — нули и null, без исключений', () => {
    const e = computeErrors(input({ goalTotals: new Map(), params: [] }), null);
    expect(e.totals.formErrorVisits).toBe(0);
    expect(e.totals.errorRate).toBeNull();
    expect(e.totals.errorsPerAttempt).toBeNull();
    expect(e.byField).toEqual([]);
  });
});

describe('страницы и устройства', () => {
  it('страницы: порог выборки — доли есть, отклонение от сайта только при OK', () => {
    const p = computePages(input());
    expect(p.minSampleVisits).toBe(MIN_SAMPLE_VISITS);
    expect(p.siteLeadConversion).toBeCloseTo((4 / 145) * 100, 6);
    const home = p.rows[0];
    expect(home).toMatchObject({
      normalizedPath: '/',
      visits: 105,
      leadVisits: 4,
      sample: 'OK',
    });
    expect(home.leadConversionVsSite).toBeCloseTo(
      (4 / 105) * 100 - (4 / 145) * 100,
      6,
    );
    const holst = p.rows.find((r) => r.normalizedPath === '/interer/holst');
    expect(holst).toMatchObject({
      sample: 'LOW_SAMPLE',
      leadConversion: 0,
      leadConversionVsSite: null,
    });
  });

  it('устройства: доли, вовлечённость из аддитивных сумм, разрыв mobile/desktop по началу формы при малом числе заявок', () => {
    const d = computeDevices(input());
    const desktop = d.rows.find((r) => r.deviceCategory === 'desktop');
    const mobile = d.rows.find((r) => r.deviceCategory === 'mobile');
    expect(desktop?.formStartRate).toBeCloseTo((13 / 78) * 100, 6);
    expect(desktop?.engagement?.pageDepth).toBeCloseTo(682 / 78, 6);
    expect(desktop?.engagement?.bounceRate).toBeCloseTo((4 / 78) * 100, 6);
    expect(mobile?.formStartRate).toBe(0);
    expect(mobile?.leadConversion).toBe(0);
    // заявок всего 4 ≥ 3 → метрика разрыва — конверсия в заявку; mobile 0 при desktop > 0 → сравнимо, ratio 0
    expect(d.gap).toMatchObject({
      metric: 'leadConversion',
      mobile: 0,
      status: 'COMPARABLE',
      ratio: 0,
    });
    expect(d.rows.find((r) => r.deviceCategory === 'tablet')?.sample).toBe(
      'LOW_SAMPLE',
    );
  });

  it('разрыв не считается при малой выборке одного из устройств', () => {
    const d = computeDevices(
      input({
        byDevice: input().byDevice.map((x) =>
          x.deviceCategory === 'mobile' ? { ...x, visits: 12 } : x,
        ),
      }),
    );
    expect(d.gap.status).toBe('INSUFFICIENT_DATA');
    expect(d.gap.ratio).toBeNull();
    expect(deviceGap([])).toMatchObject({ status: 'INSUFFICIENT_DATA' });
  });

  it('paramVisits и sampleStatus', () => {
    expect(paramVisits(input().params, 'productSlug')).toEqual({
      visits: 28,
      users: 19,
      paramsNumber: 52,
    });
    expect(paramVisits(input().params, 'product', 'canvas').visits).toBe(11);
    expect(sampleStatus(0)).toBe('INSUFFICIENT_DATA');
    expect(sampleStatus(29)).toBe('LOW_SAMPLE');
    expect(sampleStatus(30)).toBe('OK');
  });
});

describe('пути (агрегаты)', () => {
  it('доли считаются от итогов вида, gap зафиксирован текстом', () => {
    const p = computePaths(input());
    expect(p.totals).toEqual({
      leadVisits: 4,
      leadPageviews: 103,
      noLeadVisits: 84,
      allVisits: 85,
    });
    expect(p.entryLead[0]).toMatchObject({
      normalizedPath: '/',
      visits: 4,
      share: 100,
    });
    expect(p.viewedLead[1].share).toBeCloseTo((19 / 103) * 100, 6);
    expect(p.exitNoLead[0].share).toBeCloseTo((72 / 84) * 100, 6);
    expect(p.dataGap).toMatch(/Logs API/);
  });
});

describe('«Требует внимания»: правила, пороги, контракт FACT / HYPOTHESIS / RECOMMENDATION', () => {
  const ctxFor = (cur: BehaviorInput, prev: BehaviorInput | null) => ({
    funnels: FUNNEL_KEYS.map((k) => computeFunnel(k, cur, prev)),
    errors: computeErrors(cur, prev),
    pages: computePages(cur),
    devices: computeDevices(cur),
    previousLeadRate: prev
      ? {
          visits: prev.visits,
          leadVisits: prev.goalTotals.get('lead_submitted')?.visits ?? 0,
        }
      : null,
  });

  it('на боевых данных недели: разрыв устройств (CRITICAL, mobile 0 при 64 визитах) и отвал на шаге формы', () => {
    const cur = input();
    const issues = computeIssues(cur, null, ctxFor(cur, null));
    const gap = issues.issues.find((i) => i.rule === 'DEVICE_GAP');
    expect(gap).toMatchObject({
      severity: 'CRITICAL',
      causality: 'NOT_ESTABLISHED',
      scope: { kind: 'device', key: 'mobile' },
    });
    expect(gap?.fact).toMatch(/телефоны 0 %/);
    expect(gap?.hypothesis).toMatch(/^Возможн/);
    expect(gap?.recommendation).toMatch(/360–430/);
    const drop = issues.issues.find((i) => i.rule === 'FUNNEL_DROPOFF');
    expect(drop).toMatchObject({
      severity: 'ATTENTION',
      scope: { kind: 'funnel', key: 'global:form_started' },
    });
    expect(drop?.fact).toMatch(/145 → 13/);
    // порядок: CRITICAL раньше ATTENTION
    expect(issues.issues[0].severity).toBe('CRITICAL');
    // без сопоставимого периода — правило про lead rate пропущено с причиной
    expect(issues.skipped.map((s) => s.rule)).toEqual(
      expect.arrayContaining(['LEAD_RATE_ANOMALY', 'FORM_ERROR_SPIKE']),
    );
    expect(issues.thresholds.MIN_SAMPLE_VISITS).toBe(MIN_SAMPLE_VISITS);
    expect(issues.thresholds.deviceGapCriticalRatio).toBe(
      THRESHOLDS.deviceGapCriticalRatio,
    );
  });

  it('малая выборка не рождает карточек: 19 визитов — все правила пропущены', () => {
    const cur = input({
      visits: 19,
      params: [],
      byDevice: input().byDevice.map((d) => ({ ...d, visits: 10 })),
      byLanding: input().byLanding.map((l) => ({ ...l, visits: 10 })),
      goalTotals: new Map([
        ['form_started', g(2, 2)],
        ['lead_submitted', g(1, 1)],
      ]),
    });
    const issues = computeIssues(cur, null, ctxFor(cur, null));
    expect(issues.issues).toEqual([]);
    expect(issues.skipped.length).toBeGreaterThanOrEqual(4);
    expect(issues.skipped.every((s) => s.reason.length > 0)).toBe(true);
  });

  it('всплеск ошибок формы: ×2 к сопоставимому периоду — ATTENTION, ×3 — CRITICAL; поле в факте', () => {
    const prev = input({
      period: customPeriod('2026-09-13', '2026-09-19'),
      goalTotals: new Map([
        ['form_started', g(40, 40)],
        ['form_error', g(3, 3)],
        ['lead_submitted', g(4, 4)],
      ]),
    });
    const cur2 = input({
      period: customPeriod('2026-09-20', '2026-09-26'),
      goalTotals: new Map([
        ['form_started', g(40, 40)],
        ['form_error', g(9, 6)],
        ['lead_submitted', g(4, 4)],
      ]),
    });
    const a = computeIssues(cur2, prev, ctxFor(cur2, prev)).issues.find(
      (i) => i.rule === 'FORM_ERROR_SPIKE',
    );
    expect(a).toMatchObject({ severity: 'ATTENTION' });
    expect(a?.fact).toMatch(/6 визитов с ошибкой/);
    expect(a?.fact).toMatch(/Контакт/);
    const cur3 = input({
      period: customPeriod('2026-09-20', '2026-09-26'),
      goalTotals: new Map([
        ['form_started', g(40, 40)],
        ['form_error', g(12, 9)],
        ['lead_submitted', g(4, 4)],
      ]),
    });
    expect(
      computeIssues(cur3, prev, ctxFor(cur3, prev)).issues.find(
        (i) => i.rule === 'FORM_ERROR_SPIKE',
      )?.severity,
    ).toBe('CRITICAL');
  });

  it('страница с достаточным трафиком и конверсией ≤ 50 % от средней — LANDING_UNDERPERFORMANCE', () => {
    const cur = input({
      visits: 400,
      goalTotals: new Map([
        ['form_started', g(60, 60)],
        ['lead_submitted', g(40, 40)],
      ]),
      byLanding: [
        {
          normalizedPath: '/',
          visits: 300,
          sumDailyUsers: 200,
          matchedAccepted: 0,
          goals: new Map([
            ['lead_submitted', g(38, 38)],
            ['form_started', g(50, 50)],
          ]),
        },
        {
          normalizedPath: '/formaty',
          visits: 100,
          sumDailyUsers: 60,
          matchedAccepted: 0,
          goals: new Map([
            ['lead_submitted', g(2, 2)],
            ['form_started', g(10, 10)],
          ]),
        },
      ],
    });
    const issue = computeIssues(cur, null, ctxFor(cur, null)).issues.find(
      (i) => i.rule === 'LANDING_UNDERPERFORMANCE',
    );
    expect(issue).toMatchObject({
      severity: 'ATTENTION',
      scope: { kind: 'page', key: '/formaty' },
    });
    expect(issue?.fact).toMatch(/ожидалось около 10/);
    expect(issue?.evidence[0]).toMatchObject({
      metric: 'leadConversion',
      unit: 'percent',
      sample: 100,
      minSample: MIN_SAMPLE_VISITS,
    });
  });

  it('lead rate: падение ≥ 50 % — ATTENTION, рост — INFO; нужны оба периода ≥ 30 визитов и сопоставимость', () => {
    const prev = input({
      period: customPeriod('2026-09-10', '2026-09-16'),
      visits: 100,
      goalTotals: new Map([
        ['lead_submitted', g(10, 10)],
        ['form_started', g(20, 20)],
      ]),
    });
    const down = input({
      period: customPeriod('2026-09-17', '2026-09-23'),
      visits: 100,
      goalTotals: new Map([
        ['lead_submitted', g(3, 3)],
        ['form_started', g(20, 20)],
      ]),
    });
    const d = computeIssues(down, prev, ctxFor(down, prev)).issues.find(
      (i) => i.rule === 'LEAD_RATE_ANOMALY',
    );
    expect(d).toMatchObject({ severity: 'ATTENTION' });
    expect(d?.fact).toMatch(/3 заявок на 100 визитов/);
    const up = input({
      period: customPeriod('2026-09-17', '2026-09-23'),
      visits: 100,
      goalTotals: new Map([
        ['lead_submitted', g(20, 20)],
        ['form_started', g(30, 30)],
      ]),
    });
    expect(
      computeIssues(up, prev, ctxFor(up, prev)).issues.find(
        (i) => i.rule === 'LEAD_RATE_ANOMALY',
      )?.severity,
    ).toBe('INFO');
    const before = input({
      period: customPeriod('2026-09-01', '2026-09-07'),
      visits: 100,
    });
    expect(
      computeIssues(down, before, ctxFor(down, before)).issues.find(
        (i) => i.rule === 'LEAD_RATE_ANOMALY',
      ),
    ).toBeUndefined();
  });

  it('каждая карточка: fact с числами, гипотеза в сослагательной форме, рекомендация — действие, причина не установлена', () => {
    const cur = input();
    const issues = computeIssues(cur, null, ctxFor(cur, null)).issues;
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.fact).toMatch(/\d/);
      expect(i.hypothesis).toMatch(/Возможн/);
      expect(i.recommendation).toMatch(/Проверить|Сравнить|Открыть/);
      expect(i.causality).toBe('NOT_ESTABLISHED');
      expect(i.evidence.length).toBeGreaterThan(0);
      expect(i.evidence.every((e) => e.minSample > 0)).toBe(true);
    }
  });
});

describe('сводка', () => {
  it('headline из целевых визитов, счётчик карточек по severity, качество из общей воронки', () => {
    const cur = input();
    const funnel = computeFunnel('global', cur, null);
    const devices = computeDevices(cur);
    const issues = computeIssues(cur, null, {
      funnels: [funnel],
      errors: computeErrors(cur, null),
      pages: computePages(cur),
      devices,
      previousLeadRate: null,
    });
    const s = computeSummary(
      cur,
      null,
      funnel,
      devices,
      issues,
      new Date('2026-09-14T20:00:00Z'),
    );
    expect(s.headline).toMatchObject({
      visits: 145,
      formStartedVisits: 13,
      attemptVisits: 4,
      leadVisits: 4,
      formErrorVisits: 1,
    });
    expect(s.headline.startToLead).toBeCloseTo((4 / 13) * 100, 6);
    expect(s.issuesBySeverity.CRITICAL).toBe(1);
    expect(s.dataQuality).toMatchObject({
      behaviorGoalsAvailableFrom: '2026-09-10',
      directionGoalsAvailableFrom: '2026-09-12',
      snapshotAvailable: true,
      behaviorRowsInPeriod: 200,
    });
  });
});
