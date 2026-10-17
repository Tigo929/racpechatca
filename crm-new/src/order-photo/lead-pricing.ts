/**
 * Проверка денег в заявке с сайта.
 *
 * Разделение ответственности: прайс-лист живёт на сайте, там же считается цена
 * (клиент её не задаёт — в форме сайта поля цены нет). CRM цену не пересчитывает,
 * чтобы не заводить второй прайс-лист и не расходиться с витриной, но и на слово
 * не верит: проверяет, что присланные числа сходятся между собой и выглядят
 * правдоподобно. Итог заказа CRM считает сама из проверенных позиций.
 *
 * Чистые функции без БД и сети — поэтому полностью покрыты тестами.
 */

/** Потолок на одну позицию: выше — почти наверняка ошибка или подмена. */
export const MAX_POSITION_TOTAL = 10_000_000;

export interface LeadMoneyInput {
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface LeadMoneyResult {
  /** Тираж, с которым создаём позицию. */
  quantity: number;
  /** Цена за штуку. */
  unitPrice: number;
  /** Итог позиции — ВСЕГДА считает CRM, присланный total только сверяется. */
  pricePosition: number;
}

export class LeadMoneyError extends Error {}

/**
 * Сверяет присланные числа и возвращает суммы, посчитанные на нашей стороне.
 *
 * Заявка без цены — нормальный случай (клиент просто оставил контакты):
 * возвращаем нули, заказ создастся без позиции.
 */
export function resolveLeadMoney(input: LeadMoneyInput): LeadMoneyResult {
  const quantity = input.quantity ?? 0;
  const unitPrice = input.unitPrice ?? 0;

  // Ни тиража, ни цены — заявка без расчёта, это допустимо.
  if (quantity <= 0 && unitPrice <= 0) {
    return { quantity: 0, unitPrice: 0, pricePosition: 0 };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new LeadMoneyError('Некорректный тираж в заявке.');
  }
  if (!Number.isInteger(unitPrice) || unitPrice < 0) {
    throw new LeadMoneyError('Некорректная цена в заявке.');
  }

  const pricePosition = unitPrice * quantity;
  if (pricePosition > MAX_POSITION_TOTAL) {
    throw new LeadMoneyError('Сумма заявки выходит за разумные пределы.');
  }

  // Если сайт прислал итог — он обязан сходиться с ценой × тираж. Расхождение
  // означает баг на сайте или подмену по дороге: такую заявку не принимаем,
  // потому что дальше по ней считается зарплата и расчёт с партнёром.
  if (input.total != null && input.total !== pricePosition) {
    throw new LeadMoneyError(
      `Итог заявки не сходится: прислано ${input.total}, посчитано ${pricePosition}.`,
    );
  }

  return { quantity, unitPrice, pricePosition };
}

/** Строка заказа из заявки: сайт присылает её уже посчитанной. */
export interface LeadItemInput {
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Проверяет заявку из нескольких позиций и считает её итог.
 *
 * Так приходит заказ фотопечати, где часть снимков печатается с полями,
 * а часть без: у каждой строки своя цена, и единой «цены за штуку» у
 * такого заказа нет. Поэтому итог складывается из строк, а проверяется
 * каждая строка по отдельности — ровно так же, как одиночная позиция.
 */
export function resolveLeadItemsMoney(items: LeadItemInput[]): LeadMoneyResult {
  if (items.length === 0) {
    return { quantity: 0, unitPrice: 0, pricePosition: 0 };
  }

  let quantity = 0;
  let pricePosition = 0;
  for (const item of items) {
    const line = resolveLeadMoney(item);
    if (line.quantity <= 0) {
      throw new LeadMoneyError('Пустая позиция в заявке.');
    }
    quantity += line.quantity;
    pricePosition += line.pricePosition;
  }

  if (pricePosition > MAX_POSITION_TOTAL) {
    throw new LeadMoneyError('Сумма заявки выходит за разумные пределы.');
  }

  /*
   * Единой цены за штуку у смешанного заказа нет, и выдумывать среднюю
   * нельзя: по ней потом посчитали бы зарплату. Ноль здесь означает
   * «смотри строки», а строки заведены отдельно.
   */
  return { quantity, unitPrice: 0, pricePosition };
}
