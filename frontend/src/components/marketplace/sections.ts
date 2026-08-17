import {
  Boxes, KeyRound, Package, ShoppingCart, Tags, type LucideIcon,
} from 'lucide-react';
import type { EnumMarketplace } from '../../api/marketplace';

/**
 * Единственное место, где описаны площадки и разделы работы с ними.
 *
 * Тот же приём, что и в navigation.ts для CRM целиком: новый раздел — одна
 * строка здесь, и он сам появится во вкладках, в маршрутах и в заголовке.
 * У Ozon под три сотни методов API, и разделы будут добавляться постоянно —
 * без такого реестра страница быстро превратится в свалку условий.
 */

export interface PlatformDef {
  key: EnumMarketplace;
  /** Часть URL: /crm/marketplace/<slug>/<секция>. */
  slug: string;
  label: string;
  ready: boolean;
}

export const PLATFORMS: PlatformDef[] = [
  { key: 'OZON', slug: 'ozon', label: 'Ozon', ready: true },
  { key: 'WB', slug: 'wb', label: 'Wildberries', ready: false },
  { key: 'YANDEX', slug: 'yandex', label: 'Яндекс Маркет', ready: false },
];

export type SectionKey =
  | 'connection'
  | 'catalog'
  | 'products'
  | 'orders'
  | 'prices';

export interface SectionDef {
  key: SectionKey;
  slug: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  /** Подпись под заголовком страницы. */
  subtitle: string;
  /** Чем раздел станет, пока он не готов. */
  soon?: string;
}

export const SECTIONS: SectionDef[] = [
  {
    key: 'connection',
    slug: 'connection',
    label: 'Подключение',
    icon: KeyRound,
    ready: true,
    subtitle: 'Доступы к кабинету и проверка связи',
  },
  {
    key: 'catalog',
    slug: 'catalog',
    label: 'Мои товары',
    icon: Boxes,
    ready: true,
    subtitle: 'Товары кабинета: цены, остатки, спрос и рентабельность',
  },
  {
    key: 'products',
    slug: 'products',
    label: 'Создание',
    icon: Package,
    ready: true,
    subtitle: 'Новые карточки футболок: одиночно и массово',
  },
  {
    key: 'orders',
    slug: 'orders',
    label: 'Заказы',
    icon: ShoppingCart,
    ready: true,
    subtitle: 'Что заказали и до когда нужно отгрузить',
  },
  {
    key: 'prices',
    slug: 'prices',
    label: 'Цены и остатки',
    icon: Tags,
    ready: false,
    subtitle: 'Цены и остатки по складам',
    soon: 'Обновление цен и остатков списком, без перехода в кабинет Ozon. Цена будет считаться от себестоимости и правил наценки канала, а не вводиться руками по каждому товару.',
  },
];

export const DEFAULT_PLATFORM = PLATFORMS[0]!;
export const DEFAULT_SECTION = SECTIONS[0]!;

export function platformBySlug(slug: string | undefined): PlatformDef {
  return PLATFORMS.find((p) => p.slug === slug && p.ready) ?? DEFAULT_PLATFORM;
}

export function sectionBySlug(slug: string | undefined): SectionDef {
  return SECTIONS.find((s) => s.slug === slug) ?? DEFAULT_SECTION;
}
