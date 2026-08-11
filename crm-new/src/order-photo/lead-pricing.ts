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
