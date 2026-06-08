import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Reveal } from './Reveal';
import { PersonScene } from './PersonScene';
import { portfolioItems, type PortfolioItem } from '../data/portfolio';

/**
 * Галерея работ. Поддерживает реальные фото (lazy loading, адаптивные размеры)
 * и SVG-заглушки. Клик открывает lightbox. Архитектура позволяет добавить
 * фотографии без переписывания: просто заполните `src` в portfolio.ts.
 */
export function Gallery() {
  const [active, setActive] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [active]);

  return (
    <section id="gallery" className="py-20 sm:py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mb-10">
            <span className="text-amber-600 font-semibold text-sm">Работы</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Эмоции наших клиентов
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Подарки, команды и моменты, которые мы помогли создать. Реальные фото
              добавим по мере выполнения заказов — нажмите, чтобы рассмотреть.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {portfolioItems.map((item, i) => (
            <Reveal key={item.id} delay={i * 60}>
              <button
                onClick={() => setActive(item)}
                className="card-hover group relative block w-full aspect-square rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm"
                aria-label={item.alt}
              >
                {item.src ? (
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PersonScene color={item.color} ink={item.ink} className="w-full h-full" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-indigo-950/80 via-indigo-950/30 to-transparent p-3 pt-8 flex items-end">
                  <span className="text-white text-sm font-semibold text-left line-clamp-2">
                    {item.caption}
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="lightbox fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
        >
          <button
            onClick={() => setActive(null)}
            aria-label="Закрыть"
            className="absolute top-5 right-5 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-7 h-7" />
          </button>
          <div
            className="max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {active.src ? (
              <img src={active.src} alt={active.alt} className="w-full h-auto" />
            ) : (
              <PersonScene color={active.color} ink={active.ink} className="w-full max-h-[60vh]" />
            )}
            <div className="px-6 py-4">
              <p className="text-base font-bold text-slate-900">{active.caption}</p>
              <p className="mt-1 text-sm text-slate-500">{active.alt}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
