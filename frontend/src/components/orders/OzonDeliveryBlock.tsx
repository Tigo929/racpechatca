import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Ban,
  Calculator,
  MapPin,
  Package,
  Pencil,
  Printer,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react';
import {
  ozonDeliveryApi,
  openPdf,
  type DeliveryView,
  type Parcel,
  type ShipmentStatus,
} from '../../api/ozonDelivery';
import { getErrorMessage } from '../../utils/get-error-message';
import { PickupPointSearch } from './PickupPointSearch';

/**
 * Доставка Ozon в карточке заказа.
 *
 * Всё, что раньше набиралось руками в кабинете Ozon, — здесь: пункт выдачи,
 * получатель, размеры посылки. Кнопка «Создать отправление» сама передаёт
 * это в Ozon, подтверждает и даёт этикетку. Создать нельзя, пока заказ не
 * оплачен полностью: Ozon не берёт оплату при получении.
 *
 * Блок идёт во всю ширину карточки, разделами «Куда / Кому / Посылка /
 * Деньги». Заполненное показывается текстом, поля открываются карандашом:
 * в первой версии всё было полями в узкой колонке, и имя с телефоном
 * обрезались до «Виктор…» и «+79169…».
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
  'w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
const btn =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:opacity-50';
const sectionLabel = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';
const pencilBtn =
  'rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700';

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

  if (isLoading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">Доставка Ozon: загружаю…</div>;
  }
  if (error || !data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Доставка Ozon: {getErrorMessage(error, 'не загрузилась')}</div>;
  }
  return <Inner orderId={orderId} data={data} put={put} />;
}

function Inner({ orderId, data, put }: { orderId: string; data: DeliveryView; put: (v: DeliveryView) => void }) {
  const s = data.shipment;
  const editable = !s || ['CREATED', 'CANCELLED', 'ERROR'].includes(s.status);
  const pointValue = data.pickupPoint?.number ?? data.pickupPoint?.id ?? '';

  // Пункт и получатель — текстом; поля открываются только для правки.
  const [editingWhere, setEditingWhere] = useState(!data.pickupPoint);
  const [editingWho, setEditingWho] = useState(!data.recipientName || !data.recipientPhone);
  const [editingParcel, setEditingParcel] = useState(false);
  const [name, setName] = useState(data.recipientName ?? '');
  const [phone, setPhone] = useState(data.recipientPhone ?? '');
  const [parcel, setParcel] = useState<Parcel>(s?.parcel ?? data.defaultParcel);
  const [quote, setQuote] = useState<string | null>(null);

  const resetEdits = (v: DeliveryView) => {
    setName(v.recipientName ?? '');
    setPhone(v.recipientPhone ?? '');
    setEditingWhere(!v.pickupPoint);
    setEditingWho(!v.recipientName || !v.recipientPhone);
  };

  const save = useMutation({
    mutationFn: () =>
      ozonDeliveryApi.setDelivery(orderId, {
        recipientName: name,
        recipientPhone: phone,
      }),
    onSuccess: (v) => {
      put(v);
      resetEdits(v);
      toast.success('Сохранено');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  // Пункт из поиска сохраняется сразу по нажатию — без кнопки «Сохранить».
  const pick = useMutation({
    mutationFn: (id: number) => ozonDeliveryApi.setDelivery(orderId, { pickupPoint: String(id) }),
    onSuccess: (v) => {
      put(v);
      setEditingWhere(false);
      toast.success('Пункт выдачи сохранён');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const calc = useMutation({
    mutationFn: () => ozonDeliveryApi.quote(orderId, parcel),
    onSuccess: (q) =>
      setQuote(
        `Ozon возьмёт примерно ${rub((q.deliveryCost ?? 0) + (q.insuranceCost ?? 0))}: доставка ${rub(q.deliveryCost)} + страховка ${rub(q.insuranceCost)}${q.days ? `, в пути ~${q.days} дн.` : ''}`,
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
      toast.success('Отмена отправлена в Ozon');
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
    name !== (data.recipientName ?? '') || phone !== (data.recipientPhone ?? '');
  const setDim = (k: keyof Parcel) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParcel({ ...parcel, [k]: Number(e.target.value) || 0 });
  const st = s ? STATUS[s.status] : null;
  const earned = data.money.earned;
  const cm = (mm: number) => (mm / 10).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  const timeline = s
    ? [
        day(s.approvedAt) && `подтверждено ${day(s.approvedAt)}`,
        day(s.shippedAt) && `принято Ozon ${day(s.shippedAt)}`,
        day(s.arrivedAt) && `в пункте с ${day(s.arrivedAt)}`,
        day(s.deliveredAt) && `получено ${day(s.deliveredAt)}`,
        day(s.returnedAt) && `вернулось ${day(s.returnedAt)}`,
      ].filter(Boolean)
    : [];

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Шапка: что это и в каком состоянии */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
          <Truck size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight text-gray-900">Доставка Ozon</h3>
          {s?.postingNumber ? (
            <p className="text-xs text-gray-500">
              Отправление <span className="font-mono text-gray-700">{s.postingNumber}</span>
              {s.ozonStatus ? ` · Ozon: ${s.ozonStatus}` : ''}
            </p>
          ) : (
            <p className="text-xs text-gray-500">Пункт, получатель и посылка уходят в Ozon сами — в кабинете ничего не набирать</p>
          )}
        </div>
        {st && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>}
      </header>

      {!data.configured && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          Ozon Доставка не подключена на сервере (нет ключей).
        </p>
      )}

      <div className="divide-y divide-gray-100">
        {/* Куда */}
        <div className="flex gap-3 px-4 py-3">
          <MapPin size={18} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className={sectionLabel}>Куда</div>
            {editingWhere && editable ? (
              <PickupPointSearch
                saving={pick.isPending}
                currentId={data.pickupPoint?.id}
                onPick={(p) => pick.mutate(p.id)}
                onCancel={data.pickupPoint ? () => setEditingWhere(false) : undefined}
              />
            ) : data.pickupPoint ? (
              <div className="mt-0.5 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{data.pickupPoint.address ?? `Пункт ${pointValue}`}</div>
                  <div className="text-xs text-gray-500">
                    Пункт № {pointValue}
                    {data.pickupPoint.schedule ? ` · ${data.pickupPoint.schedule}` : ''}
                  </div>
                </div>
                {editable && (
                  <button type="button" onClick={() => setEditingWhere(true)} className={pencilBtn} aria-label="Изменить пункт">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-0.5 text-sm text-gray-400">не выбран</div>
            )}
          </div>
        </div>

        {/* Кому */}
        <div className="flex gap-3 px-4 py-3">
          <User size={18} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className={sectionLabel}>Кому</div>
            {editingWho && editable ? (
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и фамилия" />
                <input
                  className={input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 900 000-00-00"
                  inputMode="tel"
                />
                <span className="text-xs text-gray-400 sm:col-span-2">
                  Телефон — тот, на который у клиента аккаунт Ozon: по нему выдают посылку
                </span>
              </div>
            ) : (
              <div className="mt-0.5 flex items-start gap-2">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-gray-900">{data.recipientName ?? '—'}</span>
                  <span className="text-gray-500"> · {data.recipientPhone ?? 'нет телефона'}</span>
                </div>
                {editable && (
                  <button type="button" onClick={() => setEditingWho(true)} className={pencilBtn} aria-label="Изменить получателя">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {dirty && editable && (
          <div className="flex flex-wrap items-center gap-2 bg-amber-50/70 px-4 py-2.5">
            <span className="flex-1 text-xs text-amber-800">Изменения не сохранены</span>
            <button type="button" className="text-xs font-medium text-gray-500 hover:text-gray-800" onClick={() => resetEdits(data)}>
              Отменить
            </button>
            <button
              type="button"
              className={`${btn} min-h-8 bg-gray-900 text-white hover:bg-black`}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Проверяю пункт…' : 'Сохранить'}
            </button>
          </div>
        )}

        {/* Посылка */}
        <div className="flex gap-3 px-4 py-3">
          <Package size={18} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className={sectionLabel}>Посылка</div>
            {editingParcel && editable ? (
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ['weightG', 'Вес, г'],
                    ['lengthMm', 'Длина, мм'],
                    ['widthMm', 'Ширина, мм'],
                    ['heightMm', 'Высота, мм'],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="block text-xs text-gray-500">
                    {l}
                    <input className={`${input} mt-1`} type="number" min={1} value={parcel[k]} onChange={setDim(k)} />
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-0.5 flex items-start gap-2">
                <div className="flex-1 text-sm text-gray-900">
                  {parcel.weightG} г · {cm(parcel.lengthMm)} × {cm(parcel.widthMm)} × {cm(parcel.heightMm)} см
                  {!s && <span className="text-xs text-gray-400"> · обычный размер для этого товара</span>}
                </div>
                {editable && (
                  <button type="button" onClick={() => setEditingParcel(true)} className={pencilBtn} aria-label="Изменить размер посылки">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Деньги — тремя колонками во всю ширину, подписи не обрезаются */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
          <div className="px-2 py-3">
            <div className={sectionLabel}>Клиент заплатил</div>
            <div className="mt-0.5 font-semibold tabular-nums text-gray-900">{rub(data.money.clientPaid)}</div>
          </div>
          <div className="px-2 py-3">
            <div className={sectionLabel}>
              Ozon взял{data.money.ozonCostIsEstimate && data.money.ozonCost !== null ? ' ≈' : ''}
            </div>
            <div className="mt-0.5 font-semibold tabular-nums text-gray-900">{rub(data.money.ozonCost)}</div>
          </div>
          <div className="px-2 py-3">
            <div className={sectionLabel}>Заработали</div>
            <div
              className={`mt-0.5 font-semibold tabular-nums ${
                earned === null ? 'text-sm font-normal text-gray-400' : earned < 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {earned === null ? 'после отправки' : `${earned > 0 ? '+' : ''}${rub(earned)}`}
            </div>
          </div>
        </div>
      </div>

      {/* Сообщения */}
      {(s?.lastError || (editable && data.blocker && !dirty) || quote || timeline.length > 0) && (
        <div className="space-y-2 border-t border-gray-100 px-4 py-3">
          {s?.lastError && (
            <p className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {s.lastError}
            </p>
          )}
          {editable && data.blocker && !dirty && (
            <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {data.blocker}
            </p>
          )}
          {quote && <p className="text-sm text-gray-700">{quote}</p>}
          {timeline.length > 0 && <p className="text-xs text-gray-500">{timeline.join(' · ')}</p>}
        </div>
      )}

      {/* Действия */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-3">
        {editable && (
          <>
            <button
              type="button"
              className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
              disabled={create.isPending || dirty || Boolean(data.blocker)}
              title={data.blocker ?? undefined}
              onClick={() => create.mutate()}
            >
              <Package size={14} aria-hidden="true" />
              {create.isPending
                ? 'Создаю в Ozon…'
                : s?.status === 'CREATED' && s.postingNumber
                  ? 'Подтвердить отправление'
                  : 'Создать отправление'}
            </button>
            <button
              type="button"
              className={`${btn} bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50`}
              disabled={calc.isPending || dirty || !data.pickupPoint || !data.recipientPhone}
              onClick={() => calc.mutate()}
            >
              <Calculator size={14} aria-hidden="true" /> {calc.isPending ? 'Считаю…' : 'Сколько возьмёт Ozon'}
            </button>
          </>
        )}
        {s && !['CREATED', 'CANCELLED', 'ERROR'].includes(s.status) && (
          <button
            type="button"
            className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
            disabled={label.isPending}
            onClick={() => label.mutate()}
          >
            <Printer size={14} aria-hidden="true" /> {label.isPending ? 'Получаю…' : 'Печать этикетки'}
          </button>
        )}
        {s?.postingNumber && (
          <button
            type="button"
            className={`${btn} bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50`}
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            <RefreshCw size={14} className={sync.isPending ? 'animate-spin' : ''} aria-hidden="true" /> Обновить статус
          </button>
        )}
        {s && !['DELIVERED', 'RETURNED', 'CANCELLED', 'RETURNING'].includes(s.status) && (
          <button
            type="button"
            className={`${btn} ml-auto text-red-600 hover:bg-red-50`}
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Отменить отправление в Ozon? Если посылка уже у Ozon, она поедет обратно к вам.')) {
                cancel.mutate();
              }
            }}
          >
            <Ban size={14} aria-hidden="true" /> Отменить
          </button>
        )}
      </footer>
    </section>
  );
}
