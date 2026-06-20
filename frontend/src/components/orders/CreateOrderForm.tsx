import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Camera, Shirt } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi } from '../../api/orders';
import {
  TSHIRT_COLORS,
  TSHIRT_SIZE_LABELS,
  PRINT_LOCATION_LABELS,
} from '../../constants';
import type { CreateOrderDto } from '../../types/index';

const photoItemSchema = z.object({
  formatPaper: z.string().min(1, 'Укажите формат'),
  typePaper: z.enum(['GLOSS', 'MATTE']),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().positive(),
});

const tshirtItemSchema = z.object({
  color: z.string().min(1, 'Укажите цвет'),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']),
  printLocation: z.enum(['FRONT', 'BACK', 'FRONT_BACK', 'BY_TZ']),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().min(0),
  designCost: z.coerce.number().int().min(0).optional(),
  designUrl: z.string().optional(),
  designNote: z.string().optional(),
});

// Свободная позиция: произвольное название + цена. Имя не валидируем строго здесь
// (скрытые строки не должны рушить форму) — проверяем в superRefine при freePrice.
const freeItemSchema = z.object({
  name: z.string(),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().min(0),
});

const baseSchema = z.object({
  productCategory: z.enum(['PHOTO', 'TSHIRT']),
  sourceOrder: z.enum(['AVITO', 'OZON', 'WB', 'LOCAL']),
  communicationPlatform: z.enum(['AVITO', 'TELEGRAM', 'MAX', 'OZON']),
  urlCommunication: z.string().min(1, 'Укажите ссылку или @username'),
  deliveryMethod: z.enum(['YANDEX_PVZ', 'OZON_PVZ', 'PICKUP', 'OZON_SELLER', 'WB_SELLER']),
  deliveryCost: z.coerce.number().int().min(0),
  note: z.string().optional(),
  freePrice: z.boolean().optional(),
  freeItems: z.array(freeItemSchema).optional(),
  items: z.array(photoItemSchema).optional(),
  tshirtItems: z.array(tshirtItemSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.communicationPlatform === 'TELEGRAM' && !data.urlCommunication.startsWith('@')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Для Telegram укажите @username (должно начинаться с @)',
      path: ['urlCommunication'],
    });
  }
  if (
    (data.communicationPlatform === 'AVITO' || data.communicationPlatform === 'OZON' || data.communicationPlatform === 'MAX') &&
    data.urlCommunication.length > 0 &&
    !data.urlCommunication.startsWith('http')
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Укажите полную ссылку (начинается с https://)',
      path: ['urlCommunication'],
    });
  }
});

// Схема для обычной заявки (позиции обязательны)
const fullSchema = baseSchema.superRefine((data, ctx) => {
  // Свободная цена: вместо позиций — произвольные строки «название — цена».
  if (data.freePrice) {
    const fi = data.freeItems ?? [];
    if (fi.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Добавьте хотя бы один товар', path: ['freeItems'] });
    } else {
      fi.forEach((it, i) => {
        if (!it.name || !it.name.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Укажите название', path: ['freeItems', i, 'name'] });
        }
      });
    }
    return;
  }
  if (data.productCategory === 'PHOTO' && (!data.items || data.items.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Добавьте хотя бы одну позицию', path: ['items'] });
  }
  if (data.productCategory === 'TSHIRT' && (!data.tshirtItems || data.tshirtItems.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Добавьте хотя бы одну позицию', path: ['tshirtItems'] });
  }
});

type FormValues = z.infer<typeof baseSchema>;
interface Props { onClose: () => void }


const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const selectCls = inputCls;
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'text-red-500 text-xs mt-1';

export function CreateOrderForm({ onClose }: Props) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, getValues, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      productCategory: 'PHOTO',
      sourceOrder: 'AVITO' as const,
      communicationPlatform: 'TELEGRAM',
      deliveryMethod: 'PICKUP',
      deliveryCost: 0,
      freePrice: false,
      freeItems: [{ name: '', quantity: 1, price: 0 }],
      items: [{ formatPaper: '', typePaper: 'GLOSS', quantity: 1, price: 10 }],
      tshirtItems: [{
        color: 'Белый', size: 'M', printLocation: 'FRONT',
        quantity: 1, price: 500, designCost: 0, designUrl: '', designNote: '',
      }],
    },
  });

  const productCategory = useWatch({ control, name: 'productCategory' });
  const communicationPlatform = useWatch({ control, name: 'communicationPlatform' });
  const freePrice = useWatch({ control, name: 'freePrice' });

  // Чистим/восстанавливаем позиции, чтобы Zod не падал на скрытых полях:
  // при свободной цене позиций нет вовсе; иначе — одна позиция активной категории.
  useEffect(() => {
    if (freePrice) {
      setValue('items', []);
      setValue('tshirtItems', []);
      return;
    }
    if (productCategory === 'TSHIRT') {
      setValue('items', []);
      if ((getValues('tshirtItems')?.length ?? 0) === 0) {
        setValue('tshirtItems', [{
          color: 'Белый', size: 'M', printLocation: 'FRONT',
          quantity: 1, price: 500, designCost: 0, designUrl: '', designNote: '',
        }]);
      }
    } else {
      setValue('tshirtItems', []);
      if ((getValues('items')?.length ?? 0) === 0) {
        setValue('items', [{ formatPaper: '', typePaper: 'GLOSS', quantity: 1, price: 10 }]);
      }
    }
  }, [freePrice, productCategory, setValue, getValues]);

  const photoFields = useFieldArray({ control, name: 'items' });
  const tshirtFields = useFieldArray({ control, name: 'tshirtItems' });
  const freeFields = useFieldArray({ control, name: 'freeItems' });

  const mutation = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(vars.status === 'LEAD' ? 'Обращение записано' : 'Заявка создана');
      onClose();
    },
    onError: () => toast.error('Ошибка при создании заявки'),
  });

  const onSubmit = (data: FormValues) => {
    if (data.freePrice) {
      // Свободные строки «название — цена» сохраняем как позиции (формат = название).
      const freeItems = (data.freeItems ?? []).filter((i) => i.name.trim());
      mutation.mutate({
        sourceOrder: data.sourceOrder,
        communicationPlatform: data.communicationPlatform,
        urlCommunication: data.urlCommunication,
        deliveryMethod: data.deliveryMethod,
        deliveryCost: data.deliveryCost,
        note: data.note,
        productCategory: data.productCategory,
        freePrice: true,
        items: freeItems.map((i) => ({
          // Свободная цена: цена — это итог позиции; количество сохраняется,
          // но на сервере на цену НЕ умножается (заказ помечен isFreePrice).
          formatPaper: i.name.trim(),
          typePaper: 'GLOSS',
          quantity: i.quantity,
          price: i.price,
        })),
      });
      return;
    }
    mutation.mutate({
      sourceOrder: data.sourceOrder,
      communicationPlatform: data.communicationPlatform,
      urlCommunication: data.urlCommunication,
      deliveryMethod: data.deliveryMethod,
      deliveryCost: data.deliveryCost,
      note: data.note,
      productCategory: data.productCategory,
      items: data.productCategory === 'PHOTO' ? data.items : undefined,
      tshirtItems: data.productCategory === 'TSHIRT' ? data.tshirtItems : undefined,
    });
  };

  // Создать обращение (LEAD) — позиции не обязательны
  const onSubmitLead = () => {
    const data = getValues();
    const url = data.urlCommunication ?? '';
    // Минимальная проверка: ссылка/username не пустая
    if (!url || url.trim() === '') {
      toast.error('Укажите ссылку или @username');
      return;
    }
    if (data.communicationPlatform === 'TELEGRAM' && !url.startsWith('@')) {
      toast.error('Для Telegram укажите @username (начинается с @)');
      return;
    }
    if (data.communicationPlatform !== 'TELEGRAM' && !url.startsWith('http')) {
      toast.error('Укажите полную ссылку (начинается с https://)');
      return;
    }
    const lead: CreateOrderDto = {
      sourceOrder: data.sourceOrder ?? 'AVITO',
      communicationPlatform: data.communicationPlatform,
      urlCommunication: url,
      deliveryMethod: data.deliveryMethod ?? 'PICKUP',
      deliveryCost: data.deliveryCost ?? 0,
      note: data.note,
      productCategory: data.productCategory ?? 'PHOTO',
      status: 'LEAD',
      items: undefined,
      tshirtItems: undefined,
    };
    mutation.mutate(lead);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Категория товара */}
      <div>
        <label className={labelCls}>Категория товара</label>
        <div className="grid grid-cols-2 gap-3">
          {([['PHOTO', 'Фотопечать', Camera], ['TSHIRT', 'Футболка с принтом', Shirt]] as const).map(([val, label, Icon]) => (
            <label key={val} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              productCategory === val
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" value={val} {...register('productCategory')} className="sr-only" />
              <Icon size={20} className={productCategory === val ? 'text-amber-600' : 'text-gray-400'} />
              <span className={`text-sm font-medium ${productCategory === val ? 'text-amber-700' : 'text-gray-600'}`}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Основные поля */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Платформа общения</label>
          <select className={selectCls} {...register('communicationPlatform')}>
            <option value="AVITO">Авито</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="MAX">MAX</option>
            <option value="OZON">Ozon</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>
          {communicationPlatform === 'TELEGRAM' ? 'Username в Telegram' : 'Ссылка на переписку'}
        </label>
        <input className={inputCls}
          placeholder={communicationPlatform === 'TELEGRAM' ? '@username' : 'https://www.avito.ru/...'}
          {...register('urlCommunication')} />
        {errors.urlCommunication && <p className={errorCls}>{errors.urlCommunication.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Способ доставки</label>
          <select className={selectCls} {...register('deliveryMethod')}>
            <option value="PICKUP">Самовывоз</option>
            <option value="YANDEX_PVZ">Яндекс ПВЗ</option>
            <option value="OZON_PVZ">Ozon ПВЗ</option>
            <option value="OZON_SELLER">Ozon Продавец</option>
            <option value="WB_SELLER">WB Продавец</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Стоимость доставки, ₽</label>
          <input type="number" min={0} className={inputCls} {...register('deliveryCost')} />
          {errors.deliveryCost && <p className={errorCls}>{errors.deliveryCost.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelCls}>Примечание</label>
        <textarea rows={2} className={inputCls + ' resize-none'} {...register('note')} />
      </div>

      {/* Свободная (договорная) цена заказа */}
      <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-amber-300 transition-colors">
        <input type="checkbox" {...register('freePrice')} className="w-4 h-4 accent-amber-600" />
        <span className="text-sm font-medium text-gray-700">Свободная цена — произвольные позиции «название — цена»</span>
      </label>

      {freePrice ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Позиции — свободная цена</h3>
            <button type="button"
              onClick={() => freeFields.append({ name: '', quantity: 1, price: 0 })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.freeItems && typeof errors.freeItems.message === 'string' && (
            <p className={errorCls}>{errors.freeItems.message}</p>
          )}
          <div className="space-y-3">
            {freeFields.fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-[1fr_70px_90px_36px] gap-2 items-end">
                <div>
                  {idx === 0 && <label className={labelCls}>Название товара</label>}
                  <input className={inputCls} placeholder="Кружка с принтом, баннер…" {...register(`freeItems.${idx}.name`)} />
                  {errors.freeItems?.[idx]?.name && (
                    <p className={errorCls}>{errors.freeItems[idx]?.name?.message}</p>
                  )}
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Кол-во</label>}
                  <input type="number" min={1} className={inputCls} {...register(`freeItems.${idx}.quantity`)} />
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Цена ₽ (итог)</label>}
                  <input type="number" min={0} className={inputCls} {...register(`freeItems.${idx}.price`)} />
                </div>
                <div>
                  {idx === 0 && <div className="mb-1 h-5" />}
                  <button type="button" onClick={() => freeFields.remove(idx)}
                    disabled={freeFields.fields.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Цена — итоговая за позицию (на количество НЕ умножается). Итог заказа = сумма этих цен.</p>
        </div>
      ) : (
      <>
      {/* ── Позиции фотографий ── */}
      {productCategory === 'PHOTO' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Позиции — фотографии</h3>
            <button type="button"
              onClick={() => photoFields.append({ formatPaper: '', typePaper: 'GLOSS', quantity: 1, price: 10 })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.items && typeof errors.items.message === 'string' && (
            <p className={errorCls}>{errors.items.message}</p>
          )}
          <div className="space-y-3">
            {photoFields.fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-[1fr_1fr_80px_80px_36px] gap-2 items-end">
                <div>
                  {idx === 0 && <label className={labelCls}>Формат</label>}
                  <input className={inputCls} placeholder="10×15, Polaroid…" {...register(`items.${idx}.formatPaper`)} />
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Тип бумаги</label>}
                  <select className={selectCls} {...register(`items.${idx}.typePaper`)}>
                    <option value="GLOSS">Глянец</option>
                    <option value="MATTE">Матт</option>
                  </select>
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Кол-во</label>}
                  <input type="number" min={1} className={inputCls} {...register(`items.${idx}.quantity`)} />
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Цена ₽</label>}
                  <input type="number" min={1} className={inputCls} {...register(`items.${idx}.price`)} />
                </div>
                <div>
                  {idx === 0 && <div className="mb-1 h-5" />}
                  <button type="button" onClick={() => photoFields.remove(idx)}
                    disabled={photoFields.fields.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Позиции футболок ── */}
      {productCategory === 'TSHIRT' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Позиции — футболки</h3>
            <button type="button"
              onClick={() => tshirtFields.append({
                color: 'Белый', size: 'M', printLocation: 'FRONT',
                quantity: 1, price: 500, designCost: 0, designUrl: '', designNote: '',
              })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.tshirtItems && typeof errors.tshirtItems.message === 'string' && (
            <p className={errorCls}>{errors.tshirtItems.message}</p>
          )}
          <div className="space-y-4">
            {tshirtFields.fields.map((field, idx) => (
              <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500">Позиция #{idx + 1}</span>
                  <button type="button" onClick={() => tshirtFields.remove(idx)}
                    disabled={tshirtFields.fields.length === 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Цвет</label>
                    <select className={selectCls} {...register(`tshirtItems.${idx}.color`)}>
                      {TSHIRT_COLORS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Размер</label>
                    <select className={selectCls} {...register(`tshirtItems.${idx}.size`)}>
                      {Object.entries(TSHIRT_SIZE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Место печати</label>
                    <select className={selectCls} {...register(`tshirtItems.${idx}.printLocation`)}>
                      {Object.entries(PRINT_LOCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Кол-во</label>
                      <input type="number" min={1} className={inputCls} {...register(`tshirtItems.${idx}.quantity`)} />
                    </div>
                    <div>
                      <label className={labelCls}>Цена ₽</label>
                      <input type="number" min={0} className={inputCls} {...register(`tshirtItems.${idx}.price`)} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Стоимость дизайна ₽</label>
                  <input type="number" min={0} className={inputCls} {...register(`tshirtItems.${idx}.designCost`)} />
                </div>
                <div>
                  <label className={labelCls}>Ссылка на макет</label>
                  <input className={inputCls} placeholder="https://disk.yandex.ru/..." {...register(`tshirtItems.${idx}.designUrl`)} />
                </div>
                <div>
                  <label className={labelCls}>Описание дизайна</label>
                  <input className={inputCls} placeholder="Логотип на груди, белый фон, высота 10 см..." {...register(`tshirtItems.${idx}.designNote`)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      <div className="pt-2 border-t border-gray-100 space-y-2">
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Отмена
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={onSubmitLead}
            className="flex-1 px-4 py-2 text-sm font-semibold text-pink-700 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? '...' : '🔔 Записать обращение'}
          </button>
          <button type="submit" disabled={mutation.isPending}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors shadow-sm">
            {mutation.isPending ? 'Создание...' : 'Создать заявку'}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center">«Записать обращение» — сохраняет лид без позиций. «Создать заявку» — полноценный заказ.</p>
      </div>
    </form>
  );
}
