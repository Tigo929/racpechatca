import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Crop, Plus, Trash2, Upload } from 'lucide-react';
import { ozonCardsApi } from '../../api/ozonCards';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { getErrorMessage } from '../../utils/get-error-message';
import { Modal } from '../ui/Modal';
import type { CardRect, ImageCardTemplate } from '../../types/index';

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

/** Готов ли шаблон к работе: есть картинка и задана область размещения. */
function isReady(t: ImageCardTemplate): boolean {
  return Boolean(
    t.templateFile &&
      (t.placementArea?.width ?? 0) > 0 &&
      (t.placementArea?.height ?? 0) > 0,
  );
}

function rectOf(t: ImageCardTemplate): CardRect {
  return {
    x: t.placementArea?.x ?? 0,
    y: t.placementArea?.y ?? 0,
    width: t.placementArea?.width ?? 0,
    height: t.placementArea?.height ?? 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Шаблоны карточек Ozon: картинка готовой композиции и область, в которую
 * ложится принт.
 *
 * Область задаётся мышью прямо на шаблоне — вводить координаты в пикселях
 * руками означало бы попадать наугад. У чёрной и белой футболки композиция
 * может не совпадать, поэтому область своя у каждого шаблона.
 */
export function CardTemplatesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ImageCardTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['ozon-card-templates'],
    queryFn: ozonCardsApi.listTemplates,
  });

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Шаблоны карточек</h2>
            <p className="mt-1 text-xs text-gray-500">
              Готовая композиция с футболкой, фоном и инфографикой. Генератор
              ничего поверх не рисует — только вставляет принт в отмеченную
              область.
            </p>
          </div>
          <button onClick={() => setCreating(true)} className={btn}>
            <Plus size={14} aria-hidden="true" />
            Новый шаблон
          </button>
        </div>

        {isLoading ? (
          <p className="text-xs text-gray-400">Загрузка…</p>
        ) : templates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
            Шаблонов пока нет. Заведите два — под чёрную и белую футболку — и
            загрузите в каждый картинку.
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onEditArea={() => setEditing(template)}
              />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ['ozon-card-templates'] });
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <PlacementModal
          template={templates.find((t) => t.id === editing.id) ?? editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onEditArea,
}: {
  template: ImageCardTemplate;
  onEditArea: () => void;
}) {
  const qc = useQueryClient();
  const thumb = useBlobUrl(
    template.templateFile ? `${template.id}:${template.version}` : null,
    () => ozonCardsApi.fetchTemplateImage(template.id),
  );

  const upload = useMutation({
    mutationFn: (file: File) => ozonCardsApi.uploadTemplateImage(template.id, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ozon-card-templates'] });
      toast.success('Шаблон загружен');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось загрузить шаблон')),
  });

  const toggle = useMutation({
    mutationFn: (active: boolean) =>
      ozonCardsApi.updateTemplate(template.id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ozon-card-templates'] }),
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  const remove = useMutation({
    mutationFn: () => ozonCardsApi.removeTemplate(template.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ozon-card-templates'] });
      toast.success('Шаблон удалён');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось удалить шаблон')),
  });

  const area = rectOf(template);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
      <div
        className="h-20 flex-shrink-0 overflow-hidden rounded bg-gray-100"
        style={{ width: 60 }}
      >
        {thumb && (
          <img src={thumb} alt={template.title} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {template.title}
          <span className="ml-2 text-xs font-normal text-gray-400">
            {template.shirtColor} · v{template.version}
          </span>
        </p>
        <p className="text-xs text-gray-500">
          {template.templateFile
            ? `${template.canvasWidth} × ${template.canvasHeight} px · область ${area.width} × ${area.height} px`
            : 'картинка не загружена'}
        </p>
        {!isReady(template) && (
          <p className="text-xs text-amber-700">
            Шаблон не готов — в генерации он не участвует.
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={template.active}
          onChange={(e) => toggle.mutate(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        активен
      </label>
      <div className="flex items-center gap-2">
        <label className={`${btn} cursor-pointer`}>
          <Upload size={14} aria-hidden="true" />
          {template.templateFile ? 'Заменить' : 'Загрузить'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = '';
            }}
          />
        </label>
        <button onClick={onEditArea} disabled={!template.templateFile} className={btn}>
          <Crop size={14} aria-hidden="true" />
          Область принта
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Удалить шаблон «${template.title}»?`)) remove.mutate();
          }}
          aria-label={`Удалить шаблон ${template.title}`}
          className={`${btn} text-red-600 hover:bg-red-50`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('black');

  const create = useMutation({
    mutationFn: () =>
      ozonCardsApi.createTemplate({ title: title.trim(), shirtColor: color }),
    onSuccess: () => {
      toast.success('Шаблон создан — загрузите картинку');
      onCreated();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось создать шаблон')),
  });

  return (
    <Modal open onClose={onClose} title="Новый шаблон карточки" size="md">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Название</span>
          <input
            className={`mt-1 ${field}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Чёрная футболка — основной"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Цвет изделия</span>
          <select
            className={`mt-1 ${field}`}
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            <option value="black">black — чёрная</option>
            <option value="white">white — белая</option>
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            Ключом, а не подписью: по нему генератор выбирает шаблон под режим
            «чёрная / белая / обе».
          </span>
        </label>
        <button
          onClick={() => create.mutate()}
          disabled={title.trim().length < 2 || create.isPending}
          className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
        >
          {create.isPending ? 'Создаём…' : 'Создать'}
        </button>
      </div>
    </Modal>
  );
}

/** Область размещения принта — рамка прямо на шаблоне. */
function PlacementModal({
  template,
  onClose,
}: {
  template: ImageCardTemplate;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const image = useBlobUrl(`${template.id}:${template.version}`, () =>
    ozonCardsApi.fetchTemplateImage(template.id),
  );

  const canvasW = template.canvasWidth || 1;
  const canvasH = template.canvasHeight || 1;
  const [area, setArea] = useState<CardRect>(() => rectOf(template));

  const save = useMutation({
    mutationFn: () =>
      ozonCardsApi.updateTemplate(template.id, {
        placementArea: {
          x: Math.round(area.x),
          y: Math.round(area.y),
          width: Math.round(area.width),
          height: Math.round(area.height),
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ozon-card-templates'] });
      toast.success('Область сохранена');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить область')),
  });

  const gesture = (event: React.PointerEvent, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const perScreen = canvasW / box.width;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...area };

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) * perScreen;
      const dy = (e.clientY - startY) * perScreen;
      if (mode === 'move') {
        setArea({
          ...origin,
          x: clamp(origin.x + dx, 0, canvasW - origin.width),
          y: clamp(origin.y + dy, 0, canvasH - origin.height),
        });
      } else {
        setArea({
          ...origin,
          width: clamp(origin.width + dx, 20, canvasW - origin.x),
          height: clamp(origin.height + dy, 20, canvasH - origin.y),
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

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <Modal open onClose={onClose} title={`Область принта · ${template.title}`} size="xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div
          ref={boxRef}
          className="relative mx-auto w-full max-w-[420px] select-none overflow-hidden rounded-xl bg-gray-100"
          style={{ aspectRatio: `${canvasW} / ${canvasH}` }}
        >
          {image && (
            <img
              src={image}
              alt={template.title}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            onPointerDown={(e) => gesture(e, 'move')}
            className="absolute cursor-move border-2 border-dashed border-amber-400 bg-amber-400/10"
            style={{
              left: pct(area.x, canvasW),
              top: pct(area.y, canvasH),
              width: pct(area.width, canvasW),
              height: pct(area.height, canvasH),
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
            Растяните рамку по месту, куда должен ложиться принт. Дизайн
            вписывается в неё целиком, с сохранением пропорций и без обрезки.
          </p>
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Область: {Math.round(area.width)} × {Math.round(area.height)} px
            <br />
            Отступ: {Math.round(area.x)} слева, {Math.round(area.y)} сверху
            <br />
            Пропорция: {(area.width / Math.max(1, area.height)).toFixed(2)}
          </p>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || area.width < 20 || area.height < 20}
            className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            {save.isPending ? 'Сохраняем…' : 'Сохранить область'}
          </button>
          <p className="text-[11px] text-gray-400">
            Сохранение поднимает версию шаблона. Карточки, собранные раньше,
            останутся такими, какими их собирали.
          </p>
        </div>
      </div>
    </Modal>
  );
}
