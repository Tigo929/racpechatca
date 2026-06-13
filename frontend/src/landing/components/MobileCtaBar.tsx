import { useEffect, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useOrderModal } from './useOrderModal';
import { telegramUrl } from '../../config/siteConfig';

/**
 * Липкая нижняя панель действий для мобильных.
 * Появляется после прокрутки первого экрана — основной CTA всегда под рукой,
 * что заметно повышает конверсию на телефоне. На десктопе скрыта.
 */
export function MobileCtaBar() {
  const { openModal } = useOrderModal();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-white via-white to-white/85 backdrop-blur border-t border-slate-100"
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => openModal()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-amber-600 active:bg-amber-700 text-white font-bold text-base shadow-lg shadow-amber-600/30"
            >
              <Sparkles className="w-5 h-5" />
              Рассчитать заказ
            </button>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Написать в Telegram"
              className="shrink-0 w-12 h-12 rounded-xl bg-[#229ED9] active:bg-[#1b8ec2] flex items-center justify-center shadow-lg shadow-sky-900/20"
            >
              <Send className="w-5 h-5 text-white -translate-x-0.5 translate-y-0.5" />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
