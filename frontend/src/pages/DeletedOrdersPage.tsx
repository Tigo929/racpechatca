import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { deletedOrdersApi } from '../api/deletedOrders';
import type { DeletedOrder } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';

/**
 * Корзина удалённых заказов.
 *
 * Удаление заказа обратимо ограниченное время, и это окно должно быть
 * видно: иначе ошибочно удалённый заказ заводят заново руками — с новым
 * номером, потерянной историей и расходящейся зарплатой.
 *
 * По умолчанию показывается только то, что ещё можно вернуть. Разобранное
 * (восстановленное и просроченное) — по отдельной галочке: это уже не
 * корзина, а история, по которой смотрят, почему заявки не доходят до
 * заказа.
 */

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent';

/** Цвет срока: чем меньше осталось, тем заметнее. */
function daysLeftStyle(daysLeft: number | null): string {
  if (daysLeft === null) return 'bg-gray-100 text-gray-500 border-gray-200';
  if (daysLeft <= 3) return 'bg-red-50 text-red-700 border-red-200';
  if (daysLeft <= 7) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function plural(days: number): string {
  const last = days % 10;
  const tens = days % 100;
  if (tens >= 11 && tens <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

function formatMoment(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ConfirmProps {
  record: DeletedOrder;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function RestoreModal({
  record,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal
      open
      onClose={onCancel}
      title={`Вернуть заказ ${record.numberOrder}?`}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Заказ вернётся со своими позициями, историей статусов и
          назначениями — в том статусе, в котором его удалили
          (<StatusBadge status={record.status} size="sm" />).
        </p>
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <div className="font-medium text-gray-700">Удалили с причиной:</div>
          <div className="mt-1 whitespace-pre-wrap">{record.reason}</div>
        </div>
        {/*
          Про зарплату предупреждаем до нажатия, а не после: начисления с
          выплатами не воссоздаются, и узнать об этом из уведомления, когда
          заказ уже вернулся, — значит узнать слишком поздно.
        */}
        <p className="text-xs text-gray-400">
          Начисления зарплаты, по которым уже платили, не восстанавливаются —
          выплаты прошли, и их пришлось бы считать заново. Если такие были,
          об этом скажут после возврата.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-11 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {isPending ? 'Возвращаю…' : 'Вернуть заказ'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DeletedOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeHandled, setIncludeHandled] = useState(false);
  const [confirming, setConfirming] = useState<DeletedOrder | null>(null);

  const query = useQuery({
    queryKey: ['deleted-orders', search, includeHandled],
    queryFn: () =>
      deletedOrdersApi.getAll({
        search: search.trim() || undefined,
        includeHandled,
        limit: 50,
      }),
  });

  const restore = useMutation({
    mutationFn: (id: string) => deletedOrdersApi.restore(id),
    onSuccess: (result) => {
      setConfirming(null);
      toast.success(result.message);
      // Предупреждения показываем отдельно и подолгу: это то, что человеку
      // придётся доделать руками.
      result.warnings.forEach((warning) =>
        toast(warning, { icon: '⚠️', duration: 10_000 }),
      );
      void qc.invalidateQueries({ queryKey: ['deleted-orders'] });
      // Заказ вернулся в общие списки и счётчики — их тоже обновляем.
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rows = query.data?.data ?? [];
  const retentionDays = query.data?.meta.retentionDays ?? 30;
  const total = query.data?.meta.quantityElements ?? 0;

  return (
    <AppShell
      title="Корзина"
      subtitle={
        query.isLoading
          ? 'Загружаю…'
          : `${total} ${total === 1 ? 'запись' : 'записей'} · срок возврата ${retentionDays} ${plural(retentionDays)}`
      }
      onRefresh={() => void query.refetch()}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Номер заказа, причина или кто удалил"
            className={inputCls + ' sm:max-w-sm'}
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeHandled}
              onChange={(e) => setIncludeHandled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Показать разобранное
          </label>
        </div>

        {!query.isLoading && rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
            <Trash2 size={20} className="mx-auto mb-2" aria-hidden="true" />
            {includeHandled
              ? 'Удалённых заказов не найдено.'
              : `Корзина пуста. Удалённый заказ появляется здесь и ждёт ${retentionDays} ${plural(retentionDays)}.`}
          </div>
        )}

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      {row.numberOrder}
                    </span>
                    <StatusBadge
                      status={row.status}
                      productCategory={row.productCategory}
                      size="sm"
                    />
                    <span className="text-sm text-gray-500">
                      {row.totalOrder.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    <span className="whitespace-pre-wrap">{row.reason}</span>
                  </div>

                  <div className="text-xs text-gray-400">
                    Удалил {row.deletedByName ?? 'неизвестно кто'} ·{' '}
                    {formatMoment(row.deletedAt)}
                    {row.restoredAt && (
                      <>
                        {' · '}
                        восстановил {row.restoredByName ?? 'неизвестно кто'}{' '}
                        {formatMoment(row.restoredAt)}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {row.canRestore ? (
                    <>
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ' +
                          daysLeftStyle(row.daysLeft)
                        }
                      >
                        <Clock size={11} aria-hidden="true" />
                        {row.daysLeft} {plural(row.daysLeft ?? 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirming(row)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        Вернуть
                      </button>
                    </>
                  ) : (
                    /*
                      Кнопки нет — вместо неё объяснение. Неактивная кнопка
                      заставила бы гадать, почему она не работает.
                    */
                    <span className="inline-flex max-w-xs items-start gap-1.5 text-xs text-gray-400">
                      <AlertTriangle
                        size={12}
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      {row.restoreBlockedReason}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirming && (
        <RestoreModal
          record={confirming}
          isPending={restore.isPending}
          onConfirm={() => restore.mutate(confirming.id)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </AppShell>
  );
}
