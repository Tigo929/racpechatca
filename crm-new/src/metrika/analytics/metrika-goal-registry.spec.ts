import type { MetrikaGoal } from '../metrika.types';
import {
  EXPECTED_GOAL_IDS,
  goalEventIdentifier,
  resolveCanonicalGoals,
} from './metrika-goal-registry';

/**
 * Реестр канонических целей (этап 07, раздел 9): цели находятся по
 * устойчивым признакам из Management API, а не по названию и не по
 * зашитому номеру.
 */
const js = (id: number, event: string, name = event): MetrikaGoal => ({
  id,
  name,
  type: 'action',
  conditions: [{ type: 'contain', url: event }],
});

const COUNTER_GOALS: MetrikaGoal[] = [
  {
    id: 602325854,
    name: 'Автоцель: отправка формы',
    type: 'form',
    conditions: [],
  },
  {
    id: 602316919,
    name: 'Заявка отправлена',
    type: 'url',
    conditions: [{ type: 'contain', url: '/thanks' }],
  },
  js(611379890, 'lead_submitted', 'Сколько заявок реально ушло на сервер'),
  { id: 596990603, name: 'CRM: Заказ создан', type: 'cdp_order_in_progress' },
  { id: 596990604, name: 'CRM: Заказ оплачен', type: 'cdp_order_paid' },
  { id: 596990605, name: 'CRM: Спам заказ', type: 'cdp_order_spam' },
  { id: 596990606, name: 'CRM: Заказ отменен', type: 'cdp_order_cancelled' },
  js(612290270, 'lead_submitted_photo', 'Заявка — фото'),
  js(612290370, 'lead_submitted_canvas', 'Заявка — холст'),
  js(612290451, 'lead_submitted_tshirt', 'Заявка — футболка'),
  js(612290566, 'form_error', 'Ошибка формы'),
  js(611379979, 'submit_tshirt_order_success'),
];

describe('resolveCanonicalGoals', () => {
  it('находит все канонические цели счётчика по событию, типу и URL — номера как в манифесте', () => {
    const r = resolveCanonicalGoals(COUNTER_GOALS);
    expect(r.registry).toEqual({
      canonicalLeadGoalId: 611379890,
      photoLeadGoalId: 612290270,
      canvasLeadGoalId: 612290370,
      tshirtLeadGoalId: 612290451,
      formErrorGoalId: 612290566,
      crmOrderCreatedGoalId: 596990603,
      crmOrderPaidGoalId: 596990604,
      crmOrderCancelledGoalId: 596990606,
      crmOrderSpamGoalId: 596990605,
      legacyThanksGoalId: 602316919,
    });
    expect(r.missing).toEqual([]);
    expect(r.drift).toEqual([]);
    expect(r.ambiguous).toEqual([]);
  });

  it('не путает lead_submitted с lead_submitted_photo (совпадение точное, не по подстроке)', () => {
    const r = resolveCanonicalGoals([
      js(1, 'lead_submitted_photo'),
      js(2, 'lead_submitted_tshirt'),
    ]);
    expect(r.registry.canonicalLeadGoalId).toBeNull();
    expect(r.registry.photoLeadGoalId).toBe(1);
    expect(r.missing).toContain('lead');
  });

  it('системные CRM-цели резолвятся по типу, даже если их переименовали', () => {
    const r = resolveCanonicalGoals([
      { id: 77, name: 'Заказ (переименовано)', type: 'cdp_order_paid' },
    ]);
    expect(r.registry.crmOrderPaidGoalId).toBe(77);
    expect(r.drift).toEqual([
      {
        key: 'crmOrderPaid',
        expected: EXPECTED_GOAL_IDS.crmOrderPaid,
        actual: 77,
      },
    ]);
  });

  it('пересозданная цель под новым номером — найдена, но отмечена как расхождение с манифестом', () => {
    const r = resolveCanonicalGoals([js(999, 'lead_submitted')]);
    expect(r.registry.canonicalLeadGoalId).toBe(999);
    expect(r.drift).toEqual([
      { key: 'lead', expected: 611379890, actual: 999 },
    ]);
  });

  it('две цели на одно событие — берётся меньший номер, дубль отмечен', () => {
    const r = resolveCanonicalGoals([
      js(20, 'form_error'),
      js(10, 'form_error'),
    ]);
    expect(r.registry.formErrorGoalId).toBe(10);
    expect(r.ambiguous).toEqual([{ key: 'formError', ids: [10, 20] }]);
  });

  it('пустой счётчик — всё missing, реестр из null', () => {
    const r = resolveCanonicalGoals([]);
    expect(r.missing).toHaveLength(10);
    expect(Object.values(r.registry).every((v) => v === null)).toBe(true);
  });
});

describe('goalEventIdentifier', () => {
  it('у JS-цели — идентификатор события, у остальных — null', () => {
    expect(goalEventIdentifier(js(1, 'form_error'))).toBe('form_error');
    expect(
      goalEventIdentifier({
        id: 2,
        name: 'x',
        type: 'url',
        conditions: [{ type: 'contain', url: '/thanks' }],
      }),
    ).toBeNull();
    expect(
      goalEventIdentifier({ id: 3, name: 'x', type: 'cdp_order_paid' }),
    ).toBeNull();
  });
});
