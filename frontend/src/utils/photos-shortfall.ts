/**
 * Недобор фотографий: обещано больше, чем доехало.
 *
 * Фотографии грузит браузер клиента, и дойти могут не все — закрыл
 * вкладку, ушёл в другое приложение, потерял сеть. Заявка к этому моменту
 * уже у нас: её отправляют первой, не дожидаясь последнего файла. Дальше
 * карточка показывала полный тираж и молчала, а правда всплывала
 * у печатника — когда клиент уже ждёт.
 *
 * Тот же вопрос решается на сервере (crm-new/src/order-photo/photos-shortfall.ts),
 * и ответы обязаны совпадать.
 */

export interface PhotosShortfallOrder {
  photosExpected?: number | null;
  photosArrived?: number | null;
  photosResolvedAt?: string | null;
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
 * мимо сайта, и такие заказы краснеть не должны — иначе красным станет
 * половина списка и цвет перестанет что-либо значить.
 */
export function photosShortfall(
  order: PhotosShortfallOrder,
): PhotosShortfall | null {
  const expected = order.photosExpected;
  const arrived = order.photosArrived;
  if (typeof expected !== 'number' || typeof arrived !== 'number') return null;
  if (expected <= 0) return null;
  if (arrived >= expected) return null;
  if (order.photosResolvedAt) return null;
  return { expected, arrived, missing: expected - arrived };
}

/** Склонение: «не хватает 1 фотографии» / «3 фотографий». */
export function pluralPhotos(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'фотографии';
  return 'фотографий';
}
