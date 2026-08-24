import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Check,
  Crosshair,
  Eye,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { approvalsApi, mockupsApi } from '../../api/approvals';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { getErrorMessage } from '../../utils/get-error-message';
import {
  QUALITY_LABEL,
  cmToMm,
  estimateDpi,
  formatSizeCm,
  isCalibrated,
  isOutsidePrintArea,
  mmToCm,
  printQuality,
} from '../../utils/approval-geometry';
import { TSHIRT_SIZE_LABELS } from '../../constants';
import type {
  ApprovalSideState,
  EnumApprovalSide,
  EnumTshirtSize,
  MockupTemplate,
  PrintApproval,
} from '../../types/index';
import { MAX_MM, MIN_MM, PrintStage } from './PrintStage';

interface Props {
  approvalId: string;
  orderNumber: string;
  onClose: () => void;
}

type Sides = Partial<Record<EnumApprovalSide, ApprovalSideState>>;

interface Draft {
  shirtColor: string;
  shirtSize: EnumTshirtSize;
  comment: string;
  sides: Sides;
}

const SIDE_LABELS: Record<EnumApprovalSide, string> = {
  FRONT: 'Лицевая сторона',
  BACK: 'Спина',
};

/** Пауза автосохранения. Достаточно, чтобы не писать на каждый пиксель. */
const AUTOSAVE_MS = 700;

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

/**
 * Редактор согласования: выбрать → загрузить → расположить → проверить → готово.
 *
 * Всё состояние живёт на сервере и сохраняется само, поэтому закрытая вкладка
 * или перезагрузка страницы ничего не теряют — согласование открывается там
 * же, где его оставили.
 */
export function ApprovalEditor({ approvalId, orderNumber, onClose }: Props) {
  const qc = useQueryClient();
  const [activeSide, setActiveSide] = useState<EnumApprovalSide>('FRONT');
  const [localDraft, setLocalDraft] = useState<Draft | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Есть ли несохранённые правки. Ref, а не состояние: перерисовки не требует. */
  const dirty = useRef(false);

  // История для отмены. Хранит снимки сторон — именно их правят руками.
  const [past, setPast] = useState<Sides[]>([]);
  const [future, setFuture] = useState<Sides[]>([]);

  const { data: approval, isLoading } = useQuery({
    queryKey: ['approval', approvalId],
    queryFn: () => approvalsApi.get(approvalId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['mockup-templates'],
    queryFn: mockupsApi.list,
    staleTime: 5 * 60_000,
  });

  /**
   * Черновик редактора. Пока сотрудник ничего не трогал, он выводится из
   * ответа сервера; с первой правкой ведущим становится локальный. Именно
   * так, а не копированием в состояние при загрузке: иначе ответ
   * автосохранения перетирал бы то, что человек уже двигает мышью.
   */
  const draft: Draft | null = useMemo(() => {
    if (localDraft) return localDraft;
    if (!approval) return null;
    return {
      shirtColor: approval.shirtColor,
      shirtSize: approval.shirtSize,
      comment: approval.comment ?? '',
      sides: approval.sides,
    };
  }, [localDraft, approval]);

  const editDraft = useCallback(
    (update: (prev: Draft) => Draft) => {
      if (!draft) return;
      dirty.current = true;
      setLocalDraft(update(draft));
    },
    [draft],
  );

  const saveMutation = useMutation({
    mutationFn: (next: Draft) =>
      approvalsApi.update(approvalId, {
        shirtColor: next.shirtColor,
        shirtSize: next.shirtSize,
        comment: next.comment,
        sides: next.sides,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['approval', approvalId], updated);
      qc.invalidateQueries({ queryKey: ['approvals', updated.orderId] });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось сохранить согласование')),
  });

  // Автосохранение: ждём паузы в действиях и пишем черновик целиком.
  // mutate из react-query стабилен между рендерами, поэтому таймер не
  // перезапускается сам по себе — только когда меняется черновик.
  const save = saveMutation.mutate;
  useEffect(() => {
    if (!draft || !dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      save(draft);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, save]);

  const patchDraft = useCallback(
    (patch: Partial<Draft>) => editDraft((prev) => ({ ...prev, ...patch })),
    [editDraft],
  );

  /**
   * Шаг истории. Снимок делается ДО изменения, поэтому «Отменить» возвращает
   * то, что было. Глубина ограничена: помнить весь сеанс незачем.
   */
  const pushHistory = useCallback(() => {
    if (!draft) return;
    const sides = draft.sides;
    setPast((prev) => [...prev.slice(-29), sides]);
    setFuture([]);
  }, [draft]);

  const undo = useCallback(() => {
    if (!draft || past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((f) => [...f, draft.sides]);
    setPast((p) => p.slice(0, -1));
    dirty.current = true;
    setLocalDraft({ ...draft, sides: previous });
  }, [draft, past]);

  const redo = useCallback(() => {
    if (!draft || future.length === 0) return;
    const next = future[future.length - 1];
    setPast((p) => [...p, draft.sides]);
    setFuture((f) => f.slice(0, -1));
    dirty.current = true;
    setLocalDraft({ ...draft, sides: next });
  }, [draft, future]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Предпросмотр лежит поверх редактора, поэтому закрывается первым:
        // иначе Escape уносил бы всю работу вместе с открытой картинкой.
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        } else {
          onClose();
        }
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, redo, undo, previewUrl]);

  const colors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of templates) {
      if (!t.isActive) continue;
      const key = t.color.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, t.color);
    }
    return [...seen.values()];
  }, [templates]);

  const template = useMemo<MockupTemplate | null>(() => {
    if (!draft) return null;
    const wanted = draft.shirtColor.trim().toLowerCase();
    return (
      templates.find(
        (t) =>
          t.isActive &&
          t.side === activeSide &&
          t.color.trim().toLowerCase() === wanted,
      ) ?? null
    );
  }, [templates, draft, activeSide]);

  const side = draft?.sides[activeSide] ?? null;

  const mockupUrl = useBlobUrl(
    template?.imageFile ? `${template.id}:${template.updatedAt}` : null,
    () => mockupsApi.fetchImage(template!.id),
  );
  const printUrl = useBlobUrl(
    side?.printFile ? `${approvalId}:${activeSide}:${side.printFile}` : null,
    () => approvalsApi.fetchPrint(approvalId, activeSide),
  );

  /**
   * Досылает несохранённое, не дожидаясь паузы автосохранения.
   *
   * Нужно перед любым действием, ответ которого перетирает черновик целиком
   * (загрузка принта) или читает состояние на сервере (предпросмотр, «Готово»).
   * Без этого правка второй стороны, сделанная за секунду до загрузки принта,
   * молча пропадала бы.
   */
  const flushDraft = useCallback(async () => {
    if (!draft || !dirty.current) return;
    dirty.current = false;
    await approvalsApi.update(approvalId, {
      shirtColor: draft.shirtColor,
      shirtSize: draft.shirtSize,
      comment: draft.comment,
      sides: draft.sides,
    });
  }, [approvalId, draft]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      await flushDraft();
      return approvalsApi.uploadPrint(approvalId, activeSide, file);
    },
    onSuccess: (updated) => applyServer(updated, 'Принт загружен'),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось загрузить принт')),
  });

  const removePrintMutation = useMutation({
    mutationFn: async () => {
      await flushDraft();
      return approvalsApi.removePrint(approvalId, activeSide);
    },
    onSuccess: (updated) => applyServer(updated, 'Принт удалён'),
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось удалить принт')),
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      // Файл должен получиться из того, что сотрудник видит на экране,
      // а не из прошлой автозаписи.
      await flushDraft();
      const finalized = await approvalsApi.finalize(approvalId);
      const { blob, filename } = await approvalsApi.download(approvalId);
      downloadBlob(blob, filename);
      return finalized;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['approval', approvalId], updated);
      qc.invalidateQueries({ queryKey: ['approvals', updated.orderId] });
      toast.success('Согласование сформировано и скачано');
      onClose();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Не удалось сформировать файл')),
  });

  /** Ответ сервера после загрузки или удаления принта — он тут главный. */
  function applyServer(updated: PrintApproval, message: string) {
    qc.setQueryData(['approval', approvalId], updated);
    dirty.current = false;
    if (draft) setLocalDraft({ ...draft, sides: updated.sides });
    toast.success(message);
  }

  const setSide = useCallback(
    (next: ApprovalSideState) => {
      editDraft((prev) => ({
        ...prev,
        sides: { ...prev.sides, [activeSide]: next },
      }));
    },
    [editDraft, activeSide],
  );

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      await flushDraft();
      const blob = await approvalsApi.preview(approvalId);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Не удалось сформировать предпросмотр'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const filled = Object.values(draft?.sides ?? {}).filter((s) => s?.printFile);
  const dpi = side ? estimateDpi(side) : 0;
  const quality = printQuality(dpi);
  const outside = side && template ? isOutsidePrintArea(side, template) : false;

  if (isLoading || !draft || !approval) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white">
        <div
          role="status"
          aria-label="Загрузка"
          className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-900">
            Согласование печати · заказ № {orderNumber}
          </h2>
          <p className="text-xs text-gray-500">
            Версия {approval.version} ·{' '}
            {saveMutation.isPending ? 'сохраняется…' : 'сохранено'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={past.length === 0}
            title="Отменить (Ctrl+Z)"
            aria-label="Отменить"
            className={btn}
          >
            <Undo2 size={15} aria-hidden="true" />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            title="Повторить (Ctrl+Shift+Z)"
            aria-label="Повторить"
            className={btn}
          >
            <Redo2 size={15} aria-hidden="true" />
          </button>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[360px_1fr]">
          {/* ── Параметры ─────────────────────────────────── */}
          <div className="space-y-4">
            <Block title="Футболка">
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => patchDraft({ shirtColor: color })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      draft.shirtColor.trim().toLowerCase() ===
                      color.trim().toLowerCase()
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Размер</span>
                <select
                  className={`mt-1 ${field}`}
                  value={draft.shirtSize}
                  onChange={(e) =>
                    patchDraft({ shirtSize: e.target.value as EnumTshirtSize })
                  }
                >
                  {Object.entries(TSHIRT_SIZE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </Block>

            <Block title={`Принт · ${SIDE_LABELS[activeSide]}`}>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${btn} cursor-pointer`}>
                  <Upload size={14} aria-hidden="true" />
                  {side?.printFile ? 'Заменить файл' : 'Загрузить принт'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadMutation.isPending || !template}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        pushHistory();
                        uploadMutation.mutate(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                {side?.printFile && (
                  <button
                    onClick={() => {
                      pushHistory();
                      removePrintMutation.mutate();
                    }}
                    className={`${btn} text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Удалить
                  </button>
                )}
              </div>
              {side?.printOriginalName && (
                <p className="truncate text-xs text-gray-500">
                  Файл: {side.printOriginalName} · {side.printWidthPx} ×{' '}
                  {side.printHeightPx} px
                </p>
              )}

              {side && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <CmField
                      label="Ширина, см"
                      valueMm={side.widthMm}
                      onCommit={(mm) => {
                        pushHistory();
                        const ratio = side.heightMm / side.widthMm;
                        setSide({
                          ...side,
                          widthMm: mm,
                          heightMm: side.lockRatio
                            ? Math.round(mm * ratio)
                            : side.heightMm,
                        });
                      }}
                    />
                    <CmField
                      label="Высота, см"
                      valueMm={side.heightMm}
                      onCommit={(mm) => {
                        pushHistory();
                        const ratio = side.widthMm / side.heightMm;
                        setSide({
                          ...side,
                          heightMm: mm,
                          widthMm: side.lockRatio
                            ? Math.round(mm * ratio)
                            : side.widthMm,
                        });
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={side.lockRatio}
                      onChange={(e) => {
                        pushHistory();
                        setSide({ ...side, lockRatio: e.target.checked });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Сохранять пропорции
                  </label>
                  {!side.lockRatio && (
                    <p className="text-xs text-amber-700">
                      Пропорции сняты — принт можно растянуть по одной оси.
                    </p>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Поворот
                      </span>
                      <span className="text-sm tabular-nums text-gray-500">
                        {side.rotation}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={side.rotation}
                      onChange={(e) =>
                        setSide({ ...side, rotation: Number(e.target.value) })
                      }
                      onPointerDown={pushHistory}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex gap-2">
                      {[-90, 0, 90].map((deg) => (
                        <button
                          key={deg}
                          onClick={() => {
                            pushHistory();
                            setSide({ ...side, rotation: deg });
                          }}
                          className={`${btn} flex-1 justify-center`}
                        >
                          {deg === 0 ? '0°' : `${deg}°`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        pushHistory();
                        setSide({ ...side, x: 0.5, y: 0.5 });
                      }}
                      className={btn}
                    >
                      <Crosshair size={14} aria-hidden="true" />
                      Центрировать
                    </button>
                    <button
                      onClick={() => {
                        pushHistory();
                        setSide({ ...side, x: 0.5, y: 0.5, rotation: 0 });
                      }}
                      className={btn}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Сбросить положение
                    </button>
                  </div>

                  {/* Контроль качества: тот же расчёт, что и на сервере. */}
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      quality === 'GOOD'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : quality === 'ACCEPTABLE'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                  >
                    Печать {formatSizeCm(side.widthMm, side.heightMm)} · ~{dpi} DPI
                    <br />
                    {QUALITY_LABEL[quality]}
                  </div>
                  {outside && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      Принт выходит за допустимую область печати.
                    </p>
                  )}
                </>
              )}
            </Block>

            <Block title="Комментарий">
              <textarea
                rows={3}
                className={field}
                placeholder="Например: отступ от горловины 7 см"
                value={draft.comment}
                onChange={(e) => patchDraft({ comment: e.target.value })}
              />
            </Block>
          </div>

          {/* ── Холст ─────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {(['FRONT', 'BACK'] as EnumApprovalSide[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setActiveSide(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeSide === value
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {SIDE_LABELS[value]}
                  {draft.sides[value]?.printFile && ' ✓'}
                </button>
              ))}
            </div>

            {template ? (
              <PrintStage
                template={template}
                mockupUrl={mockupUrl}
                printUrl={printUrl}
                state={side}
                onBeforeChange={pushHistory}
                onChange={setSide}
                onCommit={() => (dirty.current = true)}
              />
            ) : (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-500">
                  Нет шаблона мокапа для футболки «{draft.shirtColor}» (
                  {SIDE_LABELS[activeSide].toLowerCase()}).
                  <br />
                  Заведите его в настройках CRM, раздел «Мокапы согласования».
                </p>
              </div>
            )}

            {template && !isCalibrated(template) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Шаблон «{template.title}» не откалиброван: загрузите фотографию и
                задайте зону печати в настройках — иначе размер в сантиметрах не
                будет соответствовать картинке.
              </p>
            )}

            {!side?.printFile && (
              <p className="text-center text-sm text-gray-500">
                Загрузите принт — он появится на футболке, и его можно будет
                перетащить мышью.
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:px-6">
        <p className="text-xs text-gray-500">
          Сторон с принтом: {filled.length} из 2
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            disabled={previewLoading || filled.length === 0}
            className={btn}
          >
            <Eye size={15} aria-hidden="true" />
            {previewLoading ? 'Готовим…' : 'Предпросмотр'}
          </button>
          <button
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending || filled.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
          >
            <Check size={16} aria-hidden="true" />
            {finalizeMutation.isPending ? 'Формируем…' : 'Готово'}
          </button>
        </div>
      </footer>

      {previewUrl && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/80">
          <div className="flex justify-end p-3">
            <button
              onClick={() => {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
              aria-label="Закрыть предпросмотр"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-auto px-4 pb-6">
            <img
              src={previewUrl}
              alt="Предпросмотр согласования"
              className="mx-auto max-w-3xl rounded-lg bg-white shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Поле размера в сантиметрах. Значение применяется по уходу из поля, а не на
 * каждое нажатие: иначе «28» по дороге успевает побывать двойкой и принт
 * прыгает.
 */
function CmField({
  label,
  valueMm,
  onCommit,
}: {
  label: string;
  valueMm: number;
  onCommit: (mm: number) => void;
}) {
  const [text, setText] = useState(String(mmToCm(valueMm)));
  // Размер меняют не только этим полем — ещё и углом принта на холсте.
  // Подстраиваемся прямо в рендере: эффект здесь дал бы лишний проход и
  // мигание старым числом.
  const [shownMm, setShownMm] = useState(valueMm);
  if (shownMm !== valueMm) {
    setShownMm(valueMm);
    setText(String(mmToCm(valueMm)));
  }

  const commit = () => {
    const cm = Number(text.replace(',', '.'));
    if (!Number.isFinite(cm) || cm <= 0) {
      setText(String(mmToCm(valueMm)));
      return;
    }
    const mm = Math.min(MAX_MM, Math.max(MIN_MM, cmToMm(cm)));
    if (mm !== valueMm) onCommit(mm);
    setText(String(mmToCm(mm)));
  };

  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        className={`mt-1 ${field}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
