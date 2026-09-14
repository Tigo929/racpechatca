import { useState } from 'react';
import type { Trend } from '../../types/analytics';
import { formatMetric, TREND_METRICS, type TrendMetric } from './analytics-view';
import { Hint } from './ui';

/**
 * Динамика по дням (этап 09, раздел 14): один показатель за раз, чтобы не
 * класть визиты и рубли на одну ось. Столбики на SVG без библиотек —
 * данных не больше 366 точек, и лишняя зависимость здесь не нужна.
 */
const W = 720;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${m}`;
}

export function TrendChart({ trend }: { trend: Trend }) {
  const [metric, setMetric] = useState<TrendMetric>('visits');
  const def = TREND_METRICS.find((m) => m.key === metric) ?? TREND_METRICS[0];
  const points = trend.points;
  const values = points.map((p) => p[metric]);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = innerW / Math.max(points.length, 1);
  // Не шире 96 px: у периода в один-два дня столбик иначе занимает весь график.
  const barW = Math.min(96, Math.max(2, step * 0.7));
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;
  const zeroY = y(0);
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3" role="group" aria-label="Показатель графика">
        {TREND_METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              metric === m.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 tabular-nums">
          {def.label}, сумма по дням: <span className="font-semibold text-gray-800">{formatMetric(total, def.format)}</span>
          {def.sumNote && <Hint text={def.sumNote} label={`${def.label}, сумма по дням`} />}
        </span>
      </div>
      {points.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">Нет данных за период</div>
      ) : values.every((v) => v === 0) ? (
        <div className="py-10 text-center text-sm text-gray-400">{def.label}: за этот период нулевые значения — рисовать нечего</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${def.label} по дням, ${points.length} дней, максимум ${formatMetric(max, def.format)}`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="#E2E8F0" strokeWidth={1} />
          {[0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(min + span * f)} y2={y(min + span * f)} stroke="#F1F5F9" strokeWidth={1} />
              <text x={PAD.left + 2} y={y(min + span * f) - 3} fontSize={10} fill="#94A3B8">
                {formatMetric(Math.round(min + span * f), def.format)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const v = p[metric];
            const x = PAD.left + i * step + (step - barW) / 2;
            const top = Math.min(y(v), zeroY);
            const h = Math.max(Math.abs(zeroY - y(v)), v === 0 ? 0 : 1);
            return (
              <g key={p.date}>
                <rect x={x} y={top} width={barW} height={h} rx={2} fill={v < 0 ? '#F43F5E' : '#4338CA'} opacity={v === 0 ? 0.25 : 0.9}>
                  <title>{`${shortDate(p.date)}: ${formatMetric(v, def.format)}`}</title>
                </rect>
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 8} fontSize={10} textAnchor="middle" fill="#64748B">
                    {shortDate(p.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
