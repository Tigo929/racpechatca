/**
 * Переключение порядка списка заказов по нажатию на заголовок.
 *
 * Три состояния, а не два. Первое нажатие — по убыванию: у дедлайна это
 * «сначала самые поздние», у суммы — «сначала самые дорогие». Второе
 * переворачивает. Третье возвращает обычный порядок работы — активные
 * сверху, срочные выше, дальше по дате.
 *
 * Третьего шага не хватало бы больше всего: отсортировав один раз,
 * человек оставался бы в этом порядке навсегда и терял из виду, что
 * горит. Кнопки «отменить сортировку» в таблицах не ищут — ищут
 * повторное нажатие по тому же заголовку.
 */

export type OrdersSortField = 'deadline' | 'total';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  sort?: OrdersSortField;
  dir?: SortDirection;
}

export function nextSort(current: SortState, field: OrdersSortField): SortState {
  if (current.sort !== field) return { sort: field, dir: 'desc' };
  if (current.dir === 'desc') return { sort: field, dir: 'asc' };
  return {};
}
