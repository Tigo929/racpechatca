import { render, screen } from '@testing-library/react';
import { CrmFunnel, DataQualityPanel, SiteFunnel } from '../sections';
import { KpiCard, StateBlock } from '../ui';
import { TrendChart } from '../TrendChart';
import { makeOverview } from './fixtures';

/**
 * Компоненты дашборда (этап 09, разделы 35, 45–47): карточки KPI с NEW/GONE/NA,
 * посетители из снимка (131, не 149), «Недостаточно сопоставленных заказов»
 * вместо 0 %, статусы свежести, состояния загрузки/пустоты/ошибки.
 */
describe('KpiCard', () => {
  it('воронка CRM показывает одну когорту, не смешивает её с событиями периода', () => {
    render(<CrmFunnel o={makeOverview()} />);
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });
  it('рост принятых заказов — положительный знак «+2 (+5 %)»', () => {
    render(<KpiCard metricKey="acceptedOrders" value={42} format="count" cmp={{ current: 42, previous: 40, delta: 2, deltaPct: 5, changeKind: 'UP' }} />);
    expect(screen.getByTestId('kpi-acceptedOrders')).toHaveTextContent('42');
    expect(screen.getByText('+2 (+5 %)')).toBeInTheDocument();
    expect(screen.getByText('Принятые заказы')).toBeInTheDocument();
  });

  it('NEW при нулевой базе, GONE при уходе в ноль, NA без сравнения', () => {
    const { rerender } = render(<KpiCard metricKey="siteLeads" value={2} format="count" cmp={{ current: 2, previous: 0, delta: 2, deltaPct: null, changeKind: 'NEW' }} />);
    expect(screen.getByText('новое (+2)')).toBeInTheDocument();
    rerender(<KpiCard metricKey="paidOrders" value={0} format="count" cmp={{ current: 0, previous: 8, delta: -8, deltaPct: -100, changeKind: 'GONE' }} />);
    expect(screen.getByText('−8 (−100 %)')).toBeInTheDocument();
    rerender(<KpiCard metricKey="periodUsers" value={131} format="count" cmp={{ current: 131, previous: null, delta: null, deltaPct: null, changeKind: 'NA' }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('снимок: показывает 131 посетителя, а не сумму дневных 149', () => {
    const o = makeOverview();
    render(<KpiCard metricKey="periodUsers" value={o.traffic.periodUsers} format="count" note={`сумма по дням: ${o.traffic.sumDailyUsers} (не уникальные)`} />);
    expect(screen.getByTestId('kpi-periodUsers')).toHaveTextContent('131');
    expect(screen.getByTestId('kpi-periodUsers')).not.toHaveTextContent('149');
  });

  it('без снимка — прочерк и причина, а не 0 и не сумма', () => {
    render(<KpiCard metricKey="periodUsers" value={null} format="count" unavailable="за этот период не подсчитаны" />);
    expect(screen.getByTestId('kpi-periodUsers')).toHaveTextContent('—');
    expect(screen.getByText('за этот период не подсчитаны')).toBeInTheDocument();
  });

  it('деньги форматируются по ru-RU', () => {
    render(<KpiCard metricKey="realizedRevenue" value={241100} format="money" />);
    expect(screen.getByTestId('kpi-realizedRevenue')).toHaveTextContent('241 100 ₽');
    render(<KpiCard metricKey="paidAov" value={1972.71} format="money" />);
    expect(screen.getByTestId('kpi-paidAov')).toHaveTextContent('1 972,71 ₽');
  });
});

describe('SiteFunnel', () => {
  it('заявки есть, сопоставлять нечего: «Недостаточно сопоставленных заказов», без «0 %»', () => {
    render(<SiteFunnel o={makeOverview({ siteFunnel: { siteLeads: 2, matchedAccepted: 0, siteLeadToAccepted: 0 }, dataQuality: { eligibleAccepted: 0 } })} />);
    expect(screen.getByText('Недостаточно сопоставленных заказов')).toBeInTheDocument();
    expect(screen.queryByText('0 %')).not.toBeInTheDocument();
    expect(screen.getByText(/не единая когорта/)).toBeInTheDocument();
  });

  it('низкое покрытие ClientID — предупреждение о неполной связи, не ошибка', () => {
    render(<SiteFunnel o={makeOverview({ dataQuality: { clientIdCoverageAccepted: 9.52, eligibleAccepted: 3 } })} />);
    expect(screen.getByText('Данные о связи сайта с заказами пока неполные')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DataQualityPanel', () => {
  it('FRESH → «Актуально», STALE → «Есть задержка», NO_DATA → «Нет данных»', () => {
    const { rerender } = render(<DataQualityPanel o={makeOverview()} />);
    expect(screen.getByText('Актуально')).toBeInTheDocument();
    rerender(<DataQualityPanel o={makeOverview({ dataQuality: { freshness: { status: 'STALE', metrikaDataAgeSeconds: 9000, lastMetrikaSyncAt: null, thresholdSeconds: 7200 } } })} />);
    expect(screen.getByText('Есть задержка')).toBeInTheDocument();
    rerender(<DataQualityPanel o={makeOverview({ dataQuality: { freshness: { status: 'NO_DATA', metrikaDataAgeSeconds: null, lastMetrikaSyncAt: null, thresholdSeconds: 7200 } } })} />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });

  it('покрытие ClientID и полнота себестоимости — процентами', () => {
    render(<DataQualityPanel o={makeOverview({ financials: { contract: { orders: 130, cogsReliableOrders: 124 } } })} />);
    expect(screen.getByText('9,52 %')).toBeInTheDocument();
    expect(screen.getByText('95,38 %')).toBeInTheDocument();
  });
});

describe('состояния', () => {
  it('loading / empty / error различимы; ошибка не показывает нули', () => {
    const { rerender } = render(<StateBlock kind="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
    rerender(<StateBlock kind="empty" />);
    expect(screen.getByText('За этот период данных нет')).toBeInTheDocument();
    rerender(<StateBlock kind="error" message="Сервер недоступен" onRetry={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Сервер недоступен');
    expect(screen.getByText('Повторить')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('TrendChart', () => {
  it('рисует столбик на каждый день и сумму за период; переключатель показателя доступен', () => {
    const points = ['2026-09-10', '2026-09-11', '2026-09-12'].map((date, i) => ({
      date, visits: 10 * (i + 1), pageviews: 0, siteLeads: 0, matchedAccepted: 0, matchedPaid: 0, crmLeads: 0, acceptedOrders: 1, paidOrders: 0, realizedRevenue: 1000, netProfit: 500, realizedOrders: 1,
    }));
    render(<TrendChart trend={{ period: { from: '2026-09-10', to: '2026-09-12', kind: 'days', preset: null }, points, quality: { completeness: 'complete', notes: [] } }} />);
    const chart = screen.getByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('Визиты по дням, 3 дней');
    expect(chart.querySelectorAll('rect').length).toBe(3);
    expect(screen.getByRole('group', { name: 'Показатель графика' })).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });
});
