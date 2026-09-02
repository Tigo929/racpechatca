import { useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { AppShell } from '../components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Shirt, Image, ChevronDown, ChevronRight, Handshake } from 'lucide-react';
import { reportsApi } from '../api/reports';
import { expensesApi } from '../api/expenses';
import type { PnlMetrics, MonthData, ExpenseOrder, CreateExpenseDto, EnumExpenseCategory, WeeklyReport } from '../types/index';
import { EXPENSE_CATEGORY_LABELS } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';
import { formatCurrency as fmt, formatDate as fmtDate } from '../utils/format';

const MONTH_LABELS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTH_LABELS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Деньги, но «—» вместо «0 ₽» — чтобы пустые ячейки не шумели. */
const money = (n: number): string => (n !== 0 ? fmt(n) : '—');
/**
 * Себестоимость: деньги, ушедшие подрядчикам и на материалы. Оплачены
 * из денег клиента, не из кармана владельца, — поэтому отдельной колонкой,
 * а не в «Расходах» (вариант A по решению владельца).
 */
const cost = (m: PnlMetrics): number => m.cogs;

/**
 * Расходы бизнеса: только СВОИ деньги владельца — операционка плюс
 * НАЧИСЛЕННАЯ зарплата. Начисленная, а не выплаченная: месяц без выплат
 * иначе выглядит сверхприбыльным, хотя долг перед сотрудниками вырос.
 * Себестоимость (подрядчики, материалы) сюда НЕ входит — она своя колонка.
 */
const spent = (m: PnlMetrics): number => m.operatingExpenses + m.salaryAccrued;

// ── Таблица «период × продукты» ──────────────────────────────────────────────

function Cell({ value, dim, highlight, neg }: { value: string; dim?: boolean; highlight?: boolean; neg?: boolean }) {
  return <td className={`py-2.5 px-3 text-right tabular-nums ${dim ? 'text-gray-400' : ''} ${highlight ? 'font-bold text-green-700' : ''} ${neg ? 'text-red-600' : ''}`}>{value}</td>;
}

/**
 * Ячейка категории: оборот бледным, заработок — крупно.
 *
 * Раньше здесь стоял только оборот, и холсты показывали 6 828 ₽ при
 * реальном заработке 1 276 ₽. Главной должна быть та цифра, которая
 * остаётся владельцу, а оборот — справкой рядом.
 */
function ProductCell({ count, revenue, profit }: { count: number; revenue: number; profit: number }) {
  if (count === 0 && revenue === 0) return <td className="py-2.5 px-3 text-right text-gray-300">—</td>;
  return (
    <td className="py-2.5 px-3 text-right whitespace-nowrap">
      <div className="text-gray-400 text-xs tabular-nums">{count} шт · {fmt(revenue)}</div>
      <div className={`font-semibold tabular-nums ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(profit)}</div>
    </td>
  );
}

function PnlRow({ label, m, isTotal, onClick, selected }: { label: string; m: PnlMetrics; isTotal?: boolean; onClick?: () => void; selected?: boolean }) {
  const active = m.orderCount > 0 || spent(m) > 0 || cost(m) > 0;
  const base = isTotal ? 'bg-gray-50 font-bold border-t-2 border-gray-300' : `border-b border-gray-100 ${onClick ? 'cursor-pointer' : ''} ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`;
  return (
    <tr className={`${base} text-sm`} onClick={onClick}>
      <td className={`py-2.5 px-4 ${isTotal ? 'font-bold' : 'text-gray-700'}`}>{label}</td>
      <ProductCell count={m.photoCount} revenue={m.photoRevenue} profit={m.photoProfit} />
      <ProductCell count={m.tshirtCount} revenue={m.tshirtRevenue} profit={m.tshirtProfit} />
      <ProductCell count={m.canvasCount} revenue={m.canvasRevenue} profit={m.canvasProfit} />
      <Cell value={money(m.totalRevenue)} />
      <Cell value={money(cost(m))} dim={cost(m) === 0} />
      <Cell value={money(spent(m))} neg={spent(m) > 0} dim={spent(m) === 0} />
      <Cell value={active ? fmt(m.netProfit) : '—'} highlight={active && m.netProfit > 0} neg={m.netProfit < 0} />
    </tr>
  );
}

function PnlTable({ firstCol, rows, total, onRowClick, selectedKey }: { firstCol: string; rows: { key: string; label: string; m: PnlMetrics }[]; total?: PnlMetrics; onRowClick?: (key: string) => void; selectedKey?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 px-4 text-left">{firstCol}</th>
            <th className="py-3 px-3 text-right">
              <span className="inline-flex items-center gap-1 justify-end">
                <Camera size={12} /> Фото
              </span>
            </th>
            <th className="py-3 px-3 text-right">
              <span className="inline-flex items-center gap-1 justify-end">
                <Shirt size={12} /> Футболки
              </span>
            </th>
            <th className="py-3 px-3 text-right">
              <span className="inline-flex items-center gap-1 justify-end">
                <Image size={12} /> Холсты
              </span>
            </th>
            <th className="py-3 px-3 text-right">Выручка</th>
            <th className="py-3 px-3 text-right">Себестоимость</th>
            <th className="py-3 px-3 text-right">Расходы</th>
            <th className="py-3 px-3 text-right">Прибыль</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <PnlRow key={r.key} label={r.label} m={r.m} onClick={onRowClick ? () => onRowClick(r.key) : undefined} selected={selectedKey === r.key} />
          ))}
          {total && <PnlRow label="Итого" m={total} isTotal />}
        </tbody>
      </table>
    </div>
  );
}

// ── Структура расходов (за период) ────────────────────────────────────────────

function ExpenseStructure({ m, periodLabel }: { m: PnlMetrics; periodLabel: string }) {
  const items = [
    { label: 'Фотоматериалы', value: m.materialsPhoto, color: 'bg-sky-400' },
    {
      label: 'Футболки / печать',
      value: m.materialsTshirt,
      color: 'bg-violet-400',
    },
    {
      label: 'Подрядчик — холсты',
      value: m.canvasContractorCost,
      color: 'bg-cyan-400',
    },
    {
      label: 'Упаковка / доставка',
      value: m.deliverySupplies,
      color: 'bg-amber-400',
    },
    { label: 'Оборудование', value: m.equipment, color: 'bg-emerald-400' },
    { label: 'Реклама', value: m.marketing, color: 'bg-pink-400' },
    { label: 'Доля Гриши', value: m.partnerShare, color: 'bg-indigo-400' },
    {
      label: 'Вознаграждение партнёру',
      value: m.partnerReward,
      color: 'bg-teal-400',
    },
    { label: 'Прочее', value: m.other, color: 'bg-gray-400' },
    { label: 'Зарплата (начислено)', value: m.salaryAccrued, color: 'bg-rose-500' },
  ]
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Структура расходов — {periodLabel}</h2>
        <span className="text-sm font-semibold text-gray-700 tabular-nums">{total > 0 ? fmt(total) : '—'}</span>
      </div>
      {total === 0 ? (
        <p className="text-gray-400 text-sm">Расходов за {periodLabel} нет.</p>
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

/** Краткое «в плюсе / в минусе» + ключевые цифры месяца. */
function MonthSummary({ m, monthLabel }: { m: PnlMetrics; monthLabel: string }) {
  const positive = m.netProfit >= 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div className={`rounded-xl p-4 border ${positive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <p className={`text-xs uppercase tracking-wide mb-1 ${positive ? 'text-green-600' : 'text-red-600'}`}>
          {positive ? 'В плюсе' : 'В минусе'} · {monthLabel}
        </p>
        <p className={`text-2xl font-bold tabular-nums ${positive ? 'text-green-700' : 'text-red-700'}`}>{fmt(m.netProfit)}</p>
        <p className={`text-xs mt-0.5 ${positive ? 'text-green-600/80' : 'text-red-600/80'}`}>маржа {m.margin}%</p>
      </div>
      <StatCard label="Выручка" value={fmt(m.totalRevenue)} hint="оборот за месяц" />
      <StatCard label="Себестоимость" value={fmt(cost(m))} hint="подрядчики + материалы" />
      <StatCard label="Расходы" value={fmt(spent(m))} hint="ваши: зарплата, реклама" tone="neg" />
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
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseInt(amount, 10);
    if (!a || a <= 0) {
      setError('Введите корректную сумму');
      return;
    }
    mutation.mutate({ category, amount: a, note: note.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4">Новый расходный ордер</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as EnumExpenseCategory)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as EnumExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₽)</label>
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Примечание <span className="text-gray-400">(необязательно)</span>
            </label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: закуп футболок 50 шт." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
              Отмена
            </button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Expense list (расходные операции за месяц) ────────────────────────────────

function expenseCategoryLabel(exp: ExpenseOrder): string {
  if (exp.category === 'SALARY') return 'Зарплата';
  return EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category;
}

function expenseDetails(exp: ExpenseOrder): string | null {
  if (exp.kind === 'SALARY_PAYMENT') {
    const base = exp.salaryExecutor ? `Выплата: ${exp.salaryExecutor.username}` : 'Выплата зарплаты';
    return exp.note ? `${base} · ${exp.note}` : base;
  }
  return exp.note ?? null;
}

/** «(заработок партнёра 411 ₽)» → «заработок партнёра 411 ₽»; иначе — вся заметка. */
function partnerProfitText(note?: string | null): string {
  if (!note) return '';
  return note.match(/\(([^)]+)\)/)?.[1] ?? note;
}

function ExpenseList({ year, month }: { year: number; month: number }) {
  const qc = useQueryClient();
  const [partnerOpen, setPartnerOpen] = useState(false);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ['expenses', year],
    queryFn: () => expensesApi.getAll(year),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['expenses', year] }),
  });

  // Только операции выбранного месяца.
  const expenses = all.filter((e: ExpenseOrder) => new Date(e.createdAt).getMonth() === month - 1);

  if (isLoading) return <div className="text-gray-400 text-sm py-4 text-center">Загрузка...</div>;
  if (expenses.length === 0) return <div className="text-gray-400 text-sm py-4 text-center">Нет расходных операций за {MONTH_LABELS_FULL[month - 1]}</div>;

  // Вознаграждение партнёру — авто-расходы по каждому оплаченному футболочному
  // заказу. Сворачиваем их в одну строку с разбивкой по заказам, чтобы список
  // не тонул в десятках однотипных строк.
  const partnerRewards = expenses.filter((e) => e.category === 'PARTNER_REWARD');
  const others = expenses.filter((e) => e.category !== 'PARTNER_REWARD');
  const partnerTotal = partnerRewards.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-1">
      {partnerRewards.length > 0 && (
        <div className="rounded-lg border border-teal-100 bg-teal-50/40 overflow-hidden">
          <button
            onClick={() => setPartnerOpen((v) => !v)}
            className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-teal-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {partnerOpen ? <ChevronDown size={15} className="text-teal-600" /> : <ChevronRight size={15} className="text-teal-600" />}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 inline-flex items-center gap-1">
                <Handshake size={12} /> Вознаграждение партнёру
              </span>
              <span className="text-gray-500 text-sm">{partnerRewards.length} зак.</span>
            </div>
            <span className="font-semibold text-sm tabular-nums">{fmt(partnerTotal)}</span>
          </button>
          {partnerOpen && (
            <div className="border-t border-teal-100 divide-y divide-teal-50/70">
              {partnerRewards.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between py-2 px-3 pl-9 text-sm">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold tabular-nums">
                      {exp.order ? `#${exp.order.numberOrder}` : 'заказ'}
                    </span>
                    <span className="text-gray-500">{partnerProfitText(exp.note)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold tabular-nums">{fmt(exp.amount)}</span>
                    <span className="text-xs text-gray-400">{fmtDate(exp.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {others.map((exp: ExpenseOrder) => {
        const isSalary = exp.kind === 'SALARY_PAYMENT';
        const details = expenseDetails(exp);
        return (
          <div key={exp.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isSalary ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-gray-100 text-gray-700'}`}>{expenseCategoryLabel(exp)}</span>
              <div>
                <span className="font-semibold text-sm tabular-nums">{fmt(exp.amount)}</span>
                {details && <span className="text-gray-500 text-sm ml-2">{details}</span>}
                {isSalary && <span className="text-gray-400 text-xs ml-2">выдал: {exp.createdBy.username}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{fmtDate(exp.createdAt)}</span>
              {!isSalary && (
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
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Выбранный период держится: отчёты смотрят подряд по нескольким разделам,
  // и каждый раз заново выставлять месяц — лишняя работа.
  const [year, setYear] = usePersistentState('reports-year', currentYear);
  const [month, setMonth] = usePersistentState('reports-month', now.getMonth() + 1);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const qc = useQueryClient();

  const { data: years = [] } = useQuery({
    queryKey: ['report-years'],
    queryFn: () => reportsApi.getYears(),
  });

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['monthly-report', year],
    queryFn: () => reportsApi.getMonthly(year),
    staleTime: 30_000,
  });

  const { data: weekly } = useQuery<WeeklyReport>({
    queryKey: ['weekly-report', year, month],
    queryFn: () => reportsApi.getWeekly(year, month),
    staleTime: 30_000,
  });

  const monthData: MonthData | undefined = report?.months[month - 1];

  const refetchAll = () => {
    void qc.invalidateQueries({ queryKey: ['monthly-report', year] });
    void qc.invalidateQueries({ queryKey: ['weekly-report', year] });
    void qc.invalidateQueries({ queryKey: ['expenses', year] });
  };

  return (
    <AppShell
      title="Финансовый отчёт"
      actions={
        <button onClick={() => setShowAddExpense(true)} className="px-3.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
          <span className="hidden sm:inline">+ Расходный ордер</span>
          <span className="sm:hidden">+ Расход</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Year selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Год:</span>
          <div className="flex gap-2">
            {(years.length > 0 ? years : [currentYear]).map((y) => (
              <button key={y} onClick={() => setYear(y)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${y === year ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'}`}>
                {y}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Загрузка...</div>
        ) : error || !report ? (
          <div className="flex items-center justify-center py-20 text-red-500">Ошибка загрузки</div>
        ) : (
          <>
            {/* Динамика по месяцам */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Динамика по месяцам — {year}</h2>
                <span className="text-xs text-gray-400">нажмите на месяц для детализации</span>
              </div>
              <PnlTable
                firstCol="Месяц"
                rows={report.months.map((m) => ({
                  key: String(m.month),
                  label: m.label,
                  m,
                }))}
                total={report.totals}
                onRowClick={(key) => setMonth(Number(key))}
                selectedKey={String(month)}
              />
              <div className="px-5 py-3 space-y-1.5">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Себестоимость</span> — деньги подрядчикам и на материалы: оплачены из денег клиента,
                  прошли насквозь. В «Расходы» они больше не попадают.{' '}
                  <span className="font-medium text-gray-700">Расходы</span> — только ваши деньги: зарплата, реклама, оборудование, упаковка.
                </p>
                <p className="text-xs text-gray-500">
                  Прибыль = выручка − себестоимость − расходы − начисленная зарплата + заработок на доставке. Заказ попадает в период по дате оплаты клиентом.
                </p>
                <p className="text-xs text-gray-400">
                  Футболки печатает: <span className="font-medium text-gray-600">{report.contractors.tshirt}</span> ·
                  холсты: <span className="font-medium text-gray-600">{report.contractors.canvas}</span>. Изменить имена — в Настройках.
                </p>
              </div>
            </div>

            {/* Детализация выбранного месяца */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-gray-900 mr-1">Месяц:</h2>
                {MONTH_LABELS_SHORT.map((label, idx) => (
                  <button key={idx} onClick={() => setMonth(idx + 1)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${month === idx + 1 ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {monthData && <MonthSummary m={monthData} monthLabel={MONTH_LABELS_FULL[month - 1]} />}

              <div className="grid lg:grid-cols-2 gap-6 items-start">
                {/* Понедельная разбивка */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Понедельная разбивка — {MONTH_LABELS_FULL[month - 1]}</h2>
                  </div>
                  {!weekly ? (
                    <div className="py-10 text-center text-gray-400 text-sm">Загрузка...</div>
                  ) : (
                    <PnlTable
                      firstCol="Неделя"
                      rows={weekly.weeks.map((w) => ({
                        key: String(w.weekNum),
                        label: `${w.displayStart}–${w.displayEnd}`,
                        m: w,
                      }))}
                      total={weekly.totals}
                    />
                  )}
                </div>

                {/* Структура расходов за месяц */}
                {monthData && <ExpenseStructure m={monthData} periodLabel={MONTH_LABELS_FULL[month - 1]} />}
              </div>

              {/* Расходные операции за месяц */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Расходные операции — {MONTH_LABELS_FULL[month - 1]}</h2>
                  <button onClick={() => setShowAddExpense(true)} className="text-sm text-blue-600 hover:underline">
                    + Добавить
                  </button>
                </div>
                <ExpenseList year={year} month={month} />
              </div>
            </div>
          </>
        )}
      </div>

      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} onSuccess={refetchAll} />}
    </AppShell>
  );
}
