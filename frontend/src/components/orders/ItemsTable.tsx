import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X, ExternalLink, MessageCircle } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { TYPE_LABELS } from '../../constants';
import { useAuth } from '../../context/useAuth';
import type { ItemPhoto, OrderPhoto } from '../../types/index';

interface Props { order: OrderPhoto }

const inputCls = 'w-full rounded border border-gray-200 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
const selectCls = inputCls;

interface EditState {
  formatPaper: string; typePaper: string; quantity: string; price: string;
}

export function ItemsTable({ order }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  // Свободная цена — свойство заказа: цена позиции = её итог, кол-во не умножается.
  const freePrice = order.isFreePrice ?? false;

  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState<EditState>({ formatPaper: '', typePaper: 'GLOSS', quantity: '1', price: '10' });

  const invalidate = (updated: OrderPhoto) => {
    qc.setQueryData(['order', order.id], updated);
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      ordersApi.updateItem(id, data as Parameters<typeof ordersApi.updateItem>[1]),
    onSuccess: (u) => { invalidate(u); setEditingId(null); toast.success('Позиция обновлена'); },
    onError: () => toast.error('Ошибка обновления'),
  });

  const deleteMutation = useMutation({
    mutationFn: ordersApi.deleteItem,
    onSuccess: (u) => { invalidate(u); toast.success('Позиция удалена'); },
    onError: () => toast.error('Ошибка удаления'),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) =>
      ordersApi.addItem(order.id, data as Parameters<typeof ordersApi.addItem>[1]),
    onSuccess: (u) => { invalidate(u); setAdding(false); toast.success('Позиция добавлена'); },
    onError: () => toast.error('Ошибка добавления'),
  });

  const startEdit = (item: ItemPhoto) => {
    setEditingId(item.id);
    setEditState({ formatPaper: item.formatPaper, typePaper: item.typePaper, quantity: String(item.quantity), price: String(item.price) });
  };

  const saveEdit = (id: string) => {
    if (!editState) return;
    updateMutation.mutate({ id, data: {
      formatPaper: editState.formatPaper,
      typePaper: editState.typePaper,
      quantity: Number(editState.quantity) || 1,
      price: Number(editState.price),
    } });
  };

  const saveNew = () => {
    addMutation.mutate({
      formatPaper: newItem.formatPaper,
      typePaper: newItem.typePaper,
      quantity: Number(newItem.quantity) || 1,
      price: Number(newItem.price),
    });
  };

  // Кол-во колонок слева от ячейки «Итого/Цена» (для colspan футера).
  const colSpanTotal = 1 + (freePrice ? 0 : 1) + 1 + (isAdmin && !freePrice ? 1 : 0);

  return (
    <div>
      {/* Ссылка на клиента */}
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
          Позиции ({order.items.length}){freePrice && <span className="ml-2 text-xs font-normal text-amber-600">свободная цена</span>}
        </h3>
        {isAdmin && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
            <Plus size={14} /> Добавить
          </button>
        )}
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2 text-left">{freePrice ? 'Название' : 'Формат'}</th>
              {!freePrice && <th scope="col" className="px-4 py-2 text-left">Тип</th>}
              <th scope="col" className="px-4 py-2 text-right">Кол-во</th>
              {isAdmin && !freePrice && <th scope="col" className="px-4 py-2 text-right">Цена / шт</th>}
              {isAdmin && <th scope="col" className="px-4 py-2 text-right">{freePrice ? 'Цена (итог)' : 'Итого'}</th>}
              {isAdmin && <th scope="col" className="px-3 py-2"><span className="sr-only">Действия</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {order.items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                {isAdmin && editingId === item.id && editState ? (
                  <>
                    <td className="px-4 py-2">
                      <input className={inputCls} placeholder={freePrice ? 'Название товара' : '10×15, Polaroid…'} value={editState.formatPaper}
                        onChange={e => setEditState({ ...editState, formatPaper: e.target.value })} />
                    </td>
                    {!freePrice && (
                      <td className="px-4 py-2">
                        <select className={selectCls} value={editState.typePaper}
                          onChange={e => setEditState({ ...editState, typePaper: e.target.value })}>
                          <option value="GLOSS">Глянец</option>
                          <option value="MATTE">Матт</option>
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <input type="number" min={1} className={inputCls + ' text-right'} value={editState.quantity}
                        onChange={e => setEditState({ ...editState, quantity: e.target.value })} />
                    </td>
                    {isAdmin && !freePrice && (
                      <td className="px-4 py-2">
                        <input type="number" min={0} className={inputCls + ' text-right'} value={editState.price}
                          onChange={e => setEditState({ ...editState, price: e.target.value })} placeholder="Цена ₽" />
                      </td>
                    )}
                    {isAdmin && freePrice && (
                      <td className="px-4 py-2">
                        <input type="number" min={0} className={inputCls + ' text-right'} value={editState.price}
                          onChange={e => setEditState({ ...editState, price: e.target.value })} placeholder="Цена ₽ (итог)" />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(item.id)} disabled={updateMutation.isPending}
                          className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.formatPaper}</td>
                    {!freePrice && <td className="px-4 py-2.5 text-gray-600">{TYPE_LABELS[item.typePaper]}</td>}
                    <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                    {isAdmin && !freePrice && <td className="px-4 py-2.5 text-right">{item.price.toLocaleString()} ₽</td>}
                    {isAdmin && <td className="px-4 py-2.5 text-right font-medium">{item.pricePosition.toLocaleString()} ₽</td>}
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(item)} aria-label="Редактировать позицию" className="p-1 text-gray-400 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"><Pencil size={13} aria-hidden="true" /></button>
                          <button onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending} aria-label="Удалить позицию"
                            className="p-1 text-gray-400 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"><Trash2 size={13} aria-hidden="true" /></button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}

            {isAdmin && adding && (
              <tr className="bg-amber-50">
                <td className="px-4 py-2">
                  <input className={inputCls} placeholder={freePrice ? 'Название товара' : '10×15, Polaroid…'} value={newItem.formatPaper}
                    onChange={e => setNewItem({ ...newItem, formatPaper: e.target.value })} />
                </td>
                {!freePrice && (
                  <td className="px-4 py-2">
                    <select className={selectCls} value={newItem.typePaper}
                      onChange={e => setNewItem({ ...newItem, typePaper: e.target.value })}>
                      <option value="GLOSS">Глянец</option>
                      <option value="MATTE">Матт</option>
                    </select>
                  </td>
                )}
                <td className="px-4 py-2">
                  <input type="number" min={1} className={inputCls + ' text-right'} value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} />
                </td>
                <td className="px-4 py-2">
                  <input type="number" min={0} className={inputCls + ' text-right'} value={newItem.price}
                    onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder={freePrice ? 'Цена ₽ (итог)' : 'Цена ₽'} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={saveNew} disabled={addMutation.isPending}
                      className="p-1 text-green-600 hover:text-green-800"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)}
                      className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {isAdmin && (
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={colSpanTotal} className="px-4 py-2.5 text-right text-sm text-gray-500">Итого по позициям</td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold">
                  {order.items.reduce((s, i) => s + (i.pricePosition ?? 0), 0).toLocaleString()} ₽
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
