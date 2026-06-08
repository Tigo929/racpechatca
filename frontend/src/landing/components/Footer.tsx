import { Printer, Phone, Mail, MapPin, Send, MessageCircle, Calculator, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrderModal } from './OrderModalContext';
import {
  siteConfig,
  telegramUrl,
  whatsappUrl,
  telUrl,
} from '../../config/siteConfig';
import { productPages } from '../data/productPages';

export function Footer() {
  const { openModal } = useOrderModal();
  const year = new Date().getFullYear();

  return (
    <>
      {/* Финальный CTA + контакты */}
      <section id="contacts" className="bg-indigo-950 pt-20 pb-12 relative overflow-hidden">
        <div aria-hidden className="absolute -top-20 left-1/2 -translate-x-1/2 w-[40rem] h-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Готовы напечатать вашу футболку?
            </h2>
            <p className="mt-4 text-lg text-indigo-200">
              Оставьте заявку — рассчитаем стоимость и срок, поможем с макетом и
              подготовим заказ к выдаче.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => openModal()}
                className="cta-pulse inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors"
              >
                <Calculator className="w-5 h-5" />
                Рассчитать заказ
              </button>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold transition-colors"
              >
                <Send className="w-5 h-5" />
                Написать в Telegram
              </a>
            </div>
          </div>

          {/* Контактные данные */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-white/10 pt-12">
            <ContactCard icon={Phone} label="Телефон">
              <a href={telUrl} className="hover:text-amber-400 transition-colors">
                {siteConfig.phone}
              </a>
            </ContactCard>
            <ContactCard icon={MapPin} label="Адрес">
              {siteConfig.address}, {siteConfig.cityNominative}
            </ContactCard>
            <ContactCard icon={Clock} label="Часы работы">
              {siteConfig.workingHours}
            </ContactCard>
            <ContactCard icon={Mail} label="Почта">
              <a href={`mailto:${siteConfig.email}`} className="hover:text-amber-400 transition-colors">
                {siteConfig.email}
              </a>
            </ContactCard>
          </div>

          {/* Мессенджеры */}
          <div className="flex gap-3 justify-center mt-8">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-colors"
            >
              <Send className="w-5 h-5" />
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          </div>

          {/* Карта-заглушка */}
          <div className="mt-10 rounded-2xl overflow-hidden border border-white/10 bg-white/5 h-56 flex items-center justify-center text-indigo-300">
            <div className="text-center">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-amber-400/70" />
              <p className="text-sm">Карта — {siteConfig.address}, {siteConfig.cityNominative}</p>
              <p className="text-xs text-indigo-400 mt-1">Заглушка — подключить Яндекс.Карты</p>
            </div>
          </div>
        </div>
      </section>

      {/* Нижний footer с SEO-навигацией */}
      <footer className="bg-indigo-950 border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Бренд */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center">
                  <Printer className="w-5 h-5 text-white" />
                </span>
                <span className="text-white font-bold text-lg">
                  Распечатка<span className="text-amber-500"> PRO</span>
                </span>
              </div>
              <p className="text-sm text-indigo-300 leading-relaxed">
                Печать на футболках в {siteConfig.city} от 1 штуки. Принты, фото, надписи
                и корпоративный мерч.
              </p>
            </div>

            {/* Каталог — ссылки на SEO-страницы товаров */}
            <nav aria-label="Каталог">
              <h3 className="text-white font-semibold mb-4">Каталог</h3>
              <ul className="space-y-2.5">
                {productPages.map((p) => (
                  <li key={p.slug}>
                    <Link to={`/${p.slug}`} className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Услуги (страница контактов в планах) */}
            <nav aria-label="Услуги">
              <h3 className="text-white font-semibold mb-4">Услуги</h3>
              <ul className="space-y-2.5">
                <li><Link to="/futbolka-s-foto" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Печать фото на футболке</Link></li>
                <li><Link to="/futbolki-s-logotipom" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Печать логотипа</Link></li>
                <li><Link to="/korporativnyy-merch" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Корпоративный мерч</Link></li>
                <li><a href="/#designer" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Онлайн-конструктор</a></li>
              </ul>
            </nav>

            {/* Разделы */}
            <nav aria-label="Разделы">
              <h3 className="text-white font-semibold mb-4">Разделы</h3>
              <ul className="space-y-2.5">
                <li><a href="/#gift" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">В подарок</a></li>
                <li><a href="/#business" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Для бизнеса</a></li>
                <li><a href="/#how" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Как заказать</a></li>
                <li><a href="/#reviews" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Отзывы</a></li>
                <li><a href="/#faq" className="text-sm text-indigo-300 hover:text-amber-400 transition-colors">Вопросы</a></li>
              </ul>
            </nav>
          </div>

          {/* Внутренняя перелинковка */}
          <p className="mt-10 text-sm text-indigo-400">
            Также заказывают:{' '}
            {productPages.map((p, i) => (
              <span key={p.slug}>
                <Link to={`/${p.slug}`} className="text-indigo-300 hover:text-amber-400 transition-colors">
                  {p.title.toLowerCase()}
                </Link>
                {i < productPages.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>

          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between text-sm text-indigo-400">
            <p>© {year} {siteConfig.companyName}. Печать на футболках в {siteConfig.city}.</p>
            <p>Сделано с заботой о качестве.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

function ContactCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-amber-600/15 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-amber-400" />
      </span>
      <div>
        <div className="text-xs text-indigo-400 mb-0.5">{label}</div>
        <div className="text-sm text-indigo-100 font-medium">{children}</div>
      </div>
    </div>
  );
}
