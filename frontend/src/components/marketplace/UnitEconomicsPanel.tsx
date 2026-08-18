import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Info } from 'lucide-react';
import {
  ozonProductCatalogApi, type ProductEconomics,
} from '../../api/ozonProductCatalog';

/**
 * Юнит-экономика товара построчно: сколько забирает Ozon, сколько стоит сам
 * товар, что остаётся продавцу.
 *
 * Показываем каждую строку отдельно намеренно — владелец хочет сверять цифры
 * с отчётом Ozon и понимать, из чего они складываются, а не доверять одному
 * итогу. Тарифы читаются из Ozon при каждом открытии: комиссия и логистика
 * меняются на его стороне.
 */

const money = (v: number) =>
  `${v < 0 ? '−' : ''}${Math.abs(Math.round(v)).toLocaleString('ru-RU')} ₽`;

function Line({ label, amount, hint, strong }: {
  label: string;
  amount: number;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? 'font-semibold' : ''}`}>
      <div className="min-w-0">
        <span className={`text-sm ${strong ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
        {hint && <span className="ml-2 text-[11px] text-gray-400">{hint}</span>}
      </div>
      <span className={`flex-shrink-0 text-sm tabular-nums ${
        strong ? 'text-gray-900' : amount < 0 ? 'text-red-600' : 'text-gray-700'
      }`}>
        {money(amount)}
      </span>
    </div>
  );
}

export function UnitEconomicsPanel({
  accountId, offerId, price,
}: {
  accountId: string;
  offerId: string;
  /** Цена из карточки; в поле «что если» её можно переопределить. */
  price: number;
}) {
  const [whatIf, setWhatIf] = useState('');
  /*
   * Поле ввода живёт отдельно от запроса. Раньше цена уходила в queryKey
   * прямо из поля, и каждое нажатие клавиши било запросом на сервер: пока
   * набираешь «3500», уходит четыре запроса, и цифры на экране скачут за
   * каждой из них. Отсюда и ощущение «ввожу — жду».
   *
   * Теперь набор мгновенный, а пересчёт идёт через полсекунды после того,
   * как человек закончил печатать.
   */
  const [settledPrice, setSettledPrice] = useState(price);

  useEffect(() => {
    const value = Number(whatIf);
    const next = value > 0 ? value : price;
    const timer = setTimeout(() => setSettledPrice(next), 500);
    return () => clearTimeout(timer);
  }, [whatIf, price]);

  const { data, isFetching } = useQuery<ProductEconomics>({
    queryKey: ['ozon-economics', accountId, offerId, settledPrice],
    queryFn: () => ozonProductCatalogApi.economicsPreview(accountId, offerId, settledPrice),
    // Тарифы площадки живут своей жизнью — держим свежими, но не дёргаем
    // Ozon на каждый символ в поле цены.
    staleTime: 60_000,
    // Пока считается новая цена, показываем прошлый расчёт: иначе панель
    // схлопывается в «Считаем…» и вёрстка прыгает на каждой правке.
    placeholderData: (prev) => prev,
  });

  if (!data) {
    return <p className="text-sm text-gray-500">Считаем юнит-экономику…</p>;
  }

  const e = data?.economics;
  const t = data?.tariffs;

  if (!e || !t) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
        Ozon не отдал тарифы по этому товару — посчитать экономику нечем.
        Обычно так бывает у товара без цены или в архиве.
      </div>
    );
  }

  const profitable = e.profit > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Calculator size={15} className="text-amber-500" aria-hidden="true" />
          Юнит-экономика
        </h3>
        <label className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Что если цена</span>
          <input
            type="number"
            value={whatIf}
            onChange={(ev) => setWhatIf(ev.target.value)}
            placeholder={String(price)}
            className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {/* Спокойная подпись вместо «Считаем…» во всю панель: цифры на
              экране остаются прежними, пока не придёт новый расчёт. */}
          {isFetching && <span className="text-[11px] text-gray-400">пересчитываем…</span>}
        </label>
      </div>

      {/* Итог крупно — на него смотрят первым */}
      <div className={`rounded-xl border p-4 ${
        profitable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={`text-sm font-medium ${profitable ? 'text-emerald-900' : 'text-red-900'}`}>
            {profitable ? 'Остаётся с одной продажи' : 'Убыток с одной продажи'}
          </span>
          <span className={`text-2xl font-bold tabular-nums ${profitable ? 'text-emerald-700' : 'text-red-700'}`}>
            {money(e.profit)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className={profitable ? 'text-emerald-800' : 'text-red-800'}>
            рентабельность {e.marginPercent}% от цены
          </span>
          <span className={profitable ? 'text-emerald-800' : 'text-red-800'}>
            наценка {e.markupPercent}% к себестоимости
          </span>
          <span className={profitable ? 'text-emerald-800' : 'text-red-800'}>
            ноль при цене {money(e.breakEvenPrice)}
          </span>
        </div>
      </div>

      {/* Раскладка */}
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-4 py-2">
          <Line label="Цена продажи" amount={e.price} strong />
        </div>

        <div className="px-4 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Забирает Ozon</p>
          {e.marketplaceLines.map((l) => (
            <Line key={l.key} label={l.label} amount={l.amount} hint={l.hint} />
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <Line label="Выплата от Ozon" amount={e.payout} strong />
          </div>
        </div>

        <div className="px-4 py-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Расходы продавца</p>
          {e.sellerLines.map((l) => (
            <Line key={l.key} label={l.label} amount={l.amount} hint={l.hint} />
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <Line label="Прибыль до налога" amount={e.profitBeforeTax} strong />
          </div>
        </div>

        <div className="px-4 py-2">
          <Line label="Налог" amount={-e.tax} />
          <div className="border-t border-gray-100 mt-1 pt-1">
            <Line label="Чистая прибыль" amount={e.profit} strong />
          </div>
        </div>
      </div>

      {/* Тарифы, как их отдаёт Ozon — чтобы было с чем сверять */}
      <details className="rounded-xl border border-gray-200 p-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-600">
          Тарифы Ozon по этому товару
        </summary>
        <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
          <span>Комиссия FBS: {t.commissionPercent}%</span>
          <span>Эквайринг: {money(t.acquiring)}</span>
          <span>Первая миля: {money(t.firstMileMin)} – {money(t.firstMileMax)}</span>
          <span>Прямая логистика: {money(t.directFlowMin)} – {money(t.directFlowMax)}</span>
          <span>Последняя миля: {money(t.lastMile)}</span>
          <span>Обратная логистика: {money(t.returnFlow)}</span>
        </div>
        {t.marketingActions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mb-1">
              Маркетинговые механики Ozon (их процент уже может сидеть в комиссии):
            </p>
            {t.marketingActions.slice(0, 6).map((a) => (
              <div key={a.title} className="flex justify-between gap-2 text-[11px] text-gray-500">
                <span className="truncate">{a.title}</span>
                <span className="flex-shrink-0">{a.percent}%</span>
              </div>
            ))}
          </div>
        )}
      </details>

      <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-100 p-3">
        <Info size={13} className="text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <p className="text-[11px] text-gray-500">
          Логистика считается по верхней границе вилки Ozon — оценка осторожная.
          Себестоимость и налог берутся из настроек раздела и одинаковы для всех
          товаров. Если итог расходится с отчётом Ozon, поправьте комиссию в
          настройках: по некоторым кабинетам в неё зашиты проценты акций.
        </p>
      </div>
    </div>
  );
}
