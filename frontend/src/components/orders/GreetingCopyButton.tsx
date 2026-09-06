import { useState } from 'react';
import toast from 'react-hot-toast';
import { ordersApi } from '../../api/orders';

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

  async function copy() {
    setBusy(true);
    try {
      const text = await ordersApi.getGreetingText(orderId);
      await navigator.clipboard.writeText(text);
      toast.success('Сообщение скопировано');
    } catch {
      // Буфер недоступен или запрос не прошёл. Молчать нельзя: менеджер
      // решит, что скопировалось, и отправит пустоту.
      toast.error('Не удалось скопировать — откройте заказ ещё раз');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={busy}
      className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
    >
      {busy ? 'Готовлю…' : 'Скопировать сообщение клиенту'}
    </button>
  );
}
