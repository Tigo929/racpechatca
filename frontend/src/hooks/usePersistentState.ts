import { useEffect, useRef, useState } from 'react';

/**
 * useState, переживающий размонтирование компонента.
 *
 * Заведённое в форме пропадало от любого переключения: ушёл с «Одна карточка»
 * на «Списком», заглянул в «Заказы» — React размонтировал форму, а вместе с
 * ней и весь набранный черновик. Для формы, которую заполняют по десять минут,
 * это потеря работы, а не мелкое неудобство.
 *
 * Хранилище — sessionStorage, а не localStorage: черновик живёт, пока открыта
 * вкладка браузера, и переживает обновление страницы, но не остаётся навсегда.
 * Закрыли вкладку — начинаем с чистого листа, и вчерашний недописанный принт
 * не всплывёт посреди новой партии.
 *
 * Ключ стоит делать зависимым от того, к чему привязан черновик (например, от
 * кабинета): при смене ключа состояние перечитывается, а не тянется от
 * прошлого владельца.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial));

  // Начальное значение нужно ещё раз при смене ключа — но уже внутри эффекта,
  // поэтому держим его в ref и обновляем там же, а не во время рендера.
  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  });

  const knownKey = useRef(key);
  useEffect(() => {
    if (knownKey.current !== key) {
      // Ключ сменился — читаем черновик нового владельца и на этом проходе
      // ничего не пишем: иначе старое значение легло бы под новый ключ.
      knownKey.current = key;
      setValue(read(key, initialRef.current));
      return;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Переполнение хранилища или запрет на запись не должны ронять форму:
      // без сохранения она работает ровно как раньше.
    }
  }, [key, value]);

  return [value, setValue];
}

function read<T>(key: string, initial: T | (() => T)): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // Битое или чужое значение — начинаем с начального, а не падаем.
  }
  return typeof initial === 'function' ? (initial as () => T)() : initial;
}

/** Убрать сохранённый черновик — например, когда он уже уехал на сервер. */
export function clearPersistentState(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Нечего чистить или доступа нет — не наша забота.
  }
}
