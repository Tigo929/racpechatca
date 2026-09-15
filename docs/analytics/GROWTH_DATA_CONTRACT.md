# GROWTH_DATA_CONTRACT.md

# Реестр изменений и оценка «до / после» (этап 11) — контракт данных

## Статус

```text
IMPLEMENTED 15.09.2026 — crm-new/src/analytics/growth/ (feature/analytics-foundation), в production не выложен.
Источник истины по типам — growth-contract.ts (зеркало frontend/src/types/growth.ts); версия правил —
GROWTH_METRIC_VERSION = growth-metrics-v1 (пишется в каждую оценку).
```

## 1. Аудит: что переиспользовано из этапов 08–10

| Нужно этапу 11 | Откуда берётся | Дублирования формул нет |
|---|---|---|
| Визиты, заявки сайта, сопоставленные заказы, покрытие ClientID, P&L окна, свежесть, снимок уникальных за точный период | `AnalyticsMetricsService.getOverview(customPeriod(from, to), false)` (этап 08) — `traffic`, `siteFunnel`, `financials.realized`, `dataQuality`, `traffic.periodUsers` из `MetrikaPeriodSnapshot` по точным `periodStart / periodEnd` | ✓ |
| Начали форму / отправили / ошибки формы, визиты и достижения по устройствам и страницам входа | `BehaviorMetricsService.loadInput(period)` (этап 10) — `goalTotals`, `byDevice[].goals`, `byLanding[].goals` (reaches + goalVisits) | ✓ |
| Когорты CRM (заявка → принят → оплата) с исходами до даты наблюдения, суммы заказов | `AnalyticsMetricsService.lifecycles(period)` (этап 08, `deriveOrderLifecycle`) → `cohortsFor()` в `analytics-growth.service.ts` | ✓ (даты жизненного цикла — канонические) |
| Эмпирические задержки созревания | те же `lifecycles` → `lagInputsFrom()` (задержки по московским дням) | ✓ |
| Источники для сдвига смеси | `MetrikaDailySource` groupBy (визиты, leadReaches) одним запросом; полный `getTrafficSources` — только для аудитории `source`; `getUtm` — для аудитории `utm` | ✓ |
| Даты доступности / смены определений | `analytics-constants.ts` (`COUNTER_DATA_SINCE`, `WEB_CUTOVER_COMPLETE_FROM`), `behavior-rules.ts` (`BEHAVIOR_GOALS_AVAILABLE_FROM`, `DIRECTION_GOALS_AVAILABLE_FROM`), `MATCHED_AVAILABLE_FROM = 2026-09-13` | принцип `measuredFrom / comparable` этапа 10 |
| Точные снимки уникальных за окна | `MetrikaPeriodSnapshotService.refreshRange(range, null)` — из хука расписания, никогда из запросов дашборда | ✓ |
| Свежесть | `freshnessOf(lastSuccess.finishedAt, now)`; `lastSyncRunId` в оценке | ✓ |

Противоречий со спецификацией не найдено; уточнения — в DEVIATIONS отчёта (`11_GROWTH_AND_EXPERIMENTS.md` § 31).

## 2. Хранение

```text
AnalyticsChange            реестр: name, description, status DRAFT|ACTIVE|COMPLETED|CANCELLED, changeType SITE|CRM|MARKETING|
                           PRICING|OPERATIONS|ANALYTICS|OTHER, startedAt (UTC; календарный день — Europe/Moscow), endedAt?,
                           deploymentRef?, surface (site:form | crm:workflow | …), audienceDefinition? {dimension: device|source|
                           utm|landing, values[]}, primaryMetric, secondaryMetrics[], expectedDirection INCREASE|DECREASE|NEUTRAL,
                           hypothesis?, maturityDays?, evaluationDays? (7|14|21|28), primaryLockedAt (первая оценка)
AnalyticsChangeEvaluation  версии оценок: (changeId, version) unique, evaluatedAt, trigger manual|scheduler, observationCutoff,
                           before/after windows (DATE), metricVersion, primaryMetric, verdict, maturity, result (JSONB — полный
                           GrowthEvaluation), flags (JSONB string[]), lastSyncRunId. Прежние версии не меняются и не удаляются.
Миграция 20260915130000_analytics_change_registry: 2 CREATE TABLE, 3 индекса, FK с каскадом; DROP/ALTER/UPDATE/DELETE нет.
PII нет: описания — внутренний текст администратора, аудитория — только аналитические измерения; DTO с whitelist +
forbidNonWhitelisted отбрасывает любые лишние поля (400).
```

## 3. Каталог метрик (`growth-metrics.ts`)

| key | область | вид | созревание | availableFrom / смена определения | первична для | источник |
|---|---|---|---|---|---|---|
| visits | site | count | immediate | 2026-08-13 | SITE, MARKETING, OTHER | overview.traffic.visits |
| siteLeads | site | count | immediate | 2026-09-13 (ложный purchase до) | SITE, MARKETING, ANALYTICS, OTHER | overview.siteFunnel.siteLeads |
| siteLeadRate | site | ratio | immediate | 2026-09-13 | SITE, … | siteLeads / visits |
| formStarts, formStartRate, leadAttempts | site | count / ratio | immediate | 2026-09-10 | SITE, … | behavior goalTotals |
| formErrors, formErrorRate | site | count / ratio | immediate | 2026-09-12 | SITE, … | behavior goalTotals (ошибки / начавшие) |
| matchedAccepted, matchedAcceptedRate, matchedPaid | matched | count / ratio | accepted / paid | 2026-09-13 | — (только контекст) | overview.siteFunnel; гейт покрытия ClientID ≥ 50 % |
| crmLeads, acceptedOrders | crm | count | immediate | с начала CRM | CRM, PRICING, OPERATIONS, OTHER | когорты leadAt / acceptedAt в окне |
| leadToAcceptedRate, leadToPaidRate | crm | ratio | accepted / paid | — | CRM, … | когорта заявок окна, исходы к дате наблюдения |
| paidOrders, paidAov, contractValue, paidOrderValue | crm | count / mean / sum | paid / accepted | — | CRM / PRICING / OPERATIONS / MARKETING | когорта принятых в окне |
| realizedRevenue, netProfit | pnl | sum | paid | — | PRICING, OPERATIONS, MARKETING, OTHER | overview.financials.realized (календарное признание) |

`scopeCompatibility`: метрика первична только для типов из `primaryFor`; иначе `context_only`, а как первичная —
`METRIC_SCOPE_MISMATCH` и вердикт `INCOMPARABLE` (числа показываются как контекст). Контекст по умолчанию: для
SITE — crmLeads, acceptedOrders, matchedAccepted, realizedRevenue; для CRM — visits, siteLeads, realizedRevenue, netProfit.

## 4. Окна (`growth-windows.ts`)

- `cutoverDay = calendarDateIn(startedAt)`; день исключается (`EXCLUDED_CUTOVER_DAY`), если изменение вышло не ровно в
  00:00 MSK; «после» начинается со следующего полного дня, «до» заканчивается накануне cutover.
- `observationCutoff` = вчера по Москве, не позже последнего дня с данными `MetrikaDailyTraffic`.
- Длина: заданная (7/14/21/28, обрезается доступными днями с `SHORT_WINDOW`) или авто — наибольшая целая неделя ≤ 28,
  помещающаяся после cutover; меньше 7 доступных дней — окно = доступные дни + `SHORT_WINDOW`.
- `endedAt` обрезает «после» последним полным днём действия (`AFTER_WINDOW_TRUNCATED_BY_END`).
- `weekdayMix` для обоих окон; несовпадение — `WEEKDAY_MIX_MISMATCH`.
- Сопоставимость метрики: `measuredFrom = max(window.from, availableFrom)` для обоих окон; `availableFrom` внутри
  окна → `PARTIAL_MEASUREMENT_PERIOD`; позже конца окна → `METRIC_UNAVAILABLE_*`; дата смены определения внутри
  (before.from, after.to] → `MEASUREMENT_DEFINITION_CHANGED`; любой из кодов → `INCOMPARABLE_WINDOWS`, вердикт INCOMPARABLE,
  процент прироста не является выводом. Фикстура 12.09 (siteLeadRate) даёт именно это.

## 5. Оценка (`growth-compute.ts`)

```text
GrowthEvaluation {
  evidenceType OBSERVATIONAL_BEFORE_AFTER, causality NOT_ESTABLISHED, abCapability NO_VARIANT_ASSIGNMENT,
  windows, primary/secondary[]/context[] (MetricEvaluation), segments[], periodUsers {before, after} (только снимки),
  maturityPolicy, confounders[], dataQuality {freshness, flags, lastSyncRunId, clientIdCoverageAccepted},
  verdict, maturity, FACT, INTERPRETATION, RECOMMENDATION, disclaimer
}
MetricEvaluation { before/after: {numerator, denominator, value, sample}, comparability, maturity, statistics, verdict, flags }
Порядок вердикта: METRIC_SCOPE_MISMATCH → INCOMPARABLE; несопоставимые окна → INCOMPARABLE; MATCHED_COVERAGE_LOW /
COGS_INCOMPLETE → INSUFFICIENT_DATA; созревание ≠ MATURE → IMMATURE; ZERO_DENOMINATOR / LOW_SAMPLE / SHORT_WINDOW →
INSUFFICIENT_DATA; descriptive_only → INSUFFICIENT_DATA; иначе — по статистике (GROWTH_STATISTICS.md).
Заблокированные значения никогда не заменяются нулём: value = null и флаг.
```

Сегменты: по первичной метрике для аудитории изменения (`audience`) и исследовательски по устройствам; поддержаны
visits / siteLeads / siteLeadRate / matchedAccepted(Rate) для device, source, utm, landing и formStarts / formStartRate для
device, landing (из поведенческих агрегатов); прочие сочетания — `UNSUPPORTED_SEGMENT` без чисел. matchedPaid по срезам не
хранится → не поддержан.

Confounders (описательно, причина не утверждается): `WEEKDAY_MIX_MISMATCH`, `SOURCE_MIX_SHIFT` / `DEVICE_MIX_SHIFT` /
`LANDING_MIX_SHIFT` (сдвиг доли ≥ 15 п.п. среди долей ≥ 5 %), `MEASUREMENT_DEFINITION_CHANGED`, `OVERLAPPING_CHANGE`
(ACTIVE/COMPLETED изменения, пересекающиеся с [before.from, after.to]), `ANALYTICS_STALE`, `LOW_SAMPLE`,
`MATCHED_COVERAGE_LOW`, `COGS_INCOMPLETE`, `IMMATURE_OUTCOME`. Оговорки о метриках — только по заявленным
(первичная + вторичные); контекст несёт свои вердикты.

## 6. API (`/analytics/dashboard/growth`, ADMIN, флаги `ANALYTICS_DASHBOARD_ENABLED` + `ANALYTICS_GROWTH_ENABLED`)

| Маршрут | Ответ |
|---|---|
| `GET status` | `GrowthStatus` — enabled, каталог метрик, измерения аудитории, типы/статусы, defaults (alpha, power, targetRelativeEffect, пороги, окна), политика созревания по истории CRM, счётчики по статусам; доступен и при выключенном флаге |
| `GET changes`, `GET changes/:id` | `AnalyticsChangeRecord[]` / запись с `latestEvaluation` (сводка) |
| `POST changes`, `PATCH changes/:id` | DTO с whitelist; после первой оценки `primaryMetric` и `expectedDirection` менять нельзя (400) |
| `POST changes/:id/evaluate` | новая версия `GrowthEvaluation` (200); CANCELLED не оценивается; без полного дня после cutover — 400 `NO_COMPLETE_DAYS_AFTER` |
| `GET changes/:id/evaluations`, `…/latest`, `…/:version` | сводки версий / полная оценка (неизменяемая) |

Раздел включён только при обоих флагах (`growth-flags.ts`; свой флаг default false — Stage 11 выкатывается выключенным).
Выключен → 404 на всё, кроме `status`, и хук расписания не регистрируется. К API Метрики из этих маршрутов обращений нет.

## 7. Расписание (`GrowthModule.onModuleInit → scheduler.registerAfterSync`)

После SUCCESS/PARTIAL тика этапа 07 (после снимков пресетов): для ACTIVE/COMPLETED изменений — точные снимки окон
(`refreshRange`) только если снимка нет или окно ещё не устоялось (заканчивается не раньше дня cutoff): ≤ 2 снимка ×
(1 запрос + 1 запрос целей) = ≤ 4 запроса к Reports API на изменение за тик, затем 0; для ACTIVE — переоценка только при
появлении нового полного дня. Ошибка хука логируется и не влияет на синхронизацию этапов 07/10 и воркер этапа 06.
