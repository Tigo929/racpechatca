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
  APPROVAL_SENT: 'Отправлен на согласование',
  FOLDER_STRUCTURE_CREATED: 'Создана папка',
  IN_PROGRESS: 'В обработке',
  PRINTED: 'Печатается',
  READY: 'Готов',
  SHIPMENT_CREATED: 'Отгрузка создана',
  DONE: 'Выполнен',
  SENT: 'Отправлен',
  PAID: 'Оплачен',
  READY_FOR_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  PROBLEM: 'Проблема',
};

// Поток статусов для фотографий (без нового executor-flow)
export const STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'FOLDER_STRUCTURE_CREATED',
  'IN_PROGRESS',
  'READY',
  'SHIPMENT_CREATED',
  'SENT',
  'PAID',
];

// Поток статусов для футболок: производство ведёт партнёр. SENT здесь означает
// «передали партнёру», а SHIPMENT_CREATED — уже клиентская отгрузка после READY.
export const TSHIRT_STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  // Макет ушёл клиенту на согласование. Стоит перед «Отправлен» намеренно:
  // партнёр не должен получить заказ, пока клиент не подтвердил макет —
  // переделка после начала печати оплачивается заготовкой.
  'APPROVAL_SENT',
  'SENT',
  'IN_PROGRESS',
  'READY',
  'SHIPMENT_CREATED',
  'PAID',
];

export const TSHIRT_STATUS_LABELS: Record<EnumStatus, string> = {
  LEAD: 'Обратился',
  NEW: 'Новый',
  APPROVAL_SENT: 'На согласовании',
  SENT: 'Передан в производство',
  IN_PROGRESS: 'В работе',
  READY: 'Готов',
  SHIPMENT_CREATED: 'Отгрузка создана',
  PAID: 'Оплачен',
  // Ниже — унаследованные статусы: в новом потоке их нет, но подписи нужны
  // на случай старых заказов и записей истории.
  FOLDER_STRUCTURE_CREATED: 'Оформлен',
  PRINTED: 'На стадии дизайна',
  DONE: 'Выполнен',
  READY_FOR_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  PROBLEM: 'Проблема',
};

// Поток для холстов: SENT означает «передан подрядчику», клиентская отгрузка
// создаётся уже после READY.
export const CANVAS_STATUS_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'SENT',
  'IN_PROGRESS',
  'READY',
  'SHIPMENT_CREATED',
  'PAID',
];

export const CANVAS_STATUS_LABELS: Record<EnumStatus, string> = {
  ...TSHIRT_STATUS_LABELS,
  SENT: 'У подрядчика',
  IN_PROGRESS: 'В работе',
  READY: 'Готов',
  SHIPMENT_CREATED: 'Отгрузка создана',
  PAID: 'Оплачен',
};

export const COMMUNICATION_LABELS: Record<EnumCommunication, string> = {
  AVITO: 'Авито',
  TELEGRAM: 'Telegram',
  MAX: 'MAX',
  OZON: 'Ozon',
};

/**
 * Происхождение заказа (этап 17): откуда заказ взялся, а не откуда реклама.
 * WEBSITE ставит сервер заявке с сайта, UNKNOWN — старый заказ без доказательств;
 * вручную выбираются только каналы из SOURCE_ORDER_OPTIONS.
 */
export const SOURCE_ORDER_LABELS: Record<string, string> = {
  AVITO: 'Авито',
  OZON: 'Ozon',
  WB: 'Wildberries',
  LOCAL: 'Местный (вручную)',
  WEBSITE: 'Сайт',
  UNKNOWN: 'Не определён',
};

/**
 * Что предлагается выбрать сотруднику при ручном создании заказа.
 *
 * «Сайт» в списке есть намеренно: заявки сайт заводит сам, но клиент может
 * написать с сайта в мессенджер, и заказ придётся оформить руками. Тогда
 * происхождение всё равно сайт — и в аналитике заказ должен попасть в его
 * воронку, а не в Avito.
 */
export const SOURCE_ORDER_OPTIONS = [
  'AVITO',
  'OZON',
  'WB',
  'LOCAL',
  'WEBSITE',
] as const;

/**
 * Площадки, с которых приходит печать индивидуального принта.
 *
 * Заказ с маркетплейса ведёт сама площадка: «местным» или авитошным он быть
 * не может. Поэтому отметка «Заказ с маркетплейса» ставит в форме Ozon —
 * основную площадку, — а сохранение страхует выбор: всё, кроме Wildberries,
 * уходит как Ozon. Иначе черновик, восстановленный из прошлой сессии, мог бы
 * принести в заказ маркетплейса источник, которого у него не бывает.
 */
export const MARKETPLACE_DEFAULT_SOURCE_ORDER = 'OZON' as const;

export function marketplaceSourceOrder(value: string | undefined): 'OZON' | 'WB' {
  return value === 'WB' ? 'WB' : MARKETPLACE_DEFAULT_SOURCE_ORDER;
}

export const DELIVERY_LABELS: Record<EnumDeliveryMethod, string> = {
  YANDEX_PVZ: 'Яндекс ПВЗ',
  OZON_PVZ: 'Ozon ПВЗ',
  PICKUP: 'Самовывоз',
  PRODUCTION_MSK: 'Доставка производства (Москва)',
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
