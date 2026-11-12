import { settleOrder } from './partner-settlement';
import {
  freePayoutMode,
  isPartnerFreePosition,
  settlementPositions,
} from './settlement-positions';
import { resolveItemPayout } from './item-payout';
import { calcGulianPayout } from 'src/gulian/gulian-payout';
import { EnumPartnerPayout } from 'src/generated/prisma/enums';

/**
 * Печать термотрансферов: изделия нет вовсе, плёнку печатает исполнитель.
 * Числа взяты с заказа 20261108-049, на котором это и заметили: 10 плёнок,
 * 800 ₽ договорной суммы — и ноль в расчёте, потому что режима не было.
 */
const RATE = 3000; // 30%

const transfer = {
  pricePosition: 800,
  quantity: 10,
  printOnClientItem: false,
  thermalCost: 0,
  partnerPayout: 'REVENUE_SHARE' as const,
  partnerRateBasisPoints: 3000,
};

const SETTINGS = {
  thermalTransferCost: 70,
  partnerRateBasisPoints: 3000,
  transferRateBasisPoints: 3000,
};

describe('печать термотрансферов: процент от суммы', () => {
  it('партнёр получает процент от суммы, себестоимость не вычитается', () => {
    const s = settleOrder(
      settlementPositions({ tshirtItems: [], items: [transfer] }),
      RATE,
    );

    expect(s.materials).toBe(0); // своих материалов в такой работе нет
    expect(s.partnerProfit).toBe(240); // 30% от 800, а не от маржи
    expect(s.reward).toBe(240); // возвращать нечего — выплата равна заработку
    expect(s.ownerProfit).toBe(560); // 800 − 240
  });

  it('до появления режима та же позиция давала исполнителю ноль', () => {
    const legacy = settleOrder(
      settlementPositions({
        items: [{ ...transfer, partnerPayout: null, printOnClientItem: false }],
      }),
      RATE,
    );
    expect(legacy.reward).toBe(0);
  });

  it('ставка позиции важнее общей: снимок не двигается правкой настроек', () => {
    const s = settleOrder(
      settlementPositions({
        items: [{ ...transfer, partnerRateBasisPoints: 4000 }],
      }),
      RATE,
    );
    expect(s.partnerProfit).toBe(320); // 40% от 800 по снимку позиции
  });

  it('позиции без выплаты в расчёт не попадают', () => {
    const mug = { ...transfer, partnerPayout: 'NONE' as const };
    expect(isPartnerFreePosition(mug)).toBe(false);
    expect(settlementPositions({ items: [mug] })).toHaveLength(0);
  });

  it('у старой позиции режим выводится из прежнего флага, а не теряется', () => {
    expect(freePayoutMode({ ...transfer, partnerPayout: undefined })).toBe(
      'NONE',
    );
    expect(
      freePayoutMode({
        pricePosition: 1500,
        quantity: 1,
        printOnClientItem: true,
        thermalCost: 70,
      }),
    ).toBe('MARGIN_SHARE');
  });

  it('заказ из одних термотрансферов доезжает до CRM партнёра', () => {
    // Прежняя формула знала только футболки и падала с «Нет производственных
    // позиций»: ошибка гасилась в логе, и заказ у исполнителя не появлялся.
    const payout = calcGulianPayout(
      { tshirtItems: [], items: [transfer] },
      RATE,
    );
    expect(payout.quantity).toBe(10);
    expect(payout.totalPayoutKopecks).toBe(24000); // 240 ₽
    expect(payout.unitPayoutKopecks).toBe(2400); // 24 ₽ за плёнку
  });
});

describe('режим выплаты при заведении позиции', () => {
  it('новая позиция с процентом от суммы фиксирует ставку из настроек', () => {
    const r = resolveItemPayout(
      { partnerPayout: EnumPartnerPayout.REVENUE_SHARE },
      null,
      { ...SETTINGS, transferRateBasisPoints: 2500 },
    );
    expect(r.rateBasisPoints).toBe(2500);
    expect(r.thermalCost).toBe(0); // плёнку печатает исполнитель
    expect(r.printOnClientItem).toBe(false); // изделия в заказе нет
  });

  it('своя ставка с формы сильнее настроек', () => {
    const r = resolveItemPayout(
      {
        partnerPayout: EnumPartnerPayout.REVENUE_SHARE,
        partnerRateBasisPoints: 3500,
      },
      null,
      SETTINGS,
    );
    expect(r.rateBasisPoints).toBe(3500);
  });

  it('доля от маржи снимает себестоимость плёнки из настроек', () => {
    const r = resolveItemPayout(
      { partnerPayout: EnumPartnerPayout.MARGIN_SHARE },
      null,
      SETTINGS,
    );
    expect(r.thermalCost).toBe(70);
    expect(r.printOnClientItem).toBe(true);
    expect(r.rateBasisPoints).toBeNull(); // ставка общая, как и раньше
  });

  it('старая форма шлёт только флаг — режим выводится из него', () => {
    const r = resolveItemPayout({ printOnClientItem: true }, null, SETTINGS);
    expect(r.partnerPayout).toBe(EnumPartnerPayout.MARGIN_SHARE);
  });

  it('правка цены не меняет режим и не обнуляет снимки', () => {
    const current = {
      partnerPayout: EnumPartnerPayout.REVENUE_SHARE,
      printOnClientItem: false,
      thermalCost: 0,
      partnerRateBasisPoints: 2500,
    };
    const r = resolveItemPayout({}, current, SETTINGS);
    expect(r.partnerPayout).toBe(EnumPartnerPayout.REVENUE_SHARE);
    expect(r.rateBasisPoints).toBe(2500);
  });

  it('уход в «не платим» обнуляет снимки, чтобы в базе не осталось мусора', () => {
    const current = {
      partnerPayout: EnumPartnerPayout.MARGIN_SHARE,
      printOnClientItem: true,
      thermalCost: 70,
      partnerRateBasisPoints: 4000,
    };
    const r = resolveItemPayout(
      { partnerPayout: EnumPartnerPayout.NONE },
      current,
      SETTINGS,
    );
    expect(r.thermalCost).toBe(0);
    expect(r.rateBasisPoints).toBeNull();
    expect(r.printOnClientItem).toBe(false);
  });
});
