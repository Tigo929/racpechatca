import { useQuery } from '@tanstack/react-query';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { canvasProductionApi } from '../../api/canvasProduction';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { EnumCanvasMaterial } from '../../types/index';

/**
 * Прикинуть холст до заказа: сколько должен производству и сколько заработаю.
 *
 * Отдельно от позиции заказа намеренно — цену клиенту называют в переписке,
 * задолго до того, как заявка вообще появится. Заводить ради одной цифры
 * черновик заказа значит копить мусор в списке.
 *
 * Себестоимость приходит с сервера уже посчитанной: если пересчитывать скидку
 * здесь, округление разойдётся с тем, что запишется в заказ, и калькулятор
 * начнёт врать — тихо и на рубль.
 */

const money = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

export function CanvasCalculator() {
  const [open, setOpen] = usePersistentState('canvas-calc-open', false);
  const [sizeKey, setSizeKey] = usePersistentState('canvas-calc-size', '30x40');
  const [material, setMaterial] = usePersistentState<EnumCanvasMaterial>(
    'canvas-calc-material',
    'SYNTHETIC',
  );
  const [quantity, setQuantity] = usePersistentState('canvas-calc-qty', '1');
  const [clientPrice, setClientPrice] = usePersistentState('canvas-calc-price', '');
  const [withDelivery, setWithDelivery] = usePersistentState('canvas-calc-delivery', false);

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['canvas-production-pricing'],
    queryFn: canvasProductionApi.pricing,
    enabled: open,
    staleTime: 600_000,
  });

  const size = pricing?.sizes.find((s) => s.key === sizeKey);
  const qty = Math.max(1, Number(quantity) || 1);
  const unitCost = size?.cost[material] ?? 0;
  const unitRetail = size?.retail[material] ?? 0;

  // Пустая цена клиенту — считаем по рознице производства: это честный
  // ориентир «продал как они», от которого видно голую скидку.
  const unitPrice = Number(clientPrice) || unitRetail;

  const deliveryCost = withDelivery ? (pricing?.delivery.cost ?? 0) : 0;
  const deliveryPrice = withDelivery ? (pricing?.delivery.price ?? 0) : 0;

  const revenue = unitPrice * qty + deliveryPrice;
  const owed = unitCost * qty + deliveryCost;
  const profit = revenue - owed;
  const marginPercent = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Calculator size={15} className="text-amber-500" aria-hidden="true" />
          Калькулятор холста
          <span className="text-xs font-normal text-gray-500">
            сколько должен производству и сколько заработаю
          </span>
        </span>
        {open ? (
          <ChevronUp size={16} className="text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
          {isLoading || !pricing ? (
            <p className="text-sm text-gray-500">Загружаем прайс производства…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Размер</span>
                  <select
                    className={`mt-1 ${field}`}
                    value={sizeKey}
                    onChange={(e) => setSizeKey(e.target.value)}
                  >
                    {pricing.sizes.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Материал</span>
                  <select
                    className={`mt-1 ${field}`}
                    value={material}
                    onChange={(e) => setMaterial(e.target.value as EnumCanvasMaterial)}
                  >
                    <option value="SYNTHETIC">Синтетика</option>
                    <option value="COTTON">Хлопок</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Количество</span>
                  <input
                    type="number"
                    min={1}
                    className={`mt-1 ${field}`}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    Цена клиенту за шт., ₽
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={`mt-1 ${field}`}
                    placeholder={String(unitRetail)}
                    value={clientPrice}
                    onChange={(e) => setClientPrice(e.target.value)}
                  />
                  <span className="mt-1 block text-[11px] text-gray-400">
                    Пусто — считаем по рознице производства.
                  </span>
                </label>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withDelivery}
                  onChange={(e) => setWithDelivery(e.target.checked)}
                  className="h-4 w-4 accent-amber-600"
                />
                <span className="text-sm text-gray-700">
                  Доставка производства по Москве — плачу{' '}
                  {money(pricing.delivery.cost)}, называю {money(pricing.delivery.price)}
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-sm space-y-1">
                  <Line
                    label={`Розница производства × ${qty}`}
                    value={money(unitRetail * qty)}
                    muted
                  />
                  <Line
                    label={`Со скидкой ${pricing.discountBasisPoints / 100}% × ${qty}`}
                    value={money(unitCost * qty)}
                  />
                  {withDelivery && (
                    <Line label="Доставка производству" value={money(deliveryCost)} />
                  )}
                  <div className="border-t border-gray-200 pt-1">
                    <Line label="Должен производству" value={money(owed)} strong />
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-3 text-sm space-y-1 ${
                    profit >= 0
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <Line label={`Клиент платит`} value={money(revenue)} />
                  <Line label="Должен производству" value={`− ${money(owed)}`} muted />
                  <div className="border-t border-emerald-200/60 pt-1">
                    <Line
                      label="Моя прибыль"
                      value={money(profit)}
                      strong
                      tone={profit >= 0 ? 'good' : 'bad'}
                    />
                  </div>
                  <p className="pt-0.5 text-[11px] text-gray-500">
                    {revenue > 0
                      ? `${marginPercent}% от того, что платит клиент`
                      : 'Укажите цену клиенту'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  tone?: 'good' | 'bad';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-800'
      : tone === 'bad'
        ? 'text-red-700'
        : muted
          ? 'text-gray-400'
          : 'text-gray-600';
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold' : ''} ${color}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
