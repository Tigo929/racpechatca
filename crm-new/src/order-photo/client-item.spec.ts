import { isClientItemPosition } from './client-item';

describe('печать на изделии клиента', () => {
  it('по флагу', () => {
    expect(
      isClientItemPosition({ printOnClientItem: true, formatPaper: 'Печать' }),
    ).toBe(true);
  });

  it('по названию — даже если партнёру «не платим» (заказ 20261125-191)', () => {
    expect(
      isClientItemPosition({
        printOnClientItem: false,
        formatPaper: 'Нанесение принта на изделие заказчика',
      }),
    ).toBe(true);
    expect(
      isClientItemPosition({ formatPaper: 'печать на изделии клиента' }),
    ).toBe(true);
  });

  it('обычная позиция — нет', () => {
    expect(
      isClientItemPosition({
        printOnClientItem: false,
        formatPaper: 'Печать термотрансферов',
      }),
    ).toBe(false);
    expect(isClientItemPosition({ formatPaper: null })).toBe(false);
  });
});
