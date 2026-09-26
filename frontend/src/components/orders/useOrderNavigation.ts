import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Ход по списку заказов из открытой карточки.
 *
 * Список разбит на страницы, а смотрят его подряд, не думая о страницах.
 * Поэтому на краю страницы стрелка не гаснет: хук просит соседнюю страницу
 * и, когда та придёт, открывает её крайний заказ — последний при движении
 * назад, первый при движении вперёд. Для человека это просто «следующий».
 *
 * Запрошенный край хранится в ref, а не в состоянии: ожидание — это не то,
 * что рисуется, а то, что делает следующий пришедший ответ. Состоянием оно
 * вызывало бы лишнюю перерисовку карточки на каждый шаг.
 *
 * Хук ничего не знает о разделе и фильтрах: он получает список, который
 * сейчас на экране, и потому одинаково работает в фото, футболках, холстах
 * и обращениях. Смена раздела — это другой список, и ход по нему свой.
 */

interface Args<T extends { id: string }> {
  /** Заказы текущей страницы — ровно в том порядке, в каком они на экране. */
  orders: T[];
  /** Открытый заказ; null — карточка закрыта. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Текущая страница, с 1. */
  page: number;
  totalPages: number;
  /** Сколько заказов в выборке целиком. */
  totalItems: number;
  /** Размер страницы — по нему считается место заказа во всей выборке. */
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Идёт ли загрузка списка: пока идёт, соседний заказ ещё не известен. */
  isFetching: boolean;
}

export interface OrderNavigation {
  /** Место во всей выборке, с 1. Ноль — заказа в текущем списке нет. */
  position: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
  /** Ждём соседнюю страницу. */
  busy: boolean;
}

export function useOrderNavigation<T extends { id: string }>({
  orders,
  selectedId,
  onSelect,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  isFetching,
}: Args<T>): OrderNavigation {
  // Какую страницу и с какого края ждём. null — ничего не ждём.
  //
  // Страницу держим рядом с краем не для красоты: пока запрос в пути,
  // список остаётся прежним (react-query отдаёт предыдущие данные), и без
  // проверки «пришла именно та страница» неудачный запрос открыл бы крайний
  // заказ старой страницы — то есть увёл бы человека назад вместо вперёд.
  const pending = useRef<{ page: number; edge: 'first' | 'last' } | null>(null);
  const [busy, setBusy] = useState(false);

  const index = useMemo(
    () => (selectedId ? orders.findIndex((o) => o.id === selectedId) : -1),
    [orders, selectedId],
  );

  // Пришла соседняя страница — открываем её крайний заказ.
  useEffect(() => {
    const waiting = pending.current;
    if (!waiting || isFetching || waiting.page !== page) return;
    const target =
      waiting.edge === 'first' ? orders[0] : orders[orders.length - 1];
    pending.current = null;
    setBusy(false);
    if (target) onSelect(target.id);
  }, [orders, page, isFetching, onSelect]);

  // Карточку закрыли посреди перехода — ожидание снимаем, иначе следующее
  // открытие списка молча перебросило бы человека на чужой заказ.
  useEffect(() => {
    if (!selectedId && pending.current) {
      pending.current = null;
      setBusy(false);
    }
  }, [selectedId]);

  const hasSelection = index >= 0;
  const canPrev = hasSelection && (index > 0 || page > 1);
  const canNext =
    hasSelection && (index < orders.length - 1 || page < totalPages);

  const prev = useCallback(() => {
    if (!canPrev || busy) return;
    if (index > 0) {
      onSelect(orders[index - 1].id);
      return;
    }
    pending.current = { page: page - 1, edge: 'last' };
    setBusy(true);
    onPageChange(page - 1);
  }, [canPrev, busy, index, orders, onSelect, onPageChange, page]);

  const next = useCallback(() => {
    if (!canNext || busy) return;
    if (index < orders.length - 1) {
      onSelect(orders[index + 1].id);
      return;
    }
    pending.current = { page: page + 1, edge: 'first' };
    setBusy(true);
    onPageChange(page + 1);
  }, [canNext, busy, index, orders, onSelect, onPageChange, page]);

  return {
    position: hasSelection ? (page - 1) * pageSize + index + 1 : 0,
    total: totalItems,
    canPrev,
    canNext,
    prev,
    next,
    busy,
  };
}

/**
 * Стрелки на клавиатуре — тот же ход, что и кнопками.
 *
 * Работают, только когда человек не печатает: в правке заказа те же стрелки
 * двигают курсор по полю, и перехватывать их там нельзя. Отдельно пропускаем
 * нажатия с модификаторами — это переходы по словам и системные сочетания.
 */
export function useArrowNavigation(
  active: boolean,
  nav: Pick<OrderNavigation, 'prev' | 'next'>,
): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      if (e.key === 'ArrowLeft') nav.prev();
      else nav.next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, nav]);
}
