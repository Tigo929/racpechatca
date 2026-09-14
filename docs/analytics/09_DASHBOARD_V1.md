# 09_DASHBOARD_V1.md

# Этап 09 — Dashboard V1 для руководителя

## Статус

```text
READY_FOR_PRODUCTION_ROLLOUT (Reviewer, 14.09.2026) — реализация принята: API под ADMIN, флаг,
канонический слой метрик, reconciliation diff 0, состояния ошибок/неполных данных, responsive,
тесты и сборка. Production сознательно не тронут. Отчёт — § 64. Следующий документ —
`09_PRODUCTION_ROLLOUT.md`; выкладка только по отдельной команде владельца «СТАРТ». DONE ставит Reviewer
после controlled production verification.
```

> Этап 08 принят как DONE.
> Этот этап создаёт первый production dashboard для руководителя поверх готового `AnalyticsMetricsService`.
> Формулы в UI не дублировать: dashboard только потребляет готовый metrics contract.
> Исполнитель не ставит этапу `DONE` самостоятельно.

---

# 1. Цель этапа

Сделать рабочую управленческую панель, которая за 1–3 минуты отвечает руководителю:

```text
1. Что происходит с бизнесом?
2. Стало лучше или хуже?
3. Где теряются клиенты?
4. Какие каналы/товары дают результат?
5. Где данные неполные и насколько им можно доверять?
```

Dashboard V1 не должен превращаться в «копию Метрики».

Он должен связывать:

```text
ТРАФИК
→ ЗАЯВКИ
→ ПРИНЯТЫЕ ЗАКАЗЫ
→ ОПЛАТЫ
→ ВЫРУЧКА
→ СЕБЕСТОИМОСТЬ
→ ПРИБЫЛЬ
```

---

# 2. Источник истины

UI получает данные только через:

```text
AnalyticsMetricsService
```

или тонкий API/controller поверх него.

Запрещено:

```text
React/UI
→ raw Prisma
→ собственные формулы
```

Запрещено:

```text
dashboard request
→ Yandex API live
```

Stage 07/08 уже создали локальный слой и metrics contract.

---

# 3. Production facts

На момент старта Stage 09:

```text
Stage 07 local Metrika sync = production
Stage 08 metrics service = production
period snapshots = production
scheduler = production
P&L reconciliation = 0
CRM reconciliation = 0
traffic reconciliation = 0
```

Cutovers:

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT
= 2026-09-12 13:19:22 Europe/Moscow

LEAD_GOAL_SEMANTICS_CHANGED_AT
= 2026-09-12 13:19:22 Europe/Moscow
```

---

# 4. Главный UX-принцип

Dashboard строится для руководителя, а не аналитика.

На первом экране НЕ должно быть:

- 40 карточек;
- сырых dimension IDs;
- технических таблиц;
- длинных JSON;
- терминов без объяснения;
- графиков без управленческого смысла.

Главный экран должен давать ответ:

```text
Сколько пришло людей?
Сколько заявок?
Сколько заказов?
Сколько оплат?
Сколько денег?
Сколько прибыли?
Что изменилось?
```

---

# 5. Period selector

Обязательные presets:

```text
Сегодня
Вчера
7 дней
Предыдущие 7 дней
30 дней
Предыдущие 30 дней
Текущий месяц
Прошлый месяц
```

Дополнительно:

```text
custom date range
```

если существующий metrics service уже поддерживает нужный snapshot/controlled range.

Если custom period unique snapshot отсутствует:

```text
periodUsers = unavailable
```

UI не должен подменять его sumDailyUsers.

---

# 6. Comparison mode

По умолчанию:

```text
текущий период
vs
предыдущий сопоставимый период
```

Каждая headline card показывает:

```text
current
delta
deltaPct / NEW / GONE
```

Пример:

```text
Принятые заказы
42
+7 (+20%)
```

---

# 7. Главный экран — KPI row

Первая строка:

```text
Визиты
Посетители
Заявки сайта
Принятые заказы
Оплаты
```

Вторая строка:

```text
Выручка
Себестоимость
Прибыль
Средний чек
```

Рекомендуемые headline semantics:

```text
visits             = site traffic
periodUsers        = snapshot period unique users
siteLeads          = lead_submitted
acceptedOrders     = CRM accepted
paidOrders         = CRM paid
realizedRevenue    = existing P&L
COGS               = canonical P&L/COGS
netProfit          = existing P&L net/business profit
paidAov            = headline AOV
```

---

# 8. Названия в UI

Не показывать пользователю:

```text
realizedRevenue
grossContribution
periodUsers
siteAcceptedConversion
```

Показывать:

```text
Выручка
Валовой вклад
Посетители
Конверсия в заказ
```

Tooltip/help раскрывает точную формулу.

---

# 9. Revenue cards

Минимум три разных money metrics:

```text
Выручка
Себестоимость
Прибыль
```

Дополнительно в details:

```text
Стоимость принятых заказов
Стоимость оплаченных заказов
Gross contribution
```

Не смешивать их в одну карточку `Revenue`.

---

# 10. Site funnel

Отдельный блок:

```text
Визиты
↓
Заявки сайта
↓
Сопоставленные принятые заказы
↓
Сопоставленные оплаты
```

Показывать:

```text
counts
conversion between steps
```

Обязательная метка:

```text
"Сопоставлено через Метрику/ClientID"
```

потому что coverage пока низкая.

---

# 11. CRM funnel

Отдельно:

```text
CRM-заявки
↓
Принятые заказы
↓
Оплаченные заказы
```

Это основной business funnel.

Не соединять visual line между Metrika site funnel и total CRM funnel как будто это один denominator.

---

# 12. Coverage warning

Если:

```text
ClientID coverage < 50%
```

или matched eligibility низкая, рядом с site→order funnel показать:

```text
"Данные о связи сайта с заказами пока неполные"
```

Tooltip:

```text
"Не все клиенты дали согласие на аналитику / не все заказы имеют ClientID.
Общий бизнес-KPI считается по CRM и остаётся полным."
```

Не показывать это как system error.

---

# 13. First natural leads without ClientID

На текущем production уже наблюдались site leads после cutover без `yandexClientId`.

Dashboard должен корректно переживать:

```text
siteLeads > 0
matchedAccepted = 0
```

Не писать:

```text
"конверсия 0% — сайт не работает"
```

если eligibility = 0.

Вместо этого:

```text
"Недостаточно сопоставленных заказов"
```

---

# 14. Trend chart

Один основной line/bar chart:

```text
по дням
```

Metric selector:

```text
Визиты
Заявки
Принятые
Оплаты
Выручка
Прибыль
```

Не накладывать показатели разных scale на одну ось без нормализации.

---

# 15. Traffic sources

Таблица:

```text
Источник
Визиты
Заявки
Сопоставленные заказы
Сопоставленные оплаты
Конверсия в заявку
Конверсия в заказ
```

Source = Metrika marketing source:

```text
trafficSource + sourceEngine
```

Не `sourceOrder`.

---

# 16. UTM

Отдельная таблица / tab:

```text
utm_source
utm_medium
utm_campaign
visits
leads
accepted
paid
conversion
```

Пустые UTM:

```text
Без UTM
```

не скрывать.

---

# 17. Sales channels

Отдельный блок:

```text
Avito
Ozon
WB
Local
```

Источник:

```text
CRM sourceOrder
```

Показатели:

```text
Принятые
Оплаченные
Выручка
Средний чек
Прибыль / вклад
```

Это НЕ marketing attribution.

---

# 18. Product performance

Блок:

```text
Фото
Футболки
Холсты
```

Минимум:

```text
acceptedOrders
paidOrders
paidAov
contractValue
paidOrderValue
COGS
grossContribution
```

Если realized profit per product недоступна корректно:

```text
не выдумывать
```

---

# 19. Landing pages

Таблица:

```text
Страница входа
Визиты
Заявки
Сопоставленные заказы
Сопоставленные оплаты
Конверсия в заявку
```

Top N:

```text
10–20
```

Остальное:

```text
"Показать все"
```

---

# 20. Devices

Блок:

```text
Desktop
Mobile
Tablet
Other
```

Показывать:

```text
visits
siteLeads
matchedAccepted
matchedPaid
conversion
```

Это станет базой для Stage 10 UX analysis.

---

# 21. Data quality panel

Обязательный небольшой блок:

```text
Данные актуальны
Последняя синхронизация
ClientID coverage
COGS completeness
Paid without exact paidAt
```

Status:

```text
FRESH
STALE
NO_DATA
```

Перевод UI:

```text
Актуально
Есть задержка
Нет данных
```

---

# 22. Historical limitations

Если период пересекает:

```text
до 13.08.2026
```

показать:

```text
"Метрика начала собирать данные с 13 августа"
```

Если период пересекает:

```text
до 12.09.2026 13:19
```

показать:

```text
"Исторические site-lead данные до обновления аналитики неполные"
```

Не скрывать limitation.

---

# 23. Previous 30 days limitation

Пока Metrika ещё молодая.

Если previous period частично до counter start:

```text
comparison traffic = partial
```

UI:

```text
"Сравнение неполное: Метрика ещё не собирала данные весь предыдущий период"
```

Не показывать misleading `+6400%`.

---

# 24. Color semantics

Использовать нейтрально:

```text
рост хорошего KPI = positive
падение хорошего KPI = negative
```

Но:

```text
рост COGS
рост cancellation
рост errors
```

не должен окрашиваться как good.

Нужен metric polarity map.

---

# 25. Metric polarity

Минимум:

```text
visits             = higher usually positive
siteLeads          = higher positive
acceptedOrders     = higher positive
paidOrders         = higher positive
revenue            = higher positive
netProfit          = higher positive
conversion         = higher positive
COGS absolute      = neutral/context
cancellationRate   = lower positive
formErrors         = lower positive
```

---

# 26. No causal claims

Dashboard может писать:

```text
"Конверсия снизилась на 18%"
```

Не:

```text
"Клиентам не нравится форма"
```

Причины — Stage 10/12.

---

# 27. Alert cards V1

Допустимы rule-based attention cards:

```text
Прибыль снизилась >20%
Конверсия в заявку снизилась >20%
Данные устарели >2h
COGS incomplete
ClientID coverage низкая
```

Назвать:

```text
"Требует внимания"
```

Не `AI insight`.

---

# 28. Mobile-first

Dashboard должен нормально работать:

```text
desktop
tablet
mobile
```

На mobile:

```text
KPI cards stack/2-column
tables horizontally scroll or transform
charts readable
filters accessible
```

---

# 29. Desktop layout

Recommended:

```text
Header
Period selector
KPI cards
Site funnel + CRM funnel
Trend
Sources + Products
Landings + Devices
Sales channels
Data quality
```

---

# 30. Navigation

V1 sections:

```text
Обзор
Источники
Товары
Страницы
Качество данных
```

Не делать 15 разделов.

---

# 31. API

Создать read-only dashboard API, например:

```text
GET /analytics/dashboard/overview
GET /analytics/dashboard/sources
GET /analytics/dashboard/products
GET /analytics/dashboard/landings
GET /analytics/dashboard/devices
GET /analytics/dashboard/sales-channels
```

Все endpoints:

```text
authenticated
read-only
```

---

# 32. Permissions

Dashboard только для авторизованных CRM/admin users.

Не делать public analytics endpoint.

---

# 33. Caching

Metrics уже local.

V1 допускает server cache:

```text
30–60 sec
```

для heavy overview.

Cache key:

```text
period
comparison period
filters
```

---

# 34. Performance target

Для production-like DB:

```text
overview backend <= 3s
```

как реалистичный V1 target.

UI:

```text
loading state
не зависает целиком
```

---

# 35. Loading / empty / error

Обязательно три состояния:

```text
loading
empty
error
```

Не показывать `0`, когда backend unavailable.

---

# 36. Currency formatting

```text
RUB
```

UI:

```text
241 100 ₽
1 972,71 ₽
```

Locale:

```text
ru-RU
```

---

# 37. Percent formatting

```text
57,45 %
```

Максимум 2 decimals.

---

# 38. Count formatting

```text
1 234
```

без decimal.

---

# 39. Tooltips

Для сложных карточек:

```text
Прибыль
Посетители
Сопоставленные заказы
Coverage
Gross contribution
```

обязательный tooltip:

```text
что считается
из какого источника
ограничения
```

Источник текста — `METRICS_DICTIONARY`.

---

# 40. Freshness

Header/status:

```text
Данные обновлены 12 минут назад
```

Если STALE:

```text
"Данные могут быть устаревшими"
```

---

# 41. Dashboard must not expose technical IDs

Не показывать руководителю:

```text
goalId
batchId
MetrikaSyncRun id
ClientID raw
Prisma ids
```

---

# 42. UX attention preview

Stage 09 может подготовить место:

```text
"UX / Требует внимания"
```

Но real behavioral diagnosis идёт в Stage 10.

V1 допустимо показывать только факты:

```text
Mobile conversion ниже desktop
Landing X ниже среднего
Form error count
```

если соответствующие данные уже есть.

---

# 43. No heatmaps yet

Не реализовывать в Stage 09:

```text
heatmaps
session replay
rage clicks
scroll maps
```

---

# 44. Testing — API

Покрыть:

```text
authorized access
unauthorized rejected
period presets
comparison
empty snapshot
stale data
partial legacy period
zero denominators
```

---

# 45. Testing — UI

Минимум component/integration:

```text
KPI cards render
NEW/GONE/NA changes
partial warning
FRESH/STALE
money formatting
percent formatting
mobile layout
empty/error state
```

---

# 46. Snapshot regression

Test:

```text
daily users = 149
period snapshot users = 131
```

Dashboard должен показать `131`, а не `149`.

---

# 47. Matched funnel regression

Если:

```text
siteLeads > 0
eligibleMatchedOrders = 0
```

UI должен показать:

```text
"Недостаточно данных для сопоставления"
```

а не misleading `0%`.

---

# 48. P&L regression

Dashboard profit должен использовать:

```text
AnalyticsMetricsService.financials.netProfit
```

Не пересчитывать во frontend.

---

# 49. Product regression

Суммы product block не обязаны всегда равняться headline total, если один заказ содержит несколько product categories.

Если multi-product order возможен:

```text
document counting semantics
```

---

# 50. Design system

Использовать существующие UI components CRM/admin.

Не создавать второй несвязанный визуальный стиль.

---

# 51. Charts

Использовать текущую chart library проекта, если уже есть.

Если нет:

- выбрать одну lightweight library;
- не подключать несколько chart libs.

---

# 52. Accessibility

Минимум:

```text
keyboard accessible filters
aria labels where needed
not color-only meaning
contrast readable
table headers
```

---

# 53. Page route

Recommended:

```text
/analytics
```

или существующий admin routing convention.

---

# 54. Feature flag

Рекомендуется:

```text
ANALYTICS_DASHBOARD_ENABLED
```

или existing feature convention.

На первом deploy можно включить только owner/admin.

---

# 55. Production rollout strategy

После implementation review:

```text
1. merge feature
2. deploy backend API
3. verify auth
4. deploy frontend/dashboard
5. owner smoke
6. compare dashboard vs CLI/metrics service
```

Не выкатывать без отдельной команды.

---

# 56. Acceptance smoke

На production проверить:

```text
today
last_7_days
last_30_days
```

Для каждого:

```text
headline cards
funnels
sources
products
quality
```

Сравнить минимум 10 ключевых чисел с CLI `metrics:report`.

Ожидается:

```text
diff = 0
```

---

# 57. Screenshot acceptance

Для review исполнитель должен приложить:

```text
desktop screenshot
mobile screenshot
```

или точное текстовое описание, если screenshot pipeline недоступен.

Предпочтительно screenshots.

---

# 58. Data used in screenshot

Не использовать invented fixture data для production screenshot.

---

# 59. No Stage 10 implementation

Не делать сейчас:

```text
deep behavior funnels
drop-off sequence engine
session replay
UX hypotheses
experiment attribution
```

---

# 60. Documentation

Обновить:

```text
docs/analytics/09_DASHBOARD_V1.md
docs/analytics/00_MASTER_PLAN.md
docs/analytics/01_CURRENT_STATE.md
```

Создать при необходимости:

```text
docs/analytics/DASHBOARD_CONTRACT.md
```

---

# 61. EXECUTOR_REPORT

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

## 3. ROUTES / API

```text
frontend route:
API endpoints:
auth:
feature flag:
```

## 4. OVERVIEW

```text
KPI cards:
period presets:
comparison:
freshness:
partial warnings:
```

## 5. FUNNELS

```text
site funnel:
CRM funnel:
coverage warning:
```

## 6. SOURCES / UTM

```text
source table:
UTM table:
matched conversions:
```

## 7. PRODUCTS / SALES CHANNELS

```text
products:
sales channels:
money metrics:
```

## 8. LANDINGS / DEVICES

```text
landings:
devices:
```

## 9. DATA QUALITY

```text
freshness:
ClientID:
COGS:
paidWithoutDate:
legacy:
```

## 10. UI STATES

```text
loading:
empty:
error:
partial:
stale:
```

## 11. TESTS

```text
backend:
frontend:
e2e/component:
build:
```

## 12. PERFORMANCE

```text
period:
API duration:
frontend load:
cache:
```

## 13. RECONCILIATION

```text
metric | dashboard | metrics CLI/service | diff
```

Минимум 10 ключевых метрик.

## 14. RESPONSIVE

```text
desktop:
tablet:
mobile:
```

## 15. SCREENSHOTS

```text
desktop:
mobile:
```

## 16. FILES_CHANGED

```text
file | change
```

## 17. NEW FACTS

Все факты для Stage 10.

## 18. DEVIATIONS

Если нет:

```text
none
```

## 19. OPEN ISSUES

Если нет:

```text
none
```

---

# 62. Decision Gate

Stage 09 принимается, если:

- dashboard реально доступен руководителю;
- UI использует только canonical metrics service;
- periodUsers берётся из snapshot;
- site funnel и CRM funnel визуально разделены;
- coverage limitation видна;
- headline money metrics совпадают с P&L;
- source и sales channel не смешаны;
- product metrics доступны;
- comparison работает;
- legacy/partial periods помечены;
- freshness/data quality видны;
- UI responsive;
- auth защищает analytics routes;
- dashboard vs metrics reconciliation = 0;
- production smoke пройден.

После этого:

```text
09_DASHBOARD_V1 = DONE
```

Следующий этап:

```text
10_BEHAVIOR_AND_FUNNELS.md
```

---

# 63. Команда исполнителю

Выполни `09_DASHBOARD_V1.md`.

Порядок:

1. Сначала зафиксируй `DASHBOARD_CONTRACT`.
2. Реализуй read-only analytics API поверх `AnalyticsMetricsService`.
3. Реализуй `/analytics` в текущем design system.
4. Сделай Overview + funnels + sources + products + landings/devices + quality.
5. Не дублируй формулы во frontend.
6. Не путай site funnel с CRM funnel.
7. Сделай partial/coverage/freshness warnings.
8. Прогони tests/build.
9. Сверь dashboard минимум по 10 метрикам с metrics CLI/service.
10. Production не трогай без отдельного разрешения.
11. Верни `EXECUTOR_REPORT`.

---

# 64. EXECUTOR_REPORT (13–14.09.2026)

## 1. RESULT

```text
READY_FOR_REVIEW
```

Реализация Dashboard V1 завершена и проверена на свежей копии production-базы
(`crm_stage09_test`, снята 13.09.2026 13:39 MSK). Production не трогался.

## 2. GIT

```text
repo:                racpechatca (github.com/tigo929/racpechatca)
branch:              feature/analytics-foundation
commit:              f21c636 — feat(аналитика, этап 09): дашборд руководителя — read-only API и раздел «Аналитика»
                     b8f7278 — merge origin/master (4349ae2: контакт клиента / телефон MAX — коммиты владельца 13.09) в feature
                     + коммит документации (этот отчёт, DASHBOARD_CONTRACT.md, скриншоты, master plan, current state, graphify)
push:                origin/feature/analytics-foundation (после этого отчёта)
master touched:      NO
production touched:  NO (только read-only проверки: docker ps, логи scheduler, /var/log/auto-update.log)
```

## 3. ROUTES / API

```text
frontend route:  /crm/analytics (AdminRoute → только ADMIN), lazy; пункт меню «Аналитика» в группе «Управление»;
                 вкладки ?tab=overview|sources|products|pages|quality
API endpoints:   GET /analytics/dashboard/status
                 GET /analytics/dashboard/overview        → AnalyticsMetricsService.getOverview
                 GET /analytics/dashboard/trend           → getTrend (новый метод: дни = Метрика + lifecycle + ReportsService.pnlBuckets)
                 GET /analytics/dashboard/sources|utm|landings|devices → getTrafficSources/getUtm/getLandings/getDevices
                 GET /analytics/dashboard/products|sales-channels     → getProducts/getSalesChannels
                 query: ?preset=<8 пресетов этапа 08> | ?from=YYYY-MM-DD&to=YYYY-MM-DD (≤366 дней); без параметров — last_7_days
auth:            JwtAuthGuard + RolesGuard @Roles(ADMIN) на контроллере; проверено на копии:
                 без токена 401, битый токен 401, EXECUTOR 403 (все маршруты, включая /status), ADMIN 200
feature flag:    ANALYTICS_DASHBOARD_ENABLED (true/1/yes/on), default false → все маршруты кроме /status = 404
                 «Раздел аналитики выключен»; панель показывает карточку «Раздел выключен».
                 docker-compose.prod.yml: ${ANALYTICS_DASHBOARD_ENABLED:-false}; .env.example добавлен
nginx/vite:      /analytics добавлен в frontend/nginx.conf и vite proxy (nginx-routes.spec — зелёный)
```

Контракт: `docs/analytics/DASHBOARD_CONTRACT.md`.

## 4. OVERVIEW

```text
KPI cards:       ряд 1 — Визиты · Посетители (снимок; «—» + причина без снимка; подпись «сумма по дням: N») ·
                 Заявки сайта · Принятые заказы · Оплаты
                 ряд 2 — Выручка · Себестоимость · Прибыль · Средний чек (все три денежных — из P&L буферa realized)
period presets:  today, yesterday, last_7_days, previous_7_days, last_30_days, previous_30_days,
                 current_month, previous_month + «Свои даты» (from/to); период в sessionStorage
comparison:      бейдж под каждой карточкой: «+7 (+20 %)», «−8 (−100 %)», «новое (+2)» (NEW), «без изменений»
                 (FLAT), «—» (NA); цвет по полярности (cancelledOrders — lower-good, cogs — нейтральная),
                 знак и текст дублируют цвет; сравнение трафика скрыто, если предыдущий период раньше 13.08.2026
freshness:       подзаголовок шапки «Актуально / Есть задержка / Нет данных: данные обновлены N назад»;
                 STALE → предупреждение + карточка «Данные устарели»; на не-обзорных вкладках — плашка сверху
partial warnings: legacy (до 12.09 13:19), counter (до 13.08), snapshot (нет снимка), stale, no-data, cogs,
                 paid-date, coverage (<50 % или нечего сопоставлять), comparison-partial — правила в
                 analytics-view.ts §9.6 контракта; на копии за 7 дней: legacy + stale + coverage
```

## 5. FUNNELS

```text
site funnel:     карточка «Воронка сайта» — Визиты → Заявки сайта (визит→заявка) → Сопоставленные принятые заказы
                 (заявка→заказ) → Сопоставленные оплаты (заказ→оплата); подзаголовок «Сопоставлено через
                 Метрику/ClientID»; счётчики показываются всегда, конверсии заменяются «—» и плашкой
                 «Недостаточно сопоставленных заказов», когда siteLeads > 0 и eligibleAccepted = 0 (не «0 %»)
CRM funnel:      отдельная карточка «Воронка CRM» — CRM-заявки → Принятые заказы (из заявок периода, когорта) →
                 Оплаченные заказы (из принятых периода, когорта); отменено за период + доля
coverage warning: «Данные о связи сайта с заказами пока неполные» (в воронке и в общем списке) при покрытии
                 ClientID < 50 % или eligibleAccepted = 0; карточка «Связь сайта с заказами неполная —
                 ClientID есть у 8,82 % принятых заказов» при реальной доле < 50 %
```

## 6. SOURCES / UTM

```text
source table:    trafficSourceName · sourceEngineName, визиты, заявки, сопост. заказы, сопост. оплаты,
                 конв. в заявку, конв. в заказ; строка «Итого» = totals; сортировка по визитам;
                 подзаголовок «Это не канал продаж CRM»
UTM table:       utm_source / medium / campaign, «Без UTM» для isNoUtm, те же колонки и итог
matched conversions: только по ClientID (matchedAccepted/matchedPaid); нули приглушены; за 7 дней —
                 1 сопоставленный заказ у «Переходы по рекламе · Яндекс: Директ» (контрольный тест этапа 06)
```

## 7. PRODUCTS / SALES CHANNELS

```text
products:        Фото / Футболки / Холсты: принято, оплачено, сумма принятых, сумма оплаченных, себестоимость,
                 валовой вклад (с подсказкой «это не прибыль»), средний чек
sales channels:  Avito / Ozon / Wildberries / Сайт и прямые: заявки, принято, оплачено, суммы, средний чек;
                 подзаголовок «Это не источник рекламы» — источники трафика и каналы продаж не смешаны
money metrics:   Выручка/Себестоимость/Прибыль на KPI = financials.realized (buildPnl); блок «Деньги подробно» —
                 три базы отдельно (по принятым, по оплаченным, по правилам отчёта) + прибыль по категориям,
                 зарплата, расходы, доставка, маржа
```

## 8. LANDINGS / DEVICES

```text
landings:        normalizedPath моноширинным, 15 строк + «Показать все», итог; за 7 дней — 19 страниц входа
devices:         Компьютер / Телефон / Планшет / Другое, те же колонки сопоставленной воронки
```

## 9. DATA QUALITY

```text
freshness:       «Свежесть данных» — Актуально / Есть задержка / Нет данных + «Последняя синхронизация: N назад»
ClientID:        «Покрытие ClientID» = clientIdCoverageAccepted (8,82 % за 7 дней на копии), оплаченные %,
                 «готовы к сопоставлению: eligibleAccepted»
COGS:            «Полнота себестоимости» = cogsReliableOrders / contract.orders (100 % за 7 дней; 1 из 22 без
                 позиций за 1–7 июля → карточка «Себестоимость посчитана не полностью»)
paidWithoutDate: «Оплачены без даты» = dataQuality.paidWithoutDate (0 за 7/30 дней)
legacy:          строка «Заявки сайта считаются полностью с 13 сентября 2026; Метрика собирает данные с 13.08.2026»
                 + предупреждение legacy для периодов, задевающих 12.09 13:19
```

## 10. UI STATES

```text
loading:  role="status" «Загрузка…» (скриншот state-loading.png); срезы вкладок грузятся отдельно, страница не
          блокируется (KPI видны, пока график ещё грузится)
empty:    «За этот период данных нет» в таблицах срезов (state-empty-sources.png, 1–7 июля 2026 — до счётчика);
          график: «Нет данных за период» / «<показатель>: за этот период нулевые значения»
error:    role="alert" с текстом ошибки сервера + «Повторить», KPI-карточек нет (0 вместо данных не
          показывается) — state-error.png (500 на overview/trend, смоделировано перехватом запроса).
          Полный отказ backend уводит всю панель на экран входа — это существующее поведение AuthContext
          (/auth/me), не дашборда
partial:  предупреждения legacy / counter / snapshot / coverage / comparison-partial (desktop-overview-precounter.png
          — 7 предупреждений за 1–7 июля 2026, посетители «—», сравнение трафика «—»)
stale:    подзаголовок «Есть задержка: данные обновлены 7 часов назад», предупреждение, карточка «Данные устарели»
disabled: карточка «Раздел выключен» + подзаголовок «раздел выключен» (state-disabled.png)
```

## 11. TESTS

```text
backend:   crm-new — 83 suites / 912 tests PASS (после слияния master; до слияния 908; новых — 11:
           analytics-dashboard.controller.spec.ts ×10, computeTrend ×1); nest build OK; eslint/prettier
           новых файлов чистые (prettier-предупреждения по старым файлам backfill/*, metrika-*.ts —
           CRLF локального checkout, содержимое не менялось)
frontend:  vitest 2 файла / 21 тест PASS (analytics-view.test.ts: форматы, дельты NEW/GONE/NA/FLAT, полярность,
           предупреждения, attention-правила; components.test.tsx: KpiCard, снимок 131 ≠ 149, «Недостаточно
           сопоставленных заказов» без «0 %», DataQualityPanel FRESH/STALE/NO_DATA, состояния, TrendChart);
           eslint новых файлов чистый (существующие ошибки в AppShell/PrintEditor/OrderDetail/SettingsPage/
           AvitoPage — не этого этапа)
e2e/component: testing-library (jsdom) для компонентов; smoke в браузере — puppeteer против vite + backend
           на копии (скриншоты ниже); auth-probes.js — 401/403/400/404/200 по всем маршрутам
build:     frontend `tsc -b && vite build` OK (vitest-конфиг вынесен в vitest.config.ts — типы vitest 3 собраны
           под vite 7, общий defineConfig с vite 8 не сходился); CI: добавлен шаг «Тесты панели» (npm test)
```

## 12. PERFORMANCE

```text
period:        last_30_days (2026-08-15..2026-09-13), 328 заказов в базе, 129 принятых в периоде
API duration:  через SSH-туннель к боевому Postgres (RTT ≈150–190 мс на запрос): overview 3,9–4,3 с,
               trend 3,2–4,9 с, sources/utm/landings/devices 0,3–0,8 с, products/sales-channels 2,5–4,4 с;
               metrics:report perf на копии: getOverview 29 SQL-запросов (без N+1), срезы 17 —
               те же 29/17, что в боевом контейнере этапа 08, где getOverview занял 2,28 с холодным
               (с прогревом Prisma) и срезы 0,97 с → цель ≤3 с выполняется с локальной БД
frontend load: панель грузит status → overview → trend по очереди, срезы вкладок — только при открытии
               вкладки; KPI отрисовываются до прихода графика
cache:         DashboardCache TTL 45 с, ключ kind:from:to:kind-периода, promise-кэш (параллельные одинаковые
               запросы считаются один раз), ошибки не кэшируются; повторный overview — 175–489 мс
               (сеть до backend + сериализация), spec проверяет TTL и не-кэширование ошибок
```

## 13. RECONCILIATION

Копия `crm_stage09_test`; A = `GET /analytics/dashboard/*` (HTTP, JWT ADMIN), B = `AnalyticsMetricsService`
напрямую (та же сборка, что `metrics:report`), C = `metrics:report overview --json`.

```text
metric                              | dashboard (A) | CLI/service (C) | diff   — last_7_days 2026-09-07..13
traffic.visits                      |          151 |            151 | 0
traffic.periodUsers (снимок)        |          106 |            106 | 0
siteFunnel.siteLeads                |            2 |              2 | 0
crmFunnel.events.crmLeads           |           10 |             10 | 0
crmFunnel.events.acceptedOrders     |           34 |             34 | 0
crmFunnel.events.paidOrders         |            3 |              3 | 0
financials.realized.realizedRevenue |        51053 |          51053 | 0
financials.realized.cogs            |         6761 |           6761 | 0
financials.realized.netProfit       |        36512 |          36512 | 0
orders.paidAov                      | 6233.333333… |  6233.333333… | 0

metric                              | dashboard (A) | CLI/service (C) | diff   — last_30_days 2026-08-15..09-13
traffic.visits                      |          569 |            569 | 0
traffic.periodUsers (снимок)        |          320 |            320 | 0
siteFunnel.siteLeads                |            2 |              2 | 0
crmFunnel.events.crmLeads           |           31 |             31 | 0
crmFunnel.events.acceptedOrders     |          129 |            129 | 0
crmFunnel.events.paidOrders         |           87 |             87 | 0
financials.realized.realizedRevenue |       241100 |         241100 | 0
financials.realized.cogs            |        62020 |          62020 | 0
financials.realized.netProfit       |       138504 |         138504 | 0
orders.paidAov                      | 1972.712643… |  1972.712643… | 0

today 2026-09-13: visits 3 / periodUsers 3 / siteLeads 0 / crmLeads 2 / accepted 1 / paid 0 /
revenue 0 / cogs 0 / netProfit 0 / paidAov null — все diff 0.

Полное сравнение всех листьев JSON (A vs B, все 8 маршрутов): today 461 листьев, last_7_days 817,
last_30_days 1247 — единственное различие везде dataQuality.freshness.metrikaDataAgeSeconds
(секунды «возраста» считаются от момента вызова). A.overview vs C: 215/218/218 листьев — то же.
Инварианты графика: Σvisits, Σaccepted, Σpaid, ΣrealizedRevenue по дням = Overview (7 и 30 дней);
ΣnetProfit по дням = 36 511 vs 36 512 (7 д.) и 138 497 vs 138 504 (30 д.) — округление
себестоимости фото (ceil копеек) в каждом дне buildPnl, как в недельных/месячных разрезах отчёта;
в UI сумма графика подписана «сумма по дням» с подсказкой, итог периода — карточка «Прибыль».
```

## 14. RESPONSIVE

```text
desktop: 1440×900 — KPI 5 + 4 колонки, воронки в 2 колонки, таблицы во всю ширину
tablet:  768–1279 — KPI 3 колонки, воронки в 1 колонку (Tailwind md/lg), таблицы в overflow-x-auto
mobile:  390×844 (Chrome mobile emulation) — KPI по 2 в ряд, чипы периодов переносятся, вкладки скроллятся,
         таблицы скроллятся внутри карточки; горизонтального скролла страницы нет
         (scrollWidth == clientWidth — проверено скриптом)
```

## 15. SCREENSHOTS

`docs/analytics/screenshots/09_dashboard_v1/` — реальные данные копии production 13.09.2026 (не фикстуры):

```text
desktop: desktop-overview-7d.png, desktop-overview-30d.png, desktop-overview-today.png,
         desktop-overview-precounter.png (1–7 июля 2026), desktop-trend-profit.png,
         desktop-sources-7d.png, desktop-products-7d.png, desktop-pages-7d.png, desktop-quality-7d.png
mobile:  mobile-overview-7d.png (вся страница), mobile-overview-7d-viewport.png, mobile-sources-7d.png
states:  state-loading.png, state-empty-sources.png, state-error.png, state-disabled.png
```

## 16. FILES_CHANGED

```text
file | change
crm-new/src/analytics/dashboard/analytics-dashboard.controller.ts | new — 9 read-only маршрутов, guards, флаг, кэш
crm-new/src/analytics/dashboard/analytics-dashboard.module.ts     | new — DASHBOARD_OPTIONS (из env) + DashboardCache
crm-new/src/analytics/dashboard/dashboard-period.ts               | new — preset | from/to → AnalyticsPeriod, 400 на ошибках, ≤366 дней
crm-new/src/analytics/dashboard/dashboard-cache.ts                | new — promise-кэш TTL 45 с
crm-new/src/analytics/dashboard/analytics-dashboard.controller.spec.ts | new — 10 тестов
crm-new/src/analytics/metrics/metrics-contract.ts                 | + TrendPoint, Trend
crm-new/src/analytics/metrics/metrics-compute.ts                  | + computeTrend (чистая функция)
crm-new/src/analytics/metrics/metrics-compute.spec.ts             | + тест computeTrend
crm-new/src/analytics/metrics/analytics-metrics.service.ts        | + getTrend
crm-new/src/analytics/metrics/analytics-metrics.module.ts         | экспорт для дашборда
crm-new/src/reports/reports.service.ts                            | + pnlBuckets(start, end, keyOf) — buildPnl по бакетам, одна выборка
crm-new/src/app.module.ts                                         | + AnalyticsDashboardModule
frontend/src/pages/AnalyticsPage.tsx                              | new — страница, вкладки, KPI-ряды, состояния
frontend/src/features/analytics/analytics-view.ts                 | new — подписи, форматы ru-RU, полярность, правила предупреждений/внимания
frontend/src/features/analytics/ui.tsx                            | new — Card, Hint, DeltaBadge, KpiCard, Notice, StateBlock, таблица
frontend/src/features/analytics/sections.tsx                      | new — воронки, срезы, товары, каналы, деньги, качество, внимание
frontend/src/features/analytics/TrendChart.tsx                    | new — SVG-график одного показателя
frontend/src/features/analytics/PeriodSelector.tsx                | new — пресеты + свои даты
frontend/src/features/analytics/__tests__/*                       | new — фикстуры (реальные цифры), 21 тест
frontend/src/api/analytics.ts, frontend/src/types/analytics.ts    | new — клиент и зеркало контракта
frontend/src/App.tsx, frontend/src/components/layout/navigation.ts | маршрут /crm/analytics, пункт меню (ADMIN)
frontend/nginx.conf, frontend/vite.config.ts                      | /analytics в прокси
frontend/package.json, package-lock.json, vitest.config.ts, src/test-setup.ts, tsconfig.*.json | vitest + testing-library
.github/workflows/build-images.yml                                | + шаг «Тесты панели»
docker-compose.prod.yml, .env.example                             | ANALYTICS_DASHBOARD_ENABLED (default false)
docs/analytics/DASHBOARD_CONTRACT.md                              | new — контракт API/UI
docs/analytics/09_DASHBOARD_V1.md                                 | статус REVIEW, § 64 (этот отчёт)
docs/analytics/00_MASTER_PLAN.md, 01_CURRENT_STATE.md             | статус этапа 09, § 5h
docs/analytics/screenshots/09_dashboard_v1/*.png                  | 16 скриншотов
graphify-out/*                                                    | graphify update (6056 узлов)
```

## 17. NEW FACTS

- Данные копии 13.09 13:39 MSK, last_7_days (07–13.09): визиты 151 (−38,9 % к предыдущим 7 дням),
  посетители 106 (снимок; сумма по дням 121), заявки сайта 2 (новое), CRM-заявки 10, принято 34,
  оплат 3, выручка 51 053 ₽, себестоимость 6 761 ₽, прибыль 36 512 ₽, средний чек 6 233,33 ₽;
  покрытие ClientID у принятых 8,82 %, eligibleAccepted 0 → сопоставленные конверсии «—».
- last_30_days (15.08–13.09): визиты 569, посетители 320, заявки сайта 2, CRM-заявки 31, принято 129,
  оплат 87, выручка 241 100 ₽, прибыль 138 504 ₽, средний чек 1 972,71 ₽; 33 страницы входа, 9 источников.
- Каналы продаж за 7 дней: Avito 26 принятых / 3 оплаты / 37 569 ₽; «Сайт и прямые» 10 заявок / 8 принятых /
  0 оплат; Ozon и WB — 0. Источники: Яндекс.Директ 104 визита (69 %), поиск Яндекса 22, прямые 11.
- Σ дневных netProfit ≠ итог периода на единицы рублей (ceil копеек фото в каждом бакете buildPnl) —
  свойство единой формулы P&L, а не дашборда; учитывать в Stage 10 при любых суммированиях по дням.
- Полный отказ backend переводит панель на экран входа (AuthContext снимает токен при ошибке /auth/me);
  собственное состояние «Ошибка» дашборда показывается при ошибках его маршрутов.
- Production 13.09 19:48–19:49 MSK: auto-update выкатил коммиты владельца 13a76a7..4349ae2 (контакт клиента,
  телефон MAX) — backend и frontend обновлены, healthy; расписание Метрики работает (SUCCESS 18:17, 19:17 MSK,
  8/8 снимков); 14.09 14:42 — разовая ошибка docker pull backend (реестр), обновлять было нечего.
  Флаг ANALYTICS_DASHBOARD_ENABLED на бою не задан → после деплоя этапа 09 раздел будет выключен до
  отдельного решения владельца (ожидаемо, § 54–55).
- `usePersistentState` хранит период в sessionStorage (не localStorage): период живёт пока открыта вкладка.

## 18. DEVIATIONS

```text
1. Раздел 33: cache key = kind:from:to:kind-периода без отдельного «comparison period» и «filters»:
   предыдущий период — детерминированная функция периода, фильтров в V1 нет.
2. Раздел 31 перечислял 6 маршрутов; добавлены /status (флаг, пресеты, cutovers), /trend (график) и /utm.
3. Раздел 9: подписи денег — «Выручка / Себестоимость / Прибыль» с подсказками «по правилам финансового
   отчёта»; «Сумма принятых заказов / Сумма оплаченных заказов / Валовой вклад» — в блоке «Деньги подробно»
   (валовой вклад явно подписан «это не прибыль»).
4. Сумма по дням у прибыли в графике может отличаться от карточки на единицы рублей (см. § 13) —
   подписано и объяснено подсказкой; формула P&L не менялась.
5. Backend tests: 912 вместо «≥907» — 4 теста пришли со слиянием master (lead-notification.spec).
6. Перф-цель ≤3 с подтверждена расчётно (29 SQL без N+1; 2,28 с в боевом контейнере этапа 08) —
   прямой замер по HTTP на бою невозможен без выкладки.
```

## 19. OPEN ISSUES

```text
1. Production smoke (§ 56) и включение флага — только по отдельной команде владельца
   (merge feature → master, деплой, ANALYTICS_DASHBOARD_ENABLED=true в /opt/raspechatka/.env, recreate backend).
2. Копия crm_stage09_test удалена после отчёта; временные пользователи stage09_admin/stage09_executor
   существовали только в копии.
3. Наблюдение (не блокер): естественные заявки без ClientID (нет cookie-согласия) → сопоставленная воронка
   останется «—» до появления заявок с согласием; PHASE K/L (LEAD→NEW/PAID через очередь) — not observed yet.
4. Security debt без изменений: ROTATE_YANDEX_OAUTH_TOKEN, ROTATE_YANDEX_CLIENT_SECRET — решение владельца.
```
