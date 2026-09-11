/**
 * Маркетинговая атрибуция заявки с сайта → колонки заказа.
 *
 * Сайт присылает, откуда пришёл человек: идентификатор браузера в Метрике,
 * метку клика Директа, UTM и адрес страницы, с которой ушла заявка. До
 * сентября 2026 всё это писалось строками в `note`, и связать заказ
 * с визитом можно было только парсингом текста. Теперь — отдельные поля
 * `OrderPhoto`; `note` продолжает получать те же строки для людей.
 *
 * Правила простые и одинаковые для всех полей: обрезаем пробелы по краям,
 * пустое превращаем в `null`. Ничего не валидируем повторно — DTO уже
 * проверил тип и длину, а «неправильная» UTM для аналитики полезнее,
 * чем пропавшая: по ней хотя бы видно, что источник размечен криво.
 *
 * `conversionPageUrl` получает `pageUrl` — адрес страницы, **на которой
 * отправлена заявка**. Это не страница входа на сайт (first-touch
 * landing): её сайт пока не запоминает, и поля под неё здесь нет —
 * появится вместе с моделью событий, когда сайт начнёт сохранять первый
 * адрес визита. Имя выбрано так, чтобы поле не обещало больше, чем
 * в нём лежит.
 */

export interface LeadAttributionInput {
  yandexClientId?: string | null;
  yclid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  pageUrl?: string | null;
}

export interface LeadAttribution {
  yandexClientId: string | null;
  yclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  conversionPageUrl: string | null;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Поля атрибуции для `orderPhoto.create({ data })`. */
export function attributionFromLead(dto: LeadAttributionInput): LeadAttribution {
  return {
    yandexClientId: clean(dto.yandexClientId),
    yclid: clean(dto.yclid),
    utmSource: clean(dto.utmSource),
    utmMedium: clean(dto.utmMedium),
    utmCampaign: clean(dto.utmCampaign),
    utmContent: clean(dto.utmContent),
    utmTerm: clean(dto.utmTerm),
    conversionPageUrl: clean(dto.pageUrl),
  };
}
