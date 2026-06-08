import { useEffect } from 'react';
import { siteConfig } from '../../config/siteConfig';
import { catalogItems, faqItems } from '../data/content';
import { setMeta, setLink, setJsonLd } from './seoDom';

const c = siteConfig.city;
const cNom = siteConfig.cityNominative;

const META_TITLE = `Печать на футболках в ${c} от 1 штуки — ${siteConfig.companyName}`;
const META_DESCRIPTION =
  `Печать на футболках в ${c}: свой принт, фото, надпись или корпоративный мерч. ` +
  `Поможем с макетом, напечатаем качественно от 1 штуки. Футболка с принтом на заказ быстро и надёжно.`;

/**
 * Управляет SEO-метаданными главной страницы: title, description, OG,
 * canonical и набором JSON-LD (LocalBusiness, Product, FAQPage, AggregateRating).
 * Это SPA, поэтому базовые meta дублируются в index.html для краулеров,
 * а здесь обогащаются динамически из siteConfig.
 */
export function useSeo() {
  useEffect(() => {
    document.title = META_TITLE;
    document.documentElement.lang = 'ru';

    setMeta('name', 'description', META_DESCRIPTION);
    setMeta('name', 'keywords',
      `печать на футболках в ${c}, футболка с принтом на заказ, футболка с фото, ` +
      `футболки с логотипом компании, корпоративный мерч, подарок с принтом`);
    setMeta('name', 'robots', 'index, follow');

    // Open Graph
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', META_TITLE);
    setMeta('property', 'og:description', META_DESCRIPTION);
    setMeta('property', 'og:url', siteConfig.siteUrl);
    setMeta('property', 'og:site_name', siteConfig.companyName);
    setMeta('property', 'og:locale', 'ru_RU');
    setMeta('property', 'og:image', `${siteConfig.siteUrl}/og-image.jpg`);

    // Twitter
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', META_TITLE);
    setMeta('name', 'twitter:description', META_DESCRIPTION);

    setLink('canonical', siteConfig.siteUrl);

    // ─── JSON-LD: LocalBusiness ───────────────────────────────────
    setJsonLd('ld-localbusiness', {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: siteConfig.companyName,
      description: META_DESCRIPTION,
      url: siteConfig.siteUrl,
      telephone: siteConfig.phoneRaw,
      email: siteConfig.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: siteConfig.address,
        addressLocality: cNom,
        addressCountry: 'RU',
      },
      openingHours: 'Mo-Su 10:00-20:00',
      priceRange: '₽₽',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: siteConfig.rating.value,
        reviewCount: siteConfig.rating.count,
        bestRating: '5',
        worstRating: '1',
      },
    });

    // ─── JSON-LD: Product + Offer (по каталогу) ───────────────────
    setJsonLd('ld-products', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: catalogItems.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: item.title,
          description: item.description,
          url: `${siteConfig.siteUrl}/${item.slug}`,
          brand: { '@type': 'Brand', name: siteConfig.companyName },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'RUB',
            price: item.priceFrom,
            priceSpecification: {
              '@type': 'PriceSpecification',
              minPrice: item.priceFrom,
              priceCurrency: 'RUB',
            },
            availability: 'https://schema.org/InStock',
          },
        },
      })),
    });

    // ─── JSON-LD: FAQPage ─────────────────────────────────────────
    setJsonLd('ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }, []);
}
