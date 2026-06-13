import { Sparkles, ArrowRight, ShieldCheck, Star, Check } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { useOrderModal } from './useOrderModal';
import { MagneticButton } from './MagneticButton';
import { siteConfig } from '../../config/siteConfig';
import { tshirtPhotos } from '../../assets/portfolio';

const spring = { type: 'spring', stiffness: 60, damping: 18, mass: 1 } as const;

// Три шага «как заказать» — снимают когнитивную нагрузку (Cognitive Ease)
// и показывают близость к цели (Goal Gradient).
const STEPS = ['Загрузите макет', 'Согласуем бесплатно', 'Получите за 1 день'];

function scrollToDesigner() {
  document.getElementById('designer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Hero() {
  const { openModal } = useOrderModal();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const blobY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const photoY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <section
      ref={ref}
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-950 to-indigo-900 pt-28 pb-16 sm:pt-36 sm:pb-24"
    >
      {/* Параллакс-подсветка фона */}
      <motion.div aria-hidden style={{ y: blobY }} className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob absolute -top-20 -left-20 w-96 h-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="blob blob-delay absolute top-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-500/20 blur-3xl" />
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center">
        {/* ── Текстовая колонка ───────────────────────────────── */}
        <div className="text-center lg:text-left">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-amber-300 text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            Печать на футболках · от 1 штуки
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.13 }}
            className="text-4xl sm:text-5xl lg:text-[3.7rem] font-extrabold text-white leading-[1.05] tracking-tight text-balance"
          >
            Ваш принт на футболке
            <span className="block text-amber-500">за 1 день</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.22 }}
            className="mt-5 text-lg text-indigo-200 max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            Фото, надпись или свой дизайн. Покажем макет бесплатно, напечатаем
            стойкой печатью и подготовим к выдаче. Без минимального тиража.
          </motion.p>

          {/* Цена — ответ на «сколько стоит» за 3 секунды */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.3 }}
            className="mt-6 flex items-baseline gap-2.5 justify-center lg:justify-start"
          >
            <span className="text-indigo-300 text-sm">Цена</span>
            <span className="text-4xl font-extrabold text-white tabular-nums">от 990&nbsp;₽</span>
            <span className="text-indigo-300 text-sm">за 1 футболку</span>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.38 }}
            className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
          >
            <MagneticButton
              onClick={scrollToDesigner}
              className="cta-pulse btn-shimmer inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-base transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Создать дизайн
            </MagneticButton>
            <MagneticButton
              onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-base transition-colors"
              strength={0.2}
            >
              Заказать с готовым макетом
              <ArrowRight className="w-5 h-5" />
            </MagneticButton>
          </motion.div>

          {/* Соц.доказательство + снятие риска */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.46 }}
            className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start text-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="flex" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </span>
              <span className="text-white font-semibold">{siteConfig.rating.value}</span>
              <span className="text-indigo-300">· {siteConfig.rating.count} отзывов</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Бесплатный макет · оплата после согласования
            </span>
          </motion.div>

          {/* Три шага — Goal Gradient */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...spring, delay: 0.54 }}
            className="mt-7 flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start"
          >
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-indigo-200 text-sm">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ── Эмоциональное фото ──────────────────────────────── */}
        <motion.div
          style={{ y: photoY }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.2 }}
          className="relative"
        >
          <div className="relative mx-auto max-w-md lg:max-w-none">
            <div className="absolute -inset-4 bg-gradient-to-tr from-amber-500/25 to-indigo-400/20 blur-3xl rounded-[2.5rem]" aria-hidden />
            <div className="relative rounded-[2rem] overflow-hidden ring-1 ring-white/15 shadow-2xl shadow-indigo-950/60">
              <img
                src={tshirtPhotos.photo1}
                alt="Мужчина в чёрной футболке с принтом на фоне горного озера — печать на заказ"
                width={1200}
                height={800}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover aspect-[3/4] sm:aspect-[4/5]"
              />
              {/* Лёгкое затемнение снизу для читаемости плашек */}
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/40 via-transparent to-transparent" aria-hidden />
            </div>

            {/* Плашка качества */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.5 }}
              className="absolute -left-3 sm:-left-6 top-8 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
              </span>
              <div className="text-left">
                <div className="text-xs text-slate-500">Печать</div>
                <div className="text-sm font-bold text-slate-900">Стойкая к стирке</div>
              </div>
            </motion.div>

            {/* Плашка скорости */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.62 }}
              className="absolute -right-3 sm:-right-5 bottom-10 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </span>
              <div className="text-left">
                <div className="text-xs text-slate-500">Готовность</div>
                <div className="text-sm font-bold text-slate-900">от 1 дня</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
