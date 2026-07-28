import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { UpdateOrderDto } from '../../types/index';

interface Props {
  form: UpdateOrderDto;
  onChange: (form: UpdateOrderDto) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  /** Дизайн — свободная сумма только для футболок. У фото секцию не показываем. */
  productCategory: 'PHOTO' | 'TSHIRT';
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const labelCls = 'text-xs text-gray-500 mb-1';

export function OrderEditForm({ form, onChange, onSave, onCancel, isPending, productCategory }: Props) {
  const set = (patch: Partial<UpdateOrderDto>) => onChange({ ...form, ...patch });
  // «Нужен дизайн» — включён, если у заказа уже есть сумма дизайна. Выключение
  // обнуляет сумму, чтобы дизайн ушёл из чека.
  const [designEnabled, setDesignEnabled] = useState((form.designDevelopmentCost ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={labelCls}>Платформа общения</p>
          <select className={inputCls} value={form.communicationPlatform}
            onChange={e => set({ communicationPlatform: e.target.value as UpdateOrderDto['communicationPlatform'] })}>
            <option value="AVITO">Авито</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="MAX">MAX</option>
            <option value="OZON">Ozon</option>
          </select>
        </div>
      </div>

      <div>
        <p className={labelCls}>
          {form.communicationPlatform === 'TELEGRAM' ? 'Username в Telegram' : 'Ссылка на переписку'}
        </p>
        <input
          className={inputCls}
          placeholder={form.communicationPlatform === 'TELEGRAM' ? '@username' : 'https://www.avito.ru/...'}
          value={form.urlCommunication ?? ''}
          onChange={e => set({ urlCommunication: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={labelCls}>Способ доставки</p>
          <select className={inputCls} value={form.deliveryMethod}
            onChange={e => set({ deliveryMethod: e.target.value as UpdateOrderDto['deliveryMethod'] })}>
            <option value="PICKUP">Самовывоз</option>
            <option value="YANDEX_PVZ">Яндекс ПВЗ</option>
            <option value="OZON_PVZ">Ozon ПВЗ</option>
            <option value="OZON_SELLER">Ozon Продавец</option>
            <option value="WB_SELLER">WB Продавец</option>
          </select>
        </div>
        <div>
          <p className={labelCls}>Стоимость доставки, ₽</p>
          <input type="number" min={0} className={inputCls} value={form.deliveryCost}
            onChange={e => set({ deliveryCost: Number(e.target.value) })} />
        </div>
      </div>

      {/* Дизайн — только футболки. Кнопка «Нужен дизайн» раскрывает сумму;
          её можно менять и добавлять к уже созданному заказу. */}
      {productCategory === 'TSHIRT' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={designEnabled}
              onChange={e => {
                const on = e.target.checked;
                setDesignEnabled(on);
                // Выключили — сумма дизайна уходит из чека; включили — база под ввод.
                set({ designDevelopmentCost: on ? (form.designDevelopmentCost ?? 0) : 0 });
              }}
              className="w-4 h-4 accent-amber-600"
            />
            <span className="text-sm font-medium text-gray-800">Нужен дизайн</span>
          </label>
          {designEnabled && (
            <div>
              <p className={labelCls}>Стоимость разработки дизайна, ₽</p>
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="1000"
                value={form.designDevelopmentCost ?? 0}
                onChange={e => set({ designDevelopmentCost: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Входит в чек клиента отдельной суммой. От неё считается премия менеджера по оформлению.
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <p className={labelCls}>Примечание</p>
        <textarea rows={2} className={inputCls + ' resize-none'} value={form.note ?? ''}
          onChange={e => set({ note: e.target.value })} />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          <X size={13} /> Отмена
        </button>
        <button onClick={onSave} disabled={isPending}
          className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60">
          <Check size={13} /> {isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
