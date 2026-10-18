import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * Заголовок столбца, по которому можно упорядочить список.
 *
 * Нажатие по самому заголовку, а не отдельная кнопка рядом: в таблице
 * это привычный жест, и человек пробует его раньше, чем читает подсказки.
 *
 * Состояние показано значком, а не только цветом: направление сортировки
 * — это и есть смысл («сначала поздние» или «сначала ранние»), и догадаться
 * о нём по оттенку текста нельзя. У невыбранного столбца значок бледный —
 * им он и говорит, что по нему тоже можно упорядочить.
 */

type Field = 'deadline' | 'total';

interface Props {
  label: string;
  field: Field;
  sort: Field | undefined;
  dir: 'asc' | 'desc' | undefined;
  onToggle: (field: Field) => void;
  align?: 'left' | 'right';
}

export function SortableHeader({
  label,
  field,
  sort,
  dir,
  onToggle,
  align = 'left',
}: Props) {
  const active = sort === field;
  const ascending = active && dir === 'asc';

  return (
    <th
      scope="col"
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${active ? 'text-indigo-600' : 'text-gray-400'}`}
      aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onToggle(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-indigo-600 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
        /*
          Третье нажатие возвращает обычный порядок работы, и об этом
          стоит сказать: иначе человек ищет, как «отменить сортировку»,
          и не находит.
        */
        title={
          active
            ? ascending
              ? `${label}: по возрастанию. Нажмите, чтобы вернуть обычный порядок`
              : `${label}: по убыванию. Нажмите для обратного порядка`
            : `Упорядочить по полю «${label}»`
        }
      >
        {label}
        {active ? (
          ascending ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown size={12} aria-hidden="true" className="opacity-40" />
        )}
      </button>
    </th>
  );
}
