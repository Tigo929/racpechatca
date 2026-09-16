import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { insightsApi } from '../../api/analytics';
import type {
  FeedFilter,
  InsightCategory,
  InsightRecord,
  InsightSeverity,
  InsightsFeed,
  InsightsStatus,
  SuppressionReason,
} from '../../types/insights';
import { Card, StateBlock } from './ui';
import {
  CATEGORY_LABELS,
  LINK_LABELS,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  SOURCE_LABELS,
  STATUS_LABELS,
  SUPPRESSION_LABELS,
  formatMoscowShort,
  limitationLabel,
  periodText,
} from './insights-view';

/**
 * Раздел «Инсайты» (этап 12): очередь того, что требует внимания. Карточка —
 * FACT (числа) → ГИПОТЕЗА (явно помечена, другой шрифт и фон) → ЧТО ПРОВЕРИТЬ,
 * ограничения и качество данных, статус и действия. Тексты приходят из API;
 * здесь ничего не считается и не переформулируется.
 */

const KEYS = {
  status: ['analytics', 'insights', 'status'] as const,
  feed: (f: FeedFilter) => ['analytics', 'insights', 'feed', f] as const,
  quality: ['analytics', 'insights', 'quality'] as const,
};

function errorMessage(e: unknown): string {
  const anyErr = e as { response?: { data?: { message?: string | string[] } }; message?: string };
  const m = anyErr.response?.data?.message;
  if (Array.isArray(m)) return m.join('; ');
  return m ?? anyErr.message ?? 'Ошибка запроса';
}

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${SEVERITY_TONE[severity]}`} data-testid={`severity-${severity}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function Disclaimer() {
  return (
    <p className="text-[11px] text-gray-500 border-l-2 border-gray-300 pl-2" data-testid="insights-disclaimer">
      Сигнал — наблюдение по данным, а не установленная причина: совпадение по времени не доказывает связь (причинность не установлена). Отсутствие сигналов не означает, что проблем нет.
    </p>
  );
}

export function InsightCard({ insight: i, onAcknowledge, onResolve, busy }: { insight: InsightRecord; onAcknowledge?: (id: string) => void; onResolve?: (id: string, reason: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const active = i.status === 'OPEN' || i.status === 'ACKNOWLEDGED';
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm ${i.severity === 'CRITICAL' ? 'border-red-300' : i.severity === 'ATTENTION' ? 'border-amber-300' : 'border-gray-200'}`} data-testid={`insight-${i.id}`} data-severity={i.severity}>
      <header className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <SeverityBadge severity={i.severity} />
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700" data-testid="insight-category">{CATEGORY_LABELS[i.category]}</span>
        <span data-testid="insight-period">{periodText(i)}</span>
        <span className={`ml-auto rounded px-1.5 py-0.5 ${i.status === 'OPEN' ? 'bg-indigo-50 text-indigo-700' : i.status === 'ACKNOWLEDGED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`} data-testid="insight-status">
          {STATUS_LABELS[i.status]}
        </span>
      </header>
      <h3 className="mt-2 text-base font-semibold text-gray-900" data-testid="insight-title">{i.title}</h3>

      <section className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Факт</div>
          <p className="mt-1 text-sm text-gray-900" data-testid="insight-fact">{i.fact.text}</p>
        </div>
        <div className={`rounded-lg border p-3 ${i.hypothesis.status === 'SUPPORTED_BY_CONCURRENT_FACTS' ? 'border-dashed border-indigo-200 bg-indigo-50/40' : 'border-dashed border-gray-200 bg-gray-50'}`} data-testid="insight-hypothesis" data-hypothesis-status={i.hypothesis.status}>
          <div className="text-[11px] uppercase tracking-wide text-indigo-700">Гипотеза — не факт</div>
          <p className="mt-1 text-sm italic text-gray-700">{i.hypothesis.text ?? 'Гипотезы нет.'}</p>
          {i.hypothesis.supportingFacts.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-gray-600">
              {i.hypothesis.supportingFacts.map((f, idx) => <li key={idx}>{f}</li>)}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Что проверить</div>
          <p className="mt-1 text-sm text-gray-900" data-testid="insight-recommendation">{i.recommendation.text}</p>
        </div>
      </section>

      {i.limitations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="insight-limitations">
          {i.limitations.map((l) => <span key={l} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800" title={l}>{limitationLabel(l)}</span>)}
        </div>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>Данные: {i.quality.freshness === 'FRESH' ? 'свежие' : i.quality.freshness === 'STALE' ? 'устарели' : 'нет'}</span>
        <span>Впервые {formatMoscowShort(i.firstDetectedAt)} · последний раз {formatMoscowShort(i.lastDetectedAt)} · версия {i.latestVersion}{i.episode > 1 ? ` · эпизод ${i.episode}` : ''}</span>
        <span>Источник: {SOURCE_LABELS[i.source]}</span>
        {i.link && (
          <Link to={`/crm/analytics?tab=${i.link.tab}`} className="text-indigo-700 underline-offset-2 hover:underline" data-testid="insight-link">
            Открыть «{LINK_LABELS[i.link.tab]}»
          </Link>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-gray-600 underline-offset-2 hover:underline">{open ? 'Скрыть детали' : 'Детали'}</button>
        {active && onAcknowledge && i.status === 'OPEN' && (
          <button type="button" disabled={busy} onClick={() => onAcknowledge(i.id)} className="ml-auto rounded-md border border-emerald-300 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" data-testid="acknowledge">
            Принять к сведению
          </button>
        )}
      </footer>

      {open && (
        <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-700" data-testid="insight-details">
          <div>Сила статистики: {i.evidence.statisticalStrength} · существенность для бизнеса: {i.evidence.businessMateriality} · детектор {i.evidence.rule.detectorId}{i.evidence.verdict ? ` · вердикт этапа 11: ${i.evidence.verdict}` : ''}</div>
          {i.evidence.context.length > 0 && (
            <div>Контекст: {i.evidence.context.map((c) => `${c.metric} ${c.before ?? '—'} → ${c.after ?? '—'}`).join('; ')}</div>
          )}
          {i.evidence.confounders.length > 0 && (
            <ul className="list-disc pl-4">{i.evidence.confounders.map((c) => <li key={c.code}>{c.fact}</li>)}</ul>
          )}
          {i.quality.notes.length > 0 && <div className="text-gray-500">{i.quality.notes.join(' ')}</div>}
          {i.resolvedReason && <div>Закрыт: {i.resolvedReason}</div>}
          {active && onResolve && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина закрытия (не короче 3 символов)" className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs" data-testid="resolve-reason" />
              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => onResolve(i.id, reason.trim())} className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-white disabled:opacity-50" data-testid="resolve">
                Закрыть вручную
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SuppressedSummary({ summary, lastRun }: { summary: InsightsFeed['suppressedSummary']; lastRun: InsightsFeed['lastRun'] }) {
  const entries = (Object.entries(summary) as [SuppressionReason, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <details className="text-xs text-gray-600" data-testid="suppressed-summary">
      <summary className="cursor-pointer">
        Правил без вывода в последнем запуске: {total}
        {lastRun ? ` (запуск ${lastRun.kind} ${formatMoscowShort(lastRun.startedAt)}, ${lastRun.status}${lastRun.observationCutoff ? `, данные по ${lastRun.observationCutoff}` : ''})` : ''}
      </summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {entries.map(([reason, n]) => (
          <li key={reason} className="flex justify-between gap-2 rounded bg-gray-50 px-2 py-1">
            <span>{SUPPRESSION_LABELS[reason]}</span>
            <span className="tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-gray-500">Молчание правила — не подтверждение отсутствия проблем, а причина: мало данных, окна несопоставимы, исход не созрел или изменение несущественно.</p>
    </details>
  );
}

export function InsightsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FeedFilter>({ status: 'active' });
  const status = useQuery({ queryKey: KEYS.status, queryFn: insightsApi.status, staleTime: 5 * 60_000 });
  const feed = useQuery({ queryKey: KEYS.feed(filter), queryFn: () => insightsApi.feed(filter), enabled: status.data?.enabled === true, staleTime: 15_000 });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['analytics', 'insights'] });
  };
  const ack = useMutation({ mutationFn: (id: string) => insightsApi.acknowledge(id), onSuccess: invalidate });
  const resolve = useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => insightsApi.resolve(id, reason), onSuccess: invalidate });

  if (status.isPending) return <Card title="Инсайты"><StateBlock kind="loading" /></Card>;
  if (status.isError) return <Card title="Инсайты"><StateBlock kind="error" message={errorMessage(status.error)} onRetry={() => void status.refetch()} /></Card>;
  const st: InsightsStatus = status.data!;
  if (!st.enabled) return <Card title="Инсайты"><StateBlock kind="empty" message="Раздел «Инсайты» выключен" /></Card>;

  const items = feed.data?.items ?? [];
  return (
    <div className="space-y-4">
      <Card title="Инсайты" subtitle="Очередь сигналов, которые стоит проверить: факт из данных, явно помеченная гипотеза и следующее действие. Не список KPI и не авто-решения">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span>Активных: {st.counts.OPEN + st.counts.ACKNOWLEDGED} · закрыто {st.counts.RESOLVED}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5">Детекторов {st.detectors.length} · окна {st.thresholds.rollingWindowDays} дн. · причинность не устанавливается</span>
          {st.boundaries.incident && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800" title={st.boundaries.incident.label}>Известная граница данных: инцидент 14–15.09</span>}
        </div>
        <div className="mt-2"><Disclaimer /></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs" data-testid="insight-filters">
          <select value={filter.status ?? 'active'} onChange={(e) => setFilter({ ...filter, status: e.target.value as FeedFilter['status'] })} className="rounded-md border border-gray-300 px-2 py-1" aria-label="Статус">
            <option value="active">Активные</option>
            <option value="all">Все</option>
            <option value="RESOLVED">Закрытые</option>
          </select>
          <select value={filter.severity ?? ''} onChange={(e) => setFilter({ ...filter, severity: (e.target.value || undefined) as InsightSeverity | undefined })} className="rounded-md border border-gray-300 px-2 py-1" aria-label="Уровень">
            <option value="">Любой уровень</option>
            {st.severities.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
          </select>
          <select value={filter.category ?? ''} onChange={(e) => setFilter({ ...filter, category: (e.target.value || undefined) as InsightCategory | undefined })} className="rounded-md border border-gray-300 px-2 py-1" aria-label="Категория">
            <option value="">Все категории</option>
            {st.categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
      </Card>

      {feed.isPending && <Card><StateBlock kind="loading" /></Card>}
      {feed.isError && <Card><StateBlock kind="error" message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} /></Card>}
      {feed.data && items.length === 0 && (
        <Card>
          <StateBlock kind="empty" message={filter.status === 'active' || !filter.status ? 'Сейчас нет сигналов, требующих внимания' : 'По этому фильтру сигналов нет'} />
        </Card>
      )}
      {items.map((i) => (
        <InsightCard key={i.id} insight={i} busy={ack.isPending || resolve.isPending} onAcknowledge={(id) => ack.mutate(id)} onResolve={(id, reason) => resolve.mutate({ id, reason })} />
      ))}
      {(ack.isError || resolve.isError) && <Card><StateBlock kind="error" message={errorMessage(ack.error ?? resolve.error)} /></Card>}
      {feed.data && (
        <Card>
          <SuppressedSummary summary={feed.data.suppressedSummary} lastRun={feed.data.lastRun} />
        </Card>
      )}
    </div>
  );
}
