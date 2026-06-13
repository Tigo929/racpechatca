import { useCallback, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { Reveal } from '../Reveal';
import { useOrderModal } from '../useOrderModal';
import { shirtColors } from '../../data/content';
import { TShirtCanvas, type TShirtCanvasHandle } from './TShirtCanvas';
import { DesignerToolbar } from './DesignerToolbar';
import type { DesignTransform } from './designerTypes';
import {
  PRINT_AREA,
  clamp,
  fitIntoPrintArea,
  loadImageFromFile,
  validateArtworkFile,
} from './designerUtils';

const CENTER: DesignTransform = {
  x: PRINT_AREA.x + PRINT_AREA.width / 2,
  y: PRINT_AREA.y + PRINT_AREA.height / 2,
  scale: 1,
  rotation: 0,
};

/**
 * Рабочий MVP-конструктор футболки на Konva: выбор цвета, загрузка макета,
 * drag/resize/rotate в области печати, экспорт превью PNG и отправка на расчёт.
 */
export function TShirtDesigner() {
  const { openModal } = useOrderModal();
  const canvasRef = useRef<TShirtCanvasHandle>(null);

  const [color, setColor] = useState(shirtColors[0]);
  const [artwork, setArtwork] = useState<HTMLImageElement | null>(null);
  const [artworkSize, setArtworkSize] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState<DesignTransform>(CENTER);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    const v = validateArtworkFile(file);
    if (!v.ok) {
      setError(v.error ?? 'Файл не подходит');
      return;
    }
    try {
      const img = await loadImageFromFile(file);
      const fit = fitIntoPrintArea(img.width, img.height);
      setArtwork(img);
      setArtworkSize({ width: fit.width, height: fit.height });
      setTransform({ ...CENTER });
    } catch {
      setError('Не удалось прочитать изображение');
    }
  }, []);

  const handleZoom = (delta: number) =>
    setTransform((t) => ({ ...t, scale: clamp(t.scale + delta, 0.2, 3) }));

  const handleRotate = () =>
    setTransform((t) => ({ ...t, rotation: (t.rotation + 45) % 360 }));

  const handleReset = () => setTransform({ ...CENTER });

  const handleDownload = () => {
    const url = canvasRef.current?.exportPng();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'futbolka-preview.png';
    a.click();
  };

  const handleSubmit = () => {
    const previewDataUrl = canvasRef.current?.exportPng() ?? '';
    openModal('Клиент собрал футболку в конструкторе. ', {
      previewDataUrl,
      shirtColor: color.hex,
      shirtColorName: color.name,
      transform: artwork ? transform : null,
      hasArtwork: !!artwork,
    });
  };

  return (
    <section id="designer" className="py-20 sm:py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* SEO-блок (canvas не индексируется) */}
        <Reveal>
          <div className="max-w-2xl mb-10">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <Palette className="w-4 h-4" /> Конструктор
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Онлайн-конструктор футболки с принтом
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Соберите макет прямо в браузере: выберите цвет футболки, загрузите своё
              изображение, разместите его на области печати, измените размер и поворот —
              и отправьте готовый дизайн на расчёт.
            </p>
            <h3 className="sr-only">Как работает конструктор футболки</h3>
          </div>
        </Reveal>

        <Reveal variant="scale">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8">
            {/* Холст */}
            <div className="flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl py-8 px-4 order-1">
              <TShirtCanvas
                ref={canvasRef}
                shirtColor={color.hex}
                artwork={artwork}
                artworkSize={artworkSize}
                transform={transform}
                onTransformChange={setTransform}
                showPrintArea
              />
              <p className="mt-4 text-xs text-slate-400 text-center max-w-xs">
                Перетаскивайте макет мышкой или пальцем, тяните за углы для размера и поворота.
              </p>
            </div>

            {/* Тулбар */}
            <div className="order-2">
              <DesignerToolbar
                colors={shirtColors}
                activeColor={color}
                onColor={setColor}
                onUpload={handleUpload}
                onZoom={handleZoom}
                onRotate={handleRotate}
                onReset={handleReset}
                onDownload={handleDownload}
                onSubmit={handleSubmit}
                hasArtwork={!!artwork}
                error={error}
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default TShirtDesigner;
