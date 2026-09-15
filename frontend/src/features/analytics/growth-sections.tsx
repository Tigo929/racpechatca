import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { growthApi } from '../../api/analytics';
import type {
  AnalyticsChangeRecord,
  ChangeInput,
  ChangeType,
  ExpectedDirection,
  GrowthEvaluation,
  GrowthEvaluationSummary,
  GrowthMetricDefinition,
  GrowthMetricKey,
  GrowthStatus,
  MetricEvaluation,
  SegmentEvaluation,
} from '../../types/growth';
import { DEVICE_LABELS, formatPeriod } from './analytics-view';
import {
  AUDIENCE_LABELS,
  CHANGE_TYPE_LABELS,
  CONFOUNDER_LABELS,
  DIRECTION_LABELS,
  FLAG_LABELS,
  MATURITY_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
  VERDICT_LABELS,
  VERDICT_TONE,
  deltaIsHeadline,
  formatBasis,
  formatDateRu,
  formatDifference,
  formatInterval,
  formatMoscow,
  formatValue,
  mdeText,
  pValueText,
} from './growth-view';
import { Card, Hint, StateBlock, TableWrap, Td, Th } from './ui';

/**
 * Раздел «Рост / Изменения» (этап 11, раздел 21): реестр изменений, форма
 * регистрации и оценка «до / после». Компоненты ничего не считают — окна,
 * статистика, вердикты и тексты приходят из /analytics/dashboard/growth/*.
 * Дельта показывается крупно только при вердикте, который о ней говорит;
 * при INSUFFICIENT_DATA заголовок — «данных недостаточно», а не «+40 %».
 */

const KEYS = { status: ['analytics', 'growth', 'status'], list: ['analytics', 'growth', 'changes'] } as const;

function errorMessage(e: unknown): string {
  const anyErr = e as { response?: { data?: { message?: string | string[] } }; message?: string };
  const m = anyErr.response?.data?.message;
  if (Array.isArray(m)) return m.join('; ');
  return m ?? anyErr.message ?? 'Ошибка запроса';
}

function VerdictBadge({ verdict, maturity }: { verdict: GrowthEvaluation['verdict']; maturity?: GrowthEvaluation['maturity'] }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${VERDICT_TONE[verdict]}`} data-testid={`verdict-${verdict}`}>
      {VERDICT_LABELS[verdict]}
      {maturity && maturity !== 'MATURE' && <span className="opacity-70">· {MATURITY_LABELS[maturity]}</span>}
    </span>
  );
}

function StatusBadge({ status }: { status: AnalyticsChangeRecord['status'] }) {
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

function Disclaimer() {
  return (
    <p className="text-[11px] text-gray-500 border-l-2 border-gray-300 pl-2" data-testid="growth-disclaimer">
      Совпадение по времени не доказывает, что изменение вызвало результат: это наблюдение «до / после» без рандомизации (причинность не установлена).
    </p>
  );
}

// ── Список ──────────────────────────────────────────────────────────────────

function ChangeCard({ c, metric, selected, onSelect }: { c: AnalyticsChangeRecord; metric: GrowthMetricDefinition | undefined; selected: boolean; onSelect: () => void }) {
  const ev = c.latestEvaluation;
  const metricLabel = metric?.label ?? c.primaryMetric;
  const m = { kind: metric?.kind ?? ('count' as const), unit: metric?.unit ?? ('events' as const) };
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-left rounded-xl border p-3 transition ${selected ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200 bg-white hover:border-gray-300'}`}
      data-testid={`change-card-${c.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
        <StatusBadge status={c.status} />
        <span className="text-[11px] text-gray-500">{CHANGE_TYPE_LABELS[c.changeType]} · {c.surface}</span>
      </div>
      <div className="mt-1 text-xs text-gray-600">
        В production с {formatMoscow(c.startedAt)}{c.endedAt ? ` до ${formatMoscow(c.endedAt)}` : ''}; первичная метрика — {metricLabel} ({DIRECTION_LABELS[c.expectedDirection]})
        {c.audienceDefinition && ` · аудитория: ${AUDIENCE_LABELS[c.audienceDefinition.dimension] ?? c.audienceDefinition.dimension} = ${c.audienceDefinition.values.join(', ')}`}
      </div>
      {ev ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <VerdictBadge verdict={ev.verdict} maturity={ev.maturity} />
          <span className="text-gray-700 tabular-nums">
            {formatValue(m, ev.before)} → {formatValue(m, ev.after)}
            {deltaIsHeadline(ev.verdict) ? <span className="ml-1 font-medium">{formatDifference(m, ev.absoluteDifference, ev.relativeDifference)}</span> : <span className="ml-1 text-gray-400">разница не оценивается</span>}
          </span>
          <span className="text-gray-400">
            окна {formatPeriod(ev.windows.before.from, ev.windows.before.to)} → {formatPeriod(ev.windows.after.from, ev.windows.after.to)} · оценка v{ev.version} от {formatDateRu(ev.evaluatedAt)}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-400">Оценок ещё нет</div>
      )}
    </button>
  );
}

// ── Форма ───────────────────────────────────────────────────────────────────

const EMPTY: ChangeInput = {
  name: '',
  description: '',
  status: 'ACTIVE',
  changeType: 'SITE',
  startedAt: '',
  surface: 'site:form',
  primaryMetric: 'siteLeadRate',
  secondaryMetrics: [],
  expectedDirection: 'INCREASE',
  hypothesis: '',
  evaluationDays: null,
  maturityDays: null,
  audienceDefinition: null,
};

/** Ввод «ГГГГ-ММ-ДДTЧЧ:ММ» трактуется как московское время — бизнес живёт в Europe/Moscow. */
function moscowInputToIso(v: string): string {
  return new Date(`${v}:00+03:00`).toISOString();
}

export function ChangeForm({ status, onSaved, onCancel }: { status: GrowthStatus; onSaved: (c: AnalyticsChangeRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState<ChangeInput>(EMPTY);
  const [startedLocal, setStartedLocal] = useState('');
  const [endedLocal, setEndedLocal] = useState('');
  const [audienceValues, setAudienceValues] = useState('');
  const [audienceDim, setAudienceDim] = useState<'' | 'device' | 'source' | 'utm' | 'landing'>('');
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: ChangeInput) => growthApi.create(input),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: KEYS.list });
      void qc.invalidateQueries({ queryKey: KEYS.status });
      onSaved(c);
    },
  });
  const metrics = status.metrics;
  const primaryOptions = metrics.filter((m) => m.primaryFor.includes(form.changeType));
  const contextOptions = metrics.filter((m) => !m.primaryFor.includes(form.changeType));
  const set = <K extends keyof ChangeInput>(k: K, v: ChangeInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!startedLocal) return;
    create.mutate({
      ...form,
      name: form.name.trim(),
      surface: form.surface.trim(),
      startedAt: moscowInputToIso(startedLocal),
      endedAt: endedLocal ? moscowInputToIso(endedLocal) : null,
      audienceDefinition: audienceDim && audienceValues.trim() ? { dimension: audienceDim, values: audienceValues.split(',').map((s) => s.trim()).filter(Boolean) } : null,
      description: form.description?.trim() || undefined,
      hypothesis: form.hypothesis?.trim() || null,
    });
  };
  const field = 'mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none';
  return (
    <Card title="Новое изменение" subtitle="Зафиксируйте, что и когда вышло в production, и заявите первичную метрику до оценки — после первой оценки её изменить нельзя">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2" aria-label="Новое изменение">
        <label className="text-xs text-gray-600 md:col-span-2">
          Название
          <input className={field} required maxLength={200} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Например: новая форма заявки на главной" />
        </label>
        <label className="text-xs text-gray-600">
          Тип изменения
          <select className={field} value={form.changeType} onChange={(e) => set('changeType', e.target.value as ChangeType)}>
            {status.changeTypes.map((t) => <option key={t} value={t}>{CHANGE_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Поверхность <Hint text="Короткий код затронутой части: site:form, site:catalog, site:mobile, crm:workflow, pricing:photo …" label="поверхность" />
          <input className={field} required maxLength={80} value={form.surface} onChange={(e) => set('surface', e.target.value)} />
        </label>
        <label className="text-xs text-gray-600">
          Вышло в production (московское время)
          <input className={field} type="datetime-local" required value={startedLocal} onChange={(e) => setStartedLocal(e.target.value)} />
        </label>
        <label className="text-xs text-gray-600">
          Закончилось (если выключили)
          <input className={field} type="datetime-local" value={endedLocal} onChange={(e) => setEndedLocal(e.target.value)} />
        </label>
        <label className="text-xs text-gray-600">
          Первичная метрика <Hint text="Что именно должно измениться. Для правки сайта — метрики сайта; итоги CRM и деньги покажутся рядом как контекст." label="первичная метрика" />
          <select className={field} value={form.primaryMetric} onChange={(e) => set('primaryMetric', e.target.value as GrowthMetricKey)}>
            <optgroup label="Отвечают на вопрос этого типа изменения">
              {primaryOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </optgroup>
            <optgroup label="Только контекст (будет METRIC_SCOPE_MISMATCH)">
              {contextOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Ожидаемое направление
          <select className={field} value={form.expectedDirection} onChange={(e) => set('expectedDirection', e.target.value as ExpectedDirection)}>
            {(['INCREASE', 'DECREASE', 'NEUTRAL'] as ExpectedDirection[]).map((d) => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Длина окна сравнения
          <select className={field} value={form.evaluationDays ?? ''} onChange={(e) => set('evaluationDays', e.target.value ? Number(e.target.value) : null)}>
            <option value="">авто — целые недели по доступным дням</option>
            {status.defaults.evaluationDaysOptions.map((d) => <option key={d} value={d}>{d} дней</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Созревание CRM-исходов, дней <Hint text="Пусто — по истории CRM (p90 задержки заявка → оплата) или 14 дней по умолчанию." label="созревание" />
          <input className={field} type="number" min={0} max={90} value={form.maturityDays ?? ''} onChange={(e) => set('maturityDays', e.target.value ? Number(e.target.value) : null)} />
        </label>
        <div className="text-xs text-gray-600 md:col-span-2 grid gap-2 sm:grid-cols-[180px_1fr]">
          <label>
            Аудитория (необязательно)
            <select className={field} value={audienceDim} onChange={(e) => setAudienceDim(e.target.value as typeof audienceDim)}>
              <option value="">вся аудитория</option>
              {status.audienceDimensions.map((d) => <option key={d} value={d}>{AUDIENCE_LABELS[d] ?? d}</option>)}
            </select>
          </label>
          <label>
            Значения через запятую (например: mobile или /futbolki/svoy-print)
            <input className={field} value={audienceValues} onChange={(e) => setAudienceValues(e.target.value)} disabled={!audienceDim} />
          </label>
        </div>
        <label className="text-xs text-gray-600 md:col-span-2">
          Гипотеза (до оценки)
          <textarea className={field} rows={2} maxLength={4000} value={form.hypothesis ?? ''} onChange={(e) => set('hypothesis', e.target.value)} placeholder="Что должно произойти и почему" />
        </label>
        <label className="text-xs text-gray-600 md:col-span-2">
          Описание / ссылка на деплой
          <textarea className={field} rows={2} maxLength={4000} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={create.isPending} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {create.isPending ? 'Сохраняем…' : 'Зарегистрировать'}
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-800">Отмена</button>
          {create.isError && <span className="text-xs text-rose-600" role="alert">{errorMessage(create.error)}</span>}
          <span className="text-[11px] text-gray-400">Без личных данных: только внутренние описания и аналитические измерения.</span>
        </div>
      </form>
    </Card>
  );
}

// ── Оценка ──────────────────────────────────────────────────────────────────

function MetricRow({ m }: { m: MetricEvaluation }) {
  const s = m.statistics;
  return (
    <tr className="border-t border-gray-100" data-testid={`metric-row-${m.metric}`}>
      <Td>
        {m.label}
        {m.scopeCompatibility !== 'valid' && <span className="ml-1 text-[10px] text-gray-400">{m.scopeCompatibility === 'mismatch' ? 'не по области' : 'контекст'}</span>}
      </Td>
      <Td right>{formatValue(m, m.before)} <span className="text-[10px] text-gray-400">{formatBasis(m, m.before)}</span></Td>
      <Td right>{formatValue(m, m.after)} <span className="text-[10px] text-gray-400">{formatBasis(m, m.after)}</span></Td>
      <Td right dim={!deltaIsHeadline(m.verdict)}>{s ? formatDifference(m, s.absoluteDifference, s.relativeDifference) : '—'}</Td>
      <Td><VerdictBadge verdict={m.verdict} maturity={m.maturity.status} /></Td>
    </tr>
  );
}

function SegmentRow({ s, m }: { s: SegmentEvaluation; m: Pick<MetricEvaluation, 'kind' | 'unit'> }) {
  const label = s.dimension === 'device' ? (DEVICE_LABELS[s.value] ?? s.value) : s.value;
  return (
    <tr className="border-t border-gray-100" data-testid={`segment-${s.dimension}-${s.value}`}>
      <Td>{AUDIENCE_LABELS[s.dimension] ?? s.dimension}: {label} <span className="text-[10px] text-gray-400">{s.role === 'audience' ? 'аудитория изменения' : 'исследовательский'}</span></Td>
      <Td right>{formatValue(m, s.before)}</Td>
      <Td right>{formatValue(m, s.after)}</Td>
      <Td right dim={!deltaIsHeadline(s.verdict)}>{s.statistics ? formatDifference(m, s.statistics.absoluteDifference, s.statistics.relativeDifference) : '—'}</Td>
      <Td>{s.flags.includes('UNSUPPORTED_SEGMENT') ? <span className="text-xs text-gray-500">{FLAG_LABELS.UNSUPPORTED_SEGMENT}</span> : <VerdictBadge verdict={s.verdict} />}</Td>
    </tr>
  );
}

export function EvaluationView({ evaluation: e }: { evaluation: GrowthEvaluation }) {
  const p = e.primary;
  const s = p.statistics;
  const interval = formatInterval(p, s);
  const mde = mdeText(p);
  return (
    <div className="space-y-4" data-testid="evaluation-view">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>Окна: <b>до</b> {formatPeriod(e.windows.before.from, e.windows.before.to)} → <b>после</b> {formatPeriod(e.windows.after.from, e.windows.after.to)} ({e.windows.days} дн.)</span>
        {e.windows.cutoverDayExcluded && <span className="text-gray-400">· день изменения {formatDateRu(e.windows.cutoverDay)} исключён</span>}
        <span className="text-gray-400">· данные по {formatDateRu(e.windows.observationCutoff)} · оценка v{e.version} ({e.trigger === 'scheduler' ? 'расписание' : 'вручную'}) {formatMoscow(e.evaluatedAt)}</span>
      </div>

      <div className={`rounded-xl border p-4 ${VERDICT_TONE[e.verdict]}`} data-testid="primary-result">
        <div className="flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={e.verdict} maturity={e.maturity} />
          <span className="text-sm font-semibold">{p.label}</span>
          <span className="text-xs opacity-70">{DIRECTION_LABELS[e.expectedDirection]}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-4 tabular-nums">
          <div>
            <div className="text-[11px] uppercase tracking-wide opacity-60">до</div>
            <div className="text-xl font-bold">{formatValue(p, p.before)}</div>
            <div className="text-[11px] opacity-70">{formatBasis(p, p.before)}</div>
          </div>
          <div className="text-2xl opacity-40">→</div>
          <div>
            <div className="text-[11px] uppercase tracking-wide opacity-60">после</div>
            <div className="text-xl font-bold">{formatValue(p, p.after)}</div>
            <div className="text-[11px] opacity-70">{formatBasis(p, p.after)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide opacity-60">разница</div>
            <div className={`text-xl ${deltaIsHeadline(e.verdict) ? 'font-bold' : 'font-normal opacity-60'}`} data-testid="primary-delta">
              {s ? formatDifference(p, s.absoluteDifference, s.relativeDifference) : '—'}
            </div>
            {!deltaIsHeadline(e.verdict) && <div className="text-[11px] opacity-70">не является выводом — см. вердикт</div>}
          </div>
        </div>
        <div className="mt-2 text-xs space-y-0.5">
          {interval && <div>{interval}{pValueText(s?.pValue ?? null) ? `; ${pValueText(s?.pValue ?? null)}` : ''}</div>}
          {s && <div className="opacity-70">Метод: {METHOD_LABELS[s.method]}; α = {s.assumptions.alpha}, мощность {s.assumptions.power}</div>}
          {mde && <div data-testid="mde-text">{mde}</div>}
          {p.comparability.note && <div className="font-medium">{p.comparability.note}</div>}
          {p.maturity.note && <div>{p.maturity.note}</div>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-sm">
        <div className="rounded-lg border border-gray-200 p-3"><div className="text-[11px] uppercase tracking-wide text-gray-500">Факт</div><p className="mt-1 text-gray-800" data-testid="fact">{e.FACT}</p></div>
        <div className="rounded-lg border border-gray-200 p-3"><div className="text-[11px] uppercase tracking-wide text-gray-500">Интерпретация</div><p className="mt-1 text-gray-800" data-testid="interpretation">{e.INTERPRETATION}</p></div>
        <div className="rounded-lg border border-gray-200 p-3"><div className="text-[11px] uppercase tracking-wide text-gray-500">Что делать</div><p className="mt-1 text-gray-800" data-testid="recommendation">{e.RECOMMENDATION}</p></div>
      </div>
      <Disclaimer />

      {e.confounders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Оговорки ({e.confounders.length})</h3>
          <ul className="mt-1 space-y-1 text-xs text-gray-700">
            {e.confounders.map((c) => (
              <li key={c.code} className="flex gap-2" data-testid={`confounder-${c.code}`}>
                <span className={`shrink-0 rounded px-1.5 ${c.severity === 'ATTENTION' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{CONFOUNDER_LABELS[c.code]}</span>
                <span>
                  {c.fact}
                  {c.shares && <span className="text-gray-400"> — {c.shares.map((x) => `${x.key}: ${x.before?.toFixed(0) ?? '—'} % → ${x.after?.toFixed(0) ?? '—'} %`).join('; ')}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(e.secondary.length > 0 || e.context.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Другие метрики <span className="text-xs font-normal text-gray-500">вторичные — исследовательские; контекст описывает бизнес, а не эффект изменения</span></h3>
          <TableWrap>
            <thead><tr><Th>Метрика</Th><Th right>До</Th><Th right>После</Th><Th right>Разница</Th><Th>Вердикт</Th></tr></thead>
            <tbody>
              {e.secondary.map((m) => <MetricRow key={m.metric} m={m} />)}
              {e.context.map((m) => <MetricRow key={m.metric} m={m} />)}
            </tbody>
          </TableWrap>
        </div>
      )}

      {e.segments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Сегменты <span className="text-xs font-normal text-gray-500">по первичной метрике; только там, где хранимые агрегаты дают честные числа</span></h3>
          <TableWrap>
            <thead><tr><Th>Сегмент</Th><Th right>До</Th><Th right>После</Th><Th right>Разница</Th><Th>Вердикт</Th></tr></thead>
            <tbody>{e.segments.map((s) => <SegmentRow key={`${s.dimension}-${s.value}`} s={s} m={p} />)}</tbody>
          </TableWrap>
        </div>
      )}

      <div className="text-[11px] text-gray-500">
        <div>
          Уникальные посетители за окна: до {e.periodUsers.before ?? '—'}, после {e.periodUsers.after ?? '—'}{(e.periodUsers.before === null || e.periodUsers.after === null) && ' — точные снимки окон ещё не сняты; сумма дневных не подставляется'}.
          Покрытие ClientID у принятых: до {e.dataQuality.clientIdCoverageAccepted.before?.toFixed(0) ?? '—'} %, после {e.dataQuality.clientIdCoverageAccepted.after?.toFixed(0) ?? '—'} %.
        </div>
        {e.dataQuality.flags.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer">Пометки качества данных: {e.dataQuality.flags.length}</summary>
            <ul className="mt-1 list-disc pl-5">{e.dataQuality.flags.map((f) => <li key={f}>{FLAG_LABELS[f] ?? f}</li>)}</ul>
          </details>
        )}
        <div className="mt-1">
          Созревание: принятые {e.maturityPolicy.daysByClass.accepted} дн., оплаты {e.maturityPolicy.daysByClass.paid} дн. ({e.maturityPolicy.source.paid === 'empirical' ? `p90 по истории CRM, выборка ${e.maturityPolicy.acceptedToPaid.sample}` : e.maturityPolicy.source.paid === 'configured' ? 'задано в изменении' : 'по умолчанию — истории мало'}).
        </div>
      </div>
    </div>
  );
}

// ── Детали изменения ────────────────────────────────────────────────────────

function ChangeDetail({ change, metrics }: { change: AnalyticsChangeRecord; metrics: GrowthMetricDefinition[] }) {
  const qc = useQueryClient();
  const [version, setVersion] = useState<number | null>(null);
  const history = useQuery({ queryKey: ['analytics', 'growth', 'evaluations', change.id], queryFn: () => growthApi.evaluations(change.id) });
  const latest = useQuery({
    queryKey: ['analytics', 'growth', 'evaluation', change.id, version ?? 'latest'],
    queryFn: () => (version ? growthApi.evaluation(change.id, version) : growthApi.latestEvaluation(change.id)),
    enabled: change.latestEvaluation !== null,
    retry: false,
  });
  const evaluate = useMutation({
    mutationFn: () => growthApi.evaluate(change.id),
    onSuccess: () => {
      setVersion(null);
      void qc.invalidateQueries({ queryKey: KEYS.list });
      void qc.invalidateQueries({ queryKey: ['analytics', 'growth', 'evaluations', change.id] });
      void qc.invalidateQueries({ queryKey: ['analytics', 'growth', 'evaluation', change.id] });
    },
  });
  const metric = metrics.find((m) => m.key === change.primaryMetric);
  return (
    <Card
      title={<span>{change.name} <StatusBadge status={change.status} /></span>}
      subtitle={`${CHANGE_TYPE_LABELS[change.changeType]} · ${change.surface} · с ${formatMoscow(change.startedAt)}${change.deploymentRef ? ` · ${change.deploymentRef}` : ''}`}
    >
      <div className="text-xs text-gray-600 space-y-1">
        <div>Первичная метрика: <b>{metric?.label ?? change.primaryMetric}</b> ({DIRECTION_LABELS[change.expectedDirection]}){change.primaryLockedAt && <span className="text-gray-400"> · зафиксирована первой оценкой</span>}</div>
        {change.hypothesis && <div>Гипотеза: {change.hypothesis}</div>}
        {change.description && <div className="text-gray-500">{change.description}</div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => evaluate.mutate()}
          disabled={evaluate.isPending || change.status === 'CANCELLED'}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {evaluate.isPending ? 'Считаем…' : change.latestEvaluation ? 'Оценить заново' : 'Оценить сейчас'}
        </button>
        {evaluate.isError && <span className="text-xs text-rose-600" role="alert">{errorMessage(evaluate.error)}</span>}
        {history.data && history.data.length > 1 && (
          <label className="text-xs text-gray-600">
            Версия оценки
            <select className="ml-1 rounded-md border border-gray-300 px-1 py-0.5 text-xs" value={version ?? ''} onChange={(e) => setVersion(e.target.value ? Number(e.target.value) : null)}>
              <option value="">последняя</option>
              {history.data.map((h: GrowthEvaluationSummary) => <option key={h.id} value={h.version}>v{h.version} · {formatDateRu(h.evaluatedAt)} · {VERDICT_LABELS[h.verdict]}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="mt-4">
        {!change.latestEvaluation && !evaluate.isPending && <StateBlock kind="empty" message="Оценки ещё нет — нажмите «Оценить сейчас», когда после изменения пройдёт хотя бы один полный день" />}
        {change.latestEvaluation && latest.isPending && <StateBlock kind="loading" />}
        {latest.isError && <StateBlock kind="error" message={errorMessage(latest.error)} onRetry={() => void latest.refetch()} />}
        {latest.data && <EvaluationView evaluation={latest.data} />}
      </div>
    </Card>
  );
}

// ── Раздел ──────────────────────────────────────────────────────────────────

export function GrowthTab() {
  const status = useQuery({ queryKey: KEYS.status, queryFn: growthApi.status, staleTime: 5 * 60_000 });
  const list = useQuery({ queryKey: KEYS.list, queryFn: growthApi.list, enabled: status.data?.enabled === true, staleTime: 15_000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  if (status.isPending) return <Card title="Рост / Изменения"><StateBlock kind="loading" /></Card>;
  if (status.isError) return <Card title="Рост / Изменения"><StateBlock kind="error" message={errorMessage(status.error)} onRetry={() => void status.refetch()} /></Card>;
  const st = status.data!;
  if (!st.enabled) return <Card title="Рост / Изменения"><StateBlock kind="empty" message="Раздел аналитики выключен" /></Card>;
  const changes = list.data ?? [];
  const selected = changes.find((c) => c.id === selectedId) ?? changes[0] ?? null;
  const metricOf = (k: GrowthMetricKey) => st.metrics.find((m) => m.key === k);
  return (
    <div className="space-y-4">
      <Card
        title="Рост / Изменения"
        subtitle="Реестр изменений сайта, CRM и цен и честная оценка «до / после»: равные окна полных дней, статистическая неопределённость, созревание CRM-исходов и оговорки"
      >
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span>Изменений: действует {st.counts.ACTIVE}, завершено {st.counts.COMPLETED}, черновиков {st.counts.DRAFT}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5" data-testid="ab-capability">A/B-тесты с разделением аудитории недоступны (NO_VARIANT_ASSIGNMENT) — все оценки наблюдательные</span>
          <button type="button" onClick={() => setShowForm((v) => !v)} className="ml-auto rounded-md border border-indigo-300 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-50">
            {showForm ? 'Скрыть форму' : '+ Новое изменение'}
          </button>
        </div>
        <div className="mt-2"><Disclaimer /></div>
      </Card>
      {showForm && <ChangeForm status={st} onSaved={(c) => { setShowForm(false); setSelectedId(c.id); }} onCancel={() => setShowForm(false)} />}
      {list.isPending && <Card><StateBlock kind="loading" /></Card>}
      {list.isError && <Card><StateBlock kind="error" message={errorMessage(list.error)} onRetry={() => void list.refetch()} /></Card>}
      {list.data && changes.length === 0 && <Card><StateBlock kind="empty" message="Изменений пока нет — зарегистрируйте первое: что, когда и какую метрику ждём" /></Card>}
      {changes.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
          <div className="space-y-2" aria-label="Список изменений">
            {changes.map((c) => <ChangeCard key={c.id} c={c} metric={metricOf(c.primaryMetric)} selected={selected?.id === c.id} onSelect={() => setSelectedId(c.id)} />)}
          </div>
          <div className="min-w-0">{selected && <ChangeDetail key={selected.id} change={selected} metrics={st.metrics} />}</div>
        </div>
      )}
    </div>
  );
}
