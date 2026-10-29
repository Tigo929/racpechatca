import { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /**
   * Управление, которое остаётся на виду, пока содержимое прокручивают, —
   * например переход к соседнему заказу. Живёт в шапке рядом с заголовком:
   * карточка длинная, и внутри неё такая кнопка уезжала бы за экран.
   */
  headerExtra?: React.ReactNode;
  /**
   * Меняется — значит внутри окна другая сущность, и прокрутку надо вернуть
   * к началу. Без этого переход к соседнему заказу открывал бы его с той
   * высоты, до которой дочитали предыдущий: человек видит середину карточки
   * и не понимает, сменился заказ или нет.
   */
  bodyKey?: string | number | null;
  /**
   * Тревожный вид окна: красная рамка, красная шапка, красный фон.
   *
   * Не украшение, а единственный способ не пройти мимо. Раньше о том,
   * что фотографии заказа доехали не все, говорила строка в примечании —
   * среди десятка других строк, ниже сгиба. Её пролистывали, и заказ
   * уезжал в печать неполным.
   *
   * Поэтому цвет взят у всего окна целиком: его нельзя не заметить и
   * нельзя прокрутить мимо. Ровно по этой причине он не должен
   * появляться там, где дело терпит, — иначе на красное перестанут
   * смотреть.
   */
  tone?: 'normal' | 'alert';
}

export function Modal({ open, onClose, title, children, size = 'md', headerExtra, bodyKey, tone = 'normal' }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // scrollTo у элемента есть не везде: в Safari до 14 и в jsdom его нет,
    // и вызов ронял всё окно целиком. Прокрутка к началу — удобство,
    // ради которого окно падать не должно.
    if (typeof body.scrollTo === 'function') body.scrollTo({ top: 0 });
    else body.scrollTop = 0;
  }, [bodyKey]);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      closeRef.current?.focus();
    } else {
      previousFocus.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        document.getElementById('modal-content-' + titleId)
          ?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
          ) ?? []
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, titleId]);

  if (!open) return null;

  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  const alert = tone === 'alert';

  return (
    // На мобильном модалка занимает весь экран (проще попадать пальцем,
    // клавиатура не ломает вёрстку), с sm и выше — привычное окно по центру.
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id={'modal-content-' + titleId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative rounded-none sm:rounded-2xl shadow-xl w-full ${widths[size]} max-h-[100dvh] sm:max-h-[90vh] flex flex-col overscroll-contain ${
          alert ? 'bg-red-50 ring-4 ring-red-500' : 'bg-white'
        }`}
      >
        {/* На телефоне модалка раскрывается во весь экран, поэтому её шапка
            упирается в «динамический остров» — и крестик становится
            ненажимаемым. Отступ по безопасной зоне решает это; на десктопе
            inset = 0, и остаётся обычный отступ 1rem. */}
        <div
          className={`flex items-center justify-between gap-2 px-4 sm:px-6 pb-4 border-b ${
            alert ? 'border-red-200 bg-red-100 rounded-t-none sm:rounded-t-2xl' : 'border-gray-100'
          }`}
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <h2
              id={titleId}
              className={`text-lg font-semibold ${alert ? 'text-red-800' : 'text-gray-900'}`}
            >
              {title}
            </h2>
            {headerExtra}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div
          ref={bodyRef}
          className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
