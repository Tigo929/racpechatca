import { useState, useMemo } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaryApi } from '../api/salary';
import type { ExecutorSalaryData, AccrualBrief, PaymentByAccrualsResult } from '../types/index';
import { getErrorMessage } from '../utils/get-error-message';
import { formatCurrency as fmt, formatDate as fmtDate } from '../utils/format';
import { printReceipt } from '../features/salary/receipt';

// ── Executor list item ────────────────────────────────────────────────────────

function ExecutorListItem({
  ex,
  active,
  onClick,
}: {
  ex: ExecutorSalaryData;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold flex items-center gap-1.5 min-w-0">
          <span className="truncate">{ex.username}</span>
          {ex.role === 'ORDER_MANAGER' && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
                active ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-700'
              }`}
              title="Менеджер по оформлению"
            >
              менеджер
            </span>
          )}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
            active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
          title="Всего заказов с начислением"
        >
          {ex.pendingAccruals.length + ex.closedAccruals.length} зак.
        </span>
      </div>
      <div className={`text-sm mt-0.5 ${active ? 'text-blue-200' : 'text-gray-500'}`}>
        {ex.ratePercent ? `${ex.ratePercent}%` : 'ставка не задана'} ·{' '}
        {ex.totalDebt > 0 ? (
          <span className={active ? 'text-yellow-300 font-semibold' : 'text-orange-600 font-semibold'}>
            долг {fmt(ex.totalDebt)}
          </span>
        ) : (
          <span className={active ? 'text-blue-200' : 'text-green-600'}>закрыт</span>
        )}
      </div>
    </button>
  );
}

// ── Accrual row ───────────────────────────────────────────────────────────────

function AccrualRow({
  accrual,
  checked,
  onChange,
}: {
  accrual: AccrualBrief;
  checked: boolean;
  onChange: (id: string, v: boolean) => void;
}) {
  const isPaid = accrual.status === 'PAID' || accrual.status === 'SETTLED';
  return (
    <tr className={`border-b border-gray-100 ${isPaid ? 'opacity-50' : 'hover:bg-gray-50'}`}>
      <td className="py-2.5 pl-4 pr-2 w-8">
        {!isPaid && (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(accrual.id, e.target.checked)}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
        )}
      </td>
      <td className="py-2.5 px-3 font-mono text-sm font-medium">
        <div className="flex items-center gap-1.5">
          <span>{accrual.orderNumber}</span>
          {accrual.urlCommunication && (
            <a
              href={accrual.urlCommunication}
              target="_blank"
              rel="noreferrer"
              title={accrual.communicationPlatform ?? 'Ссылка на общение'}
              className="text-blue-400 hover:text-blue-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3 text-sm text-gray-500">{fmtDate(accrual.completedAt)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums">{fmt(accrual.salaryBase)}</td>
      <td className="py-2.5 px-3 text-right text-gray-400 text-xs">
        {(accrual.rateBasisPoints / 100).toFixed(0)}%
      </td>
      <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
        {fmt(accrual.salaryAmount)}
        {accrual.kind === 'MANAGER' && (accrual.designBase ?? 0) > 0 && (
          <div
            className="text-[10px] font-normal text-fuchsia-500"
            title={`Включает премию за дизайн: ${fmt(accrual.designBase ?? 0)} × ${((accrual.designRateBasisPoints ?? 0) / 100).toFixed(0)}%`}
          >
            вкл. дизайн
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 pr-4 text-right">
        {isPaid ? (
          <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">
            оплачено
          </span>
        ) : (
          <span className="text-orange-700 font-semibold tabular-nums">{fmt(accrual.debt)}</span>
        )}
      </td>
    </tr>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function ExecutorDetail({
  executor,
  onPaymentDone,
}: {
  executor: ExecutorSalaryData;
  onPaymentDone: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [paidResult, setPaidResult] = useState<PaymentByAccrualsResult | null>(null);
  const [error, setError] = useState('');

  const pending = executor.pendingAccruals;
  const allRows: AccrualBrief[] = [
    ...pending,
    ...executor.closedAccruals.map((c) => ({ ...c, debt: 0, salaryBase: 0, rateBasisPoints: 0 })),
  ].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

  const selectedTotal = useMemo(
    () => pending.filter((a) => selected.has(a.id)).reduce((s, a) => s + a.debt, 0),
    [pending, selected],
  );

  const toggleAll = () =>
    setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((a) => a.id)));

  const toggle = (id: string, v: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  const mutation = useMutation({
    mutationFn: () =>
      salaryApi.createPaymentByAccruals({
        executorId: executor.id,
        accrualIds: Array.from(selected),
        note: note.trim() || undefined,
      }),
    onSuccess: (result) => {
      setPaidResult(result);
      setSelected(new Set());
      setConfirm(false);
      setNote('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['salary-summary'] });
      onPaymentDone();
    },
    onError: (e) => { setError(getErrorMessage(e)); setConfirm(false); },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{executor.username}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Ставка: <strong>{executor.ratePercent ?? '—'}%</strong>
            {' · '}Долг:{' '}
            <strong className={executor.totalDebt > 0 ? 'text-orange-600' : 'text-green-600'}>
              {fmt(executor.totalDebt)}
            </strong>
            {' · '}Всего выплачено: <strong>{fmt(executor.totalPaid)}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Заказов всего:{' '}
            <strong className="text-gray-900">
              {pending.length + executor.closedAccruals.length}
            </strong>
            {' · '}к оплате: <strong className="text-orange-600">{pending.length}</strong>
            {' · '}оплачено: <strong className="text-green-600">{executor.closedAccruals.length}</strong>
          </p>
        </div>
        {pending.length > 0 && (
          <button onClick={toggleAll} className="text-sm text-blue-600 hover:underline">
            {selected.size === pending.length ? 'Снять все' : 'Выбрать все'}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
        {allRows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Начислений нет
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide sticky top-0">
                <th className="py-2.5 pl-4 w-8" />
                <th className="py-2.5 px-3 text-left">Заказ</th>
                <th className="py-2.5 px-3 text-left">Дата</th>
                <th className="py-2.5 px-3 text-right">База (без дост.)</th>
                <th className="py-2.5 px-3 text-right">%</th>
                <th className="py-2.5 px-3 text-right">ЗП</th>
                <th className="py-2.5 px-3 pr-4 text-right">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((a) => (
                <AccrualRow
                  key={a.id}
                  accrual={a}
                  checked={selected.has(a.id)}
                  onChange={toggle}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {(pending.length > 0 || paidResult) && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {paidResult && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-700 text-sm font-medium">
                ✓ Выплачено {fmt(paidResult.totalAmount)} — {paidResult.accruals.length} заказ(а)
              </span>
              <button
                onClick={() => printReceipt(executor, paidResult)}
                className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Печать / PDF
              </button>
            </div>
          )}

          {pending.length > 0 && (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Примечание (необязательно)"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-right shrink-0 min-w-[90px]">
                <div className="text-xs text-gray-400">Выбрано: {selected.size}</div>
                <div className="font-bold text-gray-900 tabular-nums">{fmt(selectedTotal)}</div>
              </div>
              <button
                disabled={selected.size === 0 || mutation.isPending}
                onClick={() => setConfirm(true)}
                className="shrink-0 bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? 'Выплата...' : 'Выплатить'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-sm">
            <h3 className="font-bold text-lg mb-3">Подтвердите выплату</h3>
            <div className="space-y-1 text-sm text-gray-600 mb-5">
              <p>Исполнитель: <strong>{executor.username}</strong></p>
              <p>Заказов: <strong>{selected.size}</strong></p>
              <p>Сумма: <strong className="text-blue-600 text-base">{fmt(selectedTotal)}</strong></p>
              {note && <p>Примечание: {note}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalaryPage() {
  const { data: executors = [], isLoading, error, refetch } = useQuery({
    queryKey: ['salary-summary'],
    queryFn: () => salaryApi.getSummary(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => executors.find((e) => e.id === selectedId) ?? null,
    [executors, selectedId],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Ошибка загрузки
      </div>
    );
  }

  const active = executors.filter((e) => e.isActive);
  const withDebt = active.filter((e) => e.totalDebt > 0);
  const settled = active.filter((e) => e.totalDebt === 0);
  const inactive = executors.filter((e) => !e.isActive && e.totalDebt > 0);

  return (
    <AppShell title="Зарплата сотрудников" subtitle="Исполнители и менеджеры по оформлению">
      {/* На мобильном список исполнителей сверху, детали под ним;
          с md — привычные две колонки. */}
      <div className="flex flex-col md:flex-row bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Left panel */}
        <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto p-3 max-h-56 md:max-h-[70vh]">
          {executors.length === 0 ? (
            <p className="text-gray-400 text-sm p-4">Исполнителей нет</p>
          ) : (
            <>
              {withDebt.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
                    Есть долг
                  </p>
                  <div className="space-y-0.5">
                    {withDebt.map((ex) => (
                      <ExecutorListItem
                        key={ex.id}
                        ex={ex}
                        active={ex.id === selectedId}
                        onClick={() => setSelectedId(ex.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {settled.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5">
                    Долг погашен
                  </p>
                  <div className="space-y-0.5">
                    {settled.map((ex) => (
                      <ExecutorListItem
                        key={ex.id}
                        ex={ex}
                        active={ex.id === selectedId}
                        onClick={() => setSelectedId(ex.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {inactive.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-red-300 uppercase tracking-wider px-2 mb-1.5">
                    Деактивированы (долг)
                  </p>
                  <div className="space-y-0.5">
                    {inactive.map((ex) => (
                      <ExecutorListItem
                        key={ex.id}
                        ex={ex}
                        active={ex.id === selectedId}
                        onClick={() => setSelectedId(ex.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Right panel */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:max-h-[70vh]">
          {selected ? (
            <ExecutorDetail
              key={selected.id}
              executor={selected}
              onPaymentDone={() => void refetch()}
            />
          ) : (
            <div className="py-16 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-3">💼</div>
                <p className="text-lg font-medium">Выберите исполнителя</p>
                <p className="text-sm mt-1">для просмотра начислений и выплаты</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
