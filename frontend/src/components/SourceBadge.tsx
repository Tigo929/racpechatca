import { SOURCE_COLORS, SOURCE_LABELS } from '../constants';
import type { EnumSourceOrder } from '../types';

interface Props {
  source: EnumSourceOrder;
}

export function SourceBadge({ source }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_COLORS[source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  );
}
