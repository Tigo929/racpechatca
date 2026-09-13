# 08_PRODUCTION_ROLLOUT.md

# Этап 08 — Production rollout canonical analytics metrics

## Статус

```text
REVIEW — rollout выполнен 12.09.2026 22:02–23:00 MSK, второй и последующие автоматические циклы
наблюдались до 13:00 MSK 13.09 (14 запусков SUCCESS). DONE ставит Reviewer.
```

Отчёт исполнителя — раздел 26.

> `08_ANALYTICS_METRICS_FIX_01` принят.
> Stage 08 по коду готов к production rollout.
> `DONE` ставит Reviewer только после controlled production verification.

---

# 1. Что уже принято

Подтверждено на feature branch и копии production DB:

```text
AnalyticsMetricsService implemented
METRICS_DICTIONARY ready
period unique users solved without SUM(daily users)
site funnel / CRM funnel / P&L separated
traffic reconciliation = 0
CRM reconciliation = 0
P&L reconciliation = 0
cancellation FIX accepted
full CRM tests = green
production not touched
```

Cancellation semantics после FIX:

```text
firstCancelledAt
lastCancelledAt
currentlyCancelled
wasEverCancelled
cancellationTimes[]
```

Canonical:

```text
cancelledOrders
= orders whose firstCancelledAt is inside period

crmCancellationRate
= accepted cohort that wasEverCancelled / accepted cohort
```

---

# 2. Важное отличие от rollout Stage 07

На production scheduler Stage 07 УЖЕ включён:

```text
YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true
```

Stage 08 меняет scheduler behavior:

```text
после Metrika sync
→ обновляются MetrikaPeriodSnapshot presets
```

Поэтому НЕЛЬЗЯ выкатывать Stage 08 при активном scheduler и сразу позволить первому tick менять новую таблицу до controlled verification.

Правильный порядок:

```text
temporarily scheduler OFF
→ deploy Stage 08
→ migrate
→ manual verification/snapshots
→ metrics reconciliation
→ scheduler ON
→ observe automatic tick
```

Stage 06 orders worker:

```text
YANDEX_METRIKA_ORDERS_SYNC_ENABLED=true
```

НЕ выключать.

---

# 3. Pre-deploy

Перед production:

```text
feature/analytics-foundation clean
feature branch 0 behind master
tests green
build green
prisma validate green
```

Если master ушёл вперёд:

```text
merge master → feature
повторить проверки
```

---

# 4. Temporarily disable analytics scheduler BEFORE push

Сделать backup:

```text
/opt/raspechatka/.env
```

Например:

```text
.env.bak-stage08-<timestamp>
```

Изменить только:

```text
YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false
```

Не менять:

```text
YANDEX_METRIKA_ORDERS_SYNC_ENABLED=true
YANDEX_METRIKA_COUNTER_ID
YANDEX_METRIKA_OAUTH_TOKEN
```

Штатно recreate/restart backend, если env читается на boot.

Проверить:

```text
backend healthy
analytics scheduler disabled
orders worker started
Stage 06 queue intact
```

Это временный maintenance gate.

---

# 5. Merge / deploy

После отдельного разрешения владельца:

```text
feature/analytics-foundation
→ master
```

Затем:

```text
push master
```

Дождаться:

```text
CI success
backend recreated
backend healthy
nginx healthy
```

Зафиксировать:

```text
merge commit
push time
image
deploy time
```

---

# 6. Migration

На старте production должен примениться:

```text
20260912160000_metrika_period_snapshot
```

или фактическое имя миграции из branch.

Проверить:

```text
prisma migrate deploy
prisma migrate status
```

Ожидается:

```text
Database schema is up to date
```

Проверить таблицу:

```text
MetrikaPeriodSnapshot
```

и unique/indexes.

---

# 7. Scheduler после deploy всё ещё OFF

Это обязательная проверка.

Лог:

```text
analytics scheduler disabled
```

Stage 06 order worker:

```text
enabled / started
```

---

# 8. Manual period snapshots

Из production container вручную выполнить snapshot sync.

Минимальные presets:

```text
today
yesterday
last_7_days
previous_7_days
last_30_days
previous_30_days
current_month
previous_month
```

Ожидается:

```text
8 snapshots
```

или documented number, если часть preset range недоступна.

Для каждого сохранить:

```text
periodStart
periodEnd
users
visits
pageviews
sampled
sampleShare
fetchedAt
```

---

# 9. Period unique proof in production

Проверить минимум:

```text
last_7_days
last_30_days
```

Сравнить:

```text
MetrikaPeriodSnapshot.users
vs
direct Reports API users for whole period
```

Ожидается:

```text
diff = 0
```

Дополнительно вывести:

```text
SUM(MetrikaDailyTraffic.users)
```

и доказать, что metrics service НЕ использует эту сумму как periodUsers.

---

# 10. AnalyticsMetricsService production verification

Выполнить diagnostic/CLI для:

```text
today
last_7_days
last_30_days
previous_30_days
```

Не строить UI.

Проверить minimum overview contract:

```text
traffic
site funnel
CRM funnel
orders
financials
dataQuality
comparison
metadata
```

---

# 11. Traffic reconciliation

Для `last_7_days`:

```text
metric | AnalyticsMetricsService | Stage07 local tables | diff
```

Минимум:

```text
visits
pageviews headline (ym:s)
pageviewsPage (ym:pv)
siteLeads
matchedAccepted
matchedPaid
```

Ожидается:

```text
diff = 0
```

---

# 12. CRM reconciliation

Для:

```text
last_30_days
и
01.06.2026–today
```

Сравнить service с независимым SQL sanity.

Минимум:

```text
crmLeads
acceptedOrders
paidOrders
cancelledOrders
cancellationEvents
currentlyCancelledOrders
paidWithoutDate
paidOrderValue
```

Ожидается:

```text
diff = 0
```

Cancellation transitions в текущей production истории ожидаемо могут оставаться:

```text
0
```

Это не отменяет необходимость lifecycle FIX.

---

# 13. P&L reconciliation

Минимум за два завершённых периода:

```text
July 2026
August 2026
```

Сравнить:

```text
AnalyticsMetricsService
vs
existing ReportsService/P&L
```

Минимум:

```text
orders
realizedRevenue
COGS
netProfit
```

Ожидается:

```text
diff = 0
```

Нельзя продолжать rollout при unexplained financial diff.

---

# 14. Data-quality checks

Проверить:

```text
periodUsers source = snapshot
lastMetrikaSyncAt
metrikaDataAgeSeconds
freshness
lead legacy/cutover note
ClientID coverage accepted
ClientID coverage paid
matched coverage eligibility
COGS reliability
paidWithoutDate
```

Known facts могут измениться из-за новых заказов — не требовать старые exact counts.

---

# 15. current cancellation naming check

В текущем Stage 08 service:

```text
currentlyCancelledOrders
```

если он scoped by selected period, в documentation/contract должно быть однозначно указано, что это:

```text
currently-cancelled among orders selected by the period/lifecycle scope
```

а НЕ глобальное количество всех заказов со status=CANCELLED на текущий момент.

Если UI Stage 09 понадобится global current-state count:

```text
создать отдельную clearly named metric
```

Не блокирует rollout, если dictionary уже описывает фактический scope.

---

# 16. Performance

В production либо production-equivalent DB замерить:

```text
getOverview(last_30_days)
```

Зафиксировать:

```text
SQL query count
duration
orders scanned
N+1 yes/no
```

Главный acceptance criterion:

```text
query count does not scale with number of orders
```

SSH/network latency не использовать как backend SLA.

---

# 17. Re-enable scheduler

Только после успешных manual checks:

```text
YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true
```

Штатно recreate backend.

Проверить:

```text
backend healthy
analytics scheduler started
orders worker started
```

---

# 18. First automatic Stage 08 tick

Дождаться automatic scheduler run.

Проверить:

```text
Metrika sync SUCCESS
8 period snapshots refreshed after sync
no overlap
no duplicates
backend healthy
```

Snapshot timestamps должны обновиться после automatic tick.

---

# 19. Second cycle

Желательно наблюдать следующий hourly cycle.

Проверить:

```text
SUCCESS
snapshot refresh SUCCESS
no duplicates
no failed/running zombie runs
no rate-limit storm
```

Если полный час ждать операционно неудобно:

- первый automatic cycle обязателен;
- второй можно подтвердить controlled manual equivalent + существующими scheduler tests,
  но отчёт должен честно разделять automatic vs manual.

---

# 20. Stage 06 regression

После каждого backend restart проверить:

```text
orders worker started
MetrikaOrderOutbox counts sane
no unexpected failed rows
```

Не менять:

```text
simple_orders
status mapping
orders outbox code
```

---

# 21. Production snapshots durability

После повторного snapshot refresh:

```text
unique(periodStart, periodEnd, scope)
```

не должен создавать duplicates.

Повторный update должен:

```text
replace/upsert same snapshot
```

а не увеличивать количество строк бесконечно.

---

# 22. No dashboard

На rollout Stage 08:

```text
dashboard UI = forbidden
```

Разрешены:

```text
CLI
diagnostic output
SQL/read-only checks
```

---

# 23. Docs / Git

После успешного production rollout:

```text
08_ANALYTICS_METRICS.md → REVIEW
08_ANALYTICS_METRICS_FIX_01.md → accepted note
00_MASTER_PLAN.md
01_CURRENT_STATE.md
METRICS_DICTIONARY.md
```

Документы не обязательно немедленно push в `master`, если document-only push вызывает production restart.

Допустимо commit/push:

```text
feature/analytics-foundation
```

с явной фиксацией, что production code уже находится в master.

---

# 24. EXECUTOR_REPORT_PRODUCTION_ROLLOUT

## 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

## 2. GIT / DEPLOY

```text
merge commit:
push time:
CI:
backend image:
deploy time:
health:
```

## 3. MAINTENANCE GATE

```text
analytics scheduler disabled before push:
orders worker remained enabled:
.env backup:
```

## 4. MIGRATION

```text
migration:
migrate status:
MetrikaPeriodSnapshot:
indexes:
```

## 5. SNAPSHOTS

```text
presets:
rows:
last_7 periodUsers:
last_7 direct users:
diff:
last_30 periodUsers:
last_30 direct users:
diff:
sumDailyUsers shown separately:
```

## 6. METRICS SERVICE

```text
today:
last_7_days:
last_30_days:
previous_30_days:
metadata:
```

## 7. TRAFFIC RECONCILIATION

```text
metric | service | stage07 local | diff
```

## 8. CRM RECONCILIATION

```text
metric | service | sanity SQL | diff
```

## 9. P&L RECONCILIATION

```text
period | metric | service | reports | diff
```

## 10. DATA QUALITY

```text
freshness:
lead semantics:
ClientID coverage:
match coverage:
COGS reliability:
paidWithoutDate:
```

## 11. PERFORMANCE

```text
period:
query count:
duration:
orders:
N+1:
```

## 12. SCHEDULER

```text
re-enabled:
first automatic run:
snapshots refreshed:
second cycle:
overlap:
duplicates:
```

## 13. STAGE 06

```text
orders worker:
outbox:
regression:
```

## 14. SECURITY

```text
token committed/logged:
existing OAuth rotation debt:
existing Client Secret rotation debt:
```

## 15. NEW FACTS

Все факты для Stage 09.

## 16. DEVIATIONS

Если нет:

```text
none
```

## 17. OPEN ISSUES

Если нет:

```text
none
```

---

# 25. Decision Gate

Stage 08 становится `DONE`, если:

- snapshot migration применена;
- scheduler был временно OFF во время controlled deploy;
- period snapshots созданы;
- periodUsers совпадает с direct whole-period Reports API;
- SUM(daily users) не используется как period unique;
- traffic reconciliation = 0;
- CRM reconciliation = 0;
- P&L reconciliation = 0;
- cancellation FIX присутствует в deployed code;
- scheduler re-enabled только после manual checks;
- automatic run обновляет snapshots;
- duplicate snapshots отсутствуют;
- Stage 06 orders worker не сломан;
- production healthy.

После этого:

```text
09_DASHBOARD_V1.md
```

---

# 26. EXECUTOR_REPORT_PRODUCTION_ROLLOUT — 12.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW — production rollout этапа 08 выполнен целиком по документу: расписание временно
выключено до push, master = e7e936d выложен, миграция снимков применена, 8 снимков созданы вручную,
periodUsers = прямой запрос API (diff 0), сверки трафика/CRM/P&L из боевого контейнера — 0,
расписание включено обратно только после проверок, первый автоматический тик обновил таблицы и
8 снимков, второй (часовой) цикл — SUCCESS (23:58 MSK), дальше расписание отработало всю ночь — 14 автоматических запусков подряд без ошибок. Этап 06 не сломан.
```

## 2. GIT / DEPLOY

```text
merge commit:   e7e936d — fast-forward feature/analytics-foundation → master (b57c067 → e7e936d, 5 коммитов:
                c7fd4fc feat этап 08, 01c8914/1b63671/3d6c053 docs, e7e936d FIX_01)
push time:      12.09.2026 22:03:04 MSK
CI:             «Сборка образов» started 22:03:09 → completed success 22:06:26 MSK
backend image:  eb9fb783… → b03d34f3…
deploy time:    auto-update пересоздал backend 22:12:40, healthy 22:13:02 MSK; nginx перечитан auto-update
health:         /health {"status":"ok","database":"ok"}; панель через nginx 200; frontend healthy
```

## 3. MAINTENANCE GATE

```text
analytics scheduler disabled before push: yes — 22:02:09 MSK YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false,
                                           backend пересоздан 22:02:09 → healthy 22:02:47, nginx reload; лог
                                           «синхронизация отчётов по расписанию выключена — только ручной запуск»;
                                           в контейнере analytics_sync=false
orders worker remained enabled:            yes — orders_sync=true, лог «воркер отправки заказов запущен» после
                                           каждого из трёх рестартов (22:02, 22:12, 22:58); очередь 0 строк до и после
.env backup:                               .env.bak-stage08-20260912_220209 (перед gate) и
                                           .env.bak-stage08-enable-20260912_225742 (перед включением); менялась ровно
                                           одна строка — проверено diff; counter/token/orders-флаг не тронуты
```

## 4. MIGRATION

```text
migration:             20260912160000_metrika_period_snapshot — applied 22:12:47 MSK на старте контейнера
                       («77 migrations found», «All migrations have been successfully applied»); при следующих
                       стартах «No pending migrations to apply»
migrate status:        «Database schema is up to date!» (из контейнера), 77 миграций
MetrikaPeriodSnapshot: id, periodStart date, periodEnd date, metricScope text, preset text, users, visits,
                       pageviews int, fetchedAt timestamp, sampled bool, sampleShare double, requestCount int
indexes:               MetrikaPeriodSnapshot_pkey (unique), MetrikaPeriodSnapshot_periodStart_periodEnd_metricScope_key
                       (unique), MetrikaPeriodSnapshot_preset_idx
scheduler after deploy: OFF — лог 22:12:54 «выключена — только ручной запуск»; orders worker started (§ 7)
```

## 5. SNAPSHOTS (ручной `metrika:sync snapshots` из контейнера, 22:14:11 MSK)

```text
presets:  today, yesterday, last_7_days, previous_7_days, last_30_days, previous_30_days, current_month,
          previous_month — 8/8 SUCCESS, 8 запросов, sampled=false, sampleShare=1
rows:     8
today             2026-09-12..2026-09-12  users   9  visits  11  pageviews   65
yesterday         2026-09-11..2026-09-11  users   7  visits  13  pageviews  230
last_7_days       2026-09-06..2026-09-12  users 131  visits 185  pageviews 1042
previous_7_days   2026-08-30..2026-09-05  users 151  visits 213  pageviews  803
last_30_days      2026-08-14..2026-09-12  users 323  visits 577  pageviews 3858
previous_30_days  2026-07-15..2026-08-13  users   8  visits   9  pageviews   56
current_month     2026-09-01..2026-09-30  users 264  visits 385  pageviews 1795
previous_month    2026-08-01..2026-08-31  users  69  visits 201  pageviews 2119
last_7 periodUsers:  131      last_7 direct users (GET /stat/v1/data, весь период, без измерений):  131   diff 0
last_30 periodUsers: 323      last_30 direct users:                                                323   diff 0
sumDailyUsers shown separately: да — last_7 = 149, last_30 = 408 (Σ MetrikaDailyTraffic.users); в контракте
          это поле sumDailyUsers, periodUsers берётся только из снимка (тест «100 + 100 → null без снимка»)
```

## 6. METRICS SERVICE (`metrics:report overview`, боевой контейнер, 22:14 MSK)

```text
today (12.09):          visits 11, periodUsers 9 (снимок), pageviews 65 / 69; siteLeads 0; crmLeads 1, accepted 1,
                        paid 0, realized 3; realizedRevenue 6 890 ₽, netProfit 4 514 ₽; freshness FRESH (3745 с)
last_7_days:            visits 185, periodUsers 131 (sumDaily 149), pageviews 1042 / 1163; siteLeads 2, matched 1/0;
                        crmLeads 13, accepted 42, paid 3, realized 37; realizedRevenue 62 462 ₽, netProfit 43 247 ₽
last_30_days:           visits 577, periodUsers 323 (sumDaily 408), pageviews 3858 / 4134; siteLeads 2, matched 1/0;
                        crmLeads 29, accepted 130, paid 87, realized 141; contract 245 428 ₽, paid 171 626 ₽,
                        realizedRevenue 241 100 ₽, cogs 62 020 ₽, netProfit 138 504 ₽ (маржа 57,45 %);
                        acceptedAov 1 887,91 ₽, paidAov 1 972,71 ₽; crmLeadToAccepted 89,66 %, crmAcceptedToPaid 40,77 %
previous_30_days:       (15.07–13.08) visits 9, periodUsers 8 — счётчик до 13.08 не собирал (PERIOD_BEFORE_COUNTER);
                        CRM: accepted 85, paid 61, realized 78; realizedRevenue 232 837 ₽, netProfit 140 401 ₽
metadata:               timezone Europe/Moscow; leadSemantics / pageviewSemantics / usersSemantics / aovSemantics;
                        cutovers: falseBrowserPurchaseStoppedAt = leadGoalSemanticsChangedAt = 2026-09-12 13:19:22,
                        crmToMetrikaLiveSince 2026-09-12 12:20:10, counterDataSince 2026-08-13; lastMetrikaSyncAt;
                        generatedAt. Контракт: period, previousPeriod, traffic, siteFunnel, crmFunnel, orders,
                        financials, dataQuality, comparison, metadata — все группы присутствуют (JSON сохранён)
```

## 7. TRAFFIC RECONCILIATION (last_7_days, боевая база)

```text
metric                 | service | stage07 local | diff
visits                 |     185 |           185 | 0
pageviews (ym:s)       |    1042 |          1042 | 0
pageviewsPage (ym:pv)  |    1163 |          1163 | 0
sumDailyUsers          |     149 |           149 | 0
siteLeads (reaches)    |       2 |             2 | 0
matchedAccepted        |       1 |             1 | 0
matchedPaid            |       0 |             0 | 0
```

## 8. CRM RECONCILIATION (сервис vs независимый SQL по OrderPhoto/StatusHistory)

```text
metric                 | last_30_days service / SQL | 01.06–12.09 service / SQL | diff
crmLeads               |          29 / 29           |         36 / 36           | 0
acceptedOrders         |         130 / 130          |        318 / 318          | 0
paidOrders             |          87 / 87           |        204 / 204          | 0
cancelledOrders        |           0 / 0            |          0 / 0            | 0
cancellationEvents     |           0 / 0            |          0 / 0            | 0
currentlyCancelled     |           0 / 0            |          0 / 0            | 0
paidWithoutDate        |           0 / 0            |         13 / 13           | 0
paidOrderValue         |      171626 / 171626       |     562779 / 562779       | 0
(переходов в CANCELLED в боевой истории нет — ожидаемо; семантика FIX_01 в deployed code, тесты A–E)
```

## 9. P&L RECONCILIATION (сервис vs GET /reports/monthly (месяц) vs /reports/weekly (итого))

```text
period      | metric                 | service | reports (monthly / weekly) | diff
июль 2026   | orders                 |      97 |      97 / 97               | 0
            | realizedRevenue        |  230669 |  230669 / 230669           | 0
            | COGS                   |   48703 |   48703 / 48703            | 0
            | netProfit              |  105800 |  105800 / 105800           | 0
            | (+ goods, grossProfit, salary, opex, deliveryProfit, photo/tshirt/canvas — 0)
август 2026 | orders                 |      79 |      79 / 79               | 0
            | realizedRevenue        |  189405 |  189405 / 189405           | 0
            | COGS                   |   56935 |   56935 / 56935            | 0
            | netProfit              |  115065 |  115065 / 115065           | 0
            | (+ 8 остальных строк — 0)
```

## 10. DATA QUALITY (last_30_days)

```text
freshness:            FRESH — lastMetrikaSyncAt 21:11 MSK (последний часовой тик до gate), age 3754 с ≤ 7200
lead semantics:       INCOMPLETE_LEGACY_SITE_LEADS + CRM_GOALS_BEFORE_ROLLOUT (период начинается до 13.09) — partial;
                      today тоже partial (12.09 — день cutover)
ClientID coverage:    принятые 7,69 % (10/130), оплаченные 1,15 % (1/87)
match coverage:       eligible 0 (после включения воркера принят один заказ, без ClientID) → null;
                      matchedAcceptedReaches 1 (контрольный тест этапа 06)
COGS reliability:     124/130 принятых надёжны → COGS_UNRELIABLE_ORDERS (6 заказов без позиций)
paidWithoutDate:      0 за 30 дней; 13 за 01.06–12.09 (все старше 14.08)
periodUsers source:   snapshot (traffic quality complete при наличии снимка)
```

## 11. PERFORMANCE (боевой контейнер, last_30_days)

```text
period:       2026-08-14..2026-09-12
query count:  getOverview с сравнением — 29 SQL-запросов; шесть срезов — 17
duration:     2282 мс (getOverview), 967 мс (срезы) — внутри контейнера, без сетевой задержки; первый вызов
              включает прогрев Prisma
orders:       325 в базе, 130 принятых в периоде — все загружаются одним findMany с include
N+1:          no — число запросов не зависит от числа заказов (то же 29 на копии и на бою)
```

## 12. SCHEDULER

```text
re-enabled:          22:57:42 MSK — флаг true, backend пересоздан → healthy 22:58:20, nginx reload; лог 22:58:11
                     «синхронизация отчётов по расписанию запущена (каждый час — 3 дня, раз в сутки — 21 день)»
first automatic run: scheduler:daily 2026-08-23..2026-09-12, 22:59:41–22:59:46 MSK, SUCCESS, 7 наборов, 11 запросов,
                     1044 строки; сразу за ним «снимки периодов обновлены — 8/8, запросов 8» (22:59:46–48)
snapshots refreshed: 8/8, fetchedAt 22:59:46–48 (раньше 22:14:13–16), строк по-прежнему 8, дублей по ключу 0 —
                     повторный refresh делает upsert, а не новые строки (§ 21)
second cycle:        scheduler:hourly 2026-09-10..2026-09-12, 23:58:11–23:58:1x MSK 12.09, SUCCESS, 7 наборов, 10 запросов,
                     163 строки; снимки обновлены 8/8 сразу за ним. Дальше (наблюдение до 13:00 MSK 13.09): 00:58 —
                     scheduler:daily (новые московские сутки → окно 21 день, как задумано), 01:58…07:58 — часовые,
                     09:44 — daily после рестарта хоста, 10:43 / 11:43 / 12:43 — часовые. Итого с момента включения
                     14 автоматических запусков (3 daily + 11 hourly), все SUCCESS, после каждого — «снимки периодов
                     обновлены — 8/8, запросов 8»; ошибок 4xx/5xx в логе 0 (rate-limit storm нет: ≈19 запросов/тик)
overlap:             0 пар запусков с пересекающимися интервалами (за всю историю таблицы)
duplicates:          снимки 0; дневные таблицы по 7 уникальным ключам 0; RUNNING/FAILED/PARTIAL запусков нет
```

## 13. STAGE 06

```text
orders worker: «воркер отправки заказов запущен» после каждого рестарта (22:02:38, 22:12:54, 22:58:11);
               orders_sync=true в контейнере всё время
outbox:        0 строк до gate и после включения; failed 0
regression:    simple_orders / status mapping / код очереди не менялись; естественных переходов после cutover
               по-прежнему нет — после cutover 13:19 MSK 12.09 в CRM 16 переходов (READY→SHIPMENT_CREATED, NEW→SENT, →FOLDER→IN_PROGRESS→READY
               и т.п.) — все внутри IN_PROGRESS, очередь по дизайну не пополняется (0 строк, корректно); 2 естественные
               заявки с сайта после cutover — 20260913-111 (02:43 MSK) и 20260913-112 (11:58 MSK): firstTouchUrl и
               conversionPageUrl заполнены (новый JS работает), yandexClientId пуст, обе ещё LEAD → первый LEAD→NEW /
               PAID через очередь по-прежнему not observed yet
```

## 14. SECURITY

```text
token committed/logged:            no — в коде подстановка из env, CLI печатает только даты/числа/коды; .env читался
                                   по именам ключей; резервные копии .env лежат рядом с оригиналом на сервере
existing OAuth rotation debt:      OPEN — ROTATE_YANDEX_OAUTH_TOKEN (по решению владельца не блокирует)
existing Client Secret rotation:   OPEN — ROTATE_YANDEX_CLIENT_SECRET
```

## 15. NEW FACTS (для этапа 09)

1. На бою `periodUsers` совпадает с прямым API за период (131, 323), а сумма дневных выше на
   14–26 % (149, 408) — заголовок «посетители» дашборда обязан читать `MetrikaPeriodSnapshot`.
2. Снимки пресетов обновляются каждый час вместе с дневными таблицами (после синхронизации),
   fetchedAt показывает свежесть; произвольный период без снимка отдаёт `periodUsers = null`
   с кодом `NO_PERIOD_SNAPSHOT` — дашборду показывать это честно, а не 0.
3. Один тик расписания теперь = 11 запросов синхронизации + 8 снимков = 19 запросов к API
   (≈ 460 в сутки); ошибок 4xx/5xx в логе нет.
4. `today` до полуночи 12.09 остаётся partial (день cutover); с 13.09 site-метрики complete.
5. `previous_30_days` сейчас почти пустой по трафику (счётчик с 13.08) — сравнение «30 дней к 30»
   даёт NEW/тысячи процентов; дашборду для трафика уместнее `last_7 ↔ previous_7` до середины октября.
6. Производительность в контейнере: 29 запросов / ≈2,3 с на getOverview с прогревом; для UI
   V1 достаточно, при росте заказов число запросов не растёт.
7. **Таблица снимков растёт вместе с календарём**: пресеты каждый день сдвигаются, а ключ —
   диапазон дат, поэтому старые диапазоны остаются (13.09 13:00 — 13 строк: 8 актуальных + 5
   вчерашних диапазонов, дублей по ключу 0). Рост ≈ 6 строк/сутки; колонка `preset` у старых
   строк — метка того дня, когда снимок делался. Дашборду искать снимок **по диапазону**, не по
   пресету; хранение прошлых диапазонов полезно (закрытый «вчера» = 9/11/65 совпал с «сегодня»
   предыдущего дня), retention — отдельным решением позже.
8. **Первые естественные заявки после cutover** (20260913-111, -112): first-touch и страница
   конверсии заполнены, но `yandexClientId` пуст у обеих — вероятно, посетитель не принял
   cookie-согласие (ClientID берётся у Метрики только после согласия). Пока не сработает
   LEAD→NEW с ClientID, сопоставленная воронка останется пустой; наблюдать в этапе 09/10.
9. Хостинг выключал сервер по питанию 13.09 08:51–09:42 MSK; после автоподъёма всё (сайт, CRM,
   расписание, воркер) восстановилось без вмешательства.

## 16. DEVIATIONS

1. § 9 — SUM(daily users) выведен через контракт (`sumDailyUsers` в overview и reconcile-traffic),
   а не отдельным SQL: скрипт с SQL-суммой упал на неоднозначном имени колонки; значения те же
   (149 / 408), доказательство неиспользования — контракт и тест.
2. § 19 — второй цикл наблюдался автоматически (не manual-equivalent). Ночью 13.09 с 08:51:31 до 09:42:19 MSK
   хост был выключен по питанию со стороны хостинга (journal: «Power key pressed short → Powering off», новый boot
   09:42) — тик 08:58 пропущен, контейнеры поднялись сами, расписание продолжило (daily 09:44), скользящее окно
   закрыло пропуск; к rollout это не относится, но фиксирую.
3. Документы rollout закоммичены в `feature/analytics-foundation`, не в master (push в master
   перезапускает бой); production code уже в master (e7e936d).

## 17. OPEN ISSUES

```text
none — блокеров нет. Не блокирует: естественные события этапа 06 (LEAD→NEW / PAID через очередь) всё ещё
not observed yet; security debt по токену/секрету без изменений.
```
