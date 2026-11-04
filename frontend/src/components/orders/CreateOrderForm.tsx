import { getErrorMessage } from '../../utils/get-error-message';
import { platformStyle } from '../ui/PlatformBadge';
import {
  addonsClientPrice,
  addonsContractorPrice,
} from '../../utils/canvas-addons';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Trash2, Camera, Shirt, Image, Flame, Clock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi } from '../../api/orders';
import { canvasProductionApi } from '../../api/canvasProduction';
import { PHOTO_FORMATS, sheetHint } from '../../config/photo-formats';
import {
  COMMUNICATION_LABELS,
  SOURCE_ORDER_LABELS,
  SOURCE_ORDER_OPTIONS,
} from '../../constants';
import { printsPerSheet } from '../../utils/photo-material';
import { usersApi } from '../../api/users';
import { partnerSettingsApi } from '../../api/partnerSettings';
import {
  TSHIRT_COLORS,
  TSHIRT_SIZE_LABELS,
  PRINT_LOCATION_LABELS,
} from '../../constants';
import type { AppUser, CreateOrderDto } from '../../types/index';
import { CLIENT_ITEM_PRINT_NAME, FREE_PRICE_HINT } from './freePresets';

const photoItemSchema = z.object({
  isFreePrice: z.boolean().optional(),
  formatPaper: z.string().min(1, 'Укажите формат'),
  typePaper: z.enum(['GLOSS', 'MATTE']),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().min(0),
});

const tshirtItemSchema = z.object({
  // Позиция со свободной ценой: вместо цвета/размера — произвольное название.
  freePrice: z.boolean().optional(),
  name: z.string().optional(),
  // Печать на изделии заказчика: заготовку не покупаем, но партнёру платим
  // за плёнку и его долю — расчёт без этого признака считает такую работу
  // чистой прибылью владельца.
  printOnClientItem: z.boolean().optional(),
  color: z.string().min(1, 'Укажите цвет'),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']),
  printLocation: z.enum(['FRONT', 'BACK', 'FRONT_BACK', 'BY_TZ']),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().min(0),
  clientItem: z.boolean().optional(),
  // Себестоимость печати позиции — по умолчанию из настроек, можно поправить.
  thermalCost: z.coerce.number().int().min(0).optional(),
  blankCost: z.coerce.number().int().min(0).optional(),
});

/*
 * Холст: размер только из прайса производства. У каждого размера две цены —
 * розничная (её платит клиент) и оптовая (её платим мы); разница и есть
 * заработок, поэтому обе берутся из прайса, а не вписываются руками.
 *
 * Свободного формата здесь нет намеренно. Размер «словами» тянул за собой
 * цену «на глаз»: сверить её было не с чем, и по заказу нельзя было сказать,
 * заработали мы на нём или отдали больше, чем взяли. Нестандартное
 * (модульные холсты, нарезка) заводится свободной позицией — она рядом.
 */
const canvasItemSchema = z.object({
  sizeKey: z.string().min(1, 'Выберите размер из прайса'),
  material: z.enum(['SYNTHETIC', 'COTTON']).optional(),
  quantity: z.coerce.number().int().positive(),
  /*
   * Нулевая цена не проходит.
   *
   * Цену ставит прайс, но если прайс не загрузился (его отдаёт только
   * администратору), поле останется нулевым — и заказ уйдёт на холст
   * за 0 ₽. Такую позицию потом не отличить от настоящей: в отчёте она
   * выглядит проданной в убыток на всю себестоимость.
   */
  clientPrice: z.coerce.number().int().positive('Цена не может быть нулевой'),
  // Допы: у каждого цена поставщика и цена клиенту, обе за штуку.
  varnish: z.boolean().optional(),
  varnishClientPrice: z.coerce.number().int().min(0).optional(),
  varnishContractorPrice: z.coerce.number().int().min(0).optional(),
  frame: z.boolean().optional(),
  frameClientPrice: z.coerce.number().int().min(0).optional(),
  frameContractorPrice: z.coerce.number().int().min(0).optional(),
});

// Свободная позиция: произвольное название + цена. Имя не валидируем строго здесь
// (скрытые строки не должны рушить форму) — проверяем в superRefine при freePrice.
const freeItemSchema = z.object({
  name: z.string(),
  quantity: z.coerce.number().int().positive(),
  price: z.coerce.number().int().min(0),
  printOnClientItem: z.boolean().optional(),
  clientItem: z.boolean().optional(),
});

/** Российский номер в любом привычном виде: +7…, 8…, 10 цифр. */
function isRussianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return (
    digits.length === 10 ||
    (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8')))
  );
}

/** Номер отправления Ozon: «0189070451-0031-1». Не ссылка — так и есть. */
const OZON_POSTING_RE = /^[0-9]{4,}(?:-[0-9]+)*$/;

const baseSchema = z.object({
  productCategory: z.enum(['PHOTO', 'TSHIRT', 'CANVAS']),
  sourceOrder: z.enum(['AVITO', 'OZON', 'WB', 'LOCAL', 'WEBSITE']),
  communicationPlatform: z.enum(['AVITO', 'TELEGRAM', 'MAX', 'OZON']),
  urlCommunication: z.string().min(1, 'Укажите ссылку или @username'),
  deliveryMethod: z.enum([
    'YANDEX_PVZ', 'OZON_PVZ', 'PICKUP', 'OZON_SELLER', 'WB_SELLER', 'PRODUCTION_MSK',
  ]),
  deliveryCost: z.coerce.number().int().min(0),
  note: z.string().optional(),
  isUrgent: z.boolean().optional(),
  discountAmount: z.coerce.number().int().min(0).optional(),
  // Плата за срочность: входит в чек клиента, но не в базу зарплаты.
  urgencyFee: z.coerce.number().int().min(0).optional(),
  executorId: z.string().optional(),
  freePrice: z.boolean().optional(),
  // «Требуется разработать дизайн» (только футболки): свободная сумма, входит
  // в чек клиента и служит базой премии менеджера по оформлению.
  needsDesign: z.boolean().optional(),
  designDevelopmentCost: z.coerce.number().int().min(0).optional(),
  freeItems: z.array(freeItemSchema).optional(),
  // Свободные позиции РЯДОМ с холстами (не вместо них): багет, упаковка,
  // подвес. Отдельный массив от freeItems, который относится к режиму
  // «весь заказ по свободной цене».
  extraItems: z.array(freeItemSchema).optional(),
  items: z.array(photoItemSchema).optional(),
  tshirtItems: z.array(tshirtItemSchema).optional(),
  canvasItems: z.array(canvasItemSchema).optional(),
}).superRefine((data, ctx) => {
  if (data.communicationPlatform === 'TELEGRAM' && !/^@[A-Za-z0-9_]{1,32}$/.test(data.urlCommunication.trim()) && !/^https?:\/\/(?:t\.me|telegram\.me)\/(?:[A-Za-z0-9_]{1,32}|\+\d{7,15})\/?$/i.test(data.urlCommunication.trim())) {
    ctx.addIssue({
      code: 'custom',
      message: 'Для Telegram укажите @username или ссылку https://t.me/username',
      path: ['urlCommunication'],
    });
  }
  /*
   * MAX: ссылка на переписку, как у Авито.
   *
   * Раньше здесь был телефон, из которого сервер собирал `max.ru/<номер>`.
   * Такая ссылка открывала профиль по номеру, а не диалог по заказу —
   * менеджер всё равно шёл в MAX и искал переписку руками. Адрес диалога
   * у него перед глазами, его и вставляем.
   */
  if (
    data.communicationPlatform === 'MAX' &&
    data.urlCommunication.length > 0 &&
    !data.urlCommunication.startsWith('http')
  ) {
    ctx.addIssue({
      code: 'custom',
      message: isRussianPhone(data.urlCommunication)
        ? 'Для MAX нужна ссылка на переписку, а не телефон: откройте диалог в MAX и скопируйте адрес'
        : 'Укажите полную ссылку на переписку (начинается с https://)',
      path: ['urlCommunication'],
    });
  }
  // Ozon: переписки по заказу нет — покупатель пишет в кабинет, и ссылки
  // на конкретный чат не существует. Контактом служит номер отправления,
  // по нему заказ находят в кабинете. Правило совпадает с серверным
  // (crm-new/src/order-photo/communication-url.ts).
  if (
    data.communicationPlatform === 'OZON' &&
    data.urlCommunication.length > 0 &&
    !data.urlCommunication.startsWith('http') &&
    !OZON_POSTING_RE.test(data.urlCommunication.trim())
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Для Ozon укажите номер отправления (0189070451-0031-1) или ссылку на кабинет',
      path: ['urlCommunication'],
    });
  }
  if (
    data.communicationPlatform === 'AVITO' &&
    data.urlCommunication.length > 0 &&
    !data.urlCommunication.startsWith('http')
  ) {
    ctx.addIssue({
      code: 'custom',
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
      ctx.addIssue({ code: 'custom', message: 'Добавьте хотя бы один товар', path: ['freeItems'] });
    } else {
      fi.forEach((it, i) => {
        if (!it.name || !it.name.trim()) {
          ctx.addIssue({ code: 'custom', message: 'Укажите название', path: ['freeItems', i, 'name'] });
        }
      });
    }
    return;
  }
  if (data.productCategory === 'PHOTO' && (!data.items || data.items.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'Добавьте хотя бы одну позицию', path: ['items'] });
  }
  if (data.productCategory === 'TSHIRT') {
    if (!data.tshirtItems || data.tshirtItems.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Добавьте хотя бы одну позицию', path: ['tshirtItems'] });
    } else {
      data.tshirtItems.forEach((it, i) => {
        if (it.freePrice && !it.name?.trim()) {
          ctx.addIssue({ code: 'custom', message: 'Укажите название', path: ['tshirtItems', i, 'name'] });
        }
      });
    }
  }
  if (data.productCategory === 'CANVAS' && (!data.canvasItems || data.canvasItems.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'Добавьте хотя бы одну позицию', path: ['canvasItems'] });
  }
});

type FormValues = z.infer<typeof baseSchema>;
/** Ключ черновика заказа в sessionStorage — один на вкладку браузера. */
const ORDER_DRAFT_KEY = 'order-create-draft';

/** Форма, с которой начинают с чистого листа. */
const EMPTY_ORDER_FORM = {
  productCategory: 'PHOTO',
  sourceOrder: 'AVITO' as const,
  communicationPlatform: 'TELEGRAM',
  deliveryMethod: 'PICKUP',
  deliveryCost: 0,
  isUrgent: false,
  discountAmount: 0,
  urgencyFee: 0,
  executorId: '',
  freePrice: false,
  needsDesign: false,
  designDevelopmentCost: 0,
  freeItems: [{ name: '', quantity: 1, price: 0 }],
  extraItems: [],
  items: [{ isFreePrice: false, formatPaper: '', typePaper: 'GLOSS', quantity: 1, price: 10 }],
  tshirtItems: [{
    freePrice: false, name: '',
    color: 'Чёрный', size: 'M', printLocation: 'FRONT',
    quantity: 1, price: 1500, clientItem: false,
  }],
  // clientPrice: 0 — цену подставит прайс, как только он загрузится.
  // Константа здесь означала бы заказ по цене, которой в прайсе нет.
  canvasItems: [{
    sizeKey: '30x40',
    material: 'SYNTHETIC',
    quantity: 1,
    clientPrice: 0,
  }],
} as unknown as FormValues;

function readOrderDraft(): FormValues | null {
  try {
    const raw = sessionStorage.getItem(ORDER_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FormValues;
  } catch {
    // Битый черновик — начинаем с чистой формы, а не падаем на открытии окна.
    return null;
  }
}

function clearOrderDraft(): void {
  try {
    sessionStorage.removeItem(ORDER_DRAFT_KEY);
  } catch {
    // Нечего чистить или доступа нет.
  }
}

interface Props {
  onClose: () => void;
  /**
   * Заявка создана — открыть её карточку.
   *
   * Без этого окно просто закрывалось, и человек оставался перед списком:
   * чтобы отправить подтверждение или записать оплату, он искал только что
   * созданный заказ глазами. А делать это нужно сразу — разговор с клиентом
   * идёт прямо сейчас.
   */
  onCreated?: (orderId: string) => void;
}


const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent';
const selectCls = inputCls;
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'text-red-500 text-xs mt-1';

export function CreateOrderForm({ onClose, onCreated }: Props) {
  const qc = useQueryClient();
  // Читаем один раз при монтировании: дальше формой владеет react-hook-form.
  const [restoredDraft] = useState(readOrderDraft);
  const [draftRestored, setDraftRestored] = useState(restoredDraft !== null);
  const { register, control, handleSubmit, getValues, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    /*
      Приведение типа, а не смена типизации формы.

      Поля ввода отдают строки, а схема превращает их в числа
      (`z.coerce.number()`). Zod 4 стал разделять «что пришло» и «что
      получилось», и resolver теперь описан двумя разными типами. Форма же
      во всех своих тысяче строк рассчитывает на один — тот, что после
      проверки, как было и с Zod 3.

      Поведение от этого не меняется ни на шаг: те же поля, та же схема,
      то же приведение. Меняется только то, какой из двух типов видит
      TypeScript. Разделить их по-настоящему — отдельная работа по всей
      форме, и делать её заодно с правкой зависимости нельзя.
    */
    resolver: zodResolver(fullSchema) as unknown as Resolver<FormValues>,
    // Черновик накладывается поверх пустой формы, а не заменяет её: у
    // сохранённого раньше может не оказаться полей, добавленных позже, и
    // форма открылась бы с дырами вместо значений по умолчанию.
    defaultValues: { ...EMPTY_ORDER_FORM, ...(restoredDraft ?? {}) },
  });

  /*
   * Черновик заказа сохраняется, пока его набирают.
   *
   * Форма большая: клиент, доставка, позиции с ценами. Закрыли окно случайно
   * или промахнулись мимо него — и всё набранное пропадало. Теперь оно
   * переживает и закрытие окна, и обновление страницы, а после создания
   * заявки стирается: держать отправленное незачем.
   */
  useEffect(() => {
    const sub = watch((values) => {
      try {
        sessionStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(values));
      } catch {
        // Переполнение хранилища не должно мешать оформлять заказ.
      }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const productCategory = useWatch({ control, name: 'productCategory' });
  const communicationPlatform = useWatch({ control, name: 'communicationPlatform' });
  const isUrgent = useWatch({ control, name: 'isUrgent' }) ?? false;
  // Скидка клиенту: вычитается из чека и из заработка сразу, пока форму
  // заполняют, — цену клиенту называют в этот же момент.
  const discountWatch = Number(useWatch({ control, name: 'discountAmount' }) ?? 0) || 0;
  const freePrice = useWatch({ control, name: 'freePrice' });
  const needsDesign = useWatch({ control, name: 'needsDesign' });
  const designCostWatch = useWatch({ control, name: 'designDevelopmentCost' });
  const extraItemsWatch = useWatch({ control, name: 'extraItems' });
  const photoItemsWatch = useWatch({ control, name: 'items' });
  const tshirtItemsWatch = useWatch({ control, name: 'tshirtItems' });
  const canvasItemsWatch = useWatch({ control, name: 'canvasItems' });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    staleTime: 60_000,
  });
  // Себестоимость по умолчанию — показываем как плейсхолдер в позициях.
  const { data: settings } = useQuery({
    queryKey: ['partner-settings'],
    queryFn: partnerSettingsApi.get,
    staleTime: 60_000,
  });
  // Свободные сверху — чтобы заказ уходил тому, кто не завален.
  const executors = users
    .filter((u: AppUser) => u.role === 'EXECUTOR' && u.isActive !== false)
    .sort((a, b) => (a.activeOrdersCount ?? 0) - (b.activeOrdersCount ?? 0));

  // Чистим/восстанавливаем позиции, чтобы Zod не падал на скрытых полях:
  // при свободной цене позиций нет вовсе; иначе — одна позиция активной категории.
  useEffect(() => {
    // Для внешних продуктов свободная цена назначается отдельными позициями,
    // поэтому order-level freePrice здесь выключаем.
    if ((productCategory === 'TSHIRT' || productCategory === 'CANVAS') && freePrice) {
      setValue('freePrice', false);
      return;
    }
    if (freePrice) {
      setValue('items', []);
      setValue('tshirtItems', []);
      setValue('canvasItems', []);
      setValue('extraItems', []);
      return;
    }
    if (productCategory === 'TSHIRT') {
      setValue('items', []);
      setValue('canvasItems', []);
      setValue('extraItems', []);
      if ((getValues('tshirtItems')?.length ?? 0) === 0) {
        setValue('tshirtItems', [{
          freePrice: false, name: '',
          color: 'Чёрный', size: 'M', printLocation: 'FRONT',
          quantity: 1, price: 1500, clientItem: false,
        }]);
      }
    } else if (productCategory === 'CANVAS') {
      setValue('items', []);
      setValue('tshirtItems', []);
      if ((getValues('canvasItems')?.length ?? 0) === 0) {
        setValue('canvasItems', [{
          sizeKey: '30x40',
          material: 'SYNTHETIC',
          quantity: 1,
          clientPrice: 0,
        }]);
      }
    } else {
      setValue('tshirtItems', []);
      setValue('canvasItems', []);
      setValue('extraItems', []);
      if ((getValues('items')?.length ?? 0) === 0) {
        setValue('items', [{ isFreePrice: false, formatPaper: '', typePaper: 'GLOSS', quantity: 1, price: 10 }]);
      }
    }
  }, [freePrice, productCategory, setValue, getValues]);

  const photoFields = useFieldArray({ control, name: 'items' });
  const tshirtFields = useFieldArray({ control, name: 'tshirtItems' });
  const canvasFields = useFieldArray({ control, name: 'canvasItems' });
  const extraFields = useFieldArray({ control, name: 'extraItems' });
  const deliveryMethodWatch = useWatch({ control, name: 'deliveryMethod' });
  const deliveryCostWatch = useWatch({ control, name: 'deliveryCost' });
  useEffect(() => {
    if (deliveryMethodWatch === 'PICKUP') setValue('deliveryCost', 0);
    if (productCategory !== 'CANVAS' && deliveryMethodWatch === 'PRODUCTION_MSK') {
      setValue('deliveryMethod', 'PICKUP');
      setValue('deliveryCost', 0);
    }
  }, [productCategory, deliveryMethodWatch, setValue]);


  /*
   * Прайс производства: из него подставляется цена, которую мы должны.
   * Считает её всё равно сервер — здесь она только чтобы маржа была видна
   * сразу, пока заполняешь, а не после сохранения.
   */
  const { data: canvasPricing } = useQuery({
    queryKey: ['canvas-production-pricing'],
    queryFn: canvasProductionApi.pricing,
    enabled: productCategory === 'CANVAS',
    staleTime: 600_000,
  });

  /*
   * Итог по заказу считается на лету, пока форму заполняют: цену клиенту
   * называют в этот же момент, и ждать сохранения ради цифры незачем.
   *
   * Себестоимость берём из прайса — ровно ту, что запишет сервер. Доставка
   * отдельной строкой: платим одно, называем другое, и разница — заработок,
   * а не транзит, поэтому в марже позиций её быть не должно.
   */
  /*
   * Выбрали доставку производства — цену клиенту подставляем из настроек
   * (800 ₽ при нашей себестоимости 700). Правится руками: с конкретным
   * клиентом можно договориться иначе, а угадывать за владельца нельзя.
   */
  useEffect(() => {
    if (deliveryMethodWatch !== 'PRODUCTION_MSK' || !canvasPricing) return;
    if (Number(getValues('deliveryCost')) > 0) return;
    setValue('deliveryCost', canvasPricing.delivery.price);
  }, [deliveryMethodWatch, canvasPricing, getValues, setValue]);

  /**
   * Цена клиенту по прайсу: розничная колонка выбранного материала.
   *
   * По рознице производства мы и продаём — это те же числа, что стоят на
   * сайте. `null` значит «размера в прайсе нет»: подставлять тогда нечего,
   * и ноль был бы хуже пустого поля.
   */
  const canvasListPrice = (
    sizeKey?: string,
    material?: 'SYNTHETIC' | 'COTTON',
  ): number | null =>
    canvasPricing?.sizes.find((x) => x.key === sizeKey)?.retail[
      material ?? 'SYNTHETIC'
    ] ?? null;

  /** Поставить в строку цену её размера и материала. */
  const applyCanvasPrice = (
    idx: number,
    sizeKey?: string,
    material?: 'SYNTHETIC' | 'COTTON',
  ): void => {
    const price = canvasListPrice(sizeKey, material);
    if (price === null) return;
    setValue(`canvasItems.${idx}.clientPrice`, price, { shouldDirty: true });
  };

  /**
   * Новая строка холста приходит с нулевой ценой — ставим её по прайсу.
   *
   * Раньше в строке стояла константа 1500 ₽: для 30×40 прайс называет 940,
   * и заказ уходил по цене, которой нет ни на сайте, ни в прайсе. Правим
   * только нули: вписанную руками цену (договорились иначе) не перебиваем.
   */
  useEffect(() => {
    if (productCategory !== 'CANVAS' || !canvasPricing) return;
    (canvasItemsWatch ?? []).forEach((row, idx) => {
      if (Number(row?.clientPrice ?? 0) > 0) return;
      const price = canvasListPrice(row?.sizeKey, row?.material);
      if (price === null) return;
      setValue(`canvasItems.${idx}.clientPrice`, price);
    });
    // canvasListPrice выводится из canvasPricing — отдельной зависимостью
    // он только заставил бы эффект бегать на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCategory, canvasPricing, canvasItemsWatch, setValue]);

  /*
   * Выбрали Яндекс ПВЗ — цену клиенту ставим из настроек (по умолчанию 300).
   * Только в пустое поле: если менеджер уже вписал сумму, не перебиваем.
   */
  useEffect(() => {
    if (deliveryMethodWatch !== 'YANDEX_PVZ' || !settings) return;
    if (Number(getValues('deliveryCost')) > 0) return;
    setValue('deliveryCost', settings.deliveryPriceYandexPvz);
  }, [deliveryMethodWatch, settings, getValues, setValue]);

  const canvasTotals = (() => {
    let revenue = 0;
    let cost = 0;
    for (const row of canvasItemsWatch ?? []) {
      const qty = Number(row?.quantity ?? 0) || 0;
      const priced = canvasPricing?.sizes.find((x) => x.key === row?.sizeKey);
      /*
        Лак и багет считаем здесь же — их покупают у поставщика, как и само
        полотно. Без них итог по заказу расходился со строками: в строке
        маржа с допами, в итоге без них.
      */
      revenue +=
        ((Number(row?.clientPrice ?? 0) || 0) + addonsClientPrice(row ?? {})) * qty;
      cost +=
        ((priced?.cost[row?.material ?? 'SYNTHETIC'] ?? 0) +
          addonsContractorPrice(row ?? {})) *
        qty;
    }
    const isProductionDelivery = deliveryMethodWatch === 'PRODUCTION_MSK';
    const deliveryOwn = isProductionDelivery ? (canvasPricing?.delivery.cost ?? 0) : 0;
    const deliveryCharged = Number(deliveryCostWatch ?? 0) || 0;
    // Свободные позиции (багет, упаковка) — договорная цена без себестоимости:
    // подрядчику за них не платят, значит вся сумма в прибыль.
    const extra = (extraItemsWatch ?? [])
      .filter((i) => (i?.name ?? '').trim())
      .reduce((sum, i) => sum + (Number(i?.price ?? 0) || 0), 0);
    // Разработка дизайна — тоже 100% прибыль владельца.
    const design = needsDesign ? Number(designCostWatch ?? 0) || 0 : 0;

    // Скидка уменьшает и то, что платит клиент, и заработок: она не может
    // съесть доставку и срочность, поэтому потолок — товар с дизайном.
    const discount = Math.min(
      Math.max(0, discountWatch),
      revenue + extra + design,
    );
    const clientTotal = revenue + deliveryCharged + extra + design - discount;
    const owed = cost + deliveryOwn;
    return {
      revenue,
      cost,
      deliveryOwn,
      deliveryCharged,
      extra,
      design,
      discount,
      clientTotal,
      owed,
      // Свободные позиции и дизайн идут в прибыль целиком — себестоимости
      // у них нет.
      profit: clientTotal - owed,
    };
  })();
  const freeFields = useFieldArray({ control, name: 'freeItems' });

  const mutation = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (created, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      clearOrderDraft();
      toast.success(vars.status === 'LEAD' ? 'Обращение записано' : 'Заявка создана');
      // Карточку открываем сразу: дальше по этой заявке идёт разговор
      // с клиентом — подтверждение, оплата, макет.
      if (created?.id) onCreated?.(created.id);
      onClose();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, 'Ошибка при создании заявки')),
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
        isUrgent: data.isUrgent ?? false,
        urgencyFee: data.isUrgent ? (data.urgencyFee ?? 0) : 0,
        discountAmount: data.discountAmount || 0,
        executorId: data.executorId || undefined,
        productCategory: data.productCategory,
        freePrice: true,
        items: freeItems.map((i) => ({
          // Свободная цена: цена — это итог позиции; количество сохраняется,
          // но на сервере на цену НЕ умножается (заказ помечен isFreePrice).
          formatPaper: i.name.trim(),
          typePaper: 'GLOSS',
          quantity: i.quantity,
          price: i.price,
          printOnClientItem: i.printOnClientItem ?? false,
        })),
      });
      return;
    }
    const base = {
      sourceOrder: data.sourceOrder,
      communicationPlatform: data.communicationPlatform,
      urlCommunication: data.urlCommunication,
      deliveryMethod: data.deliveryMethod,
      deliveryCost: data.deliveryCost,
      note: data.note,
      isUrgent: data.isUrgent ?? false,
      urgencyFee: data.isUrgent ? (data.urgencyFee ?? 0) : 0,
      discountAmount: data.discountAmount || 0,
      executorId: data.executorId || undefined,
    };

    if (data.productCategory === 'TSHIRT') {
      const rows = data.tshirtItems ?? [];
      // Обычные позиции → tshirtItems; помеченные «свободная цена» → произвольные
      // позиции (items с isFreePrice): цена = итог, кол-во не умножается.
      const tshirtItems = rows.filter((r) => !r.freePrice).map((r) => ({
        color: r.color, size: r.size, printLocation: r.printLocation,
        quantity: r.quantity, price: r.price, clientItem: r.clientItem,
        // Дизайн больше не часть позиции футболки — его заводят отдельной
        // свободной позицией. Пусто/0 → сервер берёт себестоимость из настроек.
        thermalCost: r.thermalCost || undefined,
        blankCost: r.blankCost || undefined,
      }));
      const items = rows.filter((r) => r.freePrice).map((r) => ({
        formatPaper: (r.name ?? '').trim(),
        typePaper: 'GLOSS' as const,
        quantity: r.quantity,
        price: r.price,
        isFreePrice: true,
        printOnClientItem: r.printOnClientItem ?? false,
      }));
      mutation.mutate({
        ...base,
        productCategory: 'TSHIRT',
        // Футболки печатает партнёр: исполнителя не передаём, даже если он
        // остался в форме после переключения категории.
        executorId: undefined,
        tshirtItems: tshirtItems.length ? tshirtItems : undefined,
        items: items.length ? items : undefined,
        // «Разработка дизайна» — свободная сумма, входит в чек клиента.
        designDevelopmentCost: data.needsDesign
          ? data.designDevelopmentCost || 0
          : undefined,
      });
      return;
    }

    if (data.productCategory === 'CANVAS') {
      const canvasItems = (data.canvasItems ?? []).map((r) => ({
        // Размер из прайса: подпись и цену производства ставит сервер.
        sizeKey: r.sizeKey,
        material: r.material ?? ('SYNTHETIC' as const),
        quantity: r.quantity,
        clientPrice: r.clientPrice,
        /*
          Допы уезжают вместе с позицией.

          Раньше здесь их не было: лак и багет можно было отметить в форме,
          увидеть с ними маржу — и создать заказ без них. Клиенту называлась
          одна сумма, в заказе оказывалась другая, а себестоимость допа не
          попадала в расчёт с производством вовсе.
        */
        varnish: r.varnish ?? false,
        varnishClientPrice: r.varnish ? (r.varnishClientPrice ?? 0) : 0,
        varnishContractorPrice: r.varnish ? (r.varnishContractorPrice ?? 0) : 0,
        frame: r.frame ?? false,
        frameClientPrice: r.frame ? (r.frameClientPrice ?? 0) : 0,
        frameContractorPrice: r.frame ? (r.frameContractorPrice ?? 0) : 0,
      }));
      // Свободные позиции рядом с холстами — как items (свободная цена):
      // цена = итог позиции, количество на неё не умножается.
      const extraItems = (data.extraItems ?? [])
        .filter((i) => i.name.trim())
        .map((i) => ({
          formatPaper: i.name.trim(),
          typePaper: 'GLOSS' as const,
          quantity: i.quantity,
          price: i.price,
          isFreePrice: true,
        }));
      mutation.mutate({
        ...base,
        productCategory: 'CANVAS',
        executorId: undefined,
        canvasItems,
        items: extraItems.length ? extraItems : undefined,
        // «Разработка дизайна» — свободная сумма, входит в чек клиента.
        designDevelopmentCost: data.needsDesign
          ? data.designDevelopmentCost || 0
          : undefined,
      });
      return;
    }

    mutation.mutate({ ...base, productCategory: 'PHOTO', items: data.items });
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
    const ozonPosting =
      data.communicationPlatform === 'OZON' && OZON_POSTING_RE.test(url.trim());
    if (
      data.communicationPlatform !== 'TELEGRAM' &&
      !ozonPosting &&
      !url.startsWith('http')
    ) {
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
      isUrgent: data.isUrgent ?? false,
      urgencyFee: data.isUrgent ? (data.urgencyFee ?? 0) : 0,
      discountAmount: data.discountAmount || 0,
      productCategory: data.productCategory ?? 'PHOTO',
      status: 'LEAD',
      // У внешних продуктов исполнителя нет — печатает подрядчик.
      executorId:
        data.productCategory === 'PHOTO' ? data.executorId || undefined : undefined,
      items: undefined,
      tshirtItems: undefined,
      canvasItems: undefined,
    };
    mutation.mutate(lead);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Восстановленный черновик показываем явно: находить в форме чужие
          значения без объяснения — хуже, чем набрать заново. */}
      {draftRestored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-xs text-amber-900">
            Восстановлен незаконченный черновик заявки.
          </span>
          <button
            type="button"
            onClick={() => {
              clearOrderDraft();
              reset(EMPTY_ORDER_FORM);
              setDraftRestored(false);
            }}
            className="text-xs font-semibold text-amber-800 underline hover:text-amber-950"
          >
            Начать заново
          </button>
        </div>
      )}

      {/* Категория товара */}
      <div>
        <label className={labelCls}>Категория товара</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            ['PHOTO', 'Фотопечать', Camera],
            ['TSHIRT', 'Футболка с принтом', Shirt],
            ['CANVAS', 'Печать на холсте', Image],
          ] as const).map(([val, label, Icon]) => (
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
          {/*
            Кнопки, а не выпадающий список: платформу выбирают в каждой
            заявке, и в списке её приходилось сначала открыть, потом
            прочитать. Цвета фирменные — выбранная площадка узнаётся
            по цвету, не вчитываясь в подпись.
          */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Платформа общения">
            {(['AVITO', 'TELEGRAM', 'MAX', 'OZON'] as const).map((value) => {
              const active = communicationPlatform === value;
              const style = platformStyle(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setValue('communicationPlatform', value, { shouldDirty: true, shouldValidate: true })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? `${style.chip} ring-2`
                      : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span aria-hidden="true" className="font-bold leading-none">{style.mark}</span>
                  {COMMUNICATION_LABELS[value]}
                </button>
              );
            })}
          </div>
        </div>
        {/* Откуда заказ: по умолчанию Авито — основной ручной канал, поэтому
            выбирать каждый раз не нужно. Заявки сайта сюда не попадают: их
            источник ставит сервер. */}
        <div>
          <label className={labelCls} htmlFor="sourceOrder">Источник заказа</label>
          <select id="sourceOrder" className={selectCls} {...register('sourceOrder')}>
            {SOURCE_ORDER_OPTIONS.map((value) => (
              <option key={value} value={value}>{SOURCE_ORDER_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Срочность заказа</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setValue('isUrgent', false, { shouldDirty: true })}
            className={`flex items-center justify-center gap-2 min-h-[44px] rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              !isUrgent
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Clock size={16} aria-hidden="true" />
            Несрочный
          </button>
          <button
            type="button"
            onClick={() => setValue('isUrgent', true, { shouldDirty: true })}
            className={`flex items-center justify-center gap-2 min-h-[44px] rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
              isUrgent
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <Flame size={16} aria-hidden="true" />
            Срочный
          </button>
        </div>
        {/* Плата за срочность: входит в чек клиента отдельной строкой, но в
            базу зарплаты (ни исполнителю, ни менеджеру) не попадает. */}
        {isUrgent && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 p-3">
            <label className={labelCls}>Стоимость срочности, ₽</label>
            <input type="number" min={0} className={inputCls} placeholder="500"
              {...register('urgencyFee')} />
          </div>
        )}

        {/* Скидка клиенту. Отдельным полем, а не «уменьшите цену позиции»:
            иначе через месяц не вспомнить, был ли заказ дешёвым сам по себе
            или его продали со скидкой. Она уменьшает и чек, и базу зарплаты
            исполнителя — скидку делим с ним (решение владельца). */}
        <div className="mt-3">
          <label className={labelCls} htmlFor="discountAmount">Скидка клиенту, ₽</label>
          <input id="discountAmount" type="number" min={0} className={inputCls} placeholder="0"
            {...register('discountAmount')} />
          <p className="mt-1 text-xs text-gray-400">
            Вычитается из чека и из вашего заработка. Доставку и срочность не
            уменьшает; больше суммы товара с дизайном не принимается.
          </p>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="urlCommunication">
          {communicationPlatform === 'TELEGRAM'
            ? 'Username в Telegram'
            : 'Ссылка на переписку'}
        </label>
        <input
          id="urlCommunication"
          className={inputCls}
          placeholder={
            communicationPlatform === 'TELEGRAM'
              ? '@username'
              : communicationPlatform === 'MAX'
                ? 'https://max.ru/...'
                : 'https://www.avito.ru/...'
          }
          {...register('urlCommunication')}
        />
        {communicationPlatform === 'MAX' && (
          <p className="text-xs text-gray-400 mt-1">
            Откройте переписку в MAX и вставьте её адрес — как с Авито.
          </p>
        )}
        {errors.urlCommunication && <p className={errorCls}>{errors.urlCommunication.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Способ доставки</label>
          <select className={selectCls} {...register('deliveryMethod', { onChange: (event) => {
            const method = event.target.value;
            setValue('deliveryCost', method === 'YANDEX_PVZ' ? (settings?.deliveryPriceYandexPvz ?? 0) : method === 'PRODUCTION_MSK' ? (canvasPricing?.delivery.price ?? 0) : 0, { shouldDirty: true });
          } })}>
            <option value="PICKUP">Самовывоз</option>
            <option value="YANDEX_PVZ">Яндекс ПВЗ</option>
            <option value="OZON_PVZ">Ozon ПВЗ</option>
            <option value="OZON_SELLER">Ozon Продавец</option>
            <option value="WB_SELLER">WB Продавец</option>
            {/* Своя доставка производства — только у холста: везёт подрядчик,
                который его и печатает. */}
            {productCategory === 'CANVAS' && (
              <option value="PRODUCTION_MSK">Доставка в пределах МКАД</option>
            )}
          </select>
        </div>
        <div>
          <label className={labelCls}>Стоимость доставки, ₽</label>
          <input type="number" min={0} readOnly={deliveryMethodWatch === 'PICKUP'} className={inputCls} {...register('deliveryCost')} />
          {errors.deliveryCost && <p className={errorCls}>{errors.deliveryCost.message}</p>}
        </div>
      </div>

      {/* Внешние продукты печатает подрядчик — своего исполнителя на них не назначаем. */}
      {productCategory === 'PHOTO' && (
        <div>
          <label className={labelCls}>Исполнитель</label>
          <select className={selectCls} {...register('executorId')}>
            <option value="">— назначить позже —</option>
            {executors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} — {(u.activeOrdersCount ?? 0) === 0 ? 'свободен' : `${u.activeOrdersCount} в работе`}
                {u.rateBasisPoints === null ? ' · ставка не назначена' : ` · ${(u.rateBasisPoints / 100).toFixed(2)}%`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>Примечание</label>
        <textarea rows={2} className={inputCls + ' resize-none'} {...register('note')} />
      </div>

      {/* Свободная цена у фото задаётся ПО-ПОЗИЦИОННО (чекбокс на позиции),
          отдельного «свободного» режима на весь заказ больше нет. */}
      {freePrice ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Позиции — свободная цена</h3>
            <button type="button"
              onClick={() => freeFields.append({ name: '', quantity: 1, price: 0, clientItem: false })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.freeItems && typeof errors.freeItems.message === 'string' && (
            <p className={errorCls}>{errors.freeItems.message}</p>
          )}
          <div className="space-y-3">
            {freeFields.fields.map((field, idx) => (
              <div key={field.id} className="space-y-1.5">
                <div className={`grid gap-2 items-end ${productCategory === 'TSHIRT' ? 'grid-cols-[1fr_70px_90px_36px]' : 'grid-cols-[1fr_70px_90px_36px]'}`}>
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
                {productCategory === 'TSHIRT' && (
                  <label className="flex items-center gap-2 cursor-pointer pl-0.5">
                    <input type="checkbox" {...register(`freeItems.${idx}.clientItem`)} className="w-4 h-4 accent-amber-600" />
                    <span className="text-xs text-gray-600">Изделие клиента — склад не списывается</span>
                  </label>
                )}
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
            {/* Подсказки форматов — общий список для всех позиций.
                Составлен по статистике заказов, редкие форматы вписываются
                руками: поле остаётся свободным. */}
            <datalist id="photo-formats">
              {PHOTO_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{sheetHint(f.perSheet)}</option>
              ))}
            </datalist>
            <button type="button"
              onClick={() => photoFields.append({ isFreePrice: false, formatPaper: '', typePaper: 'GLOSS', quantity: 1, price: 10 })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.items && typeof errors.items.message === 'string' && (
            <p className={errorCls}>{errors.items.message}</p>
          )}
          <div className="space-y-3">
            {photoFields.fields.map((field, idx) => {
              const itemFree = photoItemsWatch?.[idx]?.isFreePrice ?? false;
              return (
              <div key={field.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register(`items.${idx}.isFreePrice`)} className="w-4 h-4 accent-amber-600" />
                    <span className="text-sm text-gray-700">Свободная цена — название и итоговая цена позиции</span>
                  </label>
                  <button type="button" onClick={() => photoFields.remove(idx)}
                    disabled={photoFields.fields.length === 1}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className={`grid gap-2 items-end ${itemFree ? 'grid-cols-[1fr_80px_110px]' : 'grid-cols-[1fr_1fr_80px_80px]'}`}>
                  <div>
                    <label className={labelCls}>{itemFree ? 'Название' : 'Формат'}</label>
                    {/* Список подсказок, но поле остаётся свободным: редкие
                        форматы вписываются руками, расход по ним считается
                        геометрией. Без единых написаний бумагу не посчитать. */}
                    <input
                      className={inputCls}
                      list={itemFree ? undefined : 'photo-formats'}
                      placeholder={itemFree ? 'Фотоальбом, рамка, доп. услуга…' : 'Выберите или впишите свой'}
                      {...register(`items.${idx}.formatPaper`)}
                    />
                    {!itemFree && (() => {
                      const chosen = watch(`items.${idx}.formatPaper`) ?? '';
                      if (!chosen.trim()) return null;
                      const perSheet = printsPerSheet(chosen);
                      const qty = Number(watch(`items.${idx}.quantity`)) || 0;
                      const sheets = Math.ceil(Math.max(0, qty) / perSheet);
                      return (
                        <p className="mt-1 text-[11px] text-gray-400">
                          {sheetHint(perSheet)}
                          {sheets > 0 ? ` · уйдёт ${sheets} ${sheets === 1 ? 'лист' : 'листов'}` : ''}
                        </p>
                      );
                    })()}
                  </div>
                  {!itemFree && (
                    <div>
                      <label className={labelCls}>Тип бумаги</label>
                      <select className={selectCls} {...register(`items.${idx}.typePaper`)}>
                        <option value="GLOSS">Глянец</option>
                        <option value="MATTE">Матт</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Кол-во</label>
                    <input type="number" min={1} className={inputCls} {...register(`items.${idx}.quantity`)} />
                  </div>
                  <div>
                    <label className={labelCls}>{itemFree ? 'Цена ₽ (итог)' : 'Цена ₽'}</label>
                    <input type="number" min={0} className={inputCls} {...register(`items.${idx}.price`)} />
                  </div>
                </div>
                {itemFree && (
                  <p className="text-xs text-gray-400">Количество сохраняется для понимания состава, но сумма позиции равна цене и не умножается.</p>
                )}
              </div>
              );
            })}
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
                freePrice: false, name: '',
                color: 'Чёрный', size: 'M', printLocation: 'FRONT',
                quantity: 1, price: 1500, clientItem: false,
              })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.tshirtItems && typeof errors.tshirtItems.message === 'string' && (
            <p className={errorCls}>{errors.tshirtItems.message}</p>
          )}
          <div className="space-y-4">
            {tshirtFields.fields.map((field, idx) => {
              const isFree = tshirtItemsWatch?.[idx]?.freePrice ?? false;
              return (
              <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500">Позиция #{idx + 1}</span>
                  <button type="button" onClick={() => tshirtFields.remove(idx)}
                    disabled={tshirtFields.fields.length === 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-30">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Чекбокс свободной цены — первое поле позиции. */}
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:border-amber-300 transition-colors">
                  <input type="checkbox" {...register(`tshirtItems.${idx}.freePrice`)} className="w-4 h-4 accent-amber-600" />
                  <span className="text-sm text-gray-700">Свободная цена — произвольная позиция (название и цена)</span>
                </label>

                {isFree ? (
                  <div className="grid grid-cols-[1fr_80px_120px] gap-3">
                    <div>
                      <label className={labelCls}>Название</label>
                      <input className={inputCls} placeholder="Кружка, баннер…" {...register(`tshirtItems.${idx}.name`)} />
                      {errors.tshirtItems?.[idx]?.name && (
                        <p className={errorCls}>{errors.tshirtItems[idx]?.name?.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Кол-во</label>
                      <input type="number" min={1} className={inputCls} {...register(`tshirtItems.${idx}.quantity`)} />
                    </div>
                    <div>
                      <label className={labelCls}>Цена ₽ (итог)</label>
                      <input type="number" min={0} className={inputCls} {...register(`tshirtItems.${idx}.price`)} />
                      {/* Поле выглядит как цена за штуку, а это итог: при
                          количестве 3 и цене 900 в заказ уйдёт 900, не 2700. */}
                      <p className="mt-1 text-xs text-gray-500">{FREE_PRICE_HINT}</p>
                    </div>
                    <label className="col-span-3 flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:border-violet-300 transition-colors">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-violet-600"
                        {...register(`tshirtItems.${idx}.printOnClientItem`, {
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            // Название подставляем только в пустое поле:
                            // затирать написанное человеком нельзя.
                            if (
                              e.target.checked &&
                              !(getValues(`tshirtItems.${idx}.name`) ?? '').trim()
                            ) {
                              setValue(
                                `tshirtItems.${idx}.name`,
                                CLIENT_ITEM_PRINT_NAME,
                                { shouldValidate: true, shouldDirty: true },
                              );
                            }
                          },
                        })}
                      />
                      <span className="text-sm text-gray-700">
                        Печать на изделии заказчика — заготовку не покупаем,
                        партнёру платим за плёнку и его долю
                      </span>
                    </label>
                  </div>
                ) : (
                  <>
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
                          <label className={labelCls}>Цена ₽ (за всё)</label>
                          <input type="number" min={0} className={inputCls} {...register(`tshirtItems.${idx}.price`)} />
                        </div>
                      </div>
                    </div>

                    {/* Термоперенос и себестоимость футболки в форме не
                        показываем: их подставляет сервер из настроек партнёра,
                        а лишние поля занимали место и путали. На расчёт с
                        партнёром они по-прежнему влияют — просто из умолчаний.
                        «Изделие клиента» (давальческая) тоже скрыта: по умолчанию
                        заготовку предоставляет партнёр, расчёт считается полностью
                        и одинаково. Режим можно вернуть, когда понадобится. */}
                  </>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Позиции холстов ── */}
      {productCategory === 'CANVAS' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Позиции — холсты</h3>
            <button type="button"
              onClick={() => canvasFields.append({
                sizeKey: '30x40',
                material: 'SYNTHETIC',
                quantity: 1,
                // 0 — цену подставит прайс (эффект ниже): у размера она своя.
                clientPrice: 0,
              })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} /> Добавить
            </button>
          </div>
          {errors.canvasItems && typeof errors.canvasItems.message === 'string' && (
            <p className={errorCls}>{errors.canvasItems.message}</p>
          )}
          <div className="space-y-4">
            {canvasFields.fields.map((field, idx) => {
              const row = canvasItemsWatch?.[idx];
              const qty = Number(row?.quantity ?? 0) || 0;
              const client = Number(row?.clientPrice ?? 0) || 0;
              /*
               * Цену производства берём из прайса — ту же, что посчитает
               * сервер. Вписать её руками нельзя: занизить себестоимость
               * значит уйти в минус незаметно.
               */
              const priced = canvasPricing?.sizes.find((x) => x.key === row?.sizeKey);
              const material = row?.material ?? 'SYNTHETIC';
              const contractor = priced?.cost[material] ?? 0;
              // Цена прайса, от которой считается долг: в рознице от неё
              // отнимается скидка, в опте она и есть долг.
              const wholesale = canvasPricing?.mode === 'WHOLESALE';
              const listPrice =
                (wholesale ? priced?.wholesale : priced?.retail)?.[material] ?? 0;
              const discountPct = Math.round((canvasPricing?.discountBasisPoints ?? 0) / 100);
              // Цена клиенту по прайсу: с ней сверяется та, что в строке.
              const listClient = canvasListPrice(row?.sizeKey, row?.material);
              const sizeReg = register(`canvasItems.${idx}.sizeKey`);
              const materialReg = register(`canvasItems.${idx}.material`);
              // Допы входят и в чек клиента, и в себестоимость: лак
              // и багет покупаются у поставщика, как и само полотно.
              const addonClient = addonsClientPrice(row ?? {});
              const addonCost = addonsContractorPrice(row ?? {});
              const revenue = (client + addonClient) * qty;
              const cost = (contractor + addonCost) * qty;
              const profit = revenue - cost;
              return (
                <div key={field.id} className="border border-cyan-100 rounded-xl p-4 space-y-3 bg-cyan-50/30">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-cyan-700">Холст #{idx + 1}</span>
                    <button type="button" onClick={() => canvasFields.remove(idx)}
                      disabled={canvasFields.fields.length === 1}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-30">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-[1fr_130px_80px_140px] gap-3">
                    <div>
                      <label className={labelCls} htmlFor={`canvas-size-${idx}`}>Размер</label>
                      {/* Только размеры прайса: у каждого своя цена клиенту
                          и своя цена производства, и обе меняются вместе
                          с размером. Нестандартное — свободной позицией. */}
                      <select
                        id={`canvas-size-${idx}`}
                        className={selectCls}
                        {...sizeReg}
                        onChange={(e) => {
                          void sizeReg.onChange(e);
                          applyCanvasPrice(idx, e.target.value, row?.material);
                        }}
                      >
                        {(canvasPricing?.sizes ?? []).map((size) => (
                          <option key={size.key} value={size.key}>{size.label}</option>
                        ))}
                        {/* Прайс отдаётся только администратору. Пустой
                            список без объяснения выглядит поломкой. */}
                        {!canvasPricing?.sizes.length && (
                          <option value="">Прайс недоступен — нужен администратор</option>
                        )}
                      </select>
                      {errors.canvasItems?.[idx]?.sizeKey && (
                        <p className={errorCls}>{errors.canvasItems[idx]?.sizeKey?.message}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`canvas-material-${idx}`}>Материал</label>
                      {/* Хлопок дороже и клиенту, и нам — поэтому смена
                          материала тоже тянет за собой цену. */}
                      <select
                        id={`canvas-material-${idx}`}
                        className={selectCls}
                        {...materialReg}
                        onChange={(e) => {
                          void materialReg.onChange(e);
                          applyCanvasPrice(
                            idx,
                            row?.sizeKey,
                            e.target.value as 'SYNTHETIC' | 'COTTON',
                          );
                        }}
                      >
                        <option value="SYNTHETIC">Синтетика</option>
                        <option value="COTTON">Хлопок</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`canvas-qty-${idx}`}>Кол-во</label>
                      <input id={`canvas-qty-${idx}`} type="number" min={1} className={inputCls} {...register(`canvasItems.${idx}.quantity`)} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`canvas-client-${idx}`}>Клиент ₽/шт</label>
                      <input id={`canvas-client-${idx}`} type="number" min={0} className={inputCls} {...register(`canvasItems.${idx}.clientPrice`)} />
                      {errors.canvasItems?.[idx]?.clientPrice && (
                        <p className={errorCls}>{errors.canvasItems[idx]?.clientPrice?.message}</p>
                      )}
                      {/*
                          Под ценой — прайс этого размера.

                          Цена подставляется из прайса, но остаётся
                          исправляемой: с конкретным клиентом договариваются
                          иначе, и это нормально. Ненормально — не видеть,
                          что продаём не по прайсу: поэтому расхождение
                          названо, и прайсовую цену можно вернуть одним
                          нажатием.
                      */}
                      {listClient !== null && (
                        client === listClient ? (
                          <p className="mt-1 text-[11px] text-gray-400">по прайсу</p>
                        ) : (
                          <p className="mt-1 text-[11px] text-amber-700 tabular-nums">
                            прайс {listClient.toLocaleString('ru-RU')} ₽ ·{' '}
                            <button
                              type="button"
                              onClick={() => applyCanvasPrice(idx, row?.sizeKey, row?.material)}
                              className="underline underline-offset-2 hover:text-amber-900"
                            >
                              вернуть
                            </button>
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  {/* Допы к холсту. Холст бывает только с лаком, только
                      в багете, с тем и другим — или без них вовсе, поэтому
                      это две независимые галочки, а не выбор из списка.
                      У каждого допа две цены: поставщику и клиенту —
                      разница такой же заработок, как на самом полотне. */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ['varnish', 'Лак'],
                      ['frame', 'Багет'],
                    ] as const).map(([kind, label]) => {
                      const on = Boolean(row?.[kind]);
                      return (
                        <div
                          key={kind}
                          className="rounded-lg border border-cyan-100 bg-white px-3 py-2"
                        >
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              {...register(`canvasItems.${idx}.${kind}`)}
                            />
                            {label}
                          </label>
                          {on && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {/* Подписи в разметке общие («Клиенту ₽/шт»
                                  у лака и у багета), поэтому каждому полю
                                  даём своё имя: иначе ни скринридер, ни
                                  проверка не скажут, чья это цена. */}
                              <div>
                                <label className={labelCls} htmlFor={`canvas-${kind}-client-${idx}`}>
                                  Клиенту ₽/шт
                                </label>
                                <input
                                  id={`canvas-${kind}-client-${idx}`}
                                  type="number"
                                  min={0}
                                  className={inputCls}
                                  aria-label={`${label}: цена клиенту`}
                                  {...register(`canvasItems.${idx}.${kind}ClientPrice`)}
                                />
                              </div>
                              <div>
                                <label className={labelCls} htmlFor={`canvas-${kind}-cost-${idx}`}>
                                  Поставщик ₽/шт
                                </label>
                                <input
                                  id={`canvas-${kind}-cost-${idx}`}
                                  type="number"
                                  min={0}
                                  className={inputCls}
                                  aria-label={`${label}: цена поставщика`}
                                  {...register(`canvasItems.${idx}.${kind}ContractorPrice`)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-white border border-cyan-100 px-3 py-2">
                      <p className="text-gray-400">Выручка</p>
                      <p className="font-semibold text-gray-800 tabular-nums">{revenue.toLocaleString('ru-RU')} ₽</p>
                    </div>
                    <div className="rounded-lg bg-white border border-cyan-100 px-3 py-2">
                      <p className="text-gray-400">Должен производству</p>
                      <p className="font-semibold text-gray-800 tabular-nums">{cost.toLocaleString('ru-RU')} ₽</p>
                      {listPrice > 0 && (
                        <p className="mt-0.5 text-[10px] leading-tight text-gray-400 tabular-nums">
                          {wholesale
                            ? `опт ${listPrice.toLocaleString('ru-RU')} ₽`
                            : `прайс ${listPrice.toLocaleString('ru-RU')} ₽ − ${discountPct}%`}
                          {qty > 1 ? ` × ${qty}` : ''}
                        </p>
                      )}
                    </div>
                    {/* Маржа позиции. Минус называем словами, а не только
                        красным цветом: цифру со знаком легко прочитать
                        как заработок и продать ниже себестоимости. */}
                    <div className={`rounded-lg border px-3 py-2 ${profit >= 0 ? 'bg-white border-emerald-100' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-gray-400">Маржа</p>
                      <p className={`font-semibold tabular-nums ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {profit.toLocaleString('ru-RU')} ₽
                      </p>
                      {profit < 0 && (
                        <p className="mt-0.5 text-[10px] leading-tight font-medium text-red-600">
                          ниже себестоимости на {Math.abs(profit).toLocaleString('ru-RU')} ₽
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Итог по заказу до его создания: система посчитала — можно
              оформлять и называть цену клиенту. Отдельного калькулятора для
              этого не нужно: считают ровно тогда, когда заводят заявку. */}
          {canvasPricing && (
            <div className="mt-3 rounded-xl border border-cyan-200 bg-white p-4 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Клиент платит за холсты</span>
                <span className="tabular-nums">{canvasTotals.revenue.toLocaleString('ru-RU')} ₽</span>
              </div>
              {canvasTotals.deliveryCharged > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>+ доставка клиенту</span>
                  <span className="tabular-nums">{canvasTotals.deliveryCharged.toLocaleString('ru-RU')} ₽</span>
                </div>
              )}
              {canvasTotals.discount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>− скидка клиенту</span>
                  <span className="tabular-nums">−{canvasTotals.discount.toLocaleString('ru-RU')} ₽</span>
                </div>
              )}
              <div className="mt-1 flex justify-between font-semibold text-gray-900">
                <span>Итого клиенту</span>
                <span className="tabular-nums">{canvasTotals.clientTotal.toLocaleString('ru-RU')} ₽</span>
              </div>

              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                <div className="flex justify-between text-gray-500">
                  <span>Должен производству за холсты</span>
                  <span className="tabular-nums">{canvasTotals.cost.toLocaleString('ru-RU')} ₽</span>
                </div>
                {canvasTotals.deliveryOwn > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Должен производству за доставку</span>
                    <span className="tabular-nums">{canvasTotals.deliveryOwn.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Должен производству всего</span>
                  <span className="tabular-nums">{canvasTotals.owed.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>

              <div className="mt-2 border-t border-gray-100 pt-2">
                <div className={`flex justify-between text-base font-bold ${
                  canvasTotals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}>
                  <span>Моя прибыль</span>
                  <span className="tabular-nums">{canvasTotals.profit.toLocaleString('ru-RU')} ₽</span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {canvasTotals.clientTotal > 0
                    ? `${Math.round((canvasTotals.profit / canvasTotals.clientTotal) * 100)}% от того, что платит клиент`
                    : 'Укажите цену клиенту'}
                  {' · '}
                  {canvasPricing.mode === 'WHOLESALE'
                    ? 'оптовый прайс производства'
                    : `розничный прайс производства − ${canvasPricing.discountBasisPoints / 100}%`}
                </p>
              </div>

              {/*
                Заказ в минус. Отдельной полосой, а не красной цифрой:
                владелец называет цену клиенту в этот же момент, и «минус
                200 ₽» он должен увидеть до того, как назовёт, а не в отчёте
                через месяц. Оформление не блокируем: бывает осознанная
                уступка — но тогда она осознанная.
              */}
              {canvasTotals.profit < 0 && canvasTotals.clientTotal > 0 && (
                <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700">
                  Заказ в минус: производству отдадите на{' '}
                  {Math.abs(canvasTotals.profit).toLocaleString('ru-RU')} ₽ больше,
                  чем получите с клиента. Клиенту нужно называть от{' '}
                  {(canvasTotals.owed - canvasTotals.deliveryCharged - canvasTotals.extra - canvasTotals.design + canvasTotals.discount).toLocaleString('ru-RU')} ₽
                  за холсты, чтобы выйти в ноль.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Свободные позиции рядом с холстами: багет, упаковка, подвес, доставка
          курьером. Цена договорная — итог за позицию, на количество не
          умножается. Отдельно от самих холстов, у которых своя математика. */}
      {productCategory === 'CANVAS' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Свободные позиции</h3>
            <button type="button"
              onClick={() => extraFields.append({ name: '', quantity: 1, price: 0 })}
              className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
              <Plus size={14} aria-hidden="true" /> Добавить
            </button>
          </div>
          {extraFields.fields.length === 0 && (
            <p className="text-xs text-gray-400">
              Необязательно. Багет, упаковка, подвес, курьер — договорной суммой.
            </p>
          )}
          <div className="space-y-3">
            {extraFields.fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-[1fr_70px_100px_36px] gap-2 items-end">
                <div>
                  {idx === 0 && <label className={labelCls}>Название</label>}
                  <input className={inputCls} placeholder="Багет, упаковка…"
                    {...register(`extraItems.${idx}.name`)} />
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Кол-во</label>}
                  <input type="number" min={1} className={inputCls}
                    {...register(`extraItems.${idx}.quantity`)} />
                </div>
                <div>
                  {idx === 0 && <label className={labelCls}>Цена ₽ (итог)</label>}
                  <input type="number" min={0} className={inputCls}
                    {...register(`extraItems.${idx}.price`)} />
                </div>
                <button type="button" onClick={() => extraFields.remove(idx)}
                  className="p-2 text-gray-400 hover:text-red-500" aria-label="Убрать позицию">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {extraFields.fields.length > 0 && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              Договорная сумма за позицию — на количество не умножается.
            </p>
          )}
        </div>
      )}

      {/* Требуется разработать дизайн — футболки и холсты. Свободная сумма
          входит в чек клиента и служит базой премии менеджера по оформлению. */}
      {(productCategory === 'TSHIRT' || productCategory === 'CANVAS') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" {...register('needsDesign')} className="w-4 h-4 accent-amber-600" />
            <span className="text-sm font-medium text-gray-800">Требуется разработать дизайн</span>
          </label>
          {needsDesign && (
            <div>
              <label className={labelCls}>Стоимость разработки дизайна, ₽</label>
              <input type="number" min={0} className={inputCls}
                placeholder="1000"
                {...register('designDevelopmentCost')} />
              <p className="text-xs text-gray-500 mt-1">
                Входит в чек клиента отдельной суммой. От неё считается премия менеджера по оформлению.
              </p>
            </div>
          )}
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
