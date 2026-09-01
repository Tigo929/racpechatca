import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Check,
  ExternalLink,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { canvasProductionApi } from '../../api/canvasProduction';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/useAuth';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { EnumCanvasMaterial, ItemCanvas, OrderPhoto } from '../../types/index';

interface Props {
  order: OrderPhoto;
}

/**
 * Строка позиции холста.
 *
 * `sizeKey` пустой — размер нестандартный: тогда подпись и цену производства
 * вводят руками. Со стандартным размером цену считает сервер по прайсу, и
 * трогать её нельзя: занизить себестоимость значит уйти в минус незаметно.
 */
type EditState = {
  sizeKey: string;
  material: EnumCanvasMaterial;
  formatCanvas: string;
  quantity: string;
  clientPrice: string;
  contractorPrice: string;
};

const CUSTOM_SIZE = '';

const EMPTY: EditState = {
  sizeKey: '30x40',
  material: 'SYNTHETIC',
  formatCanvas: '',
  quantity: '1',
  clientPrice: '1500',
  contractorPrice: '0',
};

const inputCls =
  'w-full rounded border border-gray-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';

const money = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

function toDto(state: EditState) {
  const base = {
    quantity: Math.max(1, Number(state.quantity) || 1),
    clientPrice: Math.max(0, Number(state.clientPrice) || 0),
  };
  if (state.sizeKey) {
    // Размер из прайса: подпись и цену производства поставит сервер.
    return { ...base, sizeKey: state.sizeKey, material: state.material };
  }
  return {
    ...base,
    formatCanvas: state.formatCanvas.trim(),
    contractorPrice: Math.max(0, Number(state.contractorPrice) || 0),
  };
}

export function CanvasItemsTable({ order }: Props) {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'ORDER_MANAGER';
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY);
  const [adding, setAdding] = useState(false);
  // Недобавленная позиция не пропадает при уходе с карточки заказа.
  const [newItem, setNewItem] = usePersistentState<EditState>(
    `order-new-canvas-${order.id}`,
    EMPTY,
  );

  /*
   * Прайс производства: из него берутся подпись размера и цена, которую мы
   * должны. Только у админа — это условия договора, менеджеру их видеть
   * незачем, и сервер их ему не отдаст.
   */
  const isAdmin = user?.role === 'ADMIN';
  const { data: pricing } = useQuery({
    queryKey: ['canvas-production-pricing'],
    queryFn: canvasProductionApi.pricing,
    enabled: isAdmin,
    staleTime: 600_000,
  });

  const items = order.canvasItems ?? [];
  const totals = items.reduce(
    (acc, item) => {
      acc.revenue += item.pricePosition ?? 0;
      acc.cost += item.contractorCostPosition ?? 0;
      acc.profit += item.profitPosition ?? 0;
      return acc;
    },
    { revenue: 0, cost: 0, profit: 0 },
  );

  /*
   * Доставка производства: платим мы, клиенту называем больше. Разница —
   * заработок, а не транзит, поэтому она в прибыли, а не в себестоимости
   * позиций. У самовывоза обе величины нулевые.
   */
  const deliveryOwnCost =
    order.deliveryMethod === 'PRODUCTION_MSK' ? (pricing?.delivery.cost ?? 0) : 0;
  const deliveryCharged =
    order.deliveryMethod === 'PRODUCTION_MSK' ? (order.deliveryCost ?? 0) : 0;
  /*
   * Разработка дизайна — 100% в прибыль владельца.
   *
   * Это его собственная работа, а не позиция производства: подрядчику
   * за неё ничего не платят, себестоимости у неё нет. Раньше сумма входила
   * в чек клиента (в «Сумму заказа»), но в «Мою прибыль» не попадала —
   * заработок занижался ровно на неё.
   */
  const designCost = order.designDevelopmentCost ?? 0;
  const myProfit =
    totals.profit + deliveryCharged - deliveryOwnCost + designCost;

  const invalidate = (updated: OrderPhoto) => {
    qc.setQueryData(['order', order.id], updated);
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const addMutation = useMutation({
    mutationFn: () => ordersApi.addCanvasItem(order.id, toDto(newItem)),
    onSuccess: (updated) => {
      invalidate(updated);
      setAdding(false);
      setNewItem(EMPTY);
      toast.success('Позиция добавлена');
    },
    onError: () => toast.error('Ошибка добавления'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: EditState }) =>
      ordersApi.updateCanvasItem(id, toDto(state)),
    onSuccess: (updated) => {
      invalidate(updated);
      setEditingId(null);
      toast.success('Позиция обновлена');
    },
    onError: () => toast.error('Ошибка обновления'),
  });

  const deleteMutation = useMutation({
    mutationFn: ordersApi.deleteCanvasItem,
    onSuccess: (updated) => {
      invalidate(updated);
      toast.success('Позиция удалена');
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  const startEdit = (item: ItemCanvas) => {
    setEditingId(item.id);
    setEditState({
      sizeKey: item.sizeKey ?? CUSTOM_SIZE,
      material: item.material ?? 'SYNTHETIC',
      formatCanvas: item.formatCanvas,
      quantity: String(item.quantity),
      clientPrice: String(item.clientPrice),
      contractorPrice: String(item.contractorPrice),
    });
  };

  /** Сколько должны производству за штуку по выбранному размеру. */
  const costOf = (state: EditState): number =>
    pricing?.sizes.find((x) => x.key === state.sizeKey)?.cost[state.material] ?? 0;

  /** Розница производства — показываем рядом, чтобы видеть, от чего скидка. */
  const retailOf = (state: EditState): number =>
    pricing?.sizes.find((x) => x.key === state.sizeKey)?.retail[state.material] ?? 0;

  const renderInputs = (
    state: EditState,
    onChange: (state: EditState) => void,
  ) => (
    <>
      <td className="px-4 py-2">
        <div className="space-y-1">
          <select
            className={inputCls}
            value={state.sizeKey}
            onChange={(e) => onChange({ ...state, sizeKey: e.target.value })}
            aria-label="Размер холста"
          >
            {(pricing?.sizes ?? []).map((size) => (
              <option key={size.key} value={size.key}>
                {size.label}
              </option>
            ))}
            <option value={CUSTOM_SIZE}>Нестандартный размер…</option>
          </select>

          {state.sizeKey ? (
            <select
              className={inputCls}
              value={state.material}
              onChange={(e) =>
                onChange({ ...state, material: e.target.value as EnumCanvasMaterial })
              }
              aria-label="Материал"
            >
              <option value="SYNTHETIC">Синтетика</option>
              <option value="COTTON">Хлопок</option>
            </select>
          ) : (
            /* Размера нет в прайсе — подпись и цену производства вводим сами. */
            <input
              className={inputCls}
              value={state.formatCanvas}
              onChange={(e) => onChange({ ...state, formatCanvas: e.target.value })}
              placeholder="Модульный, нестандарт…"
            />
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min={1}
          className={`${inputCls} text-right`}
          value={state.quantity}
          onChange={(e) => onChange({ ...state, quantity: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min={0}
          className={`${inputCls} text-right`}
          value={state.clientPrice}
          onChange={(e) => onChange({ ...state, clientPrice: e.target.value })}
        />
      </td>
      <td className="px-4 py-2 text-right">
        {state.sizeKey ? (
          /* Считается по прайсу и скидке — поэтому показываем, а не даём
             вводить: цена производства не предмет договорённости с клиентом. */
          <div className="text-sm">
            <span className="font-semibold tabular-nums text-gray-900">
              {money(costOf(state))}
            </span>
            <span className="block text-[11px] text-gray-400">
              розница {money(retailOf(state))}
            </span>
          </div>
        ) : (
          <input
            type="number"
            min={0}
            className={`${inputCls} text-right`}
            value={state.contractorPrice}
            onChange={(e) =>
              onChange({ ...state, contractorPrice: e.target.value })
            }
          />
        )}
      </td>
    </>
  );

  return (
    <div>
      {order.urlCommunication && (
        <a
          href={order.urlCommunication}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <MessageCircle size={15} aria-hidden="true" />
          Написать клиенту
          <ExternalLink size={12} className="opacity-60" aria-hidden="true" />
        </a>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Позиции холста ({items.length})
        </h3>
        {canEdit && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium"
          >
            <Plus size={14} /> Добавить
          </button>
        )}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2 text-left">
                Формат
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Кол-во
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Клиент / шт
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Подрядчик / шт
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Выручка
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Себестоимость
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Маржа
              </th>
              {canEdit && (
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Действия</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  {canEdit && isEditing ? (
                    <>
                      {renderInputs(editState, setEditState)}
                      <td className="px-4 py-2 text-right text-gray-300">—</td>
                      <td className="px-4 py-2 text-right text-gray-300">—</td>
                      <td className="px-4 py-2 text-right text-gray-300">—</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: item.id,
                                state: editState,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="p-1 text-green-600 hover:text-green-800"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {item.formatCanvas}
                      </td>
                      <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right">
                        {money(item.clientPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {money(item.contractorPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {money(item.pricePosition)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {money(item.contractorCostPosition)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold ${
                          item.profitPosition >= 0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {money(item.profitPosition)}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(item)}
                              aria-label="Редактировать позицию"
                              className="p-1 text-gray-400 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              aria-label="Удалить позицию"
                              className="p-1 text-gray-400 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
            {canEdit && adding && (
              <tr className="bg-cyan-50">
                {renderInputs(newItem, setNewItem)}
                <td className="px-4 py-2 text-right text-gray-300">—</td>
                <td className="px-4 py-2 text-right text-gray-300">—</td>
                <td className="px-4 py-2 text-right text-gray-300">—</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => addMutation.mutate()}
                      disabled={addMutation.isPending}
                      className="p-1 text-green-600 hover:text-green-800"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setAdding(false)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-100 text-sm">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">
                Итого
              </td>
              <td className="px-4 py-3 text-right font-bold">
                {money(totals.revenue)}
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-600">
                {money(totals.cost)}
              </td>
              <td
                className={`px-4 py-3 text-right font-bold ${
                  totals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {money(totals.profit)}
              </td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Итог по заказу словами денег: сколько я должен производству и что
          остаётся мне. Доставку считаем отдельной строкой — на ней тоже
          зарабатываем, и в марже позиций её быть не должно. */}
      {isAdmin && pricing && items.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Клиент платит за холсты</span>
            <span className="tabular-nums">{money(totals.revenue)}</span>
          </div>
          {deliveryOwnCost > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>+ доставка клиенту</span>
              <span className="tabular-nums">{money(order.deliveryCost ?? 0)}</span>
            </div>
          )}

          <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Должен производству за холсты</span>
              <span className="tabular-nums">{money(totals.cost)}</span>
            </div>
            {deliveryOwnCost > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Должен производству за доставку</span>
                <span className="tabular-nums">{money(deliveryOwnCost)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900">
              <span>Должен производству всего</span>
              <span className="tabular-nums">{money(totals.cost + deliveryOwnCost)}</span>
            </div>
          </div>

          <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
            {designCost > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Разработка дизайна (100% ваши)</span>
                <span className="tabular-nums">{money(designCost)}</span>
              </div>
            )}
            <div
              className={`flex justify-between font-semibold ${
                myProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              <span>Моя прибыль</span>
              <span className="tabular-nums">{money(myProfit)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
