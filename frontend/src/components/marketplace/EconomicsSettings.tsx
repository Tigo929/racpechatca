import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Coins } from 'lucide-react';
import {
  ozonProductCatalogApi, type UnitEconomicsSettings,
} from '../../api/ozonProductCatalog';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Себестоимость и расходы продавца — одни на весь кабинет: товар один тип,
 * футболка с принтом, и заготовка с нанесением стоят одинаково везде.
 *
 * Тарифы площадки (комиссия, логистика, эквайринг) сюда не входят: они свои
 * у каждого товара и читаются из Ozon.
 */

const field =
  'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

function NumField({ label, value, onChange, suffix, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">
        {label}{suffix ? `, ${suffix}` : ''}
      </span>
      <input
        type="number"
        min={0}
        step="any"
        className={`mt-1 ${field}`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

export function EconomicsSettings({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['ozon-economics-settings', accountId],
    queryFn: () => ozonProductCatalogApi.economicsSettings(accountId),
    enabled: open,
  });

  const [draft, setDraft] = useState<Partial<UnitEconomicsSettings>>({});
  const value = { ...data, ...draft } as UnitEconomicsSettings | undefined;

  const save = useMutation({
    mutationFn: () => ozonProductCatalogApi.updateEconomicsSettings(accountId, draft),
    onSuccess: (updated) => {
      qc.setQueryData(['ozon-economics-settings', accountId], updated);
      // Экономика по всем товарам пересчитывается от этих цифр.
      qc.invalidateQueries({ queryKey: ['ozon-economics'] });
      setDraft({});
      toast.success('Себестоимость сохранена — экономика пересчитана');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  const set = <K extends keyof UnitEconomicsSettings>(k: K, v: UnitEconomicsSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Coins size={15} className="text-amber-500" aria-hidden="true" />
          Себестоимость и расходы
        </span>
        {open
          ? <ChevronUp size={16} className="text-gray-400" aria-hidden="true" />
          : <ChevronDown size={16} className="text-gray-400" aria-hidden="true" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            Эти значения одинаковы для всех товаров кабинета и участвуют в расчёте
            юнит-экономики каждой карточки. Комиссию и логистику задаёт Ozon —
            их вводить не нужно.
          </p>

          {isLoading || !value ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <NumField label="Футболка с принтом" suffix="₽" value={value.blankCost}
                  onChange={(v) => set('blankCost', v)}
                  hint="готовое изделие" />
                <NumField label="Нанесение отдельно" suffix="₽" value={value.printCost}
                  onChange={(v) => set('printCost', v)}
                  hint="0, если уже в цене изделия" />
                <NumField label="Упаковка" suffix="₽" value={value.packagingCost}
                  onChange={(v) => set('packagingCost', v)} />
                <NumField label="Прочее на единицу" suffix="₽" value={value.otherCost}
                  onChange={(v) => set('otherCost', v)} />
              </div>

              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-600">Итого себестоимость единицы</span>
                <span className="text-sm font-semibold tabular-nums text-gray-900">
                  {(value.blankCost + value.printCost + value.packagingCost + value.otherCost)
                    .toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <NumField label="Возвраты" suffix="%" value={value.returnRatePercent}
                  onChange={(v) => set('returnRatePercent', v)}
                  hint="доля заказов, которые вернут" />
                <NumField label="Реклама" suffix="% от цены" value={value.advertisingPercent}
                  onChange={(v) => set('advertisingPercent', v)} />
                <NumField label="Налог" suffix="%" value={value.taxPercent}
                  onChange={(v) => set('taxPercent', v)}
                  hint="0 — пока не платите" />
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">База налога</span>
                  <select className={`mt-1 ${field}`} value={value.taxBase}
                    onChange={(e) => set('taxBase', e.target.value as 'income' | 'profit')}>
                    <option value="income">УСН «доходы» — с выручки</option>
                    <option value="profit">С прибыли</option>
                  </select>
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    Налог берётся со всей цены, а не с остатка. У самозанятого
                    (НПД) это 4% с продаж физлицам — поставьте, когда закончится
                    налоговый вычет.
                  </span>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Логистика по вилке Ozon</span>
                  <select className={`mt-1 ${field}`} value={value.logisticsMode}
                    onChange={(e) => set('logisticsMode', e.target.value as 'min' | 'max')}>
                    <option value="max">По верхней границе — осторожно</option>
                    <option value="min">По нижней границе — оптимистично</option>
                  </select>
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    Ozon отдаёт диапазон, разница бывает втрое.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    Своя комиссия, % (пусто — как отдаёт Ozon)
                  </span>
                  <input
                    type="number" min={0} max={100} step="any" className={`mt-1 ${field}`}
                    value={value.commissionOverridePercent ?? ''}
                    onChange={(e) =>
                      set('commissionOverridePercent', e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="как в Ozon"
                  />
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    Если процент из API расходится с реальным отчётом.
                  </span>
                </label>
              </div>

              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || Object.keys(draft).length === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {save.isPending ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
