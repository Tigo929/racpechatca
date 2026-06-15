import type {
  EnumStatus,
  EnumCommunication,
  EnumDeliveryMethod,
  EnumTypePaper,
  EnumTshirtSize,
  EnumPrintLocation,
} from './types/index';

export const STATUS_LABELS: Record<EnumStatus, string> = {
  LEAD: 'Обратился',
  NEW: 'Новый',
  FOLDER_STRUCTURE_CREATED: 'Создана папка',
  PRINTED: 'Печатается',
  READY: 'Готов',
  DONE: 'Выполнен',
  SENT: 'Отправлен',
  PAID: 'Оплачен',
  READY_FOR_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

// Поток статусов для фотографий (без нового executor-flow)
export const STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'FOLDER_STRUCTURE_CREATED',
  'READY',
  'SENT',
  'PAID',
];

// Поток статусов для футболок (новый executor-flow)
export const TSHIRT_STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'FOLDER_STRUCTURE_CREATED',
  'PRINTED',
  'READY',
  'DONE',
  'READY_FOR_REVIEW',
  'COMPLETED',
];

export const TSHIRT_STATUS_LABELS: Record<EnumStatus, string> = {
  LEAD: 'Обратился',
  NEW: 'Новый',
  FOLDER_STRUCTURE_CREATED: 'Оформлен',
  PRINTED: 'На стадии дизайна',
  READY: 'На исполнении',
  DONE: 'Выполнен',
  SENT: 'Отправлен',
  PAID: 'Оплачен',
  READY_FOR_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export const COMMUNICATION_LABELS: Record<EnumCommunication, string> = {
  AVITO: 'Авито',
  TELEGRAM: 'Telegram',
  MAX: 'MAX',
  OZON: 'Ozon',
};

export const DELIVERY_LABELS: Record<EnumDeliveryMethod, string> = {
  YANDEX_PVZ: 'Яндекс ПВЗ',
  OZON_PVZ: 'Ozon ПВЗ',
  PICKUP: 'Самовывоз',
  OZON_SELLER: 'Ozon Продавец',
  WB_SELLER: 'WB Продавец',
};

export const TYPE_LABELS: Record<EnumTypePaper, string> = {
  GLOSS: 'Глянец',
  MATTE: 'Матт',
};

export const TSHIRT_SIZE_LABELS: Record<EnumTshirtSize, string> = {
  XS: 'XS', S: 'S', M: 'M', L: 'L', XL: 'XL', XXL: 'XXL', XXXL: '3XL',
};

export const PRINT_LOCATION_LABELS: Record<EnumPrintLocation, string> = {
  FRONT: 'Грудь',
  BACK: 'Спина',
  FRONT_BACK: 'Двусторонняя',
  SLEEVE_LEFT: 'Левый рукав',
  SLEEVE_RIGHT: 'Правый рукав',
  FULL: 'Полная запечатка',
  BY_TZ: 'По ТЗ',
};

export const TSHIRT_COLORS = ['Белый', 'Чёрный'];

// Финальные статусы — на них заказ закрыт и менять его уже нельзя.
// SENT сюда НЕ входит: из «Отправлен» админ может перейти в «Оплачен»
// или вернуть назад в «Готов» (степпер показывает кнопки перехода).
export const TERMINAL_STATUSES: EnumStatus[] = ['COMPLETED', 'CANCELLED', 'PAID'];
