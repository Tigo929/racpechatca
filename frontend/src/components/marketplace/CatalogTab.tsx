import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Boxes, Percent, RefreshCw, Search, Tag } from 'lucide-react';
import {
  ozonProductCatalogApi, printCodeOf, sizeOf, type OzonCatalogProduct,
} from '../../api/ozonProductCatalog';
import { getErrorMessage } from '../../utils/get-error-message';
import { FilterChip } from '../ui/FilterChip';
import { ProductDetailModal } from './ProductDetailModal';
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

/** Массовая смена цены у выбранных товаров: в рублях или процентом. */
function BulkPriceBar({
  accountId, selected, products, onDone,
}: {
  accountId: string;
  selected: Set<string>;
  products: OzonCatalogProduct[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'set' | 'percent'>('set');
  const [value, setValue] = useState('');

  const apply = useMutation({
    mutationFn: () => {
      const num = Number(value);
      const items = products
        .filter((p) => selected.has(p.offerId))
        .map((p) => ({
          offerId: p.offerId,
          price: mode === 'set' ? num : Math.round(p.price * (1 + num / 100)),
          oldPrice: p.oldPrice || undefined,
        }));
      return ozonProductCatalogApi.updatePrices(accountId, items);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ozon-catalog', accountId] });
      const failed = res.filter((r) => !r.updated);
      if (failed.length === 0) toast.success(`Цена обновлена: ${res.length} товар(ов)`);
      else toast.error(`Не приняты: ${failed.length} — ${failed[0]?.error ?? ''}`, { duration: 6000 });
      onDone();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось обновить цены')),
  });

  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
      <span className="text-sm font-medium text-amber-900">
        Выбрано: {selected.size}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => setMode('set')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${mode === 'set' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          <Tag size={11} className="inline mr-1" aria-hidden="true" />новая цена
        </button>
        <button
          onClick={() => setMode('percent')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${mode === 'percent' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          <Percent size={11} className="inline mr-1" aria-hidden="true" />изменить на %
        </button>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={mode === 'set' ? '3500' : '-10'}
        className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button
        onClick={() => apply.mutate()}
        disabled={apply.isPending || !value || !selected.size}
        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {apply.isPending ? 'Применяем…' : 'Применить'}
      </button>
      <button onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700 ml-auto">
        снять выделение
      </button>
    </div>
  );
}

function ProductRow({
  product, checked, onToggle, onOpen,
}: {
  product: OzonCatalogProduct;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const size = sizeOf(product.offerId) ?? '—';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-t border-gray-50 ${product.archived ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-4 h-4 accent-amber-600 flex-shrink-0"
        aria-label={`Выбрать ${product.offerId}`}
      />
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg px-1 py-0.5 -mx-1">
        <span className="w-10 flex-shrink-0 text-xs font-semibold text-gray-700">{size}</span>
        <span className="flex-1 min-w-0 truncate font-mono text-[11px] text-gray-400">{product.offerId}</span>
        <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums text-gray-600">
          {product.stockPresent} шт.
        </span>
        <span className="w-20 flex-shrink-0 text-right text-xs tabular-nums text-gray-600">
          {product.orderedUnits30d > 0 ? `${product.orderedUnits30d} зак.` : '—'}
        </span>
        <span className="w-20 flex-shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
          {money(product.price)}
        </span>
      </button>
    </div>
  );
}

export function CatalogTab({ accountId }: { accountId: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<OzonCatalogProduct | null>(null);

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
      const code = printCodeOf(p.offerId);
      map.set(code, [...(map.get(code) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, query, filter]);

  const toggle = (offerId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId);
      else next.add(offerId);
      return next;
    });
  };

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
                  {first.primaryImage && (
                    <img src={first.primaryImage} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-gray-900 truncate">{code}</p>
                    <p className="text-xs text-gray-500 truncate">{first.name}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500">{items.length} размер(ов) · остаток {stock}</p>
                    <p className="text-xs font-medium text-gray-700">
                      {ordered > 0 ? `заказали ${ordered} шт. за 30 дн.` : 'продаж за 30 дней нет'}
                    </p>
                  </div>
                </div>
                {items
                  .sort((a, b) => a.offerId.localeCompare(b.offerId))
                  .map((p) => (
                    <ProductRow
                      key={p.offerId}
                      product={p}
                      checked={selected.has(p.offerId)}
                      onToggle={() => toggle(p.offerId)}
                      onOpen={() => setOpened(p)}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <BulkPriceBar
          accountId={accountId}
          selected={selected}
          products={products}
          onDone={() => setSelected(new Set())}
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
