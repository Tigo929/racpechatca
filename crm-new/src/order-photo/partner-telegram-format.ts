import { EnumStatus } from 'src/generated/prisma/enums';

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

export function calcSettlement(
  items: PartnerOrderItem[],
  rateBasisPoints: number,
) {
  const totalProduction = items.reduce(
    (s, i) => s + i.pricePosition - i.designCost,
    0,
  );
  const totalMaterials = items.reduce(
    (s, i) =>
      s +
      i.thermalCost * i.quantity +
      (i.clientItem ? 0 : i.blankCost * i.quantity),
    0,
  );
  const totalShare = totalProduction - totalMaterials;
  const reward = Math.round((totalShare * rateBasisPoints) / 10000);
  return { totalProduction, totalMaterials, totalShare, reward };
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

  const { totalProduction, totalMaterials, reward } = calcSettlement(
    order.tshirtItems,
    rateBasisPoints,
  );

  return [
    // Номер в <code>: в Telegram такой блок копируется одним нажатием.
    `🧾 <b>Заказ:</b> <code>${esc(order.numberOrder)}</code>`,
    `Статус: ${statusLabel}`,
    ...(order.tshirtModel
      ? [`Модель: <i>${esc(order.tshirtModel)}</i>`]
      : []),
    ...(attachmentCount > 1
      ? [`ТЗ: ${attachmentCount} файлов объединены в PDF`]
      : []),
    '',
    ...itemLines,
    '',
    '─────────────────────',
    `💰 <b>Итого (без дизайна): ${rub(totalProduction)}</b>`,
    `   Материалы: ${rub(totalMaterials)}`,
    `   Ваша доля (${rateBasisPoints / 100}%): <b>${rub(reward)}</b>`,
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
