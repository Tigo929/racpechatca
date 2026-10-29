import { automaticStatusError } from './status-automatic';

/**
 * Статусы, которые ставит система.
 *
 * Проверяется не текст отказа, а граница: что запрещено руками и, не менее
 * важно, что по-прежнему разрешено. Лишний запрет здесь — заказ, который
 * некому сдвинуть, и это хуже случайного щелчка.
 */
describe('статусы, которые ставит система', () => {
  const tshirt = { productCategory: 'TSHIRT', isMarketplacePrint: false };
  const marketplace = { productCategory: 'TSHIRT', isMarketplacePrint: true };
  const photo = { productCategory: 'PHOTO', isMarketplacePrint: false };
  const canvas = { productCategory: 'CANVAS', isMarketplacePrint: false };

  it('«Передан в производство» у футболки руками не ставится', () => {
    expect(automaticStatusError(tshirt, 'SENT')).toContain('ТЗ');
    expect(automaticStatusError(marketplace, 'SENT')).toContain('ТЗ');
  });

  it('«В работе» у футболки ставит исполнитель', () => {
    expect(automaticStatusError(tshirt, 'IN_PROGRESS')).toContain('исполнитель');
    expect(automaticStatusError(marketplace, 'IN_PROGRESS')).toContain(
      'исполнитель',
    );
  });

  it('«Отгружен» подтверждает площадка, а не человек', () => {
    expect(automaticStatusError(marketplace, 'COMPLETED')).toContain('Ozon');
  });

  it('у фото «Отправлен» — ручной шаг: по нему начисляется зарплата', () => {
    // Тот же EnumStatus.SENT, но смысл другой: «отправлен клиенту».
    // Запретить его значило бы остановить выдачу заказов и начисления.
    expect(automaticStatusError(photo, 'SENT')).toBeNull();
    expect(automaticStatusError(photo, 'IN_PROGRESS')).toBeNull();
  });

  it('у холста «У подрядчика» ставит человек — автоматики там нет', () => {
    expect(automaticStatusError(canvas, 'SENT')).toBeNull();
    expect(automaticStatusError(canvas, 'IN_PROGRESS')).toBeNull();
  });

  it('«Отгружен» у заказа не с площадки не запрещаем', () => {
    // Подтверждать такую отгрузку некому: Ozon о заказе не знает.
    expect(automaticStatusError(tshirt, 'COMPLETED')).toBeNull();
  });

  it('остальные шаги футболки остаются за человеком', () => {
    for (const next of ['NEW', 'APPROVAL_SENT', 'READY', 'CANCELLED', 'PAID']) {
      expect(automaticStatusError(tshirt, next)).toBeNull();
    }
  });

  it('отмена доступна всегда — ею выходят из застрявшего заказа', () => {
    expect(automaticStatusError(marketplace, 'CANCELLED')).toBeNull();
  });
});
