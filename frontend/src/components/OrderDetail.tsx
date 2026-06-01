import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pencil, Trash2, ExternalLink, Flame, Clock } from 'lucide-react';
import { getDeadlineInfo } from '../utils/deadline';
import { ordersApi } from '../api/orders';
import { StatusStepper } from './StatusStepper';
import { ItemsTable } from './ItemsTable';
import { StatusBadge } from './StatusBadge';
import { SourceBadge } from './SourceBadge';
import { InfoRow } from './InfoRow';
import { OrderEditForm } from './OrderEditForm';
import { TshirtItemsTable } from './TshirtItemsTable';
import { COMMUNICATION_LABELS, DELIVERY_LABELS } from '../constants';
import { useAuth } from '../context/AuthContext';
import type { UpdateOrderDto } from '../types';

interface Props {
  orderId: string;
  onDeleted: () => void;
}

export function OrderDetail({ orderId, onDeleted }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateOrderDto>({});

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.getById(orderId),
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateOrderDto) => ordersApi.update(orderId, dto),
    onSuccess: (updated) => {
      qc.setQueryData(['order', orderId], updated);
      qc.invalidateQueries({ queryKey: ['orders'] });
      setEditing(false);
      toast.success('Заявка обновлена');
    },
    onError: () => toast.error('Ошибка обновления'),
  });

  const toggleUrgent = () => {
    if (!order) return;
    updateMutation.mutate({ isUrgent: !order.isUrgent });
  };

  const deleteMutation = useMutation({
    mutationFn: () => ordersApi.delete(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Заявка удалена');
      onDeleted();
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  const startEdit = () => {
    if (!order) return;
    setForm({
      sourceOrder: order.sourceOrder,
      communicationPlatform: order.communicationPlatform,
      urlCommunication: order.urlCommunication,
      deliveryMethod: order.deliveryMethod,
      deliveryCost: order.deliveryCost,
      note: order.note,
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold text-gray-900">#{order.numberOrder}</span>
            <StatusBadge status={order.status} />
            <SourceBadge source={order.sourceOrder} />
            {order.isUrgent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-300 animate-pulse">
                <Flame size={11} /> Срочно
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-xs text-gray-400">
              Создан {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {(() => {
              const dl = getDeadlineInfo(order.deadline, order.createdAt);
              return dl.label ? (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${dl.badgeClass}`}>
                  <Clock size={10} /> Дедлайн: {dl.label}
                </span>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* Кнопка Срочно — доступна всем */}
          <button
            onClick={toggleUrgent}
            disabled={updateMutation.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-60 ${
              order.isUrgent
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
            }`}
          >
            <Flame size={13} />
            {order.isUrgent ? 'Снять срочность' : 'Срочно'}
          </button>
          {isAdmin && (
            <>
              {!editing && (
                <button onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <Pencil size={13} /> Изменить
                </button>
              )}
              <button onClick={() => { if (confirm('Удалить заявку?')) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60">
                <Trash2 size={13} /> Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status flow */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Прогресс статуса</p>
        <StatusStepper order={order} />
      </div>

      {/* Details */}
      {isAdmin && editing ? (
        <OrderEditForm
          form={form}
          onChange={setForm}
          onSave={() => updateMutation.mutate(form)}
          onCancel={() => setEditing(false)}
          isPending={updateMutation.isPending}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <InfoRow label="Платформа общения" value={COMMUNICATION_LABELS[order.communicationPlatform]} />
          <InfoRow label="Способ доставки" value={DELIVERY_LABELS[order.deliveryMethod]} />
          <InfoRow
            label="Ссылка на переписку"
            value={
              <a href={order.urlCommunication} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-600 hover:underline text-sm truncate max-w-[200px]">
                <ExternalLink size={12} />
                {order.urlCommunication}
              </a>
            }
          />
          {isAdmin && (
            <>
              <InfoRow label="Доставка" value={`${(order.deliveryCost ?? 0).toLocaleString()} ₽`} />
              {order.note && <InfoRow label="Примечание" value={order.note} className="col-span-2" />}
              <div className="col-span-2 pt-2 border-t border-gray-100 flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Сумма заказа</p>
                  <p className="text-2xl font-bold text-gray-900">{(order.totalOrder ?? 0).toLocaleString()} ₽</p>
                </div>
              </div>
            </>
          )}
          {!isAdmin && order.note && (
            <InfoRow label="Примечание" value={order.note} className="col-span-2" />
          )}
        </div>
      )}

      {/* Items */}
      {order.productCategory === 'TSHIRT'
        ? <TshirtItemsTable order={order} />
        : <ItemsTable order={order} />
      }
    </div>
  );
}
