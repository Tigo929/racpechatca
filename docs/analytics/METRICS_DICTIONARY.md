# METRICS_DICTIONARY.md

# Словарь канонических метрик (этап 08)

Единственный источник формул — `crm-new/src/analytics/metrics/` (`AnalyticsMetricsService`
→ чистые функции `metrics-compute.ts`). Этот документ описывает то же самое словами;
при расхождении прав код, и документ надо поправить. Дашборд (этап 09) читает
контракт `metrics-contract.ts` и формулы не пересчитывает.

## Общие правила

```text
timezone:        Europe/Moscow — период это календарные дни по Москве включительно;
                 событие CRM (UTC-метка) попадает в день по московскому календарю: 21:00 UTC = 00:00 MSK
period presets:  today, yesterday, last_7_days, previous_7_days, last_30_days, previous_30_days,
                 current_month, previous_month; произвольные даты — customPeriod(from, to)
previous period: календарный месяц → предыдущий календарный месяц; иначе — отрезок той же длины
                 непосредственно перед началом
ratios:          всегда из итогов периода (Σ числитель / Σ знаменатель), никогда среднее дневных долей;
                 знаменатель 0 → null (не 0 %, не Infinity, не NaN); доли отдаются в процентах 0..100
change:          delta = current − previous; deltaPct = delta / previous × 100;
                 previous = 0 и current = 0 → 0 %, FLAT; previous = 0 и current > 0 → null, NEW;
                 current = 0 при previous > 0 → −100 %, GONE; одной стороны нет → NA
precision:       вычисления и хранение — полная точность; показ: проценты и деньги 2 знака, счётчики целые
currency:        RUB (в CRM целые рубли); других валют в данных нет, FX не применяется
completeness:    у каждой группы quality = complete | partial | unavailable + коды причин (QualityNote)
```

Три пространства данных, которые не смешиваются:

| Пространство | Источник | Что описывает |
|---|---|---|
| **site** (Метрика) | `MetrikaDaily*`, `MetrikaPeriodSnapshot` (этап 07/08) | визиты, `lead_submitted`, CRM-цели по заказам, сопоставленным с визитами через ClientID — только то, что видит Метрика |
| **crm** (жизненный цикл) | `OrderPhoto` + `StatusHistory` + позиции | все заказы CRM: сайт, Avito, созданные оператором |
| **pnl** (отчёт владельца) | `ReportsService.pnlForRange` = `/reports/monthly`, `/reports/weekly` | реализованная выручка, себестоимость, чистая прибыль по методике 15.08.2026 |

Запрещённые смешения: `CRM paid / Metrika visits` не конверсия «визит → оплата»
(для неё — `Metrika paid goal / visits`); `sourceOrder` — канал продаж, а не
маркетинговый источник; `revenue − cost` из Метрики/принятых — валовая
контрибуция, а не чистая прибыль CRM.

## Границы данных (immutable)

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT = 2026-09-12 13:19:22 Europe/Moscow
LEAD_GOAL_SEMANTICS_CHANGED_AT    = 2026-09-12 13:19:22 Europe/Moscow
CRM_TO_METRIKA_LIVE_SINCE         = 2026-09-12 12:20:10 Europe/Moscow  (воркер очереди заказов)
COUNTER_DATA_SINCE                = 2026-08-13                          (счётчик собирает данные)
```

Периоды, начинающиеся раньше 2026-09-13, для site-метрик — `partial`
(`INCOMPLETE_LEGACY_SITE_LEADS`, `CRM_GOALS_BEFORE_ROLLOUT`); раньше
2026-08-13 — ещё и `PERIOD_BEFORE_COUNTER`.

---

## Трафик (site)

| name | label | formula | numerator / denominator | source | period semantics | limitations |
|---|---|---|---|---|---|---|
| `visits` | Визиты | Σ `MetrikaDailyTraffic.visits` за дни периода | — | site | event, аддитивно | — |
| `periodUsers` | Посетители периода | `MetrikaPeriodSnapshot.users` для (from, to, scope=counter) | — | site (отдельный запрос API за период) | period-unique | нет снимка → `null` + `NO_PERIOD_SNAPSHOT`; снимки обновляются каждый час для 8 пресетов и командой `metrika:sync snapshots` |
| `sumDailyUsers` | Сумма дневных уникальных | Σ `MetrikaDailyTraffic.users` | — | site | event | **не** уникальные периода; названа честно, под именами `users`/`visitors` не отдаётся |
| `pageviews` (headline) | Просмотры | = `pageviewsSession` | — | site | event | заголовочная семантика выбрана: просмотры внутри визитов |
| `pageviewsSession` | Просмотры (визиты) | Σ `MetrikaDailyTraffic.pageviews` (`ym:s:pageviews`) | — | site | event | — |
| `pageviewsPage` | Просмотры (страницы) | Σ `MetrikaDailyPage.pageviews` (`ym:pv:pageviews`) | — | site | event | для аналитики страниц; ≠ `pageviewsSession` (хиты vs визиты), обе сходятся с прямым API каждая по-своему |
| `daysWithTraffic` | Дней с трафиком | число дней периода с visits > 0 | — | site | — | — |

## Воронка сайта (site, сопоставленная)

| name | label | formula | numerator / denominator | source | cohort/event | limitations, cutover |
|---|---|---|---|---|---|---|
| `siteLeads` | Заявки с сайта (Метрика) | Σ reaches цели `lead_submitted` (611379890) | — | site | event | до 2026-09-13 неполные (`INCOMPLETE_LEGACY_SITE_LEADS`); цель существует с сентября 2026, историю заявок считать по CRM |
| `matchedAccepted` | Заказы, сопоставленные с визитом | Σ reaches цели «CRM: Заказ создан» (596990603) | — | site | event | появляются только у заказов с ClientID, отправленных очередью после 12.09 12:20 (`CRM_GOALS_BEFORE_ROLLOUT`) |
| `matchedPaid` | Оплаты, сопоставленные с визитом | Σ reaches цели «CRM: Заказ оплачен» (596990604) | — | site | event | то же |
| `siteLeadConversion` | Визит → заявка | `siteLeads / visits × 100` | siteLeads / visits | site | event | null при visits = 0 |
| `siteAcceptedConversion` | Визит → заказ | `matchedAccepted / visits × 100` | matchedAccepted / visits | site | event | — |
| `sitePaidConversion` | Визит → оплата | `matchedPaid / visits × 100` | matchedPaid / visits | site | event | это единственная допустимая «визит → оплата» |
| `siteLeadToAccepted` | Заявка → заказ (сайт) | `matchedAccepted / siteLeads × 100` | | site | event | — |
| `siteAcceptedToPaid` | Заказ → оплата (сайт) | `matchedPaid / matchedAccepted × 100` | | site | event | — |

## Жизненный цикл заказа (crm) — `deriveOrderLifecycle(order, statusHistory)`

`StatusHistory` пишется только на переходах, поэтому:

| поле | правило |
|---|---|
| `initialStatus` | `fromStatus` первого перехода; переходов нет — текущий статус |
| `leadAt` | создан как LEAD → `createdAt`; позже попал в LEAD (NEW → LEAD) → момент первого перехода в LEAD; иначе null |
| `hadLeadStage` | initialStatus = LEAD, или текущий LEAD, или любой переход из/в LEAD |
| `acceptedAt` | первое вхождение в рабочий статус (NEW, APPROVAL_SENT, FOLDER_STRUCTURE_CREATED, IN_PROGRESS, PRINTED, READY, SHIPMENT_CREATED, DONE, SENT, PAID, READY_FOR_REVIEW, COMPLETED); создан сразу в рабочем → `createdAt`; LEAD, CANCELLED, PROBLEM принятием не являются |
| `paidAt` | только `clientPaidAt`; статус PAID без даты → null и `paidWithoutDate = true` (дата не угадывается) |
| `firstCancelledAt` / `lastCancelledAt` | первый / последний вход в CANCELLED по истории (создан отменённым без истории → statusChangedAt или createdAt); **возврат в работу их не стирает** (FIX_01) |
| `cancellationTimes` | все моменты входа в CANCELLED — для счётчика событий |
| `currentlyCancelled` | текущий статус = CANCELLED |
| `wasEverCancelled` | хотя бы один вход в CANCELLED |
| `realizedAt` | правило отчёта: `isRevenueRealized(status, category)` → `recognitionDate` (clientPaidAt → completedAt → statusChangedAt → sentAt → createdAt); иначе null |

Отмена не отменяет принятие: LEAD → NEW → CANCELLED = принят и отменён. Отмена — историческое
событие: LEAD → NEW → CANCELLED → NEW = принят, отменялся (first/lastCancelledAt сохранены), сейчас не отменён.

## Воронка CRM (crm)

Событийные счётчики (что случилось **в периоде**):

| name | label | formula | source | cohort/event |
|---|---|---|---|---|
| `crmLeads` | Заявки CRM | заказы с `leadAt` в периоде | crm | event |
| `acceptedOrders` | Принято заказов | заказы с `acceptedAt` в периоде (включая созданные оператором сразу NEW) | crm | event |
| `paidOrders` | Оплачено заказов | заказы с `paidAt` (= clientPaidAt) в периоде | crm | event |
| `cancelledOrders` | Отменено заказов | заказы с **`firstCancelledAt`** в периоде — один заказ = одно событие, сколько бы раз его ни отменяли и ни возвращали | crm | event (order-level) |
| `cancellationEvents` | Событий отмены | число переходов в CANCELLED внутри периода (`cancellationTimes`) — операционный счётчик, не заменяет `cancelledOrders` | crm | event (transition-level) |
| `currentlyCancelledOrders` | Отменены сейчас | заказы с `firstCancelledAt` в периоде и `currentlyCancelled = true` — текущее состояние, не история | crm | state |
| `realizedOrders` | Реализовано (выручка признана) | заказы с `realizedAt` в периоде = `orderCount` отчёта | crm/pnl | event |
| `paidWithoutDate` | Оплачены без даты | принятые в периоде со статусом PAID и пустым clientPaidAt | crm | — (`PAID_WITHOUT_DATE`) |

Когортные конверсии (что **когда-либо** стало с заказами, начавшимися в периоде):

| name | label | formula | numerator / denominator | cohort |
|---|---|---|---|---|
| `crmLeadToAccepted` | Заявка → заказ | `leadCohortAccepted / leadCohortSize × 100` | заявки периода с acceptedAt ≠ null / заявки периода | по leadAt |
| `crmAcceptedToPaid` | Заказ → оплата | `acceptedCohortPaid / acceptedCohortSize × 100` | принятые периода с paidAt ≠ null / принятые периода | по acceptedAt |
| `crmLeadToPaid` | Заявка → оплата | `leadCohortPaid / leadCohortSize × 100` | | по leadAt |
| `crmCancellationRate` | Доля отмен | `acceptedCohortCancelled / acceptedCohortSize × 100` | принятые периода с **`wasEverCancelled`** (возврат в работу факт не стирает) / принятые периода | по acceptedAt |

Когорты и события не смешиваются: `paidOrders` периода и `acceptedCohortPaid` — разные числа.

## Заказы и средний чек (crm)

| name | label | formula | denominator 0 |
|---|---|---|---|
| `acceptedAov` | Средний чек принятых | `contractValue / acceptedOrders` | null |
| `paidAov` | Средний чек оплаченных | `paidOrderValue / paidOrders` | null |
| `headlineAov` | Средний чек (заголовок) | = `paidAov` | null |

## Деньги

Три базы выручки — три разных метрики, «просто revenue» не существует:

| name | label | formula | source | semantics |
|---|---|---|---|---|
| `contract.contractValue` | Договорная сумма принятых | Σ `totalOrder` заказов с acceptedAt в периоде | crm | event (accepted) |
| `contract.cogs` | Себестоимость принятых | Σ `orderCostOfGoods(order).rub` по тому же набору (`order-cogs.ts`) | crm | бумага по формату / вознаграждение партнёру / подрядчик холстов |
| `contract.grossContribution` | Валовая контрибуция принятых | `contractValue − contract.cogs` | crm | **не** чистая прибыль |
| `contract.cogsReliableOrders` | Заказов с надёжной себестоимостью | заказы, где `orderCostOfGoods().reliable` | crm | меньше `orders` → `COGS_UNRELIABLE_ORDERS` |
| `paid.paidOrderValue` | Сумма оплаченных | Σ `totalOrder` заказов с paidAt в периоде | crm | event (paid) |
| `paid.cogs`, `paid.grossContribution` | | аналогично по оплаченным | crm | |
| `realized.orders` | Реализовано | `PnlReport.orderCount` | pnl | по дате признания выручки |
| `realized.realizedRevenue` | Реализованная выручка (оборот) | `PnlReport.totalRevenue` | pnl | Σ totalOrder реализованных |
| `realized.realizedGoodsRevenue` | Выручка за товар | `PnlReport.netRevenue` = оборот − доставка | pnl | |
| `realized.cogs` | Себестоимость (отчёт) | `PnlReport.cogs` | pnl | те же `order-cogs` |
| `realized.grossContribution` | Валовая прибыль (отчёт) | `PnlReport.grossProfit` = товарная выручка − себестоимость | pnl | |
| `realized.salaryAccrued` | Зарплата начисленная | `PnlReport.salaryAccrued` | pnl | по заказам периода, не по выплатам |
| `realized.operatingExpenses` | Операционные расходы | `PnlReport.operatingExpenses` (упаковка, оборудование, реклама, доля партнёра, прочее) | pnl | закупки материалов и авто-расходы подрядчиков не входят (уже в cogs) |
| `realized.deliveryProfit` | Заработок на доставке | `PnlReport.deliveryProfit` | pnl | |
| `realized.netProfit` | Чистая прибыль CRM | `PnlReport.netProfit` = grossProfit − opex − salaryAccrued + deliveryProfit | pnl | **единственная** формула прибыли — из `reports.service.ts` |
| `realized.marginPct` | Маржа | `netProfit / realizedRevenue × 100` | pnl | null при 0 |
| `realized.byCategory` | По категориям | `photo/tshirt/canvas: {orders, revenue, profit}` из PnlReport | pnl | |
| `spend.*` | CPL/CPA/CPO/ROAS/ROMI | — | — | `UNAVAILABLE_NO_SPEND_DATA`: расходов на рекламу в данных нет, значения не выдумываются |

Сверка P&L: `AnalyticsMetricsService` за календарный месяц = `GET /reports/monthly`
(месяц) = `GET /reports/weekly` (итого) — diff 0 по всем строкам (июль и август 2026,
`metrics:report reconcile-pnl`). Отчёты режут месяцы по часовому поясу процесса
(на бою TZ=Europe/Moscow), сервис — по явным московским границам; на бою это одни
и те же моменты.

## Срезы Метрики (site)

Одна и та же сопоставленная воронка по измерению — источники, UTM, страницы
входа, устройства. Доли из итогов группы.

| name | formula | notes |
|---|---|---|
| `visits`, `siteLeads`, `matchedAccepted`, `matchedPaid` | Σ по группе за период | из `MetrikaDailySource / Utm / Landing / Device` |
| `visitToLead` | siteLeads / visits × 100 | |
| `visitToAccepted` | matchedAccepted / visits × 100 | |
| `visitToPaid` | matchedPaid / visits × 100 | |
| `leadToAccepted` | matchedAccepted / siteLeads × 100 | |
| `acceptedToPaid` | matchedPaid / matchedAccepted × 100 | |

Измерения: источники — `trafficSource` + `sourceEngine` (коды Метрики, атрибуция
lastsign); UTM — пять меток, пустая = категория **`NO_UTM`**, входит в итоги; страницы
входа — `normalizedPath`; устройства — `deviceCategory` (desktop/mobile/tablet/other).
`users` в срезах не отдаются: их нельзя складывать между строками.

## Срезы CRM

| slice | dimension | metrics |
|---|---|---|
| products | `productCategory` (PHOTO / TSHIRT / CANVAS — из заказа, не из URL) | acceptedOrders, paidOrders, cancelledOrders, contractValue, paidOrderValue, cogs (по позициям Item*), cogsReliableOrders, grossContribution, acceptedAov, paidAov |
| salesChannels | `sourceOrder` (AVITO / OZON / WB / LOCAL) — канал продаж, **не** маркетинг | crmLeads, acceptedOrders, paidOrders, cancelledOrders, contractValue, paidOrderValue, acceptedAov, paidAov |

Связь «страница → товар» не строится: сопоставление пути и товара неоднозначно
(главная, `/formaty`, `/thanks`); аналитика страниц остаётся отдельно (этап 10).

## Качество данных

| name | formula / rule |
|---|---|
| `freshness.lastMetrikaSyncAt` | последний `MetrikaSyncRun` со статусом SUCCESS |
| `freshness.status` | возраст ≤ 7200 с → FRESH; больше → STALE (`METRIKA_STALE`, группы partial); запусков нет → NO_DATA (трафик unavailable) |
| `clientIdCoverageAccepted` | принятые в периоде с ClientID / принятые × 100 |
| `clientIdCoveragePaid` | оплаченные в периоде с ClientID / оплаченные × 100 |
| `eligibleAccepted` | принятые в периоде с ClientID и acceptedAt ≥ 2026-09-12 12:20:10 MSK |
| `eligibleDeliveredToMetrika` | из них с доставленной строкой `MetrikaOrderOutbox` |
| `metrikaMatchCoverage` | eligibleDeliveredToMetrika / eligibleAccepted × 100 |
| `matchedAcceptedReaches` | = `siteFunnel.matchedAccepted` (что Метрика реально засчитала) |
| `siteLeadsLegacy`, `crmGoalsBeforeRollout` | период начинается раньше 2026-09-13 |
| `snapshotAvailable` | есть строка `MetrikaPeriodSnapshot` для периода |

Коды `QualityNote`: `INCOMPLETE_LEGACY_SITE_LEADS`, `CRM_GOALS_BEFORE_ROLLOUT`,
`NO_PERIOD_SNAPSHOT`, `SNAPSHOT_SAMPLED`, `METRIKA_STALE`, `METRIKA_NO_DATA`,
`PERIOD_BEFORE_COUNTER`, `PAID_WITHOUT_DATE`, `COGS_UNRELIABLE_ORDERS`,
`PNL_UNAVAILABLE`, `UNAVAILABLE_NO_SPEND_DATA`.

## Сравнение периодов (`comparison`)

Ключи: visits, periodUsers, pageviews, siteLeads, matchedAccepted, matchedPaid,
crmLeads, acceptedOrders, paidOrders, cancelledOrders, realizedOrders, contractValue,
paidOrderValue, realizedRevenue, netProfit, siteLeadConversion, crmLeadToAccepted,
crmAcceptedToPaid, paidAov — каждый как `{current, previous, delta, deltaPct, changeKind}`.

## Методы сервиса

```text
getOverview(period, withComparison = true)  → Overview (traffic, siteFunnel, crmFunnel, orders,
                                              financials, dataQuality, comparison, metadata)
getFunnel(period)                           → { site, crm }
getTrafficSources / getUtm / getLandings / getDevices(period) → Slice<Row>
getProducts / getSalesChannels(period)      → CrmSlice<Row>
getComparison(period, previousPeriod?)      → { current, previous, comparison }
getDataQuality(period)                      → DataQualityMetrics
```

Диагностика: `npm run metrics:report -- overview|slices|reconcile-traffic|reconcile-crm|reconcile-pnl|perf`.
