import { Reveal } from './Reveal';
import { orderSteps } from '../data/content';

export function HowToOrder() {
  return (
    <section id="how" className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <span className="text-amber-600 font-semibold text-sm">Как заказать</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Пять простых шагов
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Понятный путь от идеи до готовой футболки — без сюрпризов по цене и срокам.
            </p>
          </div>
        </Reveal>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {orderSteps.map((step, i) => (
            <Reveal key={step.n} delay={i * 80} as="li">
              <div className="relative h-full bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-950 text-amber-400 font-bold text-lg mb-4">
                  {step.n}
                </span>
                <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
