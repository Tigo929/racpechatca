import { buildPartnerCaption, calcSettlement } from './partner-telegram-format';
import { EnumStatus } from 'src/generated/prisma/enums';

/**
 * Подпись под заданием переписывается при каждом нажатии кнопки статуса.
 * Пока она собиралась из одних позиций-футболок, заказ без них после
 * первого же «В работе» терял состав и превращался в бланк с номером:
 * исполнитель переставал видеть и что печатать, и сколько он за это
 * получит.
 */
describe('подпись задания исполнителю', () => {
  const transferOrder = {
    numberOrder: '20261108-049',
    status: EnumStatus.IN_PROGRESS,
    tshirtItems: [],
    items: [
      {
        formatPaper: 'Печать термотрансферов',
        pricePosition: 800,
        quantity: 10,
        printOnClientItem: false,
        thermalCost: 0,
        partnerPayout: 'REVENUE_SHARE' as const,
        partnerRateBasisPoints: 3000,
      },
    ],
  };

  it('заказ из одних термотрансферов сохраняет состав и заработок', () => {
    const caption = buildPartnerCaption(transferOrder, 3000);

    expect(caption).toContain('20261108-049');
    expect(caption).toContain('Печать термотрансферов');
    expect(caption).toContain('240 ₽'); // 30% от 800
  });

  it('итог считается общим модулем расчёта, а не своей формулой', () => {
    // Своя копия арифметики округляла в другую сторону: в подписи
    // исполнитель видел одну сумму, в выплате получал другую.
    const s = calcSettlement(transferOrder, 3000);
    expect(s.reward).toBe(240);
    expect(s.totalMaterials).toBe(0);
  });

  it('позиция без выплаты показывается, но заработка не обещает', () => {
    const caption = buildPartnerCaption(
      {
        ...transferOrder,
        items: [
          {
            formatPaper: 'Кружка с принтом',
            pricePosition: 700,
            quantity: 1,
            printOnClientItem: false,
            thermalCost: 0,
            partnerPayout: 'NONE' as const,
            partnerRateBasisPoints: null,
          },
        ],
      },
      3000,
    );
    expect(caption).not.toContain('Кружка с принтом');
    expect(caption).toContain('0 ₽');
  });
});
