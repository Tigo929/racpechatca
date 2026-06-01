import type { EnumDeliveryMethod } from '../types';
import { DELIVERY_LABELS } from '../constants';

interface Props {
  method: EnumDeliveryMethod;
}

const DELIVERY_STYLES: Record<EnumDeliveryMethod, string> = {
  YANDEX_PVZ:  'bg-yellow-400 text-black border border-yellow-500 font-semibold',
  OZON_PVZ:    'bg-blue-100 text-blue-700 border border-blue-200',
  OZON_SELLER: 'bg-blue-50 text-blue-600 border border-blue-100',
  WB_SELLER:   'bg-purple-100 text-purple-700 border border-purple-200',
  PICKUP:      'bg-gray-100 text-gray-600 border border-gray-200',
};

export function DeliveryBadge({ method }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${DELIVERY_STYLES[method]}`}>
      {DELIVERY_LABELS[method]}
    </span>
  );
}
