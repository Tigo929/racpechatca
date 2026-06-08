import { Shirt, Droplets, Sparkles, ScanLine } from 'lucide-react';
import { Reveal } from './Reveal';

const FEATURES = [
  { icon: Shirt, title: 'Качественная ткань', text: 'Плотный приятный материал, который хорошо держит форму и подходит для повседневной носки.' },
  { icon: Sparkles, title: 'Износостойкая печать', text: 'Используем качественные износостойкие методы печати, подходящие для повседневной носки.' },
  { icon: Droplets, title: 'Стойкость к стирке', text: 'Принт сохраняет яркость и не трескается при правильном уходе и регулярной стирке.' },
  { icon: ScanLine, title: 'Аккуратность', text: 'Ровное нанесение, чёткие линии и контроль качества перед выдачей каждого заказа.' },
];

export function Quality() {
  return (
    <section className="py-20 sm:py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <span className="text-amber-600 font-semibold text-sm">Качество</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Почему футболка прослужит долго
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Следим за тканью, печатью и аккуратностью на каждом этапе — чтобы результат
              радовал не только в день получения.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="card-hover h-full bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <span className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-indigo-700" />
                </span>
                <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
