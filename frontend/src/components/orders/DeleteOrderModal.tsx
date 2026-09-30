import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

/**
 * Удаление заявки — только с причиной.
 *
 * Заявки с сайта иногда приходится удалять: дубль, ошибка, человек
 * передумал. Раньше заказ исчезал по вопросу «Удалить заявку?», и через
 * месяц никто не мог сказать, почему заявок с сайта меньше, чем визитов.
 *
 * Поэтому здесь не подтверждение, а вопрос по существу: почему. Причина
 * пишется словами и обязательна — готовых вариантов пока нет намеренно.
 * Сначала соберём, что люди пишут на самом деле, и уже из этого сделаем
 * список; придуманный заранее список заставил бы выбирать «прочее»
 * и потерял бы ровно то, ради чего всё затевалось.
 */

/** Короче трёх знаков — это не причина, а отписка. Столько же требует сервер. */
const MIN_REASON = 3;

interface Props {
  orderNumber: string;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function DeleteOrderModal({
  orderNumber,
  isPending,
  onConfirm,
  onCancel,
}: Props) {
  const [reason, setReason] = useState('');
  const tooShort = reason.trim().length < MIN_REASON;

  return (
    <Modal open onClose={onCancel} title={`Удалить заявку ${orderNumber}?`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort && !isPending) onConfirm(reason.trim());
        }}
      >
        <p className="text-sm text-gray-600">
          Заявка и её позиции удалятся насовсем. Причина останется — по ней
          потом будет видно, почему заявки не доходят до заказа.
        </p>

        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="delete-reason"
          >
            Причина удаления
          </label>
          <textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            maxLength={500}
            placeholder="Например: дубль заявки — клиент отправил дважды"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">
            Своими словами — так, как объяснили бы коллеге.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-11 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={tooShort || isPending}
            // Кнопка гаснет, пока причины нет: так понятнее, чем отказ
            // после нажатия.
            title={tooShort ? 'Сначала напишите причину' : undefined}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            {isPending ? 'Удаляю…' : 'Удалить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
