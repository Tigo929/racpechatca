import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Loader2, Package } from 'lucide-react';
import {
  colorCodeOf, ozonProductCatalogApi, sizeOf, type OzonCatalogProduct,
} from '../../api/ozonProductCatalog';
import { getErrorMessage } from '../../utils/get-error-message';
import { ozonCatalogApi } from '../../api/ozonCatalog';
import { Modal } from '../ui/Modal';
import { ColorGroupRow } from './PrintEditor';
import { UnitEconomicsPanel } from './UnitEconomicsPanel';
import { DEFAULT_SIZES, type ColorGroupDraft } from './printDraft';

/**
 * Карточка товара: один принт со всеми размерами.
 *
 * Список «Мои товары» показывает карточки свёрнутыми — размеры видны только
 * здесь. Иначе при трёх тысячах товаров экран превращается в бесконечную
 * ленту, по которой ничего не найти: размеров у каждого принта пять-шесть,
 * и они множат список впятеро, не добавляя смысла.
 *
 * Здесь же правятся остатки. Без остатка товар в Ozon не продаётся вообще,
 * и это самая частая причина «товар есть, а заказов нет» — поэтому нули
 * подсвечены, а не спрятаны среди прочих цифр.
 */

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

/** Порядок размеров как на бирке, а не по алфавиту: S идёт перед XL. */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

function sizeRank(offerId: string): number {
  const size = (sizeOf(offerId) ?? '').toUpperCase();
  const i = SIZE_ORDER.indexOf(size);
  return i === -1 ? SIZE_ORDER.length : i;
}

export function PrintCardModal({
  accountId, code, items, onClose, onOpenSize,
}: {
  accountId: string;
  code: string;
  items: OzonCatalogProduct[];
  onClose: () => void;
  onOpenSize: (product: OzonCatalogProduct) => void;
}) {
  const qc = useQueryClient();
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () => [...items].sort((a, b) => sizeRank(a.offerId) - sizeRank(b.offerId)),
    [items],
  );

  const first = sorted[0]!;
  // Размер, по которому считаем экономику. По умолчанию — самый ходовой:
  // смотреть разбор выгоднее по тому, что реально продаётся, а не по
  // первому в списке.
  const bestSeller = useMemo(
    () =>
      [...items].sort(
        (a, b) => b.orderedUnits30d - a.orderedUnits30d || b.stockPresent - a.stockPresent,
      )[0]!,
    [items],
  );
  const [economicsOfferId, setEconomicsOfferId] = useState<string | null>(null);
  const economicsFor =
    sorted.find((p) => p.offerId === economicsOfferId) ?? bestSeller;

  /*
   * Внутри родовой группы товары разложены по цветам: JDM-1-1 — это чёрная
   * и белая футболки с одним принтом, у каждой свои размеры и остатки.
   * Общий список размеров смешал бы их в кучу, где «M» встречается дважды.
   */
  const byColor = useMemo(() => {
    const map = new Map<string, OzonCatalogProduct[]>();
    for (const p of sorted) {
      const color = colorCodeOf(p.offerId) ?? 'без цвета в артикуле';
      map.set(color, [...(map.get(color) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sorted]);

  const prices = items.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const samePriceEverywhere = minPrice === maxPrice;

  const totalStock = items.reduce((s, p) => s + p.stockPresent, 0);
  const ordered30d = items.reduce((s, p) => s + p.orderedUnits30d, 0);
  const revenue30d = items.reduce((s, p) => s + p.revenue30d, 0);
  const withoutStock = items.filter((p) => !p.archived && p.stockPresent === 0);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['ozon-warehouses', accountId],
    queryFn: () => ozonProductCatalogApi.warehouses(accountId),
    staleTime: 600_000,
  });

  const saveStocks = useMutation({
    mutationFn: () => {
      const warehouseId = warehouses[0]?.id;
      if (!warehouseId) throw new Error('Не найден склад в кабинете Ozon');
      const changed = Object.entries(stockDraft)
        .filter(([, v]) => v.trim() !== '')
        .map(([offerId, v]) => ({ offerId, stock: Math.max(0, Number(v) || 0) }));
      if (changed.length === 0) throw new Error('Нечего сохранять');
      return ozonProductCatalogApi.updateStocks(accountId, warehouseId, changed);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ozon-catalog', accountId] });
      const failed = res.filter((r) => !r.updated);
      if (failed.length === 0) toast.success(`Остатки обновлены: ${res.length}`);
      else toast.error(`Не приняты: ${failed.length} — ${failed[0]?.error ?? ''}`, { duration: 6000 });
      setStockDraft({});
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const dirty = Object.values(stockDraft).some((v) => v.trim() !== '');

  /*
   * Добавление цвета в эту же родовую группу.
   *
   * Артикулы новых размеров собираются системой из группы, цвета и размера
   * (JDM-1-1 + white + M → JDM-1-1-white-M), поэтому промахнуться с
   * написанием нельзя — а именно на этом обычно и разъезжаются карточки.
   *
   * Работает только для принтов, заведённых через CRM: у товара, созданного
   * прямо в кабинете Ozon, здесь нечего дополнять — связи с ним у нас нет.
   */
  const { data: prints = [] } = useQuery({
    queryKey: ['ozon-prints', accountId],
    queryFn: () => ozonCatalogApi.listPrints(accountId),
    staleTime: 120_000,
  });
  const print = prints.find((p) => p.slug === code);

  const [colorDraft, setColorDraft] = useState<ColorGroupDraft | null>(null);

  const addColor = useMutation({
    mutationFn: () => {
      if (!print || !colorDraft) throw new Error('Не выбран цвет');
      if (!colorDraft.colorDictionaryValueId) {
        throw new Error('Выберите цвет из подсказки — свободный текст Ozon не примет');
      }
      if (colorDraft.sizes.length === 0) throw new Error('Отметьте хотя бы один размер');
      return ozonCatalogApi.addColorGroup(print.id, {
        colorLabel: colorDraft.colorLabel,
        colorDictionaryValueId: colorDraft.colorDictionaryValueId,
        colorCode: colorDraft.colorCode || undefined,
        sizes: colorDraft.sizes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ozon-prints', accountId] });
      setColorDraft(null);
      toast.success('Цвет добавлен в группу. Опубликуйте карточку на вкладке «Создание»');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    // Общее окно проекта, а не своя разметка: оно закрывается кликом мимо и
    // по Escape, держит фокус внутри и возвращает его на место при закрытии.
    // Самодельная копия всё это теряла — закрыть можно было только крестиком.
    <Modal open onClose={onClose} title={code} size="xl">
      <div className="overflow-y-auto bg-gray-50">
        <div className="flex items-start gap-3 border-b border-gray-200 bg-white p-4">
          {first.primaryImage && (
            <img src={first.primaryImage} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg bg-gray-100 object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-gray-600">{first.name}</p>
            {/* Состав родовой группы: видно, каких цветов карточка уже есть
                и сколько у каждого размеров — без ухода на другой экран. */}
            <p className="mt-1 text-[11px] text-gray-500">
              Родовая группа <span className="font-mono text-gray-700">{code}</span> ·{' '}
              {byColor.map(([color, list]) => `${color} (${list.length})`).join(' · ')}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[11px] text-gray-500">Остаток всего</p>
              <p className={`mt-0.5 text-lg font-semibold ${totalStock === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {totalStock} шт.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[11px] text-gray-500">Заказали за 30 дн.</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">{ordered30d} шт.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[11px] text-gray-500">Выручка 30 дн.</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">{money(revenue30d)}</p>
            </div>
          </div>

          {withoutStock.length > 0 && (
            // Товар без остатка в Ozon не показывается покупателю вообще —
            // это не мелочь, а причина отсутствия заказов.
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-xs text-amber-900">
                Без остатка {withoutStock.length} из {items.length} размеров: {withoutStock.map((p) => sizeOf(p.offerId) ?? '—').join(', ')}.
                Пока остаток ноль, Ozon не показывает размер покупателям.
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-gray-900">Размеры и остатки</h3>
              {dirty && (
                <button
                  onClick={() => saveStocks.mutate()}
                  disabled={saveStocks.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {saveStocks.isPending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                  Сохранить остатки
                </button>
              )}
            </div>

            {byColor.map(([color, list]) => (
              <div key={color}>
                {byColor.length > 1 && (
                  <p className="border-t border-gray-100 bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {color}
                  </p>
                )}
                {list.map((p) => {
              const draft = stockDraft[p.offerId] ?? '';
              return (
                <div key={p.offerId} className="flex items-center gap-2 border-t border-gray-50 px-3 py-2">
                  <span className="w-10 flex-shrink-0 text-xs font-semibold text-gray-700">
                    {sizeOf(p.offerId) ?? '—'}
                  </span>
                  <button
                    onClick={() => onOpenSize(p)}
                    className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-gray-400 hover:text-amber-600"
                  >
                    {p.offerId}
                  </button>
                  <span className="w-20 flex-shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
                    {money(p.price)}
                  </span>
                  <span
                    className={`w-16 flex-shrink-0 text-right text-xs tabular-nums ${p.stockPresent === 0 ? 'font-semibold text-red-600' : 'text-gray-600'}`}
                  >
                    {p.stockPresent} шт.
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setStockDraft((d) => ({ ...d, [p.offerId]: e.target.value }))}
                    placeholder="—"
                    aria-label={`Новый остаток ${p.offerId}`}
                    className="w-16 flex-shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              );
                })}
              </div>
            ))}

            {warehouses.length === 0 && (
              <p className="border-t border-gray-50 px-3 py-2 text-[11px] text-gray-500">
                <Package size={11} className="mr-1 inline" aria-hidden="true" />
                Склад из кабинета не загрузился — остатки сохранить не получится.
              </p>
            )}
          </div>

          {print ? (
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              {colorDraft ? (
                <div className="space-y-2">
                  <ColorGroupRow
                    group={colorDraft}
                    accountId={accountId}
                    slug={code}
                    name={first.name}
                    removable={false}
                    onChange={setColorDraft}
                    onRemove={() => setColorDraft(null)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => addColor.mutate()}
                      disabled={addColor.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {addColor.isPending && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                      Добавить цвет в группу
                    </button>
                    <button
                      onClick={() => setColorDraft(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() =>
                    setColorDraft({
                      colorLabel: '',
                      colorDictionaryValueId: 0,
                      colorCode: '',
                      sizes: [...DEFAULT_SIZES],
                    })
                  }
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900"
                >
                  + Добавить цвет в группу {code}
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] text-gray-500">
              Товар заведён прямо в кабинете Ozon, а не через CRM — добавить в
              группу новый цвет отсюда нельзя. Создайте карточку на вкладке
              «Создание» с кодом принта <span className="font-mono">{code}</span>.
            </p>
          )}

          {/* Экономика считается по конкретному размеру: цены у размеров
              расходятся, и «средняя по карточке» скрыла бы как раз то, ради
              чего смотрят — какой размер продаётся в минус. */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Экономика размера</h3>
              <div className="flex flex-wrap gap-1">
                {sorted.map((p) => {
                  const active = p.offerId === economicsFor.offerId;
                  return (
                    <button
                      key={p.offerId}
                      onClick={() => setEconomicsOfferId(p.offerId)}
                      className={`min-h-[28px] rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-amber-600 text-white'
                          : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-amber-700'
                      }`}
                    >
                      {sizeOf(p.offerId) ?? '—'}
                    </button>
                  );
                })}
              </div>
            </div>
            {samePriceEverywhere ? (
              <p className="mb-2 text-[11px] text-gray-500">
                Цена одинаковая у всех размеров — расчёт от размера не зависит.
              </p>
            ) : (
              <p className="mb-2 text-[11px] text-gray-500">
                Цены у размеров разные: от {money(minPrice)} до {money(maxPrice)}.
              </p>
            )}
            <UnitEconomicsPanel
              accountId={accountId}
              offerId={economicsFor.offerId}
              price={economicsFor.price}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
