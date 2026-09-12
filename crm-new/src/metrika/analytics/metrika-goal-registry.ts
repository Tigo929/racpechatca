import type { MetrikaGoal } from '../metrika.types';

/**
 * Реестр канонических целей (этап 07, разделы 3 и 9).
 *
 * Правда о целях — Management API: идентификаторы целей мы не зашиваем в
 * код, а каждый раз находим по устойчивым признакам. JS-цели — по
 * идентификатору события (`conditions[].url` у цели типа `action`),
 * системные CRM-цели — по типу (`cdp_order_*`: их создала сама Метрика
 * после первой загрузки заказов, и название у них можно сменить в
 * интерфейсе), историческая URL-цель — по подстроке `/thanks`.
 *
 * Идентификаторы из `GOALS_MANIFEST.md` хранятся как ожидаемые: если API
 * нашёл цель под другим номером, это не ошибка (цель пересоздали), но
 * расхождение попадает в отчёт — реестр в документе надо обновить.
 */

export type CanonicalGoalKey =
  | 'lead'
  | 'photoLead'
  | 'canvasLead'
  | 'tshirtLead'
  | 'formError'
  | 'crmOrderCreated'
  | 'crmOrderPaid'
  | 'crmOrderCancelled'
  | 'crmOrderSpam'
  | 'legacyThanks';

export type CanonicalGoalRule =
  | { kind: 'event'; identifier: string }
  | { kind: 'type'; type: string }
  | { kind: 'url'; contains: string };

export const CANONICAL_GOAL_RULES: Record<CanonicalGoalKey, CanonicalGoalRule> =
  {
    lead: { kind: 'event', identifier: 'lead_submitted' },
    photoLead: { kind: 'event', identifier: 'lead_submitted_photo' },
    canvasLead: { kind: 'event', identifier: 'lead_submitted_canvas' },
    tshirtLead: { kind: 'event', identifier: 'lead_submitted_tshirt' },
    formError: { kind: 'event', identifier: 'form_error' },
    crmOrderCreated: { kind: 'type', type: 'cdp_order_in_progress' },
    crmOrderPaid: { kind: 'type', type: 'cdp_order_paid' },
    crmOrderCancelled: { kind: 'type', type: 'cdp_order_cancelled' },
    crmOrderSpam: { kind: 'type', type: 'cdp_order_spam' },
    legacyThanks: { kind: 'url', contains: '/thanks' },
  };

/** Ожидаемые номера — из GOALS_MANIFEST.md (сверка по API 12.09.2026). */
export const EXPECTED_GOAL_IDS: Record<CanonicalGoalKey, number> = {
  lead: 611379890,
  photoLead: 612290270,
  canvasLead: 612290370,
  tshirtLead: 612290451,
  formError: 612290566,
  crmOrderCreated: 596990603,
  crmOrderPaid: 596990604,
  crmOrderCancelled: 596990606,
  crmOrderSpam: 596990605,
  legacyThanks: 602316919,
};

/** Идентификаторы целей, найденные в счётчике; null — цели нет. */
export interface CanonicalGoalRegistry {
  canonicalLeadGoalId: number | null;
  photoLeadGoalId: number | null;
  canvasLeadGoalId: number | null;
  tshirtLeadGoalId: number | null;
  formErrorGoalId: number | null;
  crmOrderCreatedGoalId: number | null;
  crmOrderPaidGoalId: number | null;
  crmOrderCancelledGoalId: number | null;
  crmOrderSpamGoalId: number | null;
  legacyThanksGoalId: number | null;
}

const REGISTRY_FIELD: Record<CanonicalGoalKey, keyof CanonicalGoalRegistry> = {
  lead: 'canonicalLeadGoalId',
  photoLead: 'photoLeadGoalId',
  canvasLead: 'canvasLeadGoalId',
  tshirtLead: 'tshirtLeadGoalId',
  formError: 'formErrorGoalId',
  crmOrderCreated: 'crmOrderCreatedGoalId',
  crmOrderPaid: 'crmOrderPaidGoalId',
  crmOrderCancelled: 'crmOrderCancelledGoalId',
  crmOrderSpam: 'crmOrderSpamGoalId',
  legacyThanks: 'legacyThanksGoalId',
};

export interface GoalResolution {
  registry: CanonicalGoalRegistry;
  /** Ключи, для которых цели в счётчике нет. */
  missing: CanonicalGoalKey[];
  /** Цель нашлась, но не под тем номером, что в манифесте. */
  drift: { key: CanonicalGoalKey; expected: number; actual: number }[];
  /** Одному правилу подошло несколько целей — взята первая по номеру. */
  ambiguous: { key: CanonicalGoalKey; ids: number[] }[];
}

/** Идентификатор JS-события цели типа `action`, иначе null. */
export function goalEventIdentifier(goal: MetrikaGoal): string | null {
  if (goal.type !== 'action') return null;
  const url = goal.conditions?.map((c) => c.url?.trim()).find((u) => u);
  return url ?? null;
}

function matches(goal: MetrikaGoal, rule: CanonicalGoalRule): boolean {
  switch (rule.kind) {
    case 'event':
      return goalEventIdentifier(goal) === rule.identifier;
    case 'type':
      return goal.type === rule.type;
    case 'url':
      return (
        goal.type === 'url' &&
        (goal.conditions ?? []).some((c) =>
          (c.url ?? '').includes(rule.contains),
        )
      );
  }
}

export function resolveCanonicalGoals(goals: MetrikaGoal[]): GoalResolution {
  const registry: CanonicalGoalRegistry = {
    canonicalLeadGoalId: null,
    photoLeadGoalId: null,
    canvasLeadGoalId: null,
    tshirtLeadGoalId: null,
    formErrorGoalId: null,
    crmOrderCreatedGoalId: null,
    crmOrderPaidGoalId: null,
    crmOrderCancelledGoalId: null,
    crmOrderSpamGoalId: null,
    legacyThanksGoalId: null,
  };
  const missing: CanonicalGoalKey[] = [];
  const drift: GoalResolution['drift'] = [];
  const ambiguous: GoalResolution['ambiguous'] = [];

  for (const key of Object.keys(CANONICAL_GOAL_RULES) as CanonicalGoalKey[]) {
    const found = goals
      .filter((g) => matches(g, CANONICAL_GOAL_RULES[key]))
      .map((g) => g.id)
      .sort((a, b) => a - b);
    if (found.length === 0) {
      missing.push(key);
      continue;
    }
    if (found.length > 1) ambiguous.push({ key, ids: found });
    registry[REGISTRY_FIELD[key]] = found[0];
    if (found[0] !== EXPECTED_GOAL_IDS[key]) {
      drift.push({ key, expected: EXPECTED_GOAL_IDS[key], actual: found[0] });
    }
  }
  return { registry, missing, drift, ambiguous };
}

/** Ключи, без которых наборы источников/UTM/страниц/устройств не собрать. */
export const REQUIRED_FOR_DIMENSION_DATASETS: CanonicalGoalKey[] = [
  'lead',
  'crmOrderCreated',
  'crmOrderPaid',
];
