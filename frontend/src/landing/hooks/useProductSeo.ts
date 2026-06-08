import { useEffect } from 'react';
import { siteConfig } from '../../config/siteConfig';
import type { ProductPage } from '../data/productPages';
import { setMeta, setLink, setJsonLd, removeJsonLd } from './seoDom';

const LD_IDS = ['ld-product', 'ld-product-faq', 'ld-breadcrumb'];

/**
 * SEO для отдельной продуктовой страницы: title, description, OG, canonical,
 * Product / FAQPage / BreadcrumbList JSON-LD. Чистит свои JSON-LD при уходе
 * со страницы, чтобы не смешивать схемы между маршрутами (SPA).
 */
export function useProductSeo(product: ProductPage) {
  useEffect(() => {
    const url = `${siteConfig.siteUrl}/${product.slug}`;

    document.title = product.metaTitle;
    document.documentElement.lang = 'ru';

    setMeta('name', 'description', product.metaDescription);
    setMeta('name', 'keywords', product.keywords.join(', '));
    setMeta('name', 'robots', 'index, follow');

    setMeta('property', 'og:type', 'product');
    setMeta('property', 'og:title', product.metaTitle);
    setMeta('property', 'og:description', product.metaDescription);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:site_name', siteConfig.companyName);
    setMeta('property', 'og:locale', 'ru_RU');
    setMeta('property', 'og:image', `${siteConfig.siteUrl}/og-image.jpg`);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', product.metaTitle);
    setMeta('name', 'twitter:description', product.metaDescription);

    setLink('canonical', url);

    // ─── Product + Offer ──────────────────────────────────────────
    setJsonLd('ld-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.h1,
      sku: product.article,
      description: product.metaDescription,
      url,
      brand: { '@type': 'Brand', name: siteConfig.companyName },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'RUB',
        price: product.priceFrom,
        priceSpecification: {
          '@type': 'PriceSpecification',
          minPrice: product.priceFrom,
          priceCurrency: 'RUB',
        },
        availability: 'https://schema.org/InStock',
        url,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: siteConfig.rating.value,
        reviewCount: siteConfig.rating.count,
        bestRating: '5',
        worstRating: '1',
      },
    });

    // ─── FAQPage ──────────────────────────────────────────────────
    setJsonLd('ld-product-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: product.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });

    // ─── BreadcrumbList ───────────────────────────────────────────
    setJsonLd('ld-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: siteConfig.siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Каталог', item: `${siteConfig.siteUrl}/#catalog` },
        { '@type': 'ListItem', position: 3, name: product.title, item: url },
      ],
    });

    return () => LD_IDS.forEach(removeJsonLd);
  }, [product]);
}
