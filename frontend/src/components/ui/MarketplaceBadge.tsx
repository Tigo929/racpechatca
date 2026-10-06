import { Store } from 'lucide-react';
import type { EnumSourceOrder } from '../../types/index';

/**
 * Отметка «заказ с площадки» в общем списке заказов.
 *
 * В списке лежат вперемешку свои заказы и заказы с маркетплейсов, а вести их
 * надо по-разному: у площадки свои сроки отгрузки, свой номер отправления и
 * нет шага оплаты. Раньше отличить их можно было только по длинному номеру
 * отправления — то есть вчитываясь в каждую строку.
 *
 * Названия площадок намеренно не переводим: сотрудник сверяет строку
 * с кабинетом, и там написано ровно так же.
 */

const PLACE: Partial<Record<EnumSourceOrder, { label: string; className: string }>> = {
  // Цвета совпадают с полосками доставки той же площадки (DeliveryBadge):
  // один заказ не должен быть «синим» в одном столбце и «фиолетовым»
  // в соседнем.
  OZON: { label: 'Ozon', className: 'bg-sky-100 text-sky-800 ring-1 ring-sky-300/60' },
  WB: { label: 'WB', className: 'bg-violet-100 text-violet-800 ring-1 ring-violet-300/60' },
};

interface Props {
  source: EnumSourceOrder;
  /** Номер отправления — в подсказке, чтобы не удлинять строку. */
  postingNumber?: string | null;
}

export function MarketplaceBadge({ source, postingNumber }: Props) {
  const place = PLACE[source];
  if (!place) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${place.className}`}
      title={
        postingNumber
          ? `Заказ с ${place.label} · отправление ${postingNumber}`
          : `Заказ с ${place.label}`
      }
    >
      <Store size={10} aria-hidden="true" />
      {place.label}
    </span>
  );
}
