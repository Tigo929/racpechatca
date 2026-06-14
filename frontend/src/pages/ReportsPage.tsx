import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/orders';
import type { MonthData } from '../types';

const fmt = (n: number) =>
  n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

const pct = (part: number, total: number) =>
  total === 0 ? '—' : `${((part / total) * 100).toFixed(1)}%`;

function Cell({ value, dim }: { value: string; dim?: boolean }) {
  return (
    <td className={`py-2.5 px-4 text-right tabular-nums ${dim ? 'text-gray-400' : ''}`}>
      {value}
    </td>
  );
}

function MonthRow({ m, isTotal }: { m: MonthData; isTotal?: boolean }) {
  const base = isTotal
    ? 'bg-gray-50 font-bold border-t-2 border-gray-300 text-sm'
    : 'border-b border-gray-100 hover:bg-gray-50 text-sm';
  return (
    <tr className={base}>
      <td className={`py-2.5 px-4 ${isTotal ? 'font-bold' : 'text-gray-700'}`}>
        {isTotal ? 'Итого' : m.label}
      </td>
      <Cell value={String(m.orderCount)} />
      <Cell value={fmt(m.totalRevenue)} />
      <Cell value={fmt(m.deliveryCost)} dim />
      <Cell value={fmt(m.netRevenue)} />
      <Cell value={pct(m.netRevenue, m.totalRevenue)} dim />
      <Cell value={String(m.photoCount)} dim />
      <Cell value={String(m.tshirtCount)} dim />
    </tr>
  );
}

export function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: years = [] } = useQuery({
    queryKey: ['report-years'],
    queryFn: () => reportsApi.getYears(),
  });

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['monthly-report', year],
    queryFn: () => reportsApi.getMonthly(year),
    staleTime: 60_000,
  });

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
          <a href="/crm/salary" className="text-blue-600 hover:underline">Зарплата</a>
          <a href="/crm/users" className="text-gray-500 hover:text-gray-700">Пользователи</a>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Year selector */}
        <div className="flex items-center gap-3 mb-6">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Заказов', value: String(report.totals.orderCount) },
              { label: 'Выручка', value: fmt(report.totals.totalRevenue) },
              { label: 'Чистая выручка', value: fmt(report.totals.netRevenue) },
              { label: '% чистой', value: pct(report.totals.netRevenue, report.totals.totalRevenue) },
            ].map((c) => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">Загрузка...</div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-500">
              Ошибка загрузки отчёта
            </div>
          ) : !report ? null : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">Месяц</th>
                  <th className="py-3 px-4 text-right">Заказов</th>
                  <th className="py-3 px-4 text-right">Выручка</th>
                  <th className="py-3 px-4 text-right">Доставка</th>
                  <th className="py-3 px-4 text-right">Чистая</th>
                  <th className="py-3 px-4 text-right">%</th>
                  <th className="py-3 px-4 text-right">Фото</th>
                  <th className="py-3 px-4 text-right">Футболки</th>
                </tr>
              </thead>
              <tbody>
                {report.months.map((m) => (
                  <MonthRow key={m.month} m={m} />
                ))}
                <MonthRow
                  m={{
                    month: 0,
                    label: 'Итого',
                    ...report.totals,
                  }}
                  isTotal
                />
              </tbody>
            </table>
          )}
        </div>

        {/* Legend */}
        {report && (
          <p className="text-xs text-gray-400 mt-3">
            Чистая выручка = Выручка − Доставка. Учитываются все заказы кроме LEAD и CANCELLED.
          </p>
        )}
      </div>
    </div>
  );
}
