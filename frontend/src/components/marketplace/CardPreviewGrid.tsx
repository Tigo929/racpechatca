import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  Pencil,
  RotateCcw,
  Search,
  SkipForward,
} from 'lucide-react';
import { ozonBatchesApi } from '../../api/ozonCards';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { getErrorMessage } from '../../utils/get-error-message';
import { FilterChip } from '../ui/FilterChip';
import { CardEditorModal } from './CardEditorModal';
import { CardFinalizePanel } from './CardFinalizePanel';
import type {
  EnumGeneratedCardStatus,
  ImageCardGenerated,
} from '../../types/index';

const STATUS: Record<
  EnumGeneratedCardStatus,
  { label: string; className: string }
> = {
  GENERATED: { label: 'Сгенерировано', className: 'bg-gray-100 text-gray-600' },
  REVIEW_REQUIRED: { label: 'Требует проверки', className: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Одобрено', className: 'bg-indigo-50 text-indigo-700' },
  FINALIZED: { label: 'Готово', className: 'bg-emerald-50 text-emerald-700' },
  ERROR: { label: 'Ошибка', className: 'bg-red-50 text-red-700' },
  SKIPPED: { label: 'Пропущено', className: 'bg-gray-100 text-gray-400' },
};

type Filter =
  | 'ALL'
  | 'BLACK'
  | 'WHITE'
  | 'READY'
  | 'REVIEW_REQUIRED'
  | 'ERROR';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Все' },
  { key: 'BLACK', label: 'Чёрные' },
  { key: 'WHITE', label: 'Белые' },
  { key: 'READY', label: 'Готово' },
  { key: 'REVIEW_REQUIRED', label: 'Требует проверки' },
  { key: 'ERROR', label: 'Ошибка' },
];

const btn =
  'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

function matches(card: ImageCardGenerated, filter: Filter): boolean {
  switch (filter) {
    case 'BLACK':
      return card.shirtColor.toLowerCase() === 'black';
    case 'WHITE':
      return card.shirtColor.toLowerCase() === 'white';
    case 'READY':
      // «Готово» с точки зрения человека — то, что уже не требует внимания.
      return card.status === 'GENERATED' || card.status === 'APPROVED' || card.status === 'FINALIZED';
    case 'REVIEW_REQUIRED':
      return card.status === 'REVIEW_REQUIRED';
    case 'ERROR':
      return card.status === 'ERROR';
    default:
      return true;
  }
}

/**
 * Сетка собранных карточек: посмотреть результат, одобрить нормальные,
 * вернуть к автоматическому размещению неудачные, пропустить лишние.
 *
 * Смысл раздела в том, чтобы сотня карточек не разбиралась поштучно: фильтр
 * «требует проверки» сразу оставляет те несколько, где автоматика
 * засомневалась.
 */
export function CardPreviewGrid({ batchId }: { batchId: string }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ImageCardGenerated | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['ozon-cards', batchId],
    queryFn: () => ozonBatchesApi.listCards(batchId),
    // Превью считаются фоном: пока не у всех карточек они есть, обновляемся.
    /*
     * Опрашиваем сервер, пока в пачке есть незавершённая карточка.
     *
     * Раньше условие смотрело только на отсутствие превью — и это была
     * ошибка, из-за которой всё выглядело бесконечно медленным. К моменту
     * нажатия «Сгенерировать финальные PNG» превью есть у всех карточек,
     * условие становилось ложным, опрос выключался совсем, и экран
     * навсегда застывал на «Собирается», хотя файл на сервере собирался
     * за десятые доли секунды.
     */
    refetchInterval: (query) =>
      (query.state.data ?? []).some(
        (card) =>
          (!card.previewFile &&
            card.status !== 'ERROR' &&
            card.status !== 'SKIPPED') ||
          (card.status === 'APPROVED' && !card.finalFile),
      )
        ? 2000
        : false,
  });

  const counts = useMemo(
    () => ({
      waiting: cards.filter((c) => !c.previewFile && c.status !== 'ERROR').length,
      review: cards.filter((c) => c.status === 'REVIEW_REQUIRED').length,
      failed: cards.filter((c) => c.status === 'ERROR').length,
      approved: cards.filter((c) => c.status === 'APPROVED').length,
    }),
    [cards],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cards.filter(
      (card) =>
        matches(card, filter) &&
        (!needle ||
          card.source.originalName.toLowerCase().includes(needle) ||
          card.source.baseName.includes(needle)),
    );
  }, [cards, filter, search]);

  const bulk = useMutation({
    mutationFn: (action: 'APPROVE' | 'SKIP' | 'UNSKIP' | 'CENTER' | 'REGENERATE') =>
      ozonBatchesApi.bulkCards(batchId, [...picked], action),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['ozon-cards', batchId] });
      setPicked(new Set());
      toast.success(`Изменено карточек: ${result.changed}`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось применить действие')),
  });

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading) return <p className="text-xs text-gray-400">Загрузка…</p>;
  if (cards.length === 0) return null;

  return (
    <div className="space-y-4">
      <CardFinalizePanel batchId={batchId} cards={cards} />

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Карточки: {cards.length}
        </h3>
        <p className="text-xs text-gray-500">
          {counts.waiting > 0 && `собирается ${counts.waiting} · `}
          {counts.review > 0 && `требует проверки ${counts.review} · `}
          {counts.failed > 0 && `ошибок ${counts.failed} · `}
          одобрено {counts.approved}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
              small
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени файла"
            aria-label="Поиск по имени файла"
            className="w-56 rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
          <span className="text-xs font-semibold text-indigo-900">
            Отмечено: {picked.size}
          </span>
          <button onClick={() => bulk.mutate('APPROVE')} className={btn}>
            Одобрить
          </button>
          <button onClick={() => bulk.mutate('CENTER')} className={btn}>
            Центрировать
          </button>
          <button onClick={() => bulk.mutate('REGENERATE')} className={btn}>
            Пересобрать
          </button>
          <button onClick={() => bulk.mutate('SKIP')} className={btn}>
            Пропустить
          </button>
          <button
            onClick={() => setPicked(new Set())}
            className="ml-auto text-xs text-indigo-700 underline"
          >
            снять отметки
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <button
          onClick={() =>
            setPicked(
              picked.size === visible.length
                ? new Set()
                : new Set(visible.map((c) => c.id)),
            )
          }
          className="text-xs text-gray-500 underline"
        >
          {picked.size === visible.length
            ? 'снять отметки'
            : `отметить все на экране (${visible.length})`}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-400">
          Под этот отбор ничего не подошло.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              batchId={batchId}
              onEdit={() => setEditing(card)}
              picked={picked.has(card.id)}
              onPick={() => toggle(card.id)}
            />
          ))}
        </ul>
      )}

      </div>

      {editing && (
        <CardEditorModal
          card={cards.find((c) => c.id === editing.id) ?? editing}
          batchId={batchId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CardTile({
  card,
  batchId,
  onEdit,
  picked,
  onPick,
}: {
  card: ImageCardGenerated;
  batchId: string;
  onEdit: () => void;
  picked: boolean;
  onPick: () => void;
}) {
  const qc = useQueryClient();
  const preview = useBlobUrl(
    card.previewFile ? `${card.id}:${card.previewFile}` : null,
    () => ozonBatchesApi.fetchCardPreview(card.id),
  );
  const status = STATUS[card.status];

  const refresh = () => qc.invalidateQueries({ queryKey: ['ozon-cards', batchId] });

  const setStatus = useMutation({
    mutationFn: (next: 'APPROVED' | 'SKIPPED' | 'GENERATED') =>
      ozonBatchesApi.updateCard(card.id, { status: next }),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось изменить статус')),
  });

  const regenerate = useMutation({
    mutationFn: () => ozonBatchesApi.regenerateCard(card.id),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось пересобрать')),
  });

  const skipped = card.status === 'SKIPPED';

  return (
    <li
      className={`overflow-hidden rounded-xl border ${
        card.status === 'APPROVED'
          ? 'border-indigo-300'
          : card.status === 'ERROR'
            ? 'border-red-200'
            : 'border-gray-200'
      } ${skipped ? 'opacity-50' : ''}`}
    >
      <div className="relative aspect-[3/4] bg-gray-50">
        <label className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-white/90 shadow">
          <input
            type="checkbox"
            checked={picked}
            onChange={onPick}
            aria-label={`Отметить ${card.source.baseName}`}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
        {preview ? (
          <img
            src={preview}
            alt={`${card.source.baseName} · ${card.shirtColor}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-400">
            {card.status === 'ERROR' ? 'не собралась' : 'собирается…'}
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-2">
        <p
          className="truncate text-xs font-medium text-gray-800"
          title={card.source.originalName}
        >
          {card.source.baseName}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
            {card.shirtColor}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {card.note && (
          <p className="flex items-start gap-1 text-[11px] text-amber-700">
            <AlertTriangle
              size={11}
              className="mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            {card.note}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <button onClick={onEdit} className={btn} title="Открыть редактор">
            <Pencil size={12} aria-hidden="true" />
            Правка
          </button>
          {card.status === 'APPROVED' ? (
            <button onClick={() => setStatus.mutate('GENERATED')} className={btn}>
              Снять одобрение
            </button>
          ) : (
            <button
              onClick={() => setStatus.mutate('APPROVED')}
              disabled={!card.previewFile}
              className={`${btn} text-indigo-700`}
            >
              <Check size={12} aria-hidden="true" />
              Одобрить
            </button>
          )}
          <button
            onClick={() => regenerate.mutate()}
            title="Вернуть к автоматическому размещению"
            className={btn}
          >
            <RotateCcw size={12} aria-hidden="true" />
          </button>
          <button
            onClick={() => setStatus.mutate(skipped ? 'GENERATED' : 'SKIPPED')}
            title={skipped ? 'Вернуть в работу' : 'Пропустить карточку'}
            className={btn}
          >
            <SkipForward size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}
