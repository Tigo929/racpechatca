import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { PhotoUpload } from './PhotoUpload';
import { ozonCatalogApi, type EnumTshirtGender, type OzonPrint } from '../../api/ozonCatalog';
import { getErrorMessage } from '../../utils/get-error-message';
import { GENDER_LABELS } from './printDraft';

/**
 * Правка принта, ещё не ушедшего в Ozon.
 *
 * До сих пор ошибку в названии или цене исправить было нечем: черновик
 * приходилось удалять и набирать заново со всеми цветами и размерами. Метод
 * на сервере при этом существовал — не хватало только экрана.
 *
 * Код принта и цвета здесь не меняются намеренно: из них собран артикул
 * (JDM-1-1-black-S), и переименование развалило бы связь с тем, что уже
 * заведено. Цвет добавляется отдельной кнопкой в карточке товара.
 */

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

export function EditPrintModal({ print, onClose, onSaved }: {
  print: OzonPrint;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(print.name);
  const [price, setPrice] = useState(String(print.price));
  const [oldPrice, setOldPrice] = useState(print.oldPrice ? String(print.oldPrice) : '');
  const [description, setDescription] = useState(print.description ?? '');
  const [hashtags, setHashtags] = useState(print.hashtags ?? '');
  const [gender, setGender] = useState<EnumTshirtGender>(print.gender);
  const [mainPhotoUrl, setMainPhotoUrl] = useState(print.mainPhotoUrl);

  const save = useMutation({
    mutationFn: () =>
      ozonCatalogApi.updatePrint(print.id, {
        name: name.trim(),
        price: Number(price) || 0,
        oldPrice: oldPrice.trim() ? Number(oldPrice) : undefined,
        description: description.trim(),
        hashtags: hashtags.trim(),
        gender,
        mainPhotoUrl,
      }),
    onSuccess: () => { toast.success('Принт изменён'); onSaved(); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  const errors: string[] = [];
  if (name.trim().length < 3) errors.push('Название короче 3 символов');
  if (!mainPhotoUrl.trim()) errors.push('Не указана ссылка на главное фото');
  if (!Number(price)) errors.push('Не указана цена');

  return (
    <Modal open onClose={onClose} title={`Изменить ${print.slug}`} size="lg">
      <div className="space-y-3">
        <p className="rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-500">
          Код принта <span className="font-mono text-gray-700">{print.slug}</span>,
          цвета и размеры здесь не меняются — из них собраны артикулы. Цвет
          добавляется в карточке товара, размер — там же.
        </p>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Название товара</span>
          <input className={`mt-1 ${field}`} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Цена, ₽</span>
            <input type="number" min={0} className={`mt-1 ${field}`} value={price}
              onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Цена до скидки, ₽</span>
            <input type="number" min={0} className={`mt-1 ${field}`} value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Пол</span>
            <select className={`mt-1 ${field}`} value={gender}
              onChange={(e) => setGender(e.target.value as EnumTshirtGender)}>
              {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Описание</span>
          <textarea rows={4} className={`mt-1 ${field}`} value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">#Хештеги</span>
          <input className={`mt-1 ${field}`} value={hashtags}
            onChange={(e) => setHashtags(e.target.value)} />
        </label>

        <PhotoUpload
          label="Главное фото"
          urls={mainPhotoUrl ? [mainPhotoUrl] : []}
          markFirstAsMain
          onChange={(urls) => setMainPhotoUrl(urls[0] ?? '')}
        />

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-amber-100 bg-amber-50 p-2.5">
            {errors.map((e) => (
              <li key={e} className="text-xs text-amber-900">• {e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || errors.length > 0}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {save.isPending ? 'Сохраняем…' : 'Сохранить'}
          </button>
          <button onClick={onClose} className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            Отмена
          </button>
        </div>
      </div>
    </Modal>
  );
}
