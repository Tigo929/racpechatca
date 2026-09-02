import { buildPartnerOrderPayload } from './partner-payload';

/**
 * Печать на изделии заказчика заводится свободной позицией: своей футболки
 * в заказе нет. Задание партнёра должно её показывать — иначе печатник видит
 * пустой список и не знает, что делать, хотя работа есть.
 */
function baseOrder() {
  return {
    id: 'o1',
    numberOrder: '20260828-001',
    note: null,
    status: 'NEW',
    totalOrder: 2000,
    deliveryMethod: 'PICKUP',
    techSpecPhotoPath: null,
    tshirtItems: [],
    items: [
      {
        formatPaper: 'Нанесение принта на изделие заказчика',
        quantity: 2,
        pricePosition: 2000,
        printOnClientItem: true,
        thermalCost: 70,
      },
    ],
  };
}

describe('задание партнёру: печать на изделии заказчика', () => {
  it('свободная позиция попадает в список работ', () => {
    const payload = buildPartnerOrderPayload(baseOrder(), 'https://x', 3000);

    expect(payload.items).toHaveLength(1);
    const item = payload.items[0];
    expect(item.client_item).toBe(true);
    expect(item.print_location_label).toBe('Изделие заказчика');
    expect(item.print_type_label).toContain('изделие заказчика');
    // Свободная цена: итог за позицию, на количество не умножается.
    expect(item.line_total).toBe(2000);
    expect(item.quantity).toBe(2);
  });

  it('со склада партнёра ничего не списывается', () => {
    const payload = buildPartnerOrderPayload(baseOrder(), 'https://x', 3000);
    // Заготовок нет: изделие принёс клиент.
    expect(payload.stock.total_quantity).toBe(0);
  });

  it('обычная свободная позиция (кружка) в задание не идёт', () => {
    const order = baseOrder();
    order.items[0].printOnClientItem = false;
    order.items[0].formatPaper = 'Кружка';
    const payload = buildPartnerOrderPayload(order, 'https://x', 3000);
    expect(payload.items).toHaveLength(0);
  });
});
