import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { ozonBatchesApi, ozonCardsApi } from '../../api/ozonCards';
import { CardPreviewGrid } from './CardPreviewGrid';
import { CardBatchReport } from './CardBatchReport';
import { getErrorMessage } from '../../utils/get-error-message';
import type {
  CardMode,
  ImageCardBatch,
  ImageCardSource,
} from '../../types/index';

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';
const primary =
  'inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60';

const MODE_LABELS: Record<CardMode, string> = {
  BLACK: 'Только чёрная',
  WHITE: 'Только белая',
  BOTH: 'Чёрная + белая',
};

const SOURCE_STATUS: Record<
  ImageCardSource['status'],
  { label: string; className: string }
> = {
  PENDING: { label: 'Ожидает', className: 'bg-gray-100 text-gray-600' },
  PROCESSING: { label: 'Обрабатывается', className: 'bg-indigo-50 text-indigo-700' },
  READY: { label: 'Готово', className: 'bg-emerald-50 text-emerald-700' },
  ERROR: { label: 'Ошибка', className: 'bg-red-50 text-red-700' },
};

/**
 * Генератор карточек: список пачек и работа с одной пачкой.
 *
 * Загрузка исходников, их подготовка и запуск автоматической сборки.
 * Сетка проверки с фильтрами, ручной редактор и финальный рендер идут
 * следующими этапами.
 */
export function CardGeneratorTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  return openId ? (
    <BatchView id={openId} onBack={() => setOpenId(null)} />
  ) : (
    <BatchList onOpen={setOpenId} />
  );
}

function BatchList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['ozon-card-batches'],
    queryFn: ozonBatchesApi.list,
  });

  const create = useMutation({
    mutationFn: () => ozonBatchesApi.create({ mode: 'BOTH' }),
    onSuccess: (batch) => {
      void qc.invalidateQueries({ queryKey: ['ozon-card-batches'] });
      onOpen(batch.id);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось создать пачку')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => ozonBatchesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ozon-card-batches'] });
      toast.success('Пачка удалена');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось удалить пачку')),
  });

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Генерации</h2>
          <p className="mt-1 text-xs text-gray-500">
            Загрузите макеты принтов пачкой — CRM подготовит их и соберёт
            главные фото карточек по шаблонам.
          </p>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className={primary}
        >
          <Plus size={15} aria-hidden="true" />
          Новая генерация
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Загрузка…</p>
      ) : batches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
          Генераций пока не было.
        </p>
      ) : (
        <ul className="space-y-2">
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3"
            >
              <button
                onClick={() => onOpen(batch.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-gray-900">
                  {batch.title}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(batch.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  исходников: {batch._count?.sources ?? 0}
                  {batch.createdBy ? ` · ${batch.createdBy.username}` : ''}
                </p>
              </button>
              <button onClick={() => onOpen(batch.id)} className={btn}>
                Открыть
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Удалить «${batch.title}» вместе с файлами?`)) {
                    remove.mutate(batch.id);
                  }
                }}
                aria-label={`Удалить ${batch.title}`}
                className={`${btn} text-red-600 hover:bg-red-50`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BatchView({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(
    null,
  );

  const { data: caps } = useQuery({
    queryKey: ['ozon-card-capabilities'],
    queryFn: ozonBatchesApi.capabilities,
    staleTime: 5 * 60_000,
  });

  const { data: batch, isLoading } = useQuery({
    queryKey: ['ozon-card-batch', id],
    queryFn: () => ozonBatchesApi.get(id),
    // Пока в очереди что-то есть, состояние подтягиваем сами: обработка идёт
    // фоном на сервере, и человек не должен жать «обновить».
    refetchInterval: (query) =>
      (query.state.data?.progress?.pending ?? 0) > 0 ? 2000 : false,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['ozon-card-templates'],
    queryFn: ozonCardsApi.listTemplates,
    staleTime: 60_000,
  });

  const settings = batch?.settings ?? {};
  const mode: CardMode = settings.mode ?? 'BOTH';

  const saveSettings = useMutation({
    mutationFn: (patch: Parameters<typeof ozonBatchesApi.update>[1]) =>
      ozonBatchesApi.update(id, patch),
    onSuccess: (updated) => qc.setQueryData(['ozon-card-batch', id], (prev: ImageCardBatch | undefined) =>
      prev ? { ...prev, ...updated } : prev,
    ),
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить настройки')),
  });

  /**
   * Файлы уходят по одному и последовательно: nginx пропускает 30 МБ на
   * запрос, а полсотни макетов в него не влезут. Один упавший файл не
   * прерывает остальные — про него говорим отдельно.
   */
  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading({ done: 0, total: files.length });
      const failed: string[] = [];
      for (const [index, file] of files.entries()) {
        try {
          await ozonBatchesApi.addSource(id, file);
        } catch (error) {
          failed.push(`${file.name}: ${getErrorMessage(error, 'ошибка')}`);
        }
        setUploading({ done: index + 1, total: files.length });
      }
      setUploading(null);
      void qc.invalidateQueries({ queryKey: ['ozon-card-batch', id] });
      if (failed.length > 0) {
        toast.error(`Не загрузилось файлов: ${failed.length}\n${failed[0]}`);
      } else {
        toast.success(`Загружено файлов: ${files.length}`);
      }
    },
    [id, qc],
  );

  const generate = useMutation({
    mutationFn: () => ozonBatchesApi.generate(id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['ozon-cards', id] });
      void qc.invalidateQueries({ queryKey: ['ozon-card-batch', id] });
      toast.success(
        result.created > 0
          ? `Поставлено в работу карточек: ${result.created}`
          : 'Все карточки по этим файлам уже собраны',
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось запустить генерацию')),
  });

  const retry = useMutation({
    mutationFn: (sourceId: string) => ozonBatchesApi.retrySource(sourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ozon-card-batch', id] }),
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось повторить')),
  });

  const removeSource = useMutation({
    mutationFn: (sourceId: string) => ozonBatchesApi.removeSource(sourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ozon-card-batch', id] }),
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось убрать файл')),
  });

  if (isLoading || !batch) {
    return <p className="text-xs text-gray-400">Загрузка…</p>;
  }

  const sources = batch.sources ?? [];
  const progress = batch.progress ?? { total: 0, ready: 0, failed: 0, pending: 0, done: 0 };
  const readyTemplates = templates.filter(
    (t) => t.active && t.templateFile && (t.placementArea?.width ?? 0) > 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={btn}>
          <ArrowLeft size={14} aria-hidden="true" />
          К списку
        </button>
        <h2 className="truncate text-sm font-semibold text-gray-900">{batch.title}</h2>
      </div>

      {/* Настройки захода */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Режим
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MODE_LABELS) as CardMode[]).map((value) => (
              <button
                key={value}
                onClick={() => saveSettings.mutate({ mode: value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === value
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {MODE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.removeWhiteBackground ?? false}
            onChange={(e) =>
              saveSettings.mutate({ removeWhiteBackground: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          Удалять белый фон
          <span className="text-xs text-gray-400">
            включено по умолчанию; снимите, если в дизайне есть белые детали —
            их чистка тоже съест
          </span>
        </label>

        {readyTemplates.length > 0 && (
          <div className="flex flex-wrap items-start gap-3">
            <span className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Шаблоны
            </span>
            <div className="flex flex-wrap gap-1.5">
              {readyTemplates.map((template) => {
                const chosen = settings.templateIds ?? [];
                const on = chosen.length === 0 || chosen.includes(template.id);
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      // Пусто = «брать активные по цвету». Первое же снятие
                      // превращает это в явный список, иначе выключить один
                      // шаблон из двух было бы нечем.
                      const base = chosen.length > 0 ? chosen : readyTemplates.map((t) => t.id);
                      const next = base.includes(template.id)
                        ? base.filter((id) => id !== template.id)
                        : [...base, template.id];
                      saveSettings.mutate({ templateIds: next });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      on
                        ? 'bg-indigo-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    title={`${template.shirtColor} · v${template.version}`}
                  >
                    {template.title}
                  </button>
                );
              })}
            </div>
            <p className="w-full text-xs text-gray-500">
              Отметьте, каким шаблоном собирать эту пачку. Можно завести
              несколько вариантов на вкладке «Шаблоны» и сравнить их, не
              переключая «активен».
            </p>
          </div>
        )}

        {readyTemplates.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Нет ни одного готового шаблона. Заведите их на вкладке «Шаблоны»:
            загрузите картинку и задайте область принта — иначе собирать карточки
            будет не из чего.
          </p>
        )}
      </div>

      {/* Загрузка */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'
        }`}
      >
        <Upload size={22} className="mx-auto text-gray-400" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-gray-800">
          Перетащите макеты сюда
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {caps?.pdf === false
            ? 'PNG, JPEG, WEBP. PDF на этом сервере не обрабатывается — не установлен Poppler.'
            : 'PDF, PNG, JPEG, WEBP · до 30 МБ каждый'}
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading !== null}
          className={`${btn} mt-3`}
        >
          Выбрать файлы
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={caps?.pdf === false ? 'image/*' : 'application/pdf,image/*'}
          className="hidden"
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        {uploading && (
          <p className="mt-3 text-xs text-gray-600">
            Загрузка {uploading.done} из {uploading.total}…
          </p>
        )}
      </div>

      {/* Список исходников */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Исходники: {progress.total}
          </h3>
          {progress.total > 0 && (
            <p className="text-xs text-gray-500">
              Обработано {progress.done} из {progress.total}
              {progress.failed > 0 && ` · ошибок: ${progress.failed}`}
            </p>
          )}
        </div>

        {progress.pending > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        )}

        {sources.length === 0 ? (
          <p className="text-xs text-gray-500">Файлов пока нет.</p>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                onRetry={() => retry.mutate(source.id)}
                onRemove={() => removeSource.mutate(source.id)}
              />
            ))}
          </ul>
        )}

        {progress.ready > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">
              Будет собрано карточек: {progress.ready * (mode === 'BOTH' ? 2 : 1)}
              {progress.pending > 0 && ' (плюс те, что ещё обрабатываются)'}
            </p>
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending || readyTemplates.length === 0}
              className={primary}
            >
              <Wand2 size={15} aria-hidden="true" />
              {generate.isPending ? 'Запускаем…' : 'Сгенерировать'}
            </button>
          </div>
        )}
      </div>

      {batch.report && (
        <CardBatchReport
          report={batch.report}
          sources={sources}
          onRetrySource={(sourceId) => retry.mutate(sourceId)}
          onRemoveSource={(sourceId) => removeSource.mutate(sourceId)}
        />
      )}

      <CardPreviewGrid batchId={id} />
    </div>
  );
}

function SourceRow({
  source,
  onRetry,
  onRemove,
}: {
  source: ImageCardSource;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const status = SOURCE_STATUS[source.status];
  return (
    <li className="flex flex-wrap items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2">
      {source.status === 'PROCESSING' ? (
        <Loader2 size={14} className="animate-spin text-indigo-500" aria-hidden="true" />
      ) : source.status === 'READY' ? (
        <CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" />
      ) : source.status === 'ERROR' ? (
        <AlertTriangle size={14} className="text-red-600" aria-hidden="true" />
      ) : (
        <FileText size={14} className="text-gray-400" aria-hidden="true" />
      )}

      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
        {source.originalName}
        <span className="ml-2 text-xs text-gray-400">{source.baseName}</span>
      </span>

      {source.status === 'READY' && source.widthPx > 0 && (
        <span className="text-xs text-gray-500">
          {source.widthPx} × {source.heightPx} px
          {source.hasAlpha && ' · с прозрачностью'}
        </span>
      )}

      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
        {status.label}
      </span>

      {source.errorMessage && (
        <span className="w-full text-xs text-red-700">{source.errorMessage}</span>
      )}

      <span className="flex items-center gap-1.5">
        {source.status === 'ERROR' && (
          <button onClick={onRetry} className={btn} title="Повторить обработку">
            <RotateCcw size={13} aria-hidden="true" />
          </button>
        )}
        <button
          onClick={onRemove}
          aria-label={`Убрать ${source.originalName}`}
          className={`${btn} text-red-600 hover:bg-red-50`}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
