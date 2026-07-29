import { useState } from "react";
import { Send, X } from "lucide-react";

type PayoutInfo = {
  quantity: number;
  unitPayoutRub: number | null;
  totalPayoutRub: number;
  mode: "per_unit" | "order_total";
};

type Props = {
  orderNumber: string;
  payout: PayoutInfo;
  isResend: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
};

function rub(n: number) {
  return n.toLocaleString("ru-RU") + " ₽";
}

export function DispatchToExecutorModal({
  orderNumber,
  payout,
  isResend,
  onConfirm,
  onCancel,
  isPending,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {isResend ? "Повторная отправка" : "Отправить исполнителю"}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {isResend && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            Заказ уже был отправлен. Повторная отправка обновит существующую
            позицию в Gulian CRM и не создаст новую.
          </p>
        )}

        <p className="text-sm text-gray-700 mb-4">
          Отправить заказ <span className="font-bold">{orderNumber}</span> исполнителю?
        </p>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Количество</span>
            <span className="font-semibold">{payout.quantity} шт.</span>
          </div>
          {payout.unitPayoutRub != null && payout.mode === "per_unit" && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Выплата за единицу</span>
              <span className="font-semibold">{rub(payout.unitPayoutRub)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
            <span className="text-gray-700 font-medium">Общая выплата</span>
            <span className="font-bold text-gray-900">{rub(payout.totalPayoutRub)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            <Send size={14} />
            {isPending ? "Отправка…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}