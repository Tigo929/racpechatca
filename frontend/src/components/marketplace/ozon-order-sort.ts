import type { OzonOrder } from '../../api/ozonOrders';

/**
 * Порядок отправлений в списке — по времени приёма заказа площадкой.
 *
 * Макеты делают в порядке очереди: первым пришёл — первым печатаем. Раньше
 * список стоял по сроку отгрузки, и заказы, принятые в разные дни, лежали
 * вперемешку: чтобы понять, какой брать следующим, приходилось сверять время
 * у каждого. Теперь порядок тот же, что в кабинете Ozon, — сверять две
 * таблицы можно строкой к строке.
 *
 * «Принят» — это время заказа у площадки, а не заведения в CRM: оно одно
 * и то же в обоих окнах, и только по нему очередь совпадает с кабинетом.
 */

export type AcceptedOrder = Pick<OzonOrder, 'createdAt' | 'postingNumber'>;

export type SortDirection = 'earliest' | 'latest';

/**
 * Отсортированная копия: исходный массив приходит из кэша запроса, и править
 * его на месте нельзя — те же данные читает соседний экран.
 *
 * Отправления без времени приёма уходят в конец при любом направлении: это
 * не «самые ранние» и не «самые поздние», а «неизвестно когда», и места
 * в очереди у них нет.
 */
export function sortByAccepted<T extends AcceptedOrder>(
  orders: readonly T[],
  direction: SortDirection,
): T[] {
  const sign = direction === 'earliest' ? 1 : -1;
  return [...orders].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : null;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : null;
    if (at === null && bt === null) {
      return a.postingNumber.localeCompare(b.postingNumber);
    }
    if (at === null) return 1;
    if (bt === null) return -1;
    // Одинаковое время бывает у отправлений одного заказа (…-1, …-3):
    // тогда порядок задаёт номер, иначе список прыгал бы при каждом обновлении.
    if (at === bt) return a.postingNumber.localeCompare(b.postingNumber);
    return (at - bt) * sign;
  });
}

const RU_MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

/**
 * «6 окт 17:19» — как в кабинете Ozon.
 *
 * Собираем руками, а не через toLocaleString: тот ставит неразрывные пробелы
 * и в разных браузерах пишет месяц по-разному, а колонку сверяют глазами
 * с кабинетом.
 */
export function formatAccepted(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]} ${time}`;
}

/**
 * Соседнее отправление в списке — для стрелок в открытой карточке.
 *
 * Шаг считается по тому списку, который сейчас на экране: с выбранной
 * группой, этапом и порядком. Иначе «следующий» означал бы не то, что
 * видит человек.
 *
 * `null` — идти некуда: мы на краю списка либо открытого отправления
 * в нём нет вовсе (например, оно ушло из фильтра, пока карточка открыта).
 */
export function neighbourPosting<T extends { postingNumber: string }>(
  list: readonly T[],
  current: string | null,
  shift: number,
): T | null {
  if (!current) return null;
  const index = list.findIndex((o) => o.postingNumber === current);
  if (index < 0) return null;
  return list[index + shift] ?? null;
}
