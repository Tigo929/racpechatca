import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package, RefreshCw, Truck } from 'lucide-react';
import { ozonOrdersApi, type OzonOrder, type OzonOrderGroup } from '../../api/ozonOrders';
import { FilterChip } from '../ui/FilterChip';

/**
 * Заказы Ozon. Главный вопрос оператора — «что горит по отгрузке», поэтому
 * по умолчанию открывается группа «нужно отгрузить», внутри неё сортировка
 * по сроку, а просроченные подняты наверх и выделены.
 */

const GROUPS: { key: OzonOrderGroup | 'all'; label: string }[] = [
  { key: 'to_ship', label: 'Нужно отгрузить' },
  { key: 'in_transit', label: 'В доставке' },
  { key: 'delivered', label: 'Доставлены' },
  { key: 'problem', label: 'Проблемные' },
  { key: 'cancelled', label: 'Отменены' },
  { key: 'all', label: 'Все' },
];

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** «через 3 ч» / «просрочено на 5 ч» — оператору важен запас, а не дата. */
function deadlineHint(iso: string | null): string {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const hours = Math.round(Math.abs(diffMs) / 3_600_000);
  const text = hours >= 24 ? `${Math.round(hours / 24)} дн.` : `${hours} ч.`;
  return diffMs >= 0 ? `осталось ${text}` : `просрочено на ${text}`;
}

function OrderCard({ order }: { order: OzonOrder }) {
  const overdue = order.shipmentOverdue;
  return (
    <div
      className={`bg-white rounded-2xl border p-4 space-y-3 ${
        overdue ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {order.postingNumber}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Оформлен {formatDateTime(order.createdAt)}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0 ${
            order.group === 'to_ship' ? 'bg-amber-50 text-amber-700'
              : order.group === 'in_transit' ? 'bg-blue-50 text-blue-700'
              : order.group === 'delivered' ? 'bg-emerald-50 text-emerald-700'
              : order.group === 'cancelled' ? 'bg-gray-100 text-gray-500'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {order.statusLabel}
        </span>
      </div>

      {order.group === 'to_ship' && order.shipmentDate && (
        <div
          className={`flex items-start gap-2 rounded-lg p-2.5 border ${
            overdue
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}
        >
          {overdue
            ? <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            : <Truck size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />}
          <p className="text-xs">
            <span className="font-medium">Отгрузить до {formatDateTime(order.shipmentDate)}</span>
            {' — '}{deadlineHint(order.shipmentDate)}
          </p>
        </div>
      )}

      <div className="space-y-1">
        {order.items.map((item) => (
          <div key={item.offerId + item.sku} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-gray-700">
              <span className="font-mono text-gray-500">{item.offerId}</span>
              {item.quantity > 1 && <span className="ml-1 text-gray-500">× {item.quantity}</span>}
            </span>
            <span className="flex-shrink-0 tabular-nums text-gray-600">{money(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
        <span className="text-gray-500 truncate">
          {order.deliveryMethod ?? '—'}
          {order.warehouse ? ` · ${order.warehouse}` : ''}
        </span>
        <span className="flex-shrink-0 font-semibold tabular-nums text-gray-900">{money(order.total)}</span>
      </div>

      {order.cancelReason && (
        <p className="text-xs text-gray-500">Причина отмены: {order.cancelReason}</p>
      )}
    </div>
  );
}

export function OrdersTab({ accountId }: { accountId: string }) {
  const [group, setGroup] = useState<OzonOrderGroup | 'all'>('to_ship');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ozon-orders', accountId],
    queryFn: () => ozonOrdersApi.list(accountId, { sinceDays: 90, limit: 200 }),
    // Заказы приходят в течение дня; минута свежести — разумный компромисс
    // между актуальностью и лимитами API Ozon.
    staleTime: 60_000,
  });

  const all = data?.orders ?? [];
  const counts = GROUPS.reduce<Record<string, number>>((acc, g) => {
    acc[g.key] = g.key === 'all' ? all.length : all.filter((o) => o.group === g.key).length;
    return acc;
  }, {});

  const visible = (group === 'all' ? all : all.filter((o) => o.group === group))
    // Просроченные — наверх, дальше по ближайшему сроку отгрузки.
    .sort((a, b) => {
      if (a.shipmentOverdue !== b.shipmentOverdue) return a.shipmentOverdue ? -1 : 1;
      const at = a.shipmentDate ? new Date(a.shipmentDate).getTime() : Infinity;
      const bt = b.shipmentDate ? new Date(b.shipmentDate).getTime() : Infinity;
      return at - bt;
    });

  const overdueCount = all.filter((o) => o.shipmentOverdue).length;

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">
              Просрочена отгрузка: {overdueCount} {overdueCount === 1 ? 'заказ' : 'заказ(ов)'}
            </p>
            <p className="mt-0.5 text-xs">
              Ozon штрафует за срыв срока отгрузки — эти заказы нужно передать в доставку в первую очередь.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <FilterChip
              key={g.key}
              active={group === g.key}
              onClick={() => setGroup(g.key)}
            >
              {g.label}
              <span className={group === g.key ? 'ml-1.5 opacity-80' : 'ml-1.5 text-gray-400'}>
                {counts[g.key] ?? 0}
              </span>
            </FilterChip>
          ))}
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Обновить"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex-shrink-0"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
          <Package size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-500">
            {group === 'to_ship'
              ? 'Ничего не ждёт отгрузки — всё передано в доставку.'
              : 'В этой группе заказов нет.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((o) => <OrderCard key={o.postingNumber} order={o} />)}
        </div>
      )}

      {data?.hasNext && (
        <p className="text-xs text-gray-400">
          Показаны заказы за последние 90 дней (первые 200). Более старые — в кабинете Ozon.
        </p>
      )}
    </div>
  );
}
