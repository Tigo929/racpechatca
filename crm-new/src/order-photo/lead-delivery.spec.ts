import { EnumDeliveryMethod } from 'src/generated/prisma/enums';
import { YANDEX_PVZ_DELIVERY_COST, leadDeliveryCost } from './lead-delivery';

/**
 * Стоимость доставки в заявке.
 *
 * Цена попадает не только в заказ, но и в сообщение клиенту, которое
 * уходит через секунды. Ошибка здесь — это названная клиенту сумма,
 * которая потом изменится, а такое он запоминает надолго.
 */
describe('доставка в заявке с сайта', () => {
  it('Яндекс ПВЗ стоит 300 ₽', () => {
    expect(leadDeliveryCost(EnumDeliveryMethod.YANDEX_PVZ)).toBe(300);
    expect(YANDEX_PVZ_DELIVERY_COST).toBe(300);
  });

  it('самовывоз бесплатен', () => {
    // Ноль здесь — настоящая цена, а не «не посчитали».
    expect(leadDeliveryCost(EnumDeliveryMethod.PICKUP)).toBe(0);
  });

  it('неизвестный способ не добавляет доплату', () => {
    // Выдумывать доплату там, где способ не распознан, значит завышать
    // чек молча — хуже, чем не взять денег.
    expect(leadDeliveryCost('ЧТО-ТО' as EnumDeliveryMethod)).toBe(0);
  });
});
