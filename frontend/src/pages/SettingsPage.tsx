import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Shirt, Info, Truck, Send } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { partnerSettingsApi } from '../api/partnerSettings';
import { shipmentLeadApi } from '../api/shipmentLead';
import { usersApi } from '../api/users';
import { ordersApi } from '../api/orders';
import { getErrorMessage } from '../utils/get-error-message';
import type { AppUser, PartnerSettings } from '../types/index';

const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'администратор',
  ORDER_MANAGER: 'менеджер по оформлению',
};

/**
 * «Старший дня» по отгрузкам: кого план дня тегает в блоке отгрузок, чтобы он
 * оформил поставки по готовым фотозаказам и проконтролировал отгрузку.
 */
function ShipmentLeadCard() {
  const qc = useQueryClient();
  const { data: lead } = useQuery({
    queryKey: ['shipment-lead'],
    queryFn: shipmentLeadApi.get,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    staleTime: 60_000,
  });

  const [selected, setSelected] = useState<string>('');
  useEffect(() => {
    setSelected(lead?.userId ?? '');
  }, [lead]);

  // Старшим может быть админ или менеджер по оформлению (кто ведёт отгрузки).
  const candidates = users.filter(
    (u: AppUser) =>
      (u.role === 'ADMIN' || u.role === 'ORDER_MANAGER') && u.isActive !== false,
  );

  const save = useMutation({
    mutationFn: () => shipmentLeadApi.set(selected || null),
    onSuccess: (updated) => {
      qc.setQueryData(['shipment-lead'], updated);
      toast.success('Старший дня сохранён');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Truck size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">Старший дня по отгрузкам</h2>
      </div>
      <p className="text-xs text-gray-500">
        Его тегает «план дня» в 10:00 в блоке отгрузок: оформить поставки по готовым
        фотозаказам и проконтролировать отгрузку.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Ответственный</span>
        <select
          className={`mt-1 ${field}`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— не назначен —</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username} · {ROLE_LABEL[u.role] ?? u.role}
              {u.telegramUsername ? ` · @${u.telegramUsername.replace(/^@/, '')}` : ' · без Telegram'}
            </option>
          ))}
        </select>
      </label>
      {selected &&
        !candidates.find((u) => u.id === selected)?.telegramUsername && (
          <p className="text-xs text-amber-600">
            У сотрудника не указан Telegram-ник — в чате он будет упомянут по имени, без пуш-уведомления.
          </p>
        )}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {save.isPending ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  );
}

/**
 * Ручная «сводка по заказам» в рабочий чат: те же цифры, что раньше стояли
 * карточками на странице заказов. Можно отправлять сколько угодно раз в
 * день — утром проверить фронт работ, вечером понять, что сделано.
 */
function StatusSummaryCard() {
  const send = useMutation({
    mutationFn: () => ordersApi.sendStatusSummary(),
    onSuccess: (res) => {
      toast.success(
        res.sent
          ? 'Сводка отправлена в чат'
          : 'Не удалось отправить — проверьте настройки Telegram-бота',
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось отправить сводку')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Send size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">Сводка по заказам в чат</h2>
      </div>
      <p className="text-xs text-gray-500">
        Отправляет в рабочий чат текущие цифры: новые, в работе, готовы, отправлено без
        оплаты, оплачено, срочные/просроченные, без отзыва. Жмите когда нужно — утром,
        чтобы понять фронт работ, вечером — что сделано за день.
      </p>
      <button
        onClick={() => send.mutate()}
        disabled={send.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Send size={14} aria-hidden="true" />
        {send.isPending ? 'Отправка…' : 'Отправить сейчас'}
      </button>
    </div>
  );
}

interface FormState {
  thermalTransferCost: string;
  blankTshirtCost: string;
  ratePercent: string;
  partnerName: string;
}

function toForm(s: PartnerSettings): FormState {
  return {
    thermalTransferCost: String(s.thermalTransferCost),
    blankTshirtCost: String(s.blankTshirtCost),
    ratePercent: (s.partnerRateBasisPoints / 100).toString(),
    partnerName: s.partnerName,
  };
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['partner-settings'],
    queryFn: partnerSettingsApi.get,
  });

  const [form, setForm] = useState<FormState | null>(null);
  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (patch: Partial<PartnerSettings>) => partnerSettingsApi.update(patch),
    onSuccess: (updated) => {
      qc.setQueryData(['partner-settings'], updated);
      setForm(toForm(updated));
      toast.success('Настройки сохранены');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  const submit = () => {
    if (!form) return;
    const thermal = Math.round(Number(form.thermalTransferCost));
    const blank = Math.round(Number(form.blankTshirtCost));
    const pct = Number(form.ratePercent.replace(',', '.'));
    if ([thermal, blank].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error('Себестоимость должна быть числом ≥ 0');
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Ставка партнёра — от 0 до 100%');
      return;
    }
    if (!form.partnerName.trim()) {
      toast.error('Укажите имя партнёра');
      return;
    }
    save.mutate({
      thermalTransferCost: thermal,
      blankTshirtCost: blank,
      partnerRateBasisPoints: Math.round(pct * 100),
      partnerName: form.partnerName.trim(),
    });
  };

  return (
    <AppShell title="Настройки" subtitle="Отгрузки и расчёт с партнёром" width="narrow" onRefresh={() => void refetch()}>
      <div className="max-w-xl space-y-5">
        <StatusSummaryCard />
        <ShipmentLeadCard />
        {isLoading || !form ? (
          <p className="py-16 text-center text-gray-400">Загрузка настроек партнёра…</p>
        ) : (
          <>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shirt size={16} className="text-amber-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-gray-900">Себестоимость и доля партнёра</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Термоперенос, ₽ за штуку</span>
                <input
                  type="number" min={0} className={`mt-1 ${field}`}
                  value={form.thermalTransferCost}
                  onChange={(e) => setForm({ ...form, thermalTransferCost: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Футболка (заготовка), ₽</span>
                <input
                  type="number" min={0} className={`mt-1 ${field}`}
                  value={form.blankTshirtCost}
                  onChange={(e) => setForm({ ...form, blankTshirtCost: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Ставка партнёра, %</span>
                <input
                  type="number" min={0} max={100} step="0.01" className={`mt-1 ${field}`}
                  value={form.ratePercent}
                  onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Имя партнёра</span>
                <input
                  type="text" className={`mt-1 ${field}`}
                  value={form.partnerName}
                  onChange={(e) => setForm({ ...form, partnerName: e.target.value })}
                />
              </label>
            </div>

            <button
              onClick={submit}
              disabled={save.isPending}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {save.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>

          {/* Живой пример на текущих значениях — чтобы видеть, как считается */}
          <Example
            thermal={Math.max(0, Math.round(Number(form.thermalTransferCost)) || 0)}
            blank={Math.max(0, Math.round(Number(form.blankTshirtCost)) || 0)}
            pct={Math.min(100, Math.max(0, Number(form.ratePercent.replace(',', '.')) || 0))}
          />
          </>
        )}
      </div>
    </AppShell>
  );
}

/** Разбор на примере футболки 1500 ₽ без дизайна — чтобы формула была наглядной. */
function Example({ thermal, blank, pct }: { thermal: number; blank: number; pct: number }) {
  const price = 1500;
  const design = 0; // без дизайна — как в базовом примере (результат 681 при 30%)
  const materials = thermal + blank;
  const margin = Math.max(0, price - design - materials);
  const partnerProfit = Math.floor((margin * pct) / 100);
  const reward = partnerProfit + materials;
  const ownerProfit = price - reward;
  const Row = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
    <div className={`flex justify-between ${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      <span>{l}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-1.5 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <Info size={15} className="text-indigo-500" aria-hidden="true" />
        <span className="font-semibold text-indigo-900">Пример: футболка {money(price)} (дизайн внутри цены — твоя прибыль)</span>
      </div>
      <Row l={`Материалы (термо ${thermal} + футболка ${blank})`} v={money(materials)} />
      <Row l="Делимая маржа (цена − дизайн − материалы)" v={money(margin)} />
      <Row l={`Заработок партнёра (${pct}% маржи)`} v={money(partnerProfit)} />
      <Row l="Плачу партнёру (заработок + материалы)" v={money(reward)} strong />
      <Row l="Моя прибыль (дизайн + 70% маржи)" v={money(ownerProfit)} strong />
    </div>
  );
}
