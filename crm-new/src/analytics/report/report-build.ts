import type { FinancialMetrics, TrendPoint } from '../metrics/metrics-contract';
import { compare } from '../metrics/ratios';
import { addDays } from '../../metrika/analytics/metrika-dates';
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
  return compare(current, previous).deltaPct;
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

function realizedCostsIncomplete(financials: FinancialMetrics): boolean {
  return financials.evidence
    ? financials.evidence.realized.missingCostOrders > 0
    : financials.quality.notes.includes('COGS_UNRELIABLE_ORDERS');
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
  const rows = [
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
      'Достижения цели заявки (не уникальные заявки)',
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
      'Покрытие ClientID у принятых заказов сайта',
      'percent',
      current.dataQuality.websiteClientIdCoverage,
      previous.dataQuality.websiteClientIdCoverage,
    ),
    metricRow(
      'paidWithoutDate',
      'Оплачено без даты оплаты',
      'count',
      c.orders.paidWithoutDate,
      p.orders.paidWithoutDate,
    ),
  ];
  return rows.map((row) => {
    const snapshots = [current, previous];
    let note: string | undefined;
    if (
      [
        'visits',
        'users',
        'pageviews',
        'siteLeads',
        'siteLeadConversion',
      ].includes(row.key)
    ) {
      if (
        snapshots.some(
          (s) =>
            s.dataQuality.freshness.status !== 'FRESH' ||
            s.overview.traffic.quality.notes.includes(
              'PERIOD_BEFORE_COUNTER',
            ) ||
            (row.key === 'users' &&
              s.overview.traffic.quality.notes.includes('SNAPSHOT_SAMPLED')),
        )
      )
        note =
          'Неполные или устаревшие данные трафика; сравнение не подтверждено';
      if (
        ['siteLeads', 'siteLeadConversion'].includes(row.key) &&
        snapshots.some((s) => s.dataQuality.siteLeadsLegacy)
      )
        note =
          'Период включает старую методику регистрации заявки; сравнение несопоставимо';
    }
    if (
      ['cogs', 'netProfit', 'marginPct'].includes(row.key) &&
      snapshots.some((s) => realizedCostsIncomplete(s.overview.financials))
    )
      note = 'Неполная себестоимость; изменение прибыли не подтверждено';
    return note
      ? { ...row, delta: null, deltaPct: null, comparisonNote: note }
      : row;
  });
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
const LOWER_IS_BETTER = new Set(['paidWithoutDate']);
// Absolute cost/cancellation counts need sales volume and mix to interpret.
const CONTEXT_REQUIRED = new Set(['cogs', 'cancelledOrders']);

export function buildSignals(rows: MetricRow[]): Signal[] {
  return rows.map((row) => {
    if (row.comparisonNote || row.current === null || row.previous === null) {
      return {
        kind: 'insufficient' as const,
        metric: row.label,
        statement: `${row.label}: ${row.comparisonNote ?? 'сравнение невозможно (нет данных за один из периодов)'}`,
      };
    }
    const pct = row.deltaPct;
    if (
      row.current === row.previous ||
      (pct !== null && Math.abs(pct) < STABLE_PCT)
    ) {
      return {
        kind: 'stable' as const,
        metric: row.label,
        statement: `${row.label}: ${fmt(row.unit, row.previous)} → ${fmt(row.unit, row.current)} (изменение в пределах ±${STABLE_PCT} %)`,
      };
    }
    const change = row.current - row.previous;
    const improved = LOWER_IS_BETTER.has(row.key) ? change < 0 : change > 0;
    const changeText =
      pct === null
        ? 'процент изменения не определён: предыдущая база равна нулю'
        : `${pct > 0 ? '+' : ''}${pct.toFixed(1)} %`;
    return {
      kind: CONTEXT_REQUIRED.has(row.key)
        ? ('neutral' as const)
        : improved
          ? ('positive' as const)
          : ('negative' as const),
      metric: row.label,
      statement: `${row.label}: ${fmt(row.unit, row.previous)} → ${fmt(row.unit, row.current)} (${changeText})${CONTEXT_REQUIRED.has(row.key) ? '; оценка требует объёма продаж и структуры заказов' : ''}`,
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
    step('Достижения цели заявки', c.siteLeads, null, p.siteLeads),
    step(
      'Достижения CRM-цели «принят» в Метрике',
      c.matchedAccepted,
      null,
      p.matchedAccepted,
    ),
    step(
      'Достижения CRM-цели «оплачен» в Метрике',
      c.matchedPaid,
      null,
      p.matchedPaid,
    ),
  ];
}

/** Конверсия только внутри одной когорты заявок; события периода — в SALES. */
export function buildCrmFunnel(
  current: PeriodSnapshot,
  previous: PeriodSnapshot,
): FunnelStep[] {
  const c = current.overview.crmFunnel.cohorts;
  const p = previous.overview.crmFunnel.cohorts;
  return [
    step('Заявки CRM (LEAD)', c.leadCohortSize, null, p.leadCohortSize),
    step(
      'Из них приняты в работу',
      c.leadCohortAccepted,
      c.leadCohortSize,
      p.leadCohortAccepted,
    ),
    step(
      'Из них оплачены',
      c.leadCohortPaid,
      c.leadCohortAccepted,
      p.leadCohortPaid,
    ),
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
  const dates = new Map<string, Set<string>>();
  for (const point of daily) {
    const monday = weekStart(point.date);
    const w = weeks.get(monday) ?? {
      week: monday,
      observedDays: 0,
      complete: false,
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
    const seen = dates.get(monday) ?? new Set<string>();
    seen.add(point.date);
    dates.set(monday, seen);
    weeks.set(monday, w);
  }
  return [...weeks.values()]
    .map((w) => ({
      ...w,
      observedDays: dates.get(w.week)!.size,
      complete: dates.get(w.week)!.size === 7,
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
      evidence:
        'в текущем периоде нет зарегистрированных clientPaidAt, в предыдущем они были; без сверки платежей это не доказывает отсутствие поступлений',
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
  // Only a consecutive run of fully observed weeks, including a full last Sunday.
  const complete: WeeklyPoint[] = [];
  for (const week of weekly) {
    if (!week.complete) {
      if (week !== weekly[weekly.length - 1]) complete.length = 0;
      continue;
    }
    if (
      complete.length &&
      addDays(complete[complete.length - 1].week, 7) !== week.week
    )
      complete.length = 0;
    complete.push(week);
  }
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
    spread < 0.35 ? 'MEDIUM' : 'LOW';

  return {
    available: true,
    method:
      'среднее по четырём последним полным неделям, без сезонности и без учёта рекламных расходов',
    confidence,
    limitations: [
      `коэффициент вариации недельной выручки ${(spread * 100).toFixed(0)} %; это не доверительный интервал и не вероятность прогноза`,
      'метод не учитывает сезонность, акции, изменения цен и рекламный бюджет',
      'выручка признаётся по методике CRM: дата оплаты, иначе завершения, смены статуса, отгрузки или создания; это не прогноз банковских поступлений',
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
      metric: 'Ограничения исходных данных периода',
      value:
        [
          ...new Set([
            ...dq.notes,
            ...input.current.overview.financials.quality.notes,
          ]),
        ].join(', ') || 'дополнительных флагов нет',
      threshold: 'проверять до интерпретации цифр',
      impact:
        'Неполная себестоимость, старые цели, отсутствующие снимки и даты ограничивают выводы. Отсутствие флагов не заменяет сверку первичных документов.',
    },
    {
      metric: 'Неизвестные даты оплат в истории CRM',
      value: input.historyQuality
        ? String(input.historyQuality.paidWithoutDate)
        : 'нет общего подсчёта',
      threshold: '0 для надёжного прогноза оплат',
      impact:
        'Это все текущие PAID без clientPaidAt, не только принятые в периоде. Они не распределяются по дням догадкой.',
    },
    {
      metric: 'Покрытие ClientID у принятых заказов сайта',
      value:
        dq.websiteClientIdCoverage === null
          ? 'нет данных'
          : `${dq.websiteClientIdCoverage.toFixed(1)} %`,
      threshold: '≥ 50 %',
      impact:
        'наличие идентификатора позволяет попытаться связать визит и заказ, но не доказывает привязку в Метрике; CRM-цели считаются отдельно',
    },
    {
      metric: 'Заказы без даты оплаты (paidWithoutDate)',
      value: String(input.current.overview.orders.paidWithoutDate),
      threshold: '0',
      impact:
        'число среди заказов, принятых в периоде. Без clientPaidAt оплату нельзя отнести к дню; реализация использует резервные даты, её сумма не подтверждает получение денег',
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
      threshold: 'не применяется ко всем заказам CRM, включая ручные',
      impact:
        'доля среди всех созданных заказов. Для оценки потери страницы нужен отдельный знаменатель WEBSITE',
    },
    {
      metric: 'Первая страница визита (firstTouchUrl)',
      value: pct(a.withFirstTouch, a.totalOrders),
      threshold: 'растёт естественно с 13.09.2026',
      impact: 'ограничивает анализ входных страниц на исторических заявках',
    },
    {
      metric: 'Очередь в Метрику: события без ClientID и yclid, вся история',
      value: String(
        input.sync.skipReasons.find((r) => r.reason === 'no_client_id')?.rows ??
          0,
      ),
      threshold: '— (следствие покрытия ClientID)',
      impact:
        'это число пропущенных событий очереди, не уникальных заказов; причина и происхождение требуют отдельной проверки',
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
    rows.length > 0 && rows.every((r) => pick(r) !== null)
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
    'требует разбора: все группировки суммируют одинаковую себестоимость каждого заказа';
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
  const weekly = buildWeekly(
    input.daily.filter(
      (d) =>
        !input.historyQuality ||
        (input.historyQuality.firstOrderDay !== null &&
          d.date >= input.historyQuality.firstOrderDay),
    ),
  );

  const strengths = signals
    .filter((s) => s.kind === 'positive')
    .map((s) => s.statement);
  const weaknesses = signals
    .filter((s) => s.kind === 'negative')
    .map((s) => s.statement);

  const constraints: string[] = [];
  const dq = input.current.dataQuality;
  if (dq.websiteAccepted > 0 && (dq.websiteClientIdCoverage ?? 0) < 50) {
    constraints.push(
      `покрытие ClientID у заказов сайта ${dq.websiteClientIdCoverage?.toFixed(1) ?? '—'} %; наличие идентификатора не доказывает рекламную атрибуцию`,
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
      `заказы без сохранённых признаков атрибуции (это не доказывает ручное происхождение): ${manual
        .map((s) => `${s.source} — ${s.orders}`)
        .join(', ')}`,
    );
  }
  const originUnknown = buildOrderOrigin(input).coverage.unknownOriginOrders;
  if (originUnknown > 0) {
    constraints.push(
      `у ${originUnknown} заказов периода происхождение по истории не доказано (UNKNOWN) — они остаются в общих итогах отдельным каналом`,
    );
  }
  constraints.push(
    input.current.overview.financials.spend.status ===
      'UNAVAILABLE_NO_SPEND_DATA'
      ? 'рекламные расходы за период отсутствуют: CPL, CPA, ROAS и ROMI посчитать нельзя'
      : 'расходы на рекламу известны; для CPL, CPA, ROAS и ROMI нужна доказанная атрибуция результатов к кампаниям',
  );

  const orderOrigin = buildOrderOrigin(input);
  const mismatches = orderOrigin.reconciliation
    .filter((r) => r.difference !== null && r.difference !== 0)
    .map((r) => r.metric);
  const recon = input.reconciliation;
  if (
    recon.trendSumRealizedRevenue !== null &&
    recon.overviewRealizedRevenue !== null &&
    recon.trendSumRealizedRevenue !== recon.overviewRealizedRevenue
  )
    mismatches.push('Выручка по дням');
  const monthly = recon.monthlyPnl;
  if (
    monthly &&
    ((monthly.serviceRevenue !== null &&
      monthly.serviceRevenue !== monthly.reportRevenue) ||
      (monthly.serviceNetProfit !== null &&
        monthly.serviceNetProfit !== monthly.reportNetProfit) ||
      (monthly.serviceCogs !== null &&
        monthly.serviceCogs !== monthly.reportCogs))
  )
    mismatches.push('P&L месяца');
  if (mismatches.length)
    constraints.push(
      `СВЕРКА НЕ ПРОЙДЕНА: ${mismatches.join(', ')}. Не использовать эти суммы для решений до выяснения расхождения.`,
    );
  const forecast = buildForecast(weekly);
  const unresolvedPayments =
    input.historyQuality?.paidWithoutDate ??
    input.current.overview.orders.paidWithoutDate;
  if (
    unresolvedPayments > 0 ||
    input.current.overview.financials.realized === null ||
    realizedCostsIncomplete(input.current.overview.financials)
  ) {
    forecast.available = false;
    forecast.confidence = 'LOW';
    forecast.horizons = [];
    forecast.reason = `INSUFFICIENT DATA QUALITY: заказов PAID без даты оплаты ${unresolvedPayments}; требуется подтверждение исторических оплат и себестоимости`;
  }
  if (mismatches.length) {
    forecast.available = false;
    forecast.horizons = [];
    forecast.confidence = 'LOW';
    forecast.reason = `RECONCILIATION_FAILED: ${mismatches.join(', ')}`;
  }
  constraints.push(
    ...summary
      .filter((r) => r.comparisonNote)
      .map((r) => `${r.label}: ${r.comparisonNote}`),
  );
  return {
    input,
    orderOrigin,
    summary,
    signals,
    siteFunnel,
    crmFunnel,
    biggestDropOff: biggestDropOff(siteFunnel),
    comparison: summary,
    weekly,
    anomalies: buildAnomalies(summary, input),
    forecast,
    quality: buildQuality(input),
    strengths,
    weaknesses,
    constraints,
    openQuestions: [
      ...(input.current.overview.financials.spend.status ===
      'UNAVAILABLE_NO_SPEND_DATA'
        ? ['Каковы фактические расходы рекламы за период?']
        : [
            'Все ли расходы рекламы учтены в CRM и подтверждена ли привязка рекламных заказов?',
          ]),
      ...(unresolvedPayments > 0
        ? ['Какими платёжными документами подтверждаются даты старых оплат?']
        : []),
      'Были ли в периоде внешние события (акции, изменения цен, перебои) — аналитика их не видит.',
      ...(input.attribution.withUtm === 0
        ? [
            'Почему у заказов периода нет сохранённых UTM: органический трафик, старый период или потеря меток?',
          ]
        : []),
    ],
  };
}
