import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi } from '../api/orders';
import { STATUS_FLOW, STATUS_LABELS, TSHIRT_STATUS_FLOW, TSHIRT_STATUS_LABELS } from '../constants';
import type { EnumStatus, OrderPhoto } from '../types';
import { Check, ChevronRight } from 'lucide-react';

interface Props { order: OrderPhoto }

export function StatusStepper({ order }: Props) {
  const qc = useQueryClient();
  const isTshirt = order.productCategory === 'TSHIRT';
  const flow = isTshirt ? TSHIRT_STATUS_FLOW : STATUS_FLOW;
  const labels = isTshirt ? TSHIRT_STATUS_LABELS : STATUS_LABELS;
  const currentIdx = flow.indexOf(order.status);

  const mutation = useMutation({
    mutationFn: (status: EnumStatus) => ordersApi.updateStatus(order.id, { status }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['order', order.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Статус: ${labels[updated.status]}`);
    },
    onError: () => toast.error('Ошибка обновления статуса'),
  });

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {flow.map((status, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isNext = idx === currentIdx + 1;

        return (
          <div key={status} className="flex items-center gap-1">
            <button
              disabled={!isNext || mutation.isPending}
              onClick={() => mutation.mutate(status)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${isDone ? 'bg-green-100 text-green-700 cursor-default' : ''}
                ${isCurrent ? 'bg-amber-600 text-white shadow-sm cursor-default' : ''}
                ${isNext ? 'bg-gray-100 text-gray-600 hover:bg-amber-100 hover:text-amber-700 cursor-pointer border border-dashed border-gray-300' : ''}
                ${idx > currentIdx + 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
              `}
            >
              {isDone && <Check size={11} />}
              {labels[status]}
            </button>
            {idx < flow.length - 1 && (
              <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
