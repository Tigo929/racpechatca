import { useQueries } from '@tanstack/react-query';
import { ozonProductCatalogApi, type OzonCatalogProduct } from '../../api/ozonProductCatalog';

/**
 * Продажи карточки за разные периоды.
 *
 * В списке видно только «за 30 дней», и по одной цифре нельзя понять
 * главного: товар набирает или затухает. Поэтому здесь три периода рядом —
 * неделя, месяц, квартал — и пересчёт недели в месячный темп.
 *
 * Считаем по SKU: Ozon отдаёт спрос именно по ним, а в родовой группе
 * несколько SKU (цвета и размеры), и суммировать их надо самим.
 */

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

const PERIODS = [
  { days: 7, label: 'неделя' },
  { days: 30, label: 'месяц' },
  { days: 90, label: 'квартал' },
];

function sumFor(
  items: OzonCatalogProduct[],
  demand: Record<string, { orderedUnits: number; revenue: number }> | undefined,
): { units: number; revenue: number } {
  if (!demand) return { units: 0, revenue: 0 };
  let units = 0;
  let revenue = 0;
  for (const p of items) {
    const d = p.sku ? demand[p.sku] : undefined;
    if (!d) continue;
    units += d.orderedUnits;
    revenue += d.revenue;
  }
  return { units, revenue };
}

export function CardAnalytics({
  accountId, items,
}: {
  accountId: string;
  items: OzonCatalogProduct[];
}) {
  // useQueries, а не useQuery в цикле: три запроса живут независимо, но
  // хук вызывается один раз — правило хуков не нарушается и подавлять
  // проверку не приходится.
  const queries = useQueries({
    queries: PERIODS.map((p) => ({
      queryKey: ['ozon-demand', accountId, p.days],
      queryFn: () => ozonProductCatalogApi.demand(accountId, p.days),
      staleTime: 600_000,
    })),
  });

  const stats = PERIODS.map((p, i) => ({
    ...p,
    ...sumFor(items, queries[i]!.data),
    loading: queries[i]!.isLoading,
  }));

  const week = stats[0]!;
  const month = stats[1]!;
  /*
   * Недельный темп в пересчёте на месяц против фактического месяца: так
   * видно направление. Просто сравнить 7 и 30 дней нельзя — периоды разной
   * длины, и меньшее число ничего не значит само по себе.
   */
  const weeklyPace = week.units * (30 / 7);
  const trend =
    month.units === 0
      ? null
      : Math.round(((weeklyPace - month.units) / month.units) * 100);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <h3 className="text-sm font-semibold text-gray-900">Продажи по периодам</h3>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.days} className="rounded-lg bg-gray-50 p-2.5">
            <p className="text-[11px] text-gray-500">За {s.label}</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-gray-900">
              {s.loading ? '…' : `${s.units} шт.`}
            </p>
            <p className="text-[11px] tabular-nums text-gray-500">
              {s.loading ? '' : money(s.revenue)}
            </p>
          </div>
        ))}
      </div>

      {trend !== null && !week.loading && !month.loading && (
        <p className="mt-2 text-xs">
          {trend > 10 && (
            <span className="text-emerald-700">
              Темп растёт: последняя неделя идёт на {Math.round(weeklyPace)} шт. в месяц — это на {trend}% больше фактического месяца.
            </span>
          )}
          {trend < -10 && (
            <span className="text-red-600">
              Темп падает: последняя неделя идёт на {Math.round(weeklyPace)} шт. в месяц — это на {Math.abs(trend)}% меньше фактического месяца.
            </span>
          )}
          {trend >= -10 && trend <= 10 && (
            <span className="text-gray-500">Темп ровный: неделя идёт примерно так же, как месяц.</span>
          )}
        </p>
      )}

      {month.units === 0 && !month.loading && (
        <p className="mt-2 text-xs text-gray-500">
          За месяц заказов не было. Проверьте остаток: без него Ozon не
          показывает товар покупателю вообще.
        </p>
      )}
    </div>
  );
}
