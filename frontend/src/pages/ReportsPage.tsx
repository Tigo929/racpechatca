import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import { expensesApi } from '../api/expenses';
import type { MonthData, ExpenseOrder, CreateExpenseDto, EnumExpenseCategory, FunnelReport, WeekData, WeeklyReport } from '../types/index';
import { EXPENSE_CATEGORY_LABELS } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';
import { formatCurrency as fmt, formatDate as fmtDate } from '../utils/format';

// ── Month table cell ──────────────────────────────────────────────────────────

function Cell({
  value,
  dim,
  highlight,
  neg,
}: {
  value: string;
  dim?: boolean;
  highlight?: boolean;
  neg?: boolean;
}) {
  return (
    <td
      className={`py-2.5 px-3 text-right tabular-nums ${
        dim ? 'text-gray-400' : ''
      } ${highlight ? 'font-bold text-green-700' : ''} ${neg ? 'text-red-600' : ''}`}
    >
      {value}
    </td>
  );
}

// ── Month table row ───────────────────────────────────────────────────────────

function MonthRow({ m, isTotal }: { m: MonthData & { label?: string }; isTotal?: boolean }) {
  const base = isTotal
    ? 'bg-gray-50 font-bold border-t-2 border-gray-300 text-sm'
    : 'border-b border-gray-100 hover:bg-gray-50 text-sm';

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

// ── Week table row ────────────────────────────────────────────────────────────

const MONTH_LABELS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTH_LABELS_FULL  = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function WeekRow({ w, isTotal }: { w: WeekData & { label?: string }; isTotal?: boolean }) {
  const base = isTotal
    ? 'bg-gray-50 font-bold border-t-2 border-gray-300 text-sm'
    : 'border-b border-gray-100 hover:bg-gray-50 text-sm';
  return (
    <tr className={base}>
      <td className={`py-2.5 px-4 ${isTotal ? 'font-bold' : 'text-gray-700'}`}>
        {isTotal ? 'Итого' : `Нед. ${w.weekNum} (${w.displayStart} — ${w.displayEnd})`}
      </td>
      <Cell value={String(w.orderCount)} dim />
      <td className="py-2.5 px-3 text-right text-xs text-gray-400 tabular-nums">
        {isTotal ? '' : `${w.photoCount} / ${w.tshirtCount}`}
      </td>
      <Cell value={fmt(w.totalRevenue)} />
      <Cell value={w.expenses > 0 ? fmt(w.expenses) : '—'} dim={w.expenses === 0} neg={w.expenses > 0} />
      <Cell value={fmt(w.profit)} highlight={w.profit > 0} neg={w.profit < 0} />
    </tr>
  );
}

// ── Weekly report section ─────────────────────────────────────────────────────

function WeeklySection({ year }: { year: number }) {
  const now = new Date();
  const [month, setMonth] = useState(
    year === now.getFullYear() ? now.getMonth() + 1 : 1,
  );

  const { data: report, isLoading } = useQuery<WeeklyReport>({
    queryKey: ['weekly-report', year, month],
    queryFn: () => reportsApi.getWeekly(year, month),
    staleTime: 30_000,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Еженедельная сводка</h2>
        <div className="flex flex-wrap gap-1.5">
          {MONTH_LABELS_SHORT.map((label, idx) => (
            <button
              key={idx}
              onClick={() => setMonth(idx + 1)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                month === idx + 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Загрузка...</div>
      ) : !report ? null : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">{MONTH_LABELS_FULL[report.month - 1]} {report.year}</th>
                  <th className="py-3 px-3 text-right">Заказов</th>
                  <th className="py-3 px-3 text-right">Фото / Футб</th>
                  <th className="py-3 px-3 text-right">Сумма</th>
                  <th className="py-3 px-3 text-right">Расходы</th>
                  <th className="py-3 px-3 text-right">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {report.weeks.map((w) => <WeekRow key={w.weekNum} w={w} />)}
                <WeekRow
                  w={{ weekNum: 0, displayStart: '', displayEnd: '', ...report.totals }}
                  isTotal
                />
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 px-5 py-3">
            Учитываются заказы со статусом NEW и выше (LEAD и CANCELLED не считаются). Недели по пн–вс.
          </p>
        </>
      )}
    </div>
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
  const [category, setCategory] = useState<EnumExpenseCategory>('MATERIALS_TSHIRT');
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EnumExpenseCategory)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as EnumExpenseCategory[]).map((c) => (
                <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
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
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}
            </span>
            <div>
              <span className="font-semibold text-sm tabular-nums">{fmt(exp.amount)}</span>
              {exp.note && <span className="text-gray-500 text-sm ml-2">{exp.note}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{fmtDate(exp.createdAt)}</span>
            <button
              onClick={() => {
                if (window.confirm(`Удалить расходный ордер на ${fmt(exp.amount)}?`)) {
                  deleteMutation.mutate(exp.id);
                }
              }}
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

  const { data: funnel } = useQuery<FunnelReport>({
    queryKey: ['funnel-report', year],
    queryFn: () => reportsApi.getFunnel(year),
    staleTime: 60_000,
  });

  const totalExpenses = report
    ? report.totals.expensePhoto + report.totals.expenseTshirt + report.totals.expenseOther
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

        {/* Weekly breakdown */}
        <WeeklySection year={year} />

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

        {/* Воронка лидов */}
        {funnel && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Воронка заявок с сайта — {year}</h3>
            {funnel.totalLeads === 0 ? (
              <p className="text-gray-400 text-sm">Лидов с сайта за {year} год не поступало.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Лидов получено', value: funnel.totalLeads, color: 'bg-indigo-100 text-indigo-700' },
                    { label: `Конвертировано (${funnel.conversionRate}%)`, value: funnel.totalConverted, color: 'bg-amber-100 text-amber-700' },
                    { label: `Дошли до оплаты (${funnel.closeRate}%)`, value: funnel.paidFromLeads, color: 'bg-emerald-100 text-emerald-700' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-lg px-4 py-3 ${s.color}`}>
                      <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                      <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left pb-2 text-gray-400 font-medium">Месяц</th>
                        {funnel.byMonth.filter(m => m.leads > 0 || m.converted > 0).map(m => (
                          <th key={m.month} className="text-center pb-2 text-gray-400 font-medium px-2">{m.label.slice(0, 3)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 text-gray-500">Лидов</td>
                        {funnel.byMonth.filter(m => m.leads > 0 || m.converted > 0).map(m => (
                          <td key={m.month} className="text-center py-1.5 font-semibold tabular-nums text-indigo-600">{m.leads}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 text-gray-500">Конвертировано</td>
                        {funnel.byMonth.filter(m => m.leads > 0 || m.converted > 0).map(m => (
                          <td key={m.month} className="text-center py-1.5 font-semibold tabular-nums text-emerald-600">{m.converted}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
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
