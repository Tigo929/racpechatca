import { lazy, Suspense } from 'react';
import { MotionConfig } from 'motion/react';
import '../landing/landing.css';
import { CustomCursor } from '../landing/components/CustomCursor';
import { useSeo } from '../landing/hooks/useSeo';
import { OrderModalProvider } from '../landing/components/OrderModalContext';
import { OrderModal } from '../landing/components/OrderModal';
import { Header } from '../landing/components/Header';
import { Hero } from '../landing/components/Hero';
import { Stats } from '../landing/components/Stats';
import { TrustBar } from '../landing/components/TrustBar';
import { GiftSection } from '../landing/components/GiftSection';
import { BusinessSection } from '../landing/components/BusinessSection';
import { Catalog } from '../landing/components/Catalog';
import { HowToOrder } from '../landing/components/HowToOrder';
import { Quality } from '../landing/components/Quality';
import { SeoText } from '../landing/components/SeoText';
import { Gallery } from '../landing/components/Gallery';
import { Reviews } from '../landing/components/Reviews';
import { Faq } from '../landing/components/Faq';
import { Footer } from '../landing/components/Footer';
import { TelegramFab } from '../landing/components/TelegramFab';
import { MobileCtaBar } from '../landing/components/MobileCtaBar';

// Konva-конструктор тяжёлый — грузим лениво, чтобы не блокировать страницу.
const TShirtDesigner = lazy(() => import('../landing/components/designer/TShirtDesigner'));

function DesignerFallback() {
  return (
    <section className="py-20 sm:py-24 bg-warm" aria-busy="true">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-[28rem] rounded-3xl bg-white border border-slate-100 shadow-sm animate-pulse" />
      </div>
    </section>
  );
}

/**
 * Публичная главная страница «Распечатка PRO» — премиальный лендинг
 * печати на футболках. Масштабируется под будущие услуги типографии:
 * новые секции/страницы добавляются по той же модульной схеме.
 */
export function LandingPage() {
  useSeo();

  return (
    <MotionConfig reducedMotion="user">
    <OrderModalProvider>
      <div className="landing-root bg-base min-h-screen">
        <CustomCursor />
        <Header />
        <main>
          <Hero />
          <Stats />
          <TrustBar />
          <GiftSection />
          <BusinessSection />
          <Catalog />
          <Suspense fallback={<DesignerFallback />}>
            <TShirtDesigner />
          </Suspense>
          <HowToOrder />
          <Quality />
          <SeoText />
          <Gallery />
          <Reviews />
          <Faq />
        </main>
        <Footer />
        <TelegramFab />
        <MobileCtaBar />
        <OrderModal />
      </div>
    </OrderModalProvider>
    </MotionConfig>
  );
}
