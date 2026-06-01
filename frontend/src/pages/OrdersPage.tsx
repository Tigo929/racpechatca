import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ChevronLeft, ChevronRight, Printer, RefreshCw, LogOut, Users, Flame, Clock } from 'lucide-react';
import { getDeadlineInfo } from '../utils/deadline';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api/orders';
import { StatusBadge } from '../components/StatusBadge';
import { SourceBadge } from '../components/SourceBadge';
import { Modal } from '../components/Modal';
import { CreateOrderForm } from '../components/CreateOrderForm';
import { OrderDetail } from '../components/OrderDetail';
import { FilterChip } from '../components/FilterChip';
import { DeliveryBadge } from '../components/DeliveryBadge';
import { STATUS_FLOW, STATUS_LABELS, DELIVERY_LABELS } from '../constants';
import { useAuth } from '../context/AuthContext';
import type { EnumStatus, EnumSourceOrder, OrdersQuery } from '../types';

const PAGE_SIZE = 10;

export function OrdersPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [query, setQuery] = useState<OrdersQuery>({ page: 1, limit: PAGE_SIZE });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', query],
    queryFn: () => ordersApi.getAll(query),
    placeholderData: (prev) => prev,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;

  const setStatus = (status: EnumStatus | undefined) =>
    setQuery(q => ({ ...q, status, page: 1 }));

  const setSource = (sourceOrder: EnumSourceOrder | undefined) =>
    setQuery(q => ({ ...q, sourceOrder, page: 1 }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Шапка (тёмный фирменный фон) ─────────────────────────────── */}
      <header className="bg-indigo-950 border-b border-indigo-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">

          {/* Логотип */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Printer size={16} className="text-indigo-950" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">
                Распечатка <span className="text-amber-400">PRO</span>
              </h1>
              <p className="text-xs text-indigo-300 mt-0.5">
                {user?.username} · {isAdmin ? 'Администратор' : 'Исполнитель'}
              </p>
            </div>
          </div>

          {/* Навигация */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => refetch()}
              title="Обновить"
              className="p-2 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors"
            >
              <RefreshCw size={15} />
            </button>

            {isAdmin && (
              <>
                <Link
                  to="/users"
                  title="Пользователи"
                  className="p-2 text-indigo-300 hover:text-amber-400 rounded-lg hover:bg-indigo-800 transition-colors"
                >
                  <Users size={15} />
                </Link>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={15} /> Новая заявка
                </button>
              </>
            )}

            <button
              onClick={logout}
              title="Выйти"
              className="p-2 text-indigo-300 hover:text-red-400 rounded-lg hover:bg-indigo-800 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Статистика */}
        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Всего заявок', value: meta.quantityElements },
              { label: 'Новых', value: orders.filter(o => o.status === 'NEW').length, accent: true },
              { label: 'Готовы', value: orders.filter(o => o.status === 'READY').length },
              { label: 'Оплачено', value: orders.filter(o => o.status === 'PAID').length },
            ].map(stat => (
              <div key={stat.label}
                className={`bg-white rounded-xl p-4 border ${stat.accent ? 'border-amber-200' : 'border-gray-100'} shadow-sm`}>
                <p className={`text-2xl font-bold ${stat.accent ? 'text-amber-600' : 'text-gray-900'}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Фильтры */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 shadow-sm">
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={!query.status} onClick={() => setStatus(undefined)}>Все</FilterChip>
            {STATUS_FLOW.map(s => (
              <FilterChip key={s} active={query.status === s} onClick={() => setStatus(s)}>
                {STATUS_LABELS[s]}
              </FilterChip>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs text-gray-400">Источник:</span>
            {(['AVITO', 'OZON', 'WB', 'LOCAL'] as EnumSourceOrder[]).map(src => (
              <FilterChip key={src} active={query.sourceOrder === src}
                onClick={() => setSource(query.sourceOrder === src ? undefined : src)} small>
                {src === 'AVITO' ? 'Авито' : src === 'WB' ? 'WB' : src === 'LOCAL' ? 'Местный' : 'Ozon'}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search size={32} className="mb-3 opacity-40" />
              <p className="text-sm">Заявок не найдено</p>
              <p className="text-xs mt-1">Попробуйте изменить фильтры или создайте новую заявку</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Номер</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Дедлайн</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Источник</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Доставка</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Позиций</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Сумма</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(order => {
                    const dl = getDeadlineInfo(order.deadline, order.createdAt);
                    const isPaid = order.status === 'PAID';
                    const rowBg = isPaid
                      ? 'opacity-60'
                      : order.isUrgent
                        ? 'bg-red-100 hover:bg-red-150'
                        : dl.rowClass || 'hover:bg-amber-50/60';
                    return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={`cursor-pointer transition-colors group ${rowBg}`}
                      style={order.isUrgent && !isPaid ? { borderLeft: '5px solid #dc2626', boxShadow: 'inset 3px 0 8px rgba(220,38,38,0.08)' } : {}}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {order.isUrgent && (
                            <Flame size={13} className="text-red-500 flex-shrink-0 animate-pulse" />
                          )}
                          <span className="font-mono text-sm font-semibold text-indigo-800 group-hover:text-indigo-950">
                            {order.numberOrder}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${dl.badgeClass}`}>
                          <Clock size={10} />
                          {dl.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><SourceBadge source={order.sourceOrder} /></td>
                      <td className="px-4 py-3.5"><StatusBadge status={order.status} size="sm" /></td>
                      <td className="px-4 py-3.5"><DeliveryBadge method={order.deliveryMethod} /></td>
                      <td className="px-4 py-3.5 text-sm text-gray-600">
                        {(order.items?.length ?? 0) + (order.tshirtItems?.length ?? 0)} шт.
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900">
                          {(order.totalOrder ?? 0).toLocaleString()} ₽
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Пагинация */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Стр. {meta.page} из {meta.totalPages} · {meta.quantityElements} записей</span>
            <div className="flex gap-1">
              <button disabled={meta.page === 1}
                onClick={() => setQuery(q => ({ ...q, page: (q.page ?? 1) - 1 }))}
                className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button disabled={meta.page === meta.totalPages}
                onClick={() => setQuery(q => ({ ...q, page: (q.page ?? 1) + 1 }))}
                className="p-2 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новая заявка" size="lg">
          <CreateOrderForm onClose={() => setCreateOpen(false)} />
        </Modal>
      )}

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Заявка" size="xl">
        {selectedId && (
          <OrderDetail orderId={selectedId} onDeleted={() => setSelectedId(null)} />
        )}
      </Modal>
    </div>
  );
}
