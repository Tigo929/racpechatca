import type { BehaviorIssues } from '../behavior/behavior-contract';
import {
  DETECTORS,
  canonicalPayload,
  changeEvaluationDetector,
  clientIdCoverageDetector,
  cogsDetector,
  fingerprintOf,
  formErrorRateDetector,
  formStartRateDetector,
  landingDetector,
  payloadHash,
  periodTouchesIncident,
  productDetector,
  profitDetector,
  revenueDetector,
  runDetectors,
  siteLeadRateDetector,
  sourceMixDetector,
  sourcePerformanceDetector,
  stage10Detector,
  staleDetector,
  trafficDetector,
} from './insights-engine';
import { FORBIDDEN_PHRASES, violatesLanguagePolicy } from './insights-language';
import {
  FRESH,
  NOW,
  fakeEvaluation,
  makeContext,
} from './insights-fixture.spec-helper.spec';

/**
 * Матрица тестов этапа 12 (раздел 39): A детерминизм, B малые выборки,
 * C сопоставимость, D созревание, E разделение доменов, F язык,
 * G сохранение вердиктов этапа 11, H инцидент, I качество.
 */

const ZEROS: number[] = new Array<number>(30).fill(0);

const QUIET = {
  visits: 300,
  siteLeads: 12,
  formStarts: 40,
  formErrors: 2,
  attempts: 20,
};

describe('A. детерминизм', () => {
  it('A1: одинаковые данные → одинаковый результат и одинаковые отпечатки/хэши', () => {
    const a = runDetectors(
      makeContext(
        { visits: 500, siteLeads: 5 },
        { visits: 500, siteLeads: 40 },
      ),
    );
    const b = runDetectors(
      makeContext(
        { visits: 500, siteLeads: 5 },
        { visits: 500, siteLeads: 40 },
      ),
    );
    expect(a.errors).toEqual([]);
    expect(a.detected.map((d) => d.fingerprint)).toEqual(
      b.detected.map((d) => d.fingerprint),
    );
    expect(a.detected.map((d) => payloadHash(d.payload))).toEqual(
      b.detected.map((d) => payloadHash(d.payload)),
    );
  });

  it('A2: каноническая нагрузка не зависит от свежести и ссылок на запуск синхронизации', () => {
    const ctx1 = makeContext(
      { visits: 500, siteLeads: 5 },
      { visits: 500, siteLeads: 40 },
    );
    const ctx2 = makeContext(
      { visits: 500, siteLeads: 5 },
      { visits: 500, siteLeads: 40 },
      { freshness: { ...FRESH, metrikaDataAgeSeconds: 3000 } },
    );
    ctx2.lastSyncRunId = 'run-2';
    const a = siteLeadRateDetector.evaluate(ctx1).detected[0];
    const b = siteLeadRateDetector.evaluate(ctx2).detected[0];
    expect(canonicalPayload(a.payload)).toBe(canonicalPayload(b.payload));
    expect(
      fingerprintOf(
        'SITE_CONVERSION_CHANGE',
        'site.leadRate',
        'siteLeadRate',
        null,
      ),
    ).toBe(a.fingerprint);
  });

  it('A3: один отпечаток в запуске — одна карточка, дубль уходит в DUPLICATE', () => {
    const ctx = makeContext(
      { visits: 500, siteLeads: 5 },
      { visits: 500, siteLeads: 40 },
    );
    const r = runDetectors(ctx, [siteLeadRateDetector, siteLeadRateDetector]);
    expect(r.detected).toHaveLength(1);
    expect(r.suppressed.filter((s) => s.reason === 'DUPLICATE')).toHaveLength(
      1,
    );
  });
});

describe('B. малые выборки — тишина по умолчанию', () => {
  it('B1: 2 → 3 заявки при 60 визитах — не ATTENTION/CRITICAL, а LOW_SAMPLE/INSUFFICIENT_DATA', () => {
    const r = runDetectors(
      makeContext(
        { visits: 60, siteLeads: 2, formStarts: 8 },
        { visits: 55, siteLeads: 3, formStarts: 9 },
      ),
    );
    expect(r.detected.filter((d) => d.payload.severity !== 'INFO')).toEqual([]);
    const lead = r.suppressed.find((s) => s.detectorId === 'site.leadRate');
    expect(lead?.reason).toMatch(/LOW_SAMPLE|INSUFFICIENT_DATA/);
    expect(lead?.detail).toMatch(/MDE|вердикт/);
  });

  it('B2: ошибка формы 0 → 1 — не CRITICAL', () => {
    const r = formErrorRateDetector.evaluate(
      makeContext({ ...QUIET, formErrors: 0 }, { ...QUIET, formErrors: 1 }),
    );
    expect(r.detected).toEqual([]);
    expect(r.suppressed[0].reason).toMatch(
      /LOW_SAMPLE|INSUFFICIENT_DATA|NO_MATERIAL_CHANGE/,
    );
  });

  it('B3: большой относительный процент на малом знаменателе → LOW_SAMPLE, не сигнал', () => {
    const r = siteLeadRateDetector.evaluate(
      makeContext({ visits: 20, siteLeads: 1 }, { visits: 20, siteLeads: 3 }),
    );
    expect(r.detected).toEqual([]);
    expect(r.suppressed[0].reason).toBe('LOW_SAMPLE');
  });

  it('источник с < 30 визитов не даёт карточки', () => {
    const r = sourcePerformanceDetector.evaluate(
      makeContext(
        {
          visits: 300,
          siteLeads: 10,
          sources: [
            { source: 'ads', visits: 280, leads: 10 },
            { source: 'tg', visits: 20 },
          ],
        },
        {
          visits: 300,
          siteLeads: 10,
          sources: [
            { source: 'ads', visits: 280, leads: 10 },
            { source: 'tg', visits: 2 },
          ],
        },
      ),
    );
    expect(r.detected).toEqual([]);
    expect(r.suppressed.find((s) => s.entityKey === 'tg')?.reason).toBe(
      'LOW_SAMPLE',
    );
  });
});

describe('сигналы при достаточных данных', () => {
  it('падение конверсии 8 % → 1 % при 500 визитах — ATTENTION с гипотезой из сопутствующих фактов и рекомендацией проверки', () => {
    const r = siteLeadRateDetector.evaluate(
      makeContext(
        { visits: 500, siteLeads: 40, formStarts: 80, formErrors: 2 },
        { visits: 500, siteLeads: 5, formStarts: 80, formErrors: 20 },
      ),
    );
    expect(r.detected).toHaveLength(1);
    const p = r.detected[0].payload;
    expect(p.severity).toBe('ATTENTION');
    expect(p.causality).toBe('NOT_ESTABLISHED');
    expect(p.evidence.statisticalStrength).toBe('SIGNAL');
    expect(p.evidence.businessMateriality).toBe('MATERIAL');
    expect(p.fact.text).toMatch(/8,0 %.*1,0 %|1,0 %/);
    expect(p.hypothesis.status).toBe('SUPPORTED_BY_CONCURRENT_FACTS');
    expect(p.hypothesis.text).toMatch(
      /^Гипотеза: .*ошиб.*Причинность не установлена\.$/,
    );
    expect(p.recommendation.kind).toBe('CHECK_TECHNICAL');
  });

  it('рост конверсии — INFO (положительный сигнал не приказ); визиты — INFO при любой полярности', () => {
    const up = siteLeadRateDetector.evaluate(
      makeContext(
        { visits: 500, siteLeads: 5 },
        { visits: 500, siteLeads: 40 },
      ),
    ).detected[0];
    expect(up.payload.severity).toBe('INFO');
    const traffic = trafficDetector.evaluate(
      makeContext(
        { visits: 900, siteLeads: 30 },
        { visits: 400, siteLeads: 15 },
      ),
    ).detected[0];
    expect(traffic.payload.severity).toBe('INFO');
    expect(traffic.payload.title).toMatch(/Визиты снизились/);
  });

  it('статистически заметное, но несущественное изменение → NO_MATERIAL_CHANGE', () => {
    // 10 % → 11,5 %: при 20 000 визитах значимо, но < 2 п.п.
    const r = siteLeadRateDetector.evaluate(
      makeContext(
        { visits: 20000, siteLeads: 2000 },
        { visits: 20000, siteLeads: 2300 },
      ),
    );
    expect(r.detected).toEqual([]);
    expect(r.suppressed[0].reason).toBe('NO_MATERIAL_CHANGE');
  });

  it('CRITICAL: заявки исчезли при ≥ 150 визитах и ≥ 3 заявках в базе; иначе — нет', () => {
    const gone = siteLeadRateDetector.evaluate(
      makeContext({ visits: 200, siteLeads: 6 }, { visits: 200, siteLeads: 0 }),
    ).detected[0];
    expect(gone.payload.severity).toBe('CRITICAL');
    expect(gone.payload.title).toMatch(/исчезли/);
    const small = siteLeadRateDetector.evaluate(
      makeContext({ visits: 40, siteLeads: 2 }, { visits: 40, siteLeads: 0 }),
    );
    expect(small.detected).toEqual([]);
  });

  it('CRITICAL: обрыв воронки — формы не начинаются при трафике; ошибки форм ≥ 10 визитов → CRITICAL, 5–9 → ATTENTION', () => {
    const brk = formStartRateDetector.evaluate(
      makeContext(
        { visits: 200, siteLeads: 5, formStarts: 30 },
        { visits: 200, siteLeads: 0, formStarts: 0 },
      ),
    ).detected[0];
    expect(brk.payload.severity).toBe('CRITICAL');
    const crit = formErrorRateDetector.evaluate(
      makeContext(
        { ...QUIET, formStarts: 100, formErrors: 2 },
        { ...QUIET, formStarts: 100, formErrors: 15 },
      ),
    ).detected[0];
    expect(crit.payload.severity).toBe('CRITICAL');
    const att = formErrorRateDetector.evaluate(
      makeContext(
        { ...QUIET, formStarts: 100, formErrors: 0 },
        { ...QUIET, formStarts: 100, formErrors: 7 },
      ),
    ).detected[0];
    expect(att.payload.severity).toBe('ATTENTION');
  });
});

describe('C. сопоставимость', () => {
  it('C1: окно пересекает availableFrom / смену определения → MEASUREMENT_DEFINITION_CHANGED, карточки нет', () => {
    // NOW 20.09 → «после» 12–18.09 пересекает cutover 13.09 (единый lead_submitted)
    const ctx = makeContext(
      { visits: 300, siteLeads: 3 },
      { visits: 300, siteLeads: 30 },
      { now: new Date('2026-09-20T08:00:00Z') },
    );
    const r = siteLeadRateDetector.evaluate(ctx);
    expect(r.detected).toEqual([]);
    expect(r.suppressed[0].reason).toBe('MEASUREMENT_DEFINITION_CHANGED');
  });

  it('C2: partial-переход этапа 10 → нет FUNNEL_DROPOFF, причина PARTIAL_BEHAVIOR_PERIOD', () => {
    const issues: BehaviorIssues = {
      period: {
        from: '2026-09-26',
        to: '2026-10-02',
        kind: 'days',
        preset: null,
      },
      previousPeriod: {
        from: '2026-09-19',
        to: '2026-09-25',
        kind: 'days',
        preset: null,
      },
      issues: [],
      skipped: [
        {
          rule: 'FUNNEL_DROPOFF',
          code: 'PARTIAL_BEHAVIOR_PERIOD',
          reason: 'окна измерения шагов не совпадают',
        },
      ],
      thresholds: {},
      quality: { completeness: 'complete', notes: [] },
    };
    const r = stage10Detector.evaluate(
      makeContext(QUIET, QUIET, { behavior: { issues, funnels: [] } }),
    );
    expect(r.detected).toEqual([]);
    expect(r.suppressed[0]).toMatchObject({
      category: 'FUNNEL_DROPOFF',
      reason: 'PARTIAL_BEHAVIOR_PERIOD',
    });
  });

  it('C3: отсутствующая история — null, а не 0: реализованная выручка без P&L не сравнивается', () => {
    const r = revenueDetector.evaluate(
      makeContext(
        { visits: 100, siteLeads: 2 },
        { visits: 100, siteLeads: 2, realizedRevenue: 50000 },
      ),
    );
    expect(r.detected).toEqual([]);
    expect(r.suppressed[0].reason).toMatch(/IMMATURE|INSUFFICIENT_DATA/);
  });

  it('C4: несовпадение дней недели — ограничение (окно 7/7 его не имеет; 5/5 — имеет)', () => {
    const ctx = makeContext(
      { visits: 500, siteLeads: 5 },
      { visits: 500, siteLeads: 40 },
    );
    expect(ctx.windows.flags).not.toContain('WEEKDAY_MIX_MISMATCH');
    const p = siteLeadRateDetector.evaluate(ctx).detected[0].payload;
    expect(p.limitations).not.toContain('WEEKDAY_MIX_MISMATCH');
  });
});

describe('D. созревание', () => {
  it('D1: оплаты/выручка/прибыль за последние 7 дней — IMMATURE, финального вывода нет даже при −60 %', () => {
    const before = {
      visits: 300,
      siteLeads: 10,
      realizedRevenue: 100000,
      netProfit: 50000,
      cohorts: {
        leads: 20,
        leadsAccepted: 15,
        leadsPaid: 12,
        accepted: 15,
        acceptedPaid: 12,
      },
    };
    const after = {
      visits: 300,
      siteLeads: 10,
      realizedRevenue: 40000,
      netProfit: 20000,
      cohorts: {
        leads: 20,
        leadsAccepted: 15,
        leadsPaid: 4,
        accepted: 15,
        acceptedPaid: 4,
      },
    };
    for (const d of [revenueDetector, profitDetector]) {
      const r = d.evaluate(makeContext(before, after));
      expect(r.detected).toEqual([]);
      expect(r.suppressed[0].reason).toBe('IMMATURE');
      expect(r.suppressed[0].detail).toMatch(/созревание до/);
    }
  });

  it('D2: после созревания детектор возвращается к обычной оценке (политика 0 дней для оплат — как будто окно созрело)', () => {
    const ctx = makeContext(
      {
        visits: 300,
        siteLeads: 10,
        cohorts: {
          leads: 200,
          leadsAccepted: 150,
          leadsPaid: 120,
          accepted: 150,
          acceptedPaid: 120,
        },
      },
      {
        visits: 300,
        siteLeads: 10,
        cohorts: {
          leads: 200,
          leadsAccepted: 150,
          leadsPaid: 40,
          accepted: 150,
          acceptedPaid: 40,
        },
      },
      {
        lagDays: {
          leadToAccepted: ZEROS,
          acceptedToPaid: ZEROS,
          leadToPaid: ZEROS,
        },
      },
    );
    expect(ctx.metrics.leadToPaidRate.maturity.status).toBe('MATURE');
    expect(ctx.metrics.leadToPaidRate.verdict).toBe('NEGATIVE_SIGNAL');
  });
});

describe('E. разделение доменов', () => {
  it('E1: заявки сайта и заказы CRM — разные метрики; CRM-детекторы несут ограничение CRM_INCLUDES_OFFLINE', () => {
    const ctx = makeContext(
      {
        visits: 300,
        siteLeads: 10,
        cohorts: { leads: 200, leadsAccepted: 150, accepted: 150 },
      },
      {
        visits: 300,
        siteLeads: 10,
        cohorts: { leads: 200, leadsAccepted: 60, accepted: 60 },
      },
      {
        lagDays: {
          leadToAccepted: ZEROS,
          acceptedToPaid: ZEROS,
          leadToPaid: ZEROS,
        },
      },
    );
    const lead = siteLeadRateDetector.evaluate(ctx);
    expect(lead.detected).toEqual([]); // заявки сайта не менялись
    const crm = runDetectors(ctx, [
      DETECTORS.find((d) => d.id === 'crm.leadToAccepted')!,
    ]).detected[0];
    expect(crm.payload.metricKey).toBe('leadToAcceptedRate');
    expect(crm.payload.limitations).toContain('CRM_INCLUDES_OFFLINE');
    expect(crm.payload.fact.text).not.toMatch(/визит/i);
  });

  it('E2: низкое покрытие ClientID — DATA_QUALITY INFO, matched-метрики подавлены', () => {
    const ctx = makeContext(
      {
        visits: 300,
        siteLeads: 10,
        clientIdCoverage: 7,
        cohorts: { accepted: 20 },
      },
      {
        visits: 300,
        siteLeads: 10,
        clientIdCoverage: 7,
        cohorts: { accepted: 20 },
      },
    );
    const r = clientIdCoverageDetector.evaluate(ctx);
    expect(r.detected[0].payload).toMatchObject({
      category: 'DATA_QUALITY',
      severity: 'INFO',
    });
    expect(r.detected[0].payload.hypothesis.status).toBe(
      'NO_SUPPORTED_HYPOTHESIS',
    );
    expect(ctx.metrics.matchedAcceptedRate.flags).toContain(
      'MATCHED_COVERAGE_LOW',
    );
  });

  it('E3: неполная себестоимость блокирует прибыль и даёт DATA_QUALITY', () => {
    const ctx = makeContext(
      {
        visits: 300,
        siteLeads: 10,
        realizedRevenue: 100000,
        netProfit: 50000,
        notes: ['COGS_UNRELIABLE_ORDERS'],
      },
      {
        visits: 300,
        siteLeads: 10,
        realizedRevenue: 40000,
        netProfit: 20000,
        notes: ['COGS_UNRELIABLE_ORDERS'],
      },
      {
        lagDays: {
          leadToAccepted: ZEROS,
          acceptedToPaid: ZEROS,
          leadToPaid: ZEROS,
        },
      },
    );
    expect(profitDetector.evaluate(ctx).detected).toEqual([]);
    expect(profitDetector.evaluate(ctx).suppressed[0].reason).toBe(
      'COGS_INCOMPLETE',
    );
    expect(cogsDetector.evaluate(ctx).detected[0].payload.title).toMatch(
      /Себестоимость/,
    );
  });
});

describe('F. язык', () => {
  it('F1: все сигналы causality = NOT_ESTABLISHED; F2: запрещённых причинных формулировок нет ни в одном тексте', () => {
    const contexts = [
      makeContext(
        { visits: 500, siteLeads: 40, formStarts: 80, formErrors: 2 },
        { visits: 500, siteLeads: 5, formStarts: 80, formErrors: 20 },
      ),
      makeContext(
        {
          visits: 900,
          siteLeads: 30,
          sources: [
            { source: 'ads', visits: 700, leads: 25 },
            { source: 'organic', visits: 200, leads: 5 },
          ],
        },
        {
          visits: 400,
          siteLeads: 15,
          sources: [
            { source: 'ads', visits: 100, leads: 5 },
            { source: 'organic', visits: 300, leads: 10 },
          ],
        },
      ),
      makeContext({ visits: 200, siteLeads: 6 }, { visits: 200, siteLeads: 0 }),
      makeContext(
        {
          visits: 300,
          siteLeads: 10,
          clientIdCoverage: 7,
          cohorts: { accepted: 20 },
          paidWithoutDate: 2,
        },
        {
          visits: 300,
          siteLeads: 10,
          clientIdCoverage: 7,
          cohorts: { accepted: 20 },
          paidWithoutDate: 2,
        },
        {
          freshness: {
            ...FRESH,
            status: 'STALE',
            metrikaDataAgeSeconds: 8 * 3600,
          },
          changes: [
            {
              id: 'chg-1',
              name: 'Деплой 12.09',
              status: 'ACTIVE',
              surface: 'site:forms',
              startedAt: '2026-09-12T10:19:00Z',
              endedAt: null,
              latest: fakeEvaluation(),
              seenVersion: null,
            },
          ],
        },
      ),
    ];
    let cards = 0;
    for (const ctx of contexts) {
      const r = runDetectors(ctx);
      expect(r.errors).toEqual([]);
      for (const d of r.detected) {
        cards++;
        expect(d.payload.causality).toBe('NOT_ESTABLISHED');
        for (const text of [
          d.payload.title,
          d.payload.fact.text,
          d.payload.hypothesis.text ?? '',
          d.payload.recommendation.text,
          ...d.payload.hypothesis.supportingFacts,
        ])
          expect(violatesLanguagePolicy(text)).toBeNull();
        if (d.payload.hypothesis.status === 'SUPPORTED_BY_CONCURRENT_FACTS')
          expect(d.payload.hypothesis.text).toMatch(/^Гипотеза: /);
      }
    }
    expect(cards).toBeGreaterThan(5);
  });

  it('F3: NO_SUPPORTED_HYPOTHESIS — когда сопутствующих фактов нет; политика ловит причинные фразы и пропускает отрицания', () => {
    const up = siteLeadRateDetector.evaluate(
      makeContext(
        { visits: 500, siteLeads: 5 },
        { visits: 500, siteLeads: 40 },
      ),
    ).detected[0];
    expect(up.payload.hypothesis.status).toBe('NO_SUPPORTED_HYPOTHESIS');
    expect(violatesLanguagePolicy('Конверсия упала из-за Директа')).toBe(
      'из-за',
    );
    expect(violatesLanguagePolicy('Причина падения — реклама')).toMatch(
      /Причина/,
    );
    expect(
      violatesLanguagePolicy('Пользователи стали хуже воспринимать форму'),
    ).toMatch(/Пользователи стали/);
    expect(
      violatesLanguagePolicy(
        'совпадение по времени не доказывает связь; причинность не установлена',
      ),
    ).toBeNull();
    expect(FORBIDDEN_PHRASES.length).toBeGreaterThan(10);
  });
});

describe('G. этап 11 сохраняется', () => {
  it('G1: INCOMPARABLE не становится сигналом; вердикт и рекомендация этапа 11 — дословно, INFO', () => {
    const ctx = makeContext(QUIET, QUIET, {
      changes: [
        {
          id: 'chg-1',
          name: 'Деплой 12.09',
          status: 'ACTIVE',
          surface: 'site:forms',
          startedAt: '2026-09-12T10:19:00Z',
          endedAt: null,
          latest: fakeEvaluation(),
          seenVersion: null,
        },
      ],
    });
    const r = changeEvaluationDetector.evaluate(ctx);
    const p = r.detected[0].payload;
    expect(p.category).toBe('CHANGE_EVALUATION');
    expect(p.severity).toBe('INFO');
    expect(p.evidence.verdict).toBe('INCOMPARABLE');
    expect(p.fact.text).toMatch(/Вердикт этапа 11: INCOMPARABLE/);
    expect(p.recommendation.text).toBe(
      'Сравнивать окна, целиком лежащие после смены определения.',
    );
    expect(p.recommendation.kind).toBe('USE_STAGE11_RECOMMENDATION');
    expect(p.limitations).toContain('STAGE11_VERDICT_PRESERVED');
  });

  it('G2: IMMATURE сохраняется; уже поднятая версия — DUPLICATE; NEGATIVE_SIGNAL — ATTENTION', () => {
    const mk = (
      v: Partial<Parameters<typeof fakeEvaluation>[0]>,
      seen: number | null,
    ) =>
      changeEvaluationDetector.evaluate(
        makeContext(QUIET, QUIET, {
          changes: [
            {
              id: 'chg-1',
              name: 'X',
              status: 'ACTIVE',
              surface: 's',
              startedAt: '2026-09-12T10:19:00Z',
              endedAt: null,
              latest: fakeEvaluation(v),
              seenVersion: seen,
            },
          ],
        }),
      );
    expect(
      mk({ verdict: 'IMMATURE', maturity: 'IMMATURE', version: 3 }, null)
        .detected[0].payload.fact.text,
    ).toMatch(/IMMATURE/);
    expect(mk({ version: 3 }, 3).suppressed[0].reason).toBe('DUPLICATE');
    expect(
      mk({ verdict: 'NEGATIVE_SIGNAL', version: 4 }, 3).detected[0].payload
        .severity,
    ).toBe('ATTENTION');
  });

  it('G3: пересекающееся изменение — ограничение OVERLAPPING_CHANGE и рекомендация не делать вывода', () => {
    const ctx = makeContext(
      { visits: 500, siteLeads: 40 },
      { visits: 500, siteLeads: 5 },
      {
        overlapping: [
          {
            id: 'chg-9',
            name: 'Правка формы',
            surface: 'site:form',
            startedAt: '2026-09-27T09:00:00Z',
            endedAt: null,
          },
        ],
      },
    );
    const p = siteLeadRateDetector.evaluate(ctx).detected[0].payload;
    expect(p.limitations).toContain('OVERLAPPING_CHANGE');
    expect(p.recommendation.kind).toBe('OBSERVE');
    expect(p.hypothesis.text).toMatch(/нельзя приписать одному/);
  });
});

describe('H. инцидент 14–15.09 как граница', () => {
  it('окна, пересекающие 14.09 18:20 → 15.09 20:32, несут INCIDENT_BOUNDARY; окна после — нет', () => {
    const touching = makeContext(
      { visits: 500, siteLeads: 20 },
      { visits: 500, siteLeads: 60 },
      { now: new Date('2026-09-23T08:00:00Z') },
    );
    expect(periodTouchesIncident(touching.windows)).toBe(true);
    const clean = makeContext(
      { visits: 500, siteLeads: 20 },
      { visits: 500, siteLeads: 60 },
    );
    expect(periodTouchesIncident(clean.windows)).toBe(false);
    // сдвиг смеси источников — карточка с INCIDENT_BOUNDARY при пересечении
    const mix = sourceMixDetector.evaluate(
      makeContext(
        {
          visits: 500,
          siteLeads: 20,
          sources: [
            { source: 'ads', visits: 400 },
            { source: 'organic', visits: 100 },
          ],
        },
        {
          visits: 500,
          siteLeads: 20,
          sources: [
            { source: 'ads', visits: 200 },
            { source: 'organic', visits: 300 },
          ],
        },
        { now: new Date('2026-09-23T08:00:00Z') },
      ),
    );
    expect(mix.detected[0].payload.limitations).toContain('INCIDENT_BOUNDARY');
  });
});

describe('I. качество данных', () => {
  it('I1: устаревшие данные → DATA_QUALITY ATTENTION, старше 6 ч — CRITICAL; свежие — молчание', () => {
    const fresh = staleDetector.evaluate(makeContext(QUIET, QUIET));
    expect(fresh.detected).toEqual([]);
    const stale = staleDetector.evaluate(
      makeContext(QUIET, QUIET, {
        freshness: {
          ...FRESH,
          status: 'STALE',
          metrikaDataAgeSeconds: 3 * 3600,
        },
      }),
    );
    expect(stale.detected[0].payload.severity).toBe('ATTENTION');
    const crit = staleDetector.evaluate(
      makeContext(QUIET, QUIET, {
        freshness: {
          ...FRESH,
          status: 'STALE',
          metrikaDataAgeSeconds: 8 * 3600,
        },
      }),
    );
    expect(crit.detected[0].payload.severity).toBe('CRITICAL');
    expect(crit.detected[0].payload.scope).toBe('data');
  });

  it('часовой запуск — только детекторы свежести и оценок этапа 11', () => {
    const r = runDetectors(makeContext(QUIET, QUIET, { runKind: 'hourly' }));
    const ids = new Set([
      ...r.detected.map((d) => d.payload.detectorId),
      ...r.suppressed.map((s) => s.detectorId),
    ]);
    expect([...ids].sort()).toEqual(
      ['change.evaluation', 'quality.stale'].filter((id) => ids.has(id)).sort(),
    );
  });
});

describe('источники, страницы входа, товары, сдвиг смеси', () => {
  it('источник исчез (300 → 0 визитов) — карточка INFO; доля заявок внутри источника упала — ATTENTION', () => {
    const r = sourcePerformanceDetector.evaluate(
      makeContext(
        {
          visits: 900,
          siteLeads: 60,
          sources: [
            { source: 'ads', visits: 300, leads: 5 },
            { source: 'organic', visits: 600, leads: 55 },
          ],
        },
        {
          visits: 600,
          siteLeads: 10,
          sources: [
            { source: 'ads', visits: 0, leads: 0 },
            { source: 'organic', visits: 600, leads: 10 },
          ],
        },
      ),
    );
    const ads = r.detected.find((d) => d.payload.entityKey === 'ads')!;
    expect(ads.payload.title).toMatch(/трафик исчез/);
    expect(ads.payload.severity).toBe('INFO');
    const org = r.detected.find((d) => d.payload.entityKey === 'organic')!;
    expect(org.payload.severity).toBe('ATTENTION');
    expect(org.payload.metricKey).toBe('siteLeadRate');
  });

  it('страница входа: рост визитов без изменения доли заявок — INFO', () => {
    const r = landingDetector.evaluate(
      makeContext(
        {
          visits: 500,
          siteLeads: 20,
          landings: [
            { path: '/', visits: 400, leads: 16 },
            { path: '/futbolki', visits: 100, leads: 4 },
          ],
        },
        {
          visits: 700,
          siteLeads: 28,
          landings: [
            { path: '/', visits: 400, leads: 16 },
            { path: '/futbolki', visits: 300, leads: 12 },
          ],
        },
      ),
    );
    expect(r.detected.map((d) => d.payload.entityKey)).toEqual(['/futbolki']);
    expect(r.detected[0].payload.severity).toBe('INFO');
    expect(r.detected[0].payload.recommendation.text).toMatch(
      /не хороший и не плохой сигнал/,
    );
  });

  it('товары: 30 → 5 принятых заказов категории — INFO с ограничениями CRM_INCLUDES_OFFLINE и IMMATURE_OUTCOME; 1 → 2 — тишина', () => {
    const r = productDetector.evaluate(
      makeContext(
        {
          visits: 300,
          siteLeads: 10,
          products: [
            { category: 'PHOTO', accepted: 30 },
            { category: 'CANVAS', accepted: 1 },
          ],
        },
        {
          visits: 300,
          siteLeads: 10,
          products: [
            { category: 'PHOTO', accepted: 5 },
            { category: 'CANVAS', accepted: 2 },
          ],
        },
      ),
    );
    expect(r.detected.map((d) => d.payload.entityKey)).toEqual(['PHOTO']);
    expect(r.detected[0].payload.limitations).toEqual(
      expect.arrayContaining(['CRM_INCLUDES_OFFLINE', 'IMMATURE_OUTCOME']),
    );
    expect(r.suppressed.find((s) => s.entityKey === 'CANVAS')?.reason).toBe(
      'LOW_SAMPLE',
    );
  });

  it('сдвиг смеси источников ≥ 15 п.п. — INFO с долями до/после; описательно, без гипотезы', () => {
    const r = sourceMixDetector.evaluate(
      makeContext(
        {
          visits: 500,
          siteLeads: 20,
          sources: [
            { source: 'ads', visits: 400 },
            { source: 'organic', visits: 100 },
          ],
        },
        {
          visits: 500,
          siteLeads: 20,
          sources: [
            { source: 'ads', visits: 200 },
            { source: 'organic', visits: 300 },
          ],
        },
      ),
    );
    const p = r.detected[0].payload;
    expect(p.category).toBe('SOURCE_MIX_SHIFT');
    expect(p.fact.text).toMatch(/80,0 %.*40,0 %|ads/);
    expect(p.hypothesis.status).toBe('NO_SUPPORTED_HYPOTHESIS');
    expect(p.limitations).toContain('DESCRIPTIVE_ONLY');
  });

  it('тихий период: без изменений — 0 карточек кроме качества, все детекторы отчитались причиной молчания', () => {
    const r = runDetectors(makeContext(QUIET, QUIET));
    expect(r.errors).toEqual([]);
    expect(
      r.detected.filter((d) => d.payload.category !== 'DATA_QUALITY'),
    ).toEqual([]);
    const ids = new Set(r.suppressed.map((s) => s.detectorId));
    for (const id of [
      'traffic.visits',
      'site.leadRate',
      'site.formStartRate',
      'site.formErrorRate',
      'money.realizedRevenue',
      'money.netProfit',
      'quality.stale',
    ])
      expect(ids.has(id)).toBe(true);
  });
});

describe('реестр детекторов', () => {
  it('идентификаторы уникальны, у каждого категория из словаря и режим обновления', () => {
    const ids = DETECTORS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DETECTORS) expect(['daily', 'hourly']).toContain(d.refresh);
    expect(
      DETECTORS.filter((d) => d.refresh === 'hourly')
        .map((d) => d.id)
        .sort(),
    ).toEqual(['change.evaluation', 'quality.stale']);
    expect(NOW.toISOString()).toBe('2026-10-03T08:00:00.000Z');
  });
});
