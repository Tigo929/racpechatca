import { Check, X } from 'lucide-react';
import type { UpdateOrderDto } from '../types';

interface Props {
  form: UpdateOrderDto;
  onChange: (form: UpdateOrderDto) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const labelCls = 'text-xs text-gray-500 mb-1';

export function OrderEditForm({ form, onChange, onSave, onCancel, isPending }: Props) {
  const set = (patch: Partial<UpdateOrderDto>) => onChange({ ...form, ...patch });

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
