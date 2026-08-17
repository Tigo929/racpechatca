import { Plus, Trash2 } from 'lucide-react';
import { AttributeAutocomplete } from './AttributeAutocomplete';
import { ALL_SIZES, DEFAULT_SIZES, GENDER_LABELS, type ColorGroupDraft, type PrintDraft } from './printDraft';
import { TSHIRT_SIZE_LABELS } from '../../constants';
import type { EnumTshirtGender } from '../../api/ozonCatalog';
import type { EnumTshirtSize } from '../../types/index';

/**
 * Один принт (карточка товара) — общая форма для одиночного и массового
 * создания. Живёт как plain-объект в состоянии родителя, а не отдельным
 * useState здесь: в массовом режиме таких редакторов много одновременно,
 * и состояние должно принадлежать таблице, а не строке.
 */

/** attribute_id «Цвет товара» в категории Ozon «Футболка» — см. docs/ozon-integration.md. */
const COLOR_ATTRIBUTE_ID = 10096;

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
const fieldSm = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

function ColorGroupRow({
  group, onChange, onRemove, accountId, removable,
}: {
  group: ColorGroupDraft;
  onChange: (g: ColorGroupDraft) => void;
  onRemove: () => void;
  accountId: string;
  removable: boolean;
}) {
  const toggleSize = (size: EnumTshirtSize) => {
    const has = group.sizes.includes(size);
    onChange({ ...group, sizes: has ? group.sizes.filter((s) => s !== size) : [...group.sizes, size] });
  };

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <AttributeAutocomplete
            accountId={accountId}
            attributeId={COLOR_ATTRIBUTE_ID}
            placeholder="Начните вводить цвет — «чёрный», «белый»…"
            label={group.colorLabel}
            inputClassName={fieldSm}
            onSelect={(o) => onChange({ ...group, colorLabel: o.value, colorDictionaryValueId: o.id })}
          />
        </div>
        {removable && (
          <button type="button" onClick={onRemove} aria-label="Убрать цвет"
            className="mt-1 p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => toggleSize(size)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              group.sizes.includes(size)
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {TSHIRT_SIZE_LABELS[size]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PrintEditor({
  draft, onChange, accountId, compact,
}: {
  draft: PrintDraft;
  onChange: (d: PrintDraft) => void;
  accountId: string;
  /** В массовом режиме поля описания/хэштегов прячем за раскрытием — экономим место. */
  compact?: boolean;
}) {
  const set = <K extends keyof PrintDraft>(key: K, value: PrintDraft[K]) => onChange({ ...draft, [key]: value });

  const updateGroup = (idx: number, g: ColorGroupDraft) => {
    const next = [...draft.colorGroups];
    next[idx] = g;
    set('colorGroups', next);
  };
  const addGroup = () => set('colorGroups', [...draft.colorGroups, { colorLabel: '', colorDictionaryValueId: 0, sizes: [...DEFAULT_SIZES] }]);
  const removeGroup = (idx: number) => set('colorGroups', draft.colorGroups.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Название товара</span>
          <input className={`mt-1 ${field}`} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Футболка с принтом «…»" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Слаг (артикул принта)</span>
          <input className={`mt-1 ${field}`} value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder="строится из названия, если пусто" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Пол</span>
          <select className={`mt-1 ${field}`} value={draft.gender} onChange={(e) => set('gender', e.target.value as EnumTshirtGender)}>
            {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Цена, ₽</span>
          <input type="number" min={0} className={`mt-1 ${field}`} value={draft.price} onChange={(e) => set('price', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Цена до скидки, ₽ (необязательно)</span>
          <input type="number" min={0} className={`mt-1 ${field}`} value={draft.oldPrice} onChange={(e) => set('oldPrice', e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Ссылка на главное фото</span>
          <input className={`mt-1 ${field}`} value={draft.mainPhotoUrl} onChange={(e) => set('mainPhotoUrl', e.target.value)} placeholder="https://…jpg" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Доп. фото (по ссылке на строку, до 14)</span>
          <textarea rows={compact ? 2 : 3} className={`mt-1 ${field}`} value={draft.extraPhotoUrls} onChange={(e) => set('extraPhotoUrls', e.target.value)} placeholder={'https://…1.jpg\nhttps://…2.jpg'} />
        </label>
        {!compact && (
          <>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Описание</span>
              <textarea rows={3} className={`mt-1 ${field}`} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Тематика рисунка (через запятую: «Животные, Надписи»)</span>
              <input className={`mt-1 ${field}`} value={draft.patternTags} onChange={(e) => set('patternTags', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">#Хештеги</span>
              <input className={`mt-1 ${field}`} value={draft.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#футболка_с_принтом #streetwear" />
            </label>
          </>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-600">Цвета и размеры на этой карточке</span>
        {draft.colorGroups.map((g, idx) => (
          <ColorGroupRow
            key={idx}
            group={g}
            accountId={accountId}
            removable={draft.colorGroups.length > 1}
            onChange={(next) => updateGroup(idx, next)}
            onRemove={() => removeGroup(idx)}
          />
        ))}
        <button type="button" onClick={addGroup} className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900">
          <Plus size={13} aria-hidden="true" /> Ещё цвет в эту карточку
        </button>
      </div>
    </div>
  );
}
