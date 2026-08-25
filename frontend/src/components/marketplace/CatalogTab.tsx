import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, RefreshCw, Search } from 'lucide-react';
import {
  baseCodeOf, colorCodeOf, ozonProductCatalogApi, sizeOf, type OzonCatalogProduct,
} from '../../api/ozonProductCatalog';
import { FilterChip } from '../ui/FilterChip';
import { ProductDetailModal } from './ProductDetailModal';
import { PrintCardModal } from './PrintCardModal';
import { BulkStockModal } from './BulkStockModal';
import { EconomicsSettings } from './EconomicsSettings';
import { usePersistentState } from '../../hooks/usePersistentState';

/**
 * «Мои товары» — то, что уже заведено в кабинете Ozon.
 *
 * Товары сгруппированы по коду принта (артикул без размера), потому что
 * работают с ними именно так: цену и остаток меняют сразу всему принту, а не
 * отдельному размеру. Внутри группы — размеры.
 */

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

type StatusFilter = 'all' | 'selling' | 'no_stock' | 'improve' | 'archived';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'selling', label: 'Продаются' },
  { key: 'no_stock', label: 'Без остатка' },
  { key: 'improve', label: 'Можно улучшить' },
  { key: 'archived', label: 'В архиве' },
];

function matchesFilter(p: OzonCatalogProduct, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'archived') return p.archived;
  if (f === 'no_stock') return !p.archived && p.stockPresent === 0;
  // Рейтинг проверяется на уровне группы — здесь пропускаем всё живое.
  if (f === 'improve') return !p.archived;
  return !p.archived && p.stockPresent > 0;
}

/**
 * Цвета внутри родовой группы. У старых товаров цвета в артикуле нет —
 * тогда список пустой, и в шапке остаётся число размеров.
 */
function colorsOf(items: OzonCatalogProduct[]): string[] {
  const set = new Set<string>();
  for (const p of items) {
    const c = colorCodeOf(p.offerId);
    if (c) set.add(c);
  }
  return [...set].sort();
}

export function CatalogTab({ accountId }: { accountId: string }) {
  // Поиск и отбор держатся: между «Моими товарами» и «Созданием» ходят
  // постоянно, и каждый раз набирать артикул заново — лишняя работа.
  const [query, setQuery] = usePersistentState(`ozon-catalog-search-${accountId}`, '');
  const [filter, setFilter] = usePersistentState<StatusFilter>(
    `ozon-catalog-filter-${accountId}`,
    'all',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStockOpen, setBulkStockOpen] = useState(false);
  const [opened, setOpened] = useState<OzonCatalogProduct | null>(null);
  // Открытая карточка принта: размеры показываем только внутри неё.
  const [openedCard, setOpenedCard] = useState<string | null>(null);

  const { data: products = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ozon-catalog', accountId],
    queryFn: () => ozonProductCatalogApi.list(accountId),
    staleTime: 60_000,
  });

  /*
   * Контент-рейтинг Ozon — то, что в кабинете WB называется «можно
   * улучшить». Запрос тяжёлый (партии по сотне SKU), поэтому идёт отдельно
   * от списка: товары показываются сразу, рейтинг подтягивается следом.
   */
  const { data: ratings = {} } = useQuery({
    queryKey: ['ozon-content-rating', accountId],
    queryFn: () => ozonProductCatalogApi.contentRating(accountId),
    staleTime: 600_000,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['ozon-actions', accountId],
    queryFn: () => ozonProductCatalogApi.actions(accountId),
    staleTime: 300_000,
  });

  /** Худший рейтинг в группе: тянет вниз тот цвет, что заполнен хуже всех. */
  const ratingOf = (items: OzonCatalogProduct[]): number | null => {
    const values = items
      .map((p) => (p.sku ? ratings[p.sku]?.rating : undefined))
      .filter((r): r is number => typeof r === 'number');
    return values.length ? Math.min(...values) : null;
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        matchesFilter(p, filter) &&
        (!q || p.offerId.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)),
    );
    const map = new Map<string, OzonCatalogProduct[]>();
    for (const p of filtered) {
      const code = baseCodeOf(p.offerId);
      map.set(code, [...(map.get(code) ?? []), p]);
    }
    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // «Можно улучшить» отбирается по группам, а не по отдельным товарам:
    // рейтинг живёт на карточке целиком, и показывать половину группы
    // бессмысленно — улучшать всё равно придётся всю.
    if (filter !== 'improve') return entries;
    return entries.filter(([, list]) => {
      const r = ratingOf(list);
      return r !== null && r < 100;
    });
  }, [products, query, filter, ratings]);

  /*
   * Товары открытой карточки берём из всего каталога, а не из отфильтрованных
   * групп. Иначе карточка теряла содержимое под собой: сохранил остаток при
   * фильтре «Без остатка» — группа выпала из выборки, items стали пустыми, и
   * окно падало на первом же обращении к товару.
   */
  const openedItems = useMemo(
    () => (openedCard ? products.filter((p) => baseCodeOf(p.offerId) === openedCard) : []),
    [products, openedCard],
  );

  const toggleGroup = (items: OzonCatalogProduct[]) => {
    const allSelected = items.every((i) => selected.has(i.offerId));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) {
        if (allSelected) next.delete(i.offerId);
        else next.add(i.offerId);
      }
      return next;
    });
  };

  const activeActions = actions.filter((a) => a.isParticipating);
  const availableActions = actions.filter((a) => !a.isParticipating && a.potentialProducts > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] text-gray-500">Товаров в кабинете</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900">{products.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] text-gray-500">Заказано за 30 дней</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900">
            {products.reduce((s, p) => s + p.orderedUnits30d, 0)} шт.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] text-gray-500">Выручка за 30 дней</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900">
            {money(products.reduce((s, p) => s + p.revenue30d, 0))}
          </p>
        </div>
      </div>

      {(activeActions.length > 0 || availableActions.length > 0) && (
        /* Свёрнуто: акции смотрят раз в неделю, а список товаров — каждый
           день, и держать справку выше работы значит листать мимо неё. */
        <details className="rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">
            Акции Ozon
            <span className="ml-2 text-xs font-normal text-gray-500">
              участвуем в {activeActions.length}, подходим ещё под {availableActions.length}
            </span>
          </summary>
          <div className="mt-2 space-y-2">
            {activeActions.length === 0 && (
              <p className="text-xs text-gray-500">Сейчас товары не участвуют ни в одной акции.</p>
            )}
            {activeActions.map((a) => (
              <div key={a.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-gray-700">{a.title}</span>
                <span className="flex-shrink-0 text-emerald-700 font-medium">
                  участвует {a.participatingProducts} товар(ов)
                </span>
              </div>
            ))}
            {availableActions.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-gray-500">{a.title}</span>
                <span className="flex-shrink-0 text-gray-400">
                  подходит {a.potentialProducts} товар(ов)
                </span>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 pt-1">
              Добавление товаров в акции — следующий шаг; сейчас видно только участие.
            </p>
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по артикулу или названию"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        {FILTERS.map((f) => (
          <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </FilterChip>
        ))}
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Обновить"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {/* Массовые действия появляются только когда есть что делать:
          панель, висящая над пустым выбором, занимает место и путает. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-sm text-amber-900">
            Выбрано: <span className="font-semibold">{selected.size}</span>
          </span>
          <button
            onClick={() => setBulkStockOpen(true)}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Изменить остатки Ozon
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg px-2 py-1.5 text-xs text-amber-800 transition-colors hover:bg-amber-100"
          >
            Снять выделение
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Загружаем каталог из Ozon…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <Boxes size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-500">
            {products.length === 0
              ? 'В кабинете нет товаров.'
              : 'Под фильтр ничего не подошло.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          {/* Таблица, а не карточки-плитки: по колонкам глаз сравнивает
              товары между собой, а в плитках приходится читать каждую. */}
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Товар</th>
                <th className="px-3 py-2 font-medium">Остаток</th>
                <th className="px-3 py-2 font-medium">Размеры</th>
                <th className="px-3 py-2 font-medium">Цвета</th>
                <th className="px-3 py-2 font-medium">Баркоды</th>
                <th className="px-3 py-2 text-right font-medium">Цена</th>
                <th className="px-3 py-2 font-medium">Рейтинг</th>
                <th className="px-3 py-2 text-right font-medium">Продажи 30 дн.</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([code, items]) => {
                const first = items[0]!;
                const ordered = items.reduce((s, p) => s + p.orderedUnits30d, 0);
                const revenue = items.reduce((s, p) => s + p.revenue30d, 0);
                const stock = items.reduce((s, p) => s + p.stockPresent, 0);
                const sizes = items
                  .map((p) => sizeOf(p.offerId))
                  .filter((x): x is string => Boolean(x));
                const barcodes = items.flatMap((p) => p.barcodes);
                const prices = items.map((p) => p.price);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                return (
                  <tr
                    key={code}
                    onClick={() => setOpenedCard(code)}
                    className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-amber-50/40"
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={items.every((i) => selected.has(i.offerId))}
                        onChange={() => toggleGroup(items)}
                        className="h-4 w-4 accent-amber-600"
                        aria-label={`Выбрать все размеры ${code}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {first.primaryImage && (
                          <img src={first.primaryImage} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg bg-gray-100 object-cover" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs text-gray-800">{first.name}</p>
                          <p className="truncate font-mono text-[11px] text-gray-400">{code}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${stock === 0 ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
                      {stock}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {sizes.length ? sizes.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {colorsOf(items).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-500">
                      {barcodes.length
                        ? `${barcodes[0]}${barcodes.length > 1 ? ` +${barcodes.length - 1}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                      {minPrice === maxPrice ? money(minPrice) : `${money(minPrice)}–${money(maxPrice)}`}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {(() => {
                        const r = ratingOf(items);
                        if (r === null) return <span className="text-gray-300">—</span>;
                        // Порог 90 — не выдумка: ниже него Ozon сам помечает
                        // карточку как требующую доработки.
                        const color =
                          r >= 90 ? 'text-emerald-700' : r >= 70 ? 'text-amber-600' : 'text-red-600';
                        return <span className={`font-semibold ${color}`}>{Math.round(r)}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {ordered > 0 ? (
                        <>
                          <span className="font-semibold text-gray-900">{ordered} шт.</span>
                          <span className="block text-gray-400">{money(revenue)}</span>
                        </>
                      ) : (
                        <span className="text-gray-400">нет продаж</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Себестоимость и налог — настройка «задал и забыл», поэтому она под
          списком, а не над ним: сверху то, ради чего раздел открывают. */}
      <EconomicsSettings accountId={accountId} />

      {/* Карточку группы прячем, пока открыт размер: закрытие размера
          возвращает к ней, и «назад» получается само собой. */}
      {openedCard && !opened && openedItems.length > 0 && (
        <PrintCardModal
          accountId={accountId}
          code={openedCard}
          items={openedItems}
          onClose={() => setOpenedCard(null)}
          onOpenSize={(p) => setOpened(p)}
        />
      )}

      {bulkStockOpen && (
        <BulkStockModal
          accountId={accountId}
          offerIds={[...selected]}
          onClose={() => setBulkStockOpen(false)}
        />
      )}

      {opened && (
        <ProductDetailModal
          product={opened}
          accountId={accountId}
          siblings={openedItems}
          onSelect={setOpened}
          onBack={openedCard ? () => setOpened(null) : undefined}
          onClose={() => {
            setOpened(null);
            setOpenedCard(null);
          }}
        />
      )}
    </div>
  );
}
