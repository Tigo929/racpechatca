import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Konva from 'konva';
import { Stage, Layer, Path, Rect, Group, Image as KonvaImage, Transformer, Text } from 'react-konva';
import type { DesignTransform } from './designerTypes';
import {
  BASE_W,
  BASE_H,
  SHIRT_PATH,
  COLLAR_PATH,
  PRINT_AREA,
  clamp,
} from './designerUtils';

export interface TShirtCanvasHandle {
  /** Экспорт превью футболки в PNG dataURL (без рамки печати). */
  exportPng: () => string;
}

interface Size {
  width: number;
  height: number;
}

interface TShirtCanvasProps {
  shirtColor: string;
  /** Тёмная футболка → светлая подложка под макет для контраста рамки */
  artwork: HTMLImageElement | null;
  /** Базовый размер макета (в координатах 240×260) после вписывания */
  artworkSize: Size | null;
  transform: DesignTransform;
  onTransformChange: (t: DesignTransform) => void;
  /** Скрывать рамку области печати на время экспорта */
  showPrintArea: boolean;
}

const MAX_STAGE_W = 460;

export const TShirtCanvas = forwardRef<TShirtCanvasHandle, TShirtCanvasProps>(
  function TShirtCanvas(
    { shirtColor, artwork, artworkSize, transform, onTransformChange, showPrintArea },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const imageRef = useRef<Konva.Image>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const printRectRef = useRef<Konva.Rect>(null);
    const [scale, setScale] = useState(1);

    // Адаптивный размер сцены под ширину контейнера
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        const w = Math.min(el.clientWidth, MAX_STAGE_W);
        setScale(w / BASE_W);
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Привязываем Transformer к макету
    useEffect(() => {
      const tr = trRef.current;
      if (!tr) return;
      if (artwork && imageRef.current) {
        tr.nodes([imageRef.current]);
      } else {
        tr.nodes([]);
      }
      tr.getLayer()?.batchDraw();
    }, [artwork, artworkSize]);

    // Экспорт PNG: прячем рамку, рендерим, возвращаем
    useImperativeHandle(ref, () => ({
      exportPng: () => {
        const stage = stageRef.current;
        if (!stage) return '';
        return stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
      },
    }));

    const aw = artworkSize?.width ?? 0;
    const ah = artworkSize?.height ?? 0;

    // Ограничение центра макета пределами области печати (в абсолютных координатах)
    const dragBound = (pos: { x: number; y: number }) => ({
      x: clamp(pos.x, PRINT_AREA.x * scale, (PRINT_AREA.x + PRINT_AREA.width) * scale),
      y: clamp(pos.y, PRINT_AREA.y * scale, (PRINT_AREA.y + PRINT_AREA.height) * scale),
    });

    const commit = () => {
      const node = imageRef.current;
      if (!node) return;
      onTransformChange({
        x: node.x(),
        y: node.y(),
        scale: node.scaleX(),
        rotation: node.rotation(),
      });
    };

    return (
      <div ref={containerRef} className="w-full max-w-[460px] mx-auto select-none">
        <Stage
          ref={stageRef}
          width={BASE_W * scale}
          height={BASE_H * scale}
          scaleX={scale}
          scaleY={scale}
          style={{ touchAction: 'none' }}
        >
          <Layer>
            {/* Тень-подложка */}
            <Path
              data={SHIRT_PATH}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 0, y: BASE_H }}
              fillLinearGradientColorStops={[0, lighten(shirtColor), 1, darken(shirtColor)]}
              stroke="rgba(15,23,42,0.15)"
              strokeWidth={1.5}
              shadowColor="#1E1B4B"
              shadowBlur={18}
              shadowOpacity={0.18}
              shadowOffsetY={8}
            />
            {/* Складки/тени для реалистичности */}
            <Path data={COLLAR_PATH} stroke="rgba(15,23,42,0.22)" strokeWidth={2} />
            <Path
              data="M70 96 Q60 150 70 220"
              stroke="rgba(15,23,42,0.08)"
              strokeWidth={6}
              lineCap="round"
            />
            <Path
              data="M170 96 Q180 150 170 220"
              stroke="rgba(15,23,42,0.08)"
              strokeWidth={6}
              lineCap="round"
            />
          </Layer>

          {/* Слой макета — обрезан по области печати */}
          <Layer>
            <Group
              clipX={PRINT_AREA.x}
              clipY={PRINT_AREA.y}
              clipWidth={PRINT_AREA.width}
              clipHeight={PRINT_AREA.height}
            >
              {artwork && artworkSize && (
                <KonvaImage
                  ref={imageRef}
                  image={artwork}
                  width={aw}
                  height={ah}
                  offsetX={aw / 2}
                  offsetY={ah / 2}
                  x={transform.x}
                  y={transform.y}
                  scaleX={transform.scale}
                  scaleY={transform.scale}
                  rotation={transform.rotation}
                  draggable
                  dragBoundFunc={dragBound}
                  onDragEnd={commit}
                  onTransformEnd={commit}
                />
              )}
            </Group>

            {/* Рамка области печати */}
            {showPrintArea && (
              <>
                <Rect
                  ref={printRectRef}
                  x={PRINT_AREA.x}
                  y={PRINT_AREA.y}
                  width={PRINT_AREA.width}
                  height={PRINT_AREA.height}
                  stroke={isDark(shirtColor) ? '#FBBF24' : '#D97706'}
                  strokeWidth={1}
                  dash={[5, 4]}
                  listening={false}
                />
                {!artwork && (
                  <Text
                    text="Область печати"
                    x={PRINT_AREA.x}
                    y={PRINT_AREA.y + PRINT_AREA.height / 2 - 6}
                    width={PRINT_AREA.width}
                    align="center"
                    fontSize={9}
                    fontFamily="Manrope, sans-serif"
                    fill={isDark(shirtColor) ? 'rgba(255,255,255,0.6)' : 'rgba(30,27,75,0.5)'}
                    listening={false}
                  />
                )}
              </>
            )}

            {artwork && (
              <Transformer
                ref={trRef}
                keepRatio
                rotateEnabled
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                anchorSize={9}
                anchorCornerRadius={4}
                borderStroke="#D97706"
                anchorStroke="#D97706"
                anchorFill="#FFFFFF"
                rotationSnaps={[0, 90, 180, 270]}
                boundBoxFunc={(oldBox, newBox) => {
                  // Не даём макету стать меньше 12px и больше двойной области печати
                  const maxW = PRINT_AREA.width * 2 * scale;
                  const maxH = PRINT_AREA.height * 2 * scale;
                  if (newBox.width < 12 || newBox.height < 12) return oldBox;
                  if (newBox.width > maxW || newBox.height > maxH) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
      </div>
    );
  },
);

// ─── Цветовые помощники для градиента футболки ──────────────────────
function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}
function toHex(v: number) {
  return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
}
function lighten(hex: string, amt = 18) {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r + amt)}${toHex(g + amt)}${toHex(b + amt)}`;
}
function darken(hex: string, amt = 22) {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r - amt)}${toHex(g - amt)}${toHex(b - amt)}`;
}
function isDark(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}
