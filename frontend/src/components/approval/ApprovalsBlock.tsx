import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, FileImage, Pencil, Plus, Trash2 } from 'lucide-react';
import { approvalsApi } from '../../api/approvals';
import { getErrorMessage } from '../../utils/get-error-message';
import { formatSizeCm } from '../../utils/approval-geometry';
import type {
  EnumApprovalStatus,
  EnumTshirtSize,
  ItemTshirt,
  PrintApproval,
} from '../../types/index';
import { ApprovalEditor } from './ApprovalEditor';

interface Props {
  orderId: string;
  orderNumber: string;
  tshirtItems: ItemTshirt[];
}

const STATUS_LABELS: Record<EnumApprovalStatus, string> = {
  DRAFT: 'Черновик',
  READY: 'Готово к отправке',
  SENT: 'Отправлено клиенту',
  APPROVED: 'Согласовано',
  CHANGES_REQUESTED: 'Требуются изменения',
};

const STATUS_STYLES: Record<EnumApprovalStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  READY: 'bg-indigo-50 text-indigo-700',
  SENT: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  CHANGES_REQUESTED: 'bg-red-50 text-red-700',
};

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

/**
 * Блок «Согласования» в карточке заказа: история версий макета и вход в
 * редактор. Старые версии не удаляются сами — по ним видно, что именно
 * подтверждал клиент, если на производстве возникнет спор.
 */
export function ApprovalsBlock({ orderId, orderNumber, tshirtItems }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals', orderId],
    queryFn: () => approvalsApi.list(orderId),
  });

  const createMutation = useMutation({
    mutationFn: (copyFromId?: string) => {
      // Цвет и размер берём из позиции заказа: сотрудник уже ввёл их при
      // оформлении, повторять эти данные руками незачем.
      const item = tshirtItems[0];
      return approvalsApi.create({
        orderId,
        shirtColor: item?.color ?? 'Чёрный',
        shirtSize: (item?.size ?? 'M') as EnumTshirtSize,
        copyFromId,
      });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['approvals', orderId] });
      setEditingId(created.id);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось создать согласование')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals', orderId] });
      toast.success('Согласование удалено');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось удалить согласование')),
  });

  const handleDownload = async (approval: PrintApproval) => {
    try {
      const { blob, filename } = await approvalsApi.download(approval.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не удалось скачать файл'));
    }
  };

  const latest = approvals[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">
          Согласование макета с клиентом
        </p>
        <div className="flex items-center gap-2">
          {latest && (
            <button
              onClick={() => createMutation.mutate(latest.id)}
              disabled={createMutation.isPending}
              className={btn}
              title={`Скопировать размещение из версии ${latest.version}`}
            >
              <Plus size={13} aria-hidden="true" />
              Новая версия из v{latest.version}
            </button>
          )}
          <button
            onClick={() => createMutation.mutate(undefined)}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            <FileImage size={14} aria-hidden="true" />
            Создать согласование
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Загрузка…</p>
      ) : approvals.length === 0 ? (
        <p className="text-xs text-gray-500">
          Согласований пока нет. Соберите макет, покажите клиенту и только потом
          отправляйте заказ исполнителю — переделка после начала печати
          оплачивается заготовкой.
        </p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((approval) => {
            const sides = Object.entries(approval.sides).filter(
              ([, state]) => state?.printFile,
            );
            return (
              <li
                key={approval.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <span className="text-sm font-semibold text-gray-900">
                  v{approval.version}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[approval.status]}`}
                >
                  {STATUS_LABELS[approval.status]}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(approval.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs text-gray-500">
                  {approval.shirtColor} · {approval.shirtSize}
                </span>
                {sides.map(([side, state]) => (
                  <span key={side} className="text-xs text-gray-500">
                    {side === 'FRONT' ? 'Перед' : 'Спина'}:{' '}
                    {state ? formatSizeCm(state.widthMm, state.heightMm) : '—'}
                  </span>
                ))}
                {approval.fileOutdated && (
                  <span className="text-[11px] text-amber-700">
                    файл устарел — нажмите «Готово» заново
                  </span>
                )}

                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingId(approval.id)}
                    className={btn}
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Редактировать
                  </button>
                  {approval.previewFile && (
                    <button
                      onClick={() => void handleDownload(approval)}
                      className={btn}
                    >
                      <Download size={13} aria-hidden="true" />
                      Скачать
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить согласование v${approval.version}? Файл и загруженные принты этой версии будут удалены.`,
                        )
                      ) {
                        removeMutation.mutate(approval.id);
                      }
                    }}
                    aria-label={`Удалить согласование v${approval.version}`}
                    className={`${btn} text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {editingId && (
        <ApprovalEditor
          approvalId={editingId}
          orderNumber={orderNumber}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
