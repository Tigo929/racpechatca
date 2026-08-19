import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { AttributeAutocomplete } from './AttributeAutocomplete';
import { PhotoUpload } from './PhotoUpload';
import {
  ALL_SIZES, GENDER_LABELS, colorCodeFor, emptyColorGroup, previewOfferId,
  type ColorGroupDraft, type PrintDraft,
} from './printDraft';
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
/**
 * «Рисунок» (тематика). Ozon принимает его только значениями из словаря:
 * набранный руками текст площадка отклоняет целиком — «указывайте значения
 * из списка». Из-за этого пять вариантов уже уходили в ошибку публикации.
 */
const PATTERN_ATTRIBUTE_ID = 9437;

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
const fieldSm = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

export function ColorGroupRow({
  group, onChange, onRemove, accountId, removable, slug, name,
}: {
  group: ColorGroupDraft;
  onChange: (g: ColorGroupDraft) => void;
  onRemove: () => void;
  accountId: string;
  removable: boolean;
  slug: string;
  name: string;
}) {
  const toggleSize = (size: EnumTshirtSize) => {
    const has = group.sizes.includes(size);
    onChange({ ...group, sizes: has ? group.sizes.filter((s) => s !== size) : [...group.sizes, size] });
  };

  const firstSize = group.sizes[0] ?? 'S';

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
            onSelect={(o) => onChange({
              ...group,
              colorLabel: o.value,
              colorDictionaryValueId: o.id,
              // Код подставляем автоматически, но оставляем правимым: у цвета
              // может быть свой код в номенклатуре продавца.
              colorCode: colorCodeFor(o.value),
            })}
          />
        </div>
        <div className="w-28 flex-shrink-0">
          <input
            className={fieldSm}
            value={group.colorCode}
            onChange={(e) => onChange({ ...group, colorCode: e.target.value })}
            placeholder="black"
            aria-label="Код цвета в артикуле"
          />
        </div>
        {removable && (
          <button type="button" onClick={onRemove} aria-label="Убрать цвет"
            className="mt-1 p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-400 font-mono">
        Артикул: {previewOfferId(slug, name, group.colorCode, firstSize)}
      </p>

      {/* Единственное место, где задаётся фото. Раньше рядом было ещё и
          «главное фото принта» запасным — два поля подряд путали и норовили
          заполниться одной и той же картинкой дважды. Принт один, а футболки
          разные: снимок бывает только у цвета. */}
      <PhotoUpload
        label={`Фото цвета${group.colorLabel ? ` «${group.colorLabel}»` : ''}`}
        hint={group.mainPhotoUrl ? undefined : 'Обязательно: это фото уйдёт в карточку Ozon.'}
        urls={group.mainPhotoUrl ? [group.mainPhotoUrl] : []}
        markFirstAsMain
        onChange={(urls) => onChange({ ...group, mainPhotoUrl: urls[0] ?? '' })}
      />
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
  draft, onChange, accountId,
}: {
  draft: PrintDraft;
  onChange: (d: PrintDraft) => void;
  accountId: string;
}) {
  const set = <K extends keyof PrintDraft>(key: K, value: PrintDraft[K]) => onChange({ ...draft, [key]: value });

  /*
   * Две вкладки вместо свёрнутого блока.
   *
   * Описание, тематика и хештеги — то, по чему Ozon находит карточку, но
   * лежали они за неприметной строкой «раскрыть», да ещё и свёрнутой в
   * массовом создании. Туда не заглядывали, и товары уходили без единственного,
   * что двигает их в выдаче. Вкладка это не прячет: её видно всегда, и на ней
   * же написано, чего не хватает.
   *
   * Цвета и размеры остаются под вкладками — они меняются у каждого принта, и
   * убирать их за переключатель значило бы менять одну потерю на другую.
   */
  const [tab, setTab] = useState<'main' | 'search'>('main');
  const searchFilled =
    Number(Boolean(draft.description.trim())) +
    Number(draft.patternTags.length > 0) +
    Number(Boolean(draft.hashtags.trim()));

  const updateGroup = (idx: number, g: ColorGroupDraft) => {
    const next = [...draft.colorGroups];
    next[idx] = g;
    set('colorGroups', next);
  };
  const addGroup = () => set('colorGroups', [...draft.colorGroups, emptyColorGroup()]);
  const removeGroup = (idx: number) => set('colorGroups', draft.colorGroups.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {/* Переключатель виден всегда — и в одиночном создании, и в списке. */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {([
          { key: 'main', label: 'Товар' },
          { key: 'search', label: 'Описание, тематика, хештеги' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.key
                ? 'border-amber-600 font-semibold text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
            {t.key === 'search' && (
              /* Сколько из трёх полей заполнено — видно, не открывая вкладку.
                 Пусто помечаем предупреждением, а не молчанием: именно по этим
                 полям карточку находят. */
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                  searchFilled === 3
                    ? 'bg-emerald-50 text-emerald-700'
                    : searchFilled === 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {searchFilled}/3
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={tab === 'main' ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Название товара</span>
          <input className={`mt-1 ${field}`} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Футболка с принтом «…»" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Код принта</span>
          <input className={`mt-1 ${field}`} value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder="JDM-1-1" />
          <span className="mt-1 block text-[11px] text-gray-400">
            Категория-подгруппа-пункт, как в папках макетов. Регистр сохраняется.
            Он же уходит в поле Ozon «Объединить на одной карточке»: все цвета
            с этим кодом площадка покажет одной карточкой с переключением цвета.
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Пол</span>
          <select className={`mt-1 ${field}`} value={draft.gender} onChange={(e) => set('gender', e.target.value as EnumTshirtGender)}>
            {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className={tab === 'search' ? 'block' : 'hidden'}>
        <p className="mb-3 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">
          По этим полям Ozon находит карточку в поиске. Без них товар заведётся,
          но покупатель его не увидит — а контент-рейтинг карточки просядет.
        </p>
        <div className="space-y-3">
          <label className="block">
              <span className="text-xs font-medium text-gray-600">Описание</span>
              <textarea rows={6} className={`mt-1 ${field}`} value={draft.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <label className="block">
              <span className="text-xs font-medium text-gray-600">Тематика рисунка</span>
              <AttributeAutocomplete
                accountId={accountId}
                attributeId={PATTERN_ATTRIBUTE_ID}
                placeholder="Начните вводить — «автомобили», «надписи»…"
                label=""
                inputClassName={`mt-1 ${field}`}
                onSelect={(o) => {
                  // Копим списком: у товара бывает несколько тем, а Ozon
                  // отдаёт по одному значению за выбор.
                  if (draft.patternTags.includes(o.value)) return;
                  set('patternTags', [...draft.patternTags, o.value]);
                }}
              />
              {draft.patternTags.length > 0 && (
                /* Каждая тема убирается отдельно: раньше был только сброс
                   всего списка, и чтобы снять одну лишнюю, приходилось
                   выбирать остальные заново. */
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {draft.patternTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-50 py-0.5 pl-2 pr-1 text-[11px] text-amber-900"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Убрать «${tag}»`}
                        onClick={() =>
                          set('patternTags', draft.patternTags.filter((t) => t !== tag))
                        }
                        className="rounded p-0.5 text-amber-600 hover:bg-amber-100 hover:text-amber-900"
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <span className="mt-1 block text-[11px] text-gray-400">
                Только значения из списка Ozon — набранные руками площадка отклоняет.
              </span>
          </label>
          <label className="block">
              <span className="text-xs font-medium text-gray-600">#Хештеги</span>
              <input className={`mt-1 ${field}`} value={draft.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#футболка_с_принтом #streetwear" />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-600">Цвета и размеры на этой карточке</span>
        {draft.colorGroups.map((g, idx) => (
          <ColorGroupRow
            key={idx}
            group={g}
            accountId={accountId}
            slug={draft.slug}
            name={draft.name}
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
