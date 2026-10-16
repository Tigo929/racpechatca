/**
 * Ссылка на фотографии клиента.
 *
 * У новых заказов она лежит отдельным полем. У заведённых раньше — только
 * строкой в примечании: колонка появилась позже, и переносить её задним
 * числом по всем заказам незачем. Поэтому смотрим в оба места: иначе
 * печатник у старого заказа остался бы без файлов, а строку из примечания
 * мы спрятали — её заменила кнопка.
 */
const NOTE_LINE_RE = /Архив фото:\s*(\S+)/i;

export function photosArchiveUrl(order: {
  photosArchiveUrl?: string | null;
  note?: string | null;
}): string | null {
  const stored = order.photosArchiveUrl?.trim();
  if (stored) return stored;

  const match = order.note?.match(NOTE_LINE_RE);
  const fromNote = match?.[1]?.trim();
  if (!fromNote) return null;

  // Берём только http(s): в примечании бывает что угодно, а ссылку мы
  // отдаём браузеру как есть.
  return /^https?:\/\//i.test(fromNote) ? fromNote : null;
}

/**
 * Та же ссылка, но архив скачается под номером заказа.
 *
 * Сайт номера не знает: заказ заводит CRM уже после заявки. В папке
 * «Загрузки» у печатника десятки архивов, и photos-49caa9c7.zip среди них
 * не значит ничего — номер единственное, по чему файл узнают.
 */
export function archiveUrlNamedBy(url: string, numberOrder?: string | null): string {
  const name = (numberOrder ?? '').trim();
  if (!name) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}name=${encodeURIComponent(name)}`;
}
