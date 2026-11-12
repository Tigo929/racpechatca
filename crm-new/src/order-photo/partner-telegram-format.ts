import { EnumStatus } from 'src/generated/prisma/enums';
import { settleOrder, settlePosition } from 'src/partner/partner-settlement';
import {
  freePayoutMode,
  isPartnerFreePosition,
  settlementPositions,
  type FreePositionSource,
} from 'src/partner/settlement-positions';

export const STATUS_LABELS: Partial<Record<EnumStatus, string>> = {
  [EnumStatus.NEW]: '🆕 Новый',
  [EnumStatus.FOLDER_STRUCTURE_CREATED]: '📁 Принято',
  [EnumStatus.IN_PROGRESS]: '🔄 В работе',
  [EnumStatus.PRINTED]: '🖨️ Напечатано',
  [EnumStatus.READY]: '✅ Готово',
  [EnumStatus.SHIPMENT_CREATED]: '🚚 Отгрузка создана',
  [EnumStatus.DONE]: '✅ Выполнено',
  [EnumStatus.SENT]: '📦 Отправлено',
  [EnumStatus.PAID]: '💰 Оплачено',
  [EnumStatus.CANCELLED]: '🚫 Отменено',
};

export type PartnerOrderItem = {
  color: string;
  size: string;
  quantity: number;
  printLocation: string;
  printType: string;
  pricePosition: number;
  designCost: number;
  thermalCost: number;
  blankCost: number;
  clientItem: boolean;
};

export type PartnerOrderData = {
  numberOrder: string;
  status: EnumStatus;
  tshirtModel?: string | null;
  techSpecPhotoPaths?: string[];
  tshirtItems: PartnerOrderItem[];
  /*
   * Свободные позиции — печать по изделию заказчика и печать термотрансферов.
   * Подпись правится при каждом нажатии кнопки статуса, и пока она собиралась
   * из одних футболок, заказ без них после первого же нажатия терял состав
   * и превращался в пустой бланк с номером.
   */
  items?: (FreePositionSource & { formatPaper: string })[] | null;
};

const PRINT_LOCATION_LABELS: Record<string, string> = {
  FRONT: 'Грудь',
  BACK: 'Спина',
  FRONT_BACK: 'Грудь + спина',
  SLEEVE_LEFT: 'Левый рукав',
  SLEEVE_RIGHT: 'Правый рукав',
  FULL: 'Полная запечатка',
  BY_TZ: 'По ТЗ',
};

const PRINT_TYPE_LABELS: Record<string, string> = {
  DTF: 'DTF',
  DTG: 'DTG',
  SILK: 'Шелкография',
  SUBLIMATION: 'Сублимация',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rub(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`;
}

/**
 * Итог по заказу для подписи.
 *
 * Считает общий модуль расчёта, а не своя формула: здесь когда-то лежала
 * третья по счёту копия той же арифметики, и округляла она в другую сторону —
 * в подписи исполнитель видел одну сумму, в выплате получал другую.
 */
export function calcSettlement(
  order: PartnerOrderData,
  rateBasisPoints: number,
) {
  const positions = settlementPositions({
    tshirtItems: order.tshirtItems,
    items: order.items,
  });
  const settlement = settleOrder(positions, rateBasisPoints);
  const totalProduction = positions.reduce(
    (s, p) => s + p.pricePosition - p.designCost,
    0,
  );
  return {
    totalProduction,
    totalMaterials: settlement.materials,
    totalShare: settlement.margin,
    reward: settlement.partnerProfit,
  };
}

export function buildPartnerCaption(
  order: PartnerOrderData,
  rateBasisPoints: number,
): string {
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const attachmentCount =
    order.techSpecPhotoPaths?.length ?? order.tshirtItems.length;

  const itemLines = order.tshirtItems.flatMap((item, i) => {
    const production = item.pricePosition - item.designCost;
    const mat =
      item.thermalCost * item.quantity +
      (item.clientItem ? 0 : item.blankCost * item.quantity);
    const share = production - mat;
    const reward = Math.round((share * rateBasisPoints) / 10000);
    return [
      `${i + 1}) <b>${esc(item.color)} / ${esc(item.size)}</b> ×${item.quantity}`,
      `   ${esc(PRINT_LOCATION_LABELS[item.printLocation] ?? item.printLocation)} · ${esc(PRINT_TYPE_LABELS[item.printType] ?? item.printType)}`,
      `   Без дизайна: ${rub(production)}  |  Ваша доля: <b>${rub(reward)}</b>`,
    ];
  });

  // Свободные позиции, за которые исполнителю платят, — строкой с долей.
  const freeLines = (order.items ?? [])
    .filter(isPartnerFreePosition)
    .flatMap((item, index) => {
      const rate = item.partnerRateBasisPoints ?? rateBasisPoints;
      const share = settlePosition(
        {
          pricePosition: item.pricePosition,
          designCost: 0,
          quantity: item.quantity,
          thermalCost:
            freePayoutMode(item) === 'REVENUE_SHARE' ? 0 : item.thermalCost,
          blankCost: 0,
          clientItem: true,
          mode: freePayoutMode(item) as 'MARGIN_SHARE' | 'REVENUE_SHARE',
          rateBasisPoints: item.partnerRateBasisPoints,
        },
        rateBasisPoints,
      ).partnerProfit;
      return [
        `${order.tshirtItems.length + index + 1}) <b>${esc(item.formatPaper)}</b> ×${item.quantity}`,
        `   ${rub(item.pricePosition)}  |  Ваша доля (${rate / 100}%): <b>${rub(share)}</b>`,
      ];
    });

  const { totalProduction, totalMaterials, reward } = calcSettlement(
    order,
    rateBasisPoints,
  );

  // Процент в итоге — только если он у всех позиций один: иначе одна общая
  // цифра противоречила бы строкам выше.
  const rates = new Set(
    settlementPositions({
      tshirtItems: order.tshirtItems,
      items: order.items,
    }).map((p) => p.rateBasisPoints ?? rateBasisPoints),
  );
  const rateLabel = rates.size === 1 ? ` (${[...rates][0] / 100}%)` : '';

  return [
    // Номер в <code>: в Telegram такой блок копируется одним нажатием.
    `🧾 <b>Заказ:</b> <code>${esc(order.numberOrder)}</code>`,
    `Статус: ${statusLabel}`,
    ...(order.tshirtModel ? [`Модель: <i>${esc(order.tshirtModel)}</i>`] : []),
    ...(attachmentCount > 1
      ? [`ТЗ: ${attachmentCount} файлов объединены в PDF`]
      : []),
    '',
    ...itemLines,
    ...freeLines,
    '',
    '─────────────────────',
    `💰 <b>Итого (без дизайна): ${rub(totalProduction)}</b>`,
    `   Материалы: ${rub(totalMaterials)}`,
    `   Ваша доля${rateLabel}: <b>${rub(reward)}</b>`,
  ].join('\n');
}

export function buildPartnerButtons(
  orderId: string,
  stickerUrl: string | null,
): { inline_keyboard: object[][] } {
  const rows: object[][] = [
    [
      { text: '🔄 В работе', callback_data: `tshirt:${orderId}:work` },
      { text: '🖨️ Напечатано', callback_data: `tshirt:${orderId}:printed` },
    ],
    [
      { text: '✅ Готово', callback_data: `tshirt:${orderId}:ready` },
      { text: '❌ Не готово', callback_data: `tshirt:${orderId}:not_ready` },
    ],
  ];
  if (stickerUrl) {
    rows.push([{ text: '🏷️ Распечатать стикер', url: stickerUrl }]);
  }
  return { inline_keyboard: rows };
}
