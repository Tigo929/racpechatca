import { STATUS_LABELS, TSHIRT_STATUS_LABELS } from '../constants';
import type { EnumProductCategory, EnumStatus } from '../types';

interface Props {
  status: EnumStatus;
  productCategory?: EnumProductCategory;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<EnumStatus, { bg: string; text: string; dot: string }> = {
  LEAD:                     { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400' },
  NEW:                      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  FOLDER_STRUCTURE_CREATED: { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  PRINTED:                  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500' },
  READY:                    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  DONE:                     { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  SENT:                     { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  PAID:                     { bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  READY_FOR_REVIEW:         { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  COMPLETED:                { bg: 'bg-emerald-100',text: 'text-emerald-800', dot: 'bg-emerald-600' },
  CANCELLED:                { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400' },
};

export function StatusBadge({ status, productCategory, size = 'md' }: Props) {
  const labels = productCategory === 'TSHIRT' ? TSHIRT_STATUS_LABELS : STATUS_LABELS;
  const s = STATUS_STYLES[status] ?? { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
  const base = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1.5' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-lg font-semibold ${base} ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}
