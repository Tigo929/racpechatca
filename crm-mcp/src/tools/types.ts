import { z } from 'zod';

/**
 * Один инструмент MCP.
 *
 * Имя — глагол от вопроса владельца, а не от таблицы: модель выбирает
 * инструмент по описанию, и «сколько стоит заявка» должно попадать
 * в ad_economics, а не заставлять её склеивать три вызова.
 *
 * Описание пишется для модели, а не для человека: в нём должно быть
 * сказано, на какой вопрос инструмент отвечает и чего он НЕ знает.
 * Второе важнее: модель, не знающая границ инструмента, додумывает.
 */
export interface Tool {
  name: string;
  title: string;
  description: string;
  schema: z.ZodRawShape;
  run: (args: Record<string, unknown>) => Promise<string>;
}

/** Период — общая часть почти всех инструментов. */
export const periodSchema = {
  from: z
    .string()
    .optional()
    .describe('Начало периода, ГГГГ-ММ-ДД. Пусто — 30 дней назад.'),
  to: z
    .string()
    .optional()
    .describe('Конец периода включительно, ГГГГ-ММ-ДД. Пусто — сегодня.'),
};

/** Источник заказа: тот же перечень, что в CRM. */
export const sourceSchema = z
  .enum(['AVITO', 'OZON', 'WB', 'LOCAL', 'WEBSITE', 'UNKNOWN'])
  .optional()
  .describe(
    'Откуда заказ: AVITO, OZON, WB, LOCAL (самотёк), WEBSITE (заявка с сайта), UNKNOWN. Пусто — все источники.',
  );

/** Категория товара. */
export const categorySchema = z
  .enum(['PHOTO', 'TSHIRT', 'CANVAS'])
  .optional()
  .describe('Что за товар: PHOTO (фотопечать), TSHIRT (футболки), CANVAS (холсты). Пусто — все.');

/** Сколько строк отдавать в таблицах-топах. */
export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(50)
  .optional()
  .describe('Сколько строк показать. По умолчанию 15, больше 50 нельзя — это не выгрузка.');

/** Прочитать limit с общим значением по умолчанию. */
export function readLimit(args: Record<string, unknown>, fallback = 15): number {
  const raw = args.limit;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(50, Math.max(1, Math.trunc(raw)));
}
