import { useState } from 'react';
import type { PeriodPreset, PeriodQuery } from '../../types/analytics';
import { PRESET_LABELS, PRESET_ORDER } from './analytics-view';

/**
 * Выбор периода (этап 09, раздел 5): восемь пресетов и произвольные даты.
 * Для произвольного периода посетители могут быть недоступны — об этом
 * скажет сама карточка, подменять их суммой по дням нельзя.
 */
export function PeriodSelector({ value, onChange }: { value: PeriodQuery; onChange: (q: PeriodQuery) => void }) {
  const custom = 'from' in value;
  const [draft, setDraft] = useState<{ from: string; to: string }>(custom ? value : { from: '', to: '' });
  const [showCustom, setShowCustom] = useState(custom);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Период">
        {PRESET_ORDER.map((p: PeriodPreset) => {
          const active = 'preset' in value && value.preset === p;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setShowCustom(false);
                onChange({ preset: p });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          aria-expanded={showCustom}
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            custom ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-indigo-300'
          }`}
        >
          Свои даты
        </button>
      </div>
      {showCustom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.from && draft.to && draft.from <= draft.to) onChange({ from: draft.from, to: draft.to });
          }}
        >
          <label className="text-xs text-gray-500 flex flex-col gap-1">
            С
            <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 min-h-[38px]" required />
          </label>
          <label className="text-xs text-gray-500 flex flex-col gap-1">
            По
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 min-h-[38px]" required />
          </label>
          <button type="submit" className="px-3 min-h-[38px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
            Показать
          </button>
        </form>
      )}
    </div>
  );
}
