import { useState } from "react";
import toast from "react-hot-toast";
import { ordersApi } from "../../api/orders";
import { copyPendingText } from "../../utils/clipboard";
import { ClientTextFallback } from "./ClientTextFallback";

/**
 * Кнопка «Скопировать сообщение клиенту».
 *
 * Автоматически первым сообщением мы пишем только в телеграм: MAX, почта
 * и голый телефон так не открываются. Раньше такому клиенту менеджер
 * сочинял текст сам — и он отличался от того, что получают остальные:
 * другой состав заказа, другая формулировка про доставку, иногда без суммы.
 *
 * Текст берётся с сервера, а не собирается здесь: он должен быть ровно тем,
 * который отправил бы воркер. Вторая сборка того же текста разошлась бы
 * с первой при ближайшей правке.
 */
export function GreetingCopyButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  async function copy() {
    setBusy(true);
    try {
      // Текст едет с сервера, поэтому копируем «обещанием»: на iPhone
      // право на запись в буфер живёт только внутри нажатия, и обычный
      // await его тратит (см. copyPendingText).
      if (!(await copyPendingText(() => ordersApi.getGreetingText(orderId)))) {
        // Буфер не дался — показываем текст окном с «Поделиться».
        setFallback(await ordersApi.getGreetingText(orderId));
        return;
      }
      toast.success("Сообщение скопировано");
    } catch {
      // Буфер недоступен или запрос не прошёл. Молчать нельзя: менеджер
      // решит, что скопировалось, и отправит пустоту.
      toast.error("Не удалось скопировать — откройте заказ ещё раз");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {fallback && (
        <ClientTextFallback
          text={fallback}
          title="Сообщение клиенту"
          onClose={() => setFallback(null)}
        />
      )}
      <button
        type="button"
        onClick={copy}
        disabled={busy}
        className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
      >
        {busy ? "Готовлю…" : "Скопировать сообщение клиенту"}
      </button>
    </>
  );
}
