/**
 * Правила массового изменения остатков Ozon. Чистые функции без базы и
 * сети — сервис только тянет данные и зовёт их.
 *
 * Здесь же собраны все числа, которые диктует площадка. Держать их в одном
 * месте важнее обычного: Ozon меняет лимиты объявлениями в блоге для
 * разработчиков, и когда это случится, править нужно ровно эту таблицу,
 * а не половину модуля.
 */

/**
 * Сколько пар «товар × склад» уходит в один запрос /v2/products/stocks.
 *
 * Сто — предел площадки, причём считаются именно пары: один товар на трёх
 * складах это три позиции, а не одна.
 */
export const OZON_STOCK_CHUNK = 100;

/**
 * Как часто можно трогать одну и ту же пару «товар × склад».
 *
 * Тридцать секунд — ограничение Ozon, и это самое неудобное правило во
 * всей задаче. Из-за него нельзя просто так нажать «повторить только
 * ошибки» сразу после неудачи: те же пары уйдут в запрещённое окно и
 * получат отказ во второй раз. Поэтому время последней отправки по паре
 * запоминается, а повтор ждёт своей очереди.
 */
export const MIN_PAIR_INTERVAL_MS = 30_000;

/**
 * С какого размера операции требовать ввод слова подтверждения.
 *
 * Порог наш, а не площадки: он про цену ошибки, а не про лимиты API.
 * Пятьсот пар — это заведомо больше, чем «поправить пару принтов», и
 * заведомо меньше, чем полный пересчёт склада.
 */
export const LARGE_OPERATION_THRESHOLD = 500;

/**
 * Потолок количества. Тоже наш: в документации Ozon верхней границы
 * остатка нет, но опечатка в поле ввода не должна превращаться
 * в миллион футболок на складе.
 */
export const MAX_QUANTITY = 100_000;

export type BulkStockMode = 'SET' | 'ADD';

/** Склад с количеством. Одно значение для всех — это просто одинаковое
 * количество у каждого склада, отдельного случая для него нет. */
export interface WarehouseQuantity {
  warehouseId: number;
  quantity: number;
}

/** Одна единица работы: что, куда и сколько. */
export interface StockPair {
  offerId: string;
  warehouseId: number;
  quantity: number;
}

export class BulkStockValidationError extends Error {}

/**
 * Количество: целое, не меньше нуля.
 *
 * Ноль разрешён намеренно — это штатный способ снять товар с продажи,
 * и ТЗ требует его поддержать. Предупреждение про обнуление — забота
 * интерфейса, а не проверки.
 */
export function checkQuantity(value: number, what = 'Количество'): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new BulkStockValidationError(`${what} должно быть целым числом.`);
  }
  if (value < 0) {
    throw new BulkStockValidationError(`${what} не может быть отрицательным.`);
  }
  if (value > MAX_QUANTITY) {
    throw new BulkStockValidationError(
      `${what} больше ${MAX_QUANTITY.toLocaleString('ru-RU')} — похоже на опечатку.`,
    );
  }
}

/**
 * Артикулы к работе: без пустых и без повторов.
 *
 * Регистр значим и не приводится: offer_id у Ozon регистрозависим, и
 * «JDM-1» с «jdm-1» — разные товары. Приведение к нижнему регистру
 * означало бы отправку остатка не тому товару.
 */
export function normalizeOfferIds(offerIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of offerIds) {
    const offerId = raw.trim();
    if (!offerId || seen.has(offerId)) continue;
    seen.add(offerId);
    result.push(offerId);
  }
  if (result.length === 0) {
    throw new BulkStockValidationError('Не выбран ни один товар.');
  }
  return result;
}

/**
 * Склады к работе: без повторов, с проверкой количества у каждого.
 *
 * `allowed` — идентификаторы складов, на которые кабинету разрешено
 * писать. Выбор приходит из браузера, и принимать его на веру нельзя:
 * там может оказаться и выключенный склад, и чужой.
 */
export function normalizeWarehouses(
  warehouses: WarehouseQuantity[],
  allowed: Set<number>,
): WarehouseQuantity[] {
  const seen = new Set<number>();
  const result: WarehouseQuantity[] = [];

  for (const item of warehouses) {
    if (seen.has(item.warehouseId)) continue;
    seen.add(item.warehouseId);

    if (!allowed.has(item.warehouseId)) {
      throw new BulkStockValidationError(
        `Склад ${item.warehouseId} недоступен для изменения остатков.`,
      );
    }
    checkQuantity(item.quantity, 'Количество на складе');
    result.push({ warehouseId: item.warehouseId, quantity: item.quantity });
  }

  if (result.length === 0) {
    throw new BulkStockValidationError('Не выбран ни один склад.');
  }
  return result;
}

/**
 * Все пары «товар × склад».
 *
 * Порядок — по товарам, внутри по складам: так пачка запросов идёт
 * товар за товаром, и частичный отказ виден как «этот товар не прошёл»,
 * а не как случайная россыпь по всему списку.
 *
 * Количество берётся у склада. Один и тот же случай покрывает и «одно
 * число для всех» (у всех складов оно совпадает), и «разные значения по
 * складам» — отдельной ветки для второго не нужно.
 */
export function buildPairs(
  offerIds: string[],
  warehouses: WarehouseQuantity[],
): StockPair[] {
  const pairs: StockPair[] = [];
  for (const offerId of offerIds) {
    for (const warehouse of warehouses) {
      pairs.push({
        offerId,
        warehouseId: warehouse.warehouseId,
        quantity: warehouse.quantity,
      });
    }
  }
  return pairs;
}

/** Разбиение на запросы по лимиту площадки. */
export function chunkPairs(
  pairs: StockPair[],
  size: number = OZON_STOCK_CHUNK,
): StockPair[][] {
  if (size < 1) throw new BulkStockValidationError('Размер пачки меньше единицы.');
  const chunks: StockPair[][] = [];
  for (let i = 0; i < pairs.length; i += size) {
    chunks.push(pairs.slice(i, i + size));
  }
  return chunks;
}

/** Нужен ли ввод слова подтверждения перед отправкой. */
export function needsStrongConfirm(
  operationCount: number,
  threshold: number = LARGE_OPERATION_THRESHOLD,
): boolean {
  return operationCount >= threshold;
}

/**
 * Обнуляем ли мы что-нибудь. Отдельный признак, потому что обнуление —
 * единственное изменение, которое снимает товар с продажи, и предупреждать
 * о нём нужно даже когда операция маленькая.
 */
export function zeroingCount(pairs: StockPair[]): number {
  return pairs.filter((pair) => pair.quantity === 0).length;
}

/**
 * Сколько ждать до следующей отправки этой пары.
 *
 * Ноль — можно слать сейчас. Считается от времени прошлой отправки,
 * а не от начала операции: повтор ошибок запускают руками и когда
 * захотят, и правило площадки отсчитывается именно от прошлой попытки.
 */
export function waitBeforeRetryMs(
  lastSentAt: Date | null,
  now: Date,
  intervalMs: number = MIN_PAIR_INTERVAL_MS,
): number {
  if (!lastSentAt) return 0;
  const passed = now.getTime() - lastSentAt.getTime();
  return passed >= intervalMs ? 0 : intervalMs - passed;
}
