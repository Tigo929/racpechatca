import { EnumPartnerPayout } from 'src/generated/prisma/enums';

/**
 * Что записать в позицию, когда решается, платим ли за неё партнёру.
 *
 * Правило живёт одним куском, потому что мест три: создание заказа, добавление
 * позиции и правка позиции. Пока оно было переписано в каждом из них, снимок
 * себестоимости плёнки ставился по-разному, и позиция, заведённая через одну
 * форму, считалась не так, как та же позиция через другую.
 *
 * Снимки — осознанно. Себестоимость и ставка фиксируются на момент оформления,
 * как thermalCost в футболочной позиции: правка настроек меняет будущие заказы
 * и не двигает уже согласованные суммы задним числом.
 */

export interface ItemPayoutInput {
  /** Режим с формы. Не передан — смотрим на старый флаг, затем на текущее значение. */
  partnerPayout?: EnumPartnerPayout | null;
  /** Старый флаг: формы, которые ещё не знают про режимы, шлют только его. */
  printOnClientItem?: boolean | null;
  /** Своя ставка позиции в сотых процента; не передана — берём из настроек. */
  partnerRateBasisPoints?: number | null;
}

/** Текущее состояние позиции в базе; null — позиция создаётся. */
export interface ItemPayoutCurrent {
  partnerPayout: EnumPartnerPayout;
  printOnClientItem: boolean;
  thermalCost: number;
  partnerRateBasisPoints: number | null;
}

export interface ItemPayoutSettings {
  thermalTransferCost: number;
  partnerRateBasisPoints: number;
  transferRateBasisPoints: number;
}

export interface ItemPayoutResult {
  partnerPayout: EnumPartnerPayout;
  printOnClientItem: boolean;
  thermalCost: number;
  rateBasisPoints: number | null;
}

/**
 * Режим, который хочет вызывающая сторона.
 *
 * Порядок важен: явный режим сильнее старого флага, флаг сильнее того, что
 * лежит в базе. Не передали ничего — ничего и не меняем: правка цены позиции
 * не должна молча лишать исполнителя выплаты.
 */
function desiredMode(
  dto: ItemPayoutInput,
  current: ItemPayoutCurrent | null,
): EnumPartnerPayout {
  if (dto.partnerPayout) return dto.partnerPayout;
  if (dto.printOnClientItem !== undefined && dto.printOnClientItem !== null) {
    return dto.printOnClientItem
      ? EnumPartnerPayout.MARGIN_SHARE
      : EnumPartnerPayout.NONE;
  }
  return current?.partnerPayout ?? EnumPartnerPayout.NONE;
}

/**
 * Функция синхронная, а настройки передаются готовыми: так одно и то же
 * правило работает и в сервисе позиции, и внутри map при создании заказа,
 * где await посреди перебора позиций только мешает.
 */
export function resolveItemPayout(
  dto: ItemPayoutInput,
  current: ItemPayoutCurrent | null,
  settings: ItemPayoutSettings,
): ItemPayoutResult {
  const mode = desiredMode(dto, current);
  const modeChanged = current === null || current.partnerPayout !== mode;
  const rateGiven =
    dto.partnerRateBasisPoints !== undefined &&
    dto.partnerRateBasisPoints !== null;

  if (mode === EnumPartnerPayout.NONE) {
    // Работа не партнёра — снимки обнуляем, чтобы в базе не осталось цифр,
    // которые ни на что не влияют, но сбивают с толку при разборе.
    return {
      partnerPayout: mode,
      printOnClientItem: false,
      thermalCost: 0,
      rateBasisPoints: null,
    };
  }

  if (mode === EnumPartnerPayout.REVENUE_SHARE) {
    // Процент от суммы: материалов с нашей стороны нет — плёнку печатает
    // исполнитель, изделия в заказе нет вовсе.
    const rateBasisPoints = rateGiven
      ? (dto.partnerRateBasisPoints as number)
      : modeChanged
        ? settings.transferRateBasisPoints
        : current.partnerRateBasisPoints;
    return {
      partnerPayout: mode,
      printOnClientItem: false,
      thermalCost: 0,
      rateBasisPoints,
    };
  }

  // Доля от маржи: плёнку оплачиваем мы, заготовку покупает клиент.
  // Ставка по умолчанию остаётся общей (null) — так считались такие позиции
  // до появления режимов, и менять им расчёт задним числом не за чем.
  return {
    partnerPayout: mode,
    printOnClientItem: true,
    thermalCost: modeChanged
      ? settings.thermalTransferCost
      : current.thermalCost,
    rateBasisPoints: rateGiven
      ? (dto.partnerRateBasisPoints as number)
      : modeChanged
        ? null
        : current.partnerRateBasisPoints,
  };
}
