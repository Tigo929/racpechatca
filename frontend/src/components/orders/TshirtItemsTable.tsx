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
  quantity: string; price: string; designCost: string;
  designUrl: string; designNote: string;
  clientItem: boolean;
};

const EMPTY: EditState = {
  color: 'Белый', size: 'M',
  printLocation: 'FRONT',
  quantity: '1', price: '500', designCost: '0', designUrl: '', designNote: '', clientItem: false,
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-3 py-2 text-xs text-gray-500 w-36">{label}</td>
      <td className="px-3 py-2 text-sm">{children}</td>
    </tr>
  );
}

function EditForm({
  state,
  onChange,
}: {
  state: EditState;
  onChange: (state: EditState) => void;
}) {
  return (
    <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden mb-2">
      <tbody>
        <Row label="Цвет">
          <select className={selectCls} value={state.color} onChange={(event) => onChange({ ...state, color: event.target.value })}>
            {TSHIRT_COLORS.map((color) => <option key={color}>{color}</option>)}
          </select>
        </Row>
        <Row label="Размер">
          <select className={selectCls} value={state.size} onChange={(event) => onChange({ ...state, size: event.target.value as EnumTshirtSize })}>
            {Object.entries(TSHIRT_SIZE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Row>
        <Row label="Место печати">
          <select className={selectCls} value={state.printLocation} onChange={(event) => onChange({ ...state, printLocation: event.target.value as EnumPrintLocation })}>
            {Object.entries(PRINT_LOCATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Row>
        <Row label="Кол-во">
          <input type="number" min={1} className={inputCls} value={state.quantity} onChange={(event) => onChange({ ...state, quantity: event.target.value })} />
        </Row>
        <Row label="Цена ₽">
          <input type="number" min={0} className={inputCls} value={state.price} onChange={(event) => onChange({ ...state, price: event.target.value })} />
        </Row>
        <Row label="Стоимость дизайна ₽">
          <input type="number" min={0} className={inputCls} value={state.designCost} onChange={(event) => onChange({ ...state, designCost: event.target.value })} />
        </Row>
        <Row label="Ссылка на макет">
          <input className={inputCls} placeholder="https://..." value={state.designUrl} onChange={(event) => onChange({ ...state, designUrl: event.target.value })} />
        </Row>
        <Row label="Описание дизайна">
          <input className={inputCls} placeholder="Логотип на белом фоне..." value={state.designNote} onChange={(event) => onChange({ ...state, designNote: event.target.value })} />
        </Row>
        <Row label="Изделие клиента">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={state.clientItem} onChange={(e) => onChange({ ...state, clientItem: e.target.checked })} className="w-4 h-4 accent-amber-600" />
            <span className="text-sm text-gray-700">Клиент приносит своё — склад не трогаем</span>
          </label>
        </Row>
      </tbody>
    </table>
  );
}

export function TshirtItemsTable({ order }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState<EditState>(EMPTY);

  const EMPTY_FREE = { name: '', quantity: '1', price: '0' };
  const [addingFree, setAddingFree] = useState(false);
  const [newFreeItem, setNewFreeItem] = useState(EMPTY_FREE);
  const [editingFreeId, setEditingFreeId] = useState<string | null>(null);
  const [editFreeState, setEditFreeState] = useState(EMPTY_FREE);

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
    onSuccess: (u) => { invalidate(u); setAdding(false); setNewItem(EMPTY); toast.success('Позиция добавлена'); },
    onError: () => toast.error('Ошибка добавления'),
  });

  const addFreeMutation = useMutation({
    mutationFn: (data: Parameters<typeof ordersApi.addItem>[1]) => ordersApi.addItem(order.id, data),
    onSuccess: (u) => { invalidate(u); setAddingFree(false); setNewFreeItem(EMPTY_FREE); toast.success('Позиция добавлена'); },
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

  const saveFreeNew = () => addFreeMutation.mutate({
    formatPaper: newFreeItem.name,
    typePaper: 'GLOSS',
    quantity: Number(newFreeItem.quantity) || 1,
    price: Number(newFreeItem.price) || 0,
  });

  const saveFreeEdit = (item: ItemPhoto) => updateFreeMutation.mutate({
    id: item.id,
    data: {
      formatPaper: editFreeState.name,
      quantity: Number(editFreeState.quantity) || 1,
      price: Number(editFreeState.price) || 0,
    },
  });

  const startEdit = (item: ItemTshirt) => {
    setEditingId(item.id);
    setEditState({
      color: item.color, size: item.size,
      printLocation: item.printLocation,
      quantity: String(item.quantity), price: String(item.price),
      designCost: String(item.designCost ?? 0),
      designUrl: item.designUrl ?? '', designNote: item.designNote ?? '',
      clientItem: item.clientItem ?? false,
    });
  };

  const toPayload = (s: EditState) => ({
    color: s.color, size: s.size,
    printLocation: s.printLocation,
    quantity: Number(s.quantity), price: Number(s.price),
    designCost: Number(s.designCost),
    designUrl: s.designUrl || undefined, designNote: s.designNote || undefined,
    clientItem: s.clientItem,
  });

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
        <h3 className="text-sm font-semibold text-gray-700">Позиции ({order.tshirtItems.length})</h3>
        {isAdmin && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
            <Plus size={14} /> Добавить
          </button>
        )}
      </div>

      <div className="space-y-3">
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
                <EditForm state={editState} onChange={setEditState} />
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Место печати">{PRINT_LOCATION_LABELS[item.printLocation]}</Row>
                  <Row label="Количество">{item.quantity} шт.</Row>
                  {isAdmin && <Row label="Цена за шт.">{item.price.toLocaleString()} ₽</Row>}
                  {isAdmin && (item.designCost ?? 0) > 0 && (
                    <Row label="Стоимость дизайна">{(item.designCost ?? 0).toLocaleString()} ₽</Row>
                  )}
                  {isAdmin && <Row label="Итого"><span className="font-semibold">{item.pricePosition.toLocaleString()} ₽</span></Row>}
                  {item.designUrl && (
                    <Row label="Макет">
                      <a href={item.designUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-indigo-600 hover:underline text-xs">
                        <ExternalLink size={11} /> Открыть макет
                      </a>
                    </Row>
                  )}
                  {item.designNote && <Row label="Описание">{item.designNote}</Row>}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {isAdmin && adding && (
          <div className="border border-amber-100 rounded-xl overflow-hidden bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">Новая позиция</p>
            <EditForm state={newItem} onChange={setNewItem} />
            <div className="flex gap-2">
              <button onClick={() => addMutation.mutate(toPayload(newItem))} disabled={addMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50">
                <Check size={13} /> {addMutation.isPending ? 'Добавляем...' : 'Добавить'}
              </button>
              <button onClick={() => setAdding(false)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
                <X size={13} /> Отмена
              </button>
            </div>
          </div>
        )}

        {isAdmin && order.tshirtItems.length > 0 && (
          <div className="flex justify-end px-2 py-1 text-sm">
            <span className="text-gray-500 mr-2">Итого по позициям</span>
            <span className="font-semibold">
              {order.tshirtItems.reduce((s, i) => s + (i.pricePosition ?? 0), 0).toLocaleString()} ₽
            </span>
          </div>
        )}
      </div>

      {/* ── Дополнительные позиции (свободная цена) ── */}
      {isAdmin && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Доп. позиции
              {order.items.length > 0 && <span className="ml-1 font-normal text-gray-400">({order.items.length})</span>}
              <span className="ml-2 text-xs font-normal text-amber-600">свободная цена</span>
            </h3>
            <button onClick={() => setAddingFree(true)}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Название</th>
                  <th className="px-3 py-2 text-right">Кол-во</th>
                  <th className="px-3 py-2 text-right">Цена ₽</th>
                  <th className="px-3 py-2 text-right">Итого</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {editingFreeId === item.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input className={inputCls} value={editFreeState.name}
                            onChange={e => setEditFreeState({ ...editFreeState, name: e.target.value })} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={1} className={inputCls + ' text-right'} value={editFreeState.quantity}
                            onChange={e => setEditFreeState({ ...editFreeState, quantity: e.target.value })} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={0} className={inputCls + ' text-right'} value={editFreeState.price}
                            onChange={e => setEditFreeState({ ...editFreeState, price: e.target.value })} />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400 text-xs">
                          {((Number(editFreeState.price) || 0) * (Number(editFreeState.quantity) || 1)).toLocaleString()} ₽
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => saveFreeEdit(item)} disabled={updateFreeMutation.isPending}
                              className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
                            <button onClick={() => setEditingFreeId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{item.formatPaper}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{item.price.toLocaleString()} ₽</td>
                        <td className="px-3 py-2.5 text-right font-medium">{item.pricePosition.toLocaleString()} ₽</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditingFreeId(item.id); setEditFreeState({ name: item.formatPaper, quantity: String(item.quantity), price: String(item.price) }); }}
                              className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                            <button onClick={() => deleteFreeMutation.mutate(item.id)} disabled={deleteFreeMutation.isPending}
                              className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {addingFree && (
                  <tr className="bg-amber-50">
                    <td className="px-4 py-2">
                      <input className={inputCls} placeholder="Название товара"
                        value={newFreeItem.name} onChange={e => setNewFreeItem({ ...newFreeItem, name: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} className={inputCls + ' text-right'} value={newFreeItem.quantity}
                        onChange={e => setNewFreeItem({ ...newFreeItem, quantity: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} className={inputCls + ' text-right'} placeholder="Цена ₽"
                        value={newFreeItem.price} onChange={e => setNewFreeItem({ ...newFreeItem, price: e.target.value })} />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400 text-xs">
                      {((Number(newFreeItem.price) || 0) * (Number(newFreeItem.quantity) || 1)).toLocaleString()} ₽
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={saveFreeNew} disabled={addFreeMutation.isPending}
                          className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
                        <button onClick={() => { setAddingFree(false); setNewFreeItem(EMPTY_FREE); }}
                          className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {order.items.length === 0 && !addingFree && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-xs text-gray-400">
                      Нет доп. позиций — нажмите «Добавить»
                    </td>
                  </tr>
                )}
              </tbody>
              {order.items.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-xs text-gray-500">Итого</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold">
                      {order.items.reduce((s, i) => s + (i.pricePosition ?? 0), 0).toLocaleString()} ₽
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
