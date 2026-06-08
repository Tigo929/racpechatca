import { Gift, ArrowRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { useOrderModal } from './OrderModalContext';
import { giftCards } from '../data/content';

export function GiftSection() {
  const { openModal } = useOrderModal();

  return (
    <section id="gift" className="py-20 sm:py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm mb-3">
              <Gift className="w-4 h-4" /> В подарок
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Подарок в последний момент?
            </h2>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Сделаем футболку с вашим смыслом: фото, фраза, мем, дата, имя или дизайн.
              Поможем с макетом и упакуем как подарок — даже если времени почти не осталось.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {giftCards.map((card, i) => (
            <Reveal key={card.title} delay={i * 80}>
              <div className="card-hover h-full flex flex-col bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <span className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                  <card.icon className="w-6 h-6 text-amber-600" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed flex-1">{card.text}</p>
                <button
                  onClick={() => openModal(`Хочу футболку в подарок: ${card.title}. `)}
                  aria-label={`Заказать: ${card.title}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-amber-700 hover:gap-2.5 transition-all"
                >
                  Заказать <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
