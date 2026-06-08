import { Star, Quote } from 'lucide-react';
import { Reveal } from './Reveal';
import { reviews } from '../data/content';
import { siteConfig } from '../../config/siteConfig';

export function Reviews() {
  return (
    <section id="reviews" className="py-20 sm:py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div className="max-w-2xl">
              <span className="text-amber-600 font-semibold text-sm">Отзывы</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Что говорят клиенты
              </h2>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-3 border border-slate-100 shadow-sm">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-sm text-slate-600">
                <strong className="text-slate-900">{siteConfig.rating.value}</strong> из 5 ·{' '}
                {siteConfig.rating.count} отзывов
              </span>
            </div>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {reviews.map((r, i) => (
            <Reveal key={r.name} delay={i * 80}>
              <figure className="card-hover h-full flex flex-col bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <Quote className="w-7 h-7 text-amber-500/30 mb-3" />
                <blockquote className="text-sm text-slate-600 leading-relaxed flex-1">
                  {r.text}
                </blockquote>
                <div className="flex mt-4 mb-3">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <figcaption className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center">
                    {r.name.charAt(0)}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
