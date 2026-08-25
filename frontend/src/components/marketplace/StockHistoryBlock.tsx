import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ozonProductCatalogApi,
  type BulkStockHistoryRow,
} from '../../api/ozonProductCatalog';

/**
 * История массовых изменений остатков.
 *
 * Свёрнута по умолчанию и лежит рядом с акциями — по той же причине:
 * в неё заглядывают, когда что-то пошло не так, а список товаров смотрят
 * каждый день. Открытая, она отодвигала бы работу вниз.
 *
 * Смысл раздела ровно один: ответить на вопрос «кто и когда изменил этот
 * остаток». Поэтому в строке есть автор и время, а не только числа.
 */

const MODE_LABEL: Record<BulkStockHistoryRow['mode'], string> = {
  SET: 'Установить',
  ADD: 'Добавить',
};

const STATUS_LABEL: Record<BulkStockHistoryRow['status'], string> = {
  PENDING: 'в очереди',
  RUNNING: 'выполняется',
  COMPLETED: 'готово',
  FAILED: 'с ошибками',
};

export function StockHistoryBlock({ accountId }: { accountId: string }) {
  // Запрос уходит только когда раздел раскрыли: история нужна изредка,
  // а лишний запрос на каждое открытие каталога — нет.
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ozon-stock-history', accountId],
    queryFn: () => ozonProductCatalogApi.bulkStockHistory(accountId),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <details
      className="rounded-xl border border-gray-200 bg-white p-4"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
        История изменений остатков
        {rows.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            последних операций: {rows.length}
          </span>
        )}
      </summary>

      <div className="mt-2 space-y-2">
        {isLoading && <p className="text-xs text-gray-500">Загружаем…</p>}

        {!isLoading && rows.length === 0 && (
          <p className="text-xs text-gray-500">
            Остатки массово ещё не меняли. Выберите товары в списке ниже
            и нажмите «Изменить остатки Ozon».
          </p>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-gray-50 pb-2 text-xs last:border-0 last:pb-0"
          >
            <span className="text-gray-700">
              {formatMoment(row.createdAt)}
              <span className="ml-2 text-gray-400">
                {row.author ?? 'без автора'}
              </span>
            </span>

            <span className="text-gray-500">
              {MODE_LABEL[row.mode]}
              {row.defaultQuantity !== null && (
                <span className="ml-1 text-gray-700">{row.defaultQuantity} шт.</span>
              )}
              <span className="ml-2">
                {row.productCount} × {row.warehouseCount} = {row.operationCount}
              </span>
            </span>

            <span className="flex items-center gap-2">
              <span className="text-emerald-700">успешно {row.successCount}</span>
              {row.errorCount > 0 && (
                <span className="text-red-600">ошибок {row.errorCount}</span>
              )}
              <span className="text-gray-400">{STATUS_LABEL[row.status]}</span>
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

/** «25.08.2026 19:20» — для истории важны и день, и время. */
function formatMoment(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
