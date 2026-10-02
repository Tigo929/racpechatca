import {
  CANVAS_STATUS_LABELS,
  MARKETPLACE_TSHIRT_STATUS_LABELS,
  STATUS_LABELS,
  TSHIRT_STATUS_LABELS,
} from '../../constants';
import type { EnumProductCategory, EnumStatus } from '../../types/index';

interface Props {
  status: EnumStatus;
  productCategory?: EnumProductCategory;
  size?: 'sm' | 'md';
  deliveryMethod?: string;
  /** Футболка с маркетплейса: у неё свои подписи («Отгружен»). */
  marketplacePrint?: boolean;
}

/**
 * Цвет этапа. Один на всё: значок, полоса у строки в списке и шапка
 * карточки берут его отсюда.
 *
 * Отдельные наборы цветов в списке и в карточке разъехались бы при первой
 * же правке, и один и тот же заказ выглядел бы снаружи одним этапом, а
 * внутри другим. Поэтому источник один, а места применения разные:
 * `dot` — точка у значка и полоса слева, `bg`/`text` — подложка и буквы.
 */
const STATUS_STYLES: Record<EnumStatus, { bg: string; text: string; dot: string }> = {
  LEAD:                     { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  NEW:                      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  // Янтарный — «ждём ответа клиента»: цвет ожидания, а не работы и не готовности.
  APPROVAL_SENT:            { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  FOLDER_STRUCTURE_CREATED: { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  IN_PROGRESS:              { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  PRINTED:                  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500' },
  READY:                    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  SHIPMENT_CREATED:         { bg: 'bg-lime-50',    text: 'text-lime-700',    dot: 'bg-lime-500' },
  DONE:                     { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  SENT:                     { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  PAID:                     { bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  READY_FOR_REVIEW:         { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  COMPLETED:                { bg: 'bg-emerald-100',text: 'text-emerald-800', dot: 'bg-emerald-600' },
  CANCELLED:                { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400' },
  PROBLEM:                  { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500' },
};

/** Запасной цвет: статус, которого ещё нет в наборе, не должен «пропадать». */
const NEUTRAL = { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };

export function statusStyle(status: EnumStatus) {
  return STATUS_STYLES[status] ?? NEUTRAL;
}

/**
 * Цветная полоса слева — для строки заказа в списке и для шапки карточки.
 *
 * Точку значка и полосу красит один и тот же цвет, поэтому `bg-amber-500`
 * превращается в `border-l-amber-500`: Tailwind не умеет собирать классы
 * на лету, и писать их надо целиком — отсюда готовый перевод, а не склейка
 * строки в месте применения.
 */
const STRIPE: Record<string, string> = {
  'bg-pink-400': 'border-l-pink-400',
  'bg-blue-500': 'border-l-blue-500',
  'bg-amber-500': 'border-l-amber-500',
  'bg-purple-500': 'border-l-purple-500',
  'bg-sky-500': 'border-l-sky-500',
  'bg-yellow-500': 'border-l-yellow-500',
  'bg-emerald-500': 'border-l-emerald-500',
  'bg-emerald-600': 'border-l-emerald-600',
  'bg-lime-500': 'border-l-lime-500',
  'bg-cyan-500': 'border-l-cyan-500',
  'bg-orange-500': 'border-l-orange-500',
  'bg-teal-500': 'border-l-teal-500',
  'bg-violet-500': 'border-l-violet-500',
  'bg-red-400': 'border-l-red-400',
  'bg-rose-500': 'border-l-rose-500',
  'bg-gray-400': 'border-l-gray-400',
};

export function statusStripe(status: EnumStatus): string {
  return STRIPE[statusStyle(status).dot] ?? 'border-l-gray-400';
}

export function StatusBadge({ status, productCategory, deliveryMethod, marketplacePrint = false, size = 'md' }: Props) {
  const labels =
    productCategory === 'TSHIRT' && marketplacePrint
      ? MARKETPLACE_TSHIRT_STATUS_LABELS
      : productCategory === 'TSHIRT'
      ? TSHIRT_STATUS_LABELS
      : productCategory === 'CANVAS'
        ? CANVAS_STATUS_LABELS
        : STATUS_LABELS;
  const s = statusStyle(status);
  const base = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1.5' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-lg font-semibold ${base} ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />
      {deliveryMethod === 'PICKUP' && status === 'READY' ? 'Готов к выдаче' : deliveryMethod === 'PICKUP' && status === 'SENT' && productCategory === 'PHOTO' ? 'Выдан клиенту' : labels[status] ?? status}
    </span>
  );
}
