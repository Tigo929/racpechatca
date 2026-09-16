# INSIGHTS_DATA_CONTRACT.md

# Контракт данных автоматических сигналов (этап 12)

## Статус

```text
IMPLEMENTED 16.09.2026 в feature/analytics-foundation. Код: crm-new/src/analytics/insights/ (insights-contract.ts,
insights-engine.ts, analytics-insights.service.ts, insights-dashboard.controller.ts, insights-enabled.guard.ts,
insights-flags.ts, insights.module.ts), панель: frontend/src/types/insights.ts, features/analytics/insights-sections.tsx.
Миграция 20260916120000_analytics_insights — только CREATE. Production не выложен (флаг ANALYTICS_INSIGHTS_ENABLED
default false).
```

## 1. Аудит переиспользования (раздел 3 спецификации)

| Слой | Что переиспользовано | Как |
|---|---|---|
| Этап 07 | `MetrikaDaily*`, `MetrikaSyncRun`, `MetrikaPeriodSnapshot` | только через сервисы ниже; свежесть — `freshnessOf(последний SUCCESS тик)`; хук после тика `registerAfterSync('insights:run')` |
| Этап 08 | `AnalyticsMetricsService.getOverview / lifecycles / getTrafficSources / getLandings / getProducts` | данные окон, когорты CRM (`cohortsFor` этапа 11), покрытие ClientID, `COGS_UNRELIABLE_ORDERS`, `paidWithoutDate`, P&L |
| Этап 09 | срезы источников / страниц / товаров (`Slice`, `CrmSlice`) | детекторы по сущностям; полярность метрик каталога этапа 11 (+ `visits` → контекст) |
| Этап 10 | `BehaviorMetricsService.getIssues / getFunnels / loadInput` | правила «Требует внимания» зеркалятся как карточки с `source: STAGE10_RULE` без пересчёта; `skipped` → причины молчания `PARTIAL_BEHAVIOR_PERIOD / LOW_SAMPLE / INCOMPARABLE_PERIODS`; `not_measured`, `measuredFrom`, `transition` — внутри правил этапа 10 |
| Этап 11 | `buildWindows`, `observationCutoffOf`, `evaluateMetric`, `computeStatistics`, `computeConfounders`, `poissonRateComparison`, `maturityPolicyFrom / lagInputsFrom`, `AnalyticsGrowthService.loadWindow / overlappingChanges / lastDataDay` (сделаны публичными, поведение не менялось), `AnalyticsChange` + последняя `AnalyticsChangeEvaluation` | окна 7/7, статистика, MDE, сопоставимость (cutover 12.09), созревание, confounders (смеси, пересечения, stale), гейт покрытия ClientID и COGS; оценки этапа 11 поднимаются в ленту дословно |

Своих формул KPI, статистики и второй реализации созревания у этапа 12 нет. Границы данных — единый объект
`DATA_BOUNDARIES` (`insights-rules.ts`): история Метрики с 13.08.2026, cutover семантики заявок 12.09.2026 13:19 MSK,
инцидент 14.09 18:20 → 15.09 20:32 MSK (окна, пересекающие его, получают ограничение `INCIDENT_BOUNDARY`).

## 2. Хранение (миграция `20260916120000_analytics_insights`, только CREATE)

| Таблица | Назначение | Ключевые поля |
|---|---|---|
| `AnalyticsInsight` | одна карточка на эпизод сигнала | `fingerprint` unique (базовый отпечаток, для повторных эпизодов `#N`), `baseFingerprint`, `episode`, `category`, `severity`, `status` (OPEN / ACKNOWLEDGED / RESOLVED / SUPERSEDED), `scope`, `source`, `detectorId`, `metricKey`, `entityKey`, `periodStart/End`, `baselineStart/End` DATE, `title`, `fact / hypothesis / recommendation / evidence / limitations / quality` JSONB, `causality` = NOT_ESTABLISHED, `link`, `firstDetectedAt`, `lastDetectedAt`, `resolvedAt`, `resolvedReason`, `acknowledgedAt`, `latestVersion`, `payloadHash`; индексы (status, severity, lastDetectedAt), (baseFingerprint) |
| `AnalyticsInsightVersion` | неизменяемые версии полезной нагрузки | `insightId` FK cascade, `version`, `generatedAt`, `syncRunId`, `runId`, `payload` JSONB, `payloadHash`; unique(insightId, version) |
| `AnalyticsInsightRun` | журнал запусков движка | `kind` (daily / hourly / manual), `status` (RUNNING / SUCCESS / FAILED / LOCKED / SKIPPED), `startedAt / finishedAt`, `observationCutoff`, `syncRunId`, счётчики detectors / detected / created / versioned / unchanged / resolved / reopened, `suppressed` JSONB (диагностика молчания), `errors`, `durationMs`, `seenEvaluations` JSONB `{changeId: version}` |

Без PII: тексты — только агрегаты, подписи метрик, идентификаторы аналитических сущностей (источник, путь страницы,
категория товара, id изменения). DTO с whitelist, ADMIN only, OAuth/токены не хранятся.

## 3. Полезная нагрузка карточки (`InsightPayload`)

```text
category · severity · scope (site | crm | money | data | change) · source (STAGE12_DETECTOR | STAGE10_RULE | STAGE11_EVALUATION)
detectorId · metricKey · entityKey · title
fact           { text, metric, unit, current, baseline, absoluteDelta, relativeDelta, sample {current, baseline, minimum}, period, baselinePeriod }
hypothesis     { status: SUPPORTED_BY_CONCURRENT_FACTS | NO_SUPPORTED_HYPOTHESIS, text, supportingFacts[] }
recommendation { text, kind: WAIT_FOR_SAMPLE | WAIT_FOR_MATURITY | CHECK_TECHNICAL | CHECK_MANUALLY | COMPARE_SEGMENT |
                 REGISTER_CHANGE | USE_STAGE11_RECOMMENDATION | IMPROVE_DATA_QUALITY | OBSERVE }
evidence       { statisticalStrength NONE|WEAK|SIGNAL, businessMateriality NONE|LOW|MATERIAL, metricEvaluation (этап 11) | null,
                 verdict | null, context[{metric, before, after, unit}], confounders (этап 11), refs[{kind, id, label}],
                 rule {detectorId, thresholds} }
limitations[]  коды этапа 11 (DataQualityFlag) + PARTIAL_BEHAVIOR_PERIOD, CRM_INCLUDES_OFFLINE, INCIDENT_BOUNDARY,
               STAGE10_RULE_MIRROR, STAGE11_VERDICT_PRESERVED, NO_SUPPORTED_HYPOTHESIS, DESCRIPTIVE_ONLY, NOT_MEASURED_STEPS
quality        { freshness, flags, notes[] (всегда с дисклеймером) }
causality      'NOT_ESTABLISHED'
link           { tab: overview | behavior | growth | sources | products | pages | quality, id? }
engineVersion  'insights-v1'
```

## 4. Отпечаток, версии, жизненный цикл (разделы 20–23)

- `fingerprint = sha1(category | detectorId | metricKey | entityKey)[0:20]` — период в отпечаток не входит: тот же сигнал
  в новом окне — та же карточка.
- Каноническая нагрузка для сравнения: JSON с отсортированными ключами, числа округлены до 1e-6, без `quality.freshness`
  и ссылок `sync_run`. Тот же хэш → только `lastDetectedAt` обновляется (без версии); другой хэш → `version + 1`,
  неизменяемая строка `AnalyticsInsightVersion`.
- Условие пропало (детектор запускался, отпечатка нет) → `RESOLVED`, `resolvedReason` «условие сигнала больше не
  выполняется». Карточки `change.evaluation` живут, пока изменение в реестре.
- Вернулось в течение `REOPEN_WINDOW_DAYS = 7` после закрытия → тот же эпизод снова `OPEN` (версия +1, `reopened`);
  между 7 и 10 днями → `COOLDOWN` (карточки нет); позже → новый эпизод (`fingerprint#N`, `episode N`, старая — `SUPERSEDED`).
- `MAX_ACTIVE_PER_DETECTOR = 3` — лишние обнаружения детектора уходят в диагностику как `COOLDOWN`.
- Ручные действия: `acknowledge` (OPEN → ACKNOWLEDGED, не означает исправления), `resolve` с причиной ≥ 3 символов
  (`resolvedReason` «вручную: …»). Удаления истории нет.
- Причины молчания (`SuppressionReason`): LOW_SAMPLE, INSUFFICIENT_DATA, IMMATURE, INCOMPARABLE_PERIODS,
  PARTIAL_BEHAVIOR_PERIOD, METRIC_NOT_AVAILABLE, MEASUREMENT_DEFINITION_CHANGED, WEEKDAY_MIX_MISMATCH, MATCHED_COVERAGE_LOW,
  COGS_INCOMPLETE, STALE_DATA, DUPLICATE, COOLDOWN, NO_MATERIAL_CHANGE — с текстом «чего не хватило» и выборкой; хранятся в
  журнале запуска, отдаются в `quality` и сводкой в `feed.suppressedSummary`.

## 5. Расписание (раздел 24)

- Хук `insights:run` после каждого успешного тика расписания этапа 07 (только при включённом флаге):
  `observationCutoff` (вчера по Москве, не позже последнего дня данных) новее cutoff последнего успешного daily → **daily**
  (все детекторы, полный контекст: ~140–150 SQL); иначе **hourly** — лёгкий контекст (свежесть + оценки этапа 11, 12 SQL),
  детекторы с `refresh: 'hourly'` (`quality.stale`, `change.evaluation`). Ручной `POST /run` = daily.
- Замок: флаг в процессе + строка журнала `RUNNING` моложе 10 минут (advisory lock сессии с пулом Prisma ненадёжен —
  unlock уходит в другое соединение; обнаружено на копии). Зависший RUNNING старше 10 минут не блокирует.
- Изоляция: ошибка контекста → строка `FAILED` с текстом, тик расписания SUCCESS независимо; запись результата — одна
  транзакция; uniques (fingerprint, (insightId, version)) защищают от дублей при гонке.
- К API Метрики движок не обращается вовсе; чтение API — только Postgres.

## 6. API (`/analytics/dashboard/insights`, ADMIN, флаги `ANALYTICS_DASHBOARD_ENABLED` + `ANALYTICS_INSIGHTS_ENABLED`)

| Путь | Ответ |
|---|---|
| `GET status` | `InsightsStatus` — enabled, engineVersion, словари, детекторы (id / категория / refresh / source), все пороги, counts по статусам, lastRun, границы данных; доступен и при выключенном разделе (`enabled: false`) |
| `GET feed?status=active|all|<status>&severity=&category=&limit=` | `InsightsFeed` — карточки в детерминированном порядке (CRITICAL данных → CRITICAL деловые → ATTENTION → INFO; внутри — свежее выше), total, `suppressedSummary`, lastRun |
| `GET :id`, `GET :id/versions` | карточка; неизменяемые версии по убыванию |
| `GET quality` | последний и 10 последних запусков, полный список причин молчания, активные по категориям |
| `POST :id/acknowledge`, `POST :id/resolve {reason}` | смена статуса; повтор → 400 |
| `POST run` | ручной полный запуск (ADMIN) — тот же код, что хук |

Флаг проверяется `InsightsEnabledGuard` **до** ValidationPipe: при выключенном разделе любой маршрут, кроме `status`,
отвечает 404 даже на невалидное тело (урок § 9.5 этапа 11). DTO: `FeedQueryDto` (только словари), `ResolveInsightDto`
(reason 3–300); лишние поля → 400.

## 7. UI

Вкладка «Инсайты» в `/crm/analytics` (`?tab=insights`): шапка с дисклеймером и границей инцидента; фильтры
активные / все / закрытые × уровень × категория; карточки — уровень, категория, окна, заголовок, три блока
(ФАКТ / ГИПОТЕЗА — НЕ ФАКТ (пунктирная рамка, курсив) / ЧТО ПРОВЕРИТЬ), ограничения подписями, качество данных,
впервые / последний раз / версия / эпизод, источник, переход к связанной вкладке, «Принять к сведению», «Детали»
(сила статистики и существенность отдельно, контекст, confounders, ручное закрытие с причиной). Пустое состояние —
«Сейчас нет сигналов, требующих внимания». Блок «Правил без вывода в последнем запуске» с причинами. 390 px без
горизонтальной прокрутки.
