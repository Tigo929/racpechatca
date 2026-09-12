# 08_ANALYTICS_METRICS.md

# Этап 08 — Канонические метрики, воронки, деньги и сравнение периодов

## Статус

```text
REVIEW — реализовано 12.09.2026 в feature/analytics-foundation: словарь метрик, жизненный цикл,
снимки уникальных периода, AnalyticsMetricsService; сверки на копии боевой базы — трафик 0,
CRM 0, P&L 0. Production не менялся. DONE ставит Reviewer.
```

Отчёт исполнителя — раздел 59; словарь — `METRICS_DICTIONARY.md`.

> Этап 07 принят как DONE после production rollout.
> Исполнитель не ставит этапу 08 `DONE` самостоятельно.
> После реализации статус = `REVIEW`.
> Решение `DONE / NEEDS_FIX / BLOCKED` принимает Reviewer.

---

# 1. Входные факты

Принято:

```text
00_MASTER_PLAN            = DONE
01_CURRENT_STATE          = DONE
02_ANALYTICS_DATA_MODEL   = DONE
03_HISTORICAL_BACKFILL    = DONE
04_EVENT_MODEL            = DONE
05_YANDEX_METRIKA_API     = DONE
06_CRM_TO_METRIKA         = DONE
06_PRODUCTION_ROLLOUT     = DONE
07_METRIKA_TO_ANALYTICS   = DONE
```

Production stage 07:

```text
Metrika analytics tables live
90-day initial sync live
scheduler enabled
scheduler:daily SUCCESS
scheduler:hourly SUCCESS
advisory lock verified
duplicate aggregates = 0
local vs direct Reports API = 0 unexplained differences
```

---

# 2. Цель этапа

Создать один канонический слой бизнес-метрик:

```text
local Metrika aggregates
+
CRM lifecycle
+
existing CRM P&L / COGS logic
↓
AnalyticsMetricsService
↓
stable typed metric contract
```

который Stage 09 dashboard сможет использовать без повторного определения формул.

Этап 08 должен ответить:

- сколько было трафика;
- сколько было лидов;
- сколько заказов принято;
- сколько оплачено;
- где теряется воронка;
- какие источники/UTM дают заявки, принятые и оплаченные заказы;
- какая выручка, себестоимость, gross contribution и CRM net/business profit;
- как период изменился относительно предыдущего;
- где данные неполные и почему.

---

# 3. Главный принцип — не смешивать разные пространства данных

## A. Site / Metrika funnel

```text
visits
→ lead_submitted
→ CRM: Заказ создан
→ CRM: Заказ оплачен
```

Это только Metrika-observable / matched funnel.

Используется для visit conversion, source attribution, UTM, landing pages, devices и digital funnel.

## B. CRM business funnel

```text
CRM lead
→ accepted order
→ paid order
→ completed / realized business result
```

Это все заказы CRM, включая сайт, Avito и operator-created.

## C. CRM P&L

Источник финансовой истины:

```text
существующая логика reports/monthly + reports/weekly
```

Нельзя независимо переписать P&L формулы для analytics.

---

# 4. Строго запрещённые смешения

Нельзя считать:

```text
total CRM paid orders / Metrika visits
```

как visit→paid conversion.

Для visit→paid:

```text
Metrika CRM paid goal / Metrika visits
```

Нельзя считать `sourceOrder` marketing source. Это sales/business channel: `AVITO / OZON / WB / LOCAL`.

Нельзя считать `Yandex revenue - cost` как CRM net profit. Это gross contribution / gross profit-like metric до salary/delivery/operating expenses по правилам CRM.

---

# 5. Timezone

Все period boundaries для Stage 08:

```text
Europe/Moscow
```

CRM timestamps могут храниться в UTC, но попадание события в аналитический день/период определяется через Europe/Moscow.

Обязательно проверить boundary:

```text
21:00 UTC = 00:00 MSK
```

---

# 6. Cutover metadata

Immutable:

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT
= 2026-09-12 13:19:22 Europe/Moscow

LEAD_GOAL_SEMANTICS_CHANGED_AT
= 2026-09-12 13:19:22 Europe/Moscow
```

До cutover `ecommerce.purchase` был ложной заявкой, а `lead_submitted` исторически неполон по части форм.

После cutover `lead_submitted` = canonical site lead, CRM goals = canonical matched order/payment.

---

# 7. Visitors / users — критичное правило

`MetrikaDailyTraffic.users` содержит дневных уникальных пользователей.

Поэтому:

```text
SUM(users)
```

за несколько дней НЕ является уникальными пользователями периода.

Stage 08 запрещено возвращать эту сумму под названием `users`, `visitors`, `uniqueUsers`.

Допустимо назвать `sumDailyUsers`, если это действительно нужно.

---

# 8. Period unique users — решение V1

Stage 09 нужен корректный headline `users/visitors`.

Preferred: создать локальный cache/table:

```text
MetrikaPeriodSnapshot
```

Grain:

```text
periodStart + periodEnd + metricScope
```

Минимально хранить:

```text
periodStart
periodEnd
users
visits
pageviews
fetchedAt
sampled
sampleShare
```

и получать `users` отдельным Reports API запросом за весь период.

Dashboard потом читает локальный snapshot, а не делает Yandex API call в request path.

Недопустимо: `SUM(daily users)` назвать users периода.

---

# 9. Period presets для snapshot V1

Минимально поддержать:

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

Если dashboard позже даст custom dates, snapshot создаётся controlled background/manual операцией, не live-call из UI request.

---

# 10. CRM lifecycle normalization

Создать один shared helper/service, например:

```text
deriveOrderLifecycle(order, statusHistory)
```

Он должен возвращать минимум:

```text
leadAt
acceptedAt
paidAt
cancelledAt
completedAt / realizedAt если применимо
hadLeadStage
```

---

# 11. CRM lead semantics

CRM lead считается только если заказ реально имел lead semantics: initial `LEAD` или достоверно имел `LEAD` в lifecycle/history.

Operator-created сразу `NEW` не является CRM lead.

---

# 12. Accepted order semantics

Accepted order = первый момент входа в accepted working lifecycle.

Accepted statuses:

```text
NEW
APPROVAL_SENT
FOLDER_STRUCTURE_CREATED
IN_PROGRESS
PRINTED
READY
SHIPMENT_CREATED
DONE
SENT
PAID
READY_FOR_REVIEW
COMPLETED
```

Не считать триггером acceptance:

```text
LEAD
CANCELLED
PROBLEM
```

Правило:

```text
acceptedAt = earliest timestamp entering accepted status
```

Если заказ создан сразу в accepted status и history не содержит отдельного перехода:

```text
acceptedAt = createdAt
```

Это покрывает operator-created `NEW`.

---

# 13. Cancel semantics

`CANCELLED` не отменяет исторический факт acceptance.

Если:

```text
LEAD → NEW → CANCELLED
```

то:

```text
accepted = yes
cancelled = yes
```

Recommended cancellation rate:

```text
cancelled accepted orders / accepted orders
```

с явно выбранной cohort/event semantics.

---

# 14. Paid semantics

Canonical:

```text
clientPaidAt
```

Если `clientPaidAt = null`, не угадывать paidAt даже если текущий статус выглядит поздним.

---

# 15. Cohort vs event metrics

Различать:

## Event counts

```text
leadsCreatedInPeriod
ordersAcceptedInPeriod
ordersPaidInPeriod
ordersCancelledInPeriod
```

## Cohort conversion

Например:

```text
из лидов, созданных в периоде,
сколько когда-либо стали accepted
```

Не смешивать эти семантики под одним названием.

---

# 16. V1 conversion contract — Site funnel

```text
siteLeadConversion
= lead_submitted reaches / visits
```

```text
siteAcceptedConversion
= CRM created reaches / visits
```

```text
sitePaidConversion
= CRM paid reaches / visits
```

```text
siteLeadToAccepted
= CRM created reaches / lead_submitted reaches
```

```text
siteAcceptedToPaid
= CRM paid reaches / CRM created reaches
```

Это matched Metrika funnel, а не total CRM.

---

# 17. CRM funnel conversions

Минимум:

```text
crmLeadToAccepted
crmAcceptedToPaid
crmLeadToPaid
crmCancellationRate
```

Executor обязан явно назвать event/cohort semantics.

Recommended V1: cohort by lead/accepted start для lead→accepted / accepted→paid, event counts отдельно.

---

# 18. Ratio rules

Любая конверсия считается из totals.

Нельзя использовать `AVG(dailyConversionRate)` для периода.

Если denominator = 0:

```text
value = null
```

а не 0%, Infinity или NaN.

---

# 19. Comparison period

Для произвольного текущего периода previous period = непосредственно предшествующий период той же длины.

Для calendar month: current month ↔ previous calendar month.

---

# 20. Change formulas

```text
delta = current - previous
```

```text
deltaPct = (current - previous) / previous * 100
```

Если previous = 0 и current = 0 → deltaPct = 0.

Если previous = 0 и current > 0 → deltaPct = null, `changeKind = NEW`.

---

# 21. Traffic metric contract

Минимум:

```text
visits
periodUsers
pageviewsSession
pageviewsPage
```

Где:

```text
pageviewsSession = ym:s:pageviews
pageviewsPage = ym:pv:pageviews
```

До review выбрать canonical headline `pageviews` и документировать решение.

Recommended: headline traffic = `ym:s:pageviews`, page content analytics = `ym:pv:pageviews`.

---

# 22. Lead metric contract

Разделить:

```text
siteLeads
crmLeads
```

`siteLeads = lead_submitted reaches` только в семантически достоверный период.

`crmLeads = CRM orders with leadAt in period`.

До cutover `siteLeads` имеет quality `INCOMPLETE_LEGACY`; для общего исторического business KPI основной источник — `crmLeads`.

---

# 23. Orders metric contract

Минимум:

```text
acceptedOrders
paidOrders
cancelledOrders
completedOrders / realizedOrders
```

`completed/realized` определять только через существующую business logic. Не создавать новую трактовку DONE/SENT/COMPLETED.

---

# 24. Revenue fields — разделить

Обязательные разные метрики:

```text
contractValue
paidOrderValue
realizedRevenue
```

`contractValue` = сумма `totalOrder` для выбранного order cohort/event set.

`paidOrderValue` = сумма `totalOrder` заказов с достоверным `paidAt`.

`realizedRevenue` = только через existing CRM P&L/reports rule.

Не называть все три просто `revenue` без уточнения.

---

# 25. COGS

Использовать существующий canonical helper `order-cogs.ts` и те же источники.

Не дублировать формулу.

---

# 26. Gross contribution

Canonical:

```text
grossContribution = revenue base - canonical COGS
```

Base должен быть явно указан: `contractGrossContribution` или `realizedGrossContribution`.

Не называть это `netProfit`.

---

# 27. CRM net/business profit

Источник:

```text
existing monthly/weekly reports business logic
```

Stage 08 должен использовать общий helper/service и доказать reconciliation с текущими reports endpoint.

Нельзя поддерживать две независимые profit formula.

---

# 28. Financial reconciliation

Выбрать 1–2 завершённых исторических периода и сравнить:

```text
existing reports endpoint
vs
AnalyticsMetricsService
```

Минимум:

```text
realizedRevenue
cost
net/business profit
```

Ожидается diff = 0 для одинаковой семантики.

---

# 29. AOV

```text
acceptedAov = accepted contract value / accepted orders
```

```text
paidAov = paidOrderValue / paidOrders
```

Если denominator 0 → null.

Recommended headline AOV = `paidAov`, если paid data достаточно надёжны.

---

# 30. Source/channel metrics

Для Metrika source/UTM таблиц считать:

```text
visits
siteLeads
matchedAccepted
matchedPaid
visitToLead
visitToAccepted
visitToPaid
leadToAccepted
acceptedToPaid
```

Это matched digital attribution.

Canonical marketing dimensions: `trafficSource`, `sourceEngine` из `MetrikaDailySource`.

---

# 31. UTM dimensions

Использовать:

```text
utmSource
utmMedium
utmCampaign
utmContent
utmTerm
```

Пустые UTM = нормальная категория `NO_UTM` и не исключаются из totals.

---

# 32. Business sales channel

Отдельная dimension:

```text
salesChannel
```

из CRM `sourceOrder`.

Это не Metrika marketing attribution.

---

# 33. Coverage metrics

Добавить data-quality KPI:

```text
clientIdCoverageAccepted
= accepted orders with yandexClientId / accepted orders
```

```text
clientIdCoveragePaid
= paid orders with yandexClientId / paid orders
```

И matched coverage только на честном eligible scope.

Recommended eligibility:

```text
accepted after CRM→Metrika rollout
AND yandexClientId IS NOT NULL
```

Для web semantics дополнительно учитывать cutover 2026-09-12 13:19:22 MSK.

---

# 34. Product metrics — CRM side

Подготовить агрегаты по типу продукта:

```text
photo
tshirt
canvas
```

Минимум:

```text
acceptedOrders
paidOrders
contractValue
paidOrderValue
COGS
grossContribution
AOV
```

Использовать реальные Item models, а не URL guessing.

---

# 35. Product/page separation

Не смешивать CRM product sales и Metrika page traffic.

Связь page → product добавлять только если deterministic mapping подтверждён. Если mapping неоднозначен — оставить page analytics отдельно и перенести связь на Stage 10.

---

# 36. Landing / device metrics

Для landing path и device category минимум:

```text
visits
siteLeads
matchedAccepted
matchedPaid
conversion rates
```

Не выводить психологические причины выхода.

---

# 37. Metrics service

Создать typed internal service, например:

```text
AnalyticsMetricsService
```

Минимальные methods:

```text
getOverview(period)
getFunnel(period)
getTrafficSources(period)
getUtm(period)
getLandings(period)
getDevices(period)
getProducts(period)
getSalesChannels(period)
getComparison(period, previousPeriod)
getDataQuality(period)
```

---

# 38. Typed response contract

Overview минимум:

```text
period
previousPeriod
traffic
siteFunnel
crmFunnel
orders
financials
dataQuality
comparison
metadata
```

Metadata:

```text
timezone
leadSemantics
pageviewSemantics
usersSemantics
cutover timestamps
lastMetrikaSyncAt
```

---

# 39. Data freshness

Возвращать:

```text
lastMetrikaSyncAt
metrikaDataAgeSeconds
```

И status:

```text
FRESH
STALE
NO_DATA
```

Предложить threshold, например FRESH <= 2h. Не скрывать stale analytics.

---

# 40. Partial-data flags

Metric group должен уметь сообщать:

```text
complete
partial
unavailable
```

Примеры: historical site leads до cutover = partial; period unique snapshot отсутствует = unavailable; Metrika sync stale = partial/stale.

---

# 41. Rounding / currency

Хранение/вычисление — полная точность.

Presentation:

```text
percent: 2 decimals
money: 2 decimals
counts: integer
```

V1 currency = RUB. Если найдены другие currencies — не суммировать без FX.

---

# 42. Tests — lifecycle

Обязательно:

```text
LEAD → NEW
LEAD → NEW → PAID
LEAD → NEW → CANCELLED
LEAD → CANCELLED (not accepted)
operator-created NEW
operator-created PAID if possible
CANCELLED → NEW reopen
PAID → working reopen
missing clientPaidAt
```

---

# 43. Tests — conversions / comparisons

Обязательно:

```text
normal ratio
denominator 0
previous 0/current >0
previous 0/current 0
cohort with late acceptance
cohort with late payment
cancel after acceptance
weighted conversion
```

Regression weighted conversion:

```text
day1 1/1 = 100%
day2 1/9 = 11.11%
period = 2/10 = 20%
```

не 55.56%.

---

# 44. Tests — users

Regression:

```text
day1 users = 100
day2 users = 100
```

service не имеет права вернуть period unique users = 200 без period snapshot.

---

# 45. Tests — timezone

События:

```text
20:59:59 UTC
21:00:00 UTC
```

должны попасть в разные MSK calendar days корректно.

---

# 46. Tests — financial reconciliation

Для fixed fixture / known DB slice:

```text
AnalyticsMetricsService financials
=
existing report business logic
```

---

# 47. Performance

Overview period query не должен делать N+1 per order.

Зафиксировать query count или duration на production-copy dataset.

---

# 48. Production safety

Implementation сначала в:

```text
feature/analytics-foundation
```

Не push в master без отдельной команды.

---

# 49. Никакого UI

На этапе 08 не строить dashboard.

UI начинается в:

```text
09_DASHBOARD_V1.md
```

---

# 50. Не делать ad spend / ROAS без spend data

Если нет достоверных рекламных расходов:

```text
CPL
CPA
CPO
ROAS
ROMI
```

не считать выдуманными значениями.

Возвращать:

```text
UNAVAILABLE_NO_SPEND_DATA
```

---

# 51. Verification dataset

На production copy или read-only production выполнить минимум:

```text
today
last 7 days
last 30 days
previous 30 days
```

и сохранить diagnostic output.

---

# 52. Reconciliation — traffic

Сравнить Overview service с локальными stage07 tables:

```text
visits
pageviews
lead reaches
CRM created reaches
CRM paid reaches
```

Ожидается diff = 0 для одинаковой семантики.

---

# 53. Reconciliation — CRM counts

Сравнить:

```text
acceptedOrders
paidOrders
cancelledOrders
```

с независимыми SQL sanity queries / current CRM data.

Ожидается diff = 0 после canonical lifecycle rules.

---

# 54. Reconciliation — reports/P&L

Обязательно сравнить financials минимум за один завершённый месяц/неделю:

```text
AnalyticsMetricsService
vs
GET /reports/monthly or underlying shared service
```

Ожидается:

```text
revenue diff = 0
cost diff = 0
profit diff = 0
```

если semantics identical.

---

# 55. Docs

Обновить:

```text
docs/analytics/08_ANALYTICS_METRICS.md
docs/analytics/00_MASTER_PLAN.md
docs/analytics/01_CURRENT_STATE.md
```

Создать:

```text
docs/analytics/METRICS_DICTIONARY.md
```

Для каждой метрики:

```text
name
human label
formula
numerator
denominator
source
timezone
period semantics
cohort/event
known limitations
cutover
```

---

# 56. EXECUTOR_REPORT

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

## 3. METRICS CONTRACT

Таблица:

```text
metric | formula | source | event/cohort | limitations
```

Минимум:

```text
visits
periodUsers
pageviews headline
siteLeads
crmLeads
acceptedOrders
paidOrders
cancelledOrders
siteLeadConversion
siteAcceptedConversion
sitePaidConversion
crmLeadToAccepted
crmAcceptedToPaid
acceptedAov
paidAov
realizedRevenue
COGS
grossContribution
net/business profit
```

## 4. USERS SOLUTION

```text
period unique implementation:
storage/cache:
presets:
fallback:
proof SUM(daily users) not used:
```

## 5. LIFECYCLE

```text
leadAt:
acceptedAt:
paidAt:
cancelledAt:
operator-created NEW:
reopen:
```

## 6. FINANCIALS

```text
contractValue:
paidOrderValue:
realizedRevenue:
COGS:
grossContribution:
net/business profit:
existing reports reuse:
```

## 7. SOURCE / UTM

```text
marketing source:
UTM:
salesChannel:
matched conversions:
coverage:
```

## 8. PRODUCTS

```text
photo:
tshirt:
canvas:
page→product mapping:
```

## 9. PERIOD COMPARISON

```text
previous period rule:
zero baseline:
weighted conversions:
timezone:
```

## 10. DATA QUALITY

```text
freshness:
partial flags:
lead legacy flag:
ClientID coverage:
Metrika match coverage:
```

## 11. RECONCILIATION

### Traffic

```text
metric | metrics service | stage07 local | diff
```

### CRM

```text
metric | metrics service | sanity SQL | diff
```

### P&L

```text
metric | metrics service | existing reports | diff
```

## 12. TESTS

```text
command | result
```

## 13. PERFORMANCE

```text
period:
orders:
query count:
duration:
N+1:
```

## 14. FILES_CHANGED

```text
file | change
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

# 57. Decision Gate

Stage 08 принимается, если:

- один typed metrics service является источником формул;
- site funnel и CRM funnel не смешаны;
- total CRM orders не делятся на Metrika visits;
- accepted lifecycle покрывает direct NEW;
- paidAt не угадывается;
- period unique users не считается суммой daily users;
- pageviews semantics выбрана и документирована;
- conversions считаются из totals;
- previous-period logic стабильна;
- financials reuse existing P&L;
- P&L reconciliation выполнена;
- source/UTM vs salesChannel разделены;
- ClientID/matching coverage доступны;
- product metrics идут из CRM Items;
- no-spend ROAS/ROMI не выдумываются;
- tests покрывают lifecycle/timezone/zero denominator/weighted ratios;
- METRICS_DICTIONARY готов для Stage 09.

После этого:

```text
08_ANALYTICS_METRICS = DONE
```

Следующий этап:

```text
09_DASHBOARD_V1.md
```

---

# 58. Команда исполнителю

Выполни `08_ANALYTICS_METRICS.md`.

Порядок:

1. Зафиксируй `METRICS_DICTIONARY`.
2. Реализуй canonical CRM lifecycle helper.
3. Реализуй period unique users безопасно — НЕ `SUM(daily users)`.
4. Реализуй typed `AnalyticsMetricsService`.
5. Раздели site funnel / CRM funnel / P&L.
6. Переиспользуй existing reports financial logic.
7. Реализуй source/UTM/sales-channel/product slices.
8. Реализуй previous-period comparison и data-quality flags.
9. Прогони traffic/CRM/P&L reconciliation.
10. Прогони tests/performance.
11. Production не трогай без отдельного разрешения.
12. Верни `EXECUTOR_REPORT`.

---

# 59. EXECUTOR_REPORT — 12.09.2026

## 1. RESULT

```text
READY_FOR_REVIEW — канонический слой метрик реализован в feature/analytics-foundation:
словарь, жизненный цикл заказа, снимки уникальных периода, типизированный
AnalyticsMetricsService (обзор, воронки, срезы, сравнение, качество), финансы через
существующий P&L; сверки на копии боевой базы — трафик 0, CRM 0, P&L 0 (июль и август).
Production не тронут (миграция снимков и обновление снимков в расписании ждут выкладки
по отдельной команде).
```

## 2. GIT

```text
repo:                racpechatca
branch:              feature/analytics-foundation
commit:              см. коммит «feat(аналитика, этап 08)» в ветке
push:                yes (feature/analytics-foundation → origin)
master touched:      no
production touched:  no (боевая база/контейнеры не менялись; на сервере создана копия
                     crm_stage08_test для проверок — удалена в конце этапа)
```

## 3. METRICS CONTRACT

Полный словарь — `docs/analytics/METRICS_DICTIONARY.md`; контракт — `metrics-contract.ts`.

```text
metric                 | formula                                              | source | event/cohort | limitations
-----------------------+------------------------------------------------------+--------+--------------+--------------------------------------------
visits                 | Σ MetrikaDailyTraffic.visits                         | site   | event        | —
periodUsers            | MetrikaPeriodSnapshot.users (from,to,counter)        | site   | period       | нет снимка → null + NO_PERIOD_SNAPSHOT
pageviews (headline)   | Σ ym:s:pageviews (=pageviewsSession)                 | site   | event        | pageviewsPage (ym:pv) отдельно, ≠
siteLeads              | Σ reaches lead_submitted 611379890                   | site   | event        | до 13.09.2026 неполные (INCOMPLETE_LEGACY_SITE_LEADS)
crmLeads               | заказы с leadAt в периоде                            | crm    | event        | оператор-NEW не заявка; NEW→LEAD — заявка с перехода
acceptedOrders         | заказы с acceptedAt в периоде                        | crm    | event        | создан сразу рабочим → acceptedAt = createdAt
paidOrders             | заказы с clientPaidAt в периоде                      | crm    | event        | PAID без даты не считается, показан paidWithoutDate
cancelledOrders        | заказы с cancelledAt в периоде (сейчас CANCELLED)    | crm    | event        | возврат в работу снимает отмену; в данных отмен нет
siteLeadConversion     | siteLeads / visits × 100                             | site   | event        | null при 0 визитов
siteAcceptedConversion | CRM created reaches / visits × 100                   | site   | event        | CRM_GOALS_BEFORE_ROLLOUT до 13.09
sitePaidConversion     | CRM paid reaches / visits × 100                      | site   | event        | единственная «визит → оплата»
crmLeadToAccepted      | заявки периода, ставшие заказом / заявки периода     | crm    | cohort(lead) | —
crmAcceptedToPaid      | принятые периода с оплатой / принятые периода        | crm    | cohort(acc.) | —
acceptedAov            | contractValue / acceptedOrders                       | crm    | event        | null при 0
paidAov (headline)     | paidOrderValue / paidOrders                          | crm    | event        | null при 0
realizedRevenue        | PnlReport.totalRevenue (оборот по дате признания)    | pnl    | event        | = /reports/monthly
COGS                   | order-cogs.ts: contract.cogs / paid.cogs / realized.cogs | crm/pnl |           | COGS_UNRELIABLE_ORDERS, если у заказа нет позиций
grossContribution      | contractValue − cogs; realized: PnlReport.grossProfit| crm/pnl|              | не чистая прибыль; база названа явно
net/business profit    | PnlReport.netProfit                                  | pnl    | event        | единственная формула — reports.service.ts
```

## 4. USERS SOLUTION

```text
period unique implementation: MetrikaPeriodSnapshotService — один запрос ym:s:users/visits/pageviews
                              без измерений за весь период (через MetrikaReportFetcher: accuracy-политика,
                              sampled честно), upsert в MetrikaPeriodSnapshot
storage/cache:                таблица MetrikaPeriodSnapshot (periodStart, periodEnd, metricScope=counter,
                              users, visits, pageviews, fetchedAt, sampled, sampleShare, requestCount, preset);
                              миграция 20260912160000_metrika_period_snapshot
presets:                      today, yesterday, last_7_days, previous_7_days, last_30_days, previous_30_days,
                              current_month, previous_month — обновляются каждым тиком расписания этапа 07
                              (после синхронизации; +8 запросов в час) и командой metrika:sync snapshots;
                              произвольный период — metrika:sync snapshots --from --to (контролируемо, не из UI)
fallback:                     снимка нет → periodUsers = null, группа traffic partial (NO_PERIOD_SNAPSHOT);
                              sumDailyUsers отдаётся под своим честным именем
proof SUM(daily users) not used: тест «без снимка periodUsers = null (никогда не 200)» (100 + 100 → null);
                              живой пример: last_30_days sumDailyUsers 408 vs periodUsers 323 (снимок API)
```

## 5. LIFECYCLE

```text
leadAt:                 initialStatus = LEAD → createdAt; попал в LEAD позже → первый переход в LEAD; иначе null
acceptedAt:             первое вхождение в рабочий статус (12 статусов, LEAD/CANCELLED/PROBLEM — нет);
                        начал в рабочем (или без истории и рабочий сейчас) → createdAt
paidAt:                 только clientPaidAt; PAID без даты → null + paidWithoutDate (13 таких заказов в базе)
cancelledAt:            сейчас CANCELLED → последний переход в CANCELLED (иначе statusChangedAt/createdAt);
                        возвращён в работу → null, wasEverCancelled = true
operator-created NEW:   истории нет → acceptedAt = createdAt, hadLeadStage = false (на бою 267 из 325 заказов
                        начали в NEW; 5 NEW без истории сейчас)
reopen:                 CANCELLED → NEW не двигает acceptedAt; PAID → READY сохраняет paidAt, но realizedAt
                        по правилу отчёта пропадает (статус больше не признан); NEW → LEAD — заявка с перехода
realizedAt:             isRevenueRealized + recognitionDate из reports.service (экспортированы), новой трактовки нет
```

## 6. FINANCIALS

```text
contractValue:        Σ totalOrder заказов с acceptedAt в периоде (event)
paidOrderValue:       Σ totalOrder заказов с clientPaidAt в периоде
realizedRevenue:      PnlReport.totalRevenue за московские границы периода (ReportsService.pnlForRange)
COGS:                 orderCostOfGoods (order-cogs.ts) для принятых/оплаченных; realized.cogs — из PnlReport
grossContribution:    contract: contractValue − cogs; paid: paidOrderValue − cogs; realized: PnlReport.grossProfit
net/business profit:  PnlReport.netProfit (+ salaryAccrued, operatingExpenses, deliveryProfit, marginPct, byCategory)
existing reports reuse: ReportsService — добавлены buildPnl(orders, expenses, salary, settings) и
                      pnlForRange(start, endExclusive) поверх тех же fetchPeriod/addOrder/addExpense/finalize;
                      recognitionDate и costSettings стали публичными; getMonthlyReport/getWeeklyReport не менялись;
                      ReportsModule экспортирует ReportsService
```

## 7. SOURCE / UTM

```text
marketing source:     MetrikaDailySource → trafficSource + sourceEngine (lastsign), группы по коду, доли из итогов
UTM:                  MetrikaDailyUtm → 5 меток; пустые → категория NO_UTM (isNoUtm), входят в итоги
                      (last_30_days: NO_UTM 568 визитов из 577, chatgpt.com 9)
salesChannel:         sourceOrder (AVITO/OZON/WB/LOCAL) — отдельный CRM-срез, не маркетинг
matched conversions:  visitToLead / visitToAccepted / visitToPaid / leadToAccepted / acceptedToPaid по каждой
                      строке и итогам; landing по normalizedPath, device по deviceCategory
coverage:             clientIdCoverageAccepted / clientIdCoveragePaid; eligible = принятые после 12.09 12:20 MSK
                      с ClientID; metrikaMatchCoverage = доставлено очередью / eligible; matchedAcceptedReaches
```

## 8. PRODUCTS

```text
photo / tshirt / canvas: по productCategory заказа и реальным Item-моделям (items / tshirtItems / canvasItems
                      через order-cogs): acceptedOrders, paidOrders, cancelledOrders, contractValue,
                      paidOrderValue, cogs, cogsReliableOrders, grossContribution, acceptedAov, paidAov
                      (last_30_days: PHOTO 86/44, TSHIRT 31/33, CANVAS 13/10 принятых/оплаченных)
page→product mapping: не строится — неоднозначно; аналитика страниц отдельно (этап 10)
```

## 9. PERIOD COMPARISON

```text
previous period rule: календарный месяц → предыдущий календарный месяц; иначе отрезок той же длины
                      непосредственно перед началом (last_7_days → previous_7_days и т.д.)
zero baseline:        previous 0 / current 0 → 0 %, FLAT; previous 0 / current > 0 → deltaPct null, NEW;
                      current 0 / previous > 0 → −100 %, GONE; нет стороны → NA
weighted conversions: все доли из итогов периода; регрессия 1/1 + 1/9 = 20 % (не 55,56 %) — тесты
                      ratios.spec и metrics-compute.spec
timezone:             Europe/Moscow (фиксированное +03:00): границы — московские полуночи в UTC;
                      события CRM попадают в день по московскому календарю; тест 20:59:59 vs 21:00:00 UTC
```

## 10. DATA QUALITY

```text
freshness:            lastMetrikaSyncAt (последний SUCCESS MetrikaSyncRun), metrikaDataAgeSeconds,
                      status FRESH ≤ 2 ч / STALE / NO_DATA
partial flags:        каждая группа: complete | partial | unavailable + коды QualityNote
lead legacy flag:     INCOMPLETE_LEGACY_SITE_LEADS для периодов с началом раньше 2026-09-13
ClientID coverage:    last_30_days: принятые 7,69 % (10/130), оплаченные 1,15 % (1/87)
Metrika match coverage: eligible 0 (после включения воркера принят один заказ без ClientID) → null;
                      matchedAcceptedReaches 1 (контрольный тест этапа 06)
```

## 11. RECONCILIATION (копия боевой базы crm_stage08_test, 12.09.2026 18:5x MSK)

### Traffic (last_7_days 06–12.09)

```text
metric                 | metrics service | stage07 local (SQL) | diff
visits                 |             185 |                 185 | 0
pageviews (ym:s)       |            1042 |                1042 | 0
pageviewsPage (ym:pv)  |            1163 |                1163 | 0
sumDailyUsers          |             149 |                 149 | 0
lead reaches           |               2 |                   2 | 0
CRM created reaches    |               1 |                   1 | 0
CRM paid reaches       |               0 |                   0 | 0
```

### CRM (независимый SQL по StatusHistory/OrderPhoto)

```text
metric           | last_30_days: service / SQL | 01.06–12.09: service / SQL | diff
crmLeads         |            29 / 29          |          36 / 36           | 0
acceptedOrders   |           130 / 130         |         318 / 318          | 0
paidOrders       |            87 / 87          |         204 / 204          | 0
cancelledOrders  |             0 / 0           |           0 / 0            | 0
paidWithoutDate  |             0 / 0           |          13 / 13           | 0
paidOrderValue   |        171626 / 171626      |      562779 / 562779       | 0
```

### P&L (сервис vs GET /reports/monthly (месяц) vs GET /reports/weekly (итого))

```text
август 2026: orders 79 | realizedRevenue 189405 | goods 180421 | cogs 56935 | grossProfit 123486 |
             salary 14551 | opex 0 | deliveryProfit 6130 | netProfit 115065 | photo 33564 / tshirt 77050 /
             canvas 4437 — diff 0 / 0 по всем 12 строкам
июль 2026:   orders 97 | realizedRevenue 230669 | goods 221635 | cogs 48703 | grossProfit 172932 |
             salary 19941 | opex 52934 | deliveryProfit 5743 | netProfit 105800 | photo 67465 / tshirt 91248 /
             canvas 0 — diff 0 / 0 по всем 12 строкам
```

## 12. TESTS

```text
command                                          | result
npx jest src/analytics/metrics                   | 4 suites / 58 passed: периоды (пресеты, previous, границы 21:00 UTC),
                                                 |   lifecycle (LEAD→NEW, →PAID, →CANCELLED, LEAD→CANCELLED, оператор NEW,
                                                 |   оператор→PAID, CANCELLED→NEW, PAID→READY, PAID без даты, NEW→LEAD, SENT),
                                                 |   ratios (0 в знаменателе, previous 0, weighted 20 %), compute (users
                                                 |   100+100 → null без снимка, когорты с поздним принятием/оплатой, отмена
                                                 |   после принятия, финансы = buildPnl, срезы, NO_UTM, coverage, comparison)
npx jest src/metrika/analytics/metrika-period-snapshot | 1 suite / 5 passed (upsert, повтор, 8 пресетов + ошибка одного, sampled → full)
npx jest (весь CRM)                              | 82 suites / 893 passed
npx tsc --noEmit (build и specs)                 | 0 ошибок в новых файлах
eslint новых файлов                              | чисто
npm run build                                    | OK
boot dist/main против копии                      | Nest application successfully started; расписание OFF (флаг false)
```

## 13. PERFORMANCE (копия, через SSH-туннель)

```text
period:      last_30_days (2026-08-14..2026-09-12)
orders:      325 в базе, принято в периоде 130
query count: getOverview с сравнением — 29 SQL-запросов (заказы одним findMany + 5 include-запросов, по
             периоду: трафик, цели, страницы, снимок, P&L (3) — ×2 периода, настройки, последний запуск);
             шесть срезов параллельно — 17
duration:    2985 мс / 3720 мс через туннель (~100 мс RTT на запрос); в контейнере ожидаемо кратно быстрее
N+1:         нет — число запросов не зависит от числа заказов
```

## 14. FILES_CHANGED

```text
file                                                            | change
crm-new/prisma/schema.prisma                                    | +MetrikaPeriodSnapshot
crm-new/prisma/migrations/20260912160000_metrika_period_snapshot | новая таблица
crm-new/src/analytics/metrics/analytics-constants.ts            | границы данных, порог свежести
crm-new/src/analytics/metrics/analytics-period.ts (+spec)       | пресеты, предыдущий период, московские границы
crm-new/src/analytics/metrics/order-lifecycle.ts (+spec)        | deriveOrderLifecycle
crm-new/src/analytics/metrics/ratios.ts (+spec)                 | ratio/percent/compare/round2
crm-new/src/analytics/metrics/metrics-contract.ts               | типизированный контракт
crm-new/src/analytics/metrics/metrics-compute.ts (+spec)        | чистые вычисления обзора, срезов, качества
crm-new/src/analytics/metrics/analytics-metrics.service.ts      | AnalyticsMetricsService (Prisma + ReportsService)
crm-new/src/analytics/metrics/analytics-metrics.module.ts       | модуль, подключён в AppModule
crm-new/src/analytics/metrics-report.ts                         | CLI metrics:report (overview, slices, reconcile-*, perf)
crm-new/src/metrika/analytics/metrika-period-snapshot.service.ts (+spec) | снимки периодов
crm-new/src/metrika/analytics/metrika-analytics-scheduler.service.ts    | обновление снимков после тика
crm-new/src/metrika/analytics/metrika-analytics.module.ts       | провайдер снимков
crm-new/src/analytics/metrika-sync.ts                           | команда snapshots
crm-new/src/reports/reports.service.ts, reports.module.ts       | buildPnl, pnlForRange, публичные recognitionDate/costSettings, export
crm-new/src/app.module.ts, package.json                         | AnalyticsMetricsModule; script metrics:report
docs/analytics/METRICS_DICTIONARY.md                            | новый словарь метрик
docs/analytics/08_ANALYTICS_METRICS.md                          | документ этапа + отчёт, статус REVIEW
docs/analytics/00_MASTER_PLAN.md, 01_CURRENT_STATE.md           | блок 08, § 5g
```

## 15. NEW FACTS (для этапа 09)

1. **Уникальные периода ≠ сумма дневных и на этих данных**: last_30_days — 323 против 408,
   last_7_days — 131 против 149. Заголовок «посетители» брать только из снимка.
2. **Оплаты без даты**: 13 заказов со статусом PAID и пустым clientPaidAt (все старше
   14.08) — в `paidOrders`/`paidOrderValue` их нет, в `realized*` (по статусу) они есть.
   Дашборд должен показывать `paidWithoutDate`, иначе «оплачено» и «реализовано» будут
   казаться противоречивыми.
3. **Отмен в CRM нет вовсе** (0 переходов в CANCELLED за всю историю) — `cancelledOrders`
   и `crmCancellationRate` будут нулями, пока оператор не начнёт отменять.
4. **ClientID у принятых — 7,7 %** (10/130 за 30 дней): почти все заказы — Avito и
   ручные. Сопоставленная воронка сайта долго будет малочисленной; для бизнес-KPI
   основа — CRM-воронка.
5. **Заявки CRM ≠ заявки сайта**: crmLeads 29 за 30 дней при siteLeads 2 — цель
   молодая; в CRM leadAt есть и у Avito-заказов, возвращённых в LEAD (3).
6. **Две базы просмотров**: ym:s 3858 vs ym:pv 4134 за 30 дней; заголовок — ym:s.
7. **Себестоимость ненадёжна у 6 из 130 принятых** (заказы без позиций) —
   `cogsReliableOrders` и флаг `COGS_UNRELIABLE_ORDERS` в контракте.
8. **P&L сходится с отчётами байт в байт** за июль и август — дашборд может показывать
   `realized.netProfit` как «прибыль» без оговорок; `contract.grossContribution` —
   только как «валовая по принятым».
9. **Расписание этапа 07 теперь обновляет снимки** (+8 запросов/час → ≈ 11 + 8 = 19 запросов
   на тик, ≈ 460 в сутки) — после выкладки этапа 08.

## 16. DEVIATIONS

1. § 8 — снимки хранят `preset` и `requestCount` сверх минимума (справочно).
2. § 13 — `cancelledAt` берётся только у заказов, отменённых сейчас; отменённый и
   возвращённый в работу в `cancelledOrders` не попадает (факт хранится в
   `wasEverCancelled`). Событийная семантика «сколько заказов сейчас отменено из
   отменённых в периоде» задокументирована.
3. § 23 — `completedOrders/realizedOrders` = `realizedOrders` по правилу отчёта
   (`isRevenueRealized`); отдельной трактовки COMPLETED/DONE не вводится (в данных
   `completedAt` не заполняется ни у одного заказа).
4. § 47 — замер производительности через SSH-туннель (RTT ≈ 100 мс), поэтому
   абсолютные миллисекунды завышены; зафиксировано число запросов.

## 17. OPEN ISSUES

```text
none — блокеров нет.
Не блокирует: выкладка этапа 08 (миграция MetrikaPeriodSnapshot + снимки в расписании) — по
отдельной команде владельца; естественные события этапа 06 всё ещё not observed yet.
```
