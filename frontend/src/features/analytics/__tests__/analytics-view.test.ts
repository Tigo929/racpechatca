import {
  attentionCards,
  coverageIsLow,
  deltaTone,
  formatAgo,
  formatCount,
  formatDelta,
  formatMoney,
  formatPercent,
  formatPeriod,
  matchingInsufficient,
  overviewWarnings,
} from '../analytics-view';
import { makeOverview } from './fixtures';

/**
 * Представление метрик (этап 09, разделы 24–27, 36–38, 45–47): форматы ru-RU,
 * знак изменения с учётом полярности, предупреждения и «Требует внимания» —
 * правила, а не формулы.
 */
describe('форматы', () => {
  it('деньги: копейки только когда они есть', () => {
    expect(formatMoney(241100)).toBe('241 100 ₽');
    expect(formatMoney(1972.71)).toBe('1 972,71 ₽');
    expect(formatMoney(0)).toBe('0 ₽');
    expect(formatMoney(null)).toBe('—');
  });

  it('проценты — не больше двух знаков; счётчики — целые с разрядами', () => {
    expect(formatPercent(57.4512)).toBe('57,45 %');
    expect(formatPercent(100)).toBe('100 %');
    expect(formatPercent(null)).toBe('—');
    expect(formatCount(1234)).toBe('1 234');
    expect(formatCount(89.7)).toBe('90');
  });

  it('период и давность по-русски', () => {
    expect(formatPeriod('2026-09-06', '2026-09-12')).toBe('6–12 сентября 2026');
    expect(formatPeriod('2026-08-14', '2026-09-12')).toBe('14 августа — 12 сентября 2026');
    expect(formatPeriod('2026-09-12', '2026-09-12')).toBe('12 сентября 2026');
    expect(formatAgo(720)).toBe('12 минут назад');
    expect(formatAgo(61 * 60)).toBe('1 час назад');
    expect(formatAgo(null)).toBe('нет данных');
  });
});

describe('изменение к предыдущему периоду', () => {
  it('+7 (+20 %) с полярностью: рост заказов — хорошо, рост отмен — плохо', () => {
    const cmp = { current: 42, previous: 35, delta: 7, deltaPct: 20, changeKind: 'UP' as const };
    expect(formatDelta(cmp, 'count')).toBe('+7 (+20 %)');
    expect(deltaTone(cmp, 'higher-good')).toBe('positive');
    expect(deltaTone(cmp, 'lower-good')).toBe('negative');
    expect(deltaTone(cmp, 'neutral')).toBe('neutral');
  });

  it('NEW / GONE / NA / FLAT — словами, без деления на ноль', () => {
    expect(formatDelta({ current: 5, previous: 0, delta: 5, deltaPct: null, changeKind: 'NEW' }, 'count')).toBe('новое (+5)');
    expect(formatDelta({ current: 0, previous: 8, delta: -8, deltaPct: -100, changeKind: 'GONE' }, 'count')).toBe('−8 (−100 %)');
    expect(formatDelta({ current: null, previous: 10, delta: null, deltaPct: null, changeKind: 'NA' }, 'count')).toBe('—');
    expect(formatDelta({ current: 3, previous: 3, delta: 0, deltaPct: 0, changeKind: 'FLAT' }, 'count')).toBe('без изменений');
  });
});

describe('предупреждения', () => {
  it('legacy-период, старт счётчика, нет снимка, покрытие < 50 %, неполное сравнение', () => {
    const o = makeOverview({
      dataQuality: { notes: ['INCOMPLETE_LEGACY_SITE_LEADS', 'NO_PERIOD_SNAPSHOT', 'PERIOD_BEFORE_COUNTER'], clientIdCoverageAccepted: 7.69 },
      previousPeriod: { from: '2026-07-15', to: '2026-08-13', kind: 'days', preset: null },
    });
    const codes = overviewWarnings(o).map((w) => w.code);
    expect(codes).toEqual(['legacy', 'snapshot', 'counter', 'coverage', 'comparison-partial']);
    expect(coverageIsLow(o)).toBe(true);
  });

  it('полные данные — предупреждений нет', () => {
    const o = makeOverview({
      dataQuality: { notes: [], clientIdCoverageAccepted: 80, eligibleAccepted: 12, siteLeadsLegacy: false },
      previousPeriod: { from: '2026-09-06', to: '2026-09-12', kind: 'days', preset: null },
    });
    expect(overviewWarnings(o)).toEqual([]);
    expect(coverageIsLow(o)).toBe(false);
  });

  it('заявки сайта есть, сопоставлять нечего → «Недостаточно сопоставленных заказов», а не 0 %', () => {
    const o = makeOverview({ siteFunnel: { siteLeads: 2, matchedAccepted: 0 }, dataQuality: { eligibleAccepted: 0 } });
    expect(matchingInsufficient(o)).toBe(true);
    expect(matchingInsufficient(makeOverview({ siteFunnel: { siteLeads: 2 }, dataQuality: { eligibleAccepted: 3 } }))).toBe(false);
  });
});

describe('«Требует внимания»', () => {
  it('прибыль −20 % и хуже, устаревшие данные, неполная себестоимость, низкое покрытие', () => {
    const o = makeOverview({
      comparison: { netProfit: { current: 80, previous: 100, delta: -20, deltaPct: -20, changeKind: 'DOWN' } },
      dataQuality: { freshness: { status: 'STALE', metrikaDataAgeSeconds: 3 * 3600, lastMetrikaSyncAt: null, thresholdSeconds: 7200 }, clientIdCoverageAccepted: 7.69 },
      financials: { contract: { orders: 130, cogsReliableOrders: 124 } },
    });
    expect(attentionCards(o).map((c) => c.code)).toEqual(['profit-drop', 'stale', 'cogs-incomplete', 'coverage-low']);
  });

  it('падение прибыли на 10 % карточку не даёт; конверсия сайта не сигналит, пока сопоставлять нечего', () => {
    const o = makeOverview({
      comparison: {
        netProfit: { current: 90, previous: 100, delta: -10, deltaPct: -10, changeKind: 'DOWN' },
        siteLeadConversion: { current: 1, previous: 2, delta: -1, deltaPct: -50, changeKind: 'DOWN' },
      },
      siteFunnel: { siteLeads: 3 },
      dataQuality: { eligibleAccepted: 0, clientIdCoverageAccepted: 90, freshness: { status: 'FRESH', metrikaDataAgeSeconds: 60, lastMetrikaSyncAt: null, thresholdSeconds: 7200 } },
      financials: { contract: { orders: 10, cogsReliableOrders: 10 } },
    });
    expect(attentionCards(o).map((c) => c.code)).toEqual([]);
  });
});
