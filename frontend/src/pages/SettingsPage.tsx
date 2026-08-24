import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Shirt, Info, Truck, Send } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { partnerSettingsApi } from '../api/partnerSettings';
import { shipmentLeadApi } from '../api/shipmentLead';
import { usersApi } from '../api/users';
import { ordersApi } from '../api/orders';
import { MockupTemplatesCard } from '../components/approval/MockupTemplatesCard';
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
 * Ручная отправка «плана дня» в рабочий чат — тот же текст, что уходит
 * автоматически в 10:00 по Москве (по исполнителям: в работе / готовы + блок
 * отгрузок). Жать можно сколько угодно раз в день: утром — проконтролировать,
 * вечером — посмотреть сводку за день.
 */
function DailyPlanCard() {
  const send = useMutation({
    mutationFn: () => ordersApi.sendDailyPlan(),
    onSuccess: (res) => {
      if (res.empty) {
        toast('Нет активных заказов для плана дня', { icon: 'ℹ️' });
      } else if (res.sent) {
        toast.success(`План дня отправлен в чат (${res.orderCount} заказ.)`);
      } else {
        toast.error('Не удалось отправить — проверьте настройки Telegram-бота');
      }
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось отправить план дня')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Send size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">План дня в чат</h2>
      </div>
      <p className="text-xs text-gray-500">
        Отправляет в рабочий чат план дня: по каждому исполнителю — заказы в работе и
        готовые к отгрузке/выдаче. Автоматически уходит в 10:00, но можно отправить и
        вручную в любой момент — утром проконтролировать, вечером посмотреть сводку.
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

/**
 * Разовая пересылка напоминаний об отзыве по всем заказам без отметки —
 * чтобы проверить вид сообщения и работу кнопки. Сначала считаем, сколько
 * уйдёт, и только после подтверждения отправляем: в чат летят десятки
 * сообщений, случайный клик обойдётся дорого.
 */
function ResendRemindersCard() {
  const [limit, setLimit] = useState('');

  const send = useMutation({
    mutationFn: async () => {
      const parsed = Number(limit);
      const take = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

      const preview = await ordersApi.resendReviewReminders({
        limit: take,
        dry: true,
      });
      if (preview.total === 0) {
        return { skipped: true as const, total: 0 };
      }
      const minutes = Math.ceil((preview.total * 3.5) / 60);
      const ok = window.confirm(
        `В чат уйдёт ${preview.total} сообщений (примерно ${minutes} мин).\n` +
          `Статусы заказов не изменятся. Продолжить?`,
      );
      if (!ok) return { cancelled: true as const, total: preview.total };
      const res = await ordersApi.resendReviewReminders({ limit: take });
      return { started: true as const, total: res.total };
    },
    onSuccess: (res) => {
      if ('skipped' in res) toast('Заказов без отзыва нет', { icon: 'ℹ️' });
      else if ('cancelled' in res) toast('Отменено');
      else toast.success(`Отправка запущена: ${res.total} сообщений`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось отправить')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Send size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">
          Напоминания об отзыве — переслать заново
        </h2>
      </div>
      <p className="text-xs text-gray-500">
        Шлёт в чат напоминание с кнопкой по каждому заказу со статусом «Без
        отзыва» — без фильтров по дате и статусу. Статусы заказов не меняются.
        Операция ручная: сама по себе больше не повторится.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          Сколько отправить <span className="text-gray-400">(пусто — все)</span>
        </span>
        <input
          type="number"
          min={1}
          className={`mt-1 ${field}`}
          placeholder="например 3 — для проверки"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </label>
      <button
        onClick={() => send.mutate()}
        disabled={send.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Send size={14} aria-hidden="true" />
        {send.isPending ? 'Отправка…' : 'Переслать напоминания'}
      </button>
    </div>
  );
}

interface FormState {
  thermalTransferCost: string;
  blankTshirtCost: string;
  ratePercent: string;
  partnerName: string;
  maxLinkTemplate: string;
  leadMentionUsernames: string;
}

function toForm(s: PartnerSettings): FormState {
  return {
    thermalTransferCost: String(s.thermalTransferCost),
    blankTshirtCost: String(s.blankTshirtCost),
    ratePercent: (s.partnerRateBasisPoints / 100).toString(),
    partnerName: s.partnerName,
    maxLinkTemplate: s.maxLinkTemplate,
    leadMentionUsernames: s.leadMentionUsernames ?? '',
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
    if (!form.maxLinkTemplate.includes('{phone}') && !form.maxLinkTemplate.includes('{phone_plus}')) {
      toast.error('В шаблоне MAX нужен {phone} или {phone_plus}');
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
      maxLinkTemplate: form.maxLinkTemplate.trim(),
      leadMentionUsernames: form.leadMentionUsernames.trim(),
    });
  };

  return (
    <AppShell title="Настройки" subtitle="Отгрузки и расчёт с партнёром" width="narrow" onRefresh={() => void refetch()}>
      <div className="max-w-xl space-y-5">
        <DailyPlanCard />
        <ResendRemindersCard />
        <ShipmentLeadCard />
        <MockupTemplatesCard />
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
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Кого тегать в Telegram по заявкам с сайта</span>
                <input
                  type="text" className={`mt-1 ${field}`}
                  placeholder="gts224"
                  value={form.leadMentionUsernames}
                  onChange={(e) => setForm({ ...form, leadMentionUsernames: e.target.value })}
                />
                <span className="block text-xs text-gray-500 mt-1">
                  Эти люди упоминаются всегда — помимо дежурного менеджера, который
                  тегается сам. Несколько — через запятую, собаку можно не писать.
                  Пусто — тегается только менеджер.
                </span>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Ссылка на переписку в MAX</span>
                <input
                  type="text" className={`mt-1 ${field}`}
                  value={form.maxLinkTemplate}
                  onChange={(e) => setForm({ ...form, maxLinkTemplate: e.target.value })}
                />
                <span className="block text-xs text-gray-500 mt-1">
                  Менеджер вводит телефон — CRM подставит его в шаблон.
                  {' '}<code>{'{phone}'}</code> — цифры (79991234567),
                  {' '}<code>{'{phone_plus}'}</code> — с плюсом.
                </span>
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
