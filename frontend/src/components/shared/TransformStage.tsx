import { useRef } from 'react';

export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  /** Натуральный размер подложки в пикселях — в них считаются все координаты. */
  canvasWidth: number;
  canvasHeight: number;
  /** Подложка: фотография футболки либо шаблон карточки. */
  backgroundUrl: string | null;
  backgroundAlt: string;
  /** Допустимая область. Рисуется пунктиром и в итоговый файл не попадает. */
  area: StageRect | null;
  /** Где сейчас лежит принт. Пусто — принта нет, жесты не работают. */
  rect: StageRect | null;
  rotation: number;
  printUrl: string | null;
  /** Принт вылез за область — рамка краснеет. Запретом это не является. */
  outside?: boolean;
  disabled?: boolean;

  /** Жест начался: момент снять снимок для «Отменить» и запомнить исходные значения. */
  onGestureStart: () => void;
  /** Смещение за жест, в долях области: 0.1 — десятая часть её ширины. */
  onMove: (dx: number, dy: number) => void;
  /** Во сколько раз изменился размер с начала жеста. */
  onScale: (factor: number) => void;
  /** Жест завершён: пора сохранять. */
  onGestureEnd: () => void;
}

/**
 * Холст с принтом: перетаскивание, пропорциональное изменение размера за
 * угол, точная подгонка стрелками.
 *
 * Общий для согласования макета и генератора карточек Ozon — ТЗ генератора
 * прямо запрещает писать второй движок жестов. Общее у них только это:
 * геометрия у модулей разная (в согласовании масштаб задают сантиметры, в
 * карточках — доля области), поэтому наружу отдаются не готовые значения,
 * а смещение и множитель, а что с ними делать, решает вызывающий.
 *
 * Никакой canvas-библиотеки: принт — обычная картинка с CSS-трансформом.
 * Итоговый файл всё равно рисует сервер, поэтому холсту достаточно
 * показывать, а не рендерить.
 */
export function TransformStage({
  canvasWidth,
  canvasHeight,
  backgroundUrl,
  backgroundAlt,
  area,
  rect,
  rotation,
  printUrl,
  outside,
  disabled,
  onGestureStart,
  onMove,
  onScale,
  onGestureEnd,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  const width = canvasWidth || 1;
  const height = canvasHeight || 1;
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  /** Перетаскивание. Смещение переводим в доли области, а не в пиксели экрана. */
  const startDrag = (event: React.PointerEvent) => {
    if (!rect || !area || disabled) return;
    event.preventDefault();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;

    onGestureStart();
    const startX = event.clientX;
    const startY = event.clientY;
    // Сколько пикселей подложки приходится на пиксель экрана.
    const perScreen = width / box.width;

    const move = (e: PointerEvent) => {
      onMove(
        ((e.clientX - startX) * perScreen) / area.width,
        ((e.clientY - startY) * perScreen) / area.height,
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onGestureEnd();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /**
   * Изменение размера за угол — всегда пропорциональное: считаем, во сколько
   * раз изменилось расстояние от центра принта до курсора. Так принт нельзя
   * случайно растянуть по одной оси, чего ТЗ обоих модулей не допускает.
   */
  const startResize = (event: React.PointerEvent) => {
    if (!rect || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;

    const centerX =
      box.left + ((rect.left + rect.width / 2) / width) * box.width;
    const centerY =
      box.top + ((rect.top + rect.height / 2) / height) * box.height;
    const startDistance = Math.hypot(
      event.clientX - centerX,
      event.clientY - centerY,
    );
    if (startDistance < 4) return;

    onGestureStart();
    const move = (e: PointerEvent) => {
      const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      onScale(distance / startDistance);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onGestureEnd();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Стрелками принт двигается точно: шаг 0.5 % области, с Shift — 2 %. */
  const nudge = (event: React.KeyboardEvent) => {
    if (!rect || disabled) return;
    const step = event.shiftKey ? 0.02 : 0.005;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    onGestureStart();
    onMove(delta[0], delta[1]);
    onGestureEnd();
  };

  return (
    <div
      ref={boxRef}
      className="relative mx-auto w-full max-w-[560px] select-none overflow-hidden rounded-xl bg-gray-100"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt={backgroundAlt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}

      {/* Допустимая область. Видна только во время редактирования — в
          итоговый файл рамка не попадает, её рисует не рендер, а холст. */}
      {area && (
        <div
          className={`pointer-events-none absolute border-2 border-dashed ${
            outside ? 'border-red-500/80' : 'border-white/70'
          }`}
          style={{
            left: pct(area.left, width),
            top: pct(area.top, height),
            width: pct(area.width, width),
            height: pct(area.height, height),
          }}
        />
      )}

      {rect && printUrl && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Принт: перетащите мышью, стрелками — точная подгонка"
          onPointerDown={startDrag}
          onKeyDown={nudge}
          className={`absolute ${disabled ? '' : 'cursor-move'} focus-visible:outline-none`}
          style={{
            left: pct(rect.left, width),
            top: pct(rect.top, height),
            width: pct(rect.width, width),
            height: pct(rect.height, height),
            transform: `rotate(${rotation}deg)`,
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
  );
}

const CORNERS = [
  { key: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { key: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { key: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
  { key: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
];
