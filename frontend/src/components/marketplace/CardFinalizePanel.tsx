import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, Package } from 'lucide-react';
import { ozonBatchesApi } from '../../api/ozonCards';
import { getErrorMessage } from '../../utils/get-error-message';
import type { ImageCardGenerated } from '../../types/index';

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';
const primary =
  'inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60';

/**
 * Что получится при финализации и кнопка её запуска.
 *
 * Показываем расклад заранее — сколько файлов, сколько чёрных и белых, что
 * ждёт проверки и что сломано. Человек должен видеть это до нажатия: сотню
 * файлов проще не создавать, чем потом разбирать.
 */
export function CardFinalizePanel({
  batchId,
  cards,
}: {
  batchId: string;
  cards: ImageCardGenerated[];
}) {
  const qc = useQueryClient();
  const [includeReview, setIncludeReview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const ready = cards.filter(
    (c) => c.previewFile && (c.status === 'GENERATED' || c.status === 'APPROVED'),
  );
  const review = cards.filter((c) => c.status === 'REVIEW_REQUIRED' && c.previewFile);
  const failed = cards.filter((c) => c.status === 'ERROR');
  const finalized = cards.filter((c) => c.status === 'FINALIZED');
  const pending = cards.filter((c) => c.status === 'APPROVED' && !c.finalFile);

  const planned = [...ready, ...(includeReview ? review : [])];
  const black = planned.filter((c) => c.shirtColor.toLowerCase() === 'black').length;
  const white = planned.filter((c) => c.shirtColor.toLowerCase() === 'white').length;

  const finalize = useMutation({
    mutationFn: () => ozonBatchesApi.finalize(batchId, includeReview),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['ozon-cards', batchId] });
      void qc.invalidateQueries({ queryKey: ['ozon-card-batch', batchId] });
      toast.success(`Собираем финальные файлы: ${result.queued}`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось запустить сборку')),
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await ozonBatchesApi.download(batchId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не удалось скачать архив'));
    } finally {
      setDownloading(false);
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Package size={16} className="text-amber-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Финальные файлы</h3>
      </div>

      <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">
          Будет создано: {planned.length} PNG
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Чёрных: {black} · Белых: {white}
          {review.length > 0 && ` · Требует проверки: ${review.length}`}
          {failed.length > 0 && ` · Ошибок: ${failed.length}`}
        </p>
        {finalized.length > 0 && (
          <p className="mt-1 text-xs text-emerald-700">
            Уже готово: {finalized.length}
          </p>
        )}
        {pending.length > 0 && (
          <p className="mt-1 text-xs text-indigo-700">
            Собирается: {pending.length}…
          </p>
        )}
      </div>

      {review.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeReview}
            onChange={(e) => setIncludeReview(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span>
            Включить карточки со статусом «требует проверки» ({review.length})
            <span className="block text-xs text-gray-500">
              Именно на них автоматика засомневалась — без этой галки они в
              готовое не уйдут.
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => finalize.mutate()}
          disabled={finalize.isPending || planned.length === 0}
          className={primary}
        >
          <Package size={15} aria-hidden="true" />
          {finalize.isPending ? 'Запускаем…' : 'Сгенерировать финальные PNG'}
        </button>
        <button
          onClick={() => void handleDownload()}
          disabled={downloading || finalized.length === 0}
          className={btn}
        >
          <Download size={14} aria-hidden="true" />
          {downloading ? 'Готовим архив…' : `Скачать архив (${finalized.length})`}
        </button>
      </div>

      <p className="text-[11px] text-gray-400">
        Каждый файл проверяется по требованиям Ozon: размер не меньше 900 × 1200,
        соотношение 3:4, PNG, до 10 МБ. Не прошедшая проверку карточка готовой не
        считается — в архив она не попадёт.
      </p>
    </div>
  );
}
