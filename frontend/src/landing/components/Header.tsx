import { useEffect, useState } from 'react';
import { Menu, X, Printer, Calculator } from 'lucide-react';
import { useOrderModal } from './OrderModalContext';
import { siteConfig } from '../../config/siteConfig';

// Ссылки с префиксом «/#» работают и с главной (только скролл), и с
// продуктовых страниц (переход на главную + скролл к секции).
const NAV = [
  { href: '/#catalog', label: 'Футболки' },
  { href: '/#business', label: 'Для бизнеса' },
  { href: '/#gift', label: 'В подарок' },
  { href: '/#how', label: 'Как заказать' },
  { href: '/#gallery', label: 'Работы' },
  { href: '/#reviews', label: 'Отзывы' },
  { href: '/#contacts', label: 'Контакты' },
];

export function Header() {
  const { openModal } = useOrderModal();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'header-scrolled py-2.5' : 'py-4 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Логотип */}
        <a href="/" className="flex items-center gap-2.5 shrink-0" aria-label={siteConfig.companyName}>
          <span className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-600/30">
            <Printer className="w-5 h-5 text-white" />
          </span>
          <span className="text-white font-bold text-lg tracking-tight">
            Распечатка<span className="text-amber-500"> PRO</span>
          </span>
        </a>

        {/* Десктоп-навигация */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Основная навигация">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="nav-link text-sm font-medium text-indigo-200 hover:text-white transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* CTA + бургер */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openModal()}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-lg shadow-amber-600/30 transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Рассчитать заказ
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            className="lg:hidden p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 top-0 z-40 bg-indigo-950/98 backdrop-blur-lg pt-20 px-6">
          <nav className="flex flex-col gap-1" aria-label="Мобильная навигация">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="py-3.5 text-lg font-medium text-indigo-100 hover:text-amber-400 border-b border-white/10 transition-colors"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <button
            onClick={() => { setMenuOpen(false); openModal(); }}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg transition-colors"
          >
            <Calculator className="w-5 h-5" />
            Рассчитать заказ
          </button>
        </div>
      )}
    </header>
  );
}
