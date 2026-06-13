import { Building2, Calculator, Check } from 'lucide-react';
import { Reveal } from './Reveal';
import { useOrderModal } from './useOrderModal';
import { businessCards } from '../data/content';

const POINTS = [
  'Точное попадание в фирменные цвета',
  'Договор и закрывающие документы',
  'Тиражи от пробной партии до крупных',
  'Единый стиль и контроль качества',
];

export function BusinessSection() {
  const { openModal } = useOrderModal();

  return (
    <section id="business" className="py-20 sm:py-24 bg-indigo-950 relative overflow-hidden">
      <div aria-hidden className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-indigo-700/20 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <div>
            <span className="inline-flex items-center gap-2 text-amber-400 font-semibold text-sm mb-3">
              <Building2 className="w-4 h-4" /> Для бизнеса
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Корпоративные футболки и мерч для компаний
            </h2>
            <p className="mt-4 text-lg text-indigo-200 leading-relaxed">
              Брендированная одежда, форма для сотрудников и промо-мерч для мероприятий.
              Работаем с тиражами любого объёма — от малых партий до крупных заказов.
            </p>
            <ul className="mt-6 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-indigo-100">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-600/20 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <button
              onClick={() => openModal('Корпоративный заказ. Компания: , тираж: , нужно: ')}
              className="mt-8 inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors"
            >
              <Calculator className="w-5 h-5" />
              Рассчитать корпоративный заказ
            </button>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-4">
          {businessCards.map((card, i) => (
            <Reveal key={card.title} delay={i * 80} variant="scale">
              <div className="card-hover h-full bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <span className="w-11 h-11 rounded-xl bg-amber-600/15 flex items-center justify-center mb-3">
                  <card.icon className="w-5 h-5 text-amber-400" />
                </span>
                <h3 className="text-base font-bold text-white">{card.title}</h3>
                <p className="mt-1 text-sm text-indigo-300 leading-relaxed">{card.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Корпоративные кейсы — нам доверяют (заглушки логотипов) */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 mt-14">
        <Reveal>
          <p className="text-center text-sm text-indigo-300 mb-6">
            Нам доверяют компании из разных сфер
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-70">
            {['ЛОГО', 'BRAND', 'STUDIO', 'TEAM', 'EVENT', 'CORP'].map((name) => (
              <span
                key={name}
                className="text-indigo-200/70 font-bold tracking-widest text-lg"
                aria-hidden
              >
                {name}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-indigo-500 mt-4">
            Заглушки — заменить логотипами реальных клиентов
          </p>
        </Reveal>
      </div>
    </section>
  );
}
