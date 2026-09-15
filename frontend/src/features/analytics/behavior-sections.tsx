import { useState } from 'react';
import type { Comparison } from '../../types/analytics';
import type {
  BehaviorIssue,
  BehaviorIssues,
  BehaviorSummary,
  DevicesBehavior,
  FormErrors,
  Funnel,
  FunnelStep,
  PagesBehavior,
  PathPage,
  PathsBehavior,
} from '../../types/behavior';
import { formatCount, formatDelta, formatPercent, deltaTone, type Warning } from './analytics-view';
import {
  DEVICE_LABELS_BEHAVIOR,
  RULE_LABELS,
  SAMPLE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_TONE,
  SKIP_CODE_LABELS,
  UNIT_LABELS,
  UNIT_TOOLTIPS,
  behaviorWarnings,
  formatSeconds,
  partialTransitionText,
} from './behavior-view';
import { Card, Hint, Notice, StateBlock, TableWrap, Td, Th } from './ui';

/**
 * Раздел «Поведение» (этап 10, раздел 18): воронка шагами, направления,
 * ошибки форм, устройства, страницы, пути и карточки «Требует внимания».
 * Всё — из /analytics/dashboard/behavior/*; компоненты ничего не считают.
 */

function QualityNotices({ notes, tone = 'amber' }: { notes: Funnel['quality']['notes']; tone?: 'amber' | 'gray' }) {
  const warnings = behaviorWarnings(notes);
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-1.5 mt-3">
      {warnings.map((w: Warning) => (
        <Notice key={w.code} warning={w} tone={tone} />
      ))}
    </div>
  );
}

function SampleBadge({ status }: { status: 'OK' | 'LOW_SAMPLE' | 'INSUFFICIENT_DATA' }) {
  if (status === 'OK') return null;
  return <span className="ml-2 inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{SAMPLE_LABELS[status]}</span>;
}

// ── Воронка ────────────────────────────────────────────────────────────────

function StepRow({ step, prev, max, cmp }: { step: FunnelStep; prev: FunnelStep | null; max: number; cmp: Funnel['comparison'] }) {
  const measured = step.availability === 'measured';
  const width = measured && step.visits !== null && max > 0 ? Math.max(2, (step.visits / max) * 100) : 0;
  const c = cmp?.find((x) => x.key === step.key);
  const partial = step.transition?.status === 'partial';
  return (
    <li className={`rounded-lg px-3 py-2 ${measured ? 'bg-indigo-50' : 'bg-gray-50'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-xs text-gray-600">
          {step.label}
          {step.basis === 'param' && <span className="ml-1 text-[10px] text-gray-400">по параметрам визита</span>}
          {step.note && <Hint text={step.note} label={step.label} />}
        </div>
        {measured ? (
          <div className="flex items-baseline gap-3 tabular-nums">
            <span className="text-lg font-bold text-gray-900">
              {formatCount(step.visits)} <span className="text-[11px] font-normal text-gray-500">{UNIT_LABELS.visits}</span>
            </span>
            <span className="text-xs text-gray-500">
              {formatCount(step.events)} <span className="text-[10px]">{UNIT_LABELS.events}</span>
            </span>
            <span className="text-xs text-gray-500">
              {step.users === null ? '—' : formatCount(step.users)} <span className="text-[10px]">{UNIT_LABELS.users}</span>
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">{step.availability === 'not_measured' ? 'шаг не измеряется' : 'нет данных за период'}</span>
        )}
      </div>
      {measured && (
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded bg-white/70" aria-hidden="true">
            <div className="h-1.5 rounded bg-indigo-500" style={{ width: `${width}%` }} />
          </div>
          {step.stepConversion !== null && (
            <span className={`text-xs tabular-nums whitespace-nowrap ${partial ? 'text-gray-400' : 'text-gray-700'}`}>
              {formatPercent(step.stepConversion)} от пред. шага
              {step.dropoffRate !== null && <span className="text-gray-400"> · отвал {formatPercent(step.dropoffRate)}</span>}
              {c && <span className={`ml-1 ${deltaTone(c.visits, 'higher-good') === 'negative' ? 'text-rose-600' : deltaTone(c.visits, 'higher-good') === 'positive' ? 'text-emerald-600' : 'text-gray-400'}`}>{formatDelta(c.visits, 'count')}</span>}
            </span>
          )}
        </div>
      )}
      {measured && partial && step.stepConversion !== null && (
        <p className="mt-1 text-[11px] text-amber-700" data-testid={`partial-transition-${step.key}`}>
          окна измерения не совпадают — доля не сравнивается
          <Hint text={partialTransitionText(step, prev)} label="окна измерения" />
        </p>
      )}
    </li>
  );
}

export function FunnelCard({ funnel, compact }: { funnel: Funnel; compact?: boolean }) {
  const max = Math.max(0, ...funnel.steps.map((s) => (s.availability === 'measured' ? (s.visits ?? 0) : 0)));
  const notMeasured = funnel.steps.filter((s) => s.availability === 'not_measured');
  return (
    <Card
      title={
        <span>
          {funnel.title}
          <SampleBadge status={funnel.sample.status} />
        </span>
      }
      subtitle={compact ? undefined : funnel.description}
    >
      {funnel.quality.completeness === 'unavailable' ? (
        <StateBlock kind="empty" message="За этот период поведенческих данных нет" />
      ) : (
        <ol className="space-y-2" aria-label={`Шаги воронки: ${funnel.title}`}>
          {funnel.steps.map((s, i) => (
            <StepRow
              key={s.key}
              step={s}
              prev={funnel.steps.slice(0, i).reverse().find((p) => p.availability === 'measured') ?? null}
              max={max}
              cmp={funnel.comparison}
            />
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-gray-400">
        Единицы: {UNIT_LABELS.visits} <Hint text={UNIT_TOOLTIPS.visits} label="визиты" /> · {UNIT_LABELS.events} <Hint text={UNIT_TOOLTIPS.events} label="события" /> · {UNIT_LABELS.users} <Hint text={UNIT_TOOLTIPS.users} label="посетители" />
        {notMeasured.length > 0 && ` · не измеряется шагов: ${notMeasured.length}`}
      </p>
      <QualityNotices notes={funnel.quality.notes} tone="gray" />
    </Card>
  );
}

export function DirectionFunnels({ funnels }: { funnels: Funnel[] | undefined }) {
  if (!funnels) return <Card title="По направлениям"><StateBlock kind="loading" /></Card>;
  const directions = funnels.filter((f) => f.key !== 'global');
  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      {directions.map((f) => (
        <FunnelCard key={f.key} funnel={f} compact />
      ))}
    </div>
  );
}

// ── Ошибки форм ────────────────────────────────────────────────────────────

export function FormErrorsBlock({ errors }: { errors: FormErrors | undefined }) {
  if (!errors) return <Card title="Ошибки форм"><StateBlock kind="loading" /></Card>;
  const t = errors.totals;
  const empty = t.formErrorVisits === 0 && t.serverErrorVisits === 0;
  return (
    <Card title="Ошибки форм" subtitle="Клиентская проверка отбила форму (form_error) и серверные ошибки отправки футболок">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Визитов с ошибкой" value={formatCount(t.formErrorVisits)} sub={`${formatCount(t.formErrorEvents)} событий`} cmp={errors.comparison?.formErrorVisits ?? null} lowerGood />
        <Stat label="Доля от начавших форму" value={formatPercent(t.errorRate)} sub={`начали форму: ${formatCount(t.formStartedVisits)} визитов`} cmp={errors.comparison?.errorRate ?? null} lowerGood />
        <Stat label="Ошибок на попытки" value={formatPercent(t.errorsPerAttempt)} sub="события ошибок / (попытки + ошибки)" />
        <Stat label="Серверные ошибки (футболки)" value={formatCount(t.serverErrorVisits)} sub={`${formatCount(t.serverErrorEvents)} событий`} />
      </div>
      {empty ? (
        <StateBlock kind="empty" message="За этот период ошибок формы не зафиксировано" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {/* min-w-0: колонка сетки не должна расширяться под таблицу — таблица скроллится внутри */}
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">По полям</h3>
            {errors.byField.length === 0 ? (
              <p className="text-xs text-gray-400">Поле ошибки в параметрах визита не передано</p>
            ) : (
              <TableWrap>
                <table className="min-w-full">
                  <thead><tr><Th>Поле</Th><Th right>Событий</Th><Th right>Визитов</Th><Th right>Доля</Th></tr></thead>
                  <tbody>
                    {errors.byField.map((f) => (
                      <tr key={f.key} className="border-t border-gray-100">
                        <Td>{f.label}</Td><Td right>{formatCount(f.events)}</Td><Td right>{formatCount(f.visits)}</Td><Td right>{formatPercent(f.shareOfErrors)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">По устройствам</h3>
            <TableWrap>
              <table className="min-w-full">
                <thead><tr><Th>Устройство</Th><Th right>Ошибок (визиты)</Th><Th right>Начали форму</Th><Th right>Доля</Th></tr></thead>
                <tbody>
                  {errors.byDevice.map((d) => (
                    <tr key={d.deviceCategory} className="border-t border-gray-100">
                      <Td>{DEVICE_LABELS_BEHAVIOR[d.deviceCategory] ?? d.deviceCategory}</Td><Td right dim={d.formErrorVisits === 0}>{formatCount(d.formErrorVisits)}</Td><Td right>{formatCount(d.formStartedVisits)}</Td><Td right dim={d.errorRate === null}>{formatPercent(d.errorRate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {errors.byLanding.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-600 mt-4 mb-2">По страницам входа</h3>
                <TableWrap>
                  <table className="min-w-full">
                    <thead><tr><Th>Страница входа</Th><Th right>Ошибок</Th><Th right>Начали форму</Th><Th right>Доля</Th></tr></thead>
                    <tbody>
                      {errors.byLanding.slice(0, 10).map((l) => (
                        <tr key={l.normalizedPath} className="border-t border-gray-100">
                          <Td><span className="font-mono text-xs break-all">{l.normalizedPath}</span><SampleBadge status={l.sample} /></Td><Td right>{formatCount(l.formErrorVisits)}</Td><Td right>{formatCount(l.formStartedVisits)}</Td><Td right dim={l.errorRate === null}>{formatPercent(l.errorRate)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </>
            )}
          </div>
        </div>
      )}
      <QualityNotices notes={errors.quality.notes} tone="gray" />
    </Card>
  );
}

function Stat({ label, value, sub, cmp, lowerGood }: { label: string; value: string; sub?: string; cmp?: Comparison | null; lowerGood?: boolean }) {
  const tone = cmp ? deltaTone(cmp, lowerGood ? 'lower-good' : 'higher-good') : 'neutral';
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-gray-900">{value}</div>
      {cmp && <div className={`text-xs tabular-nums ${tone === 'negative' ? 'text-rose-600' : tone === 'positive' ? 'text-emerald-600' : 'text-gray-400'}`}>{formatDelta(cmp, 'count')} к пред. периоду</div>}
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Устройства ─────────────────────────────────────────────────────────────

export function DevicesBlock({ devices }: { devices: DevicesBehavior | undefined }) {
  if (!devices) return <Card title="Устройства"><StateBlock kind="loading" /></Card>;
  const gap = devices.gap;
  const gapText =
    gap.status === 'COMPARABLE' && gap.desktop !== null && gap.mobile !== null
      ? `${gap.metric === 'leadConversion' ? 'Конверсия визитов в заявку' : 'Доля визитов с началом формы'}: телефон ${formatPercent(gap.mobile)}, компьютер ${formatPercent(gap.desktop)}${gap.ratio !== null ? ` — отношение ${gap.ratio.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}` : ''}. Это наблюдение, причина по данным не установлена.`
      : `Сравнить телефон и компьютер нельзя: у одного из устройств меньше ${devices.minSampleVisits} визитов или нет ни заявок, ни начатых форм.`;
  return (
    <Card title="Устройства" subtitle="Шаги воронки и вовлечённость по типу устройства; доли — от визитов устройства">
      <TableWrap>
        <table className="min-w-full">
          <thead>
            <tr>
              <Th>Устройство</Th><Th right>Визиты</Th><Th right>Начали форму</Th><Th right>Отправили</Th><Th right>Заявки</Th><Th right>Ошибки</Th><Th right>Начало формы</Th><Th right>В заявку</Th><Th right>Отказы</Th><Th right>Глубина</Th><Th right>Время</Th>
            </tr>
          </thead>
          <tbody>
            {devices.rows.map((d) => (
              <tr key={d.deviceCategory} className="border-t border-gray-100">
                <Td>{DEVICE_LABELS_BEHAVIOR[d.deviceCategory] ?? d.deviceCategory}<SampleBadge status={d.sample} /></Td>
                <Td right>{formatCount(d.visits)}</Td>
                <Td right dim={d.formStartedVisits === 0}>{formatCount(d.formStartedVisits)}</Td>
                <Td right dim={d.attemptVisits === 0}>{formatCount(d.attemptVisits)}</Td>
                <Td right dim={d.leadVisits === 0}>{formatCount(d.leadVisits)}</Td>
                <Td right dim={d.formErrorVisits === 0}>{formatCount(d.formErrorVisits)}</Td>
                <Td right dim={d.formStartRate === null}>{formatPercent(d.formStartRate)}</Td>
                <Td right dim={d.leadConversion === null}>{formatPercent(d.leadConversion)}</Td>
                <Td right dim={!d.engagement}>{formatPercent(d.engagement?.bounceRate ?? null)}</Td>
                <Td right dim={!d.engagement}>{d.engagement?.pageDepth === null || d.engagement?.pageDepth === undefined ? '—' : d.engagement.pageDepth.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}</Td>
                <Td right dim={!d.engagement}>{formatSeconds(d.engagement?.avgDurationSeconds ?? null)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="mt-3 text-xs text-gray-600" data-testid="device-gap">{gapText}</p>
      <QualityNotices notes={devices.quality.notes} tone="gray" />
    </Card>
  );
}

// ── Страницы ───────────────────────────────────────────────────────────────

export function PagesBlock({ pages }: { pages: PagesBehavior | undefined }) {
  const [all, setAll] = useState(false);
  if (!pages) return <Card title="Страницы входа"><StateBlock kind="loading" /></Card>;
  const rows = all ? pages.rows : pages.rows.slice(0, 15);
  return (
    <Card
      title="Страницы входа"
      subtitle={`С какой страницы начинался визит и что было дальше. Средняя по сайту: начало формы ${formatPercent(pages.siteFormStartRate)}, заявка ${formatPercent(pages.siteLeadConversion)}. Страницы с числом визитов меньше ${pages.minSampleVisits} не ранжируются.`}
    >
      {pages.rows.length === 0 ? (
        <StateBlock kind="empty" />
      ) : (
        <TableWrap>
          <table className="min-w-full">
            <thead>
              <tr>
                <Th>Страница входа</Th><Th right>Визиты</Th><Th right>Начали форму</Th><Th right>Заявки</Th><Th right>Ошибки</Th><Th right>Начало формы</Th><Th right>В заявку</Th><Th right>К среднему</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.normalizedPath} className="border-t border-gray-100">
                  <Td><span className="font-mono text-xs break-all">{p.normalizedPath}</span><SampleBadge status={p.sample} /></Td>
                  <Td right>{formatCount(p.visits)}</Td>
                  <Td right dim={p.formStartedVisits === 0}>{formatCount(p.formStartedVisits)}</Td>
                  <Td right dim={p.leadVisits === 0}>{formatCount(p.leadVisits)}</Td>
                  <Td right dim={p.formErrorVisits === 0}>{formatCount(p.formErrorVisits)}</Td>
                  <Td right dim={p.formStartRate === null}>{formatPercent(p.formStartRate)}</Td>
                  <Td right dim={p.leadConversion === null}>{formatPercent(p.leadConversion)}</Td>
                  <Td right dim={p.leadConversionVsSite === null}>
                    {p.leadConversionVsSite === null ? '—' : `${p.leadConversionVsSite > 0 ? '+' : ''}${p.leadConversionVsSite.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} п.п.`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {pages.rows.length > 15 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-medium text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded">
          {all ? 'Свернуть' : `Показать все (${pages.rows.length})`}
        </button>
      )}
      <QualityNotices notes={pages.quality.notes} tone="gray" />
    </Card>
  );
}

// ── Пути ───────────────────────────────────────────────────────────────────

function PathList({ title, rows, unit, total }: { title: string; rows: PathPage[]; unit: 'visits' | 'pageviews'; total: number }) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold text-gray-600 mb-2">
        {title} <span className="text-gray-400 font-normal">· всего {formatCount(total)} {unit === 'visits' ? 'визитов' : 'просмотров'}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">Нет данных за период</p>
      ) : (
        <ol className="space-y-1">
          {rows.slice(0, 8).map((r) => (
            <li key={r.normalizedPath} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-mono text-gray-800 break-all">{r.normalizedPath}</span>
              <span className="tabular-nums text-gray-600 whitespace-nowrap">{formatCount(unit === 'visits' ? r.visits : r.pageviews)} · {formatPercent(r.share)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PathsBlock({ paths }: { paths: PathsBehavior | undefined }) {
  if (!paths) return <Card title="Пути к заявке"><StateBlock kind="loading" /></Card>;
  return (
    <Card title="Пути к заявке (агрегаты)" subtitle="Не последовательности, а суммы: где начинались визиты с заявкой, что в них смотрели и где визиты без заявки закончились">
      <div className="grid md:grid-cols-3 gap-4">
        <PathList title="Вход визитов с заявкой" rows={paths.entryLead} unit="visits" total={paths.totals.leadVisits} />
        <PathList title="Смотрели в визитах с заявкой" rows={paths.viewedLead} unit="pageviews" total={paths.totals.leadPageviews} />
        <PathList title="Выход визитов без заявки" rows={paths.exitNoLead} unit="visits" total={paths.totals.noLeadVisits} />
      </div>
      <p className="mt-3 text-[11px] text-gray-400">{paths.dataGap}</p>
      <QualityNotices notes={paths.quality.notes} tone="gray" />
    </Card>
  );
}

// ── «Требует внимания» ─────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: BehaviorIssue }) {
  return (
    <article className={`rounded-lg border px-3 py-2.5 text-sm ${SEVERITY_TONE[issue.severity]}`} data-testid={`issue-${issue.rule}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{issue.title}</h3>
        <span className="text-[11px] uppercase tracking-wide opacity-80">{SEVERITY_LABELS[issue.severity]} · {RULE_LABELS[issue.rule]}</span>
      </div>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div><dt className="inline font-semibold">Факт: </dt><dd className="inline">{issue.fact}</dd></div>
        <div><dt className="inline font-semibold">Гипотеза: </dt><dd className="inline">{issue.hypothesis}</dd></div>
        <div><dt className="inline font-semibold">Что проверить: </dt><dd className="inline">{issue.recommendation}</dd></div>
      </dl>
      <p className="mt-1.5 text-[11px] opacity-70">Причина не установлена — это наблюдение по данным, а не вывод.</p>
    </article>
  );
}

export function IssuesBlock({ issues }: { issues: BehaviorIssues | undefined }) {
  if (!issues) return <Card title="Требует внимания"><StateBlock kind="loading" /></Card>;
  return (
    <Card title="Требует внимания" subtitle="Правила по числам с минимальной выборкой; каждая карточка разделяет факт, гипотезу и что проверить">
      {issues.issues.length === 0 ? (
        <p className="text-sm text-gray-500">По правилам этапа 10 карточек нет: либо всё в норме, либо данных недостаточно (см. ниже).</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {issues.issues.map((i) => (
            <IssueCard key={i.id} issue={i} />
          ))}
        </div>
      )}
      {issues.skipped.length > 0 && (
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">Правила без вывода (мало данных или несопоставимые периоды): {issues.skipped.length}</summary>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {issues.skipped.map((s, i) => (
              <li key={`${s.rule}-${i}`} data-testid={`skipped-${s.code}`}>
                {RULE_LABELS[s.rule]} <span className="text-gray-400">· {SKIP_CODE_LABELS[s.code]}</span>: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      <QualityNotices notes={issues.quality.notes} tone="gray" />
    </Card>
  );
}

// ── Шапка раздела ──────────────────────────────────────────────────────────

export function BehaviorHeadline({ summary }: { summary: BehaviorSummary }) {
  const h = summary.headline;
  const s = summary.issuesBySeverity;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Kpi label="Визиты" value={formatCount(h.visits)} />
      <Kpi label="Начали форму" value={formatCount(h.formStartedVisits)} sub={`${formatPercent(h.formStartRate)} визитов`} />
      <Kpi label="Отправили форму" value={formatCount(h.attemptVisits)} sub="проверка пройдена" />
      <Kpi label="Заявка принята" value={formatCount(h.leadVisits)} sub={`${formatPercent(h.startToLead)} от начавших`} />
      <Kpi label="Ошибки формы" value={formatCount(h.formErrorVisits)} sub={`${formatPercent(h.errorRate)} от начавших`} />
      <Kpi label="Требует внимания" value={formatCount(s.CRITICAL + s.ATTENTION + s.INFO)} unit="карточек" sub={`критично ${s.CRITICAL} · внимание ${s.ATTENTION}`} />
    </div>
  );
}

function Kpi({ label, value, sub, unit = 'визитов' }: { label: string; value: string; sub?: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold tabular-nums text-gray-900">{value} <span className="text-[11px] font-normal text-gray-400">{unit}</span></div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
