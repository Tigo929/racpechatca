/**
 * Единый источник правды для всех контактов, города и SEO-контента сайта.
 * Замените значения-заглушки на реальные — они автоматически подставятся
 * во все H1, meta, JSON-LD, FAQ, footer и формы.
 *
 * НИЧЕГО не хардкодим в компонентах — только отсюда.
 */
export const siteConfig = {
  // ─── Компания и гео ──────────────────────────────────────────────
  companyName: 'Распечатка PRO',
  // Безопасный дефолт «России», пока не указан конкретный город.
  // Замените на свой город: предложный падеж для «печать в …», напр. "Москве".
  city: 'России', // напр. "Москве"
  cityNominative: 'Россия', // именительный падеж для адреса/JSON-LD, напр. "Москва"

  // ─── Контакты (заполнить реальными) ──────────────────────────────
  phone: '[ТЕЛЕФОН]', // напр. "+7 900 000-00-00"
  phoneRaw: '[ТЕЛЕФОН_RAW]', // только цифры для tel:, напр. "+79000000000"
  telegram: '[TELEGRAM]', // напр. "raspechatka" (без @)
  whatsapp: '[WHATSAPP]', // только цифры, напр. "79000000000"
  email: '[EMAIL]', // напр. "hello@raspechatka.ru"
  address: '[АДРЕС]', // напр. "ул. Примерная, 1"

  // ─── Часы работы (для JSON-LD и footer) ──────────────────────────
  workingHours: 'Пн–Вс: 10:00–20:00',

  // ─── Домен (для canonical, OG, sitemap) ──────────────────────────
  siteUrl: 'https://raspechatka.ru',

  // ─── Соцдоказательство (заглушки рейтинга) ───────────────────────
  rating: {
    value: '4.9',
    count: '127',
  },

  // ─── Статистика для блока доверия (заглушки — заменить) ───────────
  stats: {
    orders: '1 200+', // выполнено заказов
    companies: '150+', // компаний-клиентов
    repeat: '8 из 10', // возвращаются повторно
    speed: 'от 1 дня', // срок изготовления
  },
} as const;

/**
 * Поле ещё не заполнено реальными данными (осталось значение-заглушка
 * в квадратных скобках). Используется, чтобы не показывать клиенту «[ТЕЛЕФОН]».
 */
export function isFilled(value: string): boolean {
  return !!value && !value.trim().startsWith('[');
}

/** Ссылка на Telegram-чат */
export const telegramUrl = `https://t.me/${siteConfig.telegram}`;
/** Ссылка на WhatsApp-чат */
export const whatsappUrl = `https://wa.me/${siteConfig.whatsapp}`;
/** Ссылка для звонка */
export const telUrl = `tel:${siteConfig.phoneRaw}`;

/**
 * Подставляет город в шаблон. Используйте {city} для предложного падежа.
 * Пример: cityIn('Печать в {city}') → 'Печать в [ГОРОД]'
 */
export function withCity(template: string): string {
  return template
    .replace(/\{city\}/g, siteConfig.city)
    .replace(/\{cityNom\}/g, siteConfig.cityNominative);
}

export type SiteConfig = typeof siteConfig;
