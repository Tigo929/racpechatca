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
    inWork: [future, urgent], // намеренно не по порядку
    ready: [
      { numberOrder: 'R-SHIP', deliveryMethod: 'YANDEX_PVZ', items: [] },
      { numberOrder: 'R-PICKUP', deliveryMethod: 'PICKUP', items: [] },
    ],
  };
  const lesha = {
    executor: { username: 'lesha', telegramUsername: null },
    inWork: [today],
    ready: [],
  };

  it('исполнитель с самой горящей задачей идёт первым, внутри — срочное сверху', () => {
    const msg = buildDailyPlanMessage([lesha, maksim], NOW, []);
    // maksim (срочный) выше lesha (только сегодня)
    expect(msg.indexOf('maksim_tg')).toBeLessThan(msg.indexOf('lesha'));
    // внутри maksim: срочный заказ выше будущего
    expect(msg.indexOf('A-URGENT')).toBeLessThan(msg.indexOf('A-FUTURE'));
  });

  it('содержит заголовок дня, упоминания и маркеры', () => {
    const msg = buildDailyPlanMessage([maksim, lesha], NOW, []);
    expect(msg).toContain('План на 24.07');
    expect(msg).toContain('@maksim_tg'); // ник → упоминание с @
    expect(msg).toContain('lesha'); // без ника — по имени
    expect(msg).toContain('🔥');
    expect(msg).toContain('СРОЧНО');
  });

  it('блок «Готовы»: отгрузка помечена 🚚 и способом, самовывоз — 📦', () => {
    const msg = buildDailyPlanMessage([maksim], NOW, []);
    expect(msg).toContain('Готовы (2)');
    expect(msg).toContain('🚚');
    expect(msg).toContain('отгрузить · Яндекс ПВЗ');
    expect(msg).toContain('📦');
    expect(msg).toContain('самовывоз');
    // отгрузка идёт раньше самовывоза
    expect(msg.indexOf('R-SHIP')).toBeLessThan(msg.indexOf('R-PICKUP'));
  });

  it('исполнитель только с готовыми заказами тоже попадает в план', () => {
    const readyOnly = {
      executor: { username: 'ready_guy', telegramUsername: null },
      inWork: [],
      ready: [{ numberOrder: 'R-ONLY', deliveryMethod: 'PICKUP', items: [] }],
    };
    const msg = buildDailyPlanMessage([readyOnly], NOW, []);
    expect(msg).toContain('ready_guy');
    expect(msg).toContain('R-ONLY');
  });

  it('блок нераспределённых: список заказов + тег диспетчера, срочное сверху', () => {
    const unOverdue = order({
      numberOrder: 'U-OVERDUE',
      deadline: new Date('2026-07-22T09:00:00Z'),
    });
    const unFuture = order({
      numberOrder: 'U-FUTURE',
      deadline: new Date('2026-07-28T09:00:00Z'),
    });
    const msg = buildDailyPlanMessage([maksim], NOW, [unFuture, unOverdue], 'gts224');
    expect(msg).toContain('Без исполнителя (2)');
    expect(msg).toContain('@gts224'); // тег диспетчера
    expect(msg).toContain('назначьте');
    // просроченный нераспределённый выше будущего
    expect(msg.indexOf('U-OVERDUE')).toBeLessThan(msg.indexOf('U-FUTURE'));
  });

  it('тег диспетчера необязателен: без него просто список без «назначьте»', () => {
    const msg = buildDailyPlanMessage([maksim], NOW, [today]);
    expect(msg).toContain('Без исполнителя (1)');
    expect(msg).not.toContain('назначьте');
  });
});
