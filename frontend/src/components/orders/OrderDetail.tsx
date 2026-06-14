import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Flame, Clock, Copy, UserCheck, X } from 'lucide-react';
import { usersApi } from '../../api/users';
import { businessConfig } from '../../config/business';

function generateConfirmationText(order: OrderPhoto): string {
  const items = order.items ?? [];
  const tshirtItems = order.tshirtItems ?? [];
  const delivery = order.deliveryCost ?? 0;
  const total = order.totalOrder ?? 0;
  const prepay = Math.ceil(total * 0.5);
  const rest = total - prepay;
  const deadlineStr = order.deadline
    ? new Date(order.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : businessConfig.defaultLeadTime;

  const lines: string[] = [];
  items.forEach(i => {
    const type = i.typePaper === 'GLOSS' ? 'Глянец' : 'Матт';
    lines.push(`• ${i.formatPaper} (${type}) × ${i.quantity} шт — ${i.pricePosition.toLocaleString('ru-RU')} ₽`);
  });
  tshirtItems.forEach(i => {
    lines.push(`• Футболка ${i.color}, р-р ${i.size} × ${i.quantity} шт — ${i.pricePosition.toLocaleString('ru-RU')} ₽`);
  });

  const itemsTotal = [...items, ...tshirtItems].reduce((s, i) => s + (i.pricePosition ?? 0), 0);
  const separator = '─────────────────';

  const isPickup = order.deliveryMethod === 'PICKUP';

  // Фраза для остатка зависит от способа доставки
  const restLabel = isPickup
    ? `👉 Остаток — ${rest.toLocaleString('ru-RU')} ₽ при самовывозе`
    : `👉 Остаток — ${rest.toLocaleString('ru-RU')} ₽ при подтверждении фото доставки`;

  return [
    '✅ Отлично, ваш заказ подтверждён!',
    `📌 Номер заказа: ${order.numberOrder}`,
    '',
    '📋 Состав заказа:',
    ...lines,
    '',
    separator,
    `💰 Сумма по позициям: ${itemsTotal.toLocaleString('ru-RU')} ₽`,
    ...(delivery > 0 ? [`🚚 Доставка: ${delivery.toLocaleString('ru-RU')} ₽`] : []),
    `📦 Итого к оплате: ${total.toLocaleString('ru-RU')} ₽`,
    '',
    `⏳ Срок изготовления: до ${deadlineStr}`,
    '',
    separator,
    '💳 Для подтверждения заказа:',
    `👉 Предоплата 50% — ${prepay.toLocaleString('ru-RU')} ₽ (сейчас)`,
    restLabel,
    ...(isPickup ? ['', `📍 Самовывоз: ${businessConfig.pickupAddress}`] : []),
    '',
    `📲 Реквизиты для перевода (${businessConfig.payment.label}):`,
    `   ${businessConfig.payment.phone}`,
    `   ${businessConfig.payment.recipient}`,
    '',
    '👉 Как только внесёте оплату, пожалуйста, пришлите чек.',
    '',
    'Спасибо за доверие! Приступаем к работе 🙌',
  ].join('\n');
}

function generateReadyText(order: OrderPhoto): string {
  const items = order.items ?? [];
  const tshirtItems = order.tshirtItems ?? [];
  const delivery = order.deliveryCost ?? 0;
  const total = order.totalOrder ?? 0;
  const prepay = Math.ceil(total * 0.5);
  const rest = total - prepay;

  const lines: string[] = [];
  items.forEach(i => {
    const type = i.typePaper === 'GLOSS' ? 'Глянец' : 'Матт';
    lines.push(`• ${i.formatPaper} (${type}) × ${i.quantity} шт — ${i.pricePosition.toLocaleString('ru-RU')} ₽`);
  });
  tshirtItems.forEach(i => {
    lines.push(`• Футболка ${i.color}, р-р ${i.size} × ${i.quantity} шт — ${i.pricePosition.toLocaleString('ru-RU')} ₽`);
  });

  const itemsTotal = [...items, ...tshirtItems].reduce((s, i) => s + (i.pricePosition ?? 0), 0);
  const separator = '─────────────────';
  const isPickup = order.deliveryMethod === 'PICKUP';

  return [
    '🎉 Ваш заказ готов!',
    `📌 Номер заказа: ${order.numberOrder}`,
    '',
    '📋 Состав заказа:',
    ...lines,
    '',
    separator,
    `💰 Сумма по позициям: ${itemsTotal.toLocaleString('ru-RU')} ₽`,
    ...(delivery > 0 ? [`🚚 Доставка: ${delivery.toLocaleString('ru-RU')} ₽`] : []),
    `📦 Итого к оплате: ${total.toLocaleString('ru-RU')} ₽`,
    '',
    separator,
    '💳 Остаток к оплате:',
    `👉 Предоплата 50% — ${prepay.toLocaleString('ru-RU')} ₽ (уже внесена)`,
    `👉 Остаток — ${rest.toLocaleString('ru-RU')} ₽`,
    ...(isPickup ? ['', `📍 Самовывоз: ${businessConfig.pickupAddress}`] : []),
    '',
    `📲 Реквизиты для перевода (${businessConfig.payment.label}):`,
    `   ${businessConfig.payment.phone}`,
    `   ${businessConfig.payment.recipient}`,
    '',
    '👉 Пожалуйста, оплатите остаток и пришлите чек по тем же реквизитам.',
    '',
    'Спасибо! Ждём вас 🙌',
  ].join('\n');
}
import { getDeadlineInfo } from '../../utils/deadline';
import { ordersApi } from '../../api/orders';
import { StatusStepper } from './StatusStepper';
import { ItemsTable } from './ItemsTable';
import { StatusBadge } from '../ui/StatusBadge';
import { InfoRow } from '../ui/InfoRow';
import { OrderEditForm } from './OrderEditForm';
import { TshirtItemsTable } from './TshirtItemsTable';
import { COMMUNICATION_LABELS, DELIVERY_LABELS } from '../../constants';
import { useAuth } from '../../context/useAuth';
import type { AppUser, UpdateOrderDto, OrderPhoto } from '../../types/index';
import { getErrorMessage } from '../../utils/get-error-message';

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent';

interface AssignPanelProps {
  order: OrderPhoto;
  onAssigned: (updated: OrderPhoto) => void;
}

function AssignPanel({ order, onAssigned }: AssignPanelProps) {
  const [open, setOpen] = useState(false);
  const [executorId, setExecutorId] = useState(order.executorId ?? '');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    staleTime: 60_000,
  });

  const executors = users.filter((u: AppUser) => u.role === 'EXECUTOR' && u.isActive !== false);

  const mutation = useMutation({
    mutationFn: () => ordersApi.assignExecutor(order.id, executorId || null),
    onSuccess: (updated) => {
      onAssigned(updated);
      setOpen(false);
      toast.success(executorId ? 'Исполнитель назначен' : 'Исполнитель снят');
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Ошибка')),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <UserCheck size={13} />
        {order.executor ? `Исполнитель: ${order.executor.username}` : 'Назначить исполнителя'}
      </button>
    );
  }

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2">
      <select
        value={executorId}
        onChange={(e) => setExecutorId(e.target.value)}
        className={inputCls + ' flex-1'}
      >
        <option value="">— без исполнителя —</option>
        {executors.map((u) => (
          <option key={u.id} value={u.id}>
            {u.username} ({u.rateBasisPoints === null
              ? 'ставка не назначена'
              : `${(u.rateBasisPoints / 100).toFixed(2)}%`})
          </option>
        ))}
      </select>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {mutation.isPending ? '…' : 'Назначить'}
      </button>
      <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
}

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

  const { data: order, isLoading, refetch } = useQuery({
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
    // Если Telegram — вернуть @username из https://t.me/username
    const urlComm =
      order.communicationPlatform === 'TELEGRAM' && order.urlCommunication.startsWith('https://t.me/')
        ? '@' + order.urlCommunication.replace('https://t.me/', '')
        : order.urlCommunication;
    setForm({
      sourceOrder: order.sourceOrder,
      communicationPlatform: order.communicationPlatform,
      urlCommunication: urlComm,
      deliveryMethod: order.deliveryMethod,
      deliveryCost: order.deliveryCost,
      note: order.note,
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div role="status" aria-label="Загрузка заявки" className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
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
            <StatusBadge status={order.status} productCategory={order.productCategory} />
            {/* Дедлайн — только для активных заказов */}
            {order.status !== 'SENT' && order.status !== 'PAID' && (() => {
              const dl = getDeadlineInfo(order.deadline, order.createdAt);
              return dl.label ? (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${dl.badgeClass}`}>
                  <Clock size={10} /> {dl.label}
                </span>
              ) : null;
            })()}
            {order.isUrgent && order.status !== 'SENT' && order.status !== 'PAID' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-300 motion-safe:animate-pulse">
                <Flame size={11} aria-hidden="true" /> Срочно
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* Кнопка Срочно — только пока не отправлен */}
          {order.status !== 'SENT' && order.status !== 'PAID' && (
            <button
              onClick={toggleUrgent}
              disabled={updateMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                order.isUrgent
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              }`}
            >
              <Flame size={13} aria-hidden="true" />
              {order.isUrgent ? 'Снять срочность' : 'Срочно'}
            </button>
          )}
          {isAdmin && (
            <>
              {/* Кнопки копирования текста клиенту */}
              {(order.status === 'NEW' || order.status === 'READY') && (() => {
                const text = order.status === 'NEW'
                  ? generateConfirmationText(order)
                  : generateReadyText(order);
                const label = order.status === 'NEW'
                  ? 'Скопировать подтверждение'
                  : 'Скопировать сообщение готовности';
                const copyText = () => {
                  try {
                    if (navigator.clipboard && window.isSecureContext) {
                      navigator.clipboard.writeText(text)
                        .then(() => toast.success('Текст скопирован!'))
                        .catch(() => toast.error('Не удалось скопировать'));
                    } else {
                      const ta = document.createElement('textarea');
                      ta.value = text;
                      ta.style.position = 'fixed';
                      ta.style.opacity = '0';
                      document.body.appendChild(ta);
                      ta.focus();
                      ta.select();
                      document.execCommand('copy');
                      document.body.removeChild(ta);
                      toast.success('Текст скопирован!');
                    }
                  } catch {
                    toast.error('Не удалось скопировать');
                  }
                };
                return (
                  <button
                    onClick={copyText}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <Copy size={13} aria-hidden="true" /> {label}
                  </button>
                );
              })()}
              {!editing && (
                <button onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
                  <Pencil size={13} aria-hidden="true" /> Изменить
                </button>
              )}
              <button onClick={() => { if (confirm('Удалить заявку?')) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                <Trash2 size={13} aria-hidden="true" /> Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status flow */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500">Прогресс статуса</p>
        <StatusStepper order={order} />
        {isAdmin && (
          <AssignPanel
            order={order}
            onAssigned={(updated) => {
              qc.setQueryData(['order', orderId], updated);
              refetch();
            }}
          />
        )}
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

      {/* Items — исполнители видят только фото-позиции */}
      {order.productCategory === 'TSHIRT' && isAdmin
        ? <TshirtItemsTable order={order} />
        : order.productCategory === 'PHOTO'
          ? <ItemsTable order={order} />
          : null
      }
    </div>
  );
}
