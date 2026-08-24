import { useRef } from 'react';
import type { ApprovalSideState, MockupTemplate } from '../../types/index';
import {
  isOutsidePrintArea,
  printRect,
  pxPerMm,
} from '../../utils/approval-geometry';

interface Props {
  template: MockupTemplate;
  mockupUrl: string | null;
  printUrl: string | null;
  state: ApprovalSideState | null;
  /** Жест начался — момент снять снимок для «Отменить». */
  onBeforeChange: () => void;
  /** Живое изменение — вызывается на каждое движение мыши. */
  onChange: (next: ApprovalSideState) => void;
  /** Жест завершён: пора сохранять. */
  onCommit: () => void;
  disabled?: boolean;
}

/** Минимум и максимум физического размера принта — 2 см … 60 см по ширине. */
export const MIN_MM = 20;
export const MAX_MM = 600;

/**
 * Холст редактора: реальная фотография футболки, поверх неё принт.
 *
 * Никакой canvas-библиотеки: принт — это обычная картинка с CSS-трансформом,
 * а вся математика живёт в approval-geometry. Итоговый файл всё равно рисует
 * сервер, поэтому холсту достаточно показывать, а не рендерить.
 */
export function PrintStage({
  template,
  mockupUrl,
  printUrl,
  state,
  onBeforeChange,
  onChange,
  onCommit,
  disabled,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  const imageW = template.imageWidth ?? 1;
  const imageH = template.imageHeight ?? 1;
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  const rect = state ? printRect(state, template) : null;
  const outside = state ? isOutsidePrintArea(state, template) : false;

  /** Перетаскивание принта. Смещение переводим в доли зоны печати. */
  const startDrag = (event: React.PointerEvent) => {
    if (!state || disabled) return;
    event.preventDefault();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;

    onBeforeChange();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = state.x;
    const originY = state.y;
    // Сколько пикселей фотографии приходится на пиксель экрана.
    const photoPerScreen = imageW / box.width;

    const move = (e: PointerEvent) => {
      const dx = ((e.clientX - startX) * photoPerScreen) / template.printAreaWidth;
      const dy = ((e.clientY - startY) * photoPerScreen) / template.printAreaHeight;
      onChange({ ...state, x: originX + dx, y: originY + dy });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onCommit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /**
   * Изменение размера за угол. Всегда пропорциональное: считаем, во сколько
   * раз изменилось расстояние от центра принта до курсора. Так принт нельзя
   * случайно растянуть по одной оси — для этого есть поля ввода в сантиметрах.
   */
  const startResize = (event: React.PointerEvent) => {
    if (!state || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || !rect) return;

    const centerX = box.left + ((rect.left + rect.width / 2) / imageW) * box.width;
    const centerY = box.top + ((rect.top + rect.height / 2) / imageH) * box.height;
    const startDistance = Math.hypot(
      event.clientX - centerX,
      event.clientY - centerY,
    );
    if (startDistance < 4) return;
    onBeforeChange();
    const startWidthMm = state.widthMm;
    const ratio = state.heightMm / state.widthMm;

    const move = (e: PointerEvent) => {
      const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      const widthMm = clamp(
        Math.round((startWidthMm * distance) / startDistance),
        MIN_MM,
        MAX_MM,
      );
      onChange({
        ...state,
        widthMm,
        heightMm: Math.max(MIN_MM, Math.round(widthMm * ratio)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onCommit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Стрелками принт двигается точно: шаг 0.5 % зоны, с Shift — 2 %. */
  const nudge = (event: React.KeyboardEvent) => {
    if (!state || disabled) return;
    const step = event.shiftKey ? 0.02 : 0.005;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onBeforeChange();
    onChange({ ...state, x: state.x + move[0], y: state.y + move[1] });
    onCommit();
  };

  if (!template.imageFile) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          У шаблона «{template.title}» нет фотографии.
          <br />
          Загрузите её в настройках CRM, раздел «Мокапы согласования».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-xl bg-gray-100 select-none"
        style={{ aspectRatio: `${imageW} / ${imageH}` }}
      >
        {mockupUrl ? (
          <img
            src={mockupUrl}
            alt={template.title}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gray-200" />
        )}

        {/* Зона печати. Видна только во время редактирования — в итоговый
            файл рамка не попадает, её рисует не рендер, а этот компонент. */}
        <div
          className={`pointer-events-none absolute border-2 border-dashed ${
            outside ? 'border-red-500/80' : 'border-white/70'
          }`}
          style={{
            left: pct(template.printAreaX, imageW),
            top: pct(template.printAreaY, imageH),
            width: pct(template.printAreaWidth, imageW),
            height: pct(template.printAreaHeight, imageH),
          }}
        />

        {state && rect && printUrl && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Принт: перетащите мышью, стрелками — точная подгонка"
            onPointerDown={startDrag}
            onKeyDown={nudge}
            className={`absolute ${disabled ? '' : 'cursor-move'} focus-visible:outline-none`}
            style={{
              left: pct(rect.left, imageW),
              top: pct(rect.top, imageH),
              width: pct(rect.width, imageW),
              height: pct(rect.height, imageH),
              transform: `rotate(${state.rotation}deg)`,
            }}
          >
            <img
              src={printUrl}
              alt="Принт"
              draggable={false}
              className="h-full w-full select-none"
            />
            <div className="pointer-events-none absolute inset-0 border border-amber-400/90" />
            {!disabled &&
              CORNERS.map((corner) => (
                <span
                  key={corner.key}
                  onPointerDown={startResize}
                  aria-hidden="true"
                  className={`absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow ${corner.className}`}
                />
              ))}
          </div>
        )}
      </div>

      {state && (
        <p className="text-center text-xs text-gray-500">
          Зона печати: {Math.round(template.printAreaWidthMm / 10)} ×{' '}
          {Math.round(template.printAreaHeightMm / 10)} см ·{' '}
          {pxPerMm(template) > 0
            ? `${(pxPerMm(template) * 10).toFixed(1)} px на см`
            : 'не откалибрована'}
        </p>
      )}
    </div>
  );
}

const CORNERS = [
  { key: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { key: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { key: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
  { key: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
