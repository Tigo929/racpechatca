import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { useInView } from 'motion/react';
import { TiltCard } from './TiltCard';
import { Reveal } from './Reveal';
import { TshirtSVG } from './TshirtSVG';
import { catalogItems } from '../data/content';

const ruble = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 65, damping: 18, delay: i * 0.09 },
  }),
};

function CatalogCard({ item, index }: { item: typeof catalogItems[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '0px 0px -60px 0px' });

  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
    >
      <TiltCard maxTilt={10} className="h-full group">
      <article className="relative h-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer">
        <Link
          to={`/${item.slug}`}
          aria-label={item.title}
          className="absolute inset-0 z-0"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="relative z-10 bg-gradient-to-br from-slate-50 to-indigo-50/50 flex items-center justify-center py-8 pointer-events-none">
          <TshirtSVG
            color={item.previewColor}
            ink={item.previewColor === '#FFFFFF' ? '#1E1B4B' : '#FFFFFF'}
            className="w-32 h-32"
          />
          <span className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-white shadow flex items-center justify-center">
            <item.icon className="w-5 h-5 text-indigo-700" />
          </span>
        </div>
        <div className="relative z-10 flex flex-col flex-1 p-5 pointer-events-none">
          <h3 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h3>
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed flex-1">{item.description}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-slate-900 font-bold">
              <span className="text-xs font-normal text-slate-400">от </span>
              {ruble(item.priceFrom)}
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold">
              Выбрать <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </article>
      </TiltCard>
    </motion.div>
  );
}

export function Catalog() {
  return (
    <section id="catalog" className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mb-10">
            <span className="text-amber-600 font-semibold text-sm">Каталог</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Что можно напечатать
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Выберите формат — мы поможем с макетом и рассчитаем стоимость под ваш тираж.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {catalogItems.map((item, i) => (
            <CatalogCard key={item.slug} item={item} index={i} />
          ))}
        </div>
        <p className="mt-5 text-xs text-slate-400 text-center">
          Цены указаны как ориентир «от». Точную стоимость рассчитаем под ваш макет и тираж.
        </p>
      </div>
    </section>
  );
}
