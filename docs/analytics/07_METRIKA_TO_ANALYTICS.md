# 07_METRIKA_TO_ANALYTICS.md

# Этап 07 — Яндекс Метрика → локальная аналитика

## Статус

```text
REVIEW — реализовано 12.09.2026 и выложено в production тем же днём: master = b57c067,
миграция применена 17:07 MSK, verify 7/7, 7 дней → сверка 0 расхождений, 90 дней, качество,
покрытие; расписание включено 17:11 MSK, суточный и часовой циклы SUCCESS, lock подтверждён.
DONE ставит Reviewer.
```

Отчёт исполнителя — раздел 37 (реализация); production rollout — раздел 38.

Исполнитель не ставит этапу `DONE` самостоятельно. После реализации он возвращает `READY_FOR_REVIEW`; решение принимает ChatGPT.

---

# 1. Входной контекст

Принято и развернуто:

```text
00_MASTER_PLAN            = DONE
01_CURRENT_STATE          = DONE
02_ANALYTICS_DATA_MODEL   = DONE
03_HISTORICAL_BACKFILL    = DONE
04_EVENT_MODEL            = DONE
05_YANDEX_METRIKA_API     = DONE
06_CRM_TO_METRIKA         = DONE
06_PRODUCTION_ROLLOUT     = DONE
```

Production подтвержден:

```text
CRM migrations applied
structured attribution live
historical backfill applied
MetrikaOrderOutbox live
CRM→Metrika worker enabled
web analytics event-model deployed
false browser purchase disabled
```

Counter:

```text
111569944
```

Counter timezone:

```text
Europe/Moscow (+03:00)
```

---

# 2. Критические границы данных

Зафиксировать как immutable analytics metadata:

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT
= 2026-09-12 13:19:22 Europe/Moscow

LEAD_GOAL_SEMANTICS_CHANGED_AT
= 2026-09-12 13:19:22 Europe/Moscow
```

До этой границы:

```text
browser ecommerce.purchase = ложная семантика успешной заявки
lead_submitted исторически недосчитывал часть футболок/мерча
```

После этой границы:

```text
lead = lead_submitted
accepted order/payment/cancel = CRM → Metrika CDP/simple_orders
```

Никогда не использовать historical browser `purchase` как реальную оплату.

---

# 3. Canonical goals

Canonical lead:

```text
lead_submitted
```

Directional lead goals:

```text
lead_submitted_photo
lead_submitted_canvas
lead_submitted_tshirt
```

Error:

```text
form_error
```

CRM system goals:

```text
CRM: Заказ создан
CRM: Заказ оплачен
CRM: Заказ отменен
CRM: Спам заказ
```

Legacy URL goal:

```text
"Заявка отправлена" → /thanks
```

Legacy `/thanks` можно хранить для сравнения, но не считать canonical lead KPI.

Системные CRM goals резолвить по фактическим goal IDs из Management API, а не по human title в коде.

---

# 4. Главная цель этапа

Создать локальный аналитический слой:

```text
Yandex Metrika Reports API
↓
controlled sync
↓
PostgreSQL analytics tables
↓
future metrics/dashboard
```

Dashboard не должен зависеть от live API Яндекса.

Этап 07 должен локально предоставить агрегаты по:

- visits;
- users;
- pageviews;
- goals/conversions;
- traffic sources;
- UTM;
- landing pages;
- devices;
- pages/products where deterministic;
- CRM order-created / paid / cancelled goals.

---

# 5. API scope

Использовать V1:

```text
GET /stat/v1/data
```

Не использовать сейчас:

```text
Logs API
Direct API
```

Причина: для агрегированного V1 Reports API достаточно и он уже доказан live smoke.

Не делать:

```text
dashboard request → Yandex API → render
```

Только:

```text
scheduled/local sync → Postgres → dashboard later
```

---

# 6. MetrikaSyncRun

Создать модель:

```text
MetrikaSyncRun
```

Минимальные поля:

```text
id
dataset
dateFrom
dateTo
startedAt
finishedAt
status
rowsReceived
rowsStored
requestCount
sampled
sampleShare
dataLag
accuracy
lastError
createdAt
```

Status:

```text
RUNNING
SUCCESS
FAILED
PARTIAL
```

Статус должен быть честным по каждому dataset. Не скрывать частичный провал одного набора под общим SUCCESS.

---

# 7. Daily traffic

Создать:

```text
MetrikaDailyTraffic
```

Grain:

```text
1 row = 1 calendar day Europe/Moscow
```

Поля:

```text
date
visits
users
pageviews
```

Unique:

```text
date
```

---

# 8. Daily goals

Создать:

```text
MetrikaDailyGoal
```

Grain:

```text
date + goalId
```

Поля минимум:

```text
date
goalId
goalName
goalIdentifier
reaches/conversions
convertedUsers если API semantics подтверждены
conversionRate если API возвращает и semantics ясны
```

Stable key:

```text
goalId
```

Не использовать human title как primary identity.

---

# 9. Canonical goal registry

Создать typed/config registry:

```text
canonicalLeadGoalId
photoLeadGoalId
canvasLeadGoalId
tshirtLeadGoalId
formErrorGoalId
crmOrderCreatedGoalId
crmOrderPaidGoalId
crmOrderCancelledGoalId
```

Источник truth:

```text
Management API + GOALS_MANIFEST.md
```

В executor report показать реальные IDs всех canonical goals.

---

# 10. Traffic source dataset

Создать:

```text
MetrikaDailySource
```

Grain:

```text
date + source dimensions
```

Минимальные dimensions:

```text
trafficSource
sourceEngine
```

Metrics:

```text
visits
users
pageviews
lead conversions
CRM order-created conversions
CRM paid conversions
```

Если конкретная комбинация dimension/goal metrics несовместима — разделить queries/datasets и документировать limitation.

---

# 11. UTM dataset

Создать:

```text
MetrikaDailyUtm
```

Grain:

```text
date
+ utmSource
+ utmMedium
+ utmCampaign
+ utmContent
+ utmTerm
```

Metrics:

```text
visits
users
lead conversions
CRM order-created conversions
CRM paid conversions
```

Не смешивать:

```text
Metrika visit UTM
```

с:

```text
CRM-saved last-touch UTM
```

Это два разных источника, которые позже можно сравнивать.

---

# 12. Landing pages

Создать:

```text
MetrikaDailyLanding
```

Grain:

```text
date + landing dimension
```

Metrics:

```text
visits
users
lead conversions
order-created conversions
paid conversions
```

Хранить raw dimension и отдельный normalized path, если normalization безопасен.

Normalization не должна уничтожать исходное значение до проверки.

---

# 13. Devices

Создать:

```text
MetrikaDailyDevice
```

Grain:

```text
date + deviceCategory
```

Metrics:

```text
visits
users
lead conversions
order-created conversions
paid conversions
```

Нормализованные категории минимум:

```text
desktop
mobile
tablet
other
```

---

# 14. Pages

Создать:

```text
MetrikaDailyPage
```

Grain:

```text
date + normalizedPagePath
```

Metrics минимум:

```text
pageviews
visits/users where API semantics permit
lead conversions where compatible
```

Не выводить product entity из URL эвристикой, если mapping неоднозначен.

Допустим deterministic mapping `path → product slug/category`, если он уже существует в web content/config.

---

# 15. Query catalog

Создать:

```text
docs/analytics/METRIKA_QUERY_CATALOG.md
```

или эквивалентный typed registry + doc.

Для каждого dataset зафиксировать:

```text
name
dimensions
metrics
filters
accuracy
date grain
expected result grain
destination table
live API verified yes/no
```

Не размазывать ad-hoc Reports API query strings по коду.

---

# 16. Sampling / accuracy

Live smoke ранее показал:

```text
sampled=false
sample_share=1
```

Но каждый sync run обязан сохранять sampling metadata.

Если API вернул:

```text
sampled=true
```

данные не должны молча трактоваться как exact.

Не навязывать `accuracy=full` глобально без причины. Executor выбирает documented V1 policy и показывает её в отчёте.

---

# 17. Timezone

Все Metrika daily boundaries:

```text
Europe/Moscow
```

DB `DATE` допустим, если явно задокументировано:

```text
Metrika calendar date in counter timezone
```

Покрыть boundary test:

```text
21:00 UTC = 00:00 Europe/Moscow
```

---

# 18. Initial historical sync

Минимальный initial backfill:

```text
90 days
```

Порядок:

```text
1. 7-day controlled sync
2. reconciliation
3. 90-day historical sync
4. data-quality report
5. scheduler enable
```

В отчёте:

```text
earliest synced date
latest synced date
request count
rows per dataset
sampling
```

---

# 19. Incremental sync

После initial load целевой режим:

```text
hourly
```

Каждый hourly run пересчитывает rolling window минимум:

```text
последние 3 дня
```

Причина:

- data lag;
- late goal attribution;
- CRM matching может появляться позже.

Дополнительно раз в сутки пересчитать:

```text
последние 21 день
```

для late CRM/offline matching.

Если executor выбирает другой cadence/window — обосновать.

---

# 20. Replacement strategy

Aggregate sync должен быть idempotent.

Нельзя просто UPSERT returned rows и оставить stale dimensions.

Пример:

```text
sync 1: source A, source B
sync 2: API вернул только source A
```

После sync 2 локальный source B за этот период должен исчезнуть.

Предпочтительно:

```text
transaction
→ delete dataset rows in requested date range
→ insert fresh API result
→ commit
```

или эквивалентная versioned replacement strategy.

---

# 21. Scheduler

Создать service/scheduler по conventions проекта.

Feature flag:

```text
YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false
```

При первом production deploy scheduler должен быть OFF.

Требования:

- distributed lock;
- no overlap;
- retry/failure logging;
- manual CLI trigger;
- existing local data survives API outage.

Использовать PostgreSQL advisory lock или существующий project pattern.

---

# 22. CLI

Создать безопасную команду концептуально:

```text
npm run metrika:sync -- --from YYYY-MM-DD --to YYYY-MM-DD
```

Допустимо:

```text
--dataset traffic
--dataset goals
```

CLI token не печатает.

---

# 23. Existing client only

Использовать существующий:

```text
YandexMetrikaClient
```

Не создавать второй HTTP stack.

429/5xx/network/timeout — через существующую retry/error model либо совместимое расширение.

---

# 24. Live verification каждой query

TypeScript build недостаточен.

Каждый query catalog item должен пройти real read-only Reports API smoke.

Если dimensions/metrics несовместимы:

```text
не обходить ошибку выдуманными данными
```

а изменить query design и зафиксировать limitation.

---

# 25. Reconciliation local vs direct API

После 7-day sync сравнить локально и прямым Reports API одинаковые queries.

Минимум:

```text
visits
users
pageviews
lead_submitted
CRM: Заказ создан
CRM: Заказ оплачен
```

Таблица:

```text
metric | local | direct API | difference
```

При `sampled=false` и одинаковой semantics ожидается exact match.

---

# 26. CRM coverage sanity-check

Отдельно сравнить:

```text
CRM accepted orders
vs
Metrika CRM: Order created

CRM PAID
vs
Metrika CRM: Order paid
```

Не требовать 100% совпадения.

Измерить gap и причины:

- no ClientID;
- 21-day matching;
- pre-rollout history;
- delayed attribution;
- controlled test;
- order eligibility.

---

# 27. CONTROLLED_STAGE06_TEST

Заказ:

```text
f40a79d6-7a3b-4a5c-9ced-c441449fe2f0
```

помечен как:

```text
CONTROLLED_STAGE06_TEST
```

Не считать его обычным natural production transition при reconciliation/quality checks.

---

# 28. No PII / no raw visitors

На этапе 07 не импортировать raw visitor/session rows.

Не хранить из Метрики:

- ClientID-level rows;
- phone;
- email;
- IP;
- user/session identifiers.

Только агрегаты Reports API.

---

# 29. Data quality report

После 90-day sync вывести:

```text
date range
rows per dataset
sampled periods
zero-traffic days
unknown/empty source rows
unknown/empty UTM rows
top traffic sources
top UTM campaigns
top landing pages
lead conversions
CRM order-created conversions
CRM paid conversions
API errors
```

---

# 30. Tests

Обязательные группы.

## Parser

```text
normal API row
empty dimension
numeric value parsing
null metric
sampling metadata
API error
```

## Idempotency

```text
same period sync twice → no duplicates/totals drift
```

## Replacement

```text
row disappears from API → disappears locally for replaced period
```

## Timezone

```text
Europe/Moscow day boundaries
```

## Lock

```text
two concurrent syncs → only one executes
```

## Failure isolation

```text
Yandex timeout/429/5xx
→ sync FAILED/PARTIAL
→ previous local data remains readable
```

---

# 31. Production enable sequence

После implementation:

```text
1. migrate deploy
2. scheduler OFF
3. manual 7-day sync
4. direct API reconciliation
5. manual 90-day sync
6. data quality report
7. scheduler ON
8. observe минимум 1–2 scheduled cycles
```

Не включать scheduler сразу при deploy.

---

# 32. Не менять сейчас

Запрещено в этапе 07:

- менять MetrikaOrderOutbox/simple_orders pipeline;
- менять status mapping;
- менять revenue/cost logic;
- Logs API;
- Direct API;
- dashboard UI;
- финальные KPI formulas;
- ROAS/ROMI;
- multi-touch attribution;
- automated insights.

Этап 07 = data layer only.

---

# 33. Документация

Обновить:

```text
docs/analytics/07_METRIKA_TO_ANALYTICS.md
docs/analytics/00_MASTER_PLAN.md
docs/analytics/01_CURRENT_STATE.md
```

Создать:

```text
docs/analytics/METRIKA_QUERY_CATALOG.md
```

После выполнения executor ставит:

```text
07 = REVIEW
```

не `DONE`.

---

# 34. EXECUTOR_REPORT

## 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

## 2. GIT

```text
repo:
branch:
commit:
push:
master touched:
production touched:
```

## 3. DATA MODEL

```text
model | grain | unique key | purpose
```

## 4. QUERY CATALOG

Для каждого dataset:

```text
dataset:
dimensions:
metrics:
destination:
live API verified:
```

## 5. CANONICAL GOALS

Показать реальные goal IDs:

```text
lead:
photo lead:
canvas lead:
tshirt lead:
form error:
CRM order created:
CRM paid:
CRM cancelled:
legacy /thanks:
```

## 6. TIMEZONE / CUTOVERS

```text
counter timezone:
FALSE_BROWSER_PURCHASE_STOPPED_AT:
LEAD_GOAL_SEMANTICS_CHANGED_AT:
```

## 7. SYNC ENGINE

```text
service:
scheduler:
feature flag:
lock:
retry:
replacement strategy:
```

## 8. INITIAL SYNC

```text
7-day smoke range:
90-day range:
datasets:
requests:
rows:
sampled:
sampleShare:
duration:
```

## 9. DATA QUALITY

```text
earliest date:
latest date:
zero-traffic days:
unknown sources:
unknown UTM:
errors:
```

## 10. RECONCILIATION

```text
metric | local | direct API | difference
```

Минимум visits/users/pageviews/lead/order-created/paid.

## 11. CRM COVERAGE

```text
CRM accepted:
Metrika order-created:
CRM paid:
Metrika paid:
known gap reasons:
```

## 12. TESTS

```text
Command | Result
```

## 13. PRODUCTION

```text
migrations:
scheduler enabled:
first scheduled run:
latest successful sync:
```

## 14. FILES_CHANGED

```text
file | change
```

## 15. NEW FACTS

Все новые факты для stages 08–09.

## 16. DEVIATIONS

```text
none
```

или перечислить.

## 17. OPEN ISSUES

```text
none
```

или перечислить реальные блокеры.

---

# 35. Decision Gate

Этап 07 принимается, если:

- Reports API используется через существующий client;
- local aggregate schema создана;
- sync runs сохраняют status/sampling metadata;
- canonical goals зафиксированы по IDs;
- traffic/source/UTM/landing/device/page/goals datasets работают;
- query catalog live-verified;
- sync idempotent;
- stale rows корректно заменяются;
- Europe/Moscow day boundaries соблюдены;
- initial 90-day sync выполнен;
- local vs direct API reconciliation совпадает;
- scheduler имеет distributed lock;
- API failure не уничтожает existing local data;
- scheduler controlled-enabled в production;
- cutover metadata сохранена;
- historical semantic limitations задокументированы.

После review:

```text
07_METRIKA_TO_ANALYTICS = DONE
```

Следующий этап:

```text
08_ANALYTICS_METRICS.md
```

---

# 36. Команда исполнителю

Выполни `07_METRIKA_TO_ANALYTICS.md`.

Порядок:

```text
1. models + migrations
2. query catalog
3. sync engine на существующем YandexMetrikaClient
4. scheduler OFF
5. live read-only verification всех queries
6. controlled 7-day sync
7. local vs direct reconciliation
8. initial 90-day sync
9. data quality report
10. scheduler ON
11. observe 1–2 cycles
12. EXECUTOR_REPORT
```

Не меняй stage 06 pipeline и не строй dashboard.

---

# 37. EXECUTOR_REPORT — 12.09.2026

## 1. RESULT

```text
PARTIAL — слой данных реализован, все запросы каталога проверены живым
read-only API, контрольная 7-дневная синхронизация, сверка с прямым API
(расхождений 0), 90-дневная загрузка и отчёт о качестве выполнены на копии
боевой базы (crm_stage07_test). Production (пункты 31.1–31.8: migrate deploy,
ручные синхронизации в боевой базе, включение расписания, наблюдение) не
трогался: push в master = выкладка CRM, а на неё нужна отдельная команда
владельца (правило «не делай merge в main без отдельной команды»).
```

## 2. GIT

```text
repo:                racpechatca
branch:              feature/analytics-foundation
commit:              см. заголовок коммита этапа 07 (feat(аналитика, этап 07))
push:                feature/analytics-foundation → origin
master touched:      no
production touched:  no (боевая база, контейнеры, compose и .env не менялись;
                     на сервере создана и оставлена копия crm_stage07_test —
                     для production-прогона она не нужна, удалить перед PHASE
                     production по команде)
```

## 3. DATA MODEL

```text
model                | grain                                        | unique key                                         | purpose
---------------------+----------------------------------------------+----------------------------------------------------+------------------------------------------
MetrikaSyncRun       | набор × период × запуск                      | id (batchId связывает наборы одного запуска)       | журнал: статус, строки, запросы, sampled/share/lag/accuracy, ошибка
MetrikaDailyTraffic  | день (Europe/Moscow)                         | date                                               | визиты, посетители (дневные уникальные), просмотры
MetrikaDailyGoal     | день × цель                                  | (date, goalId)                                     | reaches, goalVisits, convertedUsers по всем целям счётчика; имя/идентификатор справочно
MetrikaDailySource   | день × источник × движок (lastsign)          | (date, trafficSource, sourceEngine)                | визиты/посетители/просмотры + lead/order-created/paid reaches
MetrikaDailyUtm      | день × 5 UTM визита (lastsign)               | (date, utmSource, utmMedium, utmCampaign, utmContent, utmTerm) | визиты/посетители + 3 reaches; '' = метки нет
MetrikaDailyLanding  | день × путь страницы входа                   | (date, landingPath) + normalizedPath               | визиты/посетители + 3 reaches
MetrikaDailyDevice   | день × устройство                            | (date, deviceRaw) + deviceCategory desktop/mobile/tablet/other | визиты/посетители + 3 reaches
MetrikaDailyPage     | день × путь страницы (ym:pv)                 | (date, pagePath) + normalizedPath                  | просмотры, посетители (без визитов и целей — ограничение API)
```

Миграция `20260912140000_metrika_analytics_tables` — 8 новых таблиц, 9
индексов, существующие таблицы не трогаются; сгенерирована `prisma migrate
diff` против копии боевой базы, применена на копии, повторный diff по
таблицам Metrika — пусто. DATE = «календарная дата Метрики в поясе счётчика»
(документировано в схеме и каталоге); хранение — полночь UTC, чтение — через
UTC-поля, пояс машины на число не влияет.

## 4. QUERY CATALOG

Код — `crm-new/src/metrika/analytics/metrika-query-catalog.ts` (`DATASET_SPECS`),
документ — `docs/analytics/METRIKA_QUERY_CATALOG.md`. Живая проверка —
`npm run metrika:sync -- verify` 12.09.2026 15:18 MSK, все семь наборов OK,
sampled=false.

```text
dataset:  traffic
dimensions: ym:s:date
metrics:  ym:s:visits, ym:s:users, ym:s:pageviews
destination: MetrikaDailyTraffic
live API verified: yes

dataset:  goals
dimensions: ym:s:date
metrics:  ym:s:visits (якорь) + ym:s:goal<id>reaches/visits/users для всех 21 целей, по 6 целей в запросе (4 запроса)
destination: MetrikaDailyGoal
live API verified: yes

dataset:  sources
dimensions: ym:s:date, ym:s:lastsignTrafficSource, ym:s:lastsignSourceEngine
metrics:  ym:s:visits, ym:s:users, ym:s:pageviews, goal<lead>reaches, goal<crmCreated>reaches, goal<crmPaid>reaches
destination: MetrikaDailySource
live API verified: yes

dataset:  utm
dimensions: ym:s:date, ym:s:lastsignUTMSource/Medium/Campaign/Content/Term
metrics:  ym:s:visits, ym:s:users, 3 goal reaches
destination: MetrikaDailyUtm
live API verified: yes

dataset:  landings
dimensions: ym:s:date, ym:s:startURLPath
metrics:  ym:s:visits, ym:s:users, 3 goal reaches
destination: MetrikaDailyLanding
live API verified: yes

dataset:  devices
dimensions: ym:s:date, ym:s:deviceCategory
metrics:  ym:s:visits, ym:s:users, 3 goal reaches
destination: MetrikaDailyDevice
live API verified: yes

dataset:  pages
dimensions: ym:pv:date, ym:pv:URLPath
metrics:  ym:pv:pageviews, ym:pv:users
destination: MetrikaDailyPage
live API verified: yes (цели и визиты с ym:pv несовместимы — 4011/4002, зафиксировано как ограничение)
```

Общие параметры: lang=ru, sort по дате, limit=100000 без offset (при
переполнении период делится пополам), attribution lastsign явно в именах
измерений, accuracy — по умолчанию с повтором `full` при sampled=true.

## 5. CANONICAL GOALS

Резолвятся из Management API на каждом запуске (`metrika-goal-registry.ts`:
JS-цели по идентификатору события, системные CRM — по типу `cdp_order_*`,
legacy — по URL `/thanks`); номера из манифеста — только для предупреждения
о расхождении. Фактические номера 12.09.2026:

```text
lead:               611379890  (lead_submitted)
photo lead:         612290270  (lead_submitted_photo)
canvas lead:        612290370  (lead_submitted_canvas)
tshirt lead:        612290451  (lead_submitted_tshirt)
form error:         612290566  (form_error)
CRM order created:  596990603  (cdp_order_in_progress — «CRM: Заказ создан»)
CRM paid:           596990604  (cdp_order_paid — «CRM: Заказ оплачен»)
CRM cancelled:      596990606  (cdp_order_cancelled — «CRM: Заказ отменен»)
CRM spam:           596990605  (cdp_order_spam — «CRM: Спам заказ»)
legacy /thanks:     602316919  («Заявка отправлена», url contain /thanks)
расхождений с GOALS_MANIFEST.md: нет; дублей: нет
```

## 6. TIMEZONE / CUTOVERS

```text
counter timezone:                  Europe/Moscow (+03:00) — из Management API (time_zone_name), стадия 06
FALSE_BROWSER_PURCHASE_STOPPED_AT: 2026-09-12 13:19:22 Europe/Moscow
LEAD_GOAL_SEMANTICS_CHANGED_AT:    2026-09-12 13:19:22 Europe/Moscow
где зафиксировано:                 docs/analytics/07_METRIKA_TO_ANALYTICS.md § 2 (immutable metadata),
                                   00_MASTER_PLAN.md (блок 07), 01_CURRENT_STATE.md § 5f;
                                   boundary test 21:00 UTC = 00:00 MSK — metrika-dates.spec.ts
```

## 7. SYNC ENGINE

```text
service:              MetrikaAnalyticsSyncService (src/metrika/analytics/) — блокировка → цели →
                      по набору: MetrikaSyncRun RUNNING → запросы → разбор → замена → SUCCESS/FAILED;
                      наборы независимы, итог запуска SUCCESS | PARTIAL | FAILED | LOCKED | NOT_CONFIGURED
scheduler:            MetrikaAnalyticsSchedulerService — каждый час окно 3 дня; первый тик нового
                      московского дня — окно 21 день (заменяет часовой); первый тик через 90 с после старта;
                      флаг running внутри процесса; onModuleDestroy снимает таймеры
feature flag:         YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED (default false; CLI работает всегда)
lock:                 PgAdvisoryLock — pg_try_advisory_lock(700701) в отдельном pg-соединении на весь
                      запуск; занято → LOCKED без записи. Проверено живьём двумя процессами на копии:
                      второй получил LOCKED, первый SUCCESS
retry:                внутри запроса — существующие повторы клиента (2 × на 429/5xx/сеть/таймаут);
                      на уровне запуска — набор FAILED с текстом ошибки в журнале, остальные наборы идут,
                      следующий тик расписания пересчитывает окно заново
replacement strategy: транзакция Prisma (timeout 120 с): deleteMany(date в периоде) → createMany
                      порциями по 1000 → commit; при ошибке API до транзакции дело не доходит,
                      при ошибке базы транзакция откатывается — прежние строки остаются
stale runs:           RUNNING старше 1 ч закрываются как FAILED на следующем запуске
existing client:      да — YandexMetrikaClient.getStats/getGoals; совместимое расширение: параметр lang
```

## 8. INITIAL SYNC (копия боевой базы crm_stage07_test, 12.09.2026 15:18–15:24 MSK)

```text
7-day smoke range:  2026-09-06..2026-09-12 — SUCCESS, 11 запросов, 12,3 с
                    traffic 7, goals 147 (28 строк API → 21 цель × 7 дней), sources 30, utm 9,
                    landings 40, devices 16, pages 123
90-day range:       2026-06-15..2026-09-12 — SUCCESS, 11 запросов, 14,4 с
                    traffic 31, goals 651, sources 98, utm 37, landings 114, devices 66, pages 429
datasets:           7/7
requests:           11 на полный запуск (1 goals + 1+4+1+1+1+1+1); verify — 10; за весь этап ≈ 60
rows:               1426 строк за 90 дней (31+651+98+37+114+66+429)
sampled:            false во всех запусках
sampleShare:        1
data_lag:           0 с
duration:           12–14 с на полный запуск любой глубины (объём счётчика мал)
earliest synced:    2026-08-13 (первый день с данными; счётчик создан в августе)
latest synced:      2026-09-12
```

Повторная синхронизация 21 дня поверх 90 — строки и суммы не изменились
(idempotency на живых данных); уникальные ключи в базе исключают дубли.

## 9. DATA QUALITY (2026-06-15..2026-09-12, копия)

```text
earliest date:      2026-08-13
latest date:        2026-09-12
zero-traffic days:  59 (2026-06-15..2026-08-12 — до появления счётчика; после 13.08 — 0)
unknown sources:    0 строк / 0 визитов (у всех визитов источник определён)
unknown UTM:        31 строка / 573 из 582 визитов без UTM — Директ размечен yclid, не UTM;
                    единственная UTM-кампания: utm_source=chatgpt.com (9 визитов)
top sources:        ad/Яндекс: Директ 278; organic/yandex 120; direct 95; referral/metrika.yandex.ru 60;
                    referral/direct.yandex.ru 13; referral/chatgpt.com 8; organic/google 6; social/vkontakte 1
top landings:       / 467; /interer/holst 22; /futbolki/svoy-print 18; /catalog/polaroid 8;
                    /futbolki/s-nadpisyu 8; /thanks 8; /formaty 6; /catalog/foto-10x15-bez-polej 5
lead conversions:   2 (lead_submitted; обе 11.09 — цель молодая, см. NEW FACTS)
CRM order-created:  1 (контрольная загрузка этапа 06)
CRM paid:           0
errors:             0 (все 33 запуска SUCCESS)
```

## 10. RECONCILIATION (2026-09-06..2026-09-12, local vs прямой Reports API, sampled=false)

```text
metric                                | local | direct API | difference
--------------------------------------+-------+------------+-----------
visits (сумма по дням)                |   181 |        181 | 0
users (сумма дневных уникальных)      |   146 |        146 | 0
pageviews (ym:s, сумма по дням)       |  1023 |       1023 | 0
lead_submitted reaches                |     2 |          2 | 0
CRM: Заказ создан reaches             |     1 |          1 | 0
CRM: Заказ оплачен reaches            |     0 |          0 | 0
pageviews (ym:pv, набор pages)        |  1142 |       1142 | 0
visits по источникам = трафик         |   181 |        181 | 0
visits по UTM = трафик                |   181 |        181 | 0
visits по страницам входа = трафик    |   181 |        181 | 0
visits по устройствам = трафик        |   181 |        181 | 0
справочно: уникальных за период по API — 128 (другая семантика, не сравнивается с суммой дневных)
```

Exact match по всем строкам. `ym:pv:pageviews` (1142) и `ym:s:pageviews`
(1023) — разные метрики Метрики (хиты vs просмотры внутри визитов), каждая
сходится со своим прямым запросом.

## 11. CRM COVERAGE (по московским суткам; копия боевой базы)

```text
период 2026-06-15..2026-09-12:
CRM accepted:              292  (с ClientID 10; все 292 созданы до включения воркера 12.09 12:20 MSK;
                                контрольный тест — 1; доставлено очередью — 0)
Metrika order-created:     1    (контрольная загрузка 20260909-091 из этапа 06)
CRM paid (clientPaidAt):   204  (с ClientID 1; все до включения воркера)
Metrika paid:              0
период 2026-08-23..2026-09-12 (21 день): accepted 97 (ClientID 8), created 1; paid 47 (ClientID 1), paid 0
known gap reasons:         (1) pre-rollout history — воркер CRM→Метрика включён 12.09 12:20 MSK, все
                           принятые заказы старше; в очереди на бою 0 строк, естественных переходов
                           LEAD→NEW/PAID после включения ещё не было;
                           (2) no ClientID — у 282 из 292 принятых заказов ClientID нет (заявки до
                           этапа 04 / Avito / ручные заказы) — в CDP их не сопоставить в принципе;
                           (3) controlled test — единственное «CRM: Заказ создан» = контрольная загрузка;
                           (4) 21-day matching и delayed attribution — станут наблюдаемы после первых
                           естественных переходов через очередь
```

## 12. TESTS

```text
Command                                                     | Result
------------------------------------------------------------+---------------------------------
npx jest src/metrika/analytics                              | 6 suites, 68 passed
  metrika-dates.spec.ts                                     | границы суток 21:00 UTC = 00:00 MSK, roundtrip DATE, окна
  metrika-goal-registry.spec.ts                             | резолв по событию/типу/URL, missing, drift, дубли
  metrika-query-catalog.spec.ts                             | parser: обычная строка, пустое измерение, число/строка/null,
                                                            |   ошибка даты; ≤20 метрик; чанки целей; нормализация
  metrika-report-fetcher.spec.ts                            | sampling metadata, повтор full, деление периода, ошибка API
  metrika-analytics-sync.service.spec.ts                    | idempotency, replacement (строка исчезла), failure isolation
                                                            |   (5xx/таймаут/падение транзакции → прежние данные читаемы),
                                                            |   lock (два запуска → один), PARTIAL, NOT_CONFIGURED, stale runs
  metrika-analytics-scheduler.service.spec.ts               | planTick 3/21 дней, суточный раз в день, без перекрытий, таймеры
npx jest src/metrika                                        | 13 suites, 193 passed (клиент: параметры sort/lang; рубильники)
npx jest (весь CRM)                                         | 77 suites, 830 passed
npx tsc --noEmit -p tsconfig.build.json                     | 0 ошибок
npm run build                                               | OK (dist/src/analytics/metrika-sync.js, dist/src/metrika/analytics/*)
npx prisma validate / migrate deploy (копия) / diff         | valid / applied / по таблицам Metrika расхождений нет
boot dist/src/main.js против копии                          | «расписание выключено — только ручной запуск»; с флагом true без
                                                            |   токена — «клиент не настроен — расписание не запущено»
metrika:sync verify (live, read-only)                       | 7/7 OK, 10 запросов, sampled=false
metrika:sync 7 дней / reconcile / 90 дней / quality         | SUCCESS / 0 расхождений / SUCCESS / см. § 9
lock live (2 процесса)                                      | второй LOCKED, первый SUCCESS
```

## 13. PRODUCTION

```text
migrations:            не применялись к боевой базе (миграция готова, проверена на копии)
scheduler enabled:     no (флаг в compose/.env.example добавлен со значением false; на сервере не задан)
first scheduled run:   —
latest successful sync: — (в production таблиц ещё нет)
план включения (§ 31 ТЗ), по команде владельца:
  1. backup server compose → точечно добавить YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false в environment
     backend (compose на сервере не синхронизируется из git); в .env флаг не ставить
  2. merge feature/analytics-foundation → master, push → CI → auto-update; migrate deploy применит
     20260912140000_metrika_analytics_tables на старте контейнера
  3. в контейнере: npm run metrika:sync -- verify (read-only)
  4. npm run metrika:sync -- --from <сегодня−6> --to <сегодня>  (7 дней)
  5. npm run metrika:sync -- reconcile --from … --to …  (ожидается 0 расхождений)
  6. npm run metrika:sync -- --from <сегодня−89> --to <сегодня>  (90 дней)
  7. npm run metrika:sync -- quality --from … --to … ; coverage --from … --to …
  8. YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true в /opt/raspechatka/.env → пересоздать backend →
     nginx reload → дождаться первого тика (через 90 с — суточный 21 день) и следующего часового;
     metrika:sync status покажет scheduler:daily / scheduler:hourly
  9. удалить crm_stage07_test
```

## 14. FILES_CHANGED

```text
file                                                                        | change
----------------------------------------------------------------------------+--------------------------------------------------
crm-new/prisma/schema.prisma                                                | +8 моделей MetrikaSyncRun / MetrikaDaily*
crm-new/prisma/migrations/20260912140000_metrika_analytics_tables/           | новая миграция: 8 таблиц, 9 индексов
crm-new/src/metrika/analytics/metrika-dates.ts (+spec)                       | календарные даты Europe/Moscow, окна, DATE ↔ строка
crm-new/src/metrika/analytics/metrika-goal-registry.ts (+spec)               | реестр канонических целей, резолв по API
crm-new/src/metrika/analytics/metrika-query-catalog.ts (+spec)               | типизированный каталог: запросы + разбор 7 наборов
crm-new/src/metrika/analytics/metrika-report-fetcher.ts (+spec)              | получение отчёта: limit, деление периода, accuracy-политика, счётчик запросов
crm-new/src/metrika/analytics/metrika-sync-lock.ts                           | PgAdvisoryLock (pg) + InMemoryLock
crm-new/src/metrika/analytics/metrika-sync-store.ts                          | интерфейс хранилища + Prisma-реализация (журнал, замена в транзакции, stale runs)
crm-new/src/metrika/analytics/metrika-analytics-sync.service.ts (+spec)      | сервис синхронизации
crm-new/src/metrika/analytics/metrika-analytics-scheduler.service.ts (+spec) | расписание hourly/daily, флаг
crm-new/src/metrika/analytics/metrika-analytics-inspect.ts                   | status / quality / reconcile / coverage (только чтение)
crm-new/src/metrika/analytics/metrika-analytics.module.ts                    | модуль, подключён в AppModule
crm-new/src/analytics/metrika-sync.ts                                        | CLI metrika:sync (sync|status|verify|reconcile|quality|coverage)
crm-new/src/metrika/metrika.types.ts, metrika-api.client.ts (+spec)          | параметр lang у getStats (совместимое расширение)
crm-new/src/metrika/metrika.config.ts (+spec)                                | metrikaAnalyticsSyncEnabledFromEnv, общий flagOn
crm-new/src/app.module.ts                                                    | MetrikaAnalyticsModule
crm-new/package.json                                                         | scripts metrika:sync, metrika:sync:status
docker-compose.prod.yml, .env.example                                        | YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED (false)
docs/analytics/METRIKA_QUERY_CATALOG.md                                      | новый: каталог запросов, политика точности, ограничения API
docs/analytics/07_METRIKA_TO_ANALYTICS.md                                    | документ этапа + этот отчёт; статус REVIEW
docs/analytics/00_MASTER_PLAN.md, 01_CURRENT_STATE.md                        | блок 07 → REVIEW, 06_PRODUCTION_ROLLOUT = DONE, § 5f
```

## 15. NEW FACTS

1. **Reports API отдаёт только ненулевые строки**: дней без визитов и целей
   без достижений в ответе нет. Без якорной метрики таблица целей была бы
   дырявой; с якорем `ym:s:visits` она плотная.
2. **Лимиты**: 20 метрик (4015), `ym:pv` и `ym:s:goal` несовместимы (4011),
   `ym:pv:visits` нет (4002), `limit=100000` принимается. `accuracy=full`
   на этом счётчике в ~10 раз медленнее (3 с) и ничего не меняет — данных
   мало, выборки нет.
3. **Счётчик собирает данные с 13.08.2026** — в 90-дневном окне 59 пустых
   дней. Исторические периоды до августа по Метрике не восстановить.
4. **JS-цели молодые**: у `lead_submitted` 2 достижения за всю историю (оба
   11.09), у остальных 0 до 12.09. Для «заявок за август/сентябрь» источник
   правды — CRM (97 принятых заказов за 21 день), не Метрика. Для этапов 08–09:
   KPI по целям Метрики честно считать только с 2026-09-12 13:19:22 MSK.
5. **UTM на счётчике почти нет** (573 из 582 визитов без UTM): Директ
   размечает yclid. Сравнение «UTM визита vs UTM заказа» будет бедным;
   атрибуция рекламы пойдёт через источник `ad / Яндекс: Директ` и yclid.
6. **Страницы входа с полным URL непригодны как агрегат**: 84 % строк несут
   параметры Директа, уникальные на клик, — взят `startURLPath`.
7. **Две метрики просмотров**: `ym:pv:pageviews` (1142/нед) ≠ `ym:s:pageviews`
   (1023/нед). В таблицах обе; в KPI выбирать одну и называть её.
8. **Дневные уникальные ≠ уникальные за период** (146 vs 128 за неделю):
   `users` в дневных таблицах складывать нельзя; для периодных уникальных
   нужен отдельный запрос (этап 08 решает, нужен ли).
9. **`lang=ru` не меняет коды**: ключи `id` (ad, organic, mobile, …)
   стабильны, названия локализованы — в панели можно показывать как есть.
10. **Наблюдение за боем (read-only, 15:30 MSK)**: после cutover 13:19
    естественных заявок с сайта не было; заявка 20260912-109 (12:59 MSK,
    utm_source=chatgpt.com, до cutover — старый JS, без ClientID) ещё LEAD;
    заказ 20260912-110 (Avito, 14:02) создан оператором сразу в NEW — без
    перехода статуса, без ClientID, строки очереди нет (по дизайну этапа 06
    такой заказ в Метрику не попал бы и с очередью: нет ClientID). Очередь
    на бою пуста, воркер healthy.

## 16. DEVIATIONS

1. § 31/§ 36 (пункты 6–11 в production) — не выполнены: требуют push в
   master; вместо этого весь production enable sequence прогнан на копии
   боевой базы с реальным токеном из secure env сервера (read-only к API).
   Токен в код, логи, отчёты и чат не попадал.
2. § 8 `conversionRate` — не хранится: выводится из `goalVisits` и
   дневных `visits` (та же формула, что у Метрики); хранить процент за день
   значило бы округлять дважды.
3. § 12 landing raw dimension — «сырое» значение это `ym:s:startURLPath`,
   а не полный URL (обоснование — NEW FACTS 6, раздел 28 ТЗ про агрегаты).
4. § 14 `path → product` — не выведен (неоднозначно; отложено на 08).
5. § 6 статус PARTIAL на строке `MetrikaSyncRun` не используется: строка —
   один набор, он либо записан целиком, либо нет; PARTIAL — итог запуска
   (batch) в ответе сервиса/CLI и в логе.

## 17. OPEN ISSUES

```text
1. Production enable sequence (§ 13 выше) ждёт отдельной команды владельца — это
   единственный блокер для закрытия этапа.
2. Естественные события PHASE K/L этапа 06 (LEAD→NEW, PAID через очередь) всё ещё
   not observed yet — не блокер этапа 07, но CRM coverage останется «1/0» до них.
3. Security debt без изменений: ROTATE_YANDEX_OAUTH_TOKEN, ROTATE_YANDEX_CLIENT_SECRET.
```

---

# 38. EXECUTOR_REPORT_PRODUCTION_ROLLOUT — 12.09.2026

Команда владельца от 12.09.2026 (10 пунктов); отдельного документа
`07_PRODUCTION_ROLLOUT.md` в наличии не было — порядок взят из команды.

## 1. RESULT

```text
READY_FOR_REVIEW — production rollout этапа 07 выполнен целиком: master = b57c067
выложен, миграция применена, все проверки в боевом контейнере чистые (verify 7/7,
7 дней → сверка 0 расхождений, 90 дней, качество, покрытие), расписание включено
17:11 MSK, первый автоматический запуск (суточный, 21 день) и следующий часовой
цикл — SUCCESS, блокировка и отсутствие дублей подтверждены, тестовая копия удалена.
```

## 2. TIMELINE (Europe/Moscow)

```text
16:56:36  backup server compose → docker-compose.prod.yml.bak-20260912_165636; вставлена одна строка
          YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: ${…:-false}; diff с backup = ровно 1 строка;
          docker compose config OK (в рендере флаг "false"); server-only отличия сохранены
16:56:43  merge feature/analytics-foundation → master (fast-forward d72ffff → b57c067, 5 коммитов)
16:56:46  push master
16:56:52  CI «Сборка образов» started → 16:59:57 completed success
17:00:05  auto-update: frontend обновлён и здоров, nginx перечитан
17:07:47  auto-update: backend пересоздан (образ de021522… → eb9fb783…), 17:08:08 «обновлён и здоров»,
          17:08:10 nginx перечитан; /health ok; панель через nginx 200
17:07:54  migrate deploy на старте контейнера: «76 migrations found», применена
          20260912140000_metrika_analytics_tables, «All migrations have been successfully applied»
17:09:19  verify 7/7 (read-only) из контейнера
17:09:24  ручная синхронизация 7 дней — SUCCESS
17:09:30  reconcile — 0 расхождений
17:10:09  ручная синхронизация 90 дней — SUCCESS; quality; coverage
17:11:29  .env: YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true (backup .env.bak-metrika-analytics-20260912_171129,
          остальные ключи не тронуты); backend пересоздан 17:11:42 → healthy 17:12:03; nginx reload 17:12:03
17:11:54  лог: «синхронизация отчётов по расписанию запущена (каждый час — 3 дня, раз в сутки — 21 день)»
17:13:24  первый автоматический запуск scheduler:daily 2026-08-23..2026-09-12 → 17:13:28 SUCCESS
17:13:3x  проверка блокировки: два CLI-запуска одновременно — второй LOCKED, первый SUCCESS
18:11:54  второй цикл: scheduler:hourly 2026-09-10..2026-09-12 → 18:11:57 SUCCESS (ровно через 60 мин после
          старта расписания), 11 запросов, 162 строки
18:19:27  проверка цикла: overlap 0, RUNNING/FAILED нет, дублей 0; reconcile показал −1 визит / −1 посетитель /
          −2 просмотра за сегодня — данные «живого» дня уехали за 7 минут между тиком и сверкой
18:21:08  контроль: ручная синхронизация окна 3 дня и сверка сразу за ней — 0 расхождений (185/149/1042/1163)
18:19:4x  crm_stage07_test удалена; на сервере только crm
```

## 3. DEPLOY / MIGRATIONS

```text
master:               b57c067 (fast-forward; master touched: yes — по команде)
CI:                   success 16:59:57 MSK (3 мин)
backend:              running:healthy, образ eb9fb783…, started 17:07:47 → пересоздан 17:11:42 (флаг)
frontend (nginx):     running:healthy, перечитан 17:00:06, 17:08:10, 17:12:03
migrate deploy:       20260912140000_metrika_analytics_tables — finished 17:07:54 MSK; при втором
                      старте «No pending migrations to apply»
migrate status:       «Database schema is up to date!», 76 миграций
analytics tables:     MetrikaSyncRun, MetrikaDailyTraffic, MetrikaDailyGoal, MetrikaDailySource,
                      MetrikaDailyUtm, MetrikaDailyLanding, MetrikaDailyDevice, MetrikaDailyPage — 8/8;
                      индексов по ним 17 (8 pkey + 9)
scheduler at deploy:  OFF (лог «выключена — только ручной запуск»); env analytics_sync=false
```

## 4. PRODUCTION VERIFY / 7-DAY SYNC / RECONCILIATION (17:09 MSK, scheduler OFF)

```text
verify:     7/7 OK, 10 запросов, sampled=false; реестр целей: lead 611379890, photo 612290270,
            canvas 612290370, tshirt 612290451, form_error 612290566, crm_created 596990603,
            crm_paid 596990604, crm_cancelled 596990606, crm_spam 596990605, thanks 602316919
7-day sync: 2026-09-06..2026-09-12 — SUCCESS, 11 запросов, 5,4 с;
            traffic 7, goals 147, sources 31, utm 9, landings 40, devices 16, pages 124; sampled=false

metric                              | local | direct API | difference
visits (сумма по дням)              |   184 |        184 | 0
users (сумма дневных уникальных)    |   147 |        147 | 0
pageviews (ym:s)                    |  1039 |       1039 | 0
lead_submitted reaches              |     2 |          2 | 0
CRM: Заказ создан reaches           |     1 |          1 | 0
CRM: Заказ оплачен reaches          |     0 |          0 | 0
pageviews (ym:pv, pages)            |  1158 |       1158 | 0
visits по sources/utm/landings/devices = трафик: 184 = 184 (все четыре)
sampled=false, расхождений 0
```

## 5. 90-DAY SYNC / QUALITY / COVERAGE (17:10 MSK)

```text
90-day: 2026-06-15..2026-09-12 — SUCCESS, 11 запросов, 15,4 с; traffic 31, goals 651, sources 99,
        utm 37, landings 114, devices 66, pages 430 (1428 строк); sampled=false
quality: даты с трафиком 2026-08-13..2026-09-12; дней без трафика 59 (до счётчика); источник не
        определён 0; без UTM 576 из 585 визитов; топ источников ad/Директ 279, organic/yandex 120,
        direct 96, referral/metrika 60; топ входов / 470, /interer/holst 22, /futbolki/svoy-print 18;
        lead_submitted 2, CRM создан 1, CRM оплачен 0; ошибок API 0
coverage 90 дней: CRM accepted 293 (ClientID у 10; до включения воркера 292; контрольный тест 1;
        доставлено очередью 0) vs Metrika created 1; CRM paid 204 (ClientID у 1) vs Metrika paid 0
coverage 21 день: accepted 98 (ClientID 8) vs 1; paid 47 vs 0
gap: pre-rollout history + no ClientID + controlled test; единственный принятый заказ после
        включения воркера — 20260912-110 (Avito, создан оператором сразу NEW, без ClientID, без
        перехода статуса → строки очереди нет и не должно быть)
дубли по уникальным ключам: 0
```

## 6. SCHEDULER (включён 17:11:29 MSK)

```text
flag:                 YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true в /opt/raspechatka/.env; compose
                      подставляет ${…:-false}; в контейнере analytics_sync=true, orders_sync=true
first automatic run:  scheduler:daily 2026-08-23..2026-09-12, 17:13:24–17:13:28 MSK, SUCCESS,
                      7 наборов, 11 запросов, 1043 строки, sampled=false (batch 332e7839…)
lock:                 во время CLI-запуска A второй CLI-запуск B → LOCKED («другая синхронизация
                      уже идёт», 0 запросов, ничего не записано); A — SUCCESS
overlap:              0 пар запусков разных batch с пересекающимися интервалами
duplicates:           0 по всем семи уникальным ключам
second cycle:         scheduler:hourly 2026-09-10..2026-09-12, 18:11:54–18:11:57 MSK, SUCCESS, 7 наборов,
                      11 запросов, 162 строки, sampled=false (batch bf87a010…) — ровно через 60 мин
reconcile после тика: в 18:19 −1/−1/−2 по сегодняшнему дню (визит пришёл между тиком и сверкой); внутренние
                      суммы sources/utm/landings/devices = traffic сходятся точно; цели 2/1/0 совпадают;
                      ручная синхронизация в 18:21 и сверка сразу за ней — 0 расхождений
totals после повторов: трафик 06–12.09 = 183 / 147 / 1038 — на один визит меньше, чем в 17:09
                      (184 / 1039): Метрика пересчитала сегодняшний день, окно 3 дня подхватило —
                      ровно для этого и нужен скользящий пересчёт; сверка в момент проверки — 0
```

## 7. STAGE 06 UNTOUCHED

```text
MetrikaOrderOutbox:   0 строк до и после; код очереди/воркера/simple_orders/status mapping не менялся
orders worker:        «воркер отправки заказов запущен» после каждого рестарта (17:08:00, 17:11:54)
web analytics:        сайт не трогался (frontend-образ CRM пересобран CI как всегда — панель, не сайт)
dashboard / KPI:      не строились, не менялись
```

## 8. TEMP DB

```text
crm_stage07_test: удалена 12.09.2026 18:19 MSK после успешного второго цикла (DROP DATABASE); pg_database: только crm
```

## 9. SECURITY

```text
токен: в код, логи, отчёты, чат не попадал (CLI печатает только даты, числа, коды, пути);
.env читался только по именам ключей; резервные копии compose/.env лежат рядом с оригиналами
security debt без изменений: ROTATE_YANDEX_OAUTH_TOKEN, ROTATE_YANDEX_CLIENT_SECRET
```

## 10. OPEN ISSUES

```text
none — блокеров нет. Не блокирует: естественные события PHASE K/L этапа 06 всё ещё not observed yet
(после cutover 13:19 заявок с сайта не было); наблюдение за расписанием — по логу и metrika:sync status.
```
