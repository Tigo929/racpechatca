/**
 * Атрибуция из свободного текста `OrderPhoto.note`.
 *
 * До этапа 02 приём заявки с сайта писал ClientID Метрики, метку yclid
 * и адрес страницы строками в примечание заказа. Формат задавал один
 * кусок кода (`order-photo.service.ts`, приём заявки), поэтому строки
 * одинаковые во всех заявках — проверено по боевой базе 11.09.2026:
 *
 *   Yandex ClientID: 1784…      (11 заказов, с 15.08.2026)
 *   yclid: 1133…                (10 заказов, с 02.09.2026)
 *   Страница: https://raspechatkaa.ru/…   (16 заказов, с 15.08.2026)
 *
 * Иных написаний («clientid», «Client ID», yclid внутри предложения)
 * в базе нет — ноль строк.
 *
 * Парсер намеренно узкий: маркер в начале строки, значение — до конца
 * строки, без пробелов внутри. Широкий regex захватил бы соседний текст,
 * а примечание после заявки правят люди, и там может быть что угодно.
 * Значение, не похожее на настоящее (ClientID не из цифр, yclid с
 * пробелом, «страница» без http), считается ошибкой разбора, а не
 * данными: лучше пустое поле, чем мусор в аналитике.
 *
 * «Страница:» — адрес, с которого отправлена заявка. Это страница
 * конверсии (`conversionPageUrl`), не страница входа на сайт.
 */

export interface NoteAttribution {
  yandexClientId: string | null;
  yclid: string | null;
  conversionPageUrl: string | null;
  /** Маркер был, но значение не прошло проверку — по полям. */
  failures: ('yandexClientId' | 'yclid' | 'conversionPageUrl')[];
}

// Маркер ловим отдельно от значения: строка с маркером, но с негодным
// значением («yclid: 12 34») — это ошибка разбора, а не «маркера нет».
const CLIENT_ID_LINE = /^[ \t]*Yandex ClientID:(.*)$/m;
const YCLID_LINE = /^[ \t]*yclid:(.*)$/m;
const PAGE_LINE = /^[ \t]*Страница:(.*)$/m;

/** ClientID Метрики — десятичное число; в базе 19–20 знаков. */
const CLIENT_ID_VALUE = /^\d{5,32}$/;
/** yclid — число Директа; допускаем и буквенно-цифровые формы. */
const YCLID_VALUE = /^[A-Za-z0-9_-]{5,240}$/;
const URL_VALUE = /^https?:\/\/\S+$/;

export function parseNoteAttribution(note: string | null | undefined): NoteAttribution {
  const result: NoteAttribution = {
    yandexClientId: null,
    yclid: null,
    conversionPageUrl: null,
    failures: [],
  };
  if (!note) return result;
  // Строки могут прийти с CRLF — сводим к LF, иначе `$` не совпадёт.
  const text = note.replace(/\r\n?/g, '\n');

  const clientId = CLIENT_ID_LINE.exec(text)?.[1]?.trim();
  if (clientId !== undefined) {
    if (CLIENT_ID_VALUE.test(clientId)) result.yandexClientId = clientId;
    else result.failures.push('yandexClientId');
  }

  const yclid = YCLID_LINE.exec(text)?.[1]?.trim();
  if (yclid !== undefined) {
    if (YCLID_VALUE.test(yclid)) result.yclid = yclid;
    else result.failures.push('yclid');
  }

  const page = PAGE_LINE.exec(text)?.[1]?.trim();
  if (page !== undefined) {
    if (URL_VALUE.test(page)) result.conversionPageUrl = page;
    else result.failures.push('conversionPageUrl');
  }

  return result;
}
