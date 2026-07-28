import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "../../api/orders";
import { toast } from "../../utils/toast";

type Props = {
  orderId: string;
  order: {
    gulianSyncStatus?: string | null;
    gulianLastAttemptAt?: string | null;
    gulianLastSyncedAt?: string | null;
    gulianLastError?: string | null;
    gulianSettlementOrderNumber?: string | null;
    gulianPositionId?: number | null;
    gulianAppliedRevision?: number | null;
    executorSentAt?: string | null;
  };
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  synced: { label: "✅ Синхронизировано", className: "text-emerald-700" },
  pending: { label: "⏳ Ожидает отправки", className: "text-yellow-600" },
  failed: { label: "❌ Ошибка синхронизации", className: "text-red-700" },
  stale: { label: "⚠️ Устаревшая ревизия", className: "text-orange-600" },
  ignored: { label: "⚠️ Отклонено", className: "text-orange-600" },
  duplicate: { label: "✅ Дубликат (принято)", className: "text-emerald-600" },
};

export function GulianSyncBlock({ orderId, order }: Props) {
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);

  const retryMutation = useMutation({
    mutationFn: () => ordersApi.retryGulianSync(orderId),
    onSuccess: (data) => {
      toast.success(`Повторная синхронизация поставлена в очередь (${data.retried} событий)`);
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: () => toast.error("Не удалось поставить в очередь повторную синхронизацию"),
  });

  const status = order.gulianSyncStatus;
  const statusInfo = status ? STATUS_LABELS[status] : null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Gulian CRM — передача исполнителю
      </p>

      {!order.executorSentAt ? (
        <p className="text-sm text-gray-500">Не отправлен исполнителю</p>
      ) : (
        <div className="space-y-1">
          {statusInfo && (
            <p className={`text-sm font-semibold ${statusInfo.className}`}>
              {statusInfo.label}
            </p>
          )}
          {order.gulianSettlementOrderNumber && (
            <p className="text-xs text-gray-600">
              Расчётный заказ: <span className="font-medium">{order.gulianSettlementOrderNumber}</span>
              {order.gulianPositionId && ` · позиция #${order.gulianPositionId}`}
            </p>
          )}
          {order.gulianAppliedRevision != null && (
            <p className="text-xs text-gray-500">Ревизия: {order.gulianAppliedRevision}</p>
          )}
          {order.gulianLastSyncedAt && (
            <p className="text-xs text-gray-500">
              Синхр.: {new Date(order.gulianLastSyncedAt).toLocaleString("ru-RU")}
            </p>
          )}
          {order.gulianLastAttemptAt && !order.gulianLastSyncedAt && (
            <p className="text-xs text-gray-500">
              Попытка: {new Date(order.gulianLastAttemptAt).toLocaleString("ru-RU")}
            </p>
          )}
          {order.gulianLastError && (
            <p className="text-xs text-red-600 break-words">{order.gulianLastError}</p>
          )}
          {(status === "failed" || status === "pending") && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              {retryMutation.isPending ? "..." : "🔄 Повторить синхронизацию"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}