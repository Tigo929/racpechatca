import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { AttributeAutocomplete } from './AttributeAutocomplete';
import { PhotoUpload } from './PhotoUpload';
import { ozonCatalogApi, type OzonCatalogTemplate } from '../../api/ozonCatalog';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Константы карточки «Футболка», общие на весь кабинет: бренд, материал,
 * состав, стиль и т.п. Задаются один раз — их не приходится вспоминать
 * при создании каждого нового принта (см. docs/ozon-integration.md,
 * «Что показал живой кабинет»).
 */

const field = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

// attribute_id категории «Футболка» — см. ozon-attributes.ts на бэкенде.
const ATTR = { BRAND: 31, COUNTRY: 4389, MATERIAL: 4496, STYLE: 4501, SEASON: 4495 };

type Field = 'brand' | 'country' | 'material' | 'style' | 'season';

const FIELD_META: { key: Field; attributeId: number; title: string; placeholder: string }[] = [
  { key: 'brand', attributeId: ATTR.BRAND, title: 'Бренд', placeholder: 'Нет бренда' },
  { key: 'country', attributeId: ATTR.COUNTRY, title: 'Страна-изготовитель', placeholder: 'необязательно' },
  { key: 'material', attributeId: ATTR.MATERIAL, title: 'Материал', placeholder: 'Хлопок' },
  { key: 'style', attributeId: ATTR.STYLE, title: 'Стиль', placeholder: 'Повседневный' },
  { key: 'season', attributeId: ATTR.SEASON, title: 'Сезон', placeholder: 'На любой сезон' },
];

function labelField(key: Field): keyof OzonCatalogTemplate {
  return `${key}Label` as keyof OzonCatalogTemplate;
}
function dictField(key: Field): keyof OzonCatalogTemplate {
  return `${key}DictionaryValueId` as keyof OzonCatalogTemplate;
}

export function TemplateSettings({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: template, isLoading } = useQuery({
    queryKey: ['ozon-template', accountId],
    queryFn: () => ozonCatalogApi.getTemplate(accountId),
    enabled: open,
  });

  const [draft, setDraft] = useState<Partial<OzonCatalogTemplate>>({});
  const effective = { ...template, ...draft } as OzonCatalogTemplate | undefined;

  const save = useMutation({
    mutationFn: () => ozonCatalogApi.updateTemplate(accountId, draft),
    onSuccess: (updated) => {
      qc.setQueryData(['ozon-template', accountId], updated);
      setDraft({});
      toast.success('Шаблон сохранён');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить шаблон')),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Settings2 size={15} className="text-amber-500" aria-hidden="true" />
          Шаблон по умолчанию
        </span>
        {open ? <ChevronUp size={16} className="text-gray-400" aria-hidden="true" /> : <ChevronDown size={16} className="text-gray-400" aria-hidden="true" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            Общие для всего ассортимента поля категории «Футболка» — задайте один раз,
            дальше при создании принта их можно не трогать.
          </p>

          {isLoading || !effective ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELD_META.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs font-medium text-gray-600">{f.title}</span>
                    <div className="mt-1">
                      <AttributeAutocomplete
                        accountId={accountId}
                        attributeId={f.attributeId}
                        placeholder={f.placeholder}
                        inputClassName={field}
                        label={String(effective[labelField(f.key)] ?? '')}
                        onSelect={(o) => setDraft((d) => ({ ...d, [labelField(f.key)]: o.value, [dictField(f.key)]: o.id }))}
                      />
                    </div>
                  </label>
                ))}
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Состав материала</span>
                  <input
                    className={`mt-1 ${field}`}
                    value={effective.materialComposition ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, materialComposition: e.target.value }))}
                    placeholder="100% Хлопок"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Уход за вещами</span>
                  <input
                    className={`mt-1 ${field}`}
                    value={effective.careInstructions ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, careInstructions: e.target.value }))}
                    placeholder="Машинная стирка при 30°"
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={effective.needsMarkingCode ?? false}
                    onChange={(e) => setDraft((d) => ({ ...d, needsMarkingCode: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <span className="text-sm text-gray-700">Товар подлежит обязательной маркировке (Честный ЗНАК)</span>
                </label>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <PhotoUpload
                  label="Общие фото карточки"
                  hint="Одни и те же во всех товарах: размерная сетка, условия доставки и т.п. Загружаются один раз — на принте вы добавляете только главное фото. Порядок фото такой же, как здесь."
                  urls={effective.sharedPhotoUrls ?? []}
                  multiple
                  onChange={(urls) => setDraft((d) => ({ ...d, sharedPhotoUrls: urls }))}
                />
              </div>

              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || Object.keys(draft).length === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {save.isPending ? 'Сохраняем…' : 'Сохранить шаблон'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
