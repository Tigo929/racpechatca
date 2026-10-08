import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { ozonOrdersApi, type OzonOrder, type OzonOrderGroup } from '../../api/ozonOrders';
import { FilterChip } from '../ui/FilterChip';
import { OzonOrderModal } from './OzonOrderModal';
import { parseOzonArticle } from '../../utils/ozon-article';
import {
  formatAccepted,
  sortByAccepted,
  type SortDirection,
} from './ozon-order-sort';

/**
 * Заказы Ozon. Главный вопрос оператора — «что горит по отгрузке», поэтому
 * по умолчанию открывается группа «нужно отгрузить».
 *
 * Внутри группы — очередь по времени приёма заказа площадкой, сначала
 * ранние: макеты делают в том же порядке, в каком заказы пришли, и список
 * идёт строка в строку с кабинетом Ozon.
 */

const GROUPS: { key: OzonOrderGroup | 'all'; label: string }[] = [
  { key: 'to_ship', label: 'Нужно отгрузить' },
  { key: 'in_transit', label: 'В доставке' },
  { key: 'delivered', label: 'Доставлены' },
  { key: 'problem', label: 'Проблемные' },
  { key: 'cancelled', label: 'Отменены' },
  { key: 'all', label: 'Все' },
];


/**
 * Цвет этапа отправления.
 *
 * Список нужен для одного: с одного взгляда понять, что с заказом. Поэтому
 * этап несёт цвет, а не подпись мелким шрифтом, и цвет идёт по статусу
 * площадки, а не по группе: внутри «нужно отгрузить» лежат и только что
 * пришедший заказ, и уже собранный, а это разные дела.
 *
 * Сроки отгрузки отсюда убраны намеренно (решение владельца 02.10.2026):
 * их видно в кабинете Ozon, а здесь они закрашивали половину списка
 * красным, и за тревогой терялось главное — какой заказ печатать.
 */
const STAGE: Record<string, { chip: string; stripe: string }> = {
  // Пришёл, ещё ничего не сделано — синий, как «новый» в заказах CRM.
  awaiting_approve: { chip: 'bg-blue-50 text-blue-700', stripe: 'border-l-blue-500' },
  awaiting_packaging: { chip: 'bg-blue-50 text-blue-700', stripe: 'border-l-blue-500' },
  // Собран, ждёт отгрузки — янтарный: дело за нами, но печать уже позади.
  awaiting_registration: { chip: 'bg-amber-50 text-amber-700', stripe: 'border-l-amber-500' },
  awaiting_deliver: { chip: 'bg-amber-50 text-amber-700', stripe: 'border-l-amber-500' },
  // Уехал — голубой: от нас уже ничего не требуется.
  delivering: { chip: 'bg-sky-50 text-sky-700', stripe: 'border-l-sky-500' },
  driver_pickup: { chip: 'bg-sky-50 text-sky-700', stripe: 'border-l-sky-500' },
  delivered: { chip: 'bg-emerald-50 text-emerald-700', stripe: 'border-l-emerald-500' },
  cancelled: { chip: 'bg-gray-100 text-gray-500', stripe: 'border-l-gray-300' },
};

/** Группа — запасной цвет для статуса, которого ещё нет в наборе. */
const GROUP_STAGE: Record<string, { chip: string; stripe: string }> = {
  to_ship: { chip: 'bg-amber-50 text-amber-700', stripe: 'border-l-amber-500' },
  in_transit: { chip: 'bg-sky-50 text-sky-700', stripe: 'border-l-sky-500' },
  delivered: { chip: 'bg-emerald-50 text-emerald-700', stripe: 'border-l-emerald-500' },
  cancelled: { chip: 'bg-gray-100 text-gray-500', stripe: 'border-l-gray-300' },
  problem: { chip: 'bg-red-50 text-red-700', stripe: 'border-l-red-500' },
};

function stageOf(order: OzonOrder) {
  return (
    STAGE[order.status] ??
    GROUP_STAGE[order.group] ?? {
      chip: 'bg-gray-100 text-gray-500',
      stripe: 'border-l-gray-300',
    }
  );
}

/**
 * Строка отправления. Нажатие открывает её как заказ CRM: цвет, размер
 * и принт уже выведены из артикула, и по ним собирается макет.
 *
 * Список в одну колонку, а не плитка в две: очередь читают сверху вниз,
 * и в два столбца «следующий по времени» оказывается то справа, то слева.
 */
function OrderRow({ order, onOpen }: { order: OzonOrder; onOpen: () => void }) {
  const stage = stageOf(order);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left bg-white border-b border-gray-100 border-l-[4px] ${stage.stripe} px-3.5 py-3 transition-colors hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:flex sm:items-start sm:gap-4`}
    >
      {/* Время приёма — первым, как в кабинете: по нему и выстроена очередь. */}
      <span className="block shrink-0 text-xs font-medium tabular-nums text-gray-500 sm:w-28 sm:pt-0.5">
        {formatAccepted(order.createdAt)}
      </span>

      <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-gray-900">
          {order.postingNumber}
        </p>
        <span
          className={`flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${stage.chip}`}
        >
          {order.statusLabel}
        </span>
      </div>

      <div className="mt-1 space-y-0.5">
        {order.items.map((item) => {
          // Цвет, размер и принт — всё, что нужно, чтобы понять, что печатать.
          // Цены и способ доставки убраны: они есть в кабинете Ozon.
          const article = parseOzonArticle(item.offerId);
          return (
            <p
              key={item.offerId + item.sku}
              className="truncate text-xs text-gray-600"
            >
              {article ? (
                <>
                  {article.colorLabel} · {article.size}
                  <span className="ml-1.5 font-mono text-gray-400">
                    {article.printSlug}
                  </span>
                </>
              ) : (
                <span className="font-mono text-gray-500">{item.offerId}</span>
              )}
              {item.quantity > 1 && (
                <span className="ml-1 text-gray-500">× {item.quantity}</span>
              )}
            </p>
          );
        })}
      </div>

      {order.cancelReason && (
        <p className="mt-1 text-xs text-gray-500">Причина отмены: {order.cancelReason}</p>
      )}
      </div>
    </button>
  );
}

export function OrdersTab({ accountId }: { accountId: string }) {
  const [group, setGroup] = useState<OzonOrderGroup | 'all'>('to_ship');
  const [openPosting, setOpenPosting] = useState<string | null>(null);
  /*
   * По умолчанию показываем только линейку papa: в кабинете лежат и другие
   * товары, и вперемешку свои заказы искать неудобно. Скрытые не пропадают —
   * переключатель ниже возвращает их целиком.
   */
  const [showAll, setShowAll] = useState(false);
  /*
   * Порядок очереди. По умолчанию сначала ранние: заказ, пришедший первым,
   * и печатать нужно первым. Обратный порядок оставлен для вопроса «что
   * пришло только что».
   */
  const [sort, setSort] = useState<SortDirection>('earliest');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ozon-orders', accountId, showAll],
    queryFn: () =>
      ozonOrdersApi.list(accountId, {
        sinceDays: 90,
        limit: 200,
        ...(showAll ? { all: 1 as const } : {}),
      }),
    // Заказы приходят в течение дня; минута свежести — разумный компромисс
    // между актуальностью и лимитами API Ozon.
    staleTime: 60_000,
  });

  const all = data?.orders ?? [];
  const counts = GROUPS.reduce<Record<string, number>>((acc, g) => {
    acc[g.key] = g.key === 'all' ? all.length : all.filter((o) => o.group === g.key).length;
    return acc;
  }, {});

  const visible = sortByAccepted(
    group === 'all' ? all : all.filter((o) => o.group === group),
    sort,
  );

  const overdueCount = all.filter((o) => o.shipmentOverdue).length;
  const hidden = data?.hiddenByCatalog ?? 0;

  return (
    <div className="space-y-4">
      {(hidden > 0 || showAll) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700">
          <span>
            {showAll
              ? 'Показаны все товары кабинета, включая другие линейки.'
              : `Скрыто отправлений других линеек: ${hidden}.`}
          </span>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
          >
            {showAll ? 'Показывать только papa' : 'Показать все'}
          </button>
        </div>
      )}
      {overdueCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">
              Просрочена отгрузка: {overdueCount} {overdueCount === 1 ? 'заказ' : 'заказ(ов)'}
            </p>
            <p className="mt-0.5 text-xs">
              Ozon штрафует за срыв срока отгрузки — эти заказы нужно передать в доставку в первую очередь.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <FilterChip
              key={g.key}
              active={group === g.key}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
              <span className={group === g.key ? 'ml-1.5 opacity-80' : 'ml-1.5 text-gray-400'}>
                {counts[g.key] ?? 0}
              </span>
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Принят
            </span>
            <FilterChip
              active={sort === 'earliest'}
              onClick={() => setSort('earliest')}
            >
              Сначала ранние
            </FilterChip>
            <FilterChip
              active={sort === 'latest'}
              onClick={() => setSort('latest')}
            >
              Сначала поздние
            </FilterChip>
          </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Обновить"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex-shrink-0"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <Package size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-500">
            {group === 'to_ship'
              ? 'Ничего не ждёт отгрузки — всё передано в доставку.'
              : 'В этой группе заказов нет.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {visible.map((o) => (
            <OrderRow
              key={o.postingNumber}
              order={o}
              onOpen={() => setOpenPosting(o.postingNumber)}
            />
          ))}
        </div>
      )}

      {openPosting && (() => {
        const posting = all.find((o) => o.postingNumber === openPosting);
        return posting ? (
          <OzonOrderModal
            accountId={accountId}
            order={posting}
            onClose={() => setOpenPosting(null)}
          />
        ) : null;
      })()}

      {data?.hasNext && (
        <p className="text-xs text-gray-400">
          Показаны заказы за последние 90 дней (первые 200). Более старые — в кабинете Ozon.
        </p>
      )}
    </div>
  );
}
