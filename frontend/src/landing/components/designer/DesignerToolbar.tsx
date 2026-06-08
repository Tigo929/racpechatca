import { useRef } from 'react';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Download,
  Calculator,
} from 'lucide-react';
import type { ShirtColor } from '../../data/content';

interface DesignerToolbarProps {
  colors: ShirtColor[];
  activeColor: ShirtColor;
  onColor: (c: ShirtColor) => void;
  onUpload: (file: File) => void;
  onZoom: (delta: number) => void;
  onRotate: () => void;
  onReset: () => void;
  onDownload: () => void;
  onSubmit: () => void;
  hasArtwork: boolean;
  error?: string | null;
}

export function DesignerToolbar({
  colors,
  activeColor,
  onColor,
  onUpload,
  onZoom,
  onRotate,
  onReset,
  onDownload,
  onSubmit,
  hasArtwork,
  error,
}: DesignerToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      {/* Выбор цвета */}
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Цвет футболки: <span className="text-slate-900">{activeColor.name}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {colors.map((c) => (
            <button
              key={c.name}
              onClick={() => onColor(c)}
              aria-label={`Цвет: ${c.name}`}
              aria-pressed={activeColor.name === c.name}
              className={`swatch w-10 h-10 rounded-full border border-slate-200 ${
                activeColor.name === c.name ? 'swatch--active' : ''
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Загрузка макета */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-white font-semibold transition-colors"
        >
          <Upload className="w-5 h-5" />
          {hasArtwork ? 'Заменить макет' : 'Загрузить макет'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-slate-400">PNG, JPG или SVG, до 10 МБ</p>
      </div>

      {/* Управление макетом */}
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-3">Настройки макета</div>
        <div className="grid grid-cols-2 gap-2.5">
          <ToolBtn onClick={() => onZoom(0.1)} disabled={!hasArtwork} icon={ZoomIn} label="Увеличить" />
          <ToolBtn onClick={() => onZoom(-0.1)} disabled={!hasArtwork} icon={ZoomOut} label="Уменьшить" />
          <ToolBtn onClick={onRotate} disabled={!hasArtwork} icon={RotateCw} label="Повернуть" />
          <ToolBtn onClick={onReset} disabled={!hasArtwork} icon={RefreshCw} label="Сбросить" />
        </div>
      </div>

      {/* Превью / отправка */}
      <div className="space-y-2.5 pt-2 border-t border-slate-100">
        <button
          onClick={onDownload}
          disabled={!hasArtwork}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Скачать превью PNG
        </button>
        <button
          onClick={onSubmit}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-600/30 transition-colors"
        >
          <Calculator className="w-5 h-5" />
          Отправить на расчёт
        </button>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Финальный размер и цвет печати уточнит менеджер перед производством.
      </p>
    </div>
  );
}

function ToolBtn({
  onClick,
  disabled,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50/50 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:text-slate-700 disabled:hover:bg-transparent"
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
