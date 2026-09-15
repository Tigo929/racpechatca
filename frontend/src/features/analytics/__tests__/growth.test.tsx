import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { GrowthEvaluation, GrowthStatus, MetricEvaluation } from '../../../types/growth';
import { ChangeForm, EvaluationView } from '../growth-sections';
import { deltaIsHeadline, formatDifference, formatValue, mdeText } from '../growth-view';

/**
 * Раздел «Рост / Изменения» (этап 11, раздел 21): дельта не становится
 * заголовком при INSUFFICIENT_DATA, FACT / INTERPRETATION / RECOMMENDATION и
 * дисклеймер о причинности всегда на экране, MDE объяснён словами, форма
 * отправляет только одобренные поля и московское время.
 */

vi.mock('../../../api/analytics', () => ({
  growthApi: { create: vi.fn() },
}));

const period = (from: string, to: string) => ({ from, to, kind: 'days' as const, preset: null });

function metric(over: Partial<MetricEvaluation> = {}): MetricEvaluation {
  return {
    metric: 'siteLeadRate',
    label: 'Конверсия визитов в заявку',
    scope: 'site',
    kind: 'ratio',
    unit: 'percent',
    role: 'primary',
    scopeCompatibility: 'valid',
    before: { numerator: 4, denominator: 118, value: 3.39, sample: 118 },
    after: { numerator: 6, denominator: 125, value: 4.8, sample: 125 },
    comparability: { comparable: true, codes: [], measuredFrom: { before: '2026-09-17', after: '2026-09-25' }, cutoversInside: [], note: null },
    maturity: { status: 'MATURE', class: 'immediate', policyDays: 0, maturityUntil: '2026-10-01', observationCutoff: '2026-10-02', policySource: 'empirical', note: null },
    statistics: {
      method: 'fisher_exact_two_sided',
      absoluteDifference: 1.41,
      relativeDifference: 41.6,
      confidenceInterval: { low: -3.6, high: 6.5, level: 0.95 },
      relativeConfidenceInterval: null,
      pValue: 0.75,
      mde: { absolute: 6.5, relative: 191 },
      requiredSample: { perWindow: 12000, targetRelativeEffect: 0.2 },
      assumptions: { alpha: 0.05, power: 0.8, twoSided: true },
      note: null,
    },
    verdict: 'INSUFFICIENT_DATA',
    flags: ['LOW_SAMPLE', 'EXCLUDED_CUTOVER_DAY'],
    ...over,
  };
}

function evaluation(over: Partial<GrowthEvaluation> = {}): GrowthEvaluation {
  const primary = metric();
  return {
    changeId: 'chg-1',
    version: 1,
    evaluatedAt: '2026-10-03T08:00:00.000Z',
    trigger: 'manual',
    metricVersion: 'growth-metrics-v1',
    evidenceType: 'OBSERVATIONAL_BEFORE_AFTER',
    causality: 'NOT_ESTABLISHED',
    abCapability: 'NO_VARIANT_ASSIGNMENT',
    windows: { cutoverDay: '2026-09-24', cutoverDayExcluded: true, before: period('2026-09-17', '2026-09-23'), after: period('2026-09-25', '2026-10-01'), days: 7, observationCutoff: '2026-10-02', weekdayMix: { before: [1, 1, 1, 1, 1, 1, 1], after: [1, 1, 1, 1, 1, 1, 1] }, flags: ['EXCLUDED_CUTOVER_DAY'] },
    primaryMetric: 'siteLeadRate',
    expectedDirection: 'INCREASE',
    primary,
    secondary: [],
    context: [metric({ metric: 'crmLeads', label: 'Заявки CRM', kind: 'count', unit: 'orders', scope: 'crm', role: 'context', scopeCompatibility: 'context_only', verdict: 'INSUFFICIENT_DATA', before: { numerator: 40, denominator: 7, value: 40, sample: 40 }, after: { numerator: 44, denominator: 7, value: 44, sample: 44 } })],
    segments: [
      { dimension: 'device', value: 'mobile', metric: 'siteLeadRate', before: { numerator: 0, denominator: 52, value: 0, sample: 52 }, after: { numerator: 1, denominator: 60, value: 1.67, sample: 60 }, statistics: primary.statistics, verdict: 'INSUFFICIENT_DATA', flags: ['LOW_SAMPLE'], role: 'exploratory' },
      { dimension: 'utm', value: 'yandex', metric: 'siteLeadRate', before: { numerator: null, denominator: null, value: null, sample: 0 }, after: { numerator: null, denominator: null, value: null, sample: 0 }, statistics: null, verdict: 'INCOMPARABLE', flags: ['UNSUPPORTED_SEGMENT'], role: 'audience' },
    ],
    periodUsers: { before: null, after: null },
    maturityPolicy: { leadToAccepted: { sample: 3, medianDays: 0, p75Days: 1, p90Days: 2, sufficient: false }, acceptedToPaid: { sample: 3, medianDays: 2, p75Days: 5, p90Days: 9, sufficient: false }, daysByClass: { immediate: 0, accepted: 7, paid: 14 }, source: { immediate: 'empirical', accepted: 'default', paid: 'default' } },
    confounders: [{ code: 'SOURCE_MIX_SHIFT', severity: 'ATTENTION', fact: 'Источники: доля «organic» 70 % → 40 % визитов', shares: [{ key: 'organic', before: 70, after: 40 }] }],
    dataQuality: { freshness: { lastMetrikaSyncAt: '2026-10-03T07:31:00.000Z', metrikaDataAgeSeconds: 1800, status: 'FRESH', thresholdSeconds: 7200 }, flags: ['EXCLUDED_CUTOVER_DAY', 'LOW_SAMPLE', 'UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW', 'MATURITY_HISTORY_INSUFFICIENT'], lastSyncRunId: 'run-1', clientIdCoverageAccepted: { before: 8, after: 9 } },
    verdict: 'INSUFFICIENT_DATA',
    maturity: 'MATURE',
    FACT: '«Конверсия визитов в заявку»: до 3,39 % (4 из 118), после 4,8 % (6 из 125); разница +1,41 п.п. (+41,6 %).',
    INTERPRETATION: 'Данных недостаточно, чтобы отличить изменение от обычных колебаний. При текущем объёме обнаружим только эффект от ±191 % относительно базы.',
    RECOMMENDATION: 'Продолжить наблюдение и повторить оценку с более длинным окном.',
    disclaimer: 'Наблюдательное сравнение «до / после»: совпадение по времени не доказывает, что изменение вызвало результат.',
    ...over,
  };
}

const status: GrowthStatus = {
  enabled: true,
  metricVersion: 'growth-metrics-v1',
  abCapability: 'NO_VARIANT_ASSIGNMENT',
  evidenceTypes: ['OBSERVATIONAL_BEFORE_AFTER'],
  metrics: [
    { key: 'siteLeadRate', label: 'Конверсия визитов в заявку', scope: 'site', kind: 'ratio', unit: 'percent', maturity: 'immediate', polarity: 'higher-good', availableFrom: '2026-09-13', definitionCutovers: ['2026-09-13'], primaryFor: ['SITE', 'MARKETING'], source: '', description: '' },
    { key: 'crmLeads', label: 'Заявки CRM', scope: 'crm', kind: 'count', unit: 'orders', maturity: 'immediate', polarity: 'higher-good', availableFrom: null, definitionCutovers: [], primaryFor: ['CRM'], source: '', description: '' },
  ],
  audienceDimensions: ['device', 'source', 'utm', 'landing'],
  changeTypes: ['SITE', 'CRM', 'MARKETING', 'PRICING', 'OPERATIONS', 'ANALYTICS', 'OTHER'],
  statuses: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
  defaults: { alpha: 0.05, power: 0.8, targetRelativeEffect: 0.2, minSampleVisits: 30, minEvents: 5, evaluationDaysOptions: [7, 14, 21, 28], matchedCoverageMinPct: 50, mixShiftPointsAttention: 15 },
  maturityPolicy: { leadToAccepted: { sample: 0, medianDays: null, p75Days: null, p90Days: null, sufficient: false }, acceptedToPaid: { sample: 0, medianDays: null, p75Days: null, p90Days: null, sufficient: false }, daysByClass: { immediate: 0, accepted: 7, paid: 14 }, source: { immediate: 'empirical', accepted: 'default', paid: 'default' } },
  counts: { DRAFT: 0, ACTIVE: 1, COMPLETED: 0, CANCELLED: 0 },
};

describe('growth-view', () => {
  it('дельта — заголовок только при вердикте о разнице; форматы долей, денег и счётчиков', () => {
    expect(deltaIsHeadline('INSUFFICIENT_DATA')).toBe(false);
    expect(deltaIsHeadline('IMMATURE')).toBe(false);
    expect(deltaIsHeadline('POSITIVE_SIGNAL')).toBe(true);
    expect(formatValue({ kind: 'ratio', unit: 'percent' }, { numerator: 6, denominator: 125, value: 4.8, sample: 125 })).toBe('4,8 %');
    expect(formatValue({ kind: 'sum', unit: 'rub' }, { numerator: 1, denominator: 1, value: 12345.6, sample: 1 }).replace(/\s/g, ' ')).toBe('12 346 ₽');
    expect(formatValue({ kind: 'count', unit: 'visits' }, { numerator: 1, denominator: 7, value: null, sample: 0 })).toBe('—');
    expect(formatDifference({ kind: 'ratio', unit: 'percent' }, 1.41, 41.6)).toBe('+1,41 п.п. (+41,6 %)');
    expect(formatDifference({ kind: 'count', unit: 'visits' }, -12, -10)).toBe('-12 (-10 %)');
    expect(mdeText(metric())!.replace(/\s/g, ' ')).toBe('При текущем объёме заметим только эффект от ±6,5 п.п. (±191 % от базы); чтобы заметить 20 %, нужно ≈ 12 000 визитов на окно.');
  });
});

describe('EvaluationView', () => {
  it('INSUFFICIENT_DATA: +41,6 % не подаётся как успех, FACT / интерпретация / рекомендация и дисклеймер на экране, MDE объяснён', () => {
    render(<EvaluationView evaluation={evaluation()} />);
    expect(screen.getByTestId('primary-result')).toHaveTextContent('Данных недостаточно');
    const delta = screen.getByTestId('primary-delta');
    expect(delta).toHaveTextContent('+1,41 п.п. (+41,6 %)');
    expect(delta.className).toContain('opacity-60');
    expect(screen.getByTestId('primary-result')).toHaveTextContent('не является выводом');
    expect(screen.getByTestId('fact')).toHaveTextContent('до 3,39 % (4 из 118)');
    expect(screen.getByTestId('interpretation')).toHaveTextContent('Данных недостаточно');
    expect(screen.getByTestId('recommendation')).toHaveTextContent('Продолжить наблюдение');
    expect(screen.getByTestId('growth-disclaimer')).toHaveTextContent('не доказывает');
    expect(screen.getByTestId('mde-text')).toHaveTextContent('нужно ≈ 12 000 визитов на окно');
    expect(screen.getByText(/95 % ДИ разницы: -3,6 … \+6,5 п.п.; p = 0,75/)).toBeInTheDocument();
    // окна, исключённый день, оговорки, контекст, сегменты
    expect(screen.getByText(/день изменения 24\.09\.2026 исключён/)).toBeInTheDocument();
    expect(screen.getByTestId('confounder-SOURCE_MIX_SHIFT')).toHaveTextContent('organic: 70 % → 40 %');
    expect(screen.getByTestId('metric-row-crmLeads')).toHaveTextContent('контекст');
    expect(screen.getByTestId('segment-utm-yandex')).toHaveTextContent('сегмент не поддерживается');
    expect(screen.getByTestId('segment-device-mobile')).toHaveTextContent('Телефон');
    // уникальные не суммируются
    expect(screen.getByText(/сумма дневных не подставляется/)).toBeInTheDocument();
  });

  it('POSITIVE_SIGNAL: дельта — заголовок, вердикт «в нужную сторону», дисклеймер остаётся', () => {
    const e = evaluation({ verdict: 'POSITIVE_SIGNAL', primary: metric({ verdict: 'POSITIVE_SIGNAL', statistics: { ...metric().statistics!, confidenceInterval: { low: 0.4, high: 6.1, level: 0.95 }, pValue: 0.012 } }), INTERPRETATION: 'Различие больше обычных колебаний. Это наблюдение, а не доказательство.' });
    render(<EvaluationView evaluation={e} />);
    expect(screen.getByTestId('verdict-POSITIVE_SIGNAL')).toBeInTheDocument();
    expect(screen.getByTestId('primary-delta').className).toContain('font-bold');
    expect(screen.getByTestId('growth-disclaimer')).toBeInTheDocument();
    expect(screen.getByText(/p = 0,012/)).toBeInTheDocument();
  });

  it('INCOMPARABLE и IMMATURE: причина показана, дельта приглушена', () => {
    const inc = evaluation({ verdict: 'INCOMPARABLE', primary: metric({ verdict: 'INCOMPARABLE', comparability: { comparable: false, codes: ['MEASUREMENT_DEFINITION_CHANGED', 'INCOMPARABLE_WINDOWS'], measuredFrom: { before: '2026-09-05', after: '2026-09-13' }, cutoversInside: ['2026-09-13'], note: 'Определение метрики изменилось 13.09.2026 — окна считают разное.' } }) });
    const { unmount } = render(<EvaluationView evaluation={inc} />);
    expect(screen.getByTestId('primary-result')).toHaveTextContent('Окна несопоставимы');
    expect(screen.getByTestId('primary-result')).toHaveTextContent('Определение метрики изменилось 13.09.2026');
    unmount();
    const im = evaluation({ verdict: 'IMMATURE', maturity: 'IMMATURE', primary: metric({ verdict: 'IMMATURE', maturity: { status: 'IMMATURE', class: 'paid', policyDays: 14, maturityUntil: '2026-10-15', observationCutoff: '2026-10-02', policySource: 'default', note: 'Исход ещё не созрел: заказы дозревают до 15.10.2026.' } }) });
    render(<EvaluationView evaluation={im} />);
    expect(screen.getByTestId('primary-result')).toHaveTextContent('Исход ещё созревает');
    expect(screen.getByTestId('primary-result')).toHaveTextContent('дозревают до 15.10.2026');
  });
});

describe('ChangeForm', () => {
  it('отправляет только одобренные поля, московское время переводится в ISO, метрики другой области подписаны как контекст', async () => {
    const { growthApi } = await import('../../../api/analytics');
    const create = growthApi.create as unknown as ReturnType<typeof vi.fn>;
    create.mockResolvedValue({ id: 'chg-9' });
    const onSaved = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChangeForm status={status} onSaved={onSaved} onCancel={() => undefined} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: 'Новая форма' } });
    fireEvent.change(screen.getByLabelText(/Вышло в production/), { target: { value: '2026-09-24T15:00' } });
    fireEvent.change(screen.getByLabelText(/Гипотеза/), { target: { value: 'форма короче — заявок больше' } });
    expect(screen.getByRole('group', { name: /Только контекст/ })).toHaveTextContent('Заявки CRM');
    fireEvent.submit(screen.getByRole('form', { name: 'Новое изменение' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const payload = create.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: 'Новая форма', changeType: 'SITE', surface: 'site:form', primaryMetric: 'siteLeadRate', expectedDirection: 'INCREASE', startedAt: '2026-09-24T12:00:00.000Z', hypothesis: 'форма короче — заявок больше', audienceDefinition: null });
    expect(Object.keys(payload).sort()).toEqual(['audienceDefinition', 'changeType', 'description', 'endedAt', 'evaluationDays', 'expectedDirection', 'hypothesis', 'maturityDays', 'name', 'primaryMetric', 'secondaryMetrics', 'startedAt', 'status', 'surface']);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'chg-9' }));
  });
});
