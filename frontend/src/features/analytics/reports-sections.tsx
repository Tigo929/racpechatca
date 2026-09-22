import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileDown, FileText, Loader2, Printer, RefreshCw } from 'lucide-react';
import { reportsApi } from '../../api/analytics';
import type { AnalyticsReport } from '../../types/analytics-reports';
import { Card, StateBlock } from './ui';
import { getErrorMessage } from '../../utils/get-error-message';

/**
 * Раздел «Отчёты для ИИ» (этап 16).
 *
 * Здесь не считается ни одна цифра: кнопка ставит заказ в очередь, сервер
 * собирает тот же отчёт, что и командная строка, а экран показывает статус и
 * отдаёт готовый файл. Владелец скачивает markdown и отправляет его ИИ —
 * ради этого сценария этап и делался.
 */

const STATUS_LABELS: Record<AnalyticsReport['status'], string> = {
  QUEUED: 'В очереди',
  GENERATING: 'Формируется…',
  READY: 'Готов',
  FAILED: 'Ошибка',
};

const STATUS_TONE: Record<AnalyticsReport['status'], string> = {
  QUEUED: 'bg-gray-100 text-gray-700',
  GENERATING: 'bg-amber-100 text-amber-800',
  READY: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

function periodText(report: AnalyticsReport): string {
  const d = (iso: string) => iso.split('-').reverse().join('.');
  return `${d(report.dateFrom)} – ${d(report.dateTo)}`;
}

function sizeText(bytes: number | null): string {
  if (!bytes) return '—';
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} КБ` : `${bytes} Б`;
}

function moscow(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Скачивание идёт с токеном, поэтому файл забираем через API, а не ссылкой. */
async function saveFile(report: AnalyticsReport, format: 'md' | 'html') {
  const blob = await reportsApi.download(report.id, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-report-${report.dateFrom}_${report.dateTo}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportsTab() {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<'7d' | '30d' | 'custom'>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const list = useQuery({
    queryKey: ['analytics', 'reports'],
    queryFn: () => reportsApi.list(),
    // пока что-то формируется, обновляем чаще: генерация занимает секунды
    refetchInterval: (query) =>
      (query.state.data?.items ?? []).some(
        (r) => r.status === 'QUEUED' || r.status === 'GENERATING',
      )
        ? 4000
        : false,
  });

  const create = useMutation({
    mutationFn: () =>
      reportsApi.create(
        preset === 'custom' ? { dateFrom: from, dateTo: to } : { preset },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['analytics', 'reports'] });
      toast.success('Отчёт поставлен в очередь');
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Не удалось заказать отчёт')),
  });

  const download = useMutation({
    mutationFn: ({ report, format }: { report: AnalyticsReport; format: 'md' | 'html' }) =>
      saveFile(report, format),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Не удалось скачать файл')),
  });

  const items = list.data?.items ?? [];
  const active = items.some((r) => r.status === 'QUEUED' || r.status === 'GENERATING');
  const customInvalid = preset === 'custom' && (!from || !to);

  return (
    <div className="space-y-4">
      <Card title="Сформировать отчёт">
        <p className="text-sm text-gray-600 mb-3">
          Отчёт собирает всю аналитику за период в один файл: трафик, воронки,
          продажи, прибыль, качество данных, аномалии и прогноз. Скачайте
          markdown и отправьте его ИИ — инструкция для анализа лежит внутри файла.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-gray-500 mb-1">Период</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
              aria-label="Период отчёта"
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="7d">Последние 7 полных дней</option>
              <option value="30d">Последние 30 полных дней</option>
              <option value="custom">Свой период</option>
            </select>
          </label>

          {preset === 'custom' && (
            <>
              <label className="text-sm">
                <span className="block text-gray-500 mb-1">С</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="Дата начала"
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-gray-500 mb-1">По</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="Дата окончания"
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
              </label>
            </>
          )}

          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || active || customInvalid}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {create.isPending || active ? 'Формируется…' : 'Сформировать отчёт'}
          </button>

          <button
            onClick={() => void list.refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={13} aria-hidden="true" /> Обновить
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Текущий день не входит в период: он ещё не закончился. Чтобы получить
          PDF, откройте печатную версию и выберите в печати браузера «Сохранить
          как PDF».
        </p>
      </Card>

      <Card title="Последние отчёты">
        {list.isLoading ? (
          <StateBlock kind="loading" />
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">
            Отчётов пока нет. Выберите период и нажмите «Сформировать отчёт».
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Период</th>
                  <th className="py-2 pr-3 font-medium">Заказан</th>
                  <th className="py-2 pr-3 font-medium">Статус</th>
                  <th className="py-2 pr-3 font-medium">Размер</th>
                  <th className="py-2 pr-3 font-medium">Сборка</th>
                  <th className="py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((report) => (
                  <tr key={report.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{periodText(report)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                      {moscow(report.requestedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_TONE[report.status]}`}
                      >
                        {report.status === 'GENERATING' && (
                          <Loader2 size={11} className="motion-safe:animate-spin" aria-hidden="true" />
                        )}
                        {STATUS_LABELS[report.status]}
                      </span>
                      {report.status === 'FAILED' && report.errorMessage && (
                        <span className="block text-xs text-red-600 mt-0.5">
                          {report.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                      {sizeText(report.mdSizeBytes)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500">
                      {report.productionBuild ? report.productionBuild.slice(0, 7) : '—'}
                    </td>
                    <td className="py-2">
                      {report.status === 'READY' ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => download.mutate({ report, format: 'md' })}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            <FileText size={12} aria-hidden="true" /> Скачать MD для ИИ
                          </button>
                          <button
                            onClick={() => download.mutate({ report, format: 'html' })}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <Printer size={12} aria-hidden="true" /> Печатная версия
                          </button>
                        </div>
                      ) : report.status === 'FAILED' ? (
                        <span className="text-xs text-gray-500">Попробуйте ещё раз</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <FileDown size={12} aria-hidden="true" /> файл появится после готовности
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
