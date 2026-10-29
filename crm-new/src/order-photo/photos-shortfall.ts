/**
 * Недобор фотографий: обещано больше, чем доехало.
 *
 * Фотографии грузит браузер клиента, и дойти могут не все — закрыл
 * вкладку, ушёл в другое приложение, потерял сеть. Заявка к этому моменту
 * уже у нас: её отправляют первой, не дожидаясь последнего файла. Дальше
 * карточка показывала полный тираж и молчала, а правда всплывала
 * у печатника — когда клиент уже ждёт.
 *
 * Поэтому правило живёт отдельно от базы и интерфейса: по нему краснеет
 * карточка в CRM, и то же самое должен уметь посчитать сервер.
 *
 * Тот же модуль есть на фронте (frontend/src/utils/photos-shortfall.ts),
 * и ответы обязаны совпадать.
 */

export interface PhotosShortfallOrder {
  photosExpected?: number | null;
  photosArrived?: number | null;
  /** Менеджер подтвердил, что остальные снимки у нас. */
  photosResolvedAt?: Date | string | null;
}

export interface PhotosShortfall {
  expected: number;
  arrived: number;
  /** Скольких не хватает — именно это число называют клиенту. */
  missing: number;
}

/**
 * Чего не хватает по заказу. `null` — сверять нечего или всё сошлось.
 *
 * Пустые числа значат «неизвестно», а не «ноль»: фотографии могли прийти
 * мимо сайта — в переписке, ссылкой на облако, — и такие заказы краснеть
 * не должны, иначе красным станет половина списка и цвет перестанет
 * что-либо значить.
 */
export function photosShortfall(
  order: PhotosShortfallOrder,
): PhotosShortfall | null {
  const expected = order.photosExpected;
  const arrived = order.photosArrived;
  if (typeof expected !== 'number' || typeof arrived !== 'number') return null;
  if (expected <= 0) return null;
  if (arrived >= expected) return null;
  // Менеджер сказал, что остальные снимки у нас: хвост пришёл мимо сайта,
  // и сервер об этом узнать не может никогда.
  if (order.photosResolvedAt) return null;
  return { expected, arrived, missing: expected - arrived };
}

/**
 * Строка о недоборе в примечании — ровно одна.
 *
 * Примечание читают те, кто в карточку не заходит, и строка там нужна.
 * Но сайт сообщает о папке при каждом изменении числа файлов, и простое
 * дописывание превратило бы примечание в столбик «84 из 172», «91 из
 * 172», «103 из 172» — поверх настоящих указаний печатнику.
 *
 * Поэтому прежняя строка заменяется новой, а когда всё доехало —
 * убирается совсем: она описывает положение, которого больше нет.
 */
const SHORTFALL_LINE = /^⚠️\s*Фотографии доехали не все:/;

export interface NoteWithShortfall {
  /** Примечание со строкой о недоборе. */
  text: string;
  /** Оно же без неё — когда хвост доехал. */
  without: string;
  /** Строка уже стояла: значит о недоборе по этому заказу уже говорили. */
  hadLine: boolean;
}

export function withShortfallLine(
  note: string | null | undefined,
  line: string,
): NoteWithShortfall {
  const lines = (note ?? '').split('\n');
  const index = lines.findIndex((row) => SHORTFALL_LINE.test(row.trim()));
  const hadLine = index >= 0;

  const text = hadLine
    ? lines.map((row, i) => (i === index ? line : row)).join('\n')
    : [(note ?? '').trim(), line].filter(Boolean).join('\n');

  const without = hadLine
    ? lines
        .filter((_, i) => i !== index)
        .join('\n')
        .trim()
    : (note ?? '').trim();

  return { text, without, hadLine };
}
