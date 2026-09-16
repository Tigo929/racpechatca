import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { InsightRecord, InsightsFeed, InsightsStatus } from '../../../types/insights';
import { InsightCard, InsightsTab } from '../insights-sections';

/**
 * Раздел «Инсайты» (этап 12, раздел 39 K): K1 факт и гипотеза визуально различимы
 * и по-разному размечены; K2 пустое состояние — «нет сигналов, требующих внимания»,
 * а не «всё хорошо»; K3 загрузка / ошибка / выключен; K5 фильтры; K6 «принять к
 * сведению» меняет статус; дисклеймер о причинности всегда на экране.
 */

const api = vi.hoisted(() => ({
  status: vi.fn(),
  feed: vi.fn(),
  acknowledge: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('../../../api/analytics', () => ({ insightsApi: api }));

const period = (from: string, to: string) => ({ from, to, kind: 'days' as const, preset: null });

function status(over: Partial<InsightsStatus> = {}): InsightsStatus {
  return {
    enabled: true,
    engineVersion: 'insights-v1',
    causality: 'NOT_ESTABLISHED',
    categories: ['SITE_CONVERSION_CHANGE', 'DATA_QUALITY', 'CHANGE_EVALUATION'],
    severities: ['INFO', 'ATTENTION', 'CRITICAL'],
    statuses: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPERSEDED'],
    detectors: [{ id: 'site.leadRate', category: 'SITE_CONVERSION_CHANGE', refresh: 'daily', source: 'STAGE12_DETECTOR' }],
    thresholds: { rollingWindowDays: 7 },
    counts: { OPEN: 1, ACKNOWLEDGED: 0, RESOLVED: 2, SUPERSEDED: 0 },
    lastRun: null,
    boundaries: { metrikaHistorySince: '2026-08-13', leadSemanticsCutover: '2026-09-12T10:19:00.000Z', incident: { from: '2026-09-14T15:20:00.000Z', to: '2026-09-15T17:32:00.000Z', label: 'инцидент' } },
    ...over,
  };
}

function insight(over: Partial<InsightRecord> = {}): InsightRecord {
  return {
    id: 'i1',
    fingerprint: 'abc',
    episode: 1,
    category: 'SITE_CONVERSION_CHANGE',
    severity: 'ATTENTION',
    status: 'OPEN',
    scope: 'site',
    source: 'STAGE12_DETECTOR',
    detectorId: 'site.leadRate',
    metricKey: 'siteLeadRate',
    entityKey: null,
    periodStart: '2026-09-26',
    periodEnd: '2026-10-02',
    baselineStart: '2026-09-19',
    baselineEnd: '2026-09-25',
    title: 'Конверсия визитов в заявку снизилась: 8,0 % → 1,0 %',
    fact: { text: 'Конверсия визитов в заявку: за 26.09–02.10 1,0 % (5 из 500), в предыдущем окне 8,0 % (40 из 500); разница −7,0 п.п.; p = 0,000.', metric: 'siteLeadRate', unit: 'percent', current: 1, baseline: 8, absoluteDelta: -7, relativeDelta: -87.5, sample: { current: 500, baseline: 500, minimum: 30 }, period: period('2026-09-26', '2026-10-02'), baselinePeriod: period('2026-09-19', '2026-09-25') },
    hypothesis: { status: 'SUPPORTED_BY_CONCURRENT_FACTS', text: 'Гипотеза: рост ошибок формы совпал по времени со снижением завершения формы — техническое состояние формы стоит проверить. Причинность не установлена.', supportingFacts: ['Доля визитов с ошибкой формы: 2,5 % → 25,0 %'] },
    recommendation: { text: 'Технически проверить форму и логи приложения за период.', kind: 'CHECK_TECHNICAL' },
    evidence: { statisticalStrength: 'SIGNAL', businessMateriality: 'MATERIAL', metricEvaluation: null, verdict: 'NEGATIVE_SIGNAL', context: [{ metric: 'visits', before: 500, after: 500, unit: 'visits' }], confounders: [], refs: [], rule: { detectorId: 'site.leadRate', thresholds: {} } },
    limitations: ['LOW_SAMPLE', 'INCIDENT_BOUNDARY'],
    quality: { freshness: 'FRESH', flags: [], notes: ['Сигнал — наблюдение по данным, а не установленная причина.'] },
    causality: 'NOT_ESTABLISHED',
    link: { tab: 'behavior' },
    firstDetectedAt: '2026-10-03T05:17:00.000Z',
    lastDetectedAt: '2026-10-03T09:17:00.000Z',
    resolvedAt: null,
    resolvedReason: null,
    acknowledgedAt: null,
    latestVersion: 2,
    createdAt: '2026-10-03T05:17:00.000Z',
    updatedAt: '2026-10-03T09:17:00.000Z',
    ...over,
  };
}

function feed(items: InsightRecord[]): InsightsFeed {
  return {
    items,
    total: items.length,
    suppressedSummary: { LOW_SAMPLE: 4, INSUFFICIENT_DATA: 3, IMMATURE: 4, INCOMPARABLE_PERIODS: 0, PARTIAL_BEHAVIOR_PERIOD: 1, METRIC_NOT_AVAILABLE: 0, MEASUREMENT_DEFINITION_CHANGED: 0, WEEKDAY_MIX_MISMATCH: 0, MATCHED_COVERAGE_LOW: 0, COGS_INCOMPLETE: 0, STALE_DATA: 0, DUPLICATE: 0, COOLDOWN: 0, NO_MATERIAL_CHANGE: 6 },
    lastRun: { id: 'r1', kind: 'daily', status: 'SUCCESS', startedAt: '2026-10-03T05:17:00.000Z', finishedAt: '2026-10-03T05:17:04.000Z', observationCutoff: '2026-10-02', syncRunId: 's1', detectors: 18, detected: 1, created: 1, versioned: 0, unchanged: 0, resolved: 0, reopened: 0, suppressed: [], errors: [], durationMs: 4000, queryCount: null },
    generatedAt: '2026-10-03T09:20:00.000Z',
  };
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <InsightsTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InsightCard', () => {
  it('K1: факт и гипотеза — разные блоки, гипотеза помечена и не выглядит фактом; ограничения и дисклеймер на месте', () => {
    render(
      <MemoryRouter>
        <InsightCard insight={insight()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('insight-fact')).toHaveTextContent('1,0 % (5 из 500)');
    const h = screen.getByTestId('insight-hypothesis');
    expect(h).toHaveAttribute('data-hypothesis-status', 'SUPPORTED_BY_CONCURRENT_FACTS');
    expect(within(h).getByText(/Гипотеза — не факт/i)).toBeInTheDocument();
    expect(within(h).getByText(/^Гипотеза: .*Причинность не установлена\.$/)).toHaveClass('italic');
    expect(screen.getByTestId('insight-fact')).not.toHaveClass('italic');
    expect(screen.getByTestId('insight-recommendation')).toHaveTextContent('Технически проверить форму');
    expect(screen.getByTestId('insight-limitations')).toHaveTextContent('окно пересекает инцидент 14–15.09');
    expect(screen.getByTestId('severity-ATTENTION')).toHaveTextContent('Внимание');
    expect(screen.getByTestId('insight-link')).toHaveAttribute('href', '/crm/analytics?tab=behavior');
  });

  it('FIX_01: карточка качества данных (scope data) подписана как качество измерения, а не поведение клиентов', () => {
    render(
      <MemoryRouter>
        <InsightCard insight={insight({ category: 'DATA_QUALITY', scope: 'data', severity: 'INFO', title: 'Воронка «Футболки»: 2 шага не измеряются — анализ отвала ограничен', fact: { ...insight().fact, text: 'Не измеряется шаг «Отправили форму»; значение — not_measured, не 0.', current: null, baseline: null }, hypothesis: { status: 'NO_SUPPORTED_HYPOTHESIS', text: 'Гипотезы нет: отсутствие измерения — известный факт настройки счётчика, а не поведение клиентов.', supportingFacts: [] }, limitations: ['NOT_MEASURED_STEPS'] })} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('hypothesis-label')).toHaveTextContent('Качество измерения — не поведение клиентов');
    expect(screen.getByTestId('data-scope-chip')).toHaveTextContent('качество данных, не поведение');
    expect(screen.getByTestId('insight-fact')).toHaveTextContent('not_measured, не 0');
    expect(screen.getByTestId('insight-limitations')).toHaveTextContent('часть шагов не измеряется');
    expect(screen.getByTestId('severity-INFO')).toBeInTheDocument();
  });

  it('гипотезы нет — блок помечен NO_SUPPORTED_HYPOTHESIS с текстом «Гипотезы нет»', () => {
    render(
      <MemoryRouter>
        <InsightCard insight={insight({ hypothesis: { status: 'NO_SUPPORTED_HYPOTHESIS', text: 'Гипотезы нет: сопутствующих фактов не найдено.', supportingFacts: [] } })} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('insight-hypothesis')).toHaveAttribute('data-hypothesis-status', 'NO_SUPPORTED_HYPOTHESIS');
    expect(screen.getByTestId('insight-hypothesis')).toHaveTextContent('Гипотезы нет');
  });
});

describe('InsightsTab', () => {
  beforeEach(() => {
    api.status.mockReset();
    api.feed.mockReset();
    api.acknowledge.mockReset();
  });

  it('K3: загрузка → лента с карточкой и дисклеймером; K6 «принять к сведению» вызывает API и статус меняется', async () => {
    api.status.mockResolvedValue(status());
    api.feed.mockResolvedValueOnce(feed([insight()])).mockResolvedValue(feed([insight({ status: 'ACKNOWLEDGED', acknowledgedAt: '2026-10-03T09:30:00.000Z' })]));
    api.acknowledge.mockResolvedValue(insight({ status: 'ACKNOWLEDGED' }));
    renderTab();
    expect(screen.getByRole('status')).toHaveTextContent(/Загрузка/);
    await waitFor(() => expect(screen.getByTestId('insight-title')).toHaveTextContent('Конверсия визитов в заявку снизилась'));
    expect(screen.getByTestId('insights-disclaimer')).toHaveTextContent(/причинность не установлена/);
    expect(screen.getByTestId('insights-disclaimer')).toHaveTextContent(/Отсутствие сигналов не означает/);
    expect(screen.getByTestId('suppressed-summary')).toHaveTextContent('Правил без вывода в последнем запуске: 18');
    fireEvent.click(screen.getByTestId('acknowledge'));
    await waitFor(() => expect(api.acknowledge).toHaveBeenCalledWith('i1'));
    await waitFor(() => expect(screen.getByTestId('insight-status')).toHaveTextContent('Принят к сведению'));
  });

  it('K2: пустая лента — «Сейчас нет сигналов, требующих внимания», без слов «всё хорошо»', async () => {
    api.status.mockResolvedValue(status({ counts: { OPEN: 0, ACKNOWLEDGED: 0, RESOLVED: 0, SUPERSEDED: 0 } }));
    api.feed.mockResolvedValue(feed([]));
    renderTab();
    await waitFor(() => expect(screen.getByText('Сейчас нет сигналов, требующих внимания')).toBeInTheDocument());
    expect(screen.queryByText(/всё хорошо/i)).toBeNull();
  });

  it('K3: раздел выключен → карточка «выключен», лента не запрашивается; ошибка статуса → блок ошибки', async () => {
    api.status.mockResolvedValue(status({ enabled: false }));
    renderTab();
    await waitFor(() => expect(screen.getByText('Раздел «Инсайты» выключен')).toBeInTheDocument());
    expect(api.feed).not.toHaveBeenCalled();
    api.status.mockRejectedValue(new Error('Внутренняя ошибка сервера'));
    renderTab();
    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Внутренняя ошибка сервера'));
  });

  it('K5: фильтры уходят в API как параметры запроса', async () => {
    api.status.mockResolvedValue(status());
    api.feed.mockResolvedValue(feed([insight()]));
    renderTab();
    await waitFor(() => expect(api.feed).toHaveBeenCalledWith({ status: 'active' }));
    fireEvent.change(screen.getByLabelText('Уровень'), { target: { value: 'CRITICAL' } });
    await waitFor(() => expect(api.feed).toHaveBeenCalledWith({ status: 'active', severity: 'CRITICAL' }));
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'all' } });
    await waitFor(() => expect(api.feed).toHaveBeenCalledWith({ status: 'all', severity: 'CRITICAL' }));
  });
});
