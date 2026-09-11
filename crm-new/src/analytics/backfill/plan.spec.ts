import { planOrder, type OrderSnapshot } from './plan';

/**
 * План на один заказ: колонка важнее истории, пустое заполняем,
 * расхождение — конфликт без записи, второй прогон — ноль изменений.
 */
function order(over: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'o1',
    numberOrder: '2026-09-01-001',
    note: null,
    yandexClientId: null,
    yclid: null,
    conversionPageUrl: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    clientPaidAt: null,
    tshirtItems: [],
    statusHistory: [],
    ...over,
  };
}

const NOTE =
  '🆕 Заявка с сайта\nyclid: 1133445566778899\nYandex ClientID: 17841234567890\nСтраница: https://raspechatkaa.ru/interer/holst';
const PAID = new Date('2026-08-20T10:00:00Z');

describe('план backfill для заказа', () => {
  it('пустые колонки заполняются из истории', () => {
    const plan = planOrder(
      order({
        note: NOTE,
        statusHistory: [
          { toStatus: 'NEW', createdAt: new Date('2026-08-19T10:00:00Z') },
          { toStatus: 'PAID', createdAt: PAID },
        ],
      }),
    );
    expect(plan.patch).toEqual({
      yandexClientId: '17841234567890',
      yclid: '1133445566778899',
      conversionPageUrl: 'https://raspechatkaa.ru/interer/holst',
      clientPaidAt: PAID,
    });
    expect(plan.stats.yandexClientId.fill).toBe(1);
    expect(plan.stats.clientPaidAt.fill).toBe(1);
    expect(plan.conflicts).toEqual([]);
  });

  it('заполненная колонка, совпадающая с историей, не трогается', () => {
    const plan = planOrder(order({ note: NOTE, yandexClientId: '17841234567890' }));
    expect(plan.patch.yandexClientId).toBeUndefined();
    expect(plan.stats.yandexClientId.alreadyStructured).toBe(1);
    expect(plan.stats.yandexClientId.fill).toBe(0);
  });

  it('расхождение колонки и истории — конфликт, записи нет', () => {
    const plan = planOrder(order({ note: NOTE, yandexClientId: '999' }));
    expect(plan.patch.yandexClientId).toBeUndefined();
    expect(plan.stats.yandexClientId.conflicts).toBe(1);
    expect(plan.conflicts).toEqual([
      { orderId: 'o1', numberOrder: '2026-09-01-001', field: 'yandexClientId' },
    ]);
  });

  it('clientPaidAt уже стоит — история его не меняет, даже если дата другая', () => {
    const existing = new Date('2026-08-01T00:00:00Z');
    const plan = planOrder(
      order({ clientPaidAt: existing, statusHistory: [{ toStatus: 'PAID', createdAt: PAID }] }),
    );
    expect(plan.patch.clientPaidAt).toBeUndefined();
    expect(plan.stats.clientPaidAt.conflicts).toBe(1);
  });

  it('заказ без истории и без маркеров — пустой план', () => {
    const plan = planOrder(order({ note: 'Позвонить после 18:00' }));
    expect(plan.patch).toEqual({});
    expect(plan.conflicts).toEqual([]);
  });

  it('UTM футболок: полные три метки заполняют поля, utmContent/utmTerm не трогаются', () => {
    const plan = planOrder(
      order({ tshirtItems: [{ designNote: 'Крой: оверсайз. Источник: yandex / cpc / camp' }] }),
    );
    expect(plan.patch).toEqual({ utmSource: 'yandex', utmMedium: 'cpc', utmCampaign: 'camp' });
    expect(plan.stats.utmContent.found).toBe(0);
    expect(plan.utmAmbiguous).toBe(false);
  });

  it('UTM футболок: две метки — только source и пометка неоднозначности', () => {
    const plan = planOrder(order({ tshirtItems: [{ designNote: 'Источник: yandex / camp' }] }));
    expect(plan.patch).toEqual({ utmSource: 'yandex' });
    expect(plan.utmAmbiguous).toBe(true);
  });

  it('повреждённый маркер — в parseFailures, поле не заполняется', () => {
    const plan = planOrder(order({ note: 'Yandex ClientID: abc' }));
    expect(plan.patch.yandexClientId).toBeUndefined();
    expect(plan.stats.yandexClientId.parseFailures).toBe(1);
  });

  it('идемпотентность: применили план — второй план пуст', () => {
    const first = order({ note: NOTE, statusHistory: [{ toStatus: 'PAID', createdAt: PAID }] });
    const plan1 = planOrder(first);
    const after = order({ ...first, ...plan1.patch });
    const plan2 = planOrder(after);
    expect(plan2.patch).toEqual({});
    expect(plan2.conflicts).toEqual([]);
    expect(plan2.stats.yandexClientId.alreadyStructured).toBe(1);
    expect(plan2.stats.clientPaidAt.alreadyStructured).toBe(1);
  });
});
