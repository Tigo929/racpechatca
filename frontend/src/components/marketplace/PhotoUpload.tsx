import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Loader2, Star, X } from 'lucide-react';
import { ozonCatalogApi } from '../../api/ozonCatalog';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Загрузка фотографий с компьютера. Файл уезжает на наш сервер и превращается
 * в публичную ссылку — Ozon скачивает картинку сам, локальный путь ему
 * ничего не говорит.
 *
 * Компонент работает и на одно фото (главное у принта), и на набор (общие
 * фото в шаблоне): разница только в `multiple` и подписи.
 */

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
  /** Пометить первое фото звездой — оно уходит в Ozon как главное. */
  markFirstAsMain?: boolean;
  label: string;
  hint?: string;
}

export function PhotoUpload({
  urls, onChange, multiple, markFirstAsMain, label, hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    setUploading(true);
    try {
      const uploaded = await ozonCatalogApi.uploadPhotos(files);
      onChange(multiple ? [...urls, ...uploaded] : uploaded.slice(0, 1));
      toast.success(uploaded.length > 1 ? `Загружено фото: ${uploaded.length}` : 'Фото загружено');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Не удалось загрузить фото'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (index: number) => onChange(urls.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div>
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {urls.map((url, idx) => (
          <div key={url} className="relative group">
            <img
              src={url}
              alt=""
              className="w-20 h-20 rounded-lg object-cover border border-gray-200 bg-gray-50"
            />
            {markFirstAsMain && idx === 0 && (
              <span
                title="Главное фото карточки"
                className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow"
              >
                <Star size={11} aria-hidden="true" />
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(idx)}
              aria-label="Убрать фото"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center justify-center shadow"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-amber-400 hover:text-amber-600 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <>
              <ImagePlus size={18} aria-hidden="true" />
              <span className="text-[10px]">выбрать</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
