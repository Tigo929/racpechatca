import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { ordersApi } from '../../api/orders';
import { useAuth } from '../../context/useAuth';
import { formatDate } from '../../utils/format';
import { getErrorMessage } from '../../utils/get-error-message';
import type { OrderPhoto } from '../../types/index';

/**
 * Дата оплаты заказа (работа D1).
 *
 * Заказ попадает в «Оплачен» двумя путями. Когда статус ставит человек, он
 * знает про деньги — дата ставится сама. Когда заказ закрывает выплата
 * зарплаты исполнителю, дату оплаты клиентом не знает никто: пачка заказов
 * закрывается разом. Поэтому здесь видно честное «дата не указана», и
 * администратор может её сообщить — один раз, без правки уже указанной.
 */
export function PaidAtBlock({ order }: { order: OrderPhoto }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const isPaid = order.status === 'PAID' || order.status === 'COMPLETED';

  const mutation = useMutation({
    mutationFn: (clientPaidAt: string) =>
      ordersApi.setPaidAt(order.id, clientPaidAt),
    onSuccess: (updated) => {
      qc.setQueryData(['order', order.id], updated);
      qc.invalidateQueries({ queryKey: ['orders'] });
      setEditing(false);
      toast.success('Дата оплаты записана');
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Не удалось записать дату оплаты')),
  });

  // Неоплаченному заказу дату оплаты показывать нечего (проверка после
  // хуков: порядок вызовов обязан быть одинаковым при каждом рендере).
  if (!isPaid) return null;

  if (order.clientPaidAt) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-gray-600">
        <CalendarCheck size={14} className="text-green-600" aria-hidden="true" />
        Оплата получена:{' '}
        <span className="font-semibold text-gray-800">
          {formatDate(order.clientPaidAt)}
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm text-amber-700">
        <CalendarX size={14} aria-hidden="true" />
        Дата оплаты не указана
        {!isAdmin && (
          <span className="text-xs text-gray-500">
            — её может указать администратор
          </span>
        )}
      </p>

      {isAdmin && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 text-sm font-semibold text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Указать дату оплаты
        </button>
      )}

      {isAdmin && editing && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={value}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Фактическая дата оплаты"
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          />
          <button
            disabled={!value || mutation.isPending}
            onClick={() => mutation.mutate(value)}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setValue('');
            }}
            className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Отмена
          </button>
          <span className="w-full text-xs text-gray-500">
            Указывается один раз: потом дата не редактируется.
          </span>
        </div>
      )}
    </div>
  );
}
