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
    const msg = buildDailyPlanMessage([lesha, maksim], NOW, 0);
    // maksim (срочный) выше lesha (только сегодня)
    expect(msg.indexOf('maksim_tg')).toBeLessThan(msg.indexOf('lesha'));
    // внутри maksim: срочный заказ выше будущего
    expect(msg.indexOf('A-URGENT')).toBeLessThan(msg.indexOf('A-FUTURE'));
  });

  it('содержит заголовок дня, упоминания и маркеры', () => {
    const msg = buildDailyPlanMessage([maksim, lesha], NOW, 0);
    expect(msg).toContain('ПЛАН НА 24.07');
    expect(msg).toContain('@maksim_tg'); // ник → упоминание с @
    expect(msg).toContain('lesha'); // без ника — по имени
    expect(msg).toContain('🔥');
    expect(msg).toContain('СРОЧНО');
  });

  it('у исполнителя «Готовы к выдаче» — только самовывоз, без дублей отгрузок', () => {
    const msg = buildDailyPlanMessage([maksim], NOW, 0);
    // У maksim готовы 2 заказа, но отгрузочный ушёл в блок «Отгрузки».
    expect(msg).toContain('Готовы к выдаче (1)');
    expect(msg).toContain('📦');
    const executorPart = msg.slice(0, msg.indexOf('ОТГРУЗКИ'));
    expect(executorPart).not.toContain('R-SHIP');
    // Отгрузочный заказ упомянут ровно один раз — в блоке отгрузок.
    expect(msg.split('R-SHIP').length - 1).toBe(1);
  });

  it('исполнитель только с готовыми к выдаче заказами попадает в план', () => {
    const readyOnly = {
      executor: { username: 'ready_guy', telegramUsername: null },
      inWork: [],
      ready: [{ numberOrder: 'R-ONLY', deliveryMethod: 'PICKUP', items: [] }],
    };
    const msg = buildDailyPlanMessage([readyOnly], NOW, 0);
    expect(msg).toContain('ready_guy');
    expect(msg).toContain('R-ONLY');
  });

  it('исполнителя, у которого только отгрузки, в блоке исполнителей нет', () => {
    const shipOnly = {
      executor: { username: 'ship_guy', telegramUsername: null },
      inWork: [],
      ready: [{ numberOrder: 'R-S', deliveryMethod: 'YANDEX_PVZ', items: [] }],
    };
    const msg = buildDailyPlanMessage([shipOnly], NOW, 0, null);
    // Имя не мелькает отдельным пустым блоком, а заказ виден в «Отгрузках».
    expect(msg).not.toContain('ship_guy');
    expect(msg).toContain('R-S');
  });

  it('ручной вызов: нейтральный заголовок со временем вместо «доброе утро»', () => {
    const manual = buildDailyPlanMessage([maksim], NOW, 0, null, { manual: true });
    expect(manual).toContain('ПРОВЕРКА ПО ЗАКАЗАМ');
    expect(manual).toContain('24.07, 12:00'); // NOW = 12:00 по Москве
    expect(manual).not.toContain('Доброе утро');

    const scheduled = buildDailyPlanMessage([maksim], NOW, 0);
    expect(scheduled).toContain('Доброе утро');
    expect(scheduled).not.toContain('ПРОВЕРКА ПО ЗАКАЗАМ');
  });

  it('показывает предупреждение о заказах без исполнителя', () => {
    const msg = buildDailyPlanMessage([maksim], NOW, 2);
    expect(msg).toContain('Без исполнителя');
    expect(msg).toContain('2');
  });

  describe('блок отгрузок (старший дня)', () => {
    const lead = { username: 'boss', telegramUsername: 'boss_tg' };

    it('тегает старшего и перечисляет только заказы с отгрузкой (без самовывоза)', () => {
      const msg = buildDailyPlanMessage([maksim], NOW, 0, lead);
      expect(msg).toContain('ОТГРУЗКИ');
      expect(msg).toContain('@boss_tg');
      expect(msg).toContain('R-SHIP'); // Яндекс ПВЗ — нужна поставка
      // Самовывоз (R-PICKUP) в блок отгрузок не попадает
      const shipmentPart = msg.slice(msg.indexOf('ОТГРУЗКИ'));
      expect(shipmentPart).not.toContain('R-PICKUP');
    });

    it('без старшего, но при наличии отгрузок — предупреждение «не назначен»', () => {
      const msg = buildDailyPlanMessage([maksim], NOW, 0, null);
      expect(msg).toContain('ОТГРУЗКИ');
      expect(msg).toContain('не назначен');
    });

    it('если все готовые — самовывоз, блока отгрузок нет', () => {
      const pickupOnly = {
        executor: { username: 'p', telegramUsername: null },
        inWork: [],
        ready: [{ numberOrder: 'R-PU', deliveryMethod: 'PICKUP', items: [] }],
      };
      const msg = buildDailyPlanMessage([pickupOnly], NOW, 0, lead);
      expect(msg).not.toContain('ОТГРУЗКИ');
    });
  });
});
