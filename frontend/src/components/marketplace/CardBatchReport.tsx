import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import type {
  ImageCardBatchReport,
  ImageCardSource,
} from '../../types/index';

const btn =
  'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';

/**
 * Отчёт по пачке и разбор проблемных файлов.
 *
 * Цифры считает сервер: собери их на клиенте — и они разъедутся с тем, что
 * реально лежит в базе, ровно в тот момент, когда по ним начнут принимать
 * решения.
 */
export function CardBatchReport({
  report,
  sources,
  onRetrySource,
  onRemoveSource,
}: {
  report: ImageCardBatchReport;
  sources: ImageCardSource[];
  onRetrySource: (id: string) => void;
  onRemoveSource: (id: string) => void;
}) {
  const broken = sources.filter((s) => s.status === 'ERROR');
  const nothingHappened = report.sourcesTotal === 0 && report.cardsTotal === 0;
  if (nothingHappened) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Отчёт</h3>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        <Row label="Всего исходников" value={report.sourcesTotal} />
        <Row label="Карточек запланировано" value={report.cardsExpected} />
        <Row label="Сгенерировано" value={report.cardsTotal} />
        <Row
          label="Требует проверки"
          value={report.reviewRequired}
          tone={report.reviewRequired > 0 ? 'text-amber-700' : undefined}
        />
        <Row
          label="Готово"
          value={report.finalized}
          tone={report.finalized > 0 ? 'text-emerald-700' : undefined}
        />
        <Row
          label="Ошибок"
          value={report.failed + report.sourcesFailed}
          tone={report.failed + report.sourcesFailed > 0 ? 'text-red-700' : undefined}
        />
      </dl>

      {report.skipped > 0 && (
        <p className="text-xs text-gray-500">Пропущено карточек: {report.skipped}</p>
      )}

      {broken.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-red-100 bg-red-50/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
            <AlertTriangle size={13} aria-hidden="true" />
            Файлы, которые не обработались: {broken.length}
          </p>
          <ul className="space-y-1">
            {broken.map((source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5"
              >
                <span
                  className="min-w-0 flex-1 truncate text-xs text-gray-800"
                  title={source.originalName}
                >
                  {source.originalName}
                </span>
                {source.errorMessage && (
                  <span className="w-full text-[11px] text-red-700">
                    {source.errorMessage}
                  </span>
                )}
                <button onClick={() => onRetrySource(source.id)} className={btn}>
                  <RotateCcw size={12} aria-hidden="true" />
                  Повторить
                </button>
                <button
                  onClick={() => onRemoveSource(source.id)}
                  className={`${btn} text-red-600 hover:bg-red-50`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                  Пропустить
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone ?? 'text-gray-900'}`}>
        {value}
      </dd>
    </div>
  );
}
