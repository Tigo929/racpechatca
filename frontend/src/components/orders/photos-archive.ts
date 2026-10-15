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
