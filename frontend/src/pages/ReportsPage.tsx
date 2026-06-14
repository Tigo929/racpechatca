import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, expensesApi } from '../api/orders';
import type { MonthData, ExpenseOrder, CreateExpenseDto } from '../types';
import { getErrorMessage } from '../utils/get-error-message';

const fmt = (n: number) =>
  n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });

const CATEGORY_LABEL: Record<string, string> = { PHOTO: 'Фото', TSHIRT: 'Футболки' };

// ── Month table row ───────────────────────────────────────────────────────────

function MonthRow({ m, isTotal }: { m: MonthData & { label?: string }; isTotal?: boolean }) {
  const base = isTotal
    ? 'bg-gray-50 font-bold border-t-2 border-gray-300 text-sm'
    : 'border-b border-gray-100 hover:bg-gray-50 text-sm';

  const Cell = ({
    value,
    dim,
    highlight,
    neg,
  }: {
    value: string;
    dim?: boolean;
    highlight?: boolean;
    neg?: boolean;
  }) => (
    <td
      className={`py-2.5 px-3 text-right tabular-nums ${
        dim ? 'text-gray-400' : ''
      } ${highlight ? 'font-bold text-green-700' : ''} ${neg ? 'text-red-600' : ''}`}
    >
      {value}
    </td>
  );

  const totalExpenses = m.expensePhoto + m.expenseTshirt;

  return (
    <tr className={base}>
      <td className={`py-2.5 px-4 ${isTotal ? 'font-bold' : 'text-gray-700'}`}>
        {isTotal ? 'Итого' : m.label}
      </td>
      <Cell value={String(m.orderCount)} dim />
      <Cell value={fmt(m.totalRevenue)} />
      <Cell value={fmt(m.deliveryCost)} dim />
      <Cell value={fmt(m.netRevenue)} />
      <Cell value={totalExpenses > 0 ? fmt(totalExpenses) : '—'} dim={totalExpenses === 0} neg={totalExpenses > 0} />
      <Cell value={m.salaryPaid > 0 ? fmt(m.salaryPaid) : '—'} dim={m.salaryPaid === 0} neg={m.salaryPaid > 0} />
      <Cell value={fmt(m.profit)} highlight={m.profit > 0} neg={m.profit < 0} />
    </tr>
  );
}

// ── Add expense modal ─────────────────────────────────────────────────────────

function AddExpenseModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [category, setCategory] = useState<'PHOTO' | 'TSHIRT'>('TSHIRT');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (dto: CreateExpenseDto) => expensesApi.create(dto),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseInt(amount, 10);
    if (!a || a <= 0) { setError('Введите корректную сумму'); return; }
    mutation.mutate({ category, amount: a, note: note.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4">Новый расходный ордер</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <div className="flex gap-2">
              {(['TSHIRT', 'PHOTO'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    category === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₽)</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Примечание <span className="text-gray-400">(необязательно)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: закупка футболок 50 шт."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Expense list ──────────────────────────────────────────────────────────────

function ExpenseList({ year }: { year: number }) {
  const qc = useQueryClient();
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', year],
    queryFn: () => expensesApi.getAll(year),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['expenses', year] }),
  });

  if (isLoading) return <div className="text-gray-400 text-sm py-4 text-center">Загрузка...</div>;
  if (expenses.length === 0)
    return <div className="text-gray-400 text-sm py-4 text-center">Нет расходных ордеров за {year} год</div>;

  return (
    <div className="space-y-1">
      {expenses.map((exp: ExpenseOrder) => (
        <div
          key={exp.id}
          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group"
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                exp.category === 'TSHIRT'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {CATEGORY_LABEL[exp.category]}
            </span>
            <div>
              <span className="font-semibold text-sm tabular-nums">{fmt(exp.amount)}</span>
              {exp.note && <span className="text-gray-500 text-sm ml-2">{exp.note}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{fmtDate(exp.createdAt)}</span>
            <button
              onClick={() => deleteMutation.mutate(exp.id)}
              disabled={deleteMutation.isPending}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition-opacity disabled:opacity-30"
            >
              удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const qc = useQueryClient();

  const { data: years = [] } = useQuery({
    queryKey: ['report-years'],
    queryFn: () => reportsApi.getYears(),
  });

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['monthly-report', year],
    queryFn: () => reportsApi.getMonthly(year),
    staleTime: 30_000,
  });

  const totalExpenses = report
    ? report.totals.expensePhoto + report.totals.expenseTshirt
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <a href="/crm" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
            ← Заказы
          </a>
          <h1 className="text-lg font-bold text-gray-900">Финансовый отчёт</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => setShowAddExpense(true)}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Расходный ордер
          </button>
          <a href="/crm/salary" className="text-blue-600 hover:underline">Зарплата</a>
          <a href="/crm/users" className="text-gray-500 hover:text-gray-700">Пользователи</a>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Year selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Год:</span>
          <div className="flex gap-2">
            {(years.length > 0 ? years : [currentYear]).map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  y === year
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Заказов', value: String(report.totals.orderCount), color: '' },
              { label: 'Выручка', value: fmt(report.totals.totalRevenue), color: '' },
              { label: 'Чистая', value: fmt(report.totals.netRevenue), color: '' },
              {
                label: 'Расходы',
                value: totalExpenses > 0 ? fmt(totalExpenses) : '—',
                color: totalExpenses > 0 ? 'text-red-600' : '',
              },
              { label: 'ЗП выплачено', value: report.totals.salaryPaid > 0 ? fmt(report.totals.salaryPaid) : '—', color: report.totals.salaryPaid > 0 ? 'text-red-600' : '' },
            ].map((c) => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color || 'text-gray-900'}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Profit highlight */}
        {report && (
          <div
            className={`rounded-xl p-4 flex items-center justify-between ${
              report.totals.profit >= 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <span className={`text-sm font-medium ${report.totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Прибыль за {year} год
            </span>
            <span className={`text-2xl font-bold tabular-nums ${report.totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(report.totals.profit)}
            </span>
          </div>
        )}

        {/* Monthly table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">Загрузка...</div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-500">Ошибка загрузки</div>
          ) : !report ? null : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="py-3 px-4 text-left">Месяц</th>
                    <th className="py-3 px-3 text-right">Заказов</th>
                    <th className="py-3 px-3 text-right">Выручка</th>
                    <th className="py-3 px-3 text-right">Доставка</th>
                    <th className="py-3 px-3 text-right">Чистая</th>
                    <th className="py-3 px-3 text-right">Расходы</th>
                    <th className="py-3 px-3 text-right">ЗП</th>
                    <th className="py-3 px-3 text-right">Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((m) => (
                    <MonthRow key={m.month} m={m} />
                  ))}
                  <MonthRow m={{ month: 0, label: 'Итого', ...report.totals }} isTotal />
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Прибыль = Чистая выручка (без доставки) − Расходные ордера − Зарплата выплаченная.
          Учитываются все заказы кроме LEAD и CANCELLED.
        </p>

        {/* Expense orders list */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Расходные ордера — {year}</h2>
            <button
              onClick={() => setShowAddExpense(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              + Добавить
            </button>
          </div>
          <ExpenseList
            key={year}
            year={year}
          />
        </div>
      </div>

      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ['monthly-report', year] });
            void qc.invalidateQueries({ queryKey: ['expenses', year] });
          }}
        />
      )}
    </div>
  );
}
