import {
  addDays,
  calendarDateIn,
  daysBetween,
  type IsoDate,
} from '../../metrika/analytics/metrika-dates';
import type { OrderWithLifecycle } from '../metrics/metrics-compute';
import type {
  LagDistribution,
  MaturityInfo,
  MaturityPolicy,
  MetricMaturityClass,
} from './growth-contract';
import {
  DEFAULT_MATURITY_DAYS,
  MAX_MATURITY_DAYS,
  MIN_LAG_SAMPLE,
} from './growth-rules';
import { fmtDate } from './growth-windows';

/**
 * Созревание исходов (этап 11, раздел 11). Универсального лага нет: политика
 * выводится из истории CRM (задержки заявка → принят → оплата по московским
 * дням) как p90 с верхней границей, при малой истории — из настроек по
 * умолчанию с флагом. Метрики сайта созревают сразу; принятые — по задержке
 * заявка → принят; оплаты / выручка / прибыль — по задержке заявка → оплата.
 */

export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function lagDistribution(delaysDays: number[]): LagDistribution {
  const sorted = [...delaysDays].sort((a, b) => a - b);
  return {
    sample: sorted.length,
    medianDays: quantile(sorted, 0.5),
    p75Days: quantile(sorted, 0.75),
    p90Days: quantile(sorted, 0.9),
    sufficient: sorted.length >= MIN_LAG_SAMPLE,
  };
}

/** Задержка в календарных днях по Москве между двумя моментами (0 — тот же день). */
export function lagDays(from: Date, to: Date): number {
  return daysBetween(calendarDateIn(from), calendarDateIn(to)) - 1;
}

export interface LagInputs {
  leadToAccepted: number[];
  acceptedToPaid: number[];
  leadToPaid: number[];
}

/** Пары дат из жизненного цикла заказов: только неотрицательные задержки, без PII. */
export function lagInputsFrom(orders: OrderWithLifecycle[]): LagInputs {
  const out: LagInputs = {
    leadToAccepted: [],
    acceptedToPaid: [],
    leadToPaid: [],
  };
  for (const { lifecycle: l } of orders) {
    if (l.leadAt && l.acceptedAt && l.acceptedAt >= l.leadAt)
      out.leadToAccepted.push(lagDays(l.leadAt, l.acceptedAt));
    if (l.acceptedAt && l.paidAt && l.paidAt >= l.acceptedAt)
      out.acceptedToPaid.push(lagDays(l.acceptedAt, l.paidAt));
    if (l.leadAt && l.paidAt && l.paidAt >= l.leadAt)
      out.leadToPaid.push(lagDays(l.leadAt, l.paidAt));
  }
  return out;
}

function policyDays(
  dist: LagDistribution,
  fallback: number,
): { days: number; source: MaturityInfo['policySource'] } {
  if (dist.sufficient && dist.p90Days !== null)
    return {
      days: Math.min(MAX_MATURITY_DAYS, Math.ceil(dist.p90Days)),
      source: 'empirical',
    };
  return { days: fallback, source: 'default' };
}

/**
 * Политика созревания: эмпирический p90 (с потолком) или настройка по умолчанию;
 * `configuredDays` изменения переопределяет класс paid и ограничивает класс accepted сверху.
 */
export function maturityPolicyFrom(
  lags: LagInputs,
  configuredDays: number | null,
): MaturityPolicy {
  const leadToAccepted = lagDistribution(lags.leadToAccepted);
  const acceptedToPaid = lagDistribution(lags.acceptedToPaid);
  const leadToPaid = lagDistribution(lags.leadToPaid);
  const accepted = policyDays(leadToAccepted, DEFAULT_MATURITY_DAYS.accepted);
  const paid = policyDays(leadToPaid, DEFAULT_MATURITY_DAYS.paid);
  const daysByClass: Record<MetricMaturityClass, number> = {
    immediate: 0,
    accepted:
      configuredDays !== null
        ? Math.min(accepted.days, configuredDays)
        : accepted.days,
    paid: configuredDays !== null ? configuredDays : paid.days,
  };
  const source: Record<MetricMaturityClass, MaturityInfo['policySource']> = {
    immediate: 'empirical',
    accepted:
      configuredDays !== null && configuredDays < accepted.days
        ? 'configured'
        : accepted.source,
    paid: configuredDays !== null ? 'configured' : paid.source,
  };
  return { leadToAccepted, acceptedToPaid, daysByClass, source };
}

/** Статус созревания метрики: окно «после» должно отлежаться policyDays после последнего дня. */
export function maturityInfo(
  cls: MetricMaturityClass,
  afterTo: IsoDate,
  observationCutoff: IsoDate,
  policy: MaturityPolicy,
  medianDays: number | null,
): MaturityInfo {
  const days = policy.daysByClass[cls];
  const maturityUntil = addDays(afterTo, days);
  let status: MaturityInfo['status'];
  if (cls === 'immediate' || observationCutoff >= maturityUntil)
    status = 'MATURE';
  else if (
    medianDays !== null &&
    observationCutoff >= addDays(afterTo, Math.ceil(medianDays))
  )
    status = 'PARTIALLY_MATURE';
  else status = 'IMMATURE';
  const note =
    status === 'MATURE'
      ? null
      : status === 'PARTIALLY_MATURE'
        ? `Прошла медианная задержка исхода, но не p90: часть заказов окна «после» ещё может принять / оплатить — итог не окончательный до ${fmtDate(maturityUntil)}.`
        : `Исход ещё не созрел: заказы окна «после» дозревают до ${fmtDate(maturityUntil)} (политика ${days} дн., ${policy.source[cls] === 'empirical' ? 'p90 истории CRM' : policy.source[cls] === 'configured' ? 'задано в изменении' : 'по умолчанию — истории мало'}).`;
  return {
    status,
    class: cls,
    policyDays: days,
    maturityUntil,
    observationCutoff,
    policySource: policy.source[cls],
    note,
  };
}
