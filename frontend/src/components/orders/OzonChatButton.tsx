import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquare } from 'lucide-react';
import { ozonOrdersApi } from '../../api/ozonOrders';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Чат с покупателем Ozon — одной кнопкой.
 *
 * Ссылку на переписку вставляли руками: сходить в кабинет, найти заказ,
 * открыть чат, скопировать адрес. Шаг лишний, и чаще его просто пропускали —
 * тогда в поле связи оставался номер отправления, а бот, прося отзыв,
 * отправлял покупателя в общий список заказов вместо его переписки.
 *
 * Нажатие спрашивает чат у Ozon, кладёт ссылку в заказ и открывает её
 * в новой вкладке. Площадка отдаёт адрес только вместе с созданием чата,
 * поэтому делается это по кнопке, а не само при заведении заказа: иначе
 * пустой чат открылся бы у каждого покупателя. Нажатие — это и есть
 * «я иду писать».
 */

interface Props {
  orderId: string;
  accountId: string;
  postingNumber: string;
  /** Ссылка уже в заказе — кнопка просто открывает её, без запроса к Ozon. */
  existingUrl?: string | null;
}

export function OzonChatButton({
  orderId,
  accountId,
  postingNumber,
  existingUrl,
}: Props) {
  const qc = useQueryClient();
  const saved = (existingUrl ?? '').trim();
  const hasLink = saved.startsWith('http');

  const open = useMutation({
    mutationFn: () => ozonOrdersApi.openChat(accountId, postingNumber),
    onSuccess: ({ url, savedToOrder }) => {
      /*
       * Окно открываем после ответа, а не заранее: до него адреса ещё нет.
       * Блокировщик всплывающих окон такой переход может задержать — тогда
       * ссылка всё равно уже в заказе, и она откроется обычным нажатием.
       */
      window.open(url, '_blank', 'noopener');
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(
        savedToOrder ? 'Чат открыт, ссылка сохранена в заказе' : 'Чат открыт',
      );
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось открыть чат с покупателем')),
  });

  if (hasLink) {
    return (
      <a
        href={saved}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
      >
        <MessageSquare size={14} aria-hidden="true" />
        Чат с покупателем
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open.mutate()}
      disabled={open.isPending}
      title="Откроет переписку с покупателем в кабинете Ozon и сохранит ссылку в заказе"
      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-60"
    >
      <MessageSquare size={14} aria-hidden="true" />
      {open.isPending ? 'Открываем…' : 'Чат с покупателем'}
    </button>
  );
}
