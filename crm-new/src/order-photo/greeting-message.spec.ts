import {
  deliveryLine,
  greetingFor,
  itemsList,
  money,
  renderGreeting,
} from './greeting-message';

/**
 * Текст, который клиент видит дословно.
 *
 * Ошибка здесь не ломает систему — она приходит человеку в мессенджер и
 * остаётся там навсегда. Один такой случай уже был: в сообщение уходила
 * сама метка «{{ДОСТАВКА}}», потому что воркер собирали со старым кодом,
 * а шаблон был новый.
 */
describe('первое сообщение клиенту', () => {
  const base = {
    name: 'Полина',
    numberOrder: '1043',
    category: 'PHOTO',
    items: [{ title: 'Фото 10×15 с полями', quantity: 10 }],
    total: 2790,
    deliveryMethod: 'YANDEX_PVZ',
    deliveryCost: 300,
  };

  it('в тексте не остаётся ни одной метки', () => {
    const text = renderGreeting(base);
    expect(text).not.toMatch(/\{\{|\}\}/u);
    expect(text).not.toContain('{greeting}');
  });

  it('доставка названа способом и суммой', () => {
    expect(renderGreeting(base)).toContain('Доставка Яндекс ПВЗ — 300 ₽');
  });

  it('в тексте есть номер заказа', () => {
    // Номер нужен клиенту, чтобы сослаться на заказ в переписке.
    expect(renderGreeting(base)).toContain('№1043');
  });

  it('самовывоз назван бесплатным, а не пропущен', () => {
    // Пустая строка оставила бы дыру между списком и суммой.
    const text = renderGreeting({ ...base, deliveryMethod: 'PICKUP', deliveryCost: 0 });
    expect(text).toContain('Самовывоз — бесплатно');
  });

  it('нулевая доставка у ПВЗ — это подарок, а не неизвестность', () => {
    // CRM обнуляет доставку сама, когда сумма достаёт до порога.
    expect(deliveryLine('YANDEX_PVZ', 0)).toContain('бесплатно');
    expect(deliveryLine('YANDEX_PVZ', 0)).toContain('Яндекс ПВЗ');
  });

  it('сумма с пробелами между разрядами', () => {
    expect(money(2790)).toBe('2 790');
    expect(money(1234567)).toBe('1 234 567');
    expect(money(0)).toBe('—');
  });

  it('обращение без имени не превращается в «Здравствуйте, !»', () => {
    expect(greetingFor(null)).toBe('Здравствуйте!');
    expect(greetingFor('  ')).toBe('Здравствуйте!');
    expect(greetingFor('Пётр')).toBe('Здравствуйте, Пётр!');
  });

  it('список позиций — по строке на позицию', () => {
    const out = itemsList([
      { title: 'Polaroid', quantity: 20 },
      { title: 'Фото 10×15', quantity: 50 },
    ]);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).toContain('• Polaroid — 20 шт.');
  });

  it('заказ без позиций не оставляет пустую строку', () => {
    expect(itemsList([])).toContain('уточним состав');
  });

  it('у каждого направления свой следующий шаг', () => {
    expect(renderGreeting({ ...base, category: 'PHOTO' })).toContain('фотографии');
    expect(renderGreeting({ ...base, category: 'CANVAS' })).toContain('холсте');
    expect(renderGreeting({ ...base, category: 'TSHIRT' })).toContain('футболке');
  });

  it('незнакомое направление получает общий текст, а не пустоту', () => {
    const text = renderGreeting({ ...base, category: 'ЧТО-ТО' });
    expect(text).toContain('Получили вашу заявку');
    expect(text).not.toMatch(/\{\{/u);
  });
});
