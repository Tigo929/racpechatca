/**
 * Позиция — печать на изделии клиента (заготовку приносит заказчик).
 *
 * С 12.11.2026 флаг printOnClientItem ставится из способа оплаты партнёру
 * (MARGIN_SHARE). Но «изделие клиента» — свойство самой работы, а не того,
 * как платим исполнителю: 25.11 позицию «Нанесение принта на изделие
 * заказчика» завели с оплатой «не платим», флаг снялся, и лист согласования
 * перестал предупреждать клиента и печатника. Поэтому смотрим и на название.
 */
export function isClientItemPosition(item: {
  printOnClientItem?: boolean | null;
  formatPaper?: string | null;
}): boolean {
  if (item.printOnClientItem) return true;
  return /издели[еяию]\s+(заказчика|клиента)/i.test(item.formatPaper ?? '');
}
