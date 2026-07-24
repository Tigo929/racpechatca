import type {
  EnumDeliveryMethod,
  EnumPrintLocation,
  EnumPrintType,
  EnumProductCategory,
  EnumTshirtGender,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';
import type { Answers } from './scenario.types';

/**
 * Превращение собранных ответов в заказ.
 *
 * Описание сценария — данные (его отдаём в браузер), а вот преобразование в
 * заказ — код: тут цены, позиции и производственные поля, а на них держится
 * расчёт с партнёром и зарплата. Правило то же самое: один продукт — один файл,
 * зарегистрированный в реестре.
 */

export interface PhotoItemDraft {
  formatPaper: string;
  typePaper: 'GLOSS' | 'MATTE';
  quantity: number;
  price: number;
  isFreePrice: boolean;
}

export interface TshirtItemDraft {
  color: string;
  size: EnumTshirtSize;
  gender: EnumTshirtGender;
  printLocation: EnumPrintLocation;
  printType: EnumPrintType;
  quantity: number;
  price: number;
  clientItem: boolean;
  designNote?: string;
}

export interface ScenarioOrderMapping {
  productCategory: EnumProductCategory;
  deliveryMethod: EnumDeliveryMethod;
  deliveryCost: number;
  deadline: Date | null;
  isUrgent: boolean;
  note: string | null;
  tshirtModel: string | null;
  /** Отдельная строка чека, не уходит партнёру. */
  designDevelopmentCost: number;
  photoItems: PhotoItemDraft[];
  tshirtItems: TshirtItemDraft[];
}

// ── Чтение ответов ───────────────────────────────────────────────────────────
// Ответы приходят из JSON, поэтому тип каждого значения проверяем на месте:
// «пришло не то» должно превращаться в пустое значение, а не в NaN в деньгах.

export function str(a: Answers, key: string): string {
  const v = a[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function num(a: Answers, key: string): number {
  const v = a[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function bool(a: Answers, key: string): boolean {
  return a[key] === true;
}

export function date(a: Answers, key: string): Date | null {
  const raw = str(a, key);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Доставка при самовывозе всегда бесплатная — поле в форме тогда скрыто. */
export function deliveryOf(a: Answers): {
  deliveryMethod: EnumDeliveryMethod;
  deliveryCost: number;
} {
  const method = (str(a, 'deliveryMethod') || 'PICKUP') as EnumDeliveryMethod;
  return {
    deliveryMethod: method,
    deliveryCost: method === 'PICKUP' ? 0 : num(a, 'deliveryCost'),
  };
}

/**
 * Комментарий к заказу: то, что менеджер написал сам, плюс адрес доставки.
 * Адрес отдельным полем в заказе не хранится, а исполнителю он нужен.
 */
export function noteOf(a: Answers, extra: string[] = []): string | null {
  const lines = [...extra];
  const address = str(a, 'deliveryAddress');
  if (address) lines.push(`Пункт выдачи: ${address}`);
  const own = str(a, 'note');
  if (own) lines.push(own);
  return lines.length ? lines.join('\n') : null;
}
