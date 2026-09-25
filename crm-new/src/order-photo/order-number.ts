/**
 * Каким номером называют заказ.
 *
 * У заказа в CRM есть свой номер (`numberOrder`) — по нему считаются
 * зарплата, задачи и отчёты, и менять его нельзя. Но заказ с маркетплейса
 * живёт двумя номерами: наш внутренний и номер площадки, которым этот заказ
 * назван в кабинете Ozon и в переписке с покупателем. Покупателю наш номер
 * не говорит ничего, а владельцу, который открыл кабинет площадки, — наоборот.
 *
 * Поэтому правило одно на всю систему: где заказ НАЗЫВАЮТ — карточка, список,
 * лист согласования, сообщение покупателю — показывается номер площадки, если
 * он есть. Где заказ СЧИТАЮТ — зарплата, отчёты, выгрузка партнёру — остаётся
 * внутренний номер. Два места, где это решается по-разному, разъехались бы
 * на первом же заказе, поэтому решение здесь одно.
 */

export interface OrderNumbers {
  numberOrder: string;
  marketplaceOrderNumber?: string | null;
}

/** Номер площадки, если он задан и не пустой. */
export function marketplaceNumber(order: OrderNumbers): string | null {
  const value = (order.marketplaceOrderNumber ?? '').trim();
  return value ? value : null;
}

/** Номер, которым заказ называют людям. */
export function displayOrderNumber(order: OrderNumbers): string {
  return marketplaceNumber(order) ?? order.numberOrder;
}

/**
 * Приводит введённый номер площадки к хранимому виду.
 *
 * Номер копируют из кабинета — вместе с пробелами по краям. Пустая строка
 * означает «номера нет»: хранить её вместо null нельзя, иначе заказ будет
 * выглядеть как имеющий номер площадки, а показывать станет пустоту.
 */
export function normalizeMarketplaceNumber(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MARKETPLACE_NUMBER_MAX) : null;
}

export const MARKETPLACE_NUMBER_MAX = 64;
