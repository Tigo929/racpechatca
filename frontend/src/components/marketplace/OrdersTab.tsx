import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowUp, Package, RefreshCw } from 'lucide-react';
import { ozonOrdersApi, type OzonOrder, type OzonOrderGroup } from '../../api/ozonOrders';
import { FilterChip } from '../ui/FilterChip';
import { OzonOrderModal } from './OzonOrderModal';
import { parseOzonArticle } from '../../utils/ozon-article';
import {
  formatAccepted,
  sortByAccepted,
  type SortDirection,
} from './ozon-order-sort';
import {
  marketplaceStage,
  stageCounts,
  type MarketplaceStageKey,
} from './marketplace-stage';

/**
 * Заказы Ozon. Главный вопрос оператора — «что горит по отгрузке», поэтому
 * по умолчанию открывается группа «нужно отгрузить».
 *
 * Внутри группы — очередь по времени приёма заказа площадкой, сначала
 * ранние: макеты делают в том же порядке, в каком заказы пришли, и список
 * идёт строка в строку с кабинетом Ozon.
 */

/** Шапка столбца — в одном месте, чтобы столбцы не разъезжались. */
const TH =
  'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400';

const GROUPS: { key: OzonOrderGroup | 'all'; label: string }[] = [
  { key: 'to_ship', label: 'Нужно отгрузить' },
  { key: 'in_transit', label: 'В доставке' },
  { key: 'delivered', label: 'Доставлены' },
  { key: 'problem', label: 'Проблемные' },
  { key: 'cancelled', label: 'Отменены' },
  { key: 'all', label: 'Все' },
];


/**
 * Этап заказа в нашем процессе плюс статус площадки мелким.
 *
 * Главным стоит наш этап: по нему решают, что делать дальше. Статус Ozon
 * остаётся второй строкой — сроки отгрузки ведёт площадка, и совсем убирать
 * его нельзя.
 */
function StageCell({ order }: { order: OzonOrder }) {
  const stage = marketplaceStage(order.crm);
  return (
    <>
      <span
        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${stage.chip}`}
      >
        {stage.label}
      </span>
      <p className="mt-1 text-[11px] text-gray-400">Ozon: {order.statusLabel}</p>
    </>
  );
}

/**
 * Что печатать: цвет, размер и принт из артикула. Цены и способ доставки
 * не выводим — они есть в кабинете Ozon, а здесь только мешали бы.
 */
function ItemLines({ items }: { items: OzonOrder['items'] }) {
  return (
    <>
      {items.map((item) => {
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
    </>
  );
}

/**
 * Строка таблицы — тот же набор столбцов, что в кабинете Ozon: номер
 * отправления, статус, когда принят, что в нём.
 *
 * Столбцы те же и в том же порядке намеренно: два окна читаются строка
 * в строку, и не приходится вспоминать, где что лежит.
 */
function OrderTableRow({ order, onOpen }: { order: OzonOrder; onOpen: () => void }) {
  // Полоса слева — тоже наш этап: в списке глазами ищут именно его.
  const stage = marketplaceStage(order.crm);
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-l-[4px] ${stage.stripe} hover:bg-indigo-50/40`}
      style={{ borderBottom: '1px solid #F1F5F9' }}
    >
      <td className="px-4 py-3 align-top">
        <span className="text-sm font-semibold text-gray-900">
          {order.postingNumber}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <StageCell order={order} />
      </td>
      <td className="px-4 py-3 align-top whitespace-nowrap text-sm tabular-nums text-gray-500">
        {formatAccepted(order.createdAt)}
      </td>
      <td className="px-4 py-3 align-top">
        <ItemLines items={order.items} />
        {order.cancelReason && (
          <p className="mt-1 text-xs text-gray-500">
            Причина отмены: {order.cancelReason}
          </p>
        )}
      </td>
    </tr>
  );
}

/**
 * То же самое для телефона: таблица в 375 пикселей не помещается, и вместо
 * столбцов строка складывается в карточку. Порядок строк — тот же.
 */
function OrderRow({ order, onOpen }: { order: OzonOrder; onOpen: () => void }) {
  const stage = marketplaceStage(order.crm);
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
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate pt-0.5 text-sm font-semibold text-gray-900">
          {order.postingNumber}
        </p>
        <div className="flex-shrink-0 text-right">
          <StageCell order={order} />
        </div>
      </div>

      <div className="mt-1 space-y-0.5">
        <ItemLines items={order.items} />
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
  /*
   * Этап нашего процесса — отдельный фильтр от групп площадки.
   *
   * Группы Ozon отвечают на вопрос «что с доставкой», а работа идёт по
   * нашим этапам: сначала завести заказ, потом макет, потом согласование,
   * потом производство. Одним списком это не читалось — приходилось
   * глазами перебирать строки, выискивая, где какой этап.
   */
  const [stage, setStage] = useState<MarketplaceStageKey | 'all'>('all');

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

  const byGroup = group === 'all' ? all : all.filter((o) => o.group === group);
  // Кнопки этапов считаются по выбранной группе: иначе «Готов — 3» рядом
  // с пустым списком означало бы, что эти три где-то в другой группе.
  const stages = stageCounts(byGroup);
  const visible = sortByAccepted(
    stage === 'all'
      ? byGroup
      : byGroup.filter((o) => marketplaceStage(o.crm).key === stage),
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
              onClick={() => {
                setGroup(g.key);
                // Этап мог быть выбран в другой группе: там он есть,
                // здесь — нет, и человек увидел бы пустой экран.
                setStage('all');
              }}
            >
              {g.label}
              <span className={group === g.key ? 'ml-1.5 opacity-80' : 'ml-1.5 text-gray-400'}>
                {counts[g.key] ?? 0}
              </span>
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* На телефоне шапки таблицы нет — порядок переключается здесь. */}
          <div className="flex items-center gap-1.5 md:hidden">
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

      {/* Этапы нашего процесса. Показываем только те, что в выборке есть:
          кнопка «Готов — 0» занимает место и ничего не говорит. */}
      {stages.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Этап
          </span>
          <FilterChip active={stage === 'all'} onClick={() => setStage('all')}>
            Все
            <span className={stage === 'all' ? 'ml-1.5 opacity-80' : 'ml-1.5 text-gray-400'}>
              {byGroup.length}
            </span>
          </FilterChip>
          {stages.map((s) => (
            <FilterChip
              key={s.key}
              active={stage === s.key}
              onClick={() => setStage(s.key)}
            >
              {s.label}
              <span className={stage === s.key ? 'ml-1.5 opacity-80' : 'ml-1.5 text-gray-400'}>
                {s.count}
              </span>
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <Package size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-500">
            {stage !== 'all'
              ? 'На этом этапе сейчас пусто.'
              : group === 'to_ship'
                ? 'Ничего не ждёт отгрузки — всё передано в доставку.'
                : 'В этой группе заказов нет.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {/* Десктоп: столбцы как в кабинете Ozon. */}
          <table className="hidden w-full md:table">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                <th scope="col" className={TH}>Номер отправления</th>
                <th scope="col" className={TH}>Статус</th>
                <th scope="col" className="px-4 py-2.5 text-left">
                  {/*
                    Сортировка живёт в заголовке столбца, как в кабинете:
                    там очередь переключают именно так, и искать отдельный
                    переключатель не приходится.
                  */}
                  <button
                    type="button"
                    onClick={() => setSort((v) => (v === 'earliest' ? 'latest' : 'earliest'))}
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-indigo-700"
                    aria-label={
                      sort === 'earliest'
                        ? 'Принят: сначала ранние. Нажмите, чтобы показать сначала поздние'
                        : 'Принят: сначала поздние. Нажмите, чтобы показать сначала ранние'
                    }
                  >
                    Принят
                    {sort === 'earliest' ? (
                      <ArrowUp size={12} aria-hidden="true" />
                    ) : (
                      <ArrowDown size={12} aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th scope="col" className={TH}>Количество, артикул</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <OrderTableRow
                  key={o.postingNumber}
                  order={o}
                  onOpen={() => setOpenPosting(o.postingNumber)}
                />
              ))}
            </tbody>
          </table>

          {/* Телефон: те же строки, сложенные в карточку. */}
          <div className="md:hidden">
            {visible.map((o) => (
              <OrderRow
                key={o.postingNumber}
                order={o}
                onOpen={() => setOpenPosting(o.postingNumber)}
              />
            ))}
          </div>
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
