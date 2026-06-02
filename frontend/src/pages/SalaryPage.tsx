import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  HandCoins,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { ordersApi } from '../api/orders';
import type { SalaryOrder } from '../types';

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent: 'amber' | 'emerald' | 'indigo' | 'gray';
}

const ACCENTS: Record<StatCardProps['accent'], string> = {
  amber: 'border-amber-200 bg-amber-50',
  emerald: 'border-emerald-200 bg-emerald-50',
  indigo: 'border-indigo-200 bg-indigo-50',
  gray: 'border-gray-200 bg-white',
};
const ICON_ACCENTS: Record<StatCardProps['accent'], string> = {
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  indigo: 'text-indigo-600',
  gray: 'text-gray-400',
};

function StatCard({ label, value, hint, icon, accent }: StatCardProps) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${ACCENTS[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={ICON_ACCENTS[accent]}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

interface OrderRowProps {
  order: SalaryOrder;
  onPay?: (id: string) => void;
  paying?: boolean;
  paid?: boolean;
}

function OrderRow({ order, onPay, paying, paid }: OrderRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-sm font-semibold text-indigo-800">
        {order.numberOrder}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(order.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
      </td>
      <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(order.totalOrder)}</td>
      <td className="px-4 py-3 text-right text-sm text-gray-400">−{fmt(order.deliveryCost)}</td>
      <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">{fmt(order.cleanTotal)}</td>
      <td className="px-4 py-3 text-right text-sm font-bold text-amber-700">{fmt(order.employeeShare)}</td>
      <td className="px-4 py-3 text-right text-sm font-medium text-indigo-700">{fmt(order.ownerShare)}</td>
      <td className="px-3 py-3 text-right">
        {paid ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 size={13} /> Выплачено
          </span>
        ) : onPay ? (
          <button
            onClick={() => onPay(order.id)}
            disabled={paying}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <HandCoins size={12} /> Выплатить
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function SalaryTable({
  orders,
  onPay,
  paying,
  paid,
}: {
  orders: SalaryOrder[];
  onPay?: (id: string) => void;
  paying?: boolean;
  paid?: boolean;
}) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        Нет заказов в этой категории
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-400 uppercase tracking-wide">
            <th className="px-4 py-2.5 text-left">Номер</th>
            <th className="px-4 py-2.5 text-left">Дата</th>
            <th className="px-4 py-2.5 text-right">Сумма</th>
            <th className="px-4 py-2.5 text-right">Доставка</th>
            <th className="px-4 py-2.5 text-right">Чистыми</th>
            <th className="px-4 py-2.5 text-right">Сотрудник 30%</th>
            <th className="px-4 py-2.5 text-right">Владелец 70%</th>
            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} onPay={onPay} paying={paying} paid={paid} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SalaryPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['salary'],
    queryFn: ordersApi.getSalary,
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => ordersApi.updateStatus(id, { status: 'PAID' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Зарплата отмечена как выплаченная');
    },
    onError: () => toast.error('Ошибка'),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Шапка */}
      <header className="bg-indigo-950 border-b border-indigo-900 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-amber-400" />
            <h1 className="text-sm font-bold text-white">Зарплата · фотопечать</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-gray-400">Не удалось загрузить данные</div>
        ) : (
          <>
            {/* Карточки: к выплате */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={15} className="text-amber-500" />
                К выплате — заказы со статусом «Отправлен»
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Зарплата сотруднику"
                  value={fmt(data.summary.toPayEmployee)}
                  hint={`${data.ratePercent}% от чистой суммы · ${data.summary.toPayCount} заказов`}
                  icon={<HandCoins size={18} />}
                  accent="amber"
                />
                <StatCard
                  label="Ваша прибыль"
                  value={fmt(data.summary.toPayOwner)}
                  hint={`${100 - data.ratePercent}% от чистой суммы`}
                  icon={<TrendingUp size={18} />}
                  accent="indigo"
                />
                <StatCard
                  label="Чистыми (без доставки)"
                  value={fmt(data.summary.toPayClean)}
                  hint="Итого по неоплаченным заказам"
                  icon={<Wallet size={18} />}
                  accent="gray"
                />
              </div>
            </div>

            {/* Таблица к выплате */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <SalaryTable
                orders={data.toPay}
                onPay={(id) => payMutation.mutate(id)}
                paying={payMutation.isPending}
              />
            </div>

            {/* Выплачено */}
            <div className="pt-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                Уже выплачено — заказы со статусом «Оплачен»
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <StatCard
                  label="Выплачено сотруднику"
                  value={fmt(data.summary.paidEmployee)}
                  hint={`${data.summary.paidCount} заказов`}
                  icon={<HandCoins size={18} />}
                  accent="emerald"
                />
                <StatCard
                  label="Ваша прибыль (получено)"
                  value={fmt(data.summary.paidOwner)}
                  icon={<TrendingUp size={18} />}
                  accent="indigo"
                />
                <StatCard
                  label="Чистыми (без доставки)"
                  value={fmt(data.summary.paidClean)}
                  icon={<Wallet size={18} />}
                  accent="gray"
                />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <SalaryTable orders={data.paid} paid />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
