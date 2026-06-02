import { STATUS_COLORS, STATUS_LABELS, TSHIRT_STATUS_LABELS } from '../constants';
import type { EnumProductCategory, EnumStatus } from '../types';

interface Props {
  status: EnumStatus;
  productCategory?: EnumProductCategory;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, productCategory, size = 'md' }: Props) {
  const base = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  const labels = productCategory === 'TSHIRT' ? TSHIRT_STATUS_LABELS : STATUS_LABELS;
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${base} ${STATUS_COLORS[status]}`}>
      {labels[status]}
    </span>
  );
}
