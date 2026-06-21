import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '../api/reports';
import { expensesApi } from '../api/expenses';
import type {
  PnlMetrics,
  ExpenseOrder,
  CreateExpenseDto,
  EnumExpenseCategory,
  FunnelReport,
  WeeklyReport,
} from '../types/index';
import { EXPENSE_CATEGORY_LABELS } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';
import { formatCurrency as fmt, formatDate as fmtDate } from '../utils/format';

const MONTH_LABELS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTH_LABELS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Деньги, но «—» вместо «0 ₽» — чтобы пустые ячейки не шумели. */
const money = (n: number): string => (n !== 0 ? fmt(n) : '—');
/** Расходная строка со знаком минус. */
const minus = (n: number): string => (n > 0 ? `−${fmt(n)}` : '—');

// ── P&L statement (отчёт о прибылях) ──────────────────────────────────────────

function StatementRow({
  label, value, indent, strong, divider, accent,
}: {
  label: string;
  value: string;
  indent?: boolean;
  strong?: boolean;
  divider?: boolean;
  accent?: 'red' | 'none';
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${divider ? 'border-t border-gray-200 mt-1 pt-2.5' : ''}`}>
      <span className={
        indent ? 'pl-5 text-sm text-gray-400'
        : strong ? 'font-semibold text-gray-900'
        : 'text-gray-600'
      }>
        {label}
      </span>
      <span className={`tabular-nums ${indent ? 'text-sm text-gray-400' : ''} ${strong ? 'font-bold text-gray-900' : ''} ${accent === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}

function PnlStatement({ m, periodLabel }: { m: PnlMetrics; periodLabel: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
        <h2 className="font-semibold text-gray-900">Отчёт о прибылях — {periodLabel}</h2>
        <span className="text-xs text-gray-400">по завершённым заказам (отправлено / оплачено)</span>
      </div>

      <div className="text-sm">
        {/* Выручка */}
        <StatementRow label="Выручка (оборот)" value={fmt(m.totalRevenue)} strong />
        {m.photoRevenue > 0 && <StatementRow indent label="Фото" value={fmt(m.photoRevenue)} />}
        {m.tshirtRevenue > 0 && <StatementRow indent label="Футболки" value={fmt(m.tshirtRevenue)} />}
        <StatementRow label="Доставка (транзит)" value={minus(m.deliveryCost)} accent="red" />
        <StatementRow label="Чистая выручка" value={fmt(m.netRevenue)} strong divider />

        {/* Себестоимость */}
        <StatementRow label="Себестоимость материалов" value={minus(m.cogs)} accent="red" />
        {m.materialsPhoto > 0 && <StatementRow indent label="Фотоматериалы" value={minus(m.materialsPhoto)} />}
        {m.materialsTshirt > 0 && <StatementRow indent label="Футболки / печать" value={minus(m.materialsTshirt)} />}
        <StatementRow
          label={`Валовая прибыль${m.netRevenue > 0 ? `  ·  ${Math.round((m.grossProfit / m.netRevenue) * 100)}%` : ''}`}
          value={fmt(m.grossProfit)} strong divider
        />

        {/* Операционные + ЗП */}
        <StatementRow label="Операционные расходы" value={minus(m.operatingExpenses)} accent="red" />
        {m.deliverySupplies > 0 && <StatementRow indent label="Упаковка / доставка" value={minus(m.deliverySupplies)} />}
        {m.equipment > 0 && <StatementRow indent label="Оборудование" value={minus(m.equipment)} />}
        {m.marketing > 0 && <StatementRow indent label="Реклама" value={minus(m.marketing)} />}
        {m.other > 0 && <StatementRow indent label="Прочее" value={minus(m.other)} />}
        <StatementRow label="Зарплата выплаченная" value={minus(m.salaryPaid)} accent="red" />

        {/* Итог */}
        <div className="flex items-center justify-between gap-4 mt-2 pt-3 border-t-2 border-gray-300">
          <span className="font-bold text-gray-900">Чистая прибыль</span>
          <div className="text-right">
            <div className={`text-xl font-bold tabular-nums ${m.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(m.netProfit)}</div>
            <div className="text-xs text-gray-400">маржа {m.margin}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Период-таблица (месяцы / недели) ──────────────────────────────────────────

function Cell({ value, dim, highlight, neg }: { value: string; dim?: boolean; highlight?: boolean; neg?: boolean }) {
  return (
    <td className={`py-2.5 px-3 text-right tabular-nums ${dim ? 'text-gray-400' : ''} ${highlight ? 'font-bold text-green-700' : ''} ${neg ? 'text-red-600' : ''}`}>
      {value}
    </td>
  );
}

function PnlRow({ label, m, isTotal }: { label: string; m: PnlMetrics; isTotal?: boolean }) {
  const base = isTotal
    ? 'bg-gray-50 font-bold border-t-2 border-gray-300 text-sm'
    : 'border-b border-gray-100 hover:bg-gray-50 text-sm';
  const active = m.orderCount > 0 || m.totalExpenses > 0 || m.salaryPaid > 0;
  return (
    <tr className={base}>
      <td className={`py-2.5 px-4 ${isTotal ? 'font-bold' : 'text-gray-700'}`}>{label}</td>
      <Cell value={active ? String(m.orderCount) : '—'} dim />
      <Cell value={money(m.totalRevenue)} />
      <Cell value={money(m.netRevenue)} dim />
      <Cell value={money(m.totalExpenses)} neg={m.totalExpenses > 0} dim={m.totalExpenses === 0} />
      <Cell value={money(m.salaryPaid)} neg={m.salaryPaid > 0} dim={m.salaryPaid === 0} />
      <Cell value={active ? fmt(m.netProfit) : '—'} highlight={active && m.netProfit > 0} neg={m.netProfit < 0} />
      <td className={`py-2.5 px-3 text-right tabular-nums text-xs ${m.margin > 0 ? 'text-green-600' : m.margin < 0 ? 'text-red-500' : 'text-gray-400'}`}>
        {active && m.totalRevenue > 0 ? `${m.margin}%` : '—'}
      </td>
    </tr>
  );
}

function PnlTable({ firstCol, rows, total }: { firstCol: string; rows: { key: string; label: string; m: PnlMetrics }[]; total: PnlMetrics }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 px-4 text-left">{firstCol}</th>
            <th className="py-3 px-3 text-right">Заказов</th>
            <th className="py-3 px-3 text-right">Оборот</th>
            <th className="py-3 px-3 text-right">Чистая</th>
            <th className="py-3 px-3 text-right">Расходы</th>
            <th className="py-3 px-3 text-right">ЗП</th>
            <th className="py-3 px-3 text-right">Прибыль</th>
            <th className="py-3 px-3 text-right">Маржа</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <PnlRow key={r.key} label={r.label} m={r.m} />)}
          <PnlRow label="Итого" m={total} isTotal />
        </tbody>
      </table>
    </div>
  );
}

// ── Структура расходов (за период) ────────────────────────────────────────────

function ExpenseStructure({ m }: { m: PnlMetrics }) {
  const items = [
    { label: 'Фотоматериалы', value: m.materialsPhoto, color: 'bg-sky-400' },
    { label: 'Футболки / печать', value: m.materialsTshirt, color: 'bg-violet-400' },
    { label: 'Упаковка / доставка', value: m.deliverySupplies, color: 'bg-amber-400' },
    { label: 'Оборудование', value: m.equipment, color: 'bg-emerald-400' },
    { label: 'Реклама', value: m.marketing, color: 'bg-pink-400' },
    { label: 'Прочее', value: m.other, color: 'bg-gray-400' },
    { label: 'Зарплата', value: m.salaryPaid, color: 'bg-rose-500' },
  ].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);

  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Структура расходов</h2>
        <span className="text-sm font-semibold text-gray-700 tabular-nums">{total > 0 ? fmt(total) : '—'}</span>
      </div>
      {total === 0 ? (
        <p className="text-gray-400 text-sm">Расходов за период нет.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((i) => {
            const pct = Math.round((i.value / total) * 100);
            return (
              <div key={i.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{i.label}</span>
                  <span className="text-gray-700 tabular-nums">
                    {fmt(i.value)} <span className="text-gray-400">· {pct}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${i.color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── KPI карточки ──────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'neg' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${tone === 'neg' ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Weekly section ────────────────────────────────────────────────────────────

function WeeklySection({ year }: { year: number }) {
  const now = new Date();
  const [month, setMonth] = useState(year === now.getFullYear() ? now.getMonth() + 1 : 1);

  const { data: report, isLoading } = useQuery<WeeklyReport>({
    queryKey: ['weekly-report', year, month],
    queryFn: () => reportsApi.getWeekly(year, month),
    staleTime: 30_000,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Понедельная разбивка</h2>
        <div className="flex flex-wrap gap-1.5">
          {MONTH_LABELS_SHORT.map((label, idx) => (
            <button
              key={idx}
              onClick={() => setMonth(idx + 1)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                month === idx + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
          {/* Сводка за месяц */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
            {[
              { label: 'Прибыль', value: fmt(report.totals.netProfit), tone: report.totals.netProfit >= 0 ? 'text-green-700' : 'text-red-600' },
              { label: 'Оборот', value: fmt(report.totals.totalRevenue), tone: 'text-gray-900' },
              { label: 'Заказов', value: String(report.totals.orderCount), tone: 'text-gray-900' },
              { label: 'Маржа', value: `${report.totals.margin}%`, tone: report.totals.margin >= 0 ? 'text-gray-900' : 'text-red-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white px-4 py-3">
                <p className="text-xs text-gray-400">{s.label} · {MONTH_LABELS_FULL[report.month - 1]}</p>
                <p className={`text-lg font-bold tabular-nums ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <PnlTable
            firstCol={`${MONTH_LABELS_FULL[report.month - 1]} ${report.year}`}
            rows={report.weeks.map((w) => ({
              key: String(w.weekNum),
              label: `Нед. ${w.weekNum} (${w.displayStart} — ${w.displayEnd})`,
              m: w,
            }))}
            total={report.totals}
          />
          <p className="text-xs text-gray-400 px-5 py-3">Недели по пн–вс, крайние обрезаны по границам месяца.</p>
        </>
      )}
    </div>
  );
}

// ── Add expense modal ─────────────────────────────────────────────────────────

function AddExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
              type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Примечание <span className="text-gray-400">(необязательно)</span>
            </label>
            <input
              type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: закупка футболок 50 шт."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
              Отмена
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
        <div key={exp.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
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

  const t = report?.totals;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <a href="/crm" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">← Заказы</a>
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
                  y === year ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Загрузка...</div>
        ) : error || !t || !report ? (
          <div className="flex items-center justify-center py-20 text-red-500">Ошибка загрузки</div>
        ) : (
          <>
            {/* Hero KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={`rounded-xl p-4 border ${t.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-xs uppercase tracking-wide mb-1 ${t.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Чистая прибыль</p>
                <p className={`text-2xl font-bold tabular-nums ${t.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(t.netProfit)}</p>
                <p className={`text-xs mt-0.5 ${t.netProfit >= 0 ? 'text-green-600/80' : 'text-red-600/80'}`}>маржа {t.margin}%</p>
              </div>
              <StatCard label="Выручка (оборот)" value={fmt(t.totalRevenue)} hint={`${t.orderCount} заказов`} />
              <StatCard label="Чистая выручка" value={fmt(t.netRevenue)} hint="после доставки" />
              <StatCard label="Расходы + ЗП" value={fmt(t.totalExpenses + t.salaryPaid)} hint="всё, что списано" tone="neg" />
            </div>

            {/* Доп. метрики */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 -mt-2 px-1">
              <span>Средний чек: <b className="text-gray-800 tabular-nums">{fmt(t.avgCheck)}</b></span>
              <span>Фото: <b className="text-gray-800">{t.photoCount}</b> на <b className="text-gray-800 tabular-nums">{fmt(t.photoRevenue)}</b></span>
              <span>Футболки: <b className="text-gray-800">{t.tshirtCount}</b> на <b className="text-gray-800 tabular-nums">{fmt(t.tshirtRevenue)}</b></span>
            </div>

            {/* P&L + структура расходов */}
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <PnlStatement m={t} periodLabel={`${year} год`} />
              <ExpenseStructure m={t} />
            </div>

            {/* Месячная динамика */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Динамика по месяцам — {year}</h2>
              </div>
              <PnlTable
                firstCol="Месяц"
                rows={report.months.map((m) => ({ key: String(m.month), label: m.label, m }))}
                total={t}
              />
            </div>

            {/* Понедельная разбивка */}
            <WeeklySection year={year} />

            <p className="text-xs text-gray-400">
              Учёт по завершённым заказам (статус «отправлено»/«оплачено»), по дате отправки.
              Доставка — транзит, в прибыль не входит. Чистая прибыль = чистая выручка − материалы − операционные расходы − зарплата.
            </p>

            {/* Расходные ордера */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Расходные ордера — {year}</h2>
                <button onClick={() => setShowAddExpense(true)} className="text-sm text-blue-600 hover:underline">+ Добавить</button>
              </div>
              <ExpenseList key={year} year={year} />
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
                      ].map((s) => (
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
                            {funnel.byMonth.filter((m) => m.leads > 0 || m.converted > 0).map((m) => (
                              <th key={m.month} className="text-center pb-2 text-gray-400 font-medium px-2">{m.label.slice(0, 3)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1.5 text-gray-500">Лидов</td>
                            {funnel.byMonth.filter((m) => m.leads > 0 || m.converted > 0).map((m) => (
                              <td key={m.month} className="text-center py-1.5 font-semibold tabular-nums text-indigo-600">{m.leads}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-1.5 text-gray-500">Конвертировано</td>
                            {funnel.byMonth.filter((m) => m.leads > 0 || m.converted > 0).map((m) => (
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
          </>
        )}
      </div>

      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ['monthly-report', year] });
            void qc.invalidateQueries({ queryKey: ['weekly-report', year] });
            void qc.invalidateQueries({ queryKey: ['expenses', year] });
          }}
        />
      )}
    </div>
  );
}
