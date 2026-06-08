import { Reveal } from './Reveal';
import { trustItems } from '../data/content';

export function TrustBar() {
  return (
    <section className="bg-white border-b border-slate-100 py-14 sm:py-16" aria-label="Преимущества">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {trustItems.map((item, i) => (
            <Reveal key={item.title} delay={i * 70} className="h-full">
              <div className="h-full flex flex-col items-center text-center gap-2 px-2 py-3">
                <span className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-indigo-700" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-snug">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
