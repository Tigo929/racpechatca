import { useId, useState, type ReactNode } from 'react';
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { Comparison } from '../../types/analytics';
import {
  deltaTone,
  formatDelta,
  formatMetric,
  labelOf,
  type MetricFormat,
  type Polarity,
  type Tone,
  type Warning,
} from './analytics-view';

/**
 * Мелкие блоки дашборда: карточка KPI, знак изменения, подсказка, предупреждение,
 * состояния загрузки/пустоты/ошибки. Всё — в стиле остальной панели
 * (белые карточки, серая шкала, индиго/янтарь для акцентов).
 */

export function Card({ title, subtitle, children, className = '' }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl ${className}`}>
      {(title || subtitle) && (
        <header className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
          {title && <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{title}</h2>}
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </header>
      )}
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </section>
  );
}

/** Подсказка «что считается»: доступна с клавиатуры, текст читает скринридер. */
export function Hint({ text, label }: { text: string; label: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Что такое «${label}»`}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-gray-300 hover:text-gray-500 focus-visible:text-gray-600 focus-visible:outline-none rounded"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" id={id} className="absolute z-30 left-1/2 -translate-x-1/2 top-6 w-64 max-w-[80vw] rounded-lg bg-gray-900 text-white text-xs leading-snug p-2.5 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

const TONE_CLASS: Record<Tone, string> = {
  positive: 'text-emerald-700 bg-emerald-50',
  negative: 'text-rose-700 bg-rose-50',
  neutral: 'text-gray-500 bg-gray-100',
};

export function DeltaBadge({ cmp, format, polarity, ariaPrefix }: { cmp: Comparison | null | undefined; format: MetricFormat; polarity: Polarity; ariaPrefix?: string }) {
  const tone = deltaTone(cmp, polarity);
  const text = formatDelta(cmp, format);
  const Icon = tone === 'positive' ? TrendingUp : tone === 'negative' ? TrendingDown : null;
  const direction = !cmp || cmp.delta === null || cmp.delta === 0 ? '' : cmp.delta > 0 ? 'рост' : 'снижение';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${TONE_CLASS[tone]}`} aria-label={`${ariaPrefix ?? 'Изменение'}: ${direction} ${text}`.trim()}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {text}
    </span>
  );
}

export function KpiCard({
  metricKey,
  value,
  format,
  cmp,
  polarity = 'higher-good',
  note,
  unavailable,
}: {
  metricKey: string;
  value: number | null | undefined;
  format: MetricFormat;
  cmp?: Comparison | null;
  polarity?: Polarity;
  /** Короткая строка под значением (например, «сумма по дням 149»). */
  note?: string;
  /** Значения нет по объективной причине — показываем прочерк и почему. */
  unavailable?: string;
}) {
  const { label, tooltip } = labelOf(metricKey);
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span className="truncate">{label}</span>
        <Hint text={tooltip} label={label} />
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 tabular-nums truncate" data-testid={`kpi-${metricKey}`}>
        {unavailable ? '—' : formatMetric(value, format)}
      </div>
      <div className="mt-1.5 min-h-[20px]">
        {unavailable ? (
          <span className="text-xs text-amber-700">{unavailable}</span>
        ) : (
          <DeltaBadge cmp={cmp} format={format} polarity={polarity} ariaPrefix={`${label}, изменение к предыдущему периоду`} />
        )}
      </div>
      {note && !unavailable && <div className="mt-1 text-[11px] text-gray-400 truncate">{note}</div>}
    </div>
  );
}

export function Notice({ warning, tone = 'amber' }: { warning: Warning; tone?: 'amber' | 'gray' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div role="note" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {warning.text}
        {warning.tooltip && <Hint text={warning.tooltip} label={warning.text} />}
      </span>
    </div>
  );
}

export function StateBlock({ kind, message, onRetry }: { kind: 'loading' | 'empty' | 'error'; message?: string; onRetry?: () => void }) {
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" aria-hidden="true" />
        Загрузка…
      </div>
    );
  }
  if (kind === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
        <span className="text-rose-600">{message ?? 'Не удалось загрузить данные'}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-indigo-400 text-xs font-medium">
            Повторить
          </button>
        )}
      </div>
    );
  }
  return <div className="py-12 text-center text-gray-400 text-sm">{message ?? 'За этот период данных нет'}</div>;
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th scope="col" className={`py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

export function Td({ children, right, dim }: { children: ReactNode; right?: boolean; dim?: boolean }) {
  return <td className={`py-2 px-3 text-sm tabular-nums ${right ? 'text-right' : ''} ${dim ? 'text-gray-400' : 'text-gray-800'}`}>{children}</td>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-5">
      <table className="w-full min-w-[560px]">{children}</table>
    </div>
  );
}
