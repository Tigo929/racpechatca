import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Printer, Send, X } from 'lucide-react';
import { ozonDeliveryApi, openPdf } from '../../api/ozonDelivery';
import { ordersApi } from '../../api/orders';
import { Modal } from '../ui/Modal';
import { displayOrderNumber } from '../../utils/order-number';
import { ordersWord } from '../../utils/bulk-ship';
import type { BulkShipResult, OrderPhoto } from '../../types/index';

interface Props {
  selected: OrderPhoto[];
  onClear: () => void;
  /** Отмеченные уходят из выбора, не прошедшие остаются — их видно и можно разобрать. */
  onFinished: (failedIds: string[]) => void;
}

/**
 * Полоса внизу экрана, пока выбраны фотозаказы из «Отгрузка создана».
 *
 * Подтверждение обязательно: «Отправлен» начисляет зарплату исполнителям,
 * и пачка на десять заказов, нажатая случайно, — это десять начислений,
 * которые потом снимать по одному.
 */
export function BulkShipBar({ selected, onClear, onFinished }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [failures, setFailures] = useState<BulkShipResult['results']>([]);

  const ship = useMutation({
    mutationFn: () => ordersApi.bulkShip(selected.map((o) => o.id)),
    onSuccess: (res) => {
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order'] });
      if (res.shipped > 0) toast.success(`Отмечено отправленными: ${ordersWord(res.shipped)}`);
      const failed = res.results.filter((r) => !r.ok);
      setFailures(failed);
      onFinished(failed.map((r) => r.id));
    },
    onError: () => toast.error('Не удалось отметить заказы — ничего не изменилось, попробуйте ещё раз'),
  });

  // Этикетки Ozon одним PDF — только по заказам с доставкой «ПВЗ Ozon».
  const ozonIds = selected.filter((o) => o.deliveryMethod === 'OZON_PVZ').map((o) => o.id);
  const labels = useMutation({
    mutationFn: () => ozonDeliveryApi.labels(ozonIds),
    onSuccess: ({ blob, failed }) => {
      openPdf(blob);
      if (failed.length) toast(`Без этикетки: ${failed.join('; ')}`, { icon: '⚠️', duration: 10_000 });
    },
    onError: () => toast.error('Этикетки не получены — проверьте, что отправления созданы и подтверждены'),
  });

  return (
    <>
      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Действия с выбранными заказами"
          className="sticky bottom-3 z-20 mx-auto flex max-w-xl items-center gap-2 rounded-2xl bg-gray-900 px-4 py-2.5 text-white shadow-xl"
        >
          <span className="flex-1 text-sm font-medium tabular-nums">
            Выбрано: {ordersWord(selected.length)}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 text-sm text-gray-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X size={14} aria-hidden="true" /> Снять
          </button>
          {ozonIds.length > 0 && (
            <button
              type="button"
              onClick={() => labels.mutate()}
              disabled={labels.isPending}
              title="Этикетки Ozon по выбранным заказам — одним файлом"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-500 px-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <Printer size={14} aria-hidden="true" /> {labels.isPending ? '…' : `Этикетки (${ozonIds.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 text-sm font-semibold text-white hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Send size={14} aria-hidden="true" /> Отметить отправленными
          </button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => !ship.isPending && setConfirmOpen(false)}
        title="Отметить отправленными?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {ordersWord(selected.length)} перейдут в «Отправлен». Исполнителям начислится
            зарплата — так же, как при отметке из карточки заказа.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {selected.map((o) => (
              <li
                key={o.id}
                className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-700 tabular-nums"
              >
                {displayOrderNumber(o)}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={ship.isPending}
              className="min-h-[44px] rounded-lg px-4 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => ship.mutate()}
              disabled={ship.isPending}
              // Курсор на «Да»: Enter подтверждает, Esc отменяет.
              autoFocus
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send size={14} aria-hidden="true" />
              {ship.isPending ? 'Отмечаем…' : 'Да, отправлены'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Не прошедшие — отдельным окном, а не всплывашкой: причину надо
          прочитать и пойти исправить, за три секунды это не успеть. */}
      <Modal
        open={failures.length > 0}
        onClose={() => setFailures([])}
        title={`Не отмечены: ${ordersWord(failures.length)}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Остальные отмечены. Эти заказы остались выбранными — исправьте причину и отметьте снова.
          </p>
          <ul className="space-y-2">
            {failures.map((f) => (
              <li key={f.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm">
                <span className="font-mono font-semibold text-red-800">{f.numberOrder ?? 'Заказ'}</span>
                <span className="text-red-700"> — {f.error}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setFailures([])}
              className="min-h-[44px] rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Понятно
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
