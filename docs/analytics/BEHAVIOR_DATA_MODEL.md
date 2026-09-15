# BEHAVIOR_DATA_MODEL.md

# Модель данных поведенческого слоя (этап 10)

## Статус

```text
IMPLEMENTED 14.09.2026 — миграция 20260914200000_metrika_behavior_tables (6 таблиц), пять новых
наборов каталога Reports API, снимок посетителей по целям. Production: не выложено (implementation).
```

Принципы те же, что у этапа 07: только локальные агрегаты Метрики в Postgres, идемпотентная
синхронизация (delete + insert за диапазон в транзакции), журнал `MetrikaSyncRun`, advisory lock,
повтор с `accuracy=full` при выборке, расписание этапа 07 (часовой тик — 3 дня, суточный — 21 день).
Дашборд читает таблицы и к API Яндекса не обращается.

---

# 1. Таблицы

| Таблица | Набор | Зерно | Уникальный ключ | Что хранит |
|---|---|---|---|---|
| `MetrikaDailyBehaviorDevice` | `behaviorDevices` | день × устройство × поведенческая цель | `(date, deviceRaw, goalId)` | `reaches` (события), `goalVisits` (целевые визиты), `convertedUsers` (посетители дня), `goalIdentifier` |
| `MetrikaDailyBehaviorLanding` | `behaviorLandings` | день × страница входа × цель | `(date, landingPath, goalId)` | те же метрики; `normalizedPath` — нижний регистр без параметров и завершающего слэша |
| `MetrikaDailyVisitParam` | `behaviorParams` | день × устройство × ключ × значение параметра визита | `(date, deviceRaw, paramKey, paramValue)` | `visits`, `users`, `paramsNumber` (число параметров ≈ событий) — только ключи белого списка |
| `MetrikaDailyPathPage` | `behaviorPaths` | день × вид × путь | `(date, kind, pagePath)` | `kind`: `entry_lead` (визиты), `viewed_lead` (просмотры), `exit_all`, `exit_nolead` (визиты); `users` |
| `MetrikaDailyDeviceEngagement` | `behaviorEngagement` | день × устройство | `(date, deviceRaw)` | `visits`, `bounces`, `pageviews`, `durationSeconds` — только аддитивные величины |
| `MetrikaPeriodGoalSnapshot` | снимок (не набор) | период × цель | `(periodStart, periodEnd, goalId)` | `users` — посетители периода, достигшие цели; `preset`, `fetchedAt`, `sampled`, `sampleShare` |

Старые таблицы этапов 07–08 не изменены. Поведенческих ClientID, текстов, файлов нет.

---

# 2. Поведенческие цели

`crm-new/src/metrika/analytics/metrika-behavior-goals.ts` — `BEHAVIOR_EVENTS` (14 идентификаторов
JS-событий); номера целей каждый раз находятся через Management API по идентификатору
(`goalEventIdentifier`), как и канонические цели этапа 07. Событие без цели в счётчике просто
отсутствует в наборе — синхронизация не падает, дашборд показывает шаг как «не измеряется».

```text
form_started, lead_submit_attempt, lead_submitted, form_error,
lead_submitted_photo, lead_submitted_canvas, lead_submitted_tshirt,
view_custom_tshirt, choose_size, add_tshirt_lead, submit_tshirt_order_success,
submit_tshirt_order_error, messenger_click, phone_click
```

Чанки по 6 целей: 3 метрики на цель + якорь `ym:s:visits` = 19 ≤ 20.

---

# 3. Запросы Reports API (каталог `metrika-query-catalog.ts`)

| Набор | dimensions | metrics | filters | Запросов |
|---|---|---|---|---|
| `behaviorDevices` | `ym:s:date, ym:s:deviceCategory` | `ym:s:visits` + `goal<id>reaches/visits/users` × ≤ 6 | — | ⌈14/6⌉ = 3 |
| `behaviorLandings` | `ym:s:date, ym:s:startURLPath` | то же | — | 3 |
| `behaviorParams` | `ym:s:date, ym:s:deviceCategory, ym:s:paramsLevel1, ym:s:paramsLevel2` | `ym:s:visits, ym:s:users, ym:s:paramsNumber` | `ym:s:paramsLevel1=.('field','product','form','productSlug','intent','format','size','value','location','channel','kind','topic')` | 1 |
| `behaviorPaths` | `ym:s:date, ym:s:startURLPath` / `ym:pv:date, ym:pv:URLPath` / `ym:s:date, ym:s:endURLPath` ×2 | визиты+посетители / просмотры+посетители | `goal<lead>IsReached=='Yes'` / `=='Yes'` / — / `=='No'` | 4 |
| `behaviorEngagement` | `ym:s:date, ym:s:deviceCategory` | `ym:s:visits, ym:s:bounces, ym:s:pageviews, ym:s:sumVisitDurationSeconds` | — | 1 |
| снимок по целям | — | `ym:s:visits` + `goal<id>users` × 14 | — | 1 на пресет (8) |

Итого на часовой тик расписания: 11 (этап 07) + 12 (этап 10) + 16 (снимки: 8 счётчика + 8 по целям) ≈ 39
запросов; на суточный — столько же за 21 день. Проверено живьём 14.09.2026 (`metrika:sync verify` — 12/12 OK,
`sampled=false`).

`ReportQuery.filters` добавлен в каталог и fetcher; `ym:pv:*` с фильтром `ym:s:goal…IsReached` работает
(проверено), метрики `ym:pv:*` с метриками `ym:s:goal…` — по-прежнему нет (4011).

---

# 4. Семантика единиц

- **events** = `reaches`: достижения цели. У `form_started` (контакты) и `add_tshirt_lead` события
  дублируются на каждый фокус поля — поэтому шаги воронок считаются в визитах.
- **visits** = `goalVisits`: целевые визиты — визит, в котором цель достигнута хотя бы раз. Канон для
  шагов и конверсий; суммируется по дням и разрезам без искажений (визит принадлежит одному устройству
  и одной странице входа).
- **users**: `convertedUsers` за день не суммируются за период; уникальные периода — только
  `MetrikaPeriodGoalSnapshot` (8 пресетов). Для произвольных дат — `null`.
- **параметры визита**: `visits` с параметром `key=value`; при нескольких значениях одного ключа в
  визите он учитывается по разу на значение (шаги `basis=param` подписаны этим примечанием).
- **вовлечённость**: доля отказов = Σbounces / Σvisits, глубина = Σpageviews / Σvisits, длительность =
  ΣdurationSeconds / Σvisits — из аддитивных сумм, не среднее средних.

---

# 5. Сервис и API

`crm-new/src/analytics/behavior/`:

- `behavior-contract.ts` — типы ответа (зеркало во frontend `types/behavior.ts`);
- `behavior-rules.ts` — даты доступности и пороги;
- `behavior-compute.ts` — чистые функции: `computeFunnel`, `computeErrors`, `computePages`,
  `computeDevices`, `computePaths`, `computeIssues`, `computeSummary`;
- `behavior-metrics.service.ts` — 13 `groupBy/aggregate` запросов на период (× 2 периода для сравнения),
  без N+1; собирает `BehaviorInput`;
- `behavior-dashboard.controller.ts` — `GET /analytics/dashboard/behavior/{status,summary,funnels,errors,
  pages,devices,paths,issues}` под `JwtAuthGuard + RolesGuard(ADMIN)`, флагом `ANALYTICS_DASHBOARD_ENABLED`
  и `DashboardCache` (45 с).

Даты доступности: `BEHAVIOR_GOALS_AVAILABLE_FROM = 2026-09-10`, `DIRECTION_GOALS_AVAILABLE_FROM = 2026-09-12`
(BEHAVIOR_EVENT_CONTRACT § 3). Период до даты → `insufficient_data`/`unavailable`; частично — `PARTIAL_BEHAVIOR_PERIOD`;
сравнение только с периодом целиком после даты и с синхронизированными строками. Параметры визита
(`MetrikaDailyVisitParam`) хранятся с начала счётчика (13.08) — у параметр-шагов `availableFrom = null`; переход
«параметр → цель» внутри одного периода сопоставим только при совпадающих окнах измерения (`transition`, FIX_01).

---

# 6. Хранение, retention, объём

Строк в сутки при текущем трафике (~150 визитов): устройства ×14 целей ≈ 40, входы ×14 ≈ 150–300,
параметры ≈ 30–120, пути ≈ 40–80, вовлечённость 3 → ≈ 300–550 строк/сутки (≈ 0,2 МБ/мес). Retention не
ограничен (как у наборов этапа 07); при необходимости — та же политика, что для них.

---

# 7. Что намеренно не хранится

Последовательности событий/страниц внутри визита (Reports API не отдаёт; Logs API — отдельное решение
Reviewer), тексты, файлы, ClientID, параметры вне белого списка, любые PII.
