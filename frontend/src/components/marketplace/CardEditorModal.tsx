import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Crosshair, Maximize2, RotateCcw } from 'lucide-react';
import { ozonBatchesApi } from '../../api/ozonCards';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { getErrorMessage } from '../../utils/get-error-message';
import { Modal } from '../ui/Modal';
import { TransformStage } from '../shared/TransformStage';
import {
  cardPlacementRect,
  clampScale,
  containFit,
  DEFAULT_CARD_TRANSFORM,
  isCardOutside,
  MAX_SCALE,
  MIN_SCALE,
  readCardSnapshot,
  readCardTransform,
} from '../../utils/ozon-card-placement';
import type { CardTransform, ImageCardGenerated } from '../../types/index';

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

/**
 * Ручной редактор карточки.
 *
 * Повторяет ту же математику, что и серверный рендер: дизайн вписывается в
 * область целиком с сохранением пропорций, а масштаб — доля от этого
 * вписанного размера. Если формулы разойдутся, человек будет двигать одно, а
 * получать другое.
 */
export function CardEditorModal({
  card,
  batchId,
  onClose,
}: {
  card: ImageCardGenerated;
  batchId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const snapshot = readCardSnapshot(card);

  const [transform, setTransform] = useState<CardTransform>(() =>
    readCardTransform(card),
  );
  const [removeWhite, setRemoveWhite] = useState(card.removeWhiteBackground);
  const start = useRef<CardTransform | null>(null);

  const templateUrl = useBlobUrl(`tpl:${card.id}`, () =>
    ozonBatchesApi.fetchCardTemplate(card.id),
  );
  const designUrl = useBlobUrl(`raster:${card.sourceId}`, () =>
    ozonBatchesApi.fetchRaster(card.sourceId),
  );

  const save = useMutation({
    mutationFn: (approve: boolean) =>
      ozonBatchesApi.updateCard(card.id, {
        transform,
        removeWhiteBackground: removeWhite,
        ...(approve ? { status: 'APPROVED' as const } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ozon-cards', batchId] });
      toast.success('Сохранено — карточка пересобирается');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить')),
  });

  if (!snapshot || snapshot.placementArea.width <= 0) {
    return (
      <Modal open onClose={onClose} title="Редактор карточки" size="md">
        <p className="text-sm text-gray-600">
          У карточки нет пригодного снимка шаблона — редактировать нечего.
          Пересоберите её кнопкой возврата к автоматическому размещению.
        </p>
      </Modal>
    );
  }

  const area = snapshot.placementArea;
  const design = {
    width: card.source.widthPx ?? 0,
    height: card.source.heightPx ?? 0,
  };
  const fit = containFit(design, area);
  const rect = cardPlacementRect(design, area, transform);
  const outside = isCardOutside(rect, area);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Карточка · ${card.source.baseName} · ${card.shirtColor}`}
      size="xl"
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <TransformStage
          canvasWidth={snapshot.canvasWidth}
          canvasHeight={snapshot.canvasHeight}
          backgroundUrl={templateUrl}
          backgroundAlt="Шаблон карточки"
          area={{ left: area.x, top: area.y, width: area.width, height: area.height }}
          rect={fit.width > 0 ? rect : null}
          rotation={transform.rotation}
          printUrl={designUrl}
          outside={outside}
          onGestureStart={() => {
            start.current = transform;
          }}
          onMove={(dx, dy) => {
            const from = start.current;
            if (!from) return;
            setTransform({ ...from, x: from.x + dx, y: from.y + dy });
          }}
          onScale={(factor) => {
            const from = start.current;
            if (!from) return;
            setTransform({
              ...from,
              scale: clampScale(from.scale * factor),
            });
          }}
          onGestureEnd={() => {
            start.current = null;
          }}
        />

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Масштаб</span>
              <span className="text-sm tabular-nums text-gray-500">
                {Math.round(transform.scale * 100)} %
              </span>
            </div>
            <input
              type="range"
              min={MIN_SCALE * 100}
              max={MAX_SCALE * 100}
              step={1}
              value={Math.round(transform.scale * 100)}
              onChange={(e) =>
                setTransform({ ...transform, scale: Number(e.target.value) / 100 })
              }
              className="w-full accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Поворот</span>
              <span className="text-sm tabular-nums text-gray-500">
                {transform.rotation}°
              </span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={transform.rotation}
              onChange={(e) =>
                setTransform({ ...transform, rotation: Number(e.target.value) })
              }
              className="w-full accent-amber-500"
            />
            <div className="flex gap-2">
              {[-90, 0, 90].map((deg) => (
                <button
                  key={deg}
                  onClick={() => setTransform({ ...transform, rotation: deg })}
                  className={`${btn} flex-1 justify-center`}
                >
                  {deg === 0 ? '0°' : `${deg}°`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTransform({ ...transform, x: 0.5, y: 0.5 })}
              className={btn}
            >
              <Crosshair size={14} aria-hidden="true" />
              Центрировать
            </button>
            <button
              onClick={() => setTransform({ ...transform, x: 0.5, y: 0.5, scale: 1 })}
              title="Занять область целиком по узкой стороне"
              className={btn}
            >
              <Maximize2 size={14} aria-hidden="true" />
              Вписать
            </button>
            <button
              onClick={() => setTransform({ ...DEFAULT_CARD_TRANSFORM })}
              className={btn}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Сбросить
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={removeWhite}
              onChange={(e) => setRemoveWhite(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Удалять белый фон
          </label>

          {outside && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Принт выходит за область размещения. Это разрешено, но на карточке
              он может залезть на инфографику.
            </p>
          )}

          <p className="text-[11px] text-gray-400">
            Здесь показан тот же расчёт, что и в итоговом файле. Сама картинка
            собирается на сервере — после сохранения превью пересоберётся.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => save.mutate(false)}
              disabled={save.isPending}
              className={`${btn} flex-1 justify-center`}
            >
              Сохранить
            </button>
            <button
              onClick={() => save.mutate(true)}
              disabled={save.isPending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              <Check size={15} aria-hidden="true" />
              Сохранить и одобрить
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
