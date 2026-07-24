import {
  PlanOrder,
  buildDailyPlanMessage,
  orderMarker,
  priorityKey,
  summarizeItems,
} from './daily-plan-rules';

// Москва = UTC+3 (фиксированный сдвиг). Берём полдень по Москве 24.07.2026.
const NOW = new Date('2026-07-24T09:00:00Z');

function order(p: Partial<PlanOrder> & { numberOrder: string }): PlanOrder {
  return {
    deadline: null,
    createdAt: NOW,
    isUrgent: false,
    items: [],
    ...p,
  };
}

const overdue = order({
  numberOrder: 'A-OVERDUE',
  deadline: new Date('2026-07-22T09:00:00Z'),
});
const today = order({
  numberOrder: 'A-TODAY',
  deadline: new Date('2026-07-24T20:00:00Z'),
});
const future = order({
  numberOrder: 'A-FUTURE',
  deadline: new Date('2026-07-28T09:00:00Z'),
});
const urgent = order({
  numberOrder: 'A-URGENT',
  deadline: new Date('2026-07-28T09:00:00Z'),
  isUrgent: true,
});

describe('daily-plan priority', () => {
  it('срочный всплывает выше просроченного, сегодняшнего и будущего', () => {
    expect(priorityKey(urgent, NOW)).toBeLessThan(priorityKey(overdue, NOW));
    expect(priorityKey(overdue, NOW)).toBeLessThan(priorityKey(today, NOW));
    expect(priorityKey(today, NOW)).toBeLessThan(priorityKey(future, NOW));
  });

  it('маркеры по накалу: 🔥 срочный, 🔴 просрочен, 🟠 сегодня, 🟢 будущее', () => {
    expect(orderMarker(urgent, NOW)).toBe('🔥');
    expect(orderMarker(overdue, NOW)).toBe('🔴');
    expect(orderMarker(today, NOW)).toBe('🟠');
    expect(orderMarker(future, NOW)).toBe('🟢');
  });
});

describe('summarizeItems', () => {
  it('складывает количество по формату', () => {
    expect(
      summarizeItems([
        { formatPaper: '10×15', quantity: 20 },
        { formatPaper: '10×15', quantity: 5 },
        { formatPaper: 'Polaroid', quantity: 3 },
      ]),
    ).toBe('10×15 ×25, Polaroid ×3');
  });

  it('пустой состав — метка «(без позиций)»', () => {
    expect(summarizeItems([])).toBe('(без позиций)');
  });
});

describe('buildDailyPlanMessage', () => {
  const maksim = {
    executor: { username: 'maksim', telegramUsername: 'maksim_tg' },
    orders: [future, urgent], // намеренно не по порядку
  };
  const lesha = {
    executor: { username: 'lesha', telegramUsername: null },
    orders: [today],
  };

  it('исполнитель с самой горящей задачей идёт первым, внутри — срочное сверху', () => {
    const msg = buildDailyPlanMessage([lesha, maksim], NOW, 0);
    // maksim (срочный) выше lesha (только сегодня)
    expect(msg.indexOf('maksim_tg')).toBeLessThan(msg.indexOf('lesha'));
    // внутри maksim: срочный заказ выше будущего
    expect(msg.indexOf('A-URGENT')).toBeLessThan(msg.indexOf('A-FUTURE'));
  });

  it('содержит заголовок дня, упоминания и маркеры', () => {
    const msg = buildDailyPlanMessage([maksim, lesha], NOW, 0);
    expect(msg).toContain('План на 24.07');
    expect(msg).toContain('@maksim_tg'); // ник → упоминание с @
    expect(msg).toContain('lesha'); // без ника — по имени
    expect(msg).toContain('🔥');
    expect(msg).toContain('СРОЧНО');
  });

  it('показывает предупреждение о заказах без исполнителя', () => {
    const msg = buildDailyPlanMessage([maksim], NOW, 2);
    expect(msg).toContain('Без исполнителя');
    expect(msg).toContain('2');
  });
});
