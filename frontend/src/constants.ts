import type {
  EnumStatus,
  EnumSourceOrder,
  EnumCommunication,
  EnumDeliveryMethod,
  EnumTypePaper,
  EnumTshirtSize,
  EnumPrintLocation,
} from './types';

export const STATUS_LABELS: Record<EnumStatus, string> = {
  LEAD: 'Обратился',
  NEW: 'Новый',
  FOLDER_STRUCTURE_CREATED: 'Создана папка',
  PRINTED: 'Печатается',
  READY: 'Готов',
  DONE: 'Выполнен',
  SENT: 'Отправлен',
  PAID: 'Оплачен',
};

export const STATUS_COLORS: Record<EnumStatus, string> = {
  LEAD: 'bg-pink-100 text-pink-700',
  NEW: 'bg-blue-100 text-blue-800',
  FOLDER_STRUCTURE_CREATED: 'bg-purple-100 text-purple-800',
  PRINTED: 'bg-yellow-100 text-yellow-800',
  READY: 'bg-green-100 text-green-800',
  DONE: 'bg-cyan-100 text-cyan-800',
  SENT: 'bg-orange-100 text-orange-800',
  PAID: 'bg-emerald-100 text-emerald-800',
};

// Поток статусов для фотографий
export const STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'FOLDER_STRUCTURE_CREATED',
  'READY',
  'SENT',
  'PAID',
];

// Поток статусов для футболок (используем те же enum, другие подписи)
export const TSHIRT_STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'FOLDER_STRUCTURE_CREATED',
  'PRINTED',
  'READY',
  'DONE',
  'SENT',
  'PAID',
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
};

export const SOURCE_LABELS: Record<EnumSourceOrder, string> = {
  AVITO: 'Авито',
  OZON: 'Ozon',
  WB: 'Wildberries',
  LOCAL: 'Местный',
};

export const SOURCE_COLORS: Record<EnumSourceOrder, string> = {
  AVITO: 'bg-sky-100 text-sky-800',
  OZON: 'bg-blue-100 text-blue-800',
  WB: 'bg-violet-100 text-violet-800',
  LOCAL: 'bg-gray-100 text-gray-800',
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
  BY_TZ: 'По ТЗ',
};

export const TSHIRT_COLORS = ['Белый', 'Чёрный'];
