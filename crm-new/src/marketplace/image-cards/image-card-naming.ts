/**
 * Имена итоговых файлов карточек.
 *
 * Имя приходит от человека («JDM Skyline (2).pdf») и уходит в имя файла,
 * который увидит и сохранит другой человек. Между этими двумя точками его
 * нужно почистить так, чтобы результат был предсказуемым: одинаковый вход
 * всегда даёт одинаковый выход, и ни один символ не может ничего сломать.
 */

/** Кириллица → латиница. Таблица полная, включая ё, й, ъ, ь. */
const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Потолок длины: имя ещё и попадает в путь на диске. */
const MAX_LENGTH = 80;

/** Имя, которое получится, если чистить оказалось нечего. */
const FALLBACK = 'design';

/**
 * Чистое имя из имени загруженного файла.
 *
 * «JDM Skyline R34.pdf» → «jdm-skyline-r34»
 * «Принт Кот №5.png»    → «print-kot-5»
 */
export function cleanBaseName(originalName: string): string {
  // Расширение снимаем только последнее: «logo.v2.png» — это «logo.v2».
  const withoutExt = originalName.replace(/\.[^./\\]+$/, '');

  const translit = withoutExt
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('');

  const cleaned = translit
    // Всё, что не латиница и не цифра, становится разделителем: так и
    // пробелы, и скобки, и «№» приводятся к одному виду.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_LENGTH)
    // Обрезка по длине может оставить дефис на конце — снимаем повторно.
    .replace(/-+$/, '');

  return cleaned || FALLBACK;
}

/**
 * Имя итогового файла карточки.
 * «jdm-skyline-r34» + «black» → «jdm-skyline-r34_black_image_card.png»
 */
export function cardFileName(baseName: string, shirtColor: string): string {
  const color = cleanBaseName(shirtColor) || 'color';
  return `${baseName}_${color}_image_card.png`;
}

/**
 * Разводит совпадающие имена внутри одной пачки.
 *
 * Перезаписывать нельзя: два разных исходника с именами «Кот.pdf» и «кот.PDF»
 * дают одинаковое чистое имя, и второй молча затёр бы первый — вместе с
 * карточками, которые из него уже сделали.
 */
export function uniqueBaseName(baseName: string, taken: Set<string>): string {
  if (!taken.has(baseName)) return baseName;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${baseName}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Практически недостижимо, но молча возвращать занятое имя нельзя.
  return `${baseName}-${Date.now()}`;
}

/** Тип исходника по MIME. Расширению не доверяем — его пишет пользователь. */
export function sourceTypeByMime(mimetype: string): string | null {
  switch (mimetype) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

/**
 * Тип по первым байтам файла.
 *
 * Это и есть источник правды: и расширение, и MIME присылает браузер, то есть
 * их назначает тот, кто загружает файл. Переименованный архив с MIME
 * «image/png» дальше этой проверки не пройдёт.
 */
export function sniffSourceType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';

  if (
    buffer[0] === 0x89 &&
    buffer.subarray(1, 4).toString('latin1') === 'PNG' &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}
