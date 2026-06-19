import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Search, ChevronLeft, ChevronRight, Printer, RefreshCw, LogOut, Users, Flame, Clock, Camera, Shirt, Wallet, Boxes, LayoutList, Sparkles, CheckCircle2, TrendingUp, Star } from 'lucide-react';
import { getDeadlineInfo } from '../utils/deadline';
import { Link } from 'react-router-dom';
import { ordersApi } from '../api/orders';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { CreateOrderForm } from '../components/orders/CreateOrderForm';
import { OrderDetail } from '../components/orders/OrderDetail';
import { FilterChip } from '../components/ui/FilterChip';
import { DeliveryBadge } from '../components/ui/DeliveryBadge';
import { STATUS_FLOW, STATUS_LABELS } from '../constants';
import { useAuth } from '../context/useAuth';
import type { EnumStatus, EnumProductCategory, OrdersQuery } from '../types/index';

const PAGE_SIZE = 10;

export function OrdersPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Исполнители видят только фото-заказы — фильтр на уровне запроса к бэкенду
  const [query, setQuery] = useState<OrdersQuery>({
    page: 1,
    limit: PAGE_SIZE,
    productCategory: isAdmin ? undefined : 'PHOTO',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const qc = useQueryClient();

  // debounce: отправляем поиск через 350ms после последнего нажатия
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q => ({ ...q, search: searchInput.trim() || undefined, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', query],
    queryFn: () => ordersApi.getAll(query),
    placeholderData: (prev) => prev,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;

  const setStatus = (status: EnumStatus | undefined) =>
    setQuery(q => ({ ...q, status, page: 1 }));

  const setProductCategory = (productCategory: EnumProductCategory | undefined) =>
    setQuery(q => ({ ...q, productCategory, page: 1 }));

  const setReviewFilter = (reviewLeft: boolean | undefined) =>
    setQuery(q => ({ ...q, reviewLeft, page: 1 }));

  const reviewMutation = useMutation({
    mutationFn: ({ id, reviewLeft }: { id: string; reviewLeft: boolean }) =>
      ordersApi.setReview(id, reviewLeft),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(u.clientReviewLeft ? 'Отзыв отмечен' : 'Отметка снята');
    },
    onError: () => toast.error('Не удалось изменить отметку отзыва'),
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      {/* ── Шапка ─────────────────────────────── */}
      <header className="sticky top-0 z-20" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)', boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(30,27,75,0.4)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

          {/* Логотип */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 2px 8px rgba(217,119,6,0.5)' }}>
              <Printer size={17} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none tracking-tight">
                Распечатка <span style={{ color: '#FCD34D' }}>PRO</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: '#A5B4FC' }}>
                {user?.username} · {isAdmin ? 'Администратор' : 'Исполнитель'}
              </p>
            </div>
          </div>

          {/* Навигация */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => refetch()}
              aria-label="Обновить список заявок"
              className="p-2 text-indigo-300 hover:text-white rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>

            {isAdmin && (
              <>
                <Link
                  to="/crm/salary"
                  aria-label="Зарплата"
                  className="p-2 text-indigo-300 hover:text-amber-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Wallet size={15} aria-hidden="true" />
                </Link>
                <Link
                  to="/crm/stock"
                  aria-label="Склад футболок"
                  className="p-2 text-indigo-300 hover:text-amber-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Boxes size={15} aria-hidden="true" />
                </Link>
                <Link
                  to="/crm/users"
                  aria-label="Пользователи"
                  className="p-2 text-indigo-300 hover:text-amber-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Users size={15} aria-hidden="true" />
                </Link>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950"
                >
                  <Plus size={15} aria-hidden="true" /> Новая заявка
                </button>
              </>
            )}

            <button
              onClick={logout}
              aria-label="Выйти из системы"
              className="p-2 text-indigo-300 hover:text-red-400 rounded-lg hover:bg-indigo-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* Статистика */}
        {meta && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Всего заявок', value: meta.quantityElements, icon: <LayoutList size={18} />, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-600' },
              { label: 'Новых', value: orders.filter(o => o.status === 'NEW').length, icon: <Sparkles size={18} />, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-600' },
              { label: 'Готовы', value: orders.filter(o => o.status === 'READY').length, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600' },
              { label: 'Оплачено', value: orders.filter(o => o.status === 'PAID').length, icon: <TrendingUp size={18} />, color: 'from-violet-500 to-violet-600', bg: 'bg-violet-50', text: 'text-violet-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-white/80 flex items-center gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 8px rgba(0,0,0,0.04)' }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${stat.color} text-white shadow-sm`}>
                  {stat.icon}
                </div>
                <div>
                  <p className={`text-2xl font-bold tabular-nums ${stat.text}`}>{stat.value}</p>
                  <p className="text-xs text-gray-400 leading-tight">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Поиск */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по номеру заказа, контакту или заметке…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          />
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-gray-100/80 px-4 py-3 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Фильтр по типу товара — только для администратора */}
          {isAdmin && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Тип</span>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip active={!query.productCategory} onClick={() => setProductCategory(undefined)}>
                  Все
                </FilterChip>
                <FilterChip active={query.productCategory === 'PHOTO'} onClick={() => setProductCategory('PHOTO')}>
                  <Camera size={11} aria-hidden="true" className="inline mr-1" />Фото
                </FilterChip>
                <FilterChip active={query.productCategory === 'TSHIRT'} onClick={() => setProductCategory('TSHIRT')}>
                  <Shirt size={11} aria-hidden="true" className="inline mr-1" />Футболки
                </FilterChip>
              </div>
            </div>
          )}
          {/* Фильтр по статусу */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Статус</span>
            <div className="flex gap-1.5 flex-wrap">
              <FilterChip active={!query.status} onClick={() => setStatus(undefined)}>Все</FilterChip>
              {isAdmin && (
                <FilterChip active={query.status === 'LEAD'} onClick={() => setStatus('LEAD')}>
                  🔔 Обратился
                </FilterChip>
              )}
              {STATUS_FLOW.filter(s => s !== 'LEAD').map(s => (
                <FilterChip key={s} active={query.status === s} onClick={() => setStatus(s)}>
                  {STATUS_LABELS[s]}
                </FilterChip>
              ))}
            </div>
          </div>
          {/* Фильтр по отзыву — только для администратора */}
          {isAdmin && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Отзыв</span>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip active={query.reviewLeft === undefined} onClick={() => setReviewFilter(undefined)}>Все</FilterChip>
                <FilterChip active={query.reviewLeft === true} onClick={() => setReviewFilter(true)}>
                  <Star size={11} aria-hidden="true" className="inline mr-1" />Оставлен
                </FilterChip>
                <FilterChip active={query.reviewLeft === false} onClick={() => setReviewFilter(false)}>
                  Без отзыва
                </FilterChip>
              </div>
            </div>
          )}
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div role="status" aria-label="Загрузка заявок" className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-100 border-t-indigo-600" />
              <p className="text-xs text-gray-400">Загружаем заявки…</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-2">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-1">
                <Search size={24} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Заявок не найдено</p>
              <p className="text-xs text-gray-400">Попробуйте изменить фильтры или создайте новую заявку</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Номер</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Тип</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Дата</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Дедлайн</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Статус</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Доставка</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Позиций</th>
                    {isAdmin && (
                      <th scope="col" className="px-5 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Отзыв</th>
                    )}
                    {isAdmin && (
                      <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Сумма</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => {
                    const dl = getDeadlineInfo(order.deadline, order.createdAt);
                    const isPaid = order.status === 'PAID';
                    const isSent = order.status === 'SENT';
                    const showUrgent = order.isUrgent && !isPaid && !isSent;
                    const rowBg = isPaid
                      ? 'opacity-50'
                      : showUrgent
                        ? 'bg-red-50 hover:bg-red-100'
                        : (!isSent && dl.rowClass) || (idx % 2 === 0 ? 'hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40');
                    return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={`cursor-pointer group ${rowBg} ${showUrgent ? 'border-l-[3px] border-l-red-500' : ''}`}
                      style={{ borderBottom: '1px solid #F8FAFC' }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {showUrgent && (
                            <Flame size={13} className="text-red-500 flex-shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
                          )}
                          <span className="font-mono text-sm font-bold text-indigo-700 group-hover:text-indigo-900 tabular-nums">
                            {order.numberOrder}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {order.productCategory === 'TSHIRT' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700">
                            <Shirt size={11} aria-hidden="true" /> Футболка
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
                            <Camera size={11} aria-hidden="true" /> Фото
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 tabular-nums">
                        {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-3.5">
                        {!isSent && !isPaid && dl.label ? (
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${dl.badgeClass}`}>
                            <Clock size={10} aria-hidden="true" /> {dl.label}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={order.status} productCategory={order.productCategory} size="sm" /></td>
                      <td className="px-5 py-3.5"><DeliveryBadge method={order.deliveryMethod} /></td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-gray-700 tabular-nums">
                          {(order.items?.length ?? 0) + (order.tshirtItems?.length ?? 0)} шт.
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reviewMutation.mutate({ id: order.id, reviewLeft: !order.clientReviewLeft });
                            }}
                            disabled={reviewMutation.isPending}
                            title={order.clientReviewLeft ? 'Отзыв оставлен — снять отметку' : 'Отметить, что клиент оставил отзыв'}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                              order.clientReviewLeft
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-700'
                            }`}
                          >
                            <Star size={11} aria-hidden="true" className={order.clientReviewLeft ? 'fill-emerald-600' : ''} />
                            {order.clientReviewLeft ? 'Оставил' : 'Нет'}
                          </button>
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            {(order.totalOrder ?? 0).toLocaleString()} ₽
                          </span>
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Стр. {meta.page} из {meta.totalPages} · {meta.quantityElements} записей</span>
            <div className="flex gap-1">
              <button disabled={meta.page === 1}
                onClick={() => setQuery(q => ({ ...q, page: (q.page ?? 1) - 1 }))}
                className="p-2 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              <button disabled={meta.page === meta.totalPages}
                onClick={() => setQuery(q => ({ ...q, page: (q.page ?? 1) + 1 }))}
                className="p-2 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm">
                <ChevronRight size={16} className="text-gray-600" />
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
