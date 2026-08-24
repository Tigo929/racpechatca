import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ruler, Shirt, Upload } from 'lucide-react';
import { mockupsApi } from '../../api/approvals';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { getErrorMessage } from '../../utils/get-error-message';
import { isCalibrated, mmToCm } from '../../utils/approval-geometry';
import { Modal } from '../ui/Modal';
import type { MockupTemplate } from '../../types/index';

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

/**
 * Мокапы согласования: фотографии изделий и калибровка зоны печати.
 *
 * Калибровка — это связь пикселей фотографии с сантиметрами на футболке.
 * Без неё «28 × 35 см» осталось бы подписью, никак не связанной с картинкой,
 * поэтому зона печати задаётся прямо на снимке: рамку двигают мышью, а её
 * реальный размер вводят рулеткой в сантиметрах.
 */
export function MockupTemplatesCard() {
  const [calibrating, setCalibrating] = useState<MockupTemplate | null>(null);
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['mockup-templates'],
    queryFn: mockupsApi.list,
  });

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Shirt size={16} className="text-amber-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">
          Мокапы согласования
        </h2>
      </div>
      <p className="text-xs text-gray-500">
        Реальные фотографии футболок, на которые ложится принт. Зона печати
        задаётся один раз на каждый снимок: рамка на фото плюс её настоящий
        размер в сантиметрах — по ним CRM понимает, каким показать принт.
      </p>

      {isLoading ? (
        <p className="text-xs text-gray-400">Загрузка…</p>
      ) : (
        <ul className="space-y-2">
          {templates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onCalibrate={() => setCalibrating(template)}
            />
          ))}
        </ul>
      )}

      {calibrating && (
        <CalibrationModal
          template={
            templates.find((t) => t.id === calibrating.id) ?? calibrating
          }
          onClose={() => setCalibrating(null)}
        />
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onCalibrate,
}: {
  template: MockupTemplate;
  onCalibrate: () => void;
}) {
  const qc = useQueryClient();
  const thumb = useBlobUrl(
    template.imageFile ? `${template.id}:${template.updatedAt}` : null,
    () => mockupsApi.fetchImage(template.id),
  );

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mockupsApi.uploadImage(template.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mockup-templates'] });
      toast.success('Фотография загружена');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось загрузить фотографию')),
  });

  const ready = isCalibrated(template);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3">
      <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-100">
        {thumb ? (
          <img
            src={thumb}
            alt={template.title}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {template.title}
        </p>
        <p className="text-xs text-gray-500">
          {template.imageFile
            ? `${template.imageWidth} × ${template.imageHeight} px · зона ${mmToCm(template.printAreaWidthMm)} × ${mmToCm(template.printAreaHeightMm)} см`
            : 'фотография не загружена'}
        </p>
        {!ready && (
          <p className="text-xs text-amber-700">
            Шаблон не готов — в редакторе им пользоваться нельзя.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className={`${btn} cursor-pointer`}>
          <Upload size={14} aria-hidden="true" />
          {template.imageFile ? 'Заменить фото' : 'Загрузить фото'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploadMutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
        <button
          onClick={onCalibrate}
          disabled={!template.imageFile}
          className={btn}
        >
          <Ruler size={14} aria-hidden="true" />
          Зона печати
        </button>
      </div>
    </li>
  );
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
  widthMm: number;
  heightMm: number;
}

function areaOf(template: MockupTemplate): Area {
  return {
    x: template.printAreaX,
    y: template.printAreaY,
    width: template.printAreaWidth,
    height: template.printAreaHeight,
    widthMm: template.printAreaWidthMm,
    heightMm: template.printAreaHeightMm,
  };
}

function CalibrationModal({
  template,
  onClose,
}: {
  template: MockupTemplate;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const photo = useBlobUrl(`${template.id}:${template.updatedAt}`, () =>
    mockupsApi.fetchImage(template.id),
  );

  const imageW = template.imageWidth ?? 1;
  const imageH = template.imageHeight ?? 1;

  const [area, setArea] = useState<Area>(() => areaOf(template));
  // Шаблон обновляется, когда рядом заменили фотографию. Подстраиваем рамку
  // прямо в рендере — эффект добавил бы лишний проход с прежними числами.
  const [shownId, setShownId] = useState(template.updatedAt);
  if (shownId !== template.updatedAt) {
    setShownId(template.updatedAt);
    setArea(areaOf(template));
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      mockupsApi.update(template.id, {
        printAreaX: Math.round(area.x),
        printAreaY: Math.round(area.y),
        printAreaWidth: Math.round(area.width),
        printAreaHeight: Math.round(area.height),
        printAreaWidthMm: Math.round(area.widthMm),
        printAreaHeightMm: Math.round(area.heightMm),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mockup-templates'] });
      toast.success('Зона печати сохранена');
      onClose();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось сохранить зону печати')),
  });

  /** Общий обработчик жеста: перемещение рамки или её растягивание за угол. */
  const gesture = (event: React.PointerEvent, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const photoPerScreen = imageW / box.width;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...area };

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) * photoPerScreen;
      const dy = (e.clientY - startY) * photoPerScreen;
      if (mode === 'move') {
        setArea({
          ...origin,
          x: clamp(origin.x + dx, 0, imageW - origin.width),
          y: clamp(origin.y + dy, 0, imageH - origin.height),
        });
      } else {
        setArea({
          ...origin,
          width: clamp(origin.width + dx, 20, imageW - origin.x),
          height: clamp(origin.height + dy, 20, imageH - origin.y),
        });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <Modal open onClose={onClose} title={`Зона печати · ${template.title}`} size="xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div
          ref={boxRef}
          className="relative mx-auto w-full max-w-[420px] select-none overflow-hidden rounded-xl bg-gray-100"
          style={{ aspectRatio: `${imageW} / ${imageH}` }}
        >
          {photo && (
            <img
              src={photo}
              alt={template.title}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            onPointerDown={(e) => gesture(e, 'move')}
            className="absolute cursor-move border-2 border-dashed border-amber-400 bg-amber-400/10"
            style={{
              left: pct(area.x, imageW),
              top: pct(area.y, imageH),
              width: pct(area.width, imageW),
              height: pct(area.height, imageH),
            }}
          >
            <span
              onPointerDown={(e) => gesture(e, 'resize')}
              aria-hidden="true"
              className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-amber-500 shadow"
            />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Растяните рамку по допустимой области печати на футболке, затем
            измерьте эту область рулеткой на настоящем изделии и впишите её
            размер. Из этой пары CRM и берёт масштаб.
          </p>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Ширина зоны, см
            </span>
            <input
              type="number"
              min={1}
              className={`mt-1 ${field}`}
              value={mmToCm(area.widthMm)}
              onChange={(e) =>
                setArea({
                  ...area,
                  widthMm: Math.max(10, Math.round(Number(e.target.value) * 10)),
                })
              }
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Высота зоны, см
            </span>
            <input
              type="number"
              min={1}
              className={`mt-1 ${field}`}
              value={mmToCm(area.heightMm)}
              onChange={(e) =>
                setArea({
                  ...area,
                  heightMm: Math.max(10, Math.round(Number(e.target.value) * 10)),
                })
              }
            />
          </label>

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Рамка: {Math.round(area.width)} × {Math.round(area.height)} px
            <br />
            Масштаб:{' '}
            {area.widthMm > 0
              ? `${((area.width / area.widthMm) * 10).toFixed(1)} px на см`
              : '—'}
          </p>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить зону печати'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
