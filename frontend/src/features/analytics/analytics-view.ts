import type {
  Comparison,
  ComparisonKey,
  FreshnessStatus,
  Overview,
  PeriodPreset,
  QualityNote,
} from '../../types/analytics';

/**
 * Представление метрик для руководителя (этап 09, разделы 8, 12–13, 21–27,
 * 36–40): человеческие названия, форматы ru-RU, знак изменения с учётом
 * «полярности» показателя, предупреждения о неполных данных и карточки
 * «Требует внимания». Здесь нет ни одной формулы метрик — только то, как
 * показать готовые числа из контракта.
 */

// ── Периоды ────────────────────────────────────────────────────────────────

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  last_7_days: '7 дней',
  previous_7_days: 'Предыдущие 7 дней',
  last_30_days: '30 дней',
  previous_30_days: 'Предыдущие 30 дней',
  current_month: 'Текущий месяц',
  previous_month: 'Прошлый месяц',
};

export const PRESET_ORDER: PeriodPreset[] = [
  'today',
  'yesterday',
  'last_7_days',
  'previous_7_days',
  'last_30_days',
  'previous_30_days',
  'current_month',
  'previous_month',
];

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «6 сентября — 12 сентября 2026», один день — «12 сентября 2026». */
export function formatPeriod(from: string, to: string): string {
  const d = (iso: string) => {
    const [y, m, day] = iso.split('-').map(Number);
    return { y, m, day };
  };
  const a = d(from);
  const b = d(to);
  if (from === to) return `${a.day} ${MONTHS_GEN[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.day}–${b.day} ${MONTHS_GEN[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${a.day} ${MONTHS_GEN[a.m - 1]} — ${b.day} ${MONTHS_GEN[b.m - 1]} ${a.y}`;
  return `${a.day} ${MONTHS_GEN[a.m - 1]} ${a.y} — ${b.day} ${MONTHS_GEN[b.m - 1]} ${b.y}`;
}

// ── Форматы ────────────────────────────────────────────────────────────────

const RU = 'ru-RU';

/** 241 100 ₽ или 1 972,71 ₽ — копейки только когда они есть. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const digits = Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2;
  return `${value.toLocaleString(RU, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ₽`;
}

/** 57,45 % — не больше двух знаков; null (нет знаменателя) — «—». */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(RU, { maximumFractionDigits: 2 })} %`;
}

/** 1 234 — целые. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.round(value).toLocaleString(RU, { maximumFractionDigits: 0 });
}

export type MetricFormat = 'count' | 'money' | 'percent';

export function formatMetric(value: number | null | undefined, format: MetricFormat): string {
  if (format === 'money') return formatMoney(value);
  if (format === 'percent') return formatPercent(value);
  return formatCount(value);
}

/** «12 минут назад» из секунд; для шапки. */
export function formatAgo(seconds: number | null): string {
  if (seconds === null) return 'нет данных';
  if (seconds < 60) return 'только что';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')} назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${plural(hours, 'час', 'часа', 'часов')} назад`;
  const days = Math.round(hours / 24);
  return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// ── Полярность и изменение ─────────────────────────────────────────────────

export type Polarity = 'higher-good' | 'lower-good' | 'neutral';

/** Рост чего хорош, рост чего плох, а что просто контекст (раздел 25). */
export const POLARITY: Record<ComparisonKey, Polarity> = {
  visits: 'higher-good',
  periodUsers: 'higher-good',
  pageviews: 'higher-good',
  siteLeads: 'higher-good',
  matchedAccepted: 'higher-good',
  matchedPaid: 'higher-good',
  crmLeads: 'higher-good',
  acceptedOrders: 'higher-good',
  paidOrders: 'higher-good',
  cancelledOrders: 'lower-good',
  realizedOrders: 'higher-good',
  contractValue: 'higher-good',
  paidOrderValue: 'higher-good',
  realizedRevenue: 'higher-good',
  netProfit: 'higher-good',
  siteLeadConversion: 'higher-good',
  crmLeadToAccepted: 'higher-good',
  crmAcceptedToPaid: 'higher-good',
  paidAov: 'higher-good',
};

export type Tone = 'positive' | 'negative' | 'neutral';

export function deltaTone(cmp: Comparison | null | undefined, polarity: Polarity): Tone {
  if (!cmp || cmp.delta === null || cmp.delta === 0 || polarity === 'neutral') return 'neutral';
  if (cmp.changeKind === 'NA') return 'neutral';
  const up = cmp.delta > 0;
  if (polarity === 'higher-good') return up ? 'positive' : 'negative';
  return up ? 'negative' : 'positive';
}

const signed = (v: number, format: MetricFormat) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMetric(Math.abs(v), format)}`;

/**
 * «+7 (+20 %)», «новое» при нулевой базе, «−100 %» при уходе в ноль, «—»
 * когда сравнивать не с чем (например, нет снимка за прошлый период).
 */
export function formatDelta(cmp: Comparison | null | undefined, format: MetricFormat): string {
  if (!cmp || cmp.changeKind === 'NA' || cmp.delta === null) return '—';
  if (cmp.changeKind === 'NEW') return `новое (+${formatMetric(cmp.delta, format)})`;
  if (cmp.changeKind === 'FLAT' && cmp.delta === 0) return 'без изменений';
  const pct = cmp.deltaPct === null ? '' : ` (${cmp.deltaPct > 0 ? '+' : '−'}${Math.abs(cmp.deltaPct).toLocaleString(RU, { maximumFractionDigits: 1 })} %)`;
  return `${signed(cmp.delta, format)}${pct}`;
}

// ── Названия и подсказки (источник — METRICS_DICTIONARY.md) ────────────────

export interface MetricLabel {
  label: string;
  tooltip: string;
}

export const LABELS: Record<string, MetricLabel> = {
  visits: { label: 'Визиты', tooltip: 'Визиты на сайт по данным Яндекс Метрики за период (сумма по дням).' },
  periodUsers: {
    label: 'Посетители',
    tooltip:
      'Уникальные посетители за весь период — отдельный снимок Метрики, а не сумма дневных (один человек за неделю даёт семь дневных визитов, но одного посетителя). Если снимка за период нет — показывается прочерк.',
  },
  siteLeads: {
    label: 'Заявки сайта',
    tooltip: 'Отправленные формы на сайте (цель lead_submitted в Метрике). До 13 сентября 2026 данные неполные — часть форм тогда не учитывалась.',
  },
  crmLeads: { label: 'Заявки в CRM', tooltip: 'Заказы CRM, которые побывали в статусе «Заявка» в этом периоде — с сайта и созданные вручную.' },
  acceptedOrders: {
    label: 'Принятые заказы',
    tooltip: 'Заказы, впервые взятые в работу в периоде — с сайта, Avito и созданные оператором. Отмена не отменяет факт принятия.',
  },
  paidOrders: { label: 'Оплаты', tooltip: 'Заказы с датой оплаты клиентом внутри периода. Заказы со статусом «Оплачен», но без даты оплаты сюда не входят — они показаны в «Качестве данных».' },
  realizedRevenue: {
    label: 'Выручка',
    tooltip: 'Выручка по правилам финансового отчёта: заказы, отданные клиенту или оплаченные, по дате оплаты. Совпадает с разделом «Отчёты».',
  },
  cogs: { label: 'Себестоимость', tooltip: 'Бумага по формату, вознаграждение партнёру за футболки, подрядчик по холстам — как в финансовом отчёте.' },
  netProfit: {
    label: 'Прибыль',
    tooltip: 'Чистая прибыль по методике финансового отчёта: выручка за товар − себестоимость − операционные расходы − начисленная зарплата + заработок на доставке.',
  },
  paidAov: { label: 'Средний чек', tooltip: 'Сумма оплаченных заказов периода, делённая на их число. Без оплат — прочерк.' },
  contractValue: { label: 'Сумма принятых заказов', tooltip: 'Договорная сумма заказов, принятых в периоде (ещё не обязательно оплаченных).' },
  paidOrderValue: { label: 'Сумма оплаченных заказов', tooltip: 'Сумма заказов с датой оплаты внутри периода.' },
  grossContribution: {
    label: 'Валовой вклад',
    tooltip: 'Сумма заказов минус себестоимость. Это не чистая прибыль: зарплата, доставка и расходы бизнеса здесь не вычтены.',
  },
  matchedAccepted: {
    label: 'Сопоставленные заказы',
    tooltip: 'Заказы, которые Метрика связала с визитом на сайт по ClientID. Появляются только у заявок с согласием на аналитику и после 12 сентября 2026.',
  },
  matchedPaid: { label: 'Сопоставленные оплаты', tooltip: 'Оплаченные заказы, связанные Метрикой с визитом на сайт по ClientID.' },
  siteLeadConversion: { label: 'Конверсия в заявку', tooltip: 'Заявки сайта / визиты × 100. Считается из итогов периода, а не как среднее по дням.' },
  siteAcceptedConversion: { label: 'Конверсия в заказ', tooltip: 'Сопоставленные заказы / визиты × 100 — только по заказам, связанным с сайтом через ClientID.' },
  crmLeadToAccepted: { label: 'Заявка → заказ', tooltip: 'Из заявок CRM, появившихся в периоде, — доля тех, что когда-либо стали заказом.' },
  crmAcceptedToPaid: { label: 'Заказ → оплата', tooltip: 'Из заказов, принятых в периоде, — доля тех, что когда-либо оплачены.' },
  clientIdCoverage: {
    label: 'Покрытие ClientID',
    tooltip: 'Доля принятых заказов, у которых есть идентификатор посетителя Метрики. Только такие заказы можно связать с рекламой и страницами сайта.',
  },
  cogsReliability: { label: 'Полнота себестоимости', tooltip: 'Доля принятых заказов, у которых есть позиции для расчёта себестоимости.' },
  paidWithoutDate: { label: 'Оплачены без даты', tooltip: 'Заказы со статусом «Оплачен», у которых не указана дата оплаты — в «Оплатах» периода их нет.' },
};

export function labelOf(key: string): MetricLabel {
  return LABELS[key] ?? { label: key, tooltip: '' };
}

export const FRESHNESS_LABELS: Record<FreshnessStatus, string> = {
  FRESH: 'Актуально',
  STALE: 'Есть задержка',
  NO_DATA: 'Нет данных',
};

// ── Предупреждения о неполных данных ───────────────────────────────────────

export interface Warning {
  code: string;
  text: string;
  tooltip?: string;
}

const NOTE_TEXT: Partial<Record<QualityNote, Warning>> = {
  INCOMPLETE_LEGACY_SITE_LEADS: {
    code: 'legacy',
    text: 'Исторические данные о заявках сайта до обновления аналитики (12 сентября 2026, 13:19) неполные',
    tooltip: 'До этого момента часть форм не отправляла событие заявки. Заявки CRM за это время полные.',
  },
  PERIOD_BEFORE_COUNTER: {
    code: 'counter',
    text: 'Метрика начала собирать данные с 13 августа 2026 — раньше визитов нет',
  },
  NO_PERIOD_SNAPSHOT: {
    code: 'snapshot',
    text: 'Посетители за этот период пока не подсчитаны — показан прочерк, а не сумма по дням',
    tooltip: 'Уникальные посетители считаются отдельным запросом к Метрике по расписанию для стандартных периодов.',
  },
  METRIKA_STALE: { code: 'stale', text: 'Данные Метрики могут быть устаревшими: синхронизация давно не обновлялась' },
  METRIKA_NO_DATA: { code: 'no-data', text: 'Данных Метрики нет: синхронизация ещё не выполнялась' },
  COGS_UNRELIABLE_ORDERS: { code: 'cogs', text: 'У части принятых заказов нет позиций — себестоимость по ним не посчитана' },
  PAID_WITHOUT_DATE: { code: 'paid-date', text: 'У части оплаченных заказов нет даты оплаты — в «Оплатах» периода их нет' },
};

export const COVERAGE_WARNING: Warning = {
  code: 'coverage',
  text: 'Данные о связи сайта с заказами пока неполные',
  tooltip: 'Не все клиенты дали согласие на аналитику / не все заказы имеют ClientID. Общий бизнес-KPI считается по CRM и остаётся полным.',
};

export const MATCHING_INSUFFICIENT = 'Недостаточно сопоставленных заказов';

/** Предупреждения для обзора: неполные периоды, снимок, свежесть, покрытие, сравнение. */
export function overviewWarnings(o: Overview): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  const push = (w: Warning | undefined) => {
    if (w && !seen.has(w.code)) {
      seen.add(w.code);
      out.push(w);
    }
  };
  for (const note of o.dataQuality.notes) push(NOTE_TEXT[note]);
  if (o.crmFunnel.quality.notes.includes('PAID_WITHOUT_DATE')) push(NOTE_TEXT.PAID_WITHOUT_DATE);
  if (o.financials.quality.notes.includes('COGS_UNRELIABLE_ORDERS')) push(NOTE_TEXT.COGS_UNRELIABLE_ORDERS);
  if (coverageIsLow(o)) push(COVERAGE_WARNING);
  if (o.comparison && o.previousPeriod.from < o.metadata.cutovers.counterDataSince) {
    push({
      code: 'comparison-partial',
      text: 'Сравнение по трафику неполное: Метрика ещё не собирала данные весь предыдущий период',
    });
  }
  return out;
}

/** Покрытие ниже 50 % или сопоставлять нечего — связь сайта с заказами неполная. */
export function coverageIsLow(o: Overview): boolean {
  const c = o.dataQuality.clientIdCoverageAccepted;
  return c === null || c < 50 || o.dataQuality.eligibleAccepted === 0;
}

/** Сопоставленную воронку показывать нельзя как «0 %»: заказов для сопоставления нет. */
export function matchingInsufficient(o: Overview): boolean {
  return o.siteFunnel.siteLeads > 0 && o.dataQuality.eligibleAccepted === 0;
}

/** Сравнение трафика бессмысленно, когда предыдущий период целиком или частично до старта счётчика. */
export function trafficComparisonPartial(o: Overview): boolean {
  return o.previousPeriod.from < o.metadata.cutovers.counterDataSince;
}

// ── «Требует внимания» (раздел 27) — только правила, без причин ────────────

export interface AttentionCard {
  code: string;
  title: string;
  text: string;
  tone: 'negative' | 'warning';
}

export function attentionCards(o: Overview): AttentionCard[] {
  const cards: AttentionCard[] = [];
  const drop = (c: Comparison | undefined) => c && c.deltaPct !== null && c.changeKind === 'DOWN' && c.deltaPct <= -20;
  if (o.comparison && drop(o.comparison.netProfit)) {
    cards.push({
      code: 'profit-drop',
      title: 'Прибыль снизилась',
      text: `Прибыль ниже предыдущего периода на ${formatPercent(Math.abs(o.comparison.netProfit.deltaPct ?? 0))}`,
      tone: 'negative',
    });
  }
  if (o.comparison && drop(o.comparison.siteLeadConversion) && !matchingInsufficient(o) && !o.dataQuality.siteLeadsLegacy) {
    cards.push({
      code: 'lead-conversion-drop',
      title: 'Конверсия в заявку снизилась',
      text: `Конверсия сайта в заявку ниже предыдущего периода на ${formatPercent(Math.abs(o.comparison.siteLeadConversion.deltaPct ?? 0))}`,
      tone: 'negative',
    });
  }
  if (o.dataQuality.freshness.status === 'STALE') {
    cards.push({
      code: 'stale',
      title: 'Данные устарели',
      text: `Последняя синхронизация с Метрикой — ${formatAgo(o.dataQuality.freshness.metrikaDataAgeSeconds)}`,
      tone: 'warning',
    });
  }
  if (o.financials.contract.cogsReliableOrders < o.financials.contract.orders) {
    cards.push({
      code: 'cogs-incomplete',
      title: 'Себестоимость посчитана не полностью',
      text: `Без позиций ${formatCount(o.financials.contract.orders - o.financials.contract.cogsReliableOrders)} из ${formatCount(o.financials.contract.orders)} принятых заказов`,
      tone: 'warning',
    });
  }
  // Карточка — только о реальной доле ClientID; «нечего сопоставлять» показывает сама воронка.
  const coverage = o.dataQuality.clientIdCoverageAccepted;
  if (o.financials.contract.orders > 0 && coverage !== null && coverage < 50) {
    cards.push({
      code: 'coverage-low',
      title: 'Связь сайта с заказами неполная',
      text: `ClientID есть у ${formatPercent(o.dataQuality.clientIdCoverageAccepted)} принятых заказов`,
      tone: 'warning',
    });
  }
  return cards;
}

// ── График ─────────────────────────────────────────────────────────────────

export type TrendMetric = 'visits' | 'siteLeads' | 'acceptedOrders' | 'paidOrders' | 'realizedRevenue' | 'netProfit';

/**
 * Сумма по дням у прибыли может отличаться от итога периода на единицы рублей:
 * P&L округляет себестоимость фото в каждом дне так же, как в недельных и
 * месячных разрезах отчёта. Итог периода — только в карточке «Прибыль».
 */
export const PROFIT_SUM_NOTE = 'Сумма дневных значений: себестоимость округляется в каждом дне, поэтому итог может отличаться на единицы рублей от карточки «Прибыль» — она и есть итог периода.';

export const TREND_METRICS: { key: TrendMetric; label: string; format: MetricFormat; sumNote?: string }[] = [
  { key: 'visits', label: 'Визиты', format: 'count' },
  { key: 'siteLeads', label: 'Заявки сайта', format: 'count' },
  { key: 'acceptedOrders', label: 'Принятые', format: 'count' },
  { key: 'paidOrders', label: 'Оплаты', format: 'count' },
  { key: 'realizedRevenue', label: 'Выручка', format: 'money' },
  { key: 'netProfit', label: 'Прибыль', format: 'money', sumNote: PROFIT_SUM_NOTE },
];

export const PRODUCT_LABELS: Record<string, string> = { PHOTO: 'Фото', TSHIRT: 'Футболки', CANVAS: 'Холсты' };
export const CHANNEL_LABELS: Record<string, string> = { WEBSITE: 'Сайт', AVITO: 'Avito', OZON: 'Ozon', WB: 'Wildberries', LOCAL: 'Местные (вручную)', UNKNOWN: 'Не определён' };
export const DEVICE_LABELS: Record<string, string> = { desktop: 'Компьютер', mobile: 'Телефон', tablet: 'Планшет', other: 'Другое' };
export const NO_UTM_LABEL = 'Без UTM';
