import { leadCanvasPosition } from './lead-canvas-position';
import {
  canvasRetailPrice,
  canvasWholesalePrice,
} from 'src/canvas/canvas-production-price';

/**
 * Заявка на холст с сайта должна приходить с себестоимостью.
 *
 * Было: позиция заводилась с ценой производства 0 ₽ — её брали из
 * витринного прайса, где это поле стояло нулём у всех 46 размеров.
 * Последствия владелец видел так: в карточке «должен производству 0 ₽»,
 * прибыль равна всей выручке, расход на подрядчика не создавался вовсе
 * (его создают только при себестоимости больше нуля), и по заказу нельзя
 * было сказать, заработали на нём или отдали больше, чем взяли.
 *
 * Поэтому проверки здесь — про деньги, а не про форму объекта.
 */

/** 20×30 синтетика: розница 630, опт 470 — живой пример из прайса. */
const SIZE = '20x30';
const RETAIL_PRICE = canvasRetailPrice(SIZE, 'SYNTHETIC');
const WHOLESALE_PRICE = canvasWholesalePrice(SIZE, 'SYNTHETIC');

describe('позиция холста из заявки с сайта', () => {
  it('себестоимость берётся из прайса, а не из нуля', () => {
    const item = leadCanvasPosition({
      sizeKey: SIZE,
      sizeLabel: '20×30 см',
      quantity: 1,
      unitPrice: RETAIL_PRICE,
    });

    expect(item.contractorPrice).toBe(WHOLESALE_PRICE);
    expect(item.contractorCostPosition).toBe(WHOLESALE_PRICE);
    // Главное: заработок — розница минус опт, а не вся выручка.
    expect(item.profitPosition).toBe(RETAIL_PRICE - WHOLESALE_PRICE);
    expect(item.profitPosition).not.toBe(item.pricePosition);
  });

  it('размер и материал ложатся ключами — цена поедет за размером', () => {
    /*
      Без ключа менеджер видел позицию как нестандартную: прайс к ней не
      применялся, смена размера цену не меняла, и заказ уезжал в работу
      с суммой за прежний размер.
    */
    const item = leadCanvasPosition({
      sizeKey: SIZE,
      sizeLabel: '20×30 см',
      quantity: 2,
      unitPrice: RETAIL_PRICE,
    });

    expect(item.sizeKey).toBe(SIZE);
    expect(item.material).toBe('SYNTHETIC');
    expect(item.formatCanvas).toBe('20 × 30 см, синтетика');
    expect(item.pricePosition).toBe(RETAIL_PRICE * 2);
    expect(item.contractorCostPosition).toBe(WHOLESALE_PRICE * 2);
  });

  it('багет уезжает в свой доп, итог клиенту не меняется', () => {
    /*
      Сайт складывает полотно и багет в одну цену. Оставить её как есть —
      значит получить холст 20×30 за 2130 ₽ при прайсе 630: сверить такую
      цифру не с чем. Разложенная позиция показывает и полотно, и багет,
      а себестоимость багета владелец вписывает руками: прайс производства
      на холсты цены багета не содержит.
    */
    const unitPrice = RETAIL_PRICE + 1500;
    const item = leadCanvasPosition({
      sizeKey: SIZE,
      frame: 'WOOD',
      quantity: 1,
      unitPrice,
    });

    expect(item.clientPrice).toBe(RETAIL_PRICE);
    expect(item.frame).toBe(true);
    expect(item.frameClientPrice).toBe(1500);
    // Клиенту назвали ровно столько — разложенная позиция это не меняет.
    expect(item.pricePosition).toBe(unitPrice);
  });

  it('глянцевая основа: клиенту дороже, долг производству тот же', () => {
    // Надбавка за глянец — наш заработок: производство берёт за полотно
    // столько же, и вычитать надбавку из цены клиента нельзя.
    const unitPrice = 720;
    const item = leadCanvasPosition({ sizeKey: SIZE, quantity: 1, unitPrice });
    expect(item.clientPrice).toBe(unitPrice);
    expect(item.contractorPrice).toBe(WHOLESALE_PRICE);
    expect(item.profitPosition).toBe(unitPrice - WHOLESALE_PRICE);
  });

  it('размера нет в прайсе — подпись с сайта, себестоимость не выдумываем', () => {
    /*
      Такого быть не должно: сайт продаёт только размеры прайса. Но если
      списки разойдутся, лучше ноль и видимая подпись, чем цена соседнего
      размера: ноль в отчёте заметен, подставленная цена — нет.
    */
    const item = leadCanvasPosition({
      sizeKey: '33x33',
      sizeLabel: '33×33 см',
      productName: 'Холст 33×33',
      quantity: 1,
      unitPrice: 1000,
    });

    expect(item.sizeKey).toBeNull();
    expect(item.formatCanvas).toBe('33×33 см');
    expect(item.contractorPrice).toBe(0);
  });
});
