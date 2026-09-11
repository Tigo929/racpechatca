import { costSettingsFrom, orderCostOfGoods, type CostSettings } from './order-cogs';
import { addOrder, emptyBucket, finalize, type OrderRow } from './reports.service';

/**
 * Себестоимость заказа: одна функция на отчёт и на Метрику (этап 06,
 * разделы 25–27, 58). Тесты держат равенство: что отчёт кладёт в
 * себестоимость периода, то же число уходит в Метрику как `cost`.
 */
const SETTINGS: CostSettings = costSettingsFrom(null);

function row(partial: Partial<OrderRow>): OrderRow {
  return {
    sentAt: null,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    clientPaidAt: null,
    completedAt: null,
    statusChangedAt: null,
    totalOrder: 0,
    deliveryCost: 0,
    deliveryMethod: 'PICKUP',
    productCategory: 'PHOTO',
    items: [],
    tshirtItems: [],
    canvasItems: [],
    accruals: [],
    ...partial,
  };
}

const PHOTO = row({
  productCategory: 'PHOTO',
  totalOrder: 1200,
  deliveryCost: 300,
  deliveryMethod: 'YANDEX_PVZ',
  items: [
    { formatPaper: '10x15', quantity: 37, pricePosition: 740, printOnClientItem: false, thermalCost: 0 },
    { formatPaper: 'Polaroid', quantity: 11, pricePosition: 330, printOnClientItem: false, thermalCost: 0 },
  ],
});

const TSHIRT = row({
  productCategory: 'TSHIRT',
  totalOrder: 3400,
  tshirtItems: [
    { pricePosition: 1700, quantity: 1, designCost: 300, thermalCost: 70, blankCost: 450, clientItem: false },
    { pricePosition: 1200, quantity: 1, designCost: 0, thermalCost: 70, blankCost: 0, clientItem: true },
  ],
  items: [
    // Печать на изделии заказчика — тоже работа партнёра.
    { formatPaper: '', quantity: 1, pricePosition: 500, printOnClientItem: true, thermalCost: 70 },
  ],
});

const CANVAS = row({
  productCategory: 'CANVAS',
  totalOrder: 6828,
  deliveryCost: 800,
  deliveryMethod: 'PRODUCTION_MSK',
  canvasItems: [{ contractorCostPosition: 3900 }, { contractorCostPosition: 1652 }],
});

describe('паритет с P&L-отчётом', () => {
  it('фото: бумага в копейках и рубли совпадают с тем, что копит отчёт', () => {
    const b = emptyBucket();
    addOrder(b, PHOTO, SETTINGS);
    const cogs = orderCostOfGoods(PHOTO, SETTINGS);
    expect(cogs.photoMaterialKopecks).toBe(b.photoMaterialKopecks);
    expect(cogs.rub).toBe(Math.ceil(b.photoMaterialKopecks / 100));
    // 37 листов 10×15 + 6 листов под 11 полароидов = 43 листа по 160 коп.
    expect(cogs.photoMaterialKopecks).toBe(43 * 160);
    expect(cogs.rub).toBe(69);
    expect(cogs.reliable).toBe(true);
    // Прибыль по фото в отчёте считается через то же число.
    expect(b.photoProfit).toBe(1200 - 300 - 69 - 0 + (300 - 99));
  });

  it('футболки: себестоимость = вознаграждение партнёру, как в отчёте', () => {
    const b = emptyBucket();
    addOrder(b, TSHIRT, SETTINGS);
    const cogs = orderCostOfGoods(TSHIRT, SETTINGS);
    expect(cogs.rub).toBe(b.tshirtContractorCost);
    expect(cogs.tshirtContractorCost).toBe(b.tshirtContractorCost);
    expect(cogs.reliable).toBe(true);
    expect(b.tshirtProfit).toBe(3400 - cogs.rub);
    // Одна и та же сумма попадает в cogs периода.
    expect(finalize(b).cogs).toBe(cogs.rub);
  });

  it('холсты: себестоимость = цена подрядчика по позициям, как в отчёте', () => {
    const b = emptyBucket();
    addOrder(b, CANVAS, SETTINGS);
    const cogs = orderCostOfGoods(CANVAS, SETTINGS);
    expect(cogs.rub).toBe(3900 + 1652);
    expect(cogs.canvasContractorCost).toBe(b.canvasContractorCost);
    expect(finalize(b).cogs).toBe(cogs.rub);
    expect(cogs.reliable).toBe(true);
  });

  it('три заказа вместе: cogs периода = сумма cogs по заказам', () => {
    const b = emptyBucket();
    for (const o of [PHOTO, TSHIRT, CANVAS]) addOrder(b, o, SETTINGS);
    const sum = [PHOTO, TSHIRT, CANVAS].reduce(
      (s, o) => s + orderCostOfGoods(o, SETTINGS).rub,
      0,
    );
    // Отчёт округляет копейки бумаги один раз за период; у одного фотозаказа
    // это то же самое, что округлить по заказу.
    expect(finalize(b).cogs).toBe(sum);
  });
});

describe('надёжность себестоимости', () => {
  it('нет позиций — число не считается надёжным, наружу не отдаётся', () => {
    expect(orderCostOfGoods(row({ productCategory: 'PHOTO' }), SETTINGS)).toMatchObject({
      rub: 0,
      reliable: false,
    });
    expect(orderCostOfGoods(row({ productCategory: 'TSHIRT' }), SETTINGS).reliable).toBe(false);
    expect(orderCostOfGoods(row({ productCategory: 'CANVAS' }), SETTINGS).reliable).toBe(false);
  });

  it('неизвестная категория — ноль и ненадёжно', () => {
    expect(orderCostOfGoods(row({ productCategory: 'OTHER' }), SETTINGS)).toEqual({
      rub: 0,
      photoMaterialKopecks: 0,
      tshirtContractorCost: 0,
      canvasContractorCost: 0,
      reliable: false,
    });
  });
});

describe('настройки себестоимости', () => {
  it('без строки настроек — значения по умолчанию отчёта', () => {
    expect(costSettingsFrom(null)).toEqual({
      sheetCostKopecks: 160,
      deliveryCostYandexPvz: 99,
      deliveryCostOzonPvz: 140,
      canvasDeliveryCost: 700,
      partnerRateBasisPoints: 3000,
    });
  });

  it('строка настроек переопределяет цены', () => {
    expect(
      costSettingsFrom({
        photoBoxCost: 1000,
        photoSheetsPerBox: 500,
        partnerRateBasisPoints: 2500,
      }),
    ).toMatchObject({ sheetCostKopecks: 200, partnerRateBasisPoints: 2500 });
  });
});
