import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Сбрасывает скролл в начало при каждом изменении pathname.
 * Использует instant (без плавности) для лучшего UX и SEO.
 * Размещается внутри <BrowserRouter> до <Routes>.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
