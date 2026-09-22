import { useState } from 'react';
import { fulfillmentError } from '../../utils/fulfillment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi } from '../../api/orders';
import {
  STATUS_FLOW,
  STATUS_LABELS,
  CANVAS_STATUS_FLOW,
  CANVAS_STATUS_LABELS,
  TSHIRT_STATUS_FLOW,
  TSHIRT_STATUS_LABELS,
  TERMINAL_STATUSES,
} from '../../constants';
import { useAuth } from '../../context/useAuth';
import type { EnumStatus, OrderPhoto } from '../../types/index';
import { Check, ChevronRight } from 'lucide-react';
import { getErrorMessage } from '../../utils/get-error-message';

interface Props { order: OrderPhoto }

export function StatusStepper({ order }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isOrderManager = user?.role === 'ORDER_MANAGER';
  const canManageShipment = isAdmin || isOrderManager;
  const isTshirt = order.productCategory === 'TSHIRT';
  const isCanvas = order.productCategory === 'CANVAS';
  const isExternalProduction = isTshirt || isCanvas;
  const needsShipment = order.deliveryMethod !== 'PICKUP';
  const baseFlow = isTshirt
    ? TSHIRT_STATUS_FLOW
    : isCanvas
      ? CANVAS_STATUS_FLOW
      : STATUS_FLOW;
  const flow = baseFlow.filter(
    (status) => status !== 'SHIPMENT_CREATED' || needsShipment,
  );
  const baseLabels = isTshirt
    ? TSHIRT_STATUS_LABELS
    : isCanvas
      ? CANVAS_STATUS_LABELS
      : STATUS_LABELS;
  const labels = { ...baseLabels,
    READY: needsShipment ? baseLabels.READY : 'Готов к выдаче',
    SENT: !isExternalProduction && !needsShipment ? 'Выдан клиенту' : baseLabels.SENT,
  };
  const currentIdx = flow.indexOf(order.status);

  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  // У фото зарплата начисляется при «Отправлен» — без исполнителя начислять
  // некому, поэтому этот шаг блокируем (сервер тоже не пропустит). У внешних
  // продуктов исполнителя нет — их не трогаем.
  const needsExecutor = !isExternalProduction && !order.executorId;

  // Подтверждение оплаты (работа D1): деньги часто приходят раньше, чем до
  // заказа доходят руки. Поэтому перед переводом в «Оплачен» админ может
  // указать фактическую дату; оставил пустым — как раньше, момент нажатия.
  const [paidDraft, setPaidDraft] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({
      status,
      clientPaidAt,
    }: {
      status: EnumStatus;
      clientPaidAt?: string;
    }) =>
      ordersApi.updateStatus(order.id, {
        status,
        ...(clientPaidAt ? { clientPaidAt } : {}),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['order', order.id], updated);
      qc.invalidateQueries({ queryKey: ['orders'] });
      // Переход в «Отправлен» создаёт начисление — счётчик в шапке должен
      // обновиться сразу, а не через 30 секунд.
      qc.invalidateQueries({ queryKey: ['salary', 'me'] });
      setPaidDraft(null);
      toast.success(`Статус: ${labels[updated.status] ?? updated.status}`);
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Ошибка обновления статуса')),
  });

  // Если текущий статус не в flow (например CANCELLED) или терминальный —
  // просто показываем текст без управляющих кнопок.
  if (currentIdx === -1 || isTerminal) {
    return (
      <div className="text-sm text-gray-500">
        Статус:{' '}
        <span className="font-semibold text-gray-700">
          {labels[order.status] ?? STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {paidDraft !== null && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <span className="text-sm text-amber-800">
            Когда получены деньги?
          </span>
          <input
            type="date"
            value={paidDraft}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setPaidDraft(e.target.value)}
            aria-label="Фактическая дата оплаты"
            className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          />
          <button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                status: 'PAID',
                ...(paidDraft ? { clientPaidAt: paidDraft } : {}),
              })
            }
            className="px-3 py-1 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {paidDraft ? 'Оплачен этой датой' : 'Оплачен сегодня'}
          </button>
          <button
            onClick={() => setPaidDraft(null)}
            className="px-3 py-1 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Отмена
          </button>
        </div>
      )}
      <div className="flex items-center gap-1 flex-wrap">
      {flow.map((status, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        // Исполнитель может переключаться в любую сторону по рабочему потоку,
        // но PAID остаётся админским финансовым закрытием.
        const adminOnly = status === 'PAID' || status === 'CANCELLED';
        const shipmentOnly = status === 'SHIPMENT_CREATED';
        const canSetTarget =
          isAdmin || (!adminOnly && (!shipmentOnly || canManageShipment));
        const blockedNoExecutor = status === 'SENT' && needsExecutor;
        const blockedShipmentRole = shipmentOnly && !canManageShipment;
        const transitionError = fulfillmentError(order, status);
        const blockedShipmentMissing = Boolean(transitionError);
        const clickable =
          !isCurrent &&
          canSetTarget &&
          !blockedNoExecutor &&
          !blockedShipmentRole &&
          !blockedShipmentMissing;
        const isPastClickable = idx < currentIdx && clickable;
        const isFutureClickable = idx > currentIdx && clickable;

        return (
          <div key={status} className="flex items-center gap-1">
            <button
              disabled={!clickable || mutation.isPending}
              onClick={() => {
                if (status === 'PAID' && isAdmin && !order.clientPaidAt) {
                  setPaidDraft('');
                  return;
                }
                mutation.mutate({ status });
              }}
              tabIndex={clickable ? 0 : -1}
              aria-current={isCurrent ? 'step' : undefined}
              title={
                blockedNoExecutor
                  ? 'Сначала назначьте исполнителя'
                  : blockedShipmentRole
                    ? 'Отгрузку создаёт администратор или менеджер'
                  : blockedShipmentMissing
                    ? transitionError ?? undefined
                  : clickable
                    ? `Установить статус: ${labels[status] ?? status}`
                    : undefined
              }
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                ${isCurrent ? 'bg-amber-600 text-white shadow-sm cursor-default' : ''}
                ${isDone && !isPastClickable ? 'bg-green-100 text-green-700 cursor-default' : ''}
                ${isPastClickable ? 'bg-green-100 text-green-700 hover:bg-orange-100 hover:text-orange-700 cursor-pointer border border-dashed border-green-300' : ''}
                ${isFutureClickable ? 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-700 cursor-pointer border border-dashed border-gray-300' : ''}
                ${!isCurrent && !clickable ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : ''}
              `}
            >
              {isDone && <Check size={11} aria-hidden="true" />}
              {labels[status] ?? status}
            </button>
            {idx < flow.length - 1 && (
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" aria-hidden="true" />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
