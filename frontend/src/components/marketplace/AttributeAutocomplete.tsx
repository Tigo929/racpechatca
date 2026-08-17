import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ozonCatalogApi, type OzonAttributeValueOption } from '../../api/ozonCatalog';

/**
 * Живая подсказка по словарю атрибута Ozon (цвет, бренд, материал и т.п.).
 * Словари вроде «Цвет товара» — сотни значений, поэтому не тянем список
 * целиком: ищем по введённому тексту через backend-прокси к
 * `/v1/description-category/attribute/values/search`.
 */

interface Props {
  accountId: string;
  attributeId: number;
  placeholder?: string;
  /** Выбранное значение — подпись, которую видит человек. */
  label: string;
  onSelect: (option: OzonAttributeValueOption) => void;
  inputClassName: string;
}

const DEBOUNCE_MS = 300;

export function AttributeAutocomplete({
  accountId, attributeId, placeholder, label, onSelect, inputClassName,
}: Props) {
  const [query, setQuery] = useState(label);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OzonAttributeValueOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Значение снаружи (например, сброс формы после сохранения) должно
  // перетереть локальный ввод. Компонент для этого пересоздаётся родителем
  // через key (см. formVersion в ProductsTab), поэтому здесь достаточно
  // прочитать label только при монтировании — не эффектом.

  const trimmed = query.trim();
  const searchable = open && trimmed.length >= 2;

  useEffect(() => {
    if (!searchable) return;
    // «Ищем…» зажигаем уже внутри таймера, а не сразу: пока человек печатает,
    // запроса всё равно нет, и мигать индикатором на каждую букву незачем.
    const timer = setTimeout(() => {
      setLoading(true);
      ozonCatalogApi.searchAttributeValue(accountId, attributeId, trimmed)
        .then((res) => setOptions(res))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [accountId, attributeId, trimmed, searchable]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <input
        className={inputClassName}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Ищем…
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Ничего не нашлось — попробуйте иначе сформулировать</div>
          ) : (
            options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onSelect(o); setQuery(o.value); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50"
              >
                <span className="truncate">{o.value}</span>
                {o.value === label && <Check size={13} className="text-amber-600 flex-shrink-0" aria-hidden="true" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
