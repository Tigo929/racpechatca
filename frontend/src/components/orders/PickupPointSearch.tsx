import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search } from 'lucide-react';
import { ozonDeliveryApi, type FoundPoint } from '../../api/ozonDelivery';

/**
 * Выбор пункта выдачи Ozon по адресу — для заявок, которые менеджер
 * заводит сам. Клиент присылает адрес («Москва, Сиреневый бульвар 4/1»),
 * его вставляют сюда, CRM показывает пункты из справочника Ozon, нажатие
 * на пункт сразу сохраняет его в заказ. Номер пункта знать не нужно,
 * но если он есть — по нему тоже найдётся.
 */
export function PickupPointSearch({
  onPick,
  onCancel,
  saving,
  currentId,
}: {
  onPick: (p: FoundPoint) => void;
  onCancel?: () => void;
  saving: boolean;
  currentId?: string | null;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  // Ищем, когда перестали печатать: вставка адреса — один запрос.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const found = useQuery({
    queryKey: ['ozon-points-find', q],
    queryFn: () => ozonDeliveryApi.findPoints(q),
    enabled: q.length >= 3,
    staleTime: 5 * 60_000,
  });
  const points = found.data?.points ?? [];

  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            autoFocus
            className="w-full min-w-0 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставьте адрес от клиента: Москва, Сиреневый бульвар 4/1"
            aria-label="Адрес пункта выдачи"
          />
          {found.isFetching && (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
              aria-hidden="true"
            />
          )}
        </label>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-100"
          >
            Отмена
          </button>
        )}
      </div>

      {q.length < 3 ? (
        <p className="text-xs text-gray-400">Город, улица и дом — или номер пункта, если клиент его прислал.</p>
      ) : found.isError ? (
        <p className="text-sm text-red-600">Поиск не сработал — попробуйте ещё раз.</p>
      ) : found.data && !points.length ? (
        <p className="text-sm text-gray-500">
          Пунктов Ozon по этому адресу не нашлось. Уберите лишнее (номер квартиры, «корпус») или проверьте город.
        </p>
      ) : points.length ? (
        <>
          {!found.data?.exact && (
            <p className="text-xs text-amber-700">Точно такого адреса нет — вот пункты рядом, на той же улице.</p>
          )}
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {points.map((p) => {
              const current = currentId === String(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onPick(p)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-blue-50 disabled:opacity-60"
                  >
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900">{p.address}</span>
                      <span className="block text-xs text-gray-500">
                        {p.number ? `№ ${p.number}` : `id ${p.id}`}
                        {p.schedule ? ` · ${p.schedule}` : ''}
                        {p.type?.toLowerCase() === 'postamat' ? ' · постамат' : ''}
                      </span>
                    </span>
                    {current ? (
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-label="выбран" />
                    ) : (
                      <span className="shrink-0 self-center text-xs font-medium text-blue-600">Выбрать</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
