import { Reveal } from './Reveal';
import { AnimatedCounter } from './AnimatedCounter';
import { siteConfig } from '../../config/siteConfig';

const ITEMS = [
  { value: siteConfig.stats.orders, label: 'заказов выполнено' },
  { value: siteConfig.stats.companies, label: 'компаний доверяют' },
  { value: siteConfig.stats.repeat, label: 'возвращаются снова' },
  { value: siteConfig.stats.speed, label: 'срок изготовления' },
];

export function Stats() {
  return (
    <section className="bg-indigo-950 py-10 sm:py-12" aria-label="Показатели компании">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {ITEMS.map((s, i) => (
            <Reveal key={s.label} delay={i * 100} className="text-center sm:px-4">
              <AnimatedCounter
                value={s.value}
                className="block text-3xl sm:text-4xl font-extrabold text-amber-500 tracking-tight"
              />
              <div className="mt-1 text-sm text-indigo-300">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
