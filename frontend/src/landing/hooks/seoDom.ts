/**
 * Низкоуровневые помощники для управления SEO-тегами в <head>.
 * Это SPA (Vite), поэтому meta/JSON-LD ставятся динамически. Переиспользуется
 * главной страницей (useSeo) и продуктовыми страницами (useProductSeo).
 */

/** Устанавливает или обновляет <meta> по name/property. */
export function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Устанавливает <link rel> (например, canonical). */
export function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Вставляет/обновляет JSON-LD блок с заданным id. */
export function setJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Удаляет JSON-LD блок по id (при размонтировании страницы). */
export function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}
