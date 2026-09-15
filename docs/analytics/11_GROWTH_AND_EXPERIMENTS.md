# 11_GROWTH_AND_EXPERIMENTS.md

## STATUS

`REVIEW` — реализовано 15.09.2026 в `feature/analytics-foundation` (с влитым master 3ac9be8): реестр изменений и
версии оценок (миграция 20260915130000), каталог метрик поверх сервисов этапов 08/10, окна с исключённым днём cutover и
сопоставимостью по датам доступности, эмпирическое созревание когорт, статистика с независимыми контрольными
значениями и MDE, вердикты без причинности, confounders, API под флагом дашборда, вкладка «Рост / Изменения», хук
расписания для точных снимков окон и автооценки. Сверка на копии production A = B = C diff 0. Production не тронут.
Отчёт — § 31; контракты — `GROWTH_DATA_CONTRACT.md`, `GROWTH_STATISTICS.md`. READY_FOR_REVIEW; verdict — Reviewer.

## 1. Goal

Build a trustworthy growth/experiments layer that records product/site changes and evaluates what happened before and after them without inventing causality.

The system must answer:

- what changed;
- when it reached production;
- what surface/audience it affected;
- what metric was declared primary before evaluation;
- what happened before vs after;
- whether the compared windows are actually comparable;
- whether CRM outcomes had enough time to mature;
- how large the observed change is in absolute and relative terms;
- whether the sample is sufficient to make a useful conclusion;
- what confounders/data gaps exist;
- what should be checked next.

Stage 11 is not allowed to turn correlation into proof. Every result must separate FACT / INTERPRETATION / RECOMMENDATION and expose `causality = NOT_ESTABLISHED` unless a future randomized experiment supports a stronger claim.

## 2. Current production baseline

Stage 10 is accepted DONE. Production master at the Stage 11 planning gate: `b04681f`.

Already available:

- local daily Metrika aggregates from 2026-08-13;
- hourly refresh;
- true period-user snapshots only for supported presets;
- Stage 09 trend metrics for site + CRM + P&L;
- Stage 10 behavior datasets and availability/comparability metadata;
- canonical CRM lifecycle and canonical P&L logic;
- known cutovers/deploy timestamps, including event-model production cutover 2026-09-12 13:19 Europe/Moscow;
- source/UTM/device/landing slices where local aggregate data supports them.

Do not duplicate existing metric formulas.

## 3. Non-goals

Stage 11 must NOT:

- enable Metrika Logs API without a separate Reviewer/owner decision;
- claim session-level paths that aggregates cannot prove;
- implement a client-side A/B assignment system by default;
- silently modify the `web-photo` event model;
- calculate ROAS/ROMI without ad-spend data;
- use total CRM orders as the denominator/numerator for a site-only experiment;
- sum daily unique users and label the result unique users;
- call an observed before/after difference a proven effect;
- use an LLM to decide statistical significance or manufacture explanations;
- alter production during implementation/review.

## 4. Core concept: Change / Experiment Registry

Create a persistent registry for changes that may affect business/product metrics.

Recommended entity: `AnalyticsChange` (final naming may follow project conventions).

Minimum fields:

- `id`
- `name`
- `description`
- `status`: DRAFT | ACTIVE | COMPLETED | CANCELLED
- `changeType`: SITE | CRM | MARKETING | PRICING | OPERATIONS | ANALYTICS | OTHER
- `startedAt` — actual production exposure timestamp in Europe/Moscow semantics / stored canonically as project convention requires
- `endedAt` nullable
- `deploymentRef` nullable — commit/deploy identifier, informational
- `surface` / affected area
- `audienceDefinition` structured JSON, nullable
- `primaryMetric`
- `secondaryMetrics` structured list
- `expectedDirection`: INCREASE | DECREASE | NEUTRAL/UNKNOWN
- `hypothesis` nullable text written before evaluation
- `maturityDays` or metric-specific maturity policy
- `createdAt`, `updatedAt`

No PII.

Do not infer an experiment from every git commit automatically in V1. The registry is explicit and auditable. A deploy/commit may be attached as evidence.

## 5. Change types and evidence strength

The UI/API must distinguish at least:

### 5.1 Observational change

A production change where everyone receives the new version and comparison is before/after.

Evidence label: `OBSERVATIONAL_BEFORE_AFTER`.

Causality: `NOT_ESTABLISHED`.

### 5.2 Randomized experiment

Stage 11 may define the data contract for future A/B tests, but MUST NOT claim support unless stable variant assignment and exposure events actually exist.

If current production lacks variant assignment, return capability `NOT_AVAILABLE` / data gap `NO_VARIANT_ASSIGNMENT`.

Any implementation of variant assignment in `web-photo` requires a separate owner/Reviewer decision and separate rollout gate.

## 6. Metric catalog for evaluation

Reuse canonical metrics. Each metric must carry scope/unit/source/maturity semantics.

### Site metrics

Examples:
- visits
- site leads / canonical lead goal
- form starts
- lead attempts where measurable
- form errors
- site lead rate
- device/source/UTM/landing slices when supported

### Matched site→CRM metrics

Examples:
- matched accepted
- matched paid

These are subject to ClientID coverage. Low coverage must be surfaced and must not be generalized to all CRM orders.

### CRM business metrics

Examples:
- crmLeads
- acceptedOrders
- paidOrders
- contractValue
- paidOrderValue
- realizedRevenue
- COGS
- netProfit
- paidAov

These describe the business, not automatically the effect of a website change.

### Product metrics

Use only existing canonical product categorization and supported financial fields. Do not invent realized per-product profit if the canonical model cannot attribute it.

## 7. Scope compatibility

Every evaluation must validate that the metric can answer the change's question.

Examples:

- website form change → site lead rate is valid primary metric;
- website form change → total CRM accepted orders is contextual only unless reliable site→CRM matching supports attribution;
- CRM workflow change → CRM lifecycle metrics may be primary;
- landing-specific change → landing slice only if aggregate dataset can isolate the affected landing;
- mobile-only change → device=phone/mobile slice if supported.

Return `METRIC_SCOPE_MISMATCH` rather than producing a misleading number.

## 8. Comparison windows

V1 comparison must support an explicit evaluation window and a baseline of equal duration immediately preceding it, aligned to complete Europe/Moscow days where daily aggregates are used.

For an `startedAt` during a day:

- do not mix a partial cutover day into a clean daily before/after comparison by default;
- mark the cutover day `EXCLUDED_CUTOVER_DAY` unless an existing dataset supports honest sub-day measurement;
- first full post day begins next Moscow calendar day;
- baseline uses the same number of complete days immediately before the cutover day.

Also expose day-of-week composition. Prefer equal whole-week windows (7, 14, 21, 28 days) when possible. If weekday composition differs, add `WEEKDAY_MIX_MISMATCH`.

Do not silently cherry-pick a favorable baseline.

## 9. Data availability / comparability

Reuse the Stage 10 concept of `availableFrom`, `measuredFrom`, `transition/comparable` rather than creating unrelated logic.

For every evaluated metric/slice:

- determine earliest reliable data date;
- determine effective before window;
- determine effective after window;
- require equivalent measurement semantics in both windows;
- detect analytics/event-model cutovers;
- return `PARTIAL_MEASUREMENT_PERIOD` / `INCOMPARABLE_WINDOWS` when necessary.

A metric with incompatible before/after semantics must not get an uplift percentage.

The 2026-09-12 event-model cutover is an explicit regression fixture: pre/post lead-event semantics must not be presented as a clean experiment result if the metric definition changed.

## 10. Unique users

Critical rule:

- true unique users are available only from period snapshots for supported preset windows;
- never sum daily users and call them period unique users;
- arbitrary experiment windows without a true snapshot must return periodUsers = null / `UNAVAILABLE_FOR_CUSTOM_WINDOW` unless Stage 11 deliberately adds a local snapshot for that exact registered evaluation window.

Preferred implementation: when an ACTIVE/COMPLETED change has a defined evaluation window, allow the existing Metrika snapshot mechanism to persist a true period snapshot for the exact before/after windows, without making dashboard requests call live Metrika.

If this is implemented, it must use the existing sync/client/retry/lock patterns and remain asynchronous/local-first.

## 11. Maturity / lag

Site actions can be evaluated quickly; accepted/paid/revenue/profit can mature later.

Implement explicit metric maturity.

Minimum behavior:

- immediate metrics: visits, form starts, site leads, errors;
- accepted metrics: evaluate by cohort where possible and expose observation cutoff;
- paid/revenue/profit: do not treat immature post cohorts as final.

For cohort metrics, define orders/leads by origin/cohort date and observe their lifecycle through a maturity cutoff. Do not simply compare calendar payments in the before period vs calendar payments in the after period and call it site-change conversion.

Return:
- `MATURE`
- `IMMATURE`
- `PARTIALLY_MATURE`
with `maturityUntil` / observation date.

Do not invent a universal lag. Derive an empirical distribution where current CRM history supports it (e.g. lead/accepted→paid delay), document sample size, median/p75/p90 if valid, and use a conservative configurable policy. If history is insufficient, require an explicit configured maturity period and flag the limitation.

## 12. Minimum data and statistical honesty

Traffic is currently low. Stage 11 must be designed to return `INSUFFICIENT_DATA` frequently and correctly.

For every primary comparison expose:

- before denominator / numerator;
- after denominator / numerator;
- absolute difference;
- relative difference only when denominator semantics permit;
- sample sizes;
- confidence interval where mathematically appropriate;
- statistical test/method name;
- minimum detectable effect (MDE) for the current sample/power assumptions;
- required sample estimate for a configured target effect;
- verdict.

Default assumptions must be documented, not hidden. Recommended conventional defaults for planning: two-sided alpha 0.05, power 0.80. These are configuration/metadata, not proof thresholds to game.

For proportions (e.g. lead rate), use an appropriate two-proportion method and CI. For sparse counts, do not rely blindly on normal approximations; use an exact/robust method where needed.

For money/AOV with very small or skewed samples, do not manufacture significance from aggregate totals. If raw order-level canonical CRM data is available locally, a documented robust/bootstrap approach may be used; otherwise show descriptive comparison + `STATISTICAL_TEST_UNAVAILABLE`.

No p-hacking: primary metric must be declared on the change before the result is finalized. Secondary metrics are exploratory.

## 13. Verdict model

Suggested machine-readable result:

- `POSITIVE_SIGNAL`
- `NEGATIVE_SIGNAL`
- `NO_CLEAR_CHANGE`
- `INSUFFICIENT_DATA`
- `IMMATURE`
- `INCOMPARABLE`

`POSITIVE_SIGNAL` is not “proved caused by change”.

Each result must include:

- `evidenceType`
- `causality: NOT_ESTABLISHED`
- `primaryMetric`
- `before`
- `after`
- `difference`
- `dataQuality`
- `maturity`
- `statistics`
- `confounders[]`
- `FACT`
- `INTERPRETATION`
- `RECOMMENDATION`

Wording must be deterministic/rule-based in Stage 11; no LLM required.

## 14. Confounders

At minimum detect/surface, not necessarily “correct away”:

- weekday composition mismatch;
- source mix shift;
- device mix shift;
- major landing mix shift where measurable;
- analytics/event definition cutover;
- another registered overlapping change;
- partial data/freshness issue;
- low sample;
- low ClientID coverage for matched metrics;
- COGS incompleteness for profit metrics;
- immature CRM outcomes.

For source/device mix, provide descriptive before/after shares and flag material shifts using documented thresholds. Do not claim the mix shift caused the outcome.

## 15. Overlapping changes

If two ACTIVE/completed changes overlap in time and affect the same surface/audience or have unknown scope overlap, flag `OVERLAPPING_CHANGE`.

The system must not attribute the observed difference exclusively to one change.

## 16. Segmentation

V1 segmentation only where existing local aggregate data supports honest comparison:

- device;
- canonical Metrika source/sourceEngine;
- UTM;
- landing/startURLPath.

Do not fabricate cross-dimensional segments that are not present in stored aggregates (e.g. mobile × UTM × landing) unless a real dataset supports that combination.

Segment results are exploratory unless explicitly declared primary before evaluation. Apply sample gates.

## 17. Natural historical changes / fixtures

Use known changes only to validate mechanics, not to claim business uplift retroactively.

Required fixtures:

1. 2026-09-12 13:19 Europe/Moscow event-model cutover — must demonstrate that a changed measurement definition can make a before/after metric INCOMPARABLE.
2. One known `web-photo` deploy timestamp with a metric whose semantics did not change — may validate window construction, but result should remain observational and likely INSUFFICIENT_DATA.
3. Synthetic deterministic datasets for positive, negative, no-change, low-sample, immature, overlapping-change and weekday-mismatch cases.

Do not backfill hypotheses after seeing outcomes and present them as pre-registered.

## 18. A/B readiness contract — no rollout by default

Document a future variant contract, e.g.:

- `experimentId`
- `variantId`
- stable anonymous assignment key
- assignment timestamp
- exposure event
- variant persistence rules
- consent/privacy behavior
- no PII

But mark current capability `NO_VARIANT_ASSIGNMENT` unless separately implemented.

Do not modify `web-photo` to add this during Stage 11 implementation without Reviewer approval of a separate sub-stage/spec.

## 19. Persistence

Persist registry and evaluation outputs so conclusions are reproducible and do not change silently when queried later.

Recommended:

- `AnalyticsChange`
- `AnalyticsChangeEvaluation`
- optional exact-window snapshot table/reuse of existing snapshot model if schema supports it cleanly.

Evaluation record should include:

- evaluatedAt
- observationCutoff
- before/after window
- metric definition/version
- result JSON or normalized fields
- data-quality flags
- maturity status
- statistics metadata
- source sync run IDs / freshness evidence where practical

Re-evaluation may create a new version rather than overwrite prior evidence silently.

## 20. Service/API

Implement a canonical service, e.g. `AnalyticsGrowthService`, consuming Stage 08–10 canonical services/data.

Read/write registry actions are ADMIN only.

Suggested API shape (adapt to conventions):

- `GET /analytics/dashboard/growth/status`
- `GET /analytics/dashboard/growth/changes`
- `GET /analytics/dashboard/growth/changes/:id`
- `POST /analytics/dashboard/growth/changes`
- `PATCH /analytics/dashboard/growth/changes/:id`
- `POST /analytics/dashboard/growth/changes/:id/evaluate`
- `GET /analytics/dashboard/growth/changes/:id/evaluations`

Mutation endpoints need DTO validation and auditability. No public endpoint.

If the project already has an audit-log convention, reuse it. Otherwise document the gap; do not build an unrelated giant audit subsystem.

## 21. Dashboard V1

Add section/tab `Рост / Изменения` to `/crm/analytics`.

Minimum UI:

- list/timeline of registered changes;
- status and production start time;
- affected surface/audience;
- primary metric;
- before/after window;
- compact before → after result;
- absolute/relative delta where valid;
- data sufficiency/maturity/comparability badge;
- MDE / sample explanation in understandable Russian;
- confounder warnings;
- FACT / INTERPRETATION / RECOMMENDATION;
- explicit “Совпадение по времени не доказывает, что изменение вызвало результат” for observational changes;
- segment drill-down only for supported slices.

Never show `+40%` as a success headline if verdict is INSUFFICIENT_DATA.

Example desired UX:

> Конверсия в заявку: 3,4% → 4,8% (+1,4 п.п.). Данных недостаточно, чтобы отличить изменение от обычных колебаний. При текущем объёме трафика обнаружим только крупный эффект; продолжить наблюдение.

This is an illustrative wording pattern, not a hardcoded factual result.

## 22. Automatic evaluation

A registered ACTIVE change may be re-evaluated after successful analytics sync, but:

- no more than necessary;
- use existing scheduler/lock patterns;
- failures must not break Stage 07/10 sync or Stage 06 order worker;
- dashboard remains local-first;
- no live Metrika request per page load;
- immutable prior evaluations should remain inspectable.

If automatic evaluation materially increases Metrika requests, report exact request delta. Prefer calculations from local tables; exact-window user snapshots are the main allowed reason for additional API calls.

## 23. Data quality gates

An evaluation must be blocked or downgraded when relevant:

- analytics freshness stale;
- metric unavailable for part of either window;
- measurement definition changed;
- cutover day contaminates comparison;
- sample below minimum;
- required unique-user snapshot unavailable;
- CRM cohort immature;
- ClientID coverage inadequate for matched metric;
- COGS incomplete for profit metric;
- overlapping change;
- unsupported segment.

Never replace blocked values with zero.

## 24. Performance

Targets:

- growth list/status <= 1 s typical production local DB;
- single evaluation retrieval <= 1 s typical;
- evaluation compute <= 3 s for normal windows excluding asynchronous Metrika snapshot acquisition;
- no N+1;
- cache read-heavy results where consistent with existing dashboard behavior.

Report SQL query counts and timings on production-like data.

## 25. Security/privacy

- ADMIN only;
- no OAuth token/client secret exposure;
- no ClientID in UI/evaluation payloads;
- no names, phones, email, Telegram/MAX handles, free-text customer content;
- audience definitions must be constrained to approved analytical dimensions, not arbitrary PII filters;
- hypotheses/descriptions are internal admin text and must never be sent to Metrika.

Existing Yandex OAuth rotation debt remains separate and nonblocking for Stage 11 implementation unless security state changes.

## 26. Tests — mandatory

At minimum cover:

1. exact equal before/after window construction;
2. cutover day exclusion;
3. 7/14/21/28-day weekday alignment;
4. measurement availableFrom mismatch → INCOMPARABLE;
5. event-model cutover fixture 12.09 → no false uplift;
6. unique users not summed from daily rows;
7. arbitrary-window unique users unavailable or exact snapshot only;
8. low sample → INSUFFICIENT_DATA despite large percentage delta;
9. zero denominator semantics;
10. positive/negative/no-clear-change synthetic cases;
11. MDE and required-sample calculations against independently checked fixtures;
12. maturity: immediate vs accepted vs paid/profit;
13. immature post cohort not treated as final;
14. site metric vs total CRM scope mismatch;
15. low ClientID coverage gate;
16. COGS quality gate;
17. overlapping changes;
18. source/device mix confounder;
19. unsupported cross-segment rejected;
20. observational result always causality NOT_ESTABLISHED;
21. primary metric locked/traceable once evaluation begins (define mutation policy explicitly);
22. auth 401/403; validation 400;
23. no PII in API/UI/persistence intended analytics payloads;
24. Stage 09/10 regression;
25. Stage 06 worker/scheduler unaffected by implementation.

Statistical formulas must have deterministic unit tests against independent reference values. Do not accept “library returned a number” as the only validation.

## 27. Implementation workflow

Implementation must happen on `feature/analytics-foundation` (or a Reviewer-approved descendant) with production untouched.

Executor sequence:

1. audit current Stage 08–10 services/schema and write `GROWTH_DATA_CONTRACT.md`;
2. write `GROWTH_STATISTICS.md` documenting formulas, assumptions, MDE and verdict rules;
3. propose final Prisma model/migration;
4. implement registry;
5. implement window/comparability engine;
6. implement maturity engine;
7. implement statistical/descriptive evaluation;
8. implement confounder detection;
9. implement API;
10. implement dashboard section;
11. implement optional exact-window snapshot integration only if justified;
12. tests/reconciliation/performance/privacy;
13. update Stage 11 report.

Do not deploy production.

## 28. Required executor report

Return:

### RESULT
`READY_FOR_REVIEW` / `BLOCKED`

### AUDIT
What was reused from Stages 08–10; actual schemas/services; any contradictions with this spec.

### DATA MODEL
Tables/migration/indexes; destructive SQL check.

### CHANGE REGISTRY
Fields, validation, lifecycle, auditability.

### COMPARISON ENGINE
Window rules, cutover handling, availability/comparability.

### MATURITY
Empirical lag analysis and chosen policy with sample sizes.

### STATISTICS
Methods, alpha/power assumptions, MDE, required sample, sparse-data handling, independent fixture verification.

### METRICS / SCOPE
Which site/matched/CRM/P&L metrics are supported and which are context-only.

### CONFOUNDERS
Weekday/source/device/landing/overlap/data-quality behavior.

### A/B CAPABILITY
Must explicitly say whether real variant assignment exists. Do not call observational comparisons A/B tests.

### API / UI
Routes, auth, screenshots desktop/mobile, empty/loading/error/insufficient/immature/incomparable states.

### RECONCILIATION
Service/API/local SQL/source comparisons and diffs.

### PERFORMANCE
SQL counts/timings/cache and any additional Metrika request cost.

### PRIVACY
PII audit.

### TESTS
Counts and relevant cases.

### GIT
Branch/commits/master state.

### PRODUCTION_UNTOUCHED
Explicit confirmation.

### NEW FACTS / DEVIATIONS / OPEN DECISIONS
Anything discovered; do not silently reinterpret requirements.

## 29. Decision gate

Reviewer may mark Stage 11 implementation `READY_FOR_PRODUCTION_ROLLOUT` only if:

- no causal overclaim;
- low traffic produces honest INSUFFICIENT_DATA;
- MDE/sample requirement is implemented and verified;
- before/after windows are comparable and cutovers handled;
- maturity prevents premature paid/revenue/profit conclusions;
- site and total CRM metrics are not mixed;
- unique-user semantics remain correct;
- confounders are visible;
- A/B capability is not falsely claimed;
- API/UI use canonical services/local data;
- no PII;
- tests/reconciliation/performance pass;
- Stage 06/09/10 do not regress;
- production remained untouched.

Production rollout will be a separate MD/gate after Reviewer review.

## 30. Reviewer decisions fixed for Stage 11

For this implementation gate:

- Logs API remains OFF / not required.
- Real A/B variant assignment is NOT part of default Stage 11 implementation.
- G2–G5 event-model changes from Stage 10 are NOT bundled into Stage 11.
- Before/after observational analysis is the primary Stage 11 deliverable.
- Exact-window unique-user snapshots may be added only if they fit existing local-sync architecture; never fake unique users by summing days.
- Statistical uncertainty is mandatory; “percentage went up” is never enough.
- Business outcomes must respect cohort maturity and attribution scope.

---

# 31. EXECUTOR_REPORT — 15.09.2026

### RESULT

```text
READY_FOR_REVIEW
```

Реализовано на `feature/analytics-foundation` (с влитым `master` владельца 3ac9be8), проверено на свежей копии
production-базы `crm_stage11_test` (снята 15.09 15:53 MSK, удалена после проверок). Production не менялся: ни деплоя
CRM, ни env, ни миграции, ни данных; таблиц реестра в боевой базе нет. Логс API не включался, A/B-разделения нет,
event model сайта не трогалась.

### AUDIT

```text
Переиспользовано: AnalyticsMetricsService.getOverview (визиты, siteLeads, matched*, P&L окна, покрытие ClientID, снимок
уникальных по точному периоду), .lifecycles (даты жизненного цикла заказов → когорты и эмпирические задержки),
.getTrafficSources / .getUtm (только для аудиторий source / utm); BehaviorMetricsService.loadInput (цели form_started /
lead_submit_attempt / form_error, устройства и страницы входа с достижениями lead_submitted); MetrikaPeriodSnapshotService
.refreshRange (точные снимки окон из хука расписания); константы доступности этапов 08/10; хук после тика добавлен в
MetrikaAnalyticsSchedulerService.registerAfterSync (модуль расписания о росте не знает — цикла модулей нет).
Фактические схемы: MetrikaPeriodSnapshot уже принимает произвольные периоды (preset nullable) — отдельной таблицы
снимков окон не потребовалось. Противоречий со спецификацией нет; уточнения — DEVIATIONS.
Полный контракт — GROWTH_DATA_CONTRACT.md, формулы — GROWTH_STATISTICS.md.
```

### DATA MODEL

```text
AnalyticsChange (реестр, primaryLockedAt) + AnalyticsChangeEvaluation (версии: unique(changeId, version), result JSONB,
flags, окна DATE, observationCutoff, metricVersion, lastSyncRunId) — миграция 20260915130000_analytics_change_registry:
2 CREATE TABLE, 3 CREATE INDEX, 1 FK ON DELETE CASCADE; DROP / ALTER / UPDATE / DELETE / TRUNCATE — 0. Применена на копии
(prisma migrate deploy), в production — нет. После слияния master миграции владельца 20260915120000 / 170000 / 173000
соседствуют по имени; deploy применяет недостающие независимо от порядка применённых.
```

### CHANGE REGISTRY

```text
Поля — раздел 4 спецификации целиком (+ evaluationDays 7|14|21|28, primaryLockedAt). Валидация: DTO class-validator с
whitelist/forbidNonWhitelisted (лишние поля, в т. ч. любые PII-поля → 400), сервисная проверка дат (endedAt > startedAt),
аудитории (только device|source|utm|landing, 1–20 значений), метрик из каталога. Жизненный цикл: DRAFT → ACTIVE →
COMPLETED / CANCELLED; CANCELLED не оценивается. Аудит: первая оценка фиксирует primaryMetric и expectedDirection
(PATCH → 400 «зафиксирована первой оценкой»), остальные поля правятся; каждая оценка — новая версия с trigger и датой;
проверено на копии (PATCH до оценки 200, после — 400; v1 неизменна при v2). Общего audit-log в проекте нет — пробел
задокументирован, отдельная подсистема не строилась.
```

### COMPARISON ENGINE

```text
buildWindows: день cutover по Москве исключён (кроме ровно 00:00 MSK), окна равной длины из полных дней, авто —
целые недели ≤ 28, SHORT_WINDOW при < запрошенного, AFTER_WINDOW_TRUNCATED_BY_END, наблюдение — вчера по Москве не
позже последнего дня данных; состав дней недели → WEEKDAY_MIX_MISMATCH. metricComparability: measuredFrom по
availableFrom, PARTIAL_MEASUREMENT_PERIOD / METRIC_UNAVAILABLE_* / MEASUREMENT_DEFINITION_CHANGED → INCOMPARABLE без
процента прироста. Фикстура 12.09 13:19 MSK × siteLeadRate на копии: INCOMPARABLE (METRIC_UNAVAILABLE_BEFORE +
MEASUREMENT_DEFINITION_CHANGED), числа 3,92 % (2/51) → 7,41 % (2/27) показаны, «+88,9 %» выводом не является.
```

### MATURITY

```text
Эмпирика из lifecycles копии (15.09): заявка → принят n = 24 (медиана 0, p90 0,7 дн. → политика 1 день, empirical);
принят → оплата n = 212 (p90 20 дн.); заявка → оплата n < 20 → политика paid по умолчанию 14 дн. с флагом
MATURITY_HISTORY_INSUFFICIENT. Когорты — по дате заявки / принятия в окне, исходы до конца дня наблюдения (не календарные
оплаты); статусы MATURE / PARTIALLY_MATURE (после медианы) / IMMATURE с maturityUntil; вердикт IMMATURE не считается итогом
даже при большой разнице (тест: leadToPaidRate 25 % → 62,5 % → IMMATURE, после 15.10 → POSITIVE_SIGNAL).
```

### STATISTICS

```text
Методы: Wilson + Newcombe (метод 10) + z-тест с объединённой долей / точный Фишера при ожидаемых < 5 (доли); условный
биномиальный точный тест и интервал отношения интенсивностей через Wilson (счётчики); перцентильный бутстрэп
разности средних с фиксированным зерном (средний чек); суммы — описательно (STATISTICAL_TEST_UNAVAILABLE).
α 0,05 (двусторонний), мощность 0,8, целевой эффект 20 %: MDE и требуемая выборка в каждой оценке словами
(«заметим только эффект от ±… (±… % от базы); чтобы заметить 20 %, нужно ≈ N визитов/событий на окно»).
Независимые контрольные значения (Python + опубликованные примеры): Wilson 5/100 (0,02154; 0,11175); Newcombe 56/70 →
48/80 (−0,3339; −0,0524); z = 2,357 / p 0,0184; Фишер 3/4 vs 1/4 = 0,4857; Пуассон 10 → 20 p 0,0987, RR (0,952; 4,200);
требуемая выборка 10 % → 15 % = 686; MDE 5 % при 500/500 = 3,86 п.п.; событий для +20 % = 432; бутстрэп детерминирован.
Первичная метрика заявляется до оценки и фиксируется; вторичные — исследовательские; NO_CLEAR_CHANGE — только если MDE
≤ 20 %, иначе INSUFFICIENT_DATA (низкий трафик честно даёт именно его).
```

### METRICS / SCOPE

```text
Поддержаны 21 метрика (GROWTH_DATA_CONTRACT.md § 3): сайт (visits, siteLeads, siteLeadRate, formStarts, formStartRate,
leadAttempts, formErrors, formErrorRate), сопоставленные (matchedAccepted, matchedAcceptedRate, matchedPaid — всегда
контекст, гейт покрытия ClientID ≥ 50 %), CRM-когорты (crmLeads, acceptedOrders, leadToAcceptedRate, leadToPaidRate,
paidOrders, paidAov, contractValue, paidOrderValue), P&L (realizedRevenue, netProfit — контекст для сайта/CRM, первичны
для цен/операций; COGS_INCOMPLETE блокирует прибыль). Правка сайта с первичной crmLeads → METRIC_SCOPE_MISMATCH.
Итоги CRM не смешиваются с метриками сайта: контекст подписан «контекст описывает бизнес, а не эффект изменения».
```

### CONFOUNDERS

```text
Дни недели (окна не из целых недель), сдвиг смеси источников / устройств / страниц входа ≥ 15 п.п. (описательно, с
долями до/после), смена определения метрик (по заявленным метрикам), пересекающиеся ACTIVE/COMPLETED изменения (ids),
устаревшие данные, малая выборка, покрытие ClientID, COGS, незрелость. Ни один не «исправляет» числа и не утверждает
причину; все перечислены в INTERPRETATION. На копии обе фикстуры получили OVERLAPPING_CHANGE друг от друга ✓.
```

### A/B CAPABILITY

```text
NO_VARIANT_ASSIGNMENT: на сайте нет стабильного назначения вариантов и событий экспозиции; все оценки —
OBSERVATIONAL_BEFORE_AFTER, наблюдательные сравнения A/B-тестами не называются (status.abCapability, поле в каждой оценке,
плашка в UI). Будущий контракт вариантов (experimentId, variantId, анонимный ключ, assignmentAt, exposure event,
persistence, consent, без PII) описан в GROWTH_DATA_CONTRACT.md как отдельный gate; web-photo не менялся.
```

### API / UI

```text
Маршруты: GET status; GET/POST changes; GET/PATCH changes/:id; POST changes/:id/evaluate; GET changes/:id/evaluations,
…/latest, …/:version — ADMIN only (JwtAuthGuard + RolesGuard), флаг ANALYTICS_DASHBOARD_ENABLED (выключен → 404 кроме
status). На копии: без токена 401, EXECUTOR 403 (GET и POST), невалидное тело 400 с перечнем ошибок и «customerPhone
should not exist».
UI: вкладка «Рост / Изменения» в /crm/analytics — плашка NO_VARIANT_ASSIGNMENT и дисклеймер, список изменений (вердикт,
до → после; дельта крупно только при POSITIVE / NEGATIVE / NO_CLEAR_CHANGE, иначе «разница не оценивается»), форма
регистрации (московское время → ISO, метрики другой области подписаны «только контекст», аудитория из одобренных
измерений), детали: окна и исключённый день, до → после → разница, интервал / p / метод / MDE словами, сопоставимость
и созревание, ФАКТ / ИНТЕРПРЕТАЦИЯ / ЧТО ДЕЛАТЬ, оговорки с долями, вторичные и контекст, сегменты, уникальные только из
снимков, пометки качества, версии оценок, «Оценить сейчас». Скриншоты docs/analytics/screenshots/11_growth/:
growth-loading, growth-desktop-incomparable (фикстура 12.09), growth-desktop-insufficient (визиты, окно 2 дня),
growth-desktop-form, growth-desktop-error (500 через перехват), growth-desktop-empty, growth-mobile-390 (scrollWidth 390).
```

### RECONCILIATION

```text
Копия crm_stage11_test, backend :3000, вход stage11_admin (только в копии). A = HTTP POST evaluate, B = AnalyticsGrowthService
на тех же строках, C = независимый SQL (MetrikaDailyTraffic / MetrikaDailyGoal / MetrikaDailyBehaviorDevice /
MetrikaPeriodSnapshot) и когорты этапа 08 (Overview.crmFunnel.cohorts.leadCohortSize / acceptedCohortSize):
  фикстура 12.09 × siteLeadRate: A = B по 501 листу JSON diff 0; A = C 12 проверок diff 0 (siteLeads 2/2, rate 3,92/7,41,
    formStarts 8/3, crmLeads 0/1, acceptedOrders 5/9, periodUsers null/null)
  фикстура 12.09 × visits:       A = B 378 листьев diff 0; A = C 8 проверок diff 0 (visits 51/27, crmLeads, accepted, users)
Версии: v1 неизменна после v2; latest = v2. afterSync на копии: {evaluated 0, snapshotRequests 0, errors 0} — без нового
полного дня переоценки нет (клиент Метрики в копии не настроен — снимки окон не запрашивались).
```

### PERFORMANCE

```text
Одна оценка: 76 SQL-запросов, постоянное число (OrderPhoto с позициями ×5: 2 обзора × (заказы + P&L) + lifecycles;
поведенческие агрегаты ×2 по 13; источники ×2 по 1; реестр 4–6; N+1 нет). На копии через SSH-туннель (RTT 122–163 мс):
evaluate 2,2–2,7 с (первые прогоны 6–8 с при RTT 163 мс и старой схеме загрузки — оптимизировано: устройства/страницы из
поведенческих агрегатов, источники одним groupBy); list 2 SQL 0,25–0,35 с; status 7 SQL 0,4 с (lifecycles для эмпирики);
getEvaluation 1 SQL 0,1 с. Ожидание на бою (БД в соседнем контейнере, RTT ~1 мс) — ≤ 1–1,5 с на оценку; цель ≤ 3 с
проверяется при rollout. Дополнительные запросы к Метрике: только точные снимки окон из хука расписания — ≤ 4 на
ACTIVE/COMPLETED изменение за тик, пока окна не устоялись, затем 0; из запросов дашборда — 0.
```

### PRIVACY

```text
Реестр: name / description / hypothesis — внутренний текст администратора (в Метрику не уходит), аудитория — только
device | source | utm | landing; DTO отбрасывает любые лишние поля (проверено: customerPhone → 400). Оценки: числа,
даты, коды, тексты FACT / INTERPRETATION / RECOMMENDATION; ClientID, телефоны, e-mail, имена, Telegram/MAX не хранятся и
не отдаются. Скан сохранённых строк копии regex-паттернами дал 4 «попадания» — все ложные: ISO-даты («026-09-14»),
цифровые хвосты чисел с плавающей точкой в статистике и имя поля clientIdCoverageAccepted (доля в %, не идентификатор).
```

### TESTS

```text
CRM (jest): 1012 / 1012, 93 suites (было 960 до этапа + тесты владельца). Этап 11 — 50: growth-statistics.spec (9,
независимые контрольные значения), growth-compute.spec (23: окна и день cutover, авто-длина, endedAt/lastDataDay,
сопоставимость, фикстура 12.09 без ложного роста, малая выборка при +200 %, нулевой знаменатель, positive / negative /
no-clear синтетика, короткое окно, уникальные не суммируются, scope mismatch, покрытие ClientID, COGS, созревание и
незрелая когорта, lagInputsFrom, пересечения, сдвиг смесей, сегменты и неподдерживаемые, causality/контракт, бутстрэп
среднего чека), analytics-growth.service.spec (5: валидация и фиксация первичной метрики, версии и когорты, cohortsFor,
afterSync, status), growth-dashboard.controller.spec (4: guards/ADMIN, флаг, маршруты, DTO whitelist/PII/аудитория),
metrika-analytics-scheduler.service.spec (+1: хук после тика, ошибка хука не ломает тик). Покрытие разделов 26.1–26.25 —
все; 26.24/26.25 — прежние тесты этапов 06/09/10 зелёные без правок.
Панель (vitest): 35 / 35 — growth.test.tsx 5 (дельта не заголовок при INSUFFICIENT_DATA, FACT/интерпретация/рекомендация
и дисклеймер, MDE словами, INCOMPARABLE / IMMATURE, форма отправляет только одобренные поля и московское время).
Build: nest build OK, tsc -b && vite build OK; lint: eslint growth/ 0 проблем, prettier чисто; frontend eslint по
аналитике 0 (19 прежних проблем репозитория вне аналитики — как на HEAD).
```

### GIT

```text
feature/analytics-foundation: 51f850d docs спецификация; 41be79b feat backend; e2583cb feat панель; 70f4aab merge
origin/master 3ac9be8 (владелец: Telegram-темы исполнителей, локальные агенты — 11 коммитов 15.09); 5328917 fix правила
после сверки; 8d10b7c docs — GROWTH_DATA_CONTRACT.md, GROWTH_STATISTICS.md, отчёт § 31, DASHBOARD_CONTRACT § 11b, master
plan, current state, скриншоты; 0c3b84a FIX_00 (после verdict Reviewer READY_FOR_PRODUCTION_ROLLOUT, для требования
rollout-плана «выкатывать выключенным») — свой флаг ANALYTICS_GROWTH_ENABLED поверх флага дашборда: growth-flags.ts,
гейт хука в growth.module.ts, строка compose-шаблона, текст вкладки, +3 теста (CRM 1015 / 94 suites).
master = 3ac9be8 (production CRM, задеплоен владельцем 15.09 15:55–17:49); master ⊂ feature. Rollout-план —
11_PRODUCTION_ROLLOUT.md (READY_FOR_REVIEW), кандидат 0c3b84a на подтверждение Reviewer.
```

### PRODUCTION_UNTOUCHED

```text
CRM production не менялся этапом 11: master 3ac9be8 — коммиты владельца, наш код в master не пушился; env / compose /
данные не трогались; таблиц AnalyticsChange* в боевой базе нет (миграция применялась только на копии, копия удалена).
Отдельно и вне этапа 11 по прямой команде владельца 15.09 20:27 восстановлен сайт web-photo (см. NEW FACTS).
```

### NEW FACTS / DEVIATIONS / OPEN DECISIONS

```text
NEW FACTS
1. Сегодняшние окна для изменения 12.09: после cutover есть лишь 2 полных дня (13–14.09) → любое сравнение сейчас
   SHORT_WINDOW; первое недельное окно 13–19.09 станет доступно 20.09.
2. Задержки CRM: заявка → принят p90 0,7 дня (n = 24), принят → оплата p90 20 дней (n = 212); пар «заявка → оплата»
   меньше 20 — созревание оплат пока по умолчанию 14 дней.
3. Параллельно 15.09 владелец задеплоил в CRM Telegram-темы исполнителей и локальных агентов (3 миграции); влито в
   feature без конфликтов, 1012 тестов зелёные.
4. 14.09 18:17 пуш устаревшей ветки web-photo feature/print-card-lead-form (по просьбе «отправить всё») перезаписал тег
   latest сайта августовской сборкой (её workflow триггерится на саму себя); 15.09 20:27–20:32 по команде владельца сайт
   восстановлен пересборкой из feature/cms-admin (коммит cc9bc89 без изменений кода, /api/health → cc9bc89).
   Event model сайта при этом не менялась. Урок и защита — предложение удалить ветку на origin (решение владельца).

DEVIATIONS
1. Добавлено правило вне буквы спецификации: окно < 7 полных дней → SHORT_WINDOW и вердикт не выше INSUFFICIENT_DATA
   (на копии 2-дневное окно давало NEGATIVE_SIGNAL для визитов при сравнении будней с выходными — формально значимый,
   но бессмысленный сигнал). Порог MIN_WINDOW_DAYS_FOR_SIGNAL = 7, задокументирован.
2. Confounders о смене определения / покрытии / COGS считаются по заявленным метрикам (первичная + вторичные), контекст —
   отдельно со своими вердиктами (иначе оговорки шумят метриками, которых пользователь не спрашивал).
3. Сегменты по устройствам и страницам входа берутся из поведенческих агрегатов этапа 10 (визиты и достижения
   lead_submitted совпадают со срезами этапа 09); matchedPaid по срезам не хранится → сегменты по нему не поддержаны.
4. Фикстура 17.2 («деплой web-photo с неизменной семантикой») привязана к тому же деплою 12.09 с метрикой visits: других
   точно датированных production-деплоев сайта с неизменной семантикой нет; результат — INSUFFICIENT_DATA (окно 2 дня).
5. Точные снимки уникальных за окна реализованы через существующий MetrikaPeriodSnapshotService (таблица та же), но на
   копии не запрашивались (клиент Метрики не настроен) — поведение проверено юнит-тестом хука; фактические запросы
   увидим при rollout.
6. Общего audit-log в проекте нет: аудит реестра — updatedAt, primaryLockedAt и неизменяемые версии оценок.

OPEN DECISIONS
1. Production rollout — отдельный документ и gate (миграция 20260915130000 применится на старте контейнера; env не
   меняется; хук расписания добавит ≤ 4 запроса к Метрике на активное изменение за тик до устоявшихся окон).
2. Подтвердить на бою цель производительности evaluate ≤ 3 с (76 SQL; на копии через туннель 2,2–2,7 с).
3. Пороги MIN_WINDOW_DAYS_FOR_SIGNAL = 7, MIX_SHIFT 15 п.п., TARGET_RELATIVE_EFFECT 20 %, покрытие ClientID 50 % — конфигурация
   в growth-rules.ts; менять — решением Reviewer.
4. Реальное A/B (назначение вариантов в web-photo) — отдельная спецификация; G2–G5 этапа 10 не тронуты.
5. Удаление устаревшей ветки web-photo feature/print-card-lead-form на origin — решение владельца.
```
