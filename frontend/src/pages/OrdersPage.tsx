import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, ChevronLeft, ChevronRight, Printer, Flame, Clock, Camera, Shirt, Wallet, LayoutList, Sparkles, CheckCircle2, TrendingUp, Star, AlarmClock, Plus } from 'lucide-react';
import { getDeadlineInfo } from '../utils/deadline';
import { getStalledDays } from '../utils/stalled';
import { ordersApi } from '../api/orders';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { CreateOrderForm } from '../components/orders/CreateOrderForm';
import { OrderDetail } from '../components/orders/OrderDetail';
import { FilterChip } from '../components/ui/FilterChip';
import { DeliveryBadge } from '../components/ui/DeliveryBadge';
import { STATUS_FLOW, TSHIRT_STATUS_FLOW, STATUS_LABELS, TSHIRT_STATUS_LABELS } from '../constants';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../context/useAuth';
import type { EnumStatus, EnumProductCategory, OrdersQuery } from '../types/index';
import { formatCurrency } from '../utils/format';

const PAGE_SIZE = 10;

/** Раздел: продукт со своим процессом либо общая воронка обращений. */
export type OrdersSection = 'PHOTO' | 'TSHIRT' | 'LEADS';

const SECTION_TITLE: Record<OrdersSection, string> = {
  PHOTO: 'Фотопечать',
  TSHIRT: 'Футболки',
  LEADS: 'Обращения',
};

interface Props {
  section: OrdersSection;
}

export function OrdersPage({ section }: Props) {
  const { user } = useAuth();
  // Менеджер по оформлению ведёт заказы наравне с админом (без раздела
  // «Управление»), поэтому на страницах заказов он видит всё то же.
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ORDER_MANAGER';
  const isLeads = section === 'LEADS';

  // Продукт задаётся разделом, а не фильтром: в списке всегда один процесс.
  // У обращений продукт не фиксируем — это общая входящая воронка.
  const [query, setQuery] = useState<OrdersQuery>({
    page: 1,
    limit: PAGE_SIZE,
    ...(isLeads
      ? { status: 'LEAD' as EnumStatus }
      : { productCategory: section }),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const qc = useQueryClient();
  const statsQuery = useMemo<OrdersQuery>(
    () => ({
      status: query.status,
      sourceOrder: query.sourceOrder,
      productCategory: query.productCategory,
      reviewLeft: query.reviewLeft,
      search: query.search,
    }),
    [
      query.status,
      query.sourceOrder,
      query.productCategory,
      query.reviewLeft,
      query.search,
    ],
  );

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

  const { data: stats } = useQuery({
    queryKey: ['orders', 'stats', statsQuery],
    queryFn: () => ordersApi.getStats(statsQuery),
    placeholderData: (prev) => prev,
  });

  // Счётчик обращений переехал в общее меню — он нужен из любого раздела,
  // а не только отсюда.

  const orders = data?.data ?? [];
  const meta = data?.meta;

  const setStatus = (status: EnumStatus | undefined) =>
    setQuery(q => ({ ...q, status, page: 1 }));

  const setProductCategory = (productCategory: EnumProductCategory | undefined) =>
    setQuery(q => ({ ...q, productCategory, page: 1 }));

  const setReviewFilter = (reviewLeft: boolean | undefined) =>
    setQuery(q => ({ ...q, reviewLeft, page: 1 }));

  // У футболок свой путь заказа — показываем только его статусы. Раньше здесь
  // всегда были фото-статусы, поэтому «Выполнен» и «На стадии дизайна» у
  // футболок нельзя было выбрать вообще.
  const statusFlow = (section === 'TSHIRT' ? TSHIRT_STATUS_FLOW : STATUS_FLOW)
    .filter(s => s !== 'LEAD');
  const statusLabels = section === 'TSHIRT' ? TSHIRT_STATUS_LABELS : STATUS_LABELS;

  const reviewMutation = useMutation({
    mutationFn: ({ id, reviewLeft }: { id: string; reviewLeft: boolean }) =>
      ordersApi.setReview(id, reviewLeft),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(u.clientReviewLeft ? 'Отзыв отмечен' : 'Отметка снята');
    },
    onError: () => toast.error('Не удалось изменить отметку отзыва'),
  });

  const sectionHint = isLeads
    ? 'Входящие обращения по обоим направлениям'
    : section === 'TSHIRT'
      ? 'Печать у партнёра-исполнителя'
      : 'Печать своими силами';

  return (
    <AppShell
      title={SECTION_TITLE[section]}
      subtitle={sectionHint}
      onRefresh={() => void refetch()}
      actions={isAdmin ? (
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Plus size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Новая заявка</span>
        </button>
      ) : undefined}
    >
      <div className="space-y-4">

        {/* Статистика */}
        {stats && (() => {
          const statCards = [
            {
              label: 'Активных',
              value: stats.activeCount,
              hint: `${stats.matchingTotal} в списке`,
              icon: <LayoutList size={18} />,
              color: 'from-indigo-500 to-indigo-600',
              text: 'text-indigo-600',
            },
            {
              label: 'Новых',
              value: stats.newCount,
              hint: stats.leadCount > 0 ? `${stats.leadCount} обращ.` : 'ожидают старта',
              icon: <Sparkles size={18} />,
              color: 'from-amber-500 to-amber-600',
              text: 'text-amber-600',
            },
            {
              label: 'В работе',
              value: stats.inProgressCount,
              hint: 'обработка/печать',
              icon: <Printer size={18} />,
              color: 'from-sky-500 to-sky-600',
              text: 'text-sky-600',
            },
            {
              label: 'Готовы',
              value: stats.readyCount,
              hint: 'к выдаче/отправке',
              icon: <CheckCircle2 size={18} />,
              color: 'from-emerald-500 to-emerald-600',
              text: 'text-emerald-600',
            },
            {
              label: stats.alertCount > 0 ? 'Требуют внимания' : 'В порядке',
              value: stats.alertCount,
              hint: `${stats.overdueCount} просроч. · ${stats.urgentCount} сроч.`,
              icon: stats.alertCount > 0 ? <Flame size={18} /> : <TrendingUp size={18} />,
              color: stats.alertCount > 0 ? 'from-red-500 to-red-600' : 'from-violet-500 to-violet-600',
              text: stats.alertCount > 0 ? 'text-red-600' : 'text-violet-600',
            },
            ...(isAdmin
              ? [
                  {
                    label: 'Без оплаты',
                    value: stats.sentUnpaidCount,
                    hint: stats.sentUnpaidAmount
                      ? formatCurrency(stats.sentUnpaidAmount)
                      : 'отправлено',
                    icon: <Wallet size={18} />,
                    color: 'from-orange-500 to-orange-600',
                    text: 'text-orange-600',
                  },
                  {
                    label: 'Без отзыва',
                    value: stats.reviewPendingCount ?? 0,
                    hint: `${stats.reviewRemindedCount ?? 0} напомнили, ждём`,
                    icon: <Star size={18} />,
                    color: 'from-fuchsia-500 to-fuchsia-600',
                    text: 'text-fuchsia-600',
                  },
                ]
              : []),
          ];
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              {statCards.map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-white/80 flex items-center gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 8px rgba(0,0,0,0.04)' }}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${stat.color} text-white shadow-sm`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className={`text-2xl font-bold tabular-nums ${stat.text}`}>{stat.value}</p>
                    <p className="text-xs text-gray-400 leading-tight">{stat.label}</p>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{stat.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

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
          {/* В обращениях продукт — фильтр: воронка общая для обоих направлений */}
          {isLeads && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Продукт</span>
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
          {/* Статусы только своего продукта: у футболок свой путь заказа */}
          {!isLeads && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Статус</span>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip active={!query.status} onClick={() => setStatus(undefined)}>Все</FilterChip>
                {statusFlow.map(s => (
                  <FilterChip key={s} active={query.status === s} onClick={() => setStatus(s)}>
                    {statusLabels[s]}
                  </FilterChip>
                ))}
              </div>
            </div>
          )}
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
            <>
            {/* Мобильный вид — карточки вместо широкой таблицы */}
            <div className="md:hidden divide-y divide-gray-100">
              {orders.map(order => {
                const tracksDeadline = order.productCategory !== 'TSHIRT';
                const dl = tracksDeadline
                  ? getDeadlineInfo(order.deadline, order.createdAt)
                  : { rowClass: '', badgeClass: '', label: '' };
                const isClosed = (
                  order.status === 'PAID' ||
                  order.status === 'SENT' ||
                  order.status === 'DONE' ||
                  order.status === 'COMPLETED' ||
                  order.status === 'CANCELLED'
                );
                const isPaid = order.status === 'PAID';
                const showUrgent = tracksDeadline && order.isUrgent && !isClosed;
                const stalledDays = getStalledDays(order);
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    className={`w-full text-left px-4 py-3.5 active:bg-indigo-50 transition-colors ${
                      isPaid ? 'opacity-50' : showUrgent ? 'bg-red-50 border-l-[3px] border-l-red-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-indigo-700 tabular-nums">
                        {showUrgent && <Flame size={13} className="text-red-500 flex-shrink-0" aria-hidden="true" />}
                        {order.numberOrder}
                      </span>
                      <StatusBadge status={order.status} productCategory={order.productCategory} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      {order.productCategory === 'TSHIRT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-violet-100 text-violet-700">
                          <Shirt size={10} aria-hidden="true" /> Футболка
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-700">
                          <Camera size={10} aria-hidden="true" /> Фото
                        </span>
                      )}
                      <DeliveryBadge method={order.deliveryMethod} />
                      <span className="tabular-nums">
                        {new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        {tracksDeadline && !isClosed && dl.label ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${dl.badgeClass}`}>
                            <Clock size={9} aria-hidden="true" /> {dl.label}
                          </span>
                        ) : null}
                        {stalledDays !== null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-red-50 text-red-700 border border-red-200">
                            <AlarmClock size={9} aria-hidden="true" /> завис {stalledDays} дн.
                          </span>
                        )}
                        <span className="text-gray-400 tabular-nums">
                          {(order.items?.length ?? 0) + (order.tshirtItems?.length ?? 0)} поз.
                        </span>
                        {isAdmin && order.clientReviewLeft && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                            <Star size={10} aria-hidden="true" className="fill-emerald-600" /> отзыв
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          {(order.totalOrder ?? 0).toLocaleString()} ₽
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Десктопный вид — таблица */}
            <div className="hidden md:block overflow-x-auto">
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
                    const tracksDeadline = order.productCategory !== 'TSHIRT';
                    const dl = tracksDeadline
                      ? getDeadlineInfo(order.deadline, order.createdAt)
                      : { rowClass: '', badgeClass: '', label: '' };
                    // Статусы, при которых заказ уже закрыт/выполнен —
                    // срочность и дедлайн-предупреждения больше не нужны.
                    const isClosed = (
                      order.status === 'PAID' ||
                      order.status === 'SENT' ||
                      order.status === 'DONE' ||
                      order.status === 'COMPLETED' ||
                      order.status === 'CANCELLED'
                    );
                    const isPaid = order.status === 'PAID';
                    const showUrgent = tracksDeadline && order.isUrgent && !isClosed;
                    const stalledDays = getStalledDays(order);
                    const rowBg = isPaid
                      ? 'opacity-50'
                      : showUrgent
                        ? 'bg-red-50 hover:bg-red-100'
                        : (tracksDeadline && !isClosed && dl.rowClass) || (idx % 2 === 0 ? 'hover:bg-indigo-50/40' : 'bg-slate-50/60 hover:bg-indigo-50/40');
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tracksDeadline && !isClosed && dl.label ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${dl.badgeClass}`}>
                              <Clock size={10} aria-hidden="true" /> {dl.label}
                            </span>
                          ) : stalledDays === null ? (
                            <span className="text-gray-300 text-xs">—</span>
                          ) : null}
                          {stalledDays !== null && (
                            <span
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-red-50 text-red-700 border border-red-200"
                              title="Статус не менялся — заказ стоит без движения"
                            >
                              <AlarmClock size={10} aria-hidden="true" /> завис {stalledDays} дн.
                            </span>
                          )}
                        </div>
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
            </>
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
    </AppShell>
  );
}
