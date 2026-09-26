import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Переход к соседнему заказу прямо из карточки.
 *
 * Заказы смотрят подряд: открыл — разобрался — следующий. Раньше для этого
 * приходилось закрывать карточку, искать в списке строку, на которой
 * остановился, и открывать соседнюю. На телефоне список при этом
 * прокручивался к началу, и место терялось совсем.
 *
 * Стрелки идут по тому же списку, который сейчас на экране: с теми же
 * фильтрами, поиском и сортировкой. Порядок совпадает с тем, что человек
 * видел перед открытием, — иначе «следующий» означал бы не то, что он ждёт.
 *
 * Счётчик показывает место во всей выборке, а не на странице: «4 из 37»
 * отвечает на вопрос «сколько ещё осталось», ради которого на него и смотрят.
 */

interface Props {
  /** Место заказа во всей выборке, начиная с 1. */
  position: number;
  /** Сколько заказов в выборке целиком, со всеми страницами. */
  total: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** Идёт подгрузка соседней страницы — переход занимает мгновение. */
  busy?: boolean;
}

const btn =
  'min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border ' +
  'border-gray-200 bg-white text-gray-600 transition-colors ' +
  'hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 ' +
  'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white ' +
  'disabled:hover:border-gray-200 disabled:hover:text-gray-600 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

export function OrderNavigator({
  position,
  total,
  onPrev,
  onNext,
  canPrev,
  canNext,
  busy = false,
}: Props) {
  // Ноль — открытого заказа в текущем списке нет: сменили фильтр или поиск,
  // пока карточка была открыта. Показывать «0 из 37» и мёртвые стрелки
  // незачем — ход по списку в этот момент не имеет смысла.
  if (total <= 1 || position < 1) return null;
  return (
    <div className="flex items-center gap-1.5" aria-label="Переход между заказами">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev || busy}
        // Подпись словами, а не «стрелка влево»: её читают вслух программы
        // чтения экрана, и «предыдущий заказ» там понятнее направления.
        aria-label="Предыдущий заказ"
        title="Предыдущий заказ (←)"
        className={btn}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span
        className="text-xs text-gray-500 tabular-nums whitespace-nowrap px-1"
        // Счётчик меняется от нажатия соседней кнопки: пусть программы чтения
        // экрана объявляют новое место, не перехватывая фокус.
        aria-live="polite"
      >
        {busy ? '…' : `${position} из ${total}`}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext || busy}
        aria-label="Следующий заказ"
        title="Следующий заказ (→)"
        className={btn}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
