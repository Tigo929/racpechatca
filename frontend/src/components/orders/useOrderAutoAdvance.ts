import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Заказ ушёл из списка — карточка переходит на следующий, а не закрывается.
 *
 * Заказы разбирают подряд по одному фильтру: открыл «Готово», сменил статус,
 * следующий. Но смена статуса выбивает заказ из этого же списка, а удаление
 * убирает его совсем — и карточка закрывалась. Человек возвращался к списку,
 * который успел стать короче, и заново искал, где остановился. На десяти
 * заказах это десять поисков подряд.
 *
 * Теперь на место ушедшего заказа встаёт следующий по списку — тот, который
 * был под ним на экране. Список кончился — карточка закрывается: идти дальше
 * некуда, и держать пустое окно незачем.
 *
 * Хук не знает ни про статусы, ни про разделы: он видит только список на
 * экране и открытый заказ. Поэтому одинаково работает в фото, футболках,
 * холстах и обращениях — и будет работать с фильтром, которого ещё нет.
 */

interface Args<T extends { id: string }> {
  /** Заказы текущей страницы — в том порядке, в каком они на экране. */
  orders: T[];
  /** Открытый заказ; null — карточка закрыта. */
  selectedId: string | null;
  /** Открыть другой заказ или закрыть карточку (null). */
  onSelect: (id: string | null) => void;
  /**
   * Подпись выборки: раздел, фильтры, поиск, страница.
   *
   * Сменилась — список стал другим не потому, что заказ ушёл, а потому что
   * человек сам сменил отбор. Прыгать в этот момент нельзя: он смотрит
   * новый список, а не продолжает старый.
   */
  listKey: string;
  /** Идёт загрузка списка: пока идёт, кто ушёл, а кто нет — неизвестно. */
  isFetching: boolean;
  /** Идёт переход на соседнюю страницу стрелками — там свой ход по списку. */
  busy?: boolean;
}

export interface OrderAutoAdvance {
  /**
   * Перейти со заказа, которого вот-вот не станет: заказ ещё в списке, но
   * его уже удалили. Ждать обновления списка нельзя — за это время карточка
   * успеет показать удалённую заявку.
   */
  advanceFrom: (id: string) => void;
}

/** Следующий заказ после ушедшего — или null, если идти некуда. */
function successor(
  before: readonly string[],
  after: readonly string[],
  goneIndex: number,
): string | null {
  /*
   * Сначала ищем по прежнему списку: первый из тех, кто стоял ниже ушедшего
   * и остался на месте. Индекс для этого не годится — пока карточка была
   * открыта, выше могли появиться новые заявки и сдвинуть список.
   */
  for (let i = goneIndex + 1; i < before.length; i += 1) {
    if (after.includes(before[i])) return before[i];
  }
  /*
   * Ушедший был последним на странице: тех, кто стоял ниже, здесь и не было.
   * Тогда следующий — тот, кто подтянулся на его место со следующей
   * страницы. Для человека это ровно «следующий по списку».
   */
  return after[goneIndex] ?? null;
}

export function useOrderAutoAdvance<T extends { id: string }>({
  orders,
  selectedId,
  onSelect,
  listKey,
  isFetching,
  busy = false,
}: Args<T>): OrderAutoAdvance {
  // Список, который человек видел до обновления, и выборка, которой он
  // принадлежал. Это память, а не то, что рисуется, — поэтому ref.
  const seen = useRef<{ listKey: string; ids: string[] }>({ listKey, ids: [] });

  const ids = useMemo(() => orders.map((o) => o.id), [orders]);

  useEffect(() => {
    const current = ids;
    const previous = seen.current;

    // Другая выборка — прежний список больше ни о чём не говорит.
    if (previous.listKey !== listKey) {
      seen.current = { listKey, ids: current };
      return;
    }
    // Пока список в пути, он ещё прежний: решать по нему нельзя.
    if (isFetching || busy) return;

    seen.current = { listKey, ids: current };

    if (!selectedId || current.includes(selectedId)) return;

    /*
     * Заказа нет в списке, и в прежнем его тоже не было — значит, он и не
     * приходил оттуда: так открывают только что созданную заявку. Закрывать
     * такую карточку нельзя, человек её сам открыл.
     */
    const goneIndex = previous.ids.indexOf(selectedId);
    if (goneIndex < 0) return;

    onSelect(successor(previous.ids, current, goneIndex));
  }, [ids, listKey, isFetching, busy, selectedId, onSelect]);

  const advanceFrom = useCallback(
    (id: string) => {
      const index = ids.indexOf(id);
      const rest = index < 0 ? [] : ids.slice(index + 1);
      onSelect(rest[0] ?? null);
      // Ушедший заказ вычёркиваем сразу: обновлённый список придёт уже без
      // него, и без этого переход посчитался бы второй раз.
      seen.current = { listKey, ids: ids.filter((value) => value !== id) };
    },
    [ids, listKey, onSelect],
  );

  return { advanceFrom };
}
