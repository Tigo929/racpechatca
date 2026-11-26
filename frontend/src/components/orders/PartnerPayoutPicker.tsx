import { PAYOUT_OPTIONS, payoutOption, type PartnerPayout } from './freePresets';

/**
 * Выбор того, как платим партнёру за свободную позицию, плюс необязательная
 * своя ставка.
 *
 * Один компонент на обе формы — создание заказа и правку позиций. Пока это
 * была галочка, написанная в каждой форме отдельно, подписи у них успели
 * разойтись: в одной «платим за плёнку и долю», в другой просто «работа
 * партнёра». Человек читал разное про одно и то же поле.
 *
 * Ставка пустая по умолчанию и это нормально: тогда берётся общая из
 * настроек партнёра и фиксируется снимком при сохранении. Заполняют её,
 * только когда по конкретному заказу договорились иначе.
 */
interface Props {
  value: PartnerPayout;
  onChange: (value: PartnerPayout, presetName?: string) => void;
  /** Ставка в процентах как её видит человек («30»), пустая строка — общая. */
  ratePercent: string;
  onRateChange: (value: string) => void;
  /** Общая ставка из настроек — показываем в подсказке поля. */
  defaultRatePercent?: number;
  className?: string;
  /** Название позиции — чтобы заметить «изделие заказчика» без оплаты партнёру. */
  itemName?: string;
}

export function PartnerPayoutPicker({
  value,
  onChange,
  ratePercent,
  onRateChange,
  defaultRatePercent,
  className = '',
  itemName = '',
}: Props) {
  // 25.11.2026 позицию «на изделие заказчика» завели с «не платим»: отметка
  // «изделие клиента» тогда снималась, и лист согласования молчал.
  const clientItemMismatch =
    /издели[еяию]\s+(заказчика|клиента)/i.test(itemName) && value !== 'MARGIN_SHARE';
  const option = payoutOption(value);
  const paid = value !== 'NONE';

  return (
    <div className={`space-y-2 ${className}`}>
      <select
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        value={value}
        onChange={(e) => {
          const next = e.target.value as PartnerPayout;
          onChange(next, payoutOption(next).presetName);
        }}
      >
        {PAYOUT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <p className="text-xs text-gray-500">{option.hint}</p>

      {clientItemMismatch && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          Позиция — печать на изделии заказчика. Если наносит партнёр, выберите
          «Доля от маржи — печать по изделию заказчика».
        </p>
      )}

      {paid && (
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <span className="whitespace-nowrap">Ставка, %</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            placeholder={
              defaultRatePercent != null ? String(defaultRatePercent) : '30'
            }
            value={ratePercent}
            onChange={(e) => onRateChange(e.target.value)}
          />
          <span className="text-gray-400">
            пусто — общая из настроек
            {defaultRatePercent != null ? ` (${defaultRatePercent}%)` : ''}
          </span>
        </label>
      )}
    </div>
  );
}
