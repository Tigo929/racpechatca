import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Wallet,
  HandCoins,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { salaryApi } from '../api/orders';
import type { ExecutorSalaryData, AccrualBrief } from '../types';

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

const ACCRUAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает выплаты',
  PARTIALLY_PAID: 'Частично выплачено',
  PAID: 'Выплачено',
  SETTLED: 'Закрыто',
  REVERSED: 'Отменено',
};

function AccrualRow({ a }: { a: AccrualBrief }) {
  const dt = a.completedAt
    ? new Date(a.completedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : '—';
  const statusColor =
    a.status === 'PENDING' || a.status === 'PARTIALLY_PAID'
      ? 'text-amber-700'
      : 'text-emerald-600';

  return (
    <tr className="border-b border-gray-50 text-sm">
      <td className="px-3 py-2 font-mono font-semibold text-indigo-800">{a.orderNumber}</td>
      <td className="px-3 py-2 text-gray-500">{dt}</td>
      <td className="px-3 py-2 text-right text-gray-600">{fmt(a.salaryBase)}</td>
      <td className="px-3 py-2 text-right text-gray-500 font-mono">{(a.rateBasisPoints / 100).toFixed(2)}%</td>
      <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(a.salaryAmount)}</td>
      <td className="px-3 py-2 text-right text-emerald-600">{a.paidAmount > 0 ? fmt(a.paidAmount) : '—'}</td>
      <td className={`px-3 py-2 text-right font-bold ${a.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
        {a.debt > 0 ? fmt(a.debt) : '✓'}
      </td>
      <td className={`px-3 py-2 text-xs ${statusColor}`}>
        {ACCRUAL_STATUS_LABELS[a.status] ?? a.status}
      </td>
    </tr>
  );
}

interface PayFormProps {
  executor: ExecutorSalaryData;
  onDone: () => void;
}

function PayForm({ executor, onDone }: PayFormProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(executor.totalDebt));
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      salaryApi.createPayment({
        executorId: executor.id,
        amount: Math.round(Number(amount)),
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-summary'] });
      toast.success('Выплата записана');
      onDone();
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Ошибка'),
  });

  const parsed = Math.round(Number(amount));
  const valid = parsed > 0 && parsed <= executor.totalDebt;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-xs font-semibold text-amber-800">Зарегистрировать выплату</p>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            min="1"
            max={executor.totalDebt}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            placeholder="Сумма"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₽</span>
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          placeholder="Примечание (необязательно)"
        />
      </div>
      {!valid && amount !== '' && (
        <p className="text-xs text-red-600">
          Сумма должна быть от 1 до {fmt(executor.totalDebt)} (общий долг).
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !valid}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <HandCoins size={14} aria-hidden="true" />
          {mutation.isPending ? 'Записываем…' : 'Записать выплату'}
        </button>
        <button
          onClick={onDone}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

interface ExecutorCardProps {
  ex: ExecutorSalaryData;
}

function ExecutorCard({ ex }: ExecutorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{ex.username}</span>
              {!ex.isActive && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">неактивен</span>
              )}
              <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                {ex.ratePercent}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {ex.pendingAccruals.length > 0
                ? `${ex.pendingAccruals.length} незакрытых начислений`
                : 'Нет долга'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          {ex.totalDebt > 0 ? (
            <div className="text-right">
              <p className="text-xs text-gray-400">Долг</p>
              <p className="text-lg font-bold text-red-600">{fmt(ex.totalDebt)}</p>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-emerald-600 text-sm">
              <CheckCircle2 size={15} /> Долга нет
            </div>
          )}

          <div className="flex items-center gap-2">
            {ex.totalDebt > 0 && !paying && (
              <button
                onClick={() => setPaying(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <HandCoins size={14} /> Выплатить
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={expanded ? 'Свернуть' : 'Развернуть'}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Pay form */}
      {paying && (
        <div className="px-5 pb-4">
          <PayForm executor={ex} onDone={() => setPaying(false)} />
        </div>
      )}

      {/* Expanded accruals */}
      {expanded && (
        <div className="border-t border-gray-50">
          {ex.pendingAccruals.length > 0 && (
            <>
              <div className="px-5 pt-3 pb-1 flex items-center gap-2">
                <Clock size={12} className="text-amber-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">К выплате</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-50">
                      <th className="px-3 py-2 text-left">Заказ</th>
                      <th className="px-3 py-2 text-left">Дата</th>
                      <th className="px-3 py-2 text-right">Чистая база</th>
                      <th className="px-3 py-2 text-right">Ставка</th>
                      <th className="px-3 py-2 text-right">Начислено</th>
                      <th className="px-3 py-2 text-right">Выплачено</th>
                      <th className="px-3 py-2 text-right">Долг</th>
                      <th className="px-3 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.pendingAccruals.map((a) => (
                      <AccrualRow key={a.id} a={a} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ex.closedAccruals.length > 0 && (
            <>
              <div className="px-5 pt-3 pb-1 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Закрытые начисления</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-50">
                      <th className="px-3 py-2 text-left">Заказ</th>
                      <th className="px-3 py-2 text-left">Дата</th>
                      <th className="px-3 py-2 text-right">Начислено</th>
                      <th className="px-3 py-2 text-right">Выплачено</th>
                      <th className="px-3 py-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.closedAccruals.map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 text-sm">
                        <td className="px-3 py-2 font-mono font-semibold text-indigo-800">{a.orderNumber}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {a.completedAt
                            ? new Date(a.completedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(a.salaryAmount)}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{fmt(a.paidAmount)}</td>
                        <td className="px-3 py-2 text-xs text-emerald-600">
                          {ACCRUAL_STATUS_LABELS[a.status] ?? a.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {ex.pendingAccruals.length === 0 && ex.closedAccruals.length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-400 text-center">Начислений нет</p>
          )}
        </div>
      )}
    </div>
  );
}

export function SalaryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['salary-summary'],
    queryFn: salaryApi.getSummary,
  });

  const totalDebt = data?.reduce((s, ex) => s + ex.totalDebt, 0) ?? 0;
  const executorsWithDebt = data?.filter((ex) => ex.totalDebt > 0).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-indigo-950 border-b border-indigo-900 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <Link
            to="/crm"
            className="p-1.5 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-amber-400" />
            <h1 className="text-sm font-bold text-white">Зарплата исполнителей</h1>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-gray-400">Не удалось загрузить данные</div>
        ) : (
          <>
            {/* Summary bar */}
            {totalDebt > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-4">
                <HandCoins size={20} className="text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Общий долг: <span className="font-bold">{fmt(totalDebt)}</span>
                  </p>
                  <p className="text-xs text-amber-700">
                    {executorsWithDebt} {executorsWithDebt === 1 ? 'исполнитель' : 'исполнителей'} ожидают выплаты
                  </p>
                </div>
              </div>
            )}

            {data.length === 0 ? (
              <p className="text-center py-16 text-gray-400">Нет исполнителей</p>
            ) : (
              data.map((ex) => <ExecutorCard key={ex.id} ex={ex} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
