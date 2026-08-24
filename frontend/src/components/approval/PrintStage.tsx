import { useRef } from 'react';
import type { ApprovalSideState, MockupTemplate } from '../../types/index';
import {
  isOutsidePrintArea,
  printRect,
  pxPerMm,
} from '../../utils/approval-geometry';
import { TransformStage } from '../shared/TransformStage';

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
 * Холст согласования: реальная фотография футболки, поверх неё принт.
 *
 * Жесты живут в общем TransformStage — он же используется генератором
 * карточек Ozon. Здесь остаётся только своя геометрия: масштаб задают
 * сантиметры, а не доля области, поэтому изменение размера превращается
 * в новую физическую ширину, а не в множитель.
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
  /** Состояние на момент начала жеста: от него считаются смещение и масштаб. */
  const start = useRef<ApprovalSideState | null>(null);

  const imageW = template.imageWidth ?? 1;
  const imageH = template.imageHeight ?? 1;
  const rect = state ? printRect(state, template) : null;
  const outside = state ? isOutsidePrintArea(state, template) : false;

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
      <TransformStage
        canvasWidth={imageW}
        canvasHeight={imageH}
        backgroundUrl={mockupUrl}
        backgroundAlt={template.title}
        area={{
          left: template.printAreaX,
          top: template.printAreaY,
          width: template.printAreaWidth,
          height: template.printAreaHeight,
        }}
        rect={rect}
        rotation={state?.rotation ?? 0}
        printUrl={printUrl}
        outside={outside}
        disabled={disabled}
        onGestureStart={() => {
          start.current = state;
          onBeforeChange();
        }}
        onMove={(dx, dy) => {
          const from = start.current;
          if (!from) return;
          onChange({ ...from, x: from.x + dx, y: from.y + dy });
        }}
        onScale={(factor) => {
          const from = start.current;
          if (!from) return;
          const ratio = from.heightMm / from.widthMm;
          const widthMm = clamp(Math.round(from.widthMm * factor), MIN_MM, MAX_MM);
          onChange({
            ...from,
            widthMm,
            heightMm: Math.max(MIN_MM, Math.round(widthMm * ratio)),
          });
        }}
        onGestureEnd={() => {
          start.current = null;
          onCommit();
        }}
      />

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
