import type { EnumDeliveryMethod } from '../types';
import { DELIVERY_LABELS } from '../constants';

interface Props { method: EnumDeliveryMethod }

const DELIVERY_STYLES: Record<EnumDeliveryMethod, string> = {
  YANDEX_PVZ:  'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300/60',
  OZON_PVZ:    'bg-blue-100 text-blue-700 ring-1 ring-blue-200/60',
  OZON_SELLER: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/60',
  WB_SELLER:   'bg-violet-100 text-violet-700 ring-1 ring-violet-200/60',
  PICKUP:      'bg-gray-100 text-gray-600 ring-1 ring-gray-200/60',
};

export function DeliveryBadge({ method }: Props) {
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${DELIVERY_STYLES[method]}`}>
      {DELIVERY_LABELS[method]}
    </span>
  );
}
