import type { TrendPoint } from '../metrics/metrics-contract';
import type {
  Anomaly,
  ForecastBlock,
  FunnelStep,
  MetricRow,
  OriginBlock,
  OriginReconciliation,
  OriginRow,
  PeriodSnapshot,
  QualityItem,
  ReportInput,
  ReportModel,
  Signal,
  WeeklyPoint,
} from './report-contract';

/**
 * Сборка модели отчёта (этап 15). Только производные величины: сравнение
 * периодов, сигналы, воронки, аномалии и ряды для прогноза. Ни одной
 * бизнес-формулы здесь нет — выручка, себестоимость и прибыль приходят
 * готовыми из сервиса метрик и P&L владельца.
 *
 * Два правила, которые нельзя нарушать:
 *   - не выдумывать число там, где его нет: null остаётся null и в отчёте
 *     печатается как «нет данных», а не как ноль;
 *   - не утверждать причину изменения. Отчёт показывает факт и доказательство,
 *     причинно-следственные выводы делает аналитик, которому его отдали.
 */

/** Порог, ниже которого изменение считаем шумом, а не сигналом. */
const STABLE_PCT = 5;

/** Минимум недель истории, при котором вообще допускаем прогноз. */
export const MIN_FORECAST_WEEKS = 6;

function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

function deltaPct(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function metricRow(
  key: string,
  label: string,
  unit: MetricRow['unit'],
  current: number | null,
  previous: number | null,
): MetricRow {
  return {
    key,
    label,
    unit,
    current,
    previous,
    delta: delta(current, previous),
    deltaPct: deltaPct(current, previous),
  };
}

function realized(snapshot: PeriodSnapshot) {
  return snapshot.overview.financials.realized;
}

/** Ключевые метрики периода: то, с чего начинается чтение отчёта. */
export function buildSummary(
  current: PeriodSnapshot,
  previous: PeriodSnapshot,
): MetricRow[] {
  const c = current.overview;
  const p = previous.overview;
  const cr = realized(current);
  const pr = realized(previous);
  return [
    metricRow('visits', 'Визиты', 'count', c.traffic.visits, p.traffic.visits),
    metricRow(
      'users',
      'Посетители (за период)',
      'count',
      c.traffic.periodUsers,
      p.traffic.periodUsers,
    ),
    metricRow(
      'pageviews',
      'Просмотры',
      'count',
      c.traffic.pageviews,
      p.traffic.pageviews,
    ),
    metricRow(
      'siteLeads',
      'Заявки с сайта',
      'count',
      c.siteFunnel.siteLeads,
      p.siteFunnel.siteLeads,
    ),
    metricRow(
      'crmLeads',
      'Заявки в CRM',
      'count',
      c.crmFunnel.events.crmLeads,
      p.crmFunnel.events.crmLeads,
    ),
    metricRow(
      'acceptedOrders',
      'Принятые заказы',
      'count',
      c.orders.acceptedOrders,
      p.orders.acceptedOrders,
    ),
    metricRow(
      'paidOrders',
      'Оплаченные заказы',
      'count',
      c.orders.paidOrders,
      p.orders.paidOrders,
    ),
    metricRow(
      'cancelledOrders',
      'Отменённые заказы',
      'count',
      c.orders.cancelledOrders,
      p.orders.cancelledOrders,
    ),
    metricRow(
      'realizedRevenue',
      'Выручка (реализованная)',
      'rub',
      cr?.realizedRevenue ?? null,
      pr?.realizedRevenue ?? null,
    ),
    metricRow(
      'cogs',
      'Себестоимость',
      'rub',
      cr?.cogs ?? null,
      pr?.cogs ?? null,
    ),
    metricRow(
      'netProfit',
      'Прибыль (методика отчёта владельца)',
      'rub',
      cr?.netProfit ?? null,
      pr?.netProfit ?? null,
    ),
    metricRow(
      'marginPct',
      'Маржа',
      'percent',
      cr?.marginPct ?? null,
      pr?.marginPct ?? null,
    ),
    metricRow(
      'paidAov',
      'Средний чек оплаченного',
      'rub',
      c.orders.paidAov,
      p.orders.paidAov,
    ),
    metricRow(
      'siteLeadConversion',
      'Конверсия визит → заявка',
      'percent',
      c.siteFunnel.siteLeadConversion,
      p.siteFunnel.siteLeadConversion,
    ),
    metricRow(
      'clientIdCoverage',
      'Покрытие ClientID у принятых',
      'percent',
      current.dataQuality.clientIdCoverageAccepted,
      previous.dataQuality.clientIdCoverageAccepted,
    ),
    metricRow(
      'paidWithoutDate',
      'Оплачено без даты оплаты',
      'count',
      c.orders.paidWithoutDate,
      p.orders.paidWithoutDate,
    ),
  ];
}

/**
 * Короткая запись числа для текста сигнала: целое — как есть, дробное — один
 * знак. Иначе в отчёт уезжает «13.043478260869565», что и читать невозможно,
 * и выглядит как чужой идентификатор.
 */
function short(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Значение с единицей измерения: в тексте сигнала «62 361 ₽» понятнее, чем «62361». */
function fmt(unit: MetricRow['unit'], v: number): string {
  if (unit === 'rub') return `${Math.round(v).toLocaleString('ru-RU')} ₽`;
  if (unit === 'percent') return `${v.toFixed(1)} %`;
  return short(v);
}

/** Метрики, у которых рост — это ухудшение. */
const LOWER_IS_BETTER = new Set(['cancelledOrders', 'paidWithoutDate', 'cogs']);

export function buildSignals(rows: MetricRow[]): Signal[] {
  return rows.map((row) => {
    if (row.current === null || row.previous === null) {
      return {
        kind: 'insufficient' as const,
        metric: row.label,
        statement: `${row.label}: сравнение невозможно (нет данных за один из периодов)`,
      };
    }
    const pct = row.deltaPct;
    if (pct === null || Math.abs(pct) < STABLE_PCT) {
      return {
        kind: 'stable' as const,
        metric: row.label,
        statement: `${row.label}: ${fmt(row.unit, row.previous)} → ${fmt(row.unit, row.current)} (изменение в пределах ±${STABLE_PCT} %)`,
      };
    }
    const improved = LOWER_IS_BETTER.has(row.key) ? pct < 0 : pct > 0;
    return {
      kind: improved ? ('positive' as const) : ('negative' as const),
      metric: row.label,
      statement: `${row.label}: ${fmt(row.unit, row.previous)} → ${fmt(row.unit, row.current)} (${pct > 0 ? '+' : ''}${pct.toFixed(1)} %)`,
    };
  });
}

function step(
  name: string,
  count: number | null,
  previousStepCount: number | null,
  previousPeriodCount: number | null,
): FunnelStep {
  const conversion =
    count !== null && previousStepCount !== null && previousStepCount > 0
      ? (count / previousStepCount) * 100
      : null;
  return {
    name,
    count,
    conversionFromPrevious: conversion,
    dropOff:
      count !== null && previousStepCount !== null
        ? previousStepCount - count
        : null,
    previousCount: previousPeriodCount,
  };
}

/** Путь пользователя: визит → заявка → принят → оплачен (сопоставленные). */
export function buildSiteFunnel(
  current: PeriodSnapshot,
  previous: PeriodSnapshot,
): FunnelStep[] {
  const c = current.overview.siteFunnel;
  const p = previous.overview.siteFunnel;
  return [
    step('Визиты', c.visits, null, p.visits),
    step('Заявки с сайта', c.siteLeads, c.visits, p.siteLeads),
    step(
      'Приняты в работу (сопоставлено)',
      c.matchedAccepted,
      c.siteLeads,
      p.matchedAccepted,
    ),
    step(
      'Оплачены (сопоставлено)',
      c.matchedPaid,
      c.matchedAccepted,
      p.matchedPaid,
    ),
  ];
}

/** Путь заказа в CRM: заявка → принят → оплачен, плюс отмены. */
export function buildCrmFunnel(
  current: PeriodSnapshot,
  previous: PeriodSnapshot,
): FunnelStep[] {
  const c = current.overview.crmFunnel.events;
  const p = previous.overview.crmFunnel.events;
  return [
    step('Заявки CRM (LEAD)', c.crmLeads, null, p.crmLeads),
    step('Приняты в работу', c.acceptedOrders, c.crmLeads, p.acceptedOrders),
    step('Оплачены', c.paidOrders, c.acceptedOrders, p.paidOrders),
    step(
      'Реализовано (выручка признана)',
      c.realizedOrders,
      c.paidOrders,
      p.realizedOrders,
    ),
    step('Отменены', c.cancelledOrders, null, p.cancelledOrders),
  ];
}

export function biggestDropOff(steps: FunnelStep[]): FunnelStep | null {
  const candidates = steps.filter(
    (s) =>
      s.dropOff !== null && s.dropOff > 0 && s.conversionFromPrevious !== null,
  );
  if (!candidates.length) return null;
  return candidates.reduce((a, b) =>
    (a.dropOff ?? 0) >= (b.dropOff ?? 0) ? a : b,
  );
}

/** Недельные агрегаты дневного ряда — вход для прогноза. */
export function buildWeekly(daily: TrendPoint[]): WeeklyPoint[] {
  const weeks = new Map<string, WeeklyPoint>();
  for (const point of daily) {
    const monday = weekStart(point.date);
    const w = weeks.get(monday) ?? {
      week: monday,
      visits: 0,
      leads: 0,
      accepted: 0,
      paid: 0,
      revenue: 0,
      cogs: null,
      profit: 0,
      marginPct: null,
    };
    w.visits += point.visits;
    w.leads += point.crmLeads;
    w.accepted += point.acceptedOrders;
    w.paid += point.paidOrders;
    w.revenue += point.realizedRevenue;
    w.profit += point.netProfit;
    weeks.set(monday, w);
  }
  return [...weeks.values()]
    .map((w) => ({
      ...w,
      marginPct: w.revenue > 0 ? (w.profit / w.revenue) * 100 : null,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** Понедельник недели московского календарного дня `YYYY-MM-DD`. */
export function weekStart(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  const shift = (d.getUTCDay() + 6) % 7; // понедельник = 0
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/**
 * Аномалии — только факт отклонения с доказательством. Базой служит
 * предыдущий период (для сравнимых метрик) либо среднее за 30 дней.
 */
export function buildAnomalies(
  rows: MetricRow[],
  input: ReportInput,
): Anomaly[] {
  const out: Anomaly[] = [];
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const flag = (
    key: string,
    severityWhen: (pct: number) => Anomaly['severity'] | null,
  ) => {
    const row = byKey.get(key);
    if (!row || row.deltaPct === null) return;
    const severity = severityWhen(row.deltaPct);
    if (!severity) return;
    out.push({
      metric: row.label,
      current: row.current,
      baseline: row.previous,
      delta: row.delta,
      severity,
      evidence: `текущий период ${fmt(row.unit, row.current ?? 0)}, предыдущий ${fmt(row.unit, row.previous ?? 0)} (${row.deltaPct > 0 ? '+' : ''}${row.deltaPct.toFixed(1)} %)`,
    });
  };

  flag('visits', (p) => (p <= -30 ? 'WARNING' : null));
  flag('siteLeads', (p) => (p <= -40 ? 'WARNING' : null));
  flag('paidOrders', (p) => (p <= -40 ? 'WARNING' : null));
  flag('realizedRevenue', (p) => (p <= -30 ? 'WARNING' : null));
  flag('marginPct', (p) => (p <= -20 ? 'WARNING' : null));
  flag('cancelledOrders', (p) => (p >= 50 ? 'WARNING' : null));
  flag('paidWithoutDate', (p) => (p >= 50 ? 'INFO' : null));
  flag('clientIdCoverage', (p) => (p <= -25 ? 'INFO' : null));

  const paid = byKey.get('paidOrders');
  if (paid && paid.current === 0 && (paid.previous ?? 0) > 0) {
    out.push({
      metric: 'Оплаченные заказы',
      current: 0,
      baseline: paid.previous,
      delta: paid.delta,
      severity: 'CRITICAL',
      evidence: 'в текущем периоде нет ни одной оплаты, в предыдущем они были',
    });
  }

  if (input.sync.failed > 0) {
    out.push({
      metric: 'Очередь CRM → Метрика',
      current: input.sync.failed,
      baseline: 0,
      delta: input.sync.failed,
      severity: 'WARNING',
      evidence: `строк в статусе failed: ${input.sync.failed}`,
    });
  }
  if (
    input.sync.duplicateDedupeKeys > 0 ||
    input.sync.duplicatePurchasesPerOrder > 0
  ) {
    out.push({
      metric: 'Дубли выгрузки в Метрику',
      current:
        input.sync.duplicateDedupeKeys + input.sync.duplicatePurchasesPerOrder,
      baseline: 0,
      delta:
        input.sync.duplicateDedupeKeys + input.sync.duplicatePurchasesPerOrder,
      severity: 'CRITICAL',
      evidence: `дублей ключа ${input.sync.duplicateDedupeKeys}, повторных покупок по заказу ${input.sync.duplicatePurchasesPerOrder}`,
    });
  }
  return out;
}

/**
 * Прогноз строим только на достаточной истории и только простым методом:
 * среднее последних четырёх полных недель. Всё остальное — ложная точность.
 */
export function buildForecast(weekly: WeeklyPoint[]): ForecastBlock {
  const complete = weekly.slice(0, -1); // последняя неделя может быть неполной
  if (complete.length < MIN_FORECAST_WEEKS) {
    return {
      available: false,
      method: '—',
      confidence: 'LOW',
      limitations: [],
      horizons: [],
      reason: `INSUFFICIENT HISTORY FOR RELIABLE FORECAST: полных недель ${complete.length}, нужно минимум ${MIN_FORECAST_WEEKS}`,
    };
  }
  const last4 = complete.slice(-4);
  const avg = (pick: (w: WeeklyPoint) => number) =>
    last4.reduce((s, w) => s + pick(w), 0) / last4.length;

  const revenueWeek = avg((w) => w.revenue);
  const profitWeek = avg((w) => w.profit);
  const paidWeek = avg((w) => w.paid);

  // Разброс недель — единственное, чем честно мерить уверенность.
  const mean = revenueWeek;
  const spread =
    mean > 0
      ? Math.sqrt(
          last4.reduce((s, w) => s + (w.revenue - mean) ** 2, 0) / last4.length,
        ) / mean
      : 1;
  const confidence: ForecastBlock['confidence'] =
    spread < 0.15 ? 'HIGH' : spread < 0.35 ? 'MEDIUM' : 'LOW';

  return {
    available: true,
    method:
      'среднее по четырём последним полным неделям, без сезонности и без учёта рекламных расходов',
    confidence,
    limitations: [
      `разброс недельной выручки ±${(spread * 100).toFixed(0)} % — основа оценки уверенности`,
      'метод не учитывает сезонность, акции, изменения цен и рекламный бюджет',
      'выручка признаётся по дате оплаты, а часть заказов оплачивается без даты — когорты могут смещаться',
      'прогноз не является обязательством и не учитывает внешние события',
    ],
    horizons: [
      { horizon: '7 дней', metric: 'Выручка', value: Math.round(revenueWeek) },
      {
        horizon: '30 дней',
        metric: 'Выручка',
        value: Math.round((revenueWeek / 7) * 30),
      },
      { horizon: '7 дней', metric: 'Прибыль', value: Math.round(profitWeek) },
      {
        horizon: '30 дней',
        metric: 'Прибыль',
        value: Math.round((profitWeek / 7) * 30),
      },
      {
        horizon: '7 дней',
        metric: 'Оплаченные заказы',
        value: Math.round(paidWeek),
      },
      {
        horizon: '30 дней',
        metric: 'Оплаченные заказы',
        value: Math.round((paidWeek / 7) * 30),
      },
    ],
  };
}

export function buildQuality(input: ReportInput): QualityItem[] {
  const dq = input.current.dataQuality;
  const a = input.attribution;
  const pct = (part: number, total: number) =>
    total > 0 ? `${((part / total) * 100).toFixed(1)} %` : 'нет данных';
  return [
    {
      metric: 'Покрытие ClientID у принятых заказов',
      value:
        dq.clientIdCoverageAccepted === null
          ? 'нет данных'
          : `${dq.clientIdCoverageAccepted.toFixed(1)} %`,
      threshold: '≥ 50 %',
      impact:
        'сопоставление «трафик → заказ» охватывает только часть заказов CRM; метрики matchedAccepted / matchedPaid считаются по этой части',
    },
    {
      metric: 'Заказы без даты оплаты (paidWithoutDate)',
      value: String(input.current.overview.orders.paidWithoutDate),
      threshold: '0',
      impact:
        'выручка таких заказов признаётся по дате отгрузки — когорты по датам смещаются, суммы при этом верны',
    },
    {
      metric: 'Покрытие UTM у заказов периода',
      value: pct(a.withUtm, a.totalOrders),
      threshold: '— (метки ставит рекламная кампания)',
      impact:
        'при нулевом покрытии рекламные кампании не разделяются по UTM; источник определяется по yclid и классификации Метрики',
    },
    {
      metric: 'Покрытие yclid',
      value: pct(a.withYclid, a.totalOrders),
      threshold: '— (только клики Яндекс.Директа)',
      impact: 'позволяет связать заказ с конкретным рекламным кликом',
    },
    {
      metric: 'Страница заявки (conversionPageUrl)',
      value: pct(a.withConversionPage, a.totalOrders),
      threshold: '100 % для заявок с сайта',
      impact: 'без неё неизвестно, с какой страницы пришла заявка',
    },
    {
      metric: 'Первая страница визита (firstTouchUrl)',
      value: pct(a.withFirstTouch, a.totalOrders),
      threshold: 'растёт естественно с 13.09.2026',
      impact: 'ограничивает анализ входных страниц на исторических заявках',
    },
    {
      metric: 'Очередь в Метрику: пропущено из-за отсутствия ClientID',
      value: String(
        input.sync.skipReasons.find((r) => r.reason === 'no_client_id')?.rows ??
          0,
      ),
      threshold: '— (следствие покрытия ClientID)',
      impact: 'такие заказы не попадают в кабинет Метрики как конверсии',
    },
    {
      metric: 'Свежесть данных Метрики',
      value:
        dq.freshness.metrikaDataAgeSeconds === null
          ? 'нет данных'
          : `${Math.round(dq.freshness.metrikaDataAgeSeconds / 60)} мин (${dq.freshness.status})`,
      threshold: `< ${Math.round(dq.freshness.thresholdSeconds / 60)} мин`,
      impact: 'устаревшие данные делают сравнение периодов недостоверным',
    },
  ];
}

/** Человеческие подписи каналов — те же, что в панели. */
export const ORIGIN_LABELS: Record<string, string> = {
  WEBSITE: 'Сайт',
  AVITO: 'Avito',
  OZON: 'Ozon',
  WB: 'Wildberries',
  LOCAL: 'Местные (вручную)',
  UNKNOWN: 'Не определён',
};

/**
 * Происхождение заказов периода (этап 17).
 *
 * Строки берутся из канонического среза каналов, деньги — оттуда же, то есть
 * из P&L. Своих формул здесь нет: раздел только раскладывает уже посчитанное.
 * Строка «Все заказы» — сумма каналов; на ней же держится сверка отчёта.
 */
export function buildOrderOrigin(input: ReportInput): OriginBlock {
  const rows: OriginRow[] = input.salesChannels.rows.map((r) => ({
    origin: r.salesChannel,
    label: ORIGIN_LABELS[r.salesChannel] ?? r.salesChannel,
    crmLeads: r.crmLeads,
    acceptedOrders: r.acceptedOrders,
    paidOrders: r.paidOrders,
    cancelledOrders: r.cancelledOrders,
    // ?? null: срез мог прийти из более старого контракта — печатаем «—»,
    // а не падаем на undefined.
    revenue: r.realizedRevenue ?? null,
    cogs: r.cogs ?? null,
    profit: r.grossProfit ?? null,
    marginPct: r.marginPct ?? null,
    averageCheck: r.averageCheck ?? null,
  }));
  const sum = (pick: (r: OriginRow) => number | null): number | null =>
    rows.some((r) => pick(r) !== null)
      ? rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0)
      : null;
  const revenue = sum((r) => r.revenue);
  const profit = sum((r) => r.profit);
  const all: OriginRow | null = rows.length
    ? {
        origin: 'ALL',
        label: 'Все заказы',
        crmLeads: rows.reduce((a, r) => a + r.crmLeads, 0),
        acceptedOrders: rows.reduce((a, r) => a + r.acceptedOrders, 0),
        paidOrders: rows.reduce((a, r) => a + r.paidOrders, 0),
        cancelledOrders: rows.reduce((a, r) => a + r.cancelledOrders, 0),
        revenue,
        cogs: sum((r) => r.cogs),
        profit,
        marginPct: revenue && profit !== null ? (profit / revenue) * 100 : null,
        averageCheck: null,
      }
    : null;

  const realized = input.current.overview.financials.realized;
  const orders = input.current.overview.orders;
  const rounding =
    'себестоимость бумаги округляется вверх до рубля в каждой корзине (правило этапа 08): чем больше корзин, тем больше рублей';
  const check = (
    metric: string,
    originsSum: number | null,
    periodTotal: number | null,
    explanation: string | null,
  ): OriginReconciliation => ({
    metric,
    originsSum,
    periodTotal,
    difference:
      originsSum === null || periodTotal === null
        ? null
        : originsSum - periodTotal,
    explanation,
  });
  const reconciliation: OriginReconciliation[] = [
    check(
      'Принятые заказы',
      all?.acceptedOrders ?? null,
      orders.acceptedOrders,
      null,
    ),
    check(
      'Оплаченные заказы',
      all?.paidOrders ?? null,
      orders.paidOrders,
      null,
    ),
    check(
      'Реализованная выручка',
      all?.revenue ?? null,
      realized?.realizedRevenue ?? null,
      null,
    ),
    check('Себестоимость', all?.cogs ?? null, realized?.cogs ?? null, rounding),
    check(
      'Валовая прибыль',
      all?.profit ?? null,
      realized?.grossContribution ?? null,
      rounding,
    ),
  ];

  const ordersOf = (origin: string) =>
    input.attribution.bySource
      .filter((s) => s.source === origin)
      .reduce((a, s) => a + s.orders, 0);
  const total = input.attribution.totalOrders;
  const unknown = ordersOf('UNKNOWN');
  return {
    rows,
    all,
    reconciliation,
    coverage: {
      totalOrders: total,
      websiteOrders: ordersOf('WEBSITE'),
      avitoOrders: ordersOf('AVITO'),
      unknownOriginOrders: unknown,
      orderOriginCoveragePct:
        total > 0 ? ((total - unknown) / total) * 100 : null,
    },
  };
}

export function buildReportModel(input: ReportInput): ReportModel {
  const summary = buildSummary(input.current, input.previous);
  const signals = buildSignals(summary);
  const siteFunnel = buildSiteFunnel(input.current, input.previous);
  const crmFunnel = buildCrmFunnel(input.current, input.previous);
  const weekly = buildWeekly(input.daily);

  const strengths = signals
    .filter((s) => s.kind === 'positive')
    .map((s) => s.statement);
  const weaknesses = signals
    .filter((s) => s.kind === 'negative')
    .map((s) => s.statement);

  const constraints: string[] = [];
  const dq = input.current.dataQuality;
  if ((dq.clientIdCoverageAccepted ?? 0) < 50) {
    constraints.push(
      `покрытие ClientID ${dq.clientIdCoverageAccepted?.toFixed(1) ?? '—'} % — рекламная атрибуция охватывает меньшинство заказов`,
    );
  }
  if (input.attribution.withUtm === 0) {
    constraints.push(
      'UTM-метки отсутствуют у всех заказов периода — разделение кампаний по меткам невозможно',
    );
  }
  if (input.current.overview.orders.paidWithoutDate > 0) {
    constraints.push(
      `${input.current.overview.orders.paidWithoutDate} оплаченных заказов без даты оплаты — когорты по датам смещены`,
    );
  }
  const manual = input.attribution.bySource.filter(
    (s) => s.withAnyAttribution === 0 && s.orders > 0,
  );
  if (manual.length) {
    constraints.push(
      `заказы, заводимые вручную, не имеют атрибуции вовсе: ${manual
        .map((s) => `${s.source} — ${s.orders}`)
        .join(', ')}`,
    );
  }
  const originUnknown = buildOrderOrigin(input).coverage.unknownOriginOrders;
  if (originUnknown > 0) {
    constraints.push(
      `у ${originUnknown} заказов периода происхождение по истории не доказано (UNKNOWN) — доли каналов считаются без них`,
    );
  }
  constraints.push(
    'рекламные расходы в систему не заводятся: CPL, CPA, ROAS и ROMI посчитать нельзя',
  );

  return {
    input,
    orderOrigin: buildOrderOrigin(input),
    summary,
    signals,
    siteFunnel,
    crmFunnel,
    biggestDropOff: biggestDropOff(siteFunnel),
    comparison: summary,
    weekly,
    anomalies: buildAnomalies(summary, input),
    forecast: buildForecast(weekly),
    quality: buildQuality(input),
    strengths,
    weaknesses,
    constraints,
    openQuestions: [
      'Сколько стоил трафик за период (рекламный бюджет по источникам) — без этого окупаемость не считается.',
      'Какие заказы из зарплатной пачки оплачены в какой день — дата оплаты известна только человеку.',
      'Были ли в периоде внешние события (акции, изменения цен, перебои) — аналитика их не видит.',
      'Планируется ли размечать кампании UTM-метками — сейчас их нет ни у одного заказа.',
    ],
  };
}
