# DASHBOARD_CONTRACT.md

# Контракт дашборда руководителя (этап 09, Dashboard V1)

## Статус

```text
ЗАФИКСИРОВАН (implementation, 13.09.2026)
Production: не включён (ANALYTICS_DASHBOARD_ENABLED=false до отдельной команды)
```

Этот документ — единственное место, где описано, **что** отдаёт API дашборда и
**как** панель это показывает. Формулы здесь не определяются: все числа приходят из
`AnalyticsMetricsService` (этап 08, `08_ANALYTICS_METRICS.md`, `METRICS_DICTIONARY.md`).
Дашборд ничего не считает, кроме форматирования и правил отображения.

---

# 1. Принципы

1. **Один источник чисел.** Каждый endpoint — тонкая обёртка над методом
   `AnalyticsMetricsService`. Ни одного raw-Prisma запроса, ни одной своей формулы
   в `crm-new/src/analytics/dashboard/*` и во frontend.
2. **Контракт ответа = `metrics-contract.ts`.** JSON в точности повторяет типы
   `Overview`, `Trend`, `Slice<…>`, `CrmSlice<…>`; frontend держит зеркало типов в
   `frontend/src/types/analytics.ts` (единственное отличие — `Date` → ISO-строка).
3. **Только чтение, только администратор.** Все маршруты под `JwtAuthGuard` +
   `RolesGuard` с `@Roles(ADMIN)`. Публичных endpoint'ов нет.
4. **Выключаемо целиком.** `ANALYTICS_DASHBOARD_ENABLED` (default `false`):
   при выключенном флаге все маршруты, кроме `/status`, отвечают `404`, панель
   показывает карточку «Раздел выключен» (пункт меню остаётся, страница не грузит данные).
5. **Никаких live-запросов к Яндексу из дашборда.** Только локальные таблицы
   этапа 07/08 и `ReportsService` (P&L).
6. **Никаких технических ID в UI.** Цели Метрики, ID счётчика, ClientID,
   yclid не показываются.

---

# 2. Маршруты

Базовый префикс: `/analytics/dashboard` (backend Nest, порт 3000; nginx панели
проксирует `/analytics` наравне с `/orders`, `/reports` и т. д. — `frontend/nginx.conf`;
dev-прокси Vite — `frontend/vite.config.ts`).

**Два хоста, два белых списка.** Панель доступна как `https://195-2-75-249.sslip.io/crm/…`
(конфиг из образа CRM) и как `https://raspechatkaa.ru/crm/…` — блок домена в
`web-photo/deploy/nginx-domain.conf`, живая копия на сервере
`/opt/raspechatka/frontend/nginx-photo.conf` (не синхронизируется из git). Новый API-префикс
нужно добавлять в оба; 14.09.2026 `/analytics` отсутствовал во втором — на домене дашборд
получал 404 HTML («Адрес не найден на сервере»), исправлено 15.09 00:01 MSK.

| Метод | Путь | Метод сервиса | Ответ (тип из `metrics-contract.ts`) |
|---|---|---|---|
| GET | `/analytics/dashboard/status` | — | `DashboardStatus` (см. §4) |
| GET | `/analytics/dashboard/overview` | `getOverview(period)` | `Overview` |
| GET | `/analytics/dashboard/trend` | `getTrend(period)` | `Trend` |
| GET | `/analytics/dashboard/sources` | `getTrafficSources(period)` | `Slice<SourceRow>` |
| GET | `/analytics/dashboard/utm` | `getUtm(period)` | `Slice<UtmRow>` |
| GET | `/analytics/dashboard/landings` | `getLandings(period)` | `Slice<LandingRow>` |
| GET | `/analytics/dashboard/devices` | `getDevices(period)` | `Slice<DeviceRow>` |
| GET | `/analytics/dashboard/products` | `getProducts(period)` | `CrmSlice<ProductRow>` |
| GET | `/analytics/dashboard/sales-channels` | `getSalesChannels(period)` | `CrmSlice<SalesChannelRow>` |

Файлы: `crm-new/src/analytics/dashboard/analytics-dashboard.controller.ts`,
`analytics-dashboard.module.ts`, `dashboard-period.ts`, `dashboard-cache.ts`.

---

# 3. Период (query)

Все маршруты, кроме `/status`, принимают один из двух вариантов:

```text
?preset=<PeriodPreset>
?from=YYYY-MM-DD&to=YYYY-MM-DD
```

- Пресеты (`PERIOD_PRESETS`, этап 08): `today`, `yesterday`, `last_7_days`,
  `previous_7_days`, `last_30_days`, `previous_30_days`, `current_month`, `previous_month`.
- Даты — календарные в `Europe/Moscow`; границы считает `analytics-period.ts`
  (MSK `+03:00`, `endExclusive`).
- Без параметров — `last_7_days`.
- Ошибки → `400 Bad Request`:
  - неизвестный пресет: `Неизвестный период: <preset>`;
  - `from`/`to` не в формате `YYYY-MM-DD` или `from > to`;
  - произвольный период длиннее `MAX_CUSTOM_DAYS = 366` дней.
- `previousPeriod` в `Overview` считается сервисом (этап 08): для пресетов — тот же
  тип периода назад, для произвольных дат — такой же длины непосредственно перед `from`.
  Отдельного параметра сравнения в V1 нет.

Фильтров (источник, товар, канал) в V1 нет — срезы отдаются целиком.

---

# 4. `/status`

Единственный маршрут, который отвечает и при выключенном флаге — панель читает его
первым и по `enabled` решает, запрашивать ли остальное. Тоже под JWT + ADMIN:
без токена `401`, не администратору `403`.

```json
{
  "enabled": false,
  "presets": ["today", "yesterday", "last_7_days", "previous_7_days", "last_30_days", "previous_30_days", "current_month", "previous_month"],
  "timezone": "Europe/Moscow",
  "cutovers": {
    "falseBrowserPurchaseStoppedAt": "2026-09-12 13:19:22 Europe/Moscow",
    "leadGoalSemanticsChangedAt": "2026-09-12 13:19:22 Europe/Moscow",
    "crmToMetrikaLiveSince": "2026-09-12 12:20:10 Europe/Moscow",
    "counterDataSince": "2026-08-13"
  }
}
```

---

# 5. Ответы

## 5.1 `Overview`

Точно `Overview` из `metrics-contract.ts`:

```text
period, previousPeriod          AnalyticsPeriod {from, to, kind, preset}
traffic                          visits, periodUsers|null, sumDailyUsers, pageviews, pageviewsSession,
                                 pageviewsPage, daysWithTraffic, quality
siteFunnel                       visits, siteLeads, matchedAccepted, matchedPaid,
                                 siteLeadConversion|null, siteAcceptedConversion|null, sitePaidConversion|null,
                                 siteLeadToAccepted|null, siteAcceptedToPaid|null, quality
crmFunnel.events                 crmLeads, acceptedOrders, paidOrders, cancelledOrders, cancellationEvents,
                                 currentlyCancelledOrders, realizedOrders
crmFunnel.cohorts                leadCohortSize, leadCohortAccepted, leadCohortPaid, acceptedCohortSize,
                                 acceptedCohortPaid, acceptedCohortCancelled,
                                 crmLeadToAccepted|null, crmAcceptedToPaid|null, crmLeadToPaid|null, crmCancellationRate|null
orders                           acceptedOrders, paidOrders, cancelledOrders, currentlyCancelledOrders, realizedOrders,
                                 paidWithoutDate, acceptedAov|null, paidAov|null, headlineAov|null, quality
financials                       currency 'RUB'; contract {orders, contractValue, cogs, grossContribution, cogsReliableOrders};
                                 paid {orders, paidOrderValue, cogs, grossContribution};
                                 realized|null {orders, realizedRevenue, realizedGoodsRevenue, cogs, grossContribution,
                                 salaryAccrued, operatingExpenses, deliveryProfit, netProfit, marginPct|null,
                                 byCategory {photo, tshirt, canvas: {orders, revenue, profit}}};
                                 spend {status: 'UNAVAILABLE_NO_SPEND_DATA', cpl, cpa, cpo, roas, romi: null}; quality
dataQuality                      freshness {lastMetrikaSyncAt|null, metrikaDataAgeSeconds|null, status FRESH|STALE|NO_DATA,
                                 thresholdSeconds 7200}; clientIdCoverageAccepted|null, clientIdCoveragePaid|null,
                                 eligibleAccepted, eligibleDeliveredToMetrika, metrikaMatchCoverage|null,
                                 matchedAcceptedReaches, paidWithoutDate, siteLeadsLegacy, crmGoalsBeforeRollout,
                                 snapshotAvailable, notes[]
comparison|null                  Record<ComparisonKey, {current, previous|null, delta|null, deltaPct|null,
                                 changeKind UP|DOWN|FLAT|NEW|GONE|NA}>
metadata                         timezone, leadSemantics, pageviewSemantics, usersSemantics, aovSemantics,
                                 cutovers{…}, lastMetrikaSyncAt|null, generatedAt
```

Семантика полей — `METRICS_DICTIONARY.md`. Важные для UI договорённости:

- `traffic.periodUsers` — **из снимка периода** (`MetrikaPeriodSnapshot`), `null` если
  снимка нет (`NO_PERIOD_SNAPSHOT`). `sumDailyUsers` — только для подписи «сумма по
  дням», в карточке не показывается как значение.
- `financials.realized.*` — P&L по формуле `ReportsService.buildPnl` (единственная
  формула денег); `null`, если отчёт недоступен (`PNL_UNAVAILABLE`).
- Ratio при нулевом знаменателе — `null`, не `0` (этап 08, `ratios.ts`).
- `siteFunnel` и `crmFunnel` — две разные воронки; сопоставленные заказы
  (`matchedAccepted/matchedPaid`) — только связка Метрика ↔ CRM по ClientID.

## 5.2 `Trend`

```text
period      AnalyticsPeriod
points[]    по одному на каждый календарный день периода (дни без данных — нули):
            {date 'YYYY-MM-DD', visits, pageviews, siteLeads, matchedAccepted, matchedPaid,
             crmLeads, acceptedOrders, paidOrders, realizedRevenue, netProfit, realizedOrders}
quality     {completeness, notes}
```

- `visits/pageviews/siteLeads/matchedAccepted/matchedPaid` — из `MetrikaDailyTraffic`
  и `MetrikaDailyGoal` по дню Метрики.
- `crmLeads/acceptedOrders/paidOrders` — по `deriveOrderLifecycle` (этап 08) и
  календарному дню MSK.
- `realizedRevenue/netProfit/realizedOrders` — `ReportsService.pnlBuckets` (та же
  `buildPnl` на каждый день; заказы бакетятся по `recognitionDate`, расходы/зарплата — по дате).
- Инвариант: сумма `points[*].realizedRevenue` за период = `Overview.financials.realized.realizedRevenue`
  того же периода (проверяется в reconciliation). Для `netProfit` сумма по дням может
  отличаться от итога периода на единицы рублей: `buildPnl` округляет себестоимость фото
  (`ceil` копеек) в каждом бакете — так же ведут себя недельные и месячные разрезы отчёта.
  Итог периода — только `Overview.financials.realized.netProfit`; график подписывает свою
  сумму как «сумма по дням» и объясняет расхождение подсказкой.
- `quality.notes` ⊂ {`INCOMPLETE_LEGACY_SITE_LEADS`, `CRM_GOALS_BEFORE_ROLLOUT`,
  `PERIOD_BEFORE_COUNTER`, `METRIKA_STALE`, `METRIKA_NO_DATA`}.

## 5.3 Срезы Метрики — `Slice<Row>`

`sources`, `utm`, `landings`, `devices`:

```text
period    AnalyticsPeriod
rows[]    Row = MatchedFunnelRates + ключ среза
totals    MatchedFunnelRates по всему периоду
quality   {completeness, notes}

MatchedFunnelRates: visits, siteLeads, matchedAccepted, matchedPaid,
                    visitToLead|null, visitToAccepted|null, visitToPaid|null,
                    leadToAccepted|null, acceptedToPaid|null
SourceRow  + trafficSource, trafficSourceName, sourceEngine, sourceEngineName, pageviews
UtmRow     + utmSource, utmMedium, utmCampaign, utmContent, utmTerm, isNoUtm
LandingRow + normalizedPath
DeviceRow  + deviceCategory ('desktop'|'mobile'|'tablet'|'other')
```

Строки отсортированы по `visits` убыв. (как в `metrics:report slices`). `isNoUtm`
— строка «Без UTM» (все UTM пустые).

## 5.4 Срезы CRM — `CrmSlice<Row>`

`products`: `ProductRow {productCategory PHOTO|TSHIRT|CANVAS, acceptedOrders, paidOrders,
cancelledOrders, contractValue, paidOrderValue, cogs, cogsReliableOrders, grossContribution,
acceptedAov|null, paidAov|null}`.

`sales-channels`: `SalesChannelRow {salesChannel AVITO|OZON|WB|LOCAL, crmLeads,
acceptedOrders, paidOrders, cancelledOrders, contractValue, paidOrderValue,
acceptedAov|null, paidAov|null}`.

Канал продаж (CRM) и источник трафика (Метрика) — **разные измерения** и никогда не
смешиваются в одной таблице.

---

# 6. Кэш

`DashboardCache` (`dashboard-cache.ts`): in-memory, TTL **45 с**, ключ

```text
<kind>:<period.from>:<period.to>:<period.kind>
```

где `kind` ∈ {overview, trend, sources, utm, landings, devices, products, sales-channels}.
Кэшируется promise (параллельные одинаковые запросы считаются один раз); ошибка не
кэшируется (следующий запрос пересчитает). Кэш процесса, не БД; при перезапуске
backend — пустой. `/status` не кэшируется.

Cache key покрывает «period + comparison period» из §33 стадии 09: previousPeriod —
детерминированная функция периода.

---

# 7. Авторизация и ошибки

| Ситуация | Ответ |
|---|---|
| Нет/невалидный JWT | `401` (JwtAuthGuard) |
| Роль не ADMIN | `403` (RolesGuard) |
| Флаг выключен, любой маршрут кроме `/status` | `404 Раздел аналитики выключен` |
| Неверный период | `400` (см. §3) |
| Ошибка сервиса/БД | `500` — панель показывает состояние «Ошибка» с кнопкой «Повторить», не нули |

---

# 8. Флаг и окружение

```text
ANALYTICS_DASHBOARD_ENABLED   true/1/yes/on → включён; иначе выключен (default false)
```

- `docker-compose.prod.yml`: `ANALYTICS_DASHBOARD_ENABLED: ${ANALYTICS_DASHBOARD_ENABLED:-false}`
- `.env.example`: `ANALYTICS_DASHBOARD_ENABLED=false`
- Читается один раз при старте (`dashboardEnabledFromEnv`) через провайдер
  `DASHBOARD_OPTIONS`; смена требует recreate backend.

---

# 9. Frontend

## 9.1 Маршрут и навигация

- Страница: `frontend/src/pages/AnalyticsPage.tsx`, маршрут `/crm/analytics` внутри
  `AdminRoute` (только ADMIN), lazy.
- Меню: группа «Управление», пункт «Аналитика» (`navigation.ts`, roles ADMIN).
- Вкладки через `?tab=`: `overview` (без параметра) · `sources` · `products` · `pages` · `quality`.
- Период хранится в `sessionStorage` (`analytics-period`, хук `usePersistentState`) — живёт
  пока открыта вкладка; по умолчанию `last_7_days`.
- API-клиент: `frontend/src/api/analytics.ts` (`analyticsApi.*`, `periodKey`).
- Загрузка: сначала `/status`; остальное — только при `enabled === true`;
  срезы вкладок — только при открытой вкладке (`react-query`, `staleTime` 45 с).

## 9.2 Названия метрик (UI ← контракт)

Источник подписей и подсказок — `METRICS_DICTIONARY.md`; реализация — `LABELS` в
`frontend/src/features/analytics/analytics-view.ts`.

| Поле контракта | Подпись в UI |
|---|---|
| `traffic.visits` | Визиты |
| `traffic.periodUsers` | Посетители (подпись: «сумма по дням: N (не уникальные)») |
| `siteFunnel.siteLeads` | Заявки сайта |
| `crmFunnel.events.crmLeads` | Заявки в CRM |
| `crmFunnel.events.acceptedOrders` | Принятые заказы |
| `crmFunnel.events.paidOrders` | Оплаты |
| `financials.realized.realizedRevenue` | Выручка |
| `financials.realized.cogs` | Себестоимость |
| `financials.realized.netProfit` | Прибыль |
| `orders.paidAov` | Средний чек |
| `financials.contract.contractValue` | Сумма принятых заказов |
| `financials.paid.paidOrderValue` | Сумма оплаченных заказов |
| `*.grossContribution` | Валовой вклад |
| `siteFunnel.matchedAccepted` | Сопоставленные заказы |
| `siteFunnel.matchedPaid` | Сопоставленные оплаты |
| `siteFunnel.siteLeadConversion` | Конверсия в заявку |
| `siteFunnel.siteAcceptedConversion` | Конверсия в заказ |
| `crmFunnel.cohorts.crmLeadToAccepted` | Заявка → заказ |
| `crmFunnel.cohorts.crmAcceptedToPaid` | Заказ → оплата |
| `dataQuality.clientIdCoverageAccepted` | Покрытие ClientID |
| `contract.cogsReliableOrders / contract.orders` | Полнота себестоимости |
| `dataQuality.paidWithoutDate` | Оплачены без даты |
| `freshness.status` FRESH / STALE / NO_DATA | Актуально / Есть задержка / Нет данных |
| `productCategory` PHOTO / TSHIRT / CANVAS | Фото / Футболки / Холсты |
| `salesChannel` AVITO / OZON / WB / LOCAL | Avito / Ozon / Wildberries / Сайт и прямые |
| `deviceCategory` desktop / mobile / tablet / other | Компьютер / Телефон / Планшет / Другое |
| `UtmRow.isNoUtm` | Без UTM |

Слова «покупка», «продажа с сайта», «конверсия в покупку» в UI не используются
(этап 09 §8): «Оплаты», «Сопоставленные оплаты», «Конверсия в заказ».

## 9.3 Главный экран (Обзор)

```text
Ряд 1: Визиты · Посетители · Заявки сайта · Принятые заказы · Оплаты
Ряд 2: Выручка · Себестоимость · Прибыль · Средний чек
Предупреждения (§9.6) → Карточки «Требует внимания» (§9.7)
Воронка сайта | Воронка CRM   (две отдельные карточки)
Динамика по дням (один показатель за раз)
Деньги подробнее (contract / paid / realized, по категориям)
```

`Посетители` — всегда `periodUsers` из снимка; при `null` — «—» и подпись
«за этот период не подсчитаны». Значение `sumDailyUsers` в карточке не подставляется.

## 9.4 Полярность (что хорошо при росте)

`POLARITY` в `analytics-view.ts`:

```text
higher-good: visits, periodUsers, pageviews, siteLeads, matchedAccepted, matchedPaid, crmLeads,
             acceptedOrders, paidOrders, realizedOrders, contractValue, paidOrderValue,
             realizedRevenue, netProfit, siteLeadConversion, crmLeadToAccepted,
             crmAcceptedToPaid, paidAov
lower-good:  cancelledOrders
neutral:     cogs (без сравнения — контекст)
```

Тон бейджа сравнения: `delta > 0` при higher-good → зелёный, `< 0` → красный;
для lower-good наоборот; `FLAT`/`NA`/`neutral` — серый. Цвет никогда не единственный
носитель смысла: знак и текст дублируют его.

## 9.5 Форматирование (ru-RU)

| Тип | Правило | Примеры |
|---|---|---|
| Деньги | `Intl.NumberFormat('ru-RU')`, до 2 знаков, символ ₽ через неразрывный пробел | `241 100 ₽`, `1 972,71 ₽` |
| Проценты | 2 знака после запятой, ` %` | `57,45 %`, `0 %` |
| Количество | группировка тысяч | `1 042` |
| `null` | `—` | |
| Дельта | `+7 (+20 %)`, `−8 (−100 %)`, `новое (+5)` (NEW), `без изменений` (FLAT), `—` (NA) | |
| Свежесть | `formatAgo(seconds)` — «только что», «12 минут назад», «2 часа назад», «3 дня назад», `null` → «нет данных» | |
| Период | «12 сентября 2026», «6–12 сентября 2026», «1 августа — 12 сентября 2026» | |

## 9.6 Предупреждения (notice) — `overviewWarnings(o)`

| Код | Условие | Текст |
|---|---|---|
| `legacy` | `dataQuality.notes ∋ INCOMPLETE_LEGACY_SITE_LEADS` | Исторические данные о заявках сайта до обновления аналитики (12 сентября 2026, 13:19) неполные |
| `counter` | `∋ PERIOD_BEFORE_COUNTER` | Метрика начала собирать данные с 13 августа 2026 — раньше визитов нет |
| `snapshot` | `∋ NO_PERIOD_SNAPSHOT` | Посетители за этот период пока не подсчитаны — показан прочерк, а не сумма по дням |
| `stale` | `∋ METRIKA_STALE` | Данные Метрики могут быть устаревшими: синхронизация давно не обновлялась |
| `no-data` | `∋ METRIKA_NO_DATA` | Данных Метрики нет: синхронизация ещё не выполнялась |
| `cogs` | `financials.quality.notes ∋ COGS_UNRELIABLE_ORDERS` | У части принятых заказов нет позиций — себестоимость по ним не посчитана |
| `paid-date` | `crmFunnel.quality.notes ∋ PAID_WITHOUT_DATE` | У части оплаченных заказов нет даты оплаты — в «Оплатах» периода их нет |
| `coverage` | `clientIdCoverageAccepted` null или < 50 или `eligibleAccepted = 0` | Данные о связи сайта с заказами пока неполные |
| `comparison-partial` | `comparison ≠ null` и `previousPeriod.from < cutovers.counterDataSince` | Сравнение по трафику неполное: Метрика ещё не собирала данные весь предыдущий период |
| `stale-header` | `freshness.status = STALE` (всегда сверху страницы) | Данные могут быть устаревшими |

`CRM_GOALS_BEFORE_ROLLOUT` и `SNAPSHOT_SAMPLED` отдельным notice не показываются:
первое покрывается «coverage» + подписью воронки, второе — не влияет на числа V1.

Дополнительно в воронке сайта: если `siteLeads > 0` и `eligibleAccepted = 0`, вместо
«0 %» выводится «Недостаточно сопоставленных заказов» (`matchingInsufficient`).
Сравнение по трафику (`visits`, `periodUsers`, `siteLeads`) скрывается, когда
`trafficComparisonPartial(o)` (предыдущий период раньше старта счётчика).

## 9.7 «Требует внимания» — `attentionCards(o)` (без причин, без гипотез)

| Код | Условие | Тон |
|---|---|---|
| `profit-drop` | `comparison.netProfit.changeKind = DOWN` и `deltaPct ≤ −20` | negative |
| `lead-conversion-drop` | `comparison.siteLeadConversion` DOWN и `deltaPct ≤ −20`, и не `matchingInsufficient`, и не `siteLeadsLegacy` | negative |
| `stale` | `freshness.status = STALE` | warning |
| `cogs-incomplete` | `contract.cogsReliableOrders < contract.orders` | warning |
| `coverage-low` | `contract.orders > 0` и `clientIdCoverageAccepted` не null и `< 50` | warning |

## 9.8 График

`TrendChart` — SVG-столбики, один показатель за раз (`TREND_METRICS`: Визиты, Заявки
сайта, Принятые, Оплаты, Выручка, Прибыль); `role="img"`, `aria-label` с названием
показателя и числом дней; переключатель — `role="group"` «Показатель графика».
Пустой период — «За этот период данных нет».

## 9.9 Состояния

- **loading** — `role="status"` «Загрузка…» (скелет, не нули).
- **empty** — «За этот период данных нет».
- **error** — `role="alert"` с текстом ошибки сервера и кнопкой «Повторить»;
  никаких `0` вместо данных.
- **disabled** — карточка «Раздел выключен» (флаг), ссылка на «Отчёты».

## 9.10 Адаптивность и доступность

- Mobile-first: KPI 2 колонки (`grid-cols-2`), md — 3/4, xl — 5; вкладки —
  горизонтальный скролл; таблицы — в `overflow-x-auto`.
- Все интерактивы с клавиатуры (`focus-visible` кольцо), подсказки — `aria-describedby`,
  `aria-current="page"` у активной вкладки.

---

# 10. Тесты

- Backend: `analytics-dashboard.controller.spec.ts` (period parsing, guards/roles metadata,
  404 при выключенном флаге, все маршруты → сервис, TTL кэша, ошибка не кэшируется,
  env-флаг), `metrics-compute.spec.ts` (`computeTrend`), `nginx-routes.spec.ts`
  (`/analytics` проксируется).
- Frontend (vitest + testing-library, `frontend/vitest.config.ts`):
  `analytics-view.test.ts` (форматирование, дельты, полярность, предупреждения,
  attention), `components.test.tsx` (KpiCard NEW/GONE/NA, снимок 131 ≠ 149,
  «Недостаточно сопоставленных заказов» вместо 0 %, свежесть, состояния, TrendChart).

---

# 11. Сверка (reconciliation)

Для любого периода должны совпадать (diff = 0):

```text
GET /analytics/dashboard/overview?preset=P      ==  metrics:report overview --preset P --json
GET /analytics/dashboard/sources|utm|landings|devices|products|sales-channels ==  metrics:report slices …
Overview.financials.realized.{realizedRevenue, netProfit, cogs} == ReportsService P&L за тот же период
sum(Trend.points.realizedRevenue) == Overview.financials.realized.realizedRevenue
```

Минимальный набор из 10 чисел для smoke: visits, periodUsers, siteLeads, crmLeads,
acceptedOrders, paidOrders, realizedRevenue, cogs, netProfit, paidAov.

---

# 11a. Поведение (этап 10) — `/analytics/dashboard/behavior/*`

Те же guards (только ADMIN), тот же флаг `ANALYTICS_DASHBOARD_ENABLED` (выключен → 404, кроме
`behavior/status`), тот же разбор периода и кэш 45 с (ключ `behavior-<kind>:<from>:<to>:<kind периода>`).
Контракт — `crm-new/src/analytics/behavior/behavior-contract.ts` (зеркало `frontend/src/types/behavior.ts`),
правила — `BEHAVIOR_RULES.md`, данные — `BEHAVIOR_DATA_MODEL.md`, события — `BEHAVIOR_EVENT_CONTRACT.md`.

| Путь | Метод сервиса | Ответ |
|---|---|---|
| `GET …/behavior/status` | — | `enabled`, `behaviorGoalsAvailableFrom`, `directionGoalsAvailableFrom`, `minSampleVisits`, `thresholds` |
| `GET …/behavior/summary` | `getSummary` | `BehaviorSummary` — общая воронка, headline (визиты / начали / отправили / заявка / ошибки), разрыв устройств, счётчик карточек, качество |
| `GET …/behavior/funnels` | `getFunnels` | `Funnel[]` — global, photo, tshirt, canvas, contact |
| `GET …/behavior/errors` | `getErrors` | `FormErrors` — итоги, по полям, устройствам, входам |
| `GET …/behavior/pages` | `getPages` | `PagesBehavior` — страницы входа × шаги, порог выборки |
| `GET …/behavior/devices` | `getDevices` | `DevicesBehavior` — шаги, вовлечённость, `gap` |
| `GET …/behavior/paths` | `getPaths` | `PathsBehavior` — агрегаты входов/просмотров/выходов + `dataGap` |
| `GET …/behavior/issues` | `getIssues` | `BehaviorIssues` — карточки FACT / HYPOTHESIS / RECOMMENDATION, `skipped`, `thresholds` |

Единицы шага воронки: `visits` (целевые визиты — канон), `events` (достижения), `users` (посетители
периода из снимка или `null`). Шаг без цели в счётчике — `availability: 'not_measured'` с `note`; период до
даты доступности — `insufficient_data`. UI: вкладка «Поведение» (`?tab=behavior`).

FIX_01 (15.09.2026, feature): у измеренного шага `measuredFrom` (первый день периода, с которого шаг реально
измерен) и `transition: { status: 'comparable' | 'partial', comparableFrom } | null` — сопоставимость с предыдущим
измеренным шагом; при `partial` конверсия шага показывается, но подписана как несравнимая, а правило
`FUNNEL_DROPOFF` молчит. `BehaviorIssues.skipped[]` — `{ rule, code, reason }`, `code ∈ LOW_SAMPLE |
PARTIAL_BEHAVIOR_PERIOD | COMPARISON_UNAVAILABLE | NO_LEADS` (BEHAVIOR_RULES.md «Коды skipped[]»). Поля
добавлены, ничего не удалено — старые клиенты совместимы.

# 12. Чего в V1 нет (намеренно)

- Фильтров по источнику/каналу/товару, комбинированных срезов.
- Spend / CPL / CPA / ROAS / ROMI (`spend.status = UNAVAILABLE_NO_SPEND_DATA`).
- Поведенческих воронок, тепловых карт, session replay, гипотез (этап 10).
- Записи в БД и любых мутаций через API дашборда.
- Live-обращений к Яндекс Метрике.
