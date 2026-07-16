import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X, ExternalLink, MessageCircle } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { useAuth } from '../../context/useAuth';
import {
  TSHIRT_SIZE_LABELS,
  PRINT_LOCATION_LABELS,
  TSHIRT_COLORS,
} from '../../constants';
import type {
  ItemTshirt,
  ItemPhoto,
  OrderPhoto,
  EnumTshirtSize,
  EnumPrintLocation,
} from '../../types/index';

interface Props { order: OrderPhoto }

const inputCls = 'w-full rounded border border-gray-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
const selectCls = inputCls;

type EditState = {
  color: string; size: EnumTshirtSize;
  printLocation: EnumPrintLocation;
  quantity: string; price: string;
  clientItem: boolean;
  designUrl: string;
};

const EMPTY: EditState = {
  color: 'Белый', size: 'M', printLocation: 'FRONT',
  quantity: '1', price: '500', clientItem: false, designUrl: '',
};

type FreeState = { name: string; quantity: string; price: string };
const EMPTY_FREE: FreeState = { name: '', quantity: '1', price: '0' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-3 py-2 text-xs text-gray-500 w-36">{label}</td>
      <td className="px-3 py-2 text-sm">{children}</td>
    </tr>
  );
}

/** Поля обычной футболочной позиции (фрагмент строк таблицы). */
function TshirtRows({ state, onChange }: { state: EditState; onChange: (s: EditState) => void }) {
  return (
    <>
      <Row label="Цвет">
        <select className={selectCls} value={state.color} onChange={(e) => onChange({ ...state, color: e.target.value })}>
          {TSHIRT_COLORS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Row>
      <Row label="Размер">
        <select className={selectCls} value={state.size} onChange={(e) => onChange({ ...state, size: e.target.value as EnumTshirtSize })}>
          {Object.entries(TSHIRT_SIZE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Row>
      <Row label="Место печати">
        <select className={selectCls} value={state.printLocation} onChange={(e) => onChange({ ...state, printLocation: e.target.value as EnumPrintLocation })}>
          {Object.entries(PRINT_LOCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Row>
      <Row label="Кол-во">
        <input type="number" min={1} className={inputCls} value={state.quantity} onChange={(e) => onChange({ ...state, quantity: e.target.value })} />
      </Row>
      <Row label="Цена ₽">
        <input type="number" min={0} className={inputCls} value={state.price} onChange={(e) => onChange({ ...state, price: e.target.value })} />
      </Row>
      <Row label="Ссылка на макет">
        <input className={inputCls} placeholder="https://… (нужна для отправки партнёру)"
          value={state.designUrl} onChange={(e) => onChange({ ...state, designUrl: e.target.value })} />
      </Row>
      <Row label="Изделие клиента">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={state.clientItem} onChange={(e) => onChange({ ...state, clientItem: e.target.checked })} className="w-4 h-4 accent-amber-600" />
          <span className="text-sm text-gray-700">Клиент приносит своё — склад не трогаем</span>
        </label>
      </Row>
    </>
  );
}

/** Поля свободной (произвольной) позиции. */
function FreeRows({ state, onChange }: { state: FreeState; onChange: (s: FreeState) => void }) {
  return (
    <>
      <Row label="Название">
        <input className={inputCls} placeholder="Кружка с принтом, баннер…" value={state.name}
          onChange={(e) => onChange({ ...state, name: e.target.value })} />
      </Row>
      <Row label="Кол-во">
        <input type="number" min={1} className={inputCls} value={state.quantity}
          onChange={(e) => onChange({ ...state, quantity: e.target.value })} />
      </Row>
      <Row label="Цена ₽ (итог)">
        <input type="number" min={0} className={inputCls} value={state.price}
          onChange={(e) => onChange({ ...state, price: e.target.value })} />
      </Row>
    </>
  );
}

export function TshirtItemsTable({ order }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY);

  const [adding, setAdding] = useState(false);
  const [addFree, setAddFree] = useState(false);
  const [newItem, setNewItem] = useState<EditState>(EMPTY);
  const [newFreeItem, setNewFreeItem] = useState<FreeState>(EMPTY_FREE);

  const [editingFreeId, setEditingFreeId] = useState<string | null>(null);
  const [editFreeState, setEditFreeState] = useState<FreeState>(EMPTY_FREE);

  const invalidate = (updated: OrderPhoto) => {
    qc.setQueryData(['order', order.id], updated);
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      ordersApi.updateTshirtItem(id, data as Parameters<typeof ordersApi.updateTshirtItem>[1]),
    onSuccess: (u) => { invalidate(u); setEditingId(null); toast.success('Позиция обновлена'); },
    onError: () => toast.error('Ошибка обновления'),
  });

  const deleteMutation = useMutation({
    mutationFn: ordersApi.deleteTshirtItem,
    onSuccess: (u) => { invalidate(u); toast.success('Позиция удалена'); },
    onError: () => toast.error('Ошибка удаления'),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) =>
      ordersApi.addTshirtItem(order.id, data as Parameters<typeof ordersApi.addTshirtItem>[1]),
    onSuccess: (u) => { invalidate(u); closeAdd(); toast.success('Позиция добавлена'); },
    onError: () => toast.error('Ошибка добавления'),
  });

  const addFreeMutation = useMutation({
    mutationFn: (data: Parameters<typeof ordersApi.addItem>[1]) => ordersApi.addItem(order.id, data),
    onSuccess: (u) => { invalidate(u); closeAdd(); toast.success('Позиция добавлена'); },
    onError: () => toast.error('Ошибка добавления'),
  });

  const updateFreeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof ordersApi.updateItem>[1] }) =>
      ordersApi.updateItem(id, data),
    onSuccess: (u) => { invalidate(u); setEditingFreeId(null); toast.success('Позиция обновлена'); },
    onError: () => toast.error('Ошибка обновления'),
  });

  const deleteFreeMutation = useMutation({
    mutationFn: ordersApi.deleteItem,
    onSuccess: (u) => { invalidate(u); toast.success('Позиция удалена'); },
    onError: () => toast.error('Ошибка удаления'),
  });

  const closeAdd = () => {
    setAdding(false);
    setAddFree(false);
    setNewItem(EMPTY);
    setNewFreeItem(EMPTY_FREE);
  };

  const handleAdd = () => {
    if (addFree) {
      if (!newFreeItem.name.trim()) { toast.error('Укажите название позиции'); return; }
      addFreeMutation.mutate({
        formatPaper: newFreeItem.name.trim(),
        typePaper: 'GLOSS',
        quantity: Number(newFreeItem.quantity) || 1,
        price: Number(newFreeItem.price) || 0,
        isFreePrice: true,
      });
    } else {
      addMutation.mutate(toPayload(newItem));
    }
  };

  const saveFreeEdit = (item: ItemPhoto) => {
    if (!editFreeState.name.trim()) { toast.error('Укажите название позиции'); return; }
    updateFreeMutation.mutate({
      id: item.id,
      data: {
        formatPaper: editFreeState.name.trim(),
        quantity: Number(editFreeState.quantity) || 1,
        price: Number(editFreeState.price) || 0,
      },
    });
  };

  const startEdit = (item: ItemTshirt) => {
    setEditingId(item.id);
    setEditState({
      color: item.color, size: item.size, printLocation: item.printLocation,
      quantity: String(item.quantity), price: String(item.price),
      clientItem: item.clientItem ?? false,
      designUrl: item.designUrl ?? '',
    });
  };

  const toPayload = (s: EditState) => ({
    color: s.color, size: s.size, printLocation: s.printLocation,
    quantity: Number(s.quantity), price: Number(s.price),
    clientItem: s.clientItem,
    designUrl: s.designUrl.trim() || undefined,
  });

  const totalPositions =
    order.tshirtItems.reduce((s, i) => s + (i.pricePosition ?? 0), 0) +
    order.items.reduce((s, i) => s + (i.pricePosition ?? 0), 0);

  const addPending = addMutation.isPending || addFreeMutation.isPending;

  return (
    <div>
      {/* Ссылка на клиента */}
      {order.urlCommunication && (
        <a
          href={order.urlCommunication}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-100"
        >
          <MessageCircle size={15} aria-hidden="true" />
          Написать клиенту
          <ExternalLink size={12} className="opacity-60" aria-hidden="true" />
        </a>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Позиции ({order.tshirtItems.length + order.items.length})
        </h3>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
            <Plus size={14} /> Добавить
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Футболочные позиции */}
        {order.tshirtItems.map((item, idx) => (
          <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                #{idx + 1} — {item.color}, {TSHIRT_SIZE_LABELS[item.size]}
                {item.clientItem && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">Изделие клиента</span>
                )}
              </span>
              {isAdmin && (
                <div className="flex gap-1">
                  {editingId === item.id ? (
                    <>
                      <button onClick={() => updateMutation.mutate({ id: item.id, data: toPayload(editState) })}
                        disabled={updateMutation.isPending}
                        className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(item)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                      <button onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isAdmin && editingId === item.id ? (
              <div className="p-3">
                <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden bg-white">
                  <tbody><TshirtRows state={editState} onChange={setEditState} /></tbody>
                </table>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Место печати">{PRINT_LOCATION_LABELS[item.printLocation]}</Row>
                  <Row label="Количество">{item.quantity} шт.</Row>
                  {item.designUrl && (
                    <Row label="Макет">
                      <a href={item.designUrl} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline break-all inline-flex items-center gap-1">
                        {item.designUrl.length > 60 ? item.designUrl.slice(0, 60) + '…' : item.designUrl}
                        <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
                      </a>
                    </Row>
                  )}
                  {isAdmin && <Row label="Цена за шт.">{item.price.toLocaleString()} ₽</Row>}
                  {isAdmin && <Row label="Итого"><span className="font-semibold">{item.pricePosition.toLocaleString()} ₽</span></Row>}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* Свободные позиции (произвольная цена) */}
        {order.items.map((item) => (
          <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-amber-50/60 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {item.formatPaper}
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">свободная цена</span>
              </span>
              {isAdmin && (
                <div className="flex gap-1">
                  {editingFreeId === item.id ? (
                    <>
                      <button onClick={() => saveFreeEdit(item)} disabled={updateFreeMutation.isPending}
                        className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
                      <button onClick={() => setEditingFreeId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingFreeId(item.id); setEditFreeState({ name: item.formatPaper, quantity: String(item.quantity), price: String(item.price) }); }}
                        className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                      <button onClick={() => deleteFreeMutation.mutate(item.id)} disabled={deleteFreeMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isAdmin && editingFreeId === item.id ? (
              <div className="p-3">
                <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden bg-white">
                  <tbody><FreeRows state={editFreeState} onChange={setEditFreeState} /></tbody>
                </table>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Количество">{item.quantity} шт.</Row>
                  {isAdmin && <Row label="Итого"><span className="font-semibold">{item.pricePosition.toLocaleString()} ₽</span></Row>}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* Форма добавления — чекбокс «свободная цена» как первое поле позиции */}
        {isAdmin && adding && (
          <div className="border border-amber-100 rounded-xl overflow-hidden bg-amber-50 p-3">
            <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden bg-white mb-2">
              <tbody>
                <Row label="Тип позиции">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={addFree} onChange={(e) => setAddFree(e.target.checked)} className="w-4 h-4 accent-amber-600" />
                    <span className="text-sm text-gray-700">Свободная цена — произвольная позиция (название и цена)</span>
                  </label>
                </Row>
                {addFree
                  ? <FreeRows state={newFreeItem} onChange={setNewFreeItem} />
                  : <TshirtRows state={newItem} onChange={setNewItem} />}
              </tbody>
            </table>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={addPending}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50">
                <Check size={13} /> {addPending ? 'Добавляем...' : 'Добавить'}
              </button>
              <button onClick={closeAdd}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                <X size={13} /> Отмена
              </button>
            </div>
          </div>
        )}

        {isAdmin && (order.tshirtItems.length > 0 || order.items.length > 0) && (
          <div className="flex justify-end px-2 py-1 text-sm">
            <span className="text-gray-500 mr-2">Итого по позициям</span>
            <span className="font-semibold">{totalPositions.toLocaleString()} ₽</span>
          </div>
        )}
      </div>
    </div>
  );
}
