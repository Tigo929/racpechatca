import { useQuery } from '@tanstack/react-query';
import { Wallet, Clock, CheckCircle2, Info } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { salaryApi } from '../api/salary';

const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

/** «12 заказов» / «1 заказ» / «2 заказа» — без этого счётчик читается коряво. */
function orderWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заказа';
  return 'заказов';
}

/**
 * Личный кабинет исполнителя по деньгам.
 *
 * Сумм по отдельным заказам здесь нет намеренно: зарплата считается от чека
 * заказа, а чеки от исполнителей скрыты. Показываем итоги и историю выплат —
 * этого достаточно, чтобы сверить расчёт, но чек заказа не раскрывается.
 */
export default function MySalaryPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['salary', 'me'],
    queryFn: salaryApi.getMyBalance,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      <AppHeader onRefresh={() => void refetch()} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900">Моя зарплата</h2>
          <p className="text-sm text-gray-500">Начисления и выплаты</p>
        </div>

        {isLoading && (
          <div className="bg-white rounded-xl p-8 flex justify-center">
            <div
              role="status"
              aria-label="Загрузка"
              className="animate-spin rounded-full h-7 w-7 border-b-2 border-amber-500"
            />
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Главное число — то, что исполнителю ещё должны */}
              <div
                className="rounded-xl p-5 text-white"
                style={{ background: 'linear-gradient(135deg, #D97706, #B45309)' }}
              >
                <div className="flex items-center gap-2 text-amber-100 text-sm font-medium">
                  <Wallet size={16} aria-hidden="true" />
                  К выплате сейчас
                </div>
                <p className="text-3xl font-bold mt-2 tabular-nums">
                  {money(data.totalDebt)}
                </p>
                <p className="text-amber-100 text-sm mt-1">
                  {data.pendingOrders > 0
                    ? `За ${data.pendingOrders} ${orderWord(data.pendingOrders)}`
                    : 'Нет незакрытых начислений'}
                </p>
              </div>

              <div className="rounded-xl p-5 bg-white border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Выплачено за всё время
                </div>
                <p className="text-3xl font-bold mt-2 tabular-nums text-gray-900">
                  {money(data.totalPaid)}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {data.payments.length > 0
                    ? `${data.payments.length} ${data.payments.length === 1 ? 'выплата' : 'выплат'}`
                    : 'Выплат ещё не было'}
                </p>
              </div>
            </div>

            {/* Как это работает — чтобы не спрашивали у админа */}
            <div className="rounded-xl p-4 bg-indigo-50 border border-indigo-100 flex gap-3">
              <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-indigo-900 leading-relaxed">
                Зарплата начисляется, когда заказ переходит в статус{' '}
                <b>«Отправлен»</b>. Когда администратор выдаёт зарплату, заказ
                становится <b>«Оплачен»</b>, и сумма уходит из «к выплате» в
                «выплачено».
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Clock size={15} className="text-gray-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-gray-900">История выплат</h3>
              </div>

              {data.payments.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500 text-center">
                  Здесь появятся ваши выплаты
                </p>
              ) : (
                <ul>
                  {data.payments.map((p) => (
                    <li
                      key={p.id}
                      className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(p.createdAt).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                        {p.note && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{p.note}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold tabular-nums text-gray-900 flex-shrink-0">
                        {money(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
