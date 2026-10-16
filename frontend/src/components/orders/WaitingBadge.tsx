import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import {
  formatWaiting,
  waitingClass,
  waitingMs,
  waitingTitle,
  waitingTone,
  type WaitingOrder,
} from '../../utils/waiting';

/**
 * Сколько заявка ждёт ответа — прямо в списке и в карточке.
 *
 * Время идёт само: открытый список обновляется раз в полминуты, иначе
 * счётчик замирал бы на той минуте, когда страницу открыли, и показывал
 * бы неправду ровно тогда, когда на него смотрят дольше всего.
 *
 * Полминуты, а не секунда: подпись всё равно в минутах, а лишние
 * перерисовки списка на телефоне видны.
 */
const TICK_MS = 30 * 1000;

export function WaitingBadge({
  order,
  size = 'sm',
}: {
  order: WaitingOrder;
  size?: 'sm' | 'md';
}) {
  const [now, setNow] = useState(() => Date.now());

  const ms = waitingMs(order, now);
  const counting = ms !== null;

  useEffect(() => {
    // Заявку приняли — часы останавливаются, таймер больше не нужен.
    if (!counting) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [counting]);

  if (ms === null) return null;

  const icon = size === 'md' ? 12 : 9;
  return (
    <span
      title={waitingTitle(ms)}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
        size === 'md' ? 'text-xs' : ''
      } ${waitingClass(waitingTone(ms))}`}
    >
      <Hourglass size={icon} aria-hidden="true" /> ждёт {formatWaiting(ms)}
    </span>
  );
}
