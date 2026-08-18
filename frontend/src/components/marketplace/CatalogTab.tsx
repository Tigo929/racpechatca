import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, RefreshCw, Search } from 'lucide-react';
import {
  baseCodeOf, colorCodeOf, ozonProductCatalogApi, type OzonCatalogProduct,
} from '../../api/ozonProductCatalog';
import { FilterChip } from '../ui/FilterChip';
import { ProductDetailModal } from './ProductDetailModal';
import { PrintCardModal } from './PrintCardModal';
import { EconomicsSettings } from './EconomicsSettings';

/**
 * «Мои товары» — то, что уже заведено в кабинете Ozon.
 *
 * Товары сгруппированы по коду принта (артикул без размера), потому что
 * работают с ними именно так: цену и остаток меняют сразу всему принту, а не
 * отдельному размеру. Внутри группы — размеры.
 */

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

type StatusFilter = 'all' | 'selling' | 'no_stock' | 'archived';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'selling', label: 'Продаются' },
  { key: 'no_stock', label: 'Без остатка' },
  { key: 'archived', label: 'В архиве' },
];

function matchesFilter(p: OzonCatalogProduct, f: StatusFilter): boolean {
  if (f === 'all') return true;
  if (f === 'archived') return p.archived;
  if (f === 'no_stock') return !p.archived && p.stockPresent === 0;
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<OzonCatalogProduct | null>(null);
  // Открытая карточка принта: размеры показываем только внутри неё.
  const [openedCard, setOpenedCard] = useState<string | null>(null);

  const { data: products = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ozon-catalog', accountId],
    queryFn: () => ozonProductCatalogApi.list(accountId),
    staleTime: 60_000,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['ozon-actions', accountId],
    queryFn: () => ozonProductCatalogApi.actions(accountId),
    staleTime: 300_000,
  });

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
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, query, filter]);

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

      <EconomicsSettings accountId={accountId} />

      {(activeActions.length > 0 || availableActions.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Акции Ozon</h3>
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
        <div className="space-y-3">
          {groups.map(([code, items]) => {
            const first = items[0]!;
            const ordered = items.reduce((s, p) => s + p.orderedUnits30d, 0);
            const stock = items.reduce((s, p) => s + p.stockPresent, 0);
            return (
              <div key={code} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={items.every((i) => selected.has(i.offerId))}
                    onChange={() => toggleGroup(items)}
                    className="w-4 h-4 accent-amber-600 flex-shrink-0"
                    aria-label={`Выбрать все размеры ${code}`}
                  />
                  {/* Вся строка — кнопка: карточка открывается по клику,
                      размеры внутри неё, а не в общем списке. */}
                  <button
                    onClick={() => setOpenedCard(code)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                  {first.primaryImage && (
                    <img src={first.primaryImage} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-gray-900 truncate">{code}</p>
                    <p className="text-xs text-gray-500 truncate">{first.name}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500">
                      {colorsOf(items).join(' · ') || `${items.length} размер(ов)`} ·{' '}
                      <span className={stock === 0 ? 'font-semibold text-red-600' : ''}>
                        остаток {stock}
                      </span>
                    </p>
                    <p className="text-xs font-medium text-gray-700">
                      {ordered > 0 ? `заказали ${ordered} шт. за 30 дн.` : 'продаж за 30 дней нет'}
                    </p>
                  </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openedCard && (
        <PrintCardModal
          accountId={accountId}
          code={openedCard}
          items={groups.find(([c]) => c === openedCard)?.[1] ?? []}
          onClose={() => setOpenedCard(null)}
          onOpenSize={(p) => {
            setOpenedCard(null);
            setOpened(p);
          }}
        />
      )}

      {opened && (
        <ProductDetailModal
          product={opened}
          accountId={accountId}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
