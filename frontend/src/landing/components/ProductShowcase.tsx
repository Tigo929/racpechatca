import { useState } from 'react';
import { motion } from 'motion/react';
import { Shirt, Layers, Wand2, Ruler, ArrowRight, Check } from 'lucide-react';
import { Reveal } from './Reveal';
import { TshirtSVG } from './TshirtSVG';
import { shirtColors } from '../data/content';
import { tshirtPhotos } from '../../assets/portfolio';

/**
 * Интерактивная витрина единственного продукта — футболки с принтом.
 * Пользователь меняет цвет, переключает ракурсы, видит крупный план печати
 * и текстуру ткани. Паттерн e-commerce-галереи (Printful / Custom Ink):
 * крупное изображение + лента превью + характеристики рядом.
 */

interface View {
  id: string;
  label: string;
  /** Реальное фото; если нет — показываем цветной мокап */
  src?: string;
  alt: string;
}

const VIEWS: View[] = [
  { id: 'mockup', label: 'Цвет', alt: 'Примерка цвета футболки' },
  { id: 'person', label: 'На человеке', src: tshirtPhotos.photo1, alt: 'Футболка с принтом на человеке у горного озера' },
  { id: 'flat', label: 'Крупный план', src: tshirtPhotos.photo2, alt: 'Футболка с принтом крупным планом, флэтлей' },
  { id: 'print', label: 'Принт детально', src: tshirtPhotos.photo5, alt: 'Принт на футболке крупным планом — детализация печати' },
  { id: 'fabric', label: 'Ткань', src: tshirtPhotos.photo3, alt: 'Макро текстуры ткани футболки' },
  { id: 'pair', label: 'В паре', src: tshirtPhotos.photo4, alt: 'Парень и девушка в футболках с принтом' },
];

const SPECS = [
  { icon: Shirt, title: '100% хлопок', text: 'Плотная приятная ткань' },
  { icon: Layers, title: 'Стойкая печать', text: 'DTF — держит стирку и носку' },
  { icon: Ruler, title: 'Размеры XS–XXXL', text: 'Мужские, женские, детские' },
  { icon: Wand2, title: 'Любой макет', text: 'Фото, надпись, логотип' },
];

export function ProductShowcase() {
  const [viewIdx, setViewIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const color = shirtColors[colorIdx];
  const view = VIEWS[viewIdx];

  // Клик по цвету всегда показывает мокап в выбранном цвете.
  const pickColor = (i: number) => {
    setColorIdx(i);
    setViewIdx(0);
  };

  return (
    <section id="product" className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mb-10">
            <span className="text-amber-600 font-semibold text-sm">Футболка с принтом на заказ</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
              Рассмотрите со всех сторон
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              Примерьте цвет, посмотрите печать вблизи и оцените ткань — прежде
              чем оформить заказ.
            </p>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* ── Галерея ───────────────────────────────────── */}
          <div className="flex gap-3 sm:gap-4">
            {/* Лента превью */}
            <div className="flex flex-col gap-2.5 shrink-0">
              {VIEWS.map((v, i) => {
                const active = i === viewIdx;
                return (
                  <button
                    key={v.id}
                    onClick={() => setViewIdx(i)}
                    aria-label={v.label}
                    aria-pressed={active}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                      active ? 'border-amber-500' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {v.src ? (
                      <img src={v.src} alt={v.alt} loading="lazy" decoding="async" width={120} height={120} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-slate-50">
                        <TshirtSVG color={color.hex} ink={color.ink} className="w-9 h-9" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Главное изображение */}
            <motion.div
              key={view.id + (view.src ? '' : color.hex)}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex-1 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-100 shadow-sm flex items-center justify-center min-h-[340px] sm:min-h-[460px]"
            >
              {view.src ? (
                <img src={view.src} alt={view.alt} width={1200} height={800} decoding="async" className="w-full h-full object-cover" />
              ) : (
                <TshirtSVG color={color.hex} ink={color.ink} printLabel="ВАШ ПРИНТ" showPrintArea className="w-60 sm:w-72 drop-shadow-xl" />
              )}
            </motion.div>
          </div>

          {/* ── Характеристики + цвет ─────────────────────── */}
          <div>
            {/* Выбор цвета */}
            <div className="mb-7">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-900">Цвет футболки</span>
                <span className="text-sm text-slate-500">{color.name}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {shirtColors.map((c, i) => (
                  <button
                    key={c.hex}
                    onClick={() => pickColor(i)}
                    aria-label={`Цвет: ${c.name}`}
                    aria-pressed={i === colorIdx}
                    style={{ backgroundColor: c.hex }}
                    className={`relative w-9 h-9 rounded-full border transition-transform hover:scale-110 ${
                      i === colorIdx ? 'ring-2 ring-amber-500 ring-offset-2 border-transparent' : 'border-slate-200'
                    }`}
                  >
                    {i === colorIdx && (
                      <Check className="w-4 h-4 absolute inset-0 m-auto" style={{ color: c.ink }} aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Характеристики */}
            <div className="grid sm:grid-cols-2 gap-3">
              {SPECS.map((s) => (
                <div key={s.title} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-amber-600" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-500 leading-snug mt-0.5">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Цена + CTA */}
            <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <div className="text-xs text-slate-500">Стоимость</div>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">от 990&nbsp;₽</div>
              </div>
              <button
                onClick={() => document.getElementById('designer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-base shadow-lg shadow-amber-600/30 transition-colors"
              >
                <Wand2 className="w-5 h-5" />
                Создать свой дизайн
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500 justify-center sm:justify-start">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              Бесплатный макет · оплата после согласования
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
