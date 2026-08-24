import { useQuery } from '@tanstack/react-query';
import { AlarmClock, Flame, PackageCheck, UserRound } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { FilterChip } from '../ui/FilterChip';
import type { EnumProductCategory, ExecutorWorkload } from '../../types/index';

interface Props {
  productCategory?: EnumProductCategory;
  value?: string;
  onChange: (executorId: string | undefined) => void;
}

/**
 * Отбор заказов по исполнителю плюс короткая сводка по выбранному.
 *
 * Сделан теми же чипами, что и остальные фильтры, — это ещё один ряд в
 * существующей карточке, а не новый экран: ничего не переставляет и не
 * меняется для того, кто фильтром не пользуется.
 *
 * Счётчик на чипе показывает активные заказы. Без него выбор был бы вслепую:
 * ради «у кого сколько висит» фильтр и нужен, и ответ должен быть виден до
 * нажатия, а не после.
 */
export function ExecutorFilter({ productCategory, value, onChange }: Props) {
  const { data: workload = [] } = useQuery({
    queryKey: ['executor-workload', productCategory],
    queryFn: () => ordersApi.getExecutorWorkload({ productCategory }),
    staleTime: 30_000,
  });

  if (workload.length === 0) return null;

  // Показываем тех, на ком что-то есть, плюс всех действующих сотрудников:
  // пустой исполнитель тоже нужен в списке, чтобы можно было ему назначить.
  const visible = workload.filter(
    (row) => row.activeCount > 0 || (row.isActive && row.id !== 'none'),
  );
  const selected = value ? workload.find((row) => row.id === value) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
          Исполнитель
        </span>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={!value} onClick={() => onChange(undefined)}>
            Все
          </FilterChip>
          {visible.map((row) => (
            <FilterChip
              key={row.id}
              active={value === row.id}
              onClick={() => onChange(value === row.id ? undefined : row.id)}
            >
              <span className="inline-flex items-center gap-1.5">
                {row.id === 'none' ? (
                  <UserRound size={11} aria-hidden="true" className="opacity-60" />
                ) : null}
                {row.username}
                {!row.isActive && (
                  <span className="opacity-60" title="Сотрудник отключён">
                    (не работает)
                  </span>
                )}
                {row.activeCount > 0 && (
                  <span
                    className={`rounded px-1 tabular-nums ${
                      value === row.id ? 'bg-white/25' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {row.activeCount}
                  </span>
                )}
                {row.overdueCount > 0 && (
                  <span
                    aria-label={`просрочено: ${row.overdueCount}`}
                    className={value === row.id ? 'text-white' : 'text-red-600'}
                  >
                    ●
                  </span>
                )}
              </span>
            </FilterChip>
          ))}
        </div>
      </div>

      {selected && (
        <Summary row={selected} />
      )}
    </div>
  );
}

/**
 * Что на человеке висит прямо сейчас. Считается по активным заказам и не
 * зависит от выбранного статуса: смысл сводки в том, чтобы видеть всю
 * нагрузку целиком, даже когда список сужен до одного статуса.
 */
function Summary({ row }: { row: ExecutorWorkload }) {
  const isUnassigned = row.id === 'none';
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
      <p className="text-xs font-semibold text-indigo-900">
        {isUnassigned ? 'Заказы без исполнителя' : `На исполнителе: ${row.username}`}
      </p>
      {row.activeCount === 0 ? (
        <p className="mt-1 text-xs text-indigo-700">
          {isUnassigned
            ? 'Все активные заказы кому-то назначены.'
            : 'Активных заказов нет — можно догружать.'}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-indigo-900">
          <Metric label="в работе" value={row.activeCount} />
          {row.urgentCount > 0 && (
            <Metric
              label="срочных"
              value={row.urgentCount}
              icon={<Flame size={11} aria-hidden="true" />}
              tone="text-amber-700"
            />
          )}
          {row.overdueCount > 0 && (
            <Metric
              label="просрочено"
              value={row.overdueCount}
              icon={<AlarmClock size={11} aria-hidden="true" />}
              tone="text-red-700"
            />
          )}
          {row.readyCount > 0 && (
            <Metric
              label="готово"
              value={row.readyCount}
              icon={<PackageCheck size={11} aria-hidden="true" />}
              tone="text-emerald-700"
            />
          )}
          <span className="tabular-nums">
            на сумму {row.activeAmount.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${tone ?? ''}`}>
      {icon}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
