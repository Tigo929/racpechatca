import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, Star, Check,
  ShieldCheck, Upload, Layers, PackageCheck, Lock, MessageCircle,
  Shirt, PenTool, Camera, Package, Zap,
  Type, Globe, Eye, Palette, FileText, BadgeCheck, Heart, Gift, Lightbulb, Key,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Shirt, ShieldCheck, PenTool, Camera, Package, Zap,
  Type, Globe, Eye, Palette, FileText, BadgeCheck, Heart, Gift, Lightbulb, Key,
  Layers, Check,
};
import { motion } from 'motion/react';
import '../landing.css';
import { siteConfig } from '../../config/siteConfig';
import { getProductBySlug, productPages } from '../data/productPages';
import { sharedReviews } from '../data/reviews';
import { useProductSeo } from '../hooks/useProductSeo';
import { OrderModalProvider, useOrderModal } from '../components/OrderModalContext';
import { OrderModal } from '../components/OrderModal';
import { CustomCursor } from '../components/CustomCursor';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { TelegramFab } from '../components/TelegramFab';
import { Reveal } from '../components/Reveal';
import { MagneticButton } from '../components/MagneticButton';
import { RippleButton } from '../components/RippleButton';
import { TiltCard } from '../components/TiltCard';
import { TshirtSVG } from '../components/TshirtSVG';
import { PersonScene } from '../components/PersonScene';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { tshirtPhotos } from '../../assets/portfolio';
import type { ProductPage } from '../data/productPages';

const ruble = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

const STEPS = [
  { icon: Upload, label: '1. Загружаете фото', sub: 'Пришлите фото, логотип или любую идею' },
  { icon: Layers, label: '2. Получаете макет', sub: 'Мы подготовим макет и отправим на согласование' },
  { icon: Check, label: '3. Подтверждаете', sub: 'Вы проверяете и подтверждаете макет перед печатью' },
  { icon: PackageCheck, label: '4. Получаете заказ', sub: 'Мы печатаем, упаковываем и передаём вам заказ' },
];

const BOTTOM_STATS = [
  { value: siteConfig.stats.orders, label: 'довольных клиентов' },
  { value: siteConfig.stats.companies, label: 'на рынке' },
  { value: '100%', label: 'Гарантия качества' },
  { value: '0 ₽', label: 'Безопасная оплата' },
];

export function ProductLandingPage() {
  const slug = useLocation().pathname.replace(/^\/+/, '');
  const product = getProductBySlug(slug);
  if (!product) return <Navigate to="/" replace />;

  return (
    <OrderModalProvider>
      <div className="landing-root bg-base min-h-screen">
        <CustomCursor />
        <Header />
        <main>
          <ProductContent product={product} />
        </main>
        <Footer />
        <TelegramFab />
        <OrderModal />
      </div>
    </OrderModalProvider>
  );
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${sz} ${i < rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />
      ))}
    </span>
  );
}

function ProductContent({ product }: { product: ProductPage }) {
  useProductSeo(product);
  const { openModal } = useOrderModal();
  const [color, setColor] = useState(product.colors[0]);
  const [size, setSize] = useState(product.sizes[1] ?? product.sizes[0]);
  const [view, setView] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const submit = () =>
    openModal(`Интересует: ${product.title}. Цвет: ${color.name}, размер: ${size}. `);

  const others = productPages.filter((p) => p.slug !== product.slug);
  const galleryLength = product.gallery.length;

  return (
    <>
      {/* Хлебные крошки */}
      <nav aria-label="Хлебные крошки" className="pt-24 sm:pt-28 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <li><Link to="/" className="hover:text-amber-600 transition-colors">Главная</Link></li>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <li><a href="/#catalog" className="hover:text-amber-600 transition-colors">Каталог</a></li>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <li className="text-slate-900 font-medium" aria-current="page">{product.title}</li>
          </ol>
        </div>
      </nav>

      {/* ── Showcase ────────────────────────────────────────────────── */}
      <section className="bg-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* Левая колонка: галерея */}
            <Reveal variant="fade">
              <div className="flex gap-3">
                {/* Вертикальные превью */}
                <div className="flex flex-col gap-2.5 shrink-0">
                  {/* Мокап */}
                  <ThumbV active={view === 0} onClick={() => setView(0)} label="Мокап">
                    <TshirtSVG color={color.hex} ink={color.ink} className="w-10 h-10" />
                  </ThumbV>
                  {/* Сцены */}
                  {product.gallery.map((g, i) => (
                    <ThumbV key={i} active={view === i + 1} onClick={() => setView(i + 1)} label={g.caption}>
                      {g.src
                        ? <img src={g.src} alt={g.caption} className="w-full h-full object-cover" />
                        : <PersonScene color={g.color} ink={g.ink} className="w-full h-full" />
                      }
                    </ThumbV>
                  ))}
                </div>

                {/* Главное изображение */}
                <motion.div
                  key={view}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex-1 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-3xl flex items-center justify-center min-h-[360px] sm:min-h-[460px] overflow-hidden shadow-sm border border-slate-100"
                >
                  {view === 0 ? (
                    <TshirtSVG
                      color={color.hex}
                      ink={color.ink}
                      printLabel="ВАШ ПРИНТ"
                      showPrintArea
                      className="w-64 sm:w-80 drop-shadow-xl"
                    />
                  ) : product.gallery[view - 1].src ? (
                    <img
                      src={product.gallery[view - 1].src}
                      alt={product.gallery[view - 1].alt}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <PersonScene
                      color={product.gallery[view - 1].color}
                      ink={product.gallery[view - 1].ink}
                      className="w-full max-w-sm"
                    />
                  )}
                </motion.div>
              </div>
            </Reveal>

            {/* Правая колонка: информация */}
            <Reveal variant="up" delay={80}>
              <div>
                {/* Заголовок */}
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {product.h1}
                </h1>
                <p className="mt-2 text-base text-slate-500 leading-relaxed">{product.subtitle}</p>

                {/* Цена и рейтинг */}
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-slate-500 text-sm">от</span>
                    <span className="text-4xl font-extrabold text-slate-900">{ruble(product.priceFrom)}</span>
                    <span className="text-sm text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-lg">
                      от 1 штуки
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StarRating rating={5} />
                  <span className="text-sm text-slate-500">
                    {siteConfig.rating.value} · {siteConfig.rating.count} отзывов
                  </span>
                </div>

                {/* Сетка фич 2×3 */}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {product.features.map((f) => {
                    const Icon = ICON_MAP[f.icon] ?? Check;
                    return (
                      <div key={f.title} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 transition-colors duration-200">
                        <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Icon className="text-amber-600" style={{ width: 14, height: 14 }} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 leading-tight">{f.title}</div>
                          <div className="text-[10px] text-slate-400 leading-tight">{f.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Цвет */}
                <div className="mt-6">
                  <div className="text-sm font-semibold text-slate-700 mb-2.5">
                    Цвет: <span className="font-bold text-slate-900">{color.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {product.colors.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => { setColor(c); setView(0); }}
                        aria-label={`Цвет: ${c.name}`}
                        aria-pressed={color.name === c.name}
                        title={c.name}
                        className={`swatch w-9 h-9 rounded-full border-2 ${color.name === c.name ? 'swatch--active border-amber-500' : 'border-slate-200 hover:border-slate-400'}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Размер */}
                <div className="mt-5">
                  <div className="text-sm font-semibold text-slate-700 mb-2.5">Размер</div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        aria-pressed={size === s}
                        className={`min-w-[3rem] px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          size === s
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <RippleButton
                  onClick={submit}
                  className="cta-pulse btn-shimmer mt-7 w-full inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg transition-colors shadow-lg shadow-amber-600/30"
                >
                  Создать свою футболку
                </RippleButton>

                {/* Гарантия */}
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Lock className="w-4 h-4" />
                  Без предоплаты. Оплата при получении
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Как это работает ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-warm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-12">
              Как это работает
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.label} delay={i * 100} variant="up">
                <div className="relative flex flex-col items-center text-center">
                  {/* Стрелка между шагами */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px border-t-2 border-dashed border-slate-300" aria-hidden />
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center mb-4 z-10">
                    <step.icon className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{step.label}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{step.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Фото клиентов ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-10">
              Реальные фотографии клиентов
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {product.gallery.some(g => g.src)
              ? Object.values(tshirtPhotos).map((src, i) => (
                  <Reveal key={i} delay={i * 70} variant="scale">
                    <div className="aspect-square rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                      <img src={src} alt={`Результат печати ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    </div>
                  </Reveal>
                ))
              : [...product.gallery, ...product.gallery.slice(0, 5 - product.gallery.length)].slice(0, 5).map((g, i) => (
                  <Reveal key={i} delay={i * 70} variant="scale">
                    <div className="aspect-square rounded-2xl bg-gradient-to-br from-slate-100 to-indigo-50 overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm">
                      <PersonScene color={g.color} ink={g.ink} className="w-full h-full" />
                    </div>
                  </Reveal>
                ))
            }
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Фотографии наших клиентов — всегда показываем результат до выдачи
          </p>
        </div>
      </section>

      {/* ── Отзывы ──────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-warm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-10">
              Отзывы наших клиентов
            </h2>
          </Reveal>

          <div className="grid lg:grid-cols-[auto_1fr] gap-8 lg:gap-12 items-start">
            {/* Агрегат */}
            <Reveal variant="scale">
              <div className="flex flex-row lg:flex-col items-center gap-4 lg:gap-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 min-w-[160px]">
                <span className="text-6xl font-extrabold text-slate-900">{siteConfig.rating.value}</span>
                <div>
                  <StarRating rating={5} size="lg" />
                  <div className="mt-1 text-sm text-slate-500 text-center">{siteConfig.rating.count} отзывов</div>
                </div>
              </div>
            </Reveal>

            {/* Карточки */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedReviews.map((r, i) => (
                <Reveal key={r.name} delay={i * 80} variant="up">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {r.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{r.name}</div>
                          <div className="text-xs text-slate-400">{r.date}</div>
                        </div>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{r.text}</p>
                    {r.tag && (
                      <span className="self-start text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                        {r.tag}
                      </span>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center mb-10">
              Частые вопросы
            </h2>
          </Reveal>
          <div className="space-y-3">
            {product.faq.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <Reveal key={item.q} delay={i * 50}>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <h3>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="font-semibold text-slate-900">{item.q}</span>
                        <ChevronDown className={`faq-chevron w-5 h-5 text-amber-600 shrink-0 ${isOpen ? 'faq-chevron--open' : ''}`} />
                      </button>
                    </h3>
                    <div className={`faq-panel ${isOpen ? 'faq-panel--open' : ''}`}>
                      <div><p className="px-5 pb-5 text-slate-600 leading-relaxed">{item.a}</p></div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SEO-контент ─────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-warm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          {product.seoSections.map((sec) => (
            <Reveal key={sec.heading}>
              <article>
                {sec.level === 'h2' ? (
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-3">{sec.heading}</h2>
                ) : (
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mb-2">{sec.heading}</h3>
                )}
                <div className="space-y-3 text-slate-600 leading-relaxed">
                  {sec.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Нижняя полоса статистики ─────────────────────────────────── */}
      <section className="bg-white border-t border-slate-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {BOTTOM_STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 80} variant="fade">
                <div className="flex flex-col items-center gap-1.5">
                  {i === 0 ? (
                    <MessageCircle className="w-7 h-7 text-amber-500 mb-1" />
                  ) : i === 1 ? (
                    <ShieldCheck className="w-7 h-7 text-amber-500 mb-1" />
                  ) : i === 2 ? (
                    <Check className="w-7 h-7 text-amber-500 mb-1" />
                  ) : (
                    <Lock className="w-7 h-7 text-amber-500 mb-1" />
                  )}
                  <AnimatedCounter value={s.value} className="text-xl font-extrabold text-slate-900" />
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Также заказывают ─────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 bg-warm border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-8">
              Также заказывают
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {others.map((p, i) => (
              <Reveal key={p.slug} delay={i * 70}>
                <TiltCard maxTilt={8} className="h-full group">
                <article className="h-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 flex items-center justify-center py-7">
                    <TshirtSVG color={p.colors[0].hex} ink={p.colors[0].ink} className="w-24 h-24" />
                  </div>
                  <div className="flex flex-col flex-1 p-4">
                    <h3 className="font-bold text-slate-900 leading-snug">{p.title}</h3>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.subtitle}</p>
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        <span className="text-xs font-normal text-slate-400">от </span>
                        {ruble(p.priceFrom)}
                      </span>
                      <Link
                        to={`/${p.slug}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-amber-700 transition-colors"
                      >
                        Подробнее <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </article>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ThumbV({
  active, onClick, label, children,
}: {
  active: boolean; onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex items-center justify-center bg-slate-50 transition-colors ${
        active ? 'border-amber-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {children}
    </motion.button>
  );
}
