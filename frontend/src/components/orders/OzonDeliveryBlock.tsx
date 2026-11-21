import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ban, Calculator, Package, Printer, RefreshCw, Truck } from 'lucide-react';
import {
  ozonDeliveryApi,
  openPdf,
  type DeliveryView,
  type Parcel,
  type ShipmentStatus,
} from '../../api/ozonDelivery';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Доставка Ozon в карточке заказа.
 *
 * Всё, что раньше набиралось руками в кабинете Ozon, — здесь: пункт выдачи,
 * получатель, размеры посылки. Кнопка «Создать отправление» сама передаёт
 * это в Ozon, подтверждает и даёт этикетку. Создать нельзя, пока заказ не
 * оплачен полностью: Ozon не берёт оплату при получении.
 */

const STATUS: Record<ShipmentStatus, { label: string; cls: string }> = {
  CREATED: { label: 'Создано, не подтверждено', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Готово — отнесите в ПВЗ', cls: 'bg-sky-100 text-sky-800' },
  IN_TRANSIT: { label: 'Едет', cls: 'bg-indigo-100 text-indigo-800' },
  AT_PICKUP_POINT: { label: 'Ждёт в пункте выдачи', cls: 'bg-violet-100 text-violet-800' },
  DELIVERED: { label: 'Получено клиентом', cls: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Отменено', cls: 'bg-gray-100 text-gray-600' },
  RETURNING: { label: 'Возвращается', cls: 'bg-orange-100 text-orange-800' },
  RETURNED: { label: 'Вернулось', cls: 'bg-red-100 text-red-700' },
  ERROR: { label: 'Ошибка', cls: 'bg-red-100 text-red-700' },
};

const input =
  'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
const btn =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50';

function rub(n: number | null | undefined) {
  return n === null || n === undefined ? '—' : `${n.toLocaleString('ru-RU')} ₽`;
}

function day(v: string | null) {
  return v ? new Date(v).toLocaleDateString('ru-RU') : null;
}

export function OzonDeliveryBlock({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const key = ['ozon-delivery', orderId];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => ozonDeliveryApi.view(orderId),
  });

  const put = (v: DeliveryView) => {
    qc.setQueryData(key, v);
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['order', orderId] });
  };

  if (isLoading) return <div className="text-sm text-gray-400">Доставка Ozon: загружаю…</div>;
  if (error || !data) {
    return <div className="text-sm text-red-600">Доставка Ozon: {getErrorMessage(error, 'не загрузилась')}</div>;
  }
  return <Inner orderId={orderId} data={data} put={put} />;
}

function Inner({ orderId, data, put }: { orderId: string; data: DeliveryView; put: (v: DeliveryView) => void }) {
  const s = data.shipment;
  const editable = !s || ['CREATED', 'CANCELLED', 'ERROR'].includes(s.status);

  const [point, setPoint] = useState(data.pickupPoint?.number ?? data.pickupPoint?.id ?? '');
  const [name, setName] = useState(data.recipientName ?? '');
  const [phone, setPhone] = useState(data.recipientPhone ?? '');
  const [parcel, setParcel] = useState<Parcel>(s?.parcel ?? data.defaultParcel);
  const [quote, setQuote] = useState<string | null>(null);

  const saveRecipient = useMutation({
    mutationFn: () =>
      ozonDeliveryApi.setDelivery(orderId, {
        ...(point.trim() !== (data.pickupPoint?.number ?? data.pickupPoint?.id ?? '') ? { pickupPoint: point.trim() } : {}),
        recipientName: name,
        recipientPhone: phone,
      }),
    onSuccess: (v) => {
      put(v);
      toast.success('Сохранено');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const calc = useMutation({
    mutationFn: () => ozonDeliveryApi.quote(orderId, parcel),
    onSuccess: (q) =>
      setQuote(
        `Ozon: доставка ${rub(q.deliveryCost)} + страховка ${rub(q.insuranceCost)}${q.days ? `, ~${q.days} дн.` : ''}`,
      ),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const create = useMutation({
    mutationFn: () => ozonDeliveryApi.create(orderId, parcel),
    onSuccess: (v) => {
      put(v);
      toast.success('Отправление создано. Печатайте этикетку и несите в ПВЗ.');
    },
    onError: (e) => {
      toast.error(getErrorMessage(e), { duration: 10_000 });
      void ozonDeliveryApi.view(orderId).then(put).catch(() => undefined);
    },
  });

  const cancel = useMutation({
    mutationFn: () => ozonDeliveryApi.cancel(orderId),
    onSuccess: (v) => {
      put(v);
      toast.success('Отправление отменено');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const sync = useMutation({
    mutationFn: () => ozonDeliveryApi.sync(orderId),
    onSuccess: put,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const label = useMutation({
    mutationFn: () => ozonDeliveryApi.label(orderId),
    onSuccess: openPdf,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const dirty =
    point.trim() !== (data.pickupPoint?.number ?? data.pickupPoint?.id ?? '') ||
    name !== (data.recipientName ?? '') ||
    phone !== (data.recipientPhone ?? '');

  const setDim = (k: keyof Parcel) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParcel({ ...parcel, [k]: Number(e.target.value) || 0 });

  const st = s ? STATUS[s.status] : null;

  return (
    <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-gray-800">
          <Truck size={16} aria-hidden="true" /> Доставка Ozon
        </h3>
        {st && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>}
      </div>

      {!data.configured && (
        <p className="text-sm text-red-600">Ozon Доставка не подключена на сервере (нет ключей).</p>
      )}

      {/* Деньги: клиент платит фиксированно, Ozon — по факту. */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-white p-2">
          <div className="text-xs text-gray-500">Клиент заплатил</div>
          <div className="font-semibold">{rub(data.money.clientPaid)}</div>
        </div>
        <div className="rounded-lg bg-white p-2">
          <div className="text-xs text-gray-500">Ozon взял{data.money.ozonCostIsEstimate && data.money.ozonCost !== null ? ' (оценка)' : ''}</div>
          <div className="font-semibold">{rub(data.money.ozonCost)}</div>
        </div>
        <div className="rounded-lg bg-white p-2">
          <div className="text-xs text-gray-500">Заработали</div>
          <div className={`font-semibold ${data.money.earned !== null && data.money.earned < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {rub(data.money.earned)}
          </div>
        </div>
      </div>

      {/* Пункт и получатель */}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs text-gray-600">
          Пункт выдачи (номер Ozon)
          <input className={input} value={point} disabled={!editable} onChange={(e) => setPoint(e.target.value)} placeholder="например 56-27" />
        </label>
        <label className="block text-xs text-gray-600">
          Получатель
          <input className={input} value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" />
        </label>
        <label className="block text-xs text-gray-600">
          Телефон (аккаунт Ozon)
          <input className={input} value={phone} disabled={!editable} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" inputMode="tel" />
        </label>
      </div>
      {data.pickupPoint?.address && (
        <p className="text-sm text-gray-700">
          📍 {data.pickupPoint.address}
          {data.pickupPoint.schedule ? <span className="text-gray-500"> · {data.pickupPoint.schedule}</span> : null}
        </p>
      )}
      {editable && dirty && (
        <button type="button" className={`${btn} bg-gray-800 text-white hover:bg-gray-900`} disabled={saveRecipient.isPending} onClick={() => saveRecipient.mutate()}>
          {saveRecipient.isPending ? 'Проверяю пункт…' : 'Сохранить пункт и получателя'}
        </button>
      )}

      {/* Посылка */}
      {editable && (
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ['weightG', 'Вес, г'],
              ['lengthMm', 'Длина, мм'],
              ['widthMm', 'Ширина, мм'],
              ['heightMm', 'Высота, мм'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="block text-xs text-gray-600">
              {l}
              <input className={input} type="number" min={1} value={parcel[k]} onChange={setDim(k)} />
            </label>
          ))}
        </div>
      )}

      {s?.lastError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">⚠️ {s.lastError}</p>}
      {editable && data.blocker && !dirty && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Пока нельзя: {data.blocker}</p>
      )}
      {quote && <p className="text-sm text-gray-700">{quote}</p>}

      {s?.postingNumber && (
        <p className="text-sm text-gray-700">
          Отправление <span className="font-mono font-semibold">{s.postingNumber}</span>
          {s.ozonStatus ? <span className="text-gray-500"> · Ozon: {s.ozonStatus}</span> : null}
          {s.estimatedDays ? <span className="text-gray-500"> · ~{s.estimatedDays} дн.</span> : null}
        </p>
      )}
      {s && (
        <p className="text-xs text-gray-500">
          {[
            day(s.approvedAt) && `подтверждено ${day(s.approvedAt)}`,
            day(s.shippedAt) && `принято Ozon ${day(s.shippedAt)}`,
            day(s.arrivedAt) && `в пункте с ${day(s.arrivedAt)}`,
            day(s.deliveredAt) && `получено ${day(s.deliveredAt)}`,
            day(s.returnedAt) && `вернулось ${day(s.returnedAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {editable && (
          <>
            <button type="button" className={`${btn} bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50`} disabled={calc.isPending || dirty || !data.pickupPoint} onClick={() => calc.mutate()}>
              <Calculator size={14} aria-hidden="true" /> {calc.isPending ? 'Считаю…' : 'Сколько возьмёт Ozon'}
            </button>
            <button
              type="button"
              className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
              disabled={create.isPending || dirty || Boolean(data.blocker)}
              title={data.blocker ?? undefined}
              onClick={() => create.mutate()}
            >
              <Package size={14} aria-hidden="true" />
              {create.isPending ? 'Создаю в Ozon…' : s?.status === 'CREATED' && s.postingNumber ? 'Подтвердить отправление' : 'Создать отправление'}
            </button>
          </>
        )}
        {s && !['CREATED', 'CANCELLED', 'ERROR'].includes(s.status) && (
          <button type="button" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={label.isPending} onClick={() => label.mutate()}>
            <Printer size={14} aria-hidden="true" /> {label.isPending ? 'Получаю…' : 'Этикетка'}
          </button>
        )}
        {s?.postingNumber && (
          <button type="button" className={`${btn} bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50`} disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw size={14} aria-hidden="true" /> Обновить статус
          </button>
        )}
        {s && !['DELIVERED', 'RETURNED', 'CANCELLED', 'RETURNING'].includes(s.status) && (
          <button
            type="button"
            className={`${btn} bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50`}
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Отменить отправление в Ozon? Если посылка уже у Ozon, она поедет обратно к вам.')) cancel.mutate();
            }}
          >
            <Ban size={14} aria-hidden="true" /> Отменить
          </button>
        )}
      </div>
    </section>
  );
}
