import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ozonProductCatalogApi,
  type BulkStockInput,
  type BulkStockMode,
  type BulkStockPreview,
} from '../../api/ozonProductCatalog';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Массовое изменение остатков Ozon.
 *
 * Три экрана подряд, и порядок в них — главное: сначала «что меняем»,
 * потом «вот что произойдёт», и только потом отправка. Показать сводку
 * до подтверждения обязательно: с тремя складами любая опечатка в поле
 * количества умножается втрое, и заметить её можно только глазами.
 *
 * Отправку ведёт сервер: окно можно закрыть, работа не остановится.
 * Здесь мы только опрашиваем состояние и показываем отчёт.
 */

type Phase = 'form' | 'confirm' | 'running';

/** Слово, которое просим ввести перед по-настоящему большой операцией. */
const CONFIRM_WORD = 'ПОДТВЕРДИТЬ';

export function BulkStockModal({
  accountId,
  offerIds,
  onClose,
}: {
  accountId: string;
  offerIds: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('form');
  const [mode, setMode] = useState<BulkStockMode>('SET');
  const [quantity, setQuantity] = useState('');
  /*
   * Пусто означает «человек ещё не трогал выбор» — тогда отмечены все
   * доступные склады. Обычный день это «поставить одно число везде»,
   * и снять лишнее быстрее, чем отметить всё.
   *
   * Через состояние-«не трогал», а не через синхронизацию в эффекте:
   * склады приезжают асинхронно, и эффект отметил бы их вторым
   * проходом отрисовки — с миганием пустого списка по дороге.
   */
  const [touched, setTouched] = useState<Set<number> | null>(null);
  const [preview, setPreview] = useState<BulkStockPreview | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [operationId, setOperationId] = useState<string | null>(null);

  const { data: warehouseList, isFetching: loadingWarehouses } = useQuery({
    queryKey: ['ozon-warehouses', accountId],
    queryFn: () => ozonProductCatalogApi.warehouses(accountId),
    staleTime: 600_000,
  });

  const warehouses = useMemo(
    () => warehouseList?.warehouses ?? [],
    [warehouseList],
  );
  const editable = useMemo(
    () => warehouses.filter((w) => w.isEditable),
    [warehouses],
  );

  const picked = useMemo(
    () => touched ?? new Set(editable.map((w) => w.id)),
    [touched, editable],
  );

  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.trim() !== '' &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 0;
  const operationCount = offerIds.length * picked.size;

  const input: BulkStockInput = {
    mode,
    offerIds,
    warehouses: [...picked].map((warehouseId) => ({
      warehouseId,
      quantity: parsedQuantity,
    })),
  };

  const refreshWarehouses = useMutation({
    mutationFn: () => ozonProductCatalogApi.syncWarehouses(accountId),
    onSuccess: (data) => {
      qc.setQueryData(['ozon-warehouses', accountId], data);
      toast.success(
        data.syncError ? data.syncError : `Склады обновлены: ${data.warehouses.length}`,
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось обновить склады')),
  });

  const askPreview = useMutation({
    mutationFn: () => ozonProductCatalogApi.bulkStockPreview(accountId, input),
    onSuccess: (data) => {
      setPreview(data);
      setConfirmWord('');
      setPhase('confirm');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось построить сводку')),
  });

  const start = useMutation({
    mutationFn: () => ozonProductCatalogApi.bulkStockStart(accountId, input),
    onSuccess: (data) => {
      setOperationId(data.operationId);
      setPhase('running');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось запустить операцию')),
  });

  const { data: operation } = useQuery({
    queryKey: ['ozon-bulk-stock', accountId, operationId],
    queryFn: () => ozonProductCatalogApi.bulkStockStatus(accountId, operationId!),
    enabled: Boolean(operationId),
    // Опрашиваем, пока операция не закрыта: пары уходят пачками, и
    // прогресс должен двигаться сам, без нажатия «обновить».
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'COMPLETED' || status === 'FAILED' ? false : 2000;
    },
  });

  const retry = useMutation({
    mutationFn: () =>
      ozonProductCatalogApi.bulkStockRetryErrors(accountId, operationId!),
    onSuccess: (data) => {
      if (data.retrying === 0) toast('Повторять нечего');
      else toast.success(`Повторяем ${data.retrying} шт.`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось повторить')),
  });

  // Остатки изменились — список товаров под окном должен это показать.
  useEffect(() => {
    if (operation?.status === 'COMPLETED' || operation?.status === 'FAILED') {
      qc.invalidateQueries({ queryKey: ['ozon-catalog', accountId] });
    }
  }, [operation?.status, accountId, qc]);

  const toggle = (id: number) =>
    setTouched(() => {
      const next = new Set(picked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Изменение остатков Ozon"
    >
      <div className="mt-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Изменение остатков Ozon
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Выбрано товаров: {offerIds.length}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {phase === 'form' && (
          <div className="space-y-5 px-5 py-4">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-700">
                Режим
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    checked={mode === 'SET'}
                    onChange={() => setMode('SET')}
                    className="accent-amber-600"
                  />
                  Установить — поставить это количество
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    checked={mode === 'ADD'}
                    onChange={() => setMode('ADD')}
                    className="accent-amber-600"
                  />
                  Добавить к текущему остатку
                </label>
              </div>
              {mode === 'ADD' && (
                /* Прибавления у Ozon нет: мы читаем остаток и пишем сумму.
                   Между чтением и записью проходит время, и если в этот
                   момент товар купят, на склад вернётся то, чего там уже
                   нет. Считаем перед самой отправкой, но совсем исключить
                   это нельзя — и человек должен об этом знать. */
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Ozon не умеет прибавлять сам: мы читаем остаток и записываем
                  сумму. Считаем прямо перед отправкой, но если товар купят
                  в эти секунды, остаток окажется завышен на одну штуку.
                  Когда важна точность — пользуйтесь режимом «Установить».
                </p>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-700">
                {mode === 'ADD' ? 'Прибавить' : 'Количество'}
              </span>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="25"
                className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {quantity.trim() === '0' && mode === 'SET' && (
                <span className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
                  <AlertTriangle size={13} className="mt-px flex-shrink-0" aria-hidden="true" />
                  Ноль снимет товары с продажи на выбранных складах.
                </span>
              )}
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">Склады</span>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  {warehouseList?.syncedAt && (
                    <span>обновлены {ageOf(warehouseList.syncedAt)}</span>
                  )}
                  <button
                    onClick={() => refreshWarehouses.mutate()}
                    disabled={refreshWarehouses.isPending}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-amber-600"
                  >
                    <RefreshCw
                      size={12}
                      className={refreshWarehouses.isPending ? 'animate-spin' : ''}
                      aria-hidden="true"
                    />
                    обновить
                  </button>
                </div>
              </div>

              {warehouseList?.syncError && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {warehouseList.syncError}
                </p>
              )}

              <div className="space-y-1 rounded-lg border border-gray-200 p-2">
                {loadingWarehouses && warehouses.length === 0 && (
                  <p className="px-1 py-1 text-xs text-gray-500">Загружаем склады…</p>
                )}
                {warehouses.map((w) => (
                  <label
                    key={w.id}
                    className={`flex items-start gap-2 rounded px-1 py-1 text-sm ${
                      w.isEditable ? 'text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(w.id)}
                      disabled={!w.isEditable}
                      onChange={() => toggle(w.id)}
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span>
                      {w.name}
                      {w.disabledReason && (
                        <span className="block text-[11px] text-gray-400">
                          {w.disabledReason}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                {!loadingWarehouses && warehouses.length === 0 && (
                  <p className="px-1 py-1 text-xs text-gray-500">
                    У кабинета нет складов, на которые можно проставить остаток.
                  </p>
                )}
              </div>

              {editable.length > 0 && (
                <div className="mt-2 flex gap-2 text-[11px]">
                  <button
                    onClick={() => setTouched(new Set(editable.map((w) => w.id)))}
                    className="rounded px-2 py-1 text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    Выбрать все
                  </button>
                  <button
                    onClick={() => setTouched(new Set())}
                    className="rounded px-2 py-1 text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    Снять все
                  </button>
                </div>
              )}
            </div>

            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              Операций: {offerIds.length} товара × {picked.size} склада ={' '}
              <span className="font-semibold">{operationCount}</span>
            </p>
          </div>
        )}

        {phase === 'confirm' && preview && (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Товаров" value={preview.productCount} />
              <Stat label="Складов" value={preview.warehouseCount} />
              <Stat label="Операций" value={preview.operationCount} />
            </div>

            <p className="text-sm text-gray-700">
              Режим:{' '}
              <span className="font-medium">
                {mode === 'ADD' ? 'Добавить' : 'Установить'}
              </span>{' '}
              · {mode === 'ADD' ? 'прибавляем' : 'количество'}:{' '}
              <span className="font-medium">
                {mode === 'ADD' ? `+${parsedQuantity}` : parsedQuantity}
              </span>
            </p>

            {preview.zeroingCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                Обнуляется {preview.zeroingCount} пар «товар × склад». Эти товары
                перестанут продаваться на выбранных складах.
              </p>
            )}

            <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <tbody>
                  {preview.sample.map((row) => (
                    <tr
                      key={`${row.offerId}-${row.warehouseId}`}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="px-3 py-1.5 font-mono text-[11px] text-gray-700">
                        {row.offerId}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{row.warehouseName}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">
                        {row.previousStock ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-gray-900">
                        → {row.newStock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.operationCount > preview.sample.length && (
                <p className="px-3 py-1.5 text-[11px] text-gray-400">
                  …и ещё {preview.operationCount - preview.sample.length}
                </p>
              )}
              {!preview.stocksKnown && (
                <p className="border-t border-gray-50 px-3 py-1.5 text-[11px] text-gray-400">
                  Текущие остатки Ozon не отдал — показано только то, что станет.
                </p>
              )}
            </div>

            {preview.strongConfirm && (
              <label className="block rounded-lg bg-amber-50 px-3 py-2.5">
                <span className="block text-sm text-amber-900">
                  Вы собираетесь изменить {preview.operationCount} остатков.
                  Введите «{CONFIRM_WORD}», чтобы продолжить.
                </span>
                <input
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                  className="mt-2 w-56 rounded-lg border border-amber-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </label>
            )}
          </div>
        )}

        {phase === 'running' && operation && (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Всего" value={operation.operationCount} />
              <Stat label="Успешно" value={operation.successCount} tone="ok" />
              <Stat label="Ошибки" value={operation.errorCount} tone="bad" />
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${percent(
                    operation.successCount + operation.errorCount,
                    operation.operationCount,
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {operation.status === 'COMPLETED'
                ? 'Готово.'
                : operation.status === 'FAILED'
                  ? 'Готово, но часть пар не прошла.'
                  : 'Отправляем… Окно можно закрыть, работа не остановится.'}
            </p>

            {operation.lastError && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {operation.lastError}
              </p>
            )}

            {operation.errorCount > 0 && (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <tbody>
                    {operation.items
                      .filter((i) => i.status === 'ERROR')
                      .map((item) => (
                        <tr
                          key={`${item.offerId}-${item.warehouseName}`}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="px-3 py-1.5 font-mono text-[11px] text-gray-700">
                            {item.offerId}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {item.warehouseName}
                          </td>
                          <td className="px-3 py-1.5 text-red-600">
                            {item.errorMessage ?? 'ошибка'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          {phase === 'form' && (
            <>
              <button onClick={onClose} className={secondaryCls}>
                Отмена
              </button>
              <button
                onClick={() => askPreview.mutate()}
                disabled={!quantityValid || picked.size === 0 || askPreview.isPending}
                className={primaryCls}
              >
                {askPreview.isPending ? 'Считаем…' : 'Продолжить'}
              </button>
            </>
          )}

          {phase === 'confirm' && preview && (
            <>
              <button onClick={() => setPhase('form')} className={secondaryCls}>
                Назад
              </button>
              <button
                onClick={() => start.mutate()}
                disabled={
                  start.isPending ||
                  (preview.strongConfirm && confirmWord.trim() !== CONFIRM_WORD)
                }
                className={primaryCls}
              >
                {start.isPending ? 'Запускаем…' : 'Обновить остатки'}
              </button>
            </>
          )}

          {phase === 'running' && (
            <>
              {operation && operation.errorCount > 0 && (
                <button
                  onClick={() => retry.mutate()}
                  disabled={retry.isPending}
                  className={secondaryCls}
                >
                  Повторить только ошибки
                </button>
              )}
              <button onClick={onClose} className={primaryCls}>
                <Check size={14} className="mr-1 inline" aria-hidden="true" />
                Закрыть
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

const primaryCls =
  'rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50';
const secondaryCls =
  'rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'bad';
}) {
  const color =
    tone === 'ok' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function percent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/** «5 минут назад» — человеку важна свежесть, а не точное время. */
function ageOf(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}
