import {
  EnumDeliveryMethod,
  EnumPrintLocation,
  EnumPrintType,
} from 'src/generated/prisma/enums';

// Человекочитаемые метки — дублируем к кодам, чтобы производство не ошиблось.
const PRINT_LOCATION_LABELS: Record<EnumPrintLocation, string> = {
  FRONT: 'Грудь',
  BACK: 'Спина',
  FRONT_BACK: 'Двусторонняя',
  SLEEVE_LEFT: 'Левый рукав',
  SLEEVE_RIGHT: 'Правый рукав',
  FULL: 'Полная запечатка',
  BY_TZ: 'По ТЗ',
};

const PRINT_TYPE_LABELS: Record<EnumPrintType, string> = {
  DTF: 'DTF',
  DTG: 'DTG',
  SILK: 'Шелкография',
  SUBLIMATION: 'Сублимация',
};

export interface PartnerOrderForPayload {
  id: string;
  numberOrder: string;
  note: string | null;
  tshirtModel: string | null;
  totalOrder: number | null;
  deliveryMethod: string;
  techSpecPhotoPath: string | null;
  tshirtItems: {
    color: string;
    size: string;
    printLocation: EnumPrintLocation;
    printType: EnumPrintType;
    quantity: number;
    price: number;
  }[];
}

/**
 * Чистый контракт заказа для исполнителя-партнёра.
 *
 * ВАЖНО про суммы: `order_total` — ПОЛНАЯ сумма заказа (все позиции, включая
 * свободные и доставку). `items` — ТОЛЬКО футболочные позиции для производства,
 * поэтому сумма line_total по items может быть МЕНЬШЕ order_total. Партнёр —
 * пункт самовывоза, ему нужен полный чек: order_total / prepaid / balance_due.
 */
export function buildPartnerOrderPayload(
  order: PartnerOrderForPayload,
  baseUrl: string,
) {
  const total = order.totalOrder ?? 0;
  const prepaid = Math.ceil(total * 0.5); // предоплата 50% (округление вверх)
  const balanceDue = total - prepaid;
  const isPickup = order.deliveryMethod === EnumDeliveryMethod.PICKUP;
  const base = baseUrl.replace(/\/+$/, '');

  return {
    order_number: order.numberOrder,
    note: order.note ?? null,
    tshirt_model: order.tshirtModel ?? null,
    items: order.tshirtItems.map((i) => ({
      color: i.color,
      size: i.size,
      print_location: i.printLocation,
      print_location_label: PRINT_LOCATION_LABELS[i.printLocation] ?? null,
      print_type: i.printType,
      print_type_label: PRINT_TYPE_LABELS[i.printType] ?? null,
      quantity: i.quantity,
      price_per_piece: i.price,
      line_total: i.price * i.quantity,
    })),
    payment: {
      // Полный чек заказа — для пункта самовывоза.
      order_total: total,
      prepaid,
      balance_due: balanceDue,
      // Остаток берётся при получении только на самовывозе.
      balance_on_pickup: isPickup,
    },
    delivery: {
      method: order.deliveryMethod,
      is_pickup: isPickup,
    },
    files: {
      // Партнёр скачивает по этим ссылкам со своим X-Partner-Token.
      tech_spec_url: order.techSpecPhotoPath
        ? `${base}/partner/orders/${order.id}/techspec-photo`
        : null,
      sticker_url: `${base}/partner/orders/${order.id}/sticker`,
    },
  };
}

export type PartnerOrderPayload = ReturnType<typeof buildPartnerOrderPayload>;
