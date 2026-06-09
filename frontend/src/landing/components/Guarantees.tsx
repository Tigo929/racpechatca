import { Wand2, HandCoins, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Reveal } from './Reveal';

/**
 * Снятие рисков перед заказом (CRO: objection handling).
 * Психология: Regret Aversion, Risk Reduction, Reciprocity, Zero-Price Effect.
 * Отвечает на главные страхи: «а вдруг не понравится / когда платить /
 * увижу ли результат». Размещается у точки конверсии.
 */

const ITEMS = [
  {
    icon: Wand2,
    title: 'Бесплатный макет',
    text: 'Сначала покажем, как будет выглядеть футболка. Платить за макет не нужно.',
  },
  {
    icon: HandCoins,
    title: 'Оплата после согласования',
    text: 'Берём оплату, только когда вы подтвердили цену, срок и макет.',
  },
  {
    icon: ImageIcon,
    title: 'Фото перед выдачей',
    text: 'Покажем фото готовой футболки — вы увидите результат до того, как заберёте.',
  },
  {
    icon: RefreshCw,
    title: 'Поправим, если не так',
    text: 'Не попали в ожидание по макету — доработаем до согласования бесплатно.',
  },
];

export function Guarantees() {
  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <span className="text-amber-600 font-semibold text-sm">Без риска</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
              Заказывать безопасно
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Вы ничего не теряете, оставляя заявку: сначала макет и цена —
              потом решение и оплата.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <div className="card-hover h-full bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <span className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-amber-600" />
                </span>
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
