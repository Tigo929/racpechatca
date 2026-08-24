import { useEffect, useState } from 'react';

/**
 * Адрес для <img> из защищённого эндпоинта.
 *
 * Картинки браузер запрашивает сам и без заголовка Authorization, поэтому
 * файлы CRM приходится забирать обычным запросом и оборачивать в blob-адрес.
 * Ключ — то, при смене чего файл нужно перезабрать (имя файла, версия).
 *
 * Загруженное храним вместе с ключом и отдаём только при совпадении: пока
 * новый файл едет, старый показывать нельзя — иначе на футболке на мгновение
 * появляется прошлый принт.
 */
export function useBlobUrl(
  key: string | null,
  fetcher: () => Promise<Blob>,
): string | null {
  const [entry, setEntry] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let created: string | null = null;

    void fetcher()
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setEntry({ key, url: created });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      // Освобождаем память: иначе каждая замена принта оставляла бы за собой
      // копию файла в памяти вкладки до её закрытия.
      if (created) URL.revokeObjectURL(created);
    };
    // fetcher намеренно не в зависимостях: он пересоздаётся на каждый рендер,
    // а перезабирать файл нужно только при смене ключа.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return entry && entry.key === key ? entry.url : null;
}
