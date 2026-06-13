import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi } from '../api/orders';
import {
  STATUS_FLOW,
  STATUS_LABELS,
  TSHIRT_STATUS_FLOW,
  TSHIRT_STATUS_LABELS,
  TERMINAL_STATUSES,
} from '../constants';
import { useAuth } from '../context/useAuth';
import type { EnumStatus, OrderPhoto } from '../types';
import { Check, ChevronRight } from 'lucide-react';
import { getErrorMessage } from '../utils/get-error-message';

interface Props { order: OrderPhoto }

export function StatusStepper({ order }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isTshirt = order.productCategory === 'TSHIRT';
  const flow = isTshirt ? TSHIRT_STATUS_FLOW : STATUS_FLOW;
  const labels = isTshirt ? TSHIRT_STATUS_LABELS : STATUS_LABELS;
  const currentIdx = flow.indexOf(order.status);

  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  const mutation = useMutation({
    mutationFn: (status: EnumStatus) => ordersApi.updateStatus(order.id, { status }),
    onSuccess: (updated) => {
      qc.setQueryData(['order', order.id], updated);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Статус: ${labels[updated.status] ?? updated.status}`);
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Ошибка обновления статуса')),
  });

  // Если текущий статус не в flow (например CANCELLED или legacy PAID) — просто показываем бейдж
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
    <div className="flex items-center gap-1 flex-wrap">
      {flow.map((status, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isNext = idx === currentIdx + 1;
        const isPrev = idx === currentIdx - 1;

        // Для исполнителя — только переход в READY_FOR_REVIEW с предыдущего шага
        const executorCanClick =
          !isAdmin && isNext && status === 'READY_FOR_REVIEW';
        const adminCanGoNext = isAdmin && isNext;
        const adminCanGoBack = isAdmin && isPrev;
        const clickable = executorCanClick || adminCanGoNext || adminCanGoBack;

        return (
          <div key={status} className="flex items-center gap-1">
            <button
              disabled={!clickable || mutation.isPending}
              onClick={() => mutation.mutate(status)}
              tabIndex={clickable ? 0 : -1}
              aria-current={isCurrent ? 'step' : undefined}
              title={isAdmin && isPrev ? 'Вернуть на предыдущий статус' : undefined}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                ${isCurrent ? 'bg-amber-600 text-white shadow-sm cursor-default' : ''}
                ${isDone && !adminCanGoBack ? 'bg-green-100 text-green-700 cursor-default' : ''}
                ${adminCanGoBack ? 'bg-green-100 text-green-700 hover:bg-orange-100 hover:text-orange-700 cursor-pointer border border-dashed border-green-300' : ''}
                ${(adminCanGoNext || executorCanClick) ? 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-700 cursor-pointer border border-dashed border-gray-300' : ''}
                ${idx > currentIdx + 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
                ${!isAdmin && isNext && status !== 'READY_FOR_REVIEW' ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : ''}
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
  );
}
