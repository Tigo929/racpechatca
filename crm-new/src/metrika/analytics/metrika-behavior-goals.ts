import type { MetrikaGoal } from '../metrika.types';
import { goalEventIdentifier } from './metrika-goal-registry';

/**
 * Поведенческие цели этапа 10 (BEHAVIOR_EVENT_CONTRACT.md, § 2): JS-события
 * сайта, у которых в счётчике есть цель типа `action`. Идентификатор
 * события — устойчивый ключ, номер цели каждый раз находим через
 * Management API (как у канонических целей этапа 07).
 *
 * Порядок списка — порядок шагов в воронках; он же определяет порядок
 * метрик в запросах и разбор ответов.
 */
export const BEHAVIOR_EVENTS = [
  'form_started',
  'lead_submit_attempt',
  'lead_submitted',
  'form_error',
  'lead_submitted_photo',
  'lead_submitted_canvas',
  'lead_submitted_tshirt',
  'view_custom_tshirt',
  'choose_size',
  'add_tshirt_lead',
  'submit_tshirt_order_success',
  'submit_tshirt_order_error',
  'messenger_click',
  'phone_click',
] as const;

export type BehaviorEvent = (typeof BEHAVIOR_EVENTS)[number];

export function isBehaviorEvent(value: string): value is BehaviorEvent {
  return (BEHAVIOR_EVENTS as readonly string[]).includes(value);
}

export interface BehaviorGoal {
  event: BehaviorEvent;
  goalId: number;
  name: string;
}

/**
 * Цели счётчика, соответствующие поведенческим событиям, в порядке
 * BEHAVIOR_EVENTS. Событие без цели в счётчике просто отсутствует в
 * результате — набор продолжает синхронизироваться по остальным, а
 * дашборд покажет такой шаг как «не измеряется».
 */
export function behaviorGoals(goals: MetrikaGoal[]): BehaviorGoal[] {
  const byEvent = new Map<string, MetrikaGoal>();
  for (const g of goals) {
    const id = goalEventIdentifier(g);
    if (id && isBehaviorEvent(id) && !byEvent.has(id)) byEvent.set(id, g);
  }
  const out: BehaviorGoal[] = [];
  for (const event of BEHAVIOR_EVENTS) {
    const g = byEvent.get(event);
    if (g) out.push({ event, goalId: g.id, name: g.name });
  }
  return out;
}

/** Целей в одном запросе: 3 метрики на цель + якорь визитов ≤ 20. */
export const BEHAVIOR_GOALS_PER_REQUEST = 6;

export function behaviorGoalChunks(goals: BehaviorGoal[]): BehaviorGoal[][] {
  const chunks: BehaviorGoal[][] = [];
  for (let i = 0; i < goals.length; i += BEHAVIOR_GOALS_PER_REQUEST)
    chunks.push(goals.slice(i, i + BEHAVIOR_GOALS_PER_REQUEST));
  return chunks;
}

/**
 * Белый список ключей параметров визита (§ 4 контракта). Всё остальное
 * (`productName`, `price`, `items`, …) локально не хранится: для воронок и
 * ошибок нужны только эти ключи, а расширять список — отдельное решение.
 * `form` (= contact) и `productSlug` (форма фотопечати) — единственные
 * признаки начала формы по направлениям «контакты» и «фото»: у их событий
 * нет параметра `product` (BEHAVIOR_EVENT_CONTRACT.md, § 2.1).
 */
export const VISIT_PARAM_KEYS = [
  'field',
  'product',
  'form',
  'productSlug',
  'intent',
  'format',
  'size',
  'value',
  'location',
  'channel',
  'kind',
  'topic',
] as const;

export type VisitParamKey = (typeof VISIT_PARAM_KEYS)[number];

/** Фильтр Reports API: только ключи из белого списка. */
export function visitParamKeysFilter(): string {
  return `ym:s:paramsLevel1=.(${VISIT_PARAM_KEYS.map((k) => `'${k}'`).join(',')})`;
}
