import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Reveal } from './Reveal';
import { faqItems } from '../data/content';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 sm:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="text-center mb-12">
            <span className="text-amber-600 font-semibold text-sm">Вопросы и ответы</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Частые вопросы
            </h2>
          </div>
        </Reveal>

        <div className="space-y-3">
          {faqItems.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 50}>
                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                  <h3>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="font-semibold text-slate-900">{item.q}</span>
                      <ChevronDown
                        className={`faq-chevron w-5 h-5 text-amber-600 shrink-0 ${
                          isOpen ? 'faq-chevron--open' : ''
                        }`}
                      />
                    </button>
                  </h3>
                  <div className={`faq-panel ${isOpen ? 'faq-panel--open' : ''}`}>
                    <div>
                      <p className="px-5 pb-5 text-slate-600 leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
