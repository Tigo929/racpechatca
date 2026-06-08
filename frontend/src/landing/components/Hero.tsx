import { Sparkles, Calculator, ArrowRight, ShieldCheck, Layers, Clock } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { useOrderModal } from './OrderModalContext';
import { MagneticButton } from './MagneticButton';
import { TshirtSVG } from './TshirtSVG';
import { siteConfig } from '../../config/siteConfig';

const MINI = [
  { icon: Layers, text: 'От 1 штуки' },
  { icon: ShieldCheck, text: 'Износостойкая печать' },
  { icon: Clock, text: 'Быстрая выдача' },
];

const spring = { type: 'spring', stiffness: 60, damping: 18, mass: 1 } as const;

export function Hero() {
  const { openModal } = useOrderModal();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const blobY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const shirtY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section
      ref={ref}
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-950 to-indigo-900 pt-32 pb-20 sm:pt-40 sm:pb-28"
    >
      {/* Параллакс-блобы */}
      <motion.div aria-hidden style={{ y: blobY }} className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob absolute -top-20 -left-20 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="blob blob-delay absolute top-40 -right-24 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl" />
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        {/* Текстовая колонка */}
        <div className="text-center lg:text-left">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-amber-300 text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            Печать на футболках от 1 штуки
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.15 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight"
          >
            Печать на футболках<br className="hidden sm:block" /> в {siteConfig.city}
            <span className="text-amber-500"> — от 1 штуки</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.25 }}
            className="mt-6 text-lg text-indigo-200 max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            Свой принт, фото, надпись или корпоративный мерч. Поможем с макетом,
            напечатаем качественно и подготовим заказ к выдаче.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.35 }}
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
          >
            <MagneticButton
              onClick={() => openModal()}
              className="cta-pulse btn-shimmer inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-base transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Создать свой дизайн
            </MagneticButton>
            <MagneticButton
              onClick={() => openModal('Хочу рассчитать тираж футболок: ')}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-base transition-colors"
              strength={0.2}
            >
              <Calculator className="w-5 h-5" />
              Рассчитать тираж
            </MagneticButton>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...spring, delay: 0.48 }}
            className="mt-9 flex flex-wrap gap-x-6 gap-y-3 justify-center lg:justify-start"
          >
            {MINI.map((m, i) => (
              <motion.li
                key={m.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-2 text-indigo-200 text-sm"
              >
                <m.icon className="w-4 h-4 text-amber-400" />
                {m.text}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* Визуал: футболка + плавающие карточки */}
        <motion.div
          style={{ y: shirtY }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.2 }}
          className="relative flex justify-center"
        >
          <div className="relative w-72 sm:w-80">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-indigo-400/20 blur-2xl rounded-full scale-90" aria-hidden />
            <TshirtSVG
              color="#FFFFFF"
              ink="#1E1B4B"
              printLabel="ВАШ ПРИНТ"
              showPrintArea
              className="relative w-full drop-shadow-2xl"
            />

            {/* Плавающая карточка — качество */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -left-6 sm:-left-10 top-10 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
              </span>
              <div className="text-left">
                <div className="text-xs text-slate-500">Качество</div>
                <div className="text-sm font-bold text-slate-900">Стойкая печать</div>
              </div>
            </motion.div>

            {/* Плавающая карточка — скорость */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute -right-4 sm:-right-8 bottom-12 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-indigo-700" />
              </span>
              <div className="text-left">
                <div className="text-xs text-slate-500">Срок</div>
                <div className="text-sm font-bold text-slate-900">Быстрая выдача</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
