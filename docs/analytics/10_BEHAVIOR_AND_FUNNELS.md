# 10_BEHAVIOR_AND_FUNNELS.md

## STATUS

`REVIEW` — реализовано 14.09.2026 в `feature/analytics-foundation`: аудит событий
(`BEHAVIOR_EVENT_CONTRACT.md`), пять наборов Метрики и снимок посетителей по целям
(`BEHAVIOR_DATA_MODEL.md`), сервис/API/раздел «Поведение», правила «Требует внимания»
(`BEHAVIOR_RULES.md`); сверка на копии production diff 0 — отчёт § 32. **В production с 15.09.2026
00:22 MSK** (master 80921d9) по `10_PRODUCTION_ROLLOUT.md`: миграция применена, initial sync 13.08–15.09,
сверки на бою diff 0, расписание с 00:31 — 10 тиков SUCCESS (daily + 9 hourly); owner smoke (§ 15 rollout)
ПРОЙДЕН владельцем 15.09.2026 — § 33. FIX_01 (правило 11.1 на несопоставимых окнах измерения) реализован
15.09 (f2db719, § 34) и **выложен в production 15.09 11:26 MSK** (master b04681f) — 12 проверок § 22.3
rollout-документа пройдены, `10_PRODUCTION_ROLLOUT.md` § 23. DONE ставит Reviewer.

## STAGE

**10 — Behavior & Funnels**

## PURPOSE

Построить поверх уже работающей сквозной аналитики отдельный слой поведенческого анализа сайта, который помогает отвечать не только на вопрос «что произошло», но и **на каком шаге пользователь потерялся, на каких страницах/устройствах проблема проявляется сильнее и где есть основание для продуктового вмешательства**.

Этап 10 не должен превращаться в «AI объясняет психологию пользователя». Система обязана строго разделять:

- **FACT** — наблюдаемое измерение;
- **HYPOTHESIS** — возможное объяснение;
- **RECOMMENDATION** — действие для проверки гипотезы.

Нельзя утверждать причинность там, где есть только корреляция.

---

# 1. CURRENT BASELINE

Этап начинается только после закрытия Stage 09.

К началу Stage 10 уже существуют и считаются канонически:

- visits;
- true periodUsers;
- siteLeads;
- matchedAcceptedOrders;
- matchedPaidOrders;
- CRM leads;
- acceptedOrders;
- paidOrders;
- cancellations;
- realizedRevenue;
- COGS;
- netProfit;
- paidAov;
- источники трафика;
- UTM;
- landing pages;
- devices;
- product metrics;
- data quality;
- hourly/daily sync;
- `/crm/analytics`.

Сайт уже отправляет события:

### Общие
- `lead_submitted`
- `form_started`
- `lead_submit_attempt`
- `form_error`
- `phone_click`
- `messenger_click`
- `reviews_source_click`

### T-shirt flow
- catalog view
- product choice
- color choice
- size choice
- print position choice
- mockup/upload related events

### Canvas flow
- image upload
- quality warning
- format choice
- size choice
- edge choice
- submit without photo

Исполнитель обязан сначала провести **полный аудит фактических event names и payload schema из production-кода**, а не опираться только на этот список.

---

# 2. MAIN GOAL

Сделать в analytics слой **поведенческих воронок и проблемных мест**, который позволяет руководителю увидеть:

1. где пользователи начинают действие;
2. какие шаги реально проходят;
3. на каком шаге теряется наибольшая доля;
4. где чаще возникают ошибки;
5. какие страницы и устройства имеют аномально слабую конверсию;
6. какие пути чаще приводят к заявке;
7. какие точки требуют проверки;
8. достаточно ли данных, чтобы делать вывод вообще.

---

# 3. NON-GOALS

На Stage 10 **НЕ ДЕЛАТЬ**:

- автоматические AI-выводы о мотивации пользователей;
- утверждения «пользователю не нравится дизайн»;
- утверждения «цена слишком высокая» без прямых данных;
- session replay engine;
- собственный full Webvisor;
- тепловые карты;
- rage-click detection;
- scroll maps;
- ad spend / ROAS / ROMI;
- A/B testing engine;
- автоматическое изменение сайта;
- Stage 11 experimentation;
- Stage 12 automated insights.

Если для части задач нужны новые события — сначала документировать gap, затем добавить минимально необходимые события.

---

# 4. REQUIRED ANALYTICS MODEL

Нужен канонический behavior слой поверх локальных данных.

Рекомендуемая структура:

- `BehaviorFunnelDefinition`
- `BehaviorFunnelStep`
- `BehaviorFunnelResult`
- `BehaviorIssue`
- `BehaviorSegment`
- `BehaviorEvidence`

Не обязательно создавать именно такие таблицы, если можно корректно вычислять из локальных агрегатов, но API-контракт должен быть стабильным.

---

# 5. FUNNEL TYPES

Минимально должны быть реализованы следующие воронки.

## 5.1 Global lead funnel

Пример:

`visit → form_started → lead_submit_attempt → lead_submitted`

Метрики по каждому шагу:

- entrants;
- nextStepUsers;
- dropoffUsers;
- stepConversionRate;
- cumulativeConversionRate.

Если true unique users на шаге невозможно получить корректно из имеющихся агрегатов — не подменять их event counts. Явно разделить:

- events;
- users;
- visits.

## 5.2 Photo funnel

Построить только по реально существующим событиям photo-flow.

Если событий недостаточно — Stage 10 должен:
1. доказать gap;
2. определить минимальный event contract;
3. добавить события;
4. задокументировать cutover timestamp.

## 5.3 T-shirt configurator funnel

Как минимум показать последовательность ключевых шагов конфигуратора, например:

`catalog/product → color → size → print position → upload/mockup → submit attempt → lead`

Конкретная последовательность определяется после аудита production event model.

## 5.4 Canvas funnel

Пример:

`upload → format → size → edge → submit attempt → lead`

Отдельно учитывать:

- quality warning;
- submit without photo.

---

# 6. FORM ERRORS

Нужен отдельный анализ `form_error`.

Минимальные измерения:

- page;
- form type;
- error type/code;
- device;
- date;
- count;
- affected visits/users, если доступно корректно.

**PII запрещён.**

Не хранить:
- телефон;
- email;
- имя;
- текст пользовательских сообщений;
- содержимое файлов.

Нужно определить top errors:

- по количеству;
- по доле от submit attempts;
- по страницам;
- по устройствам.

---

# 7. PAGE PERFORMANCE

Для страниц/landing pages показывать:

- visits;
- users;
- formStarted;
- leadSubmitted;
- matchedAccepted, если eligibility достаточна;
- lead conversion;
- error rate;
- device split.

Нельзя ранжировать страницу как «плохую» только по низкой конверсии при малом объёме данных.

Обязателен minimum sample threshold.

Рекомендуемый baseline:

- `< 30 visits` → `LOW_SAMPLE`;
- threshold должен быть вынесен в конфигурацию/константу.

---

# 8. DEVICE ANALYSIS

Для:

- desktop;
- mobile;
- tablet;
- other

показывать:

- visits;
- users;
- site leads;
- form starts;
- form errors;
- lead conversion;
- funnel step conversion;
- matched conversion при достаточном coverage.

Система должна уметь выявить факт вида:

> Mobile conversion is materially lower than desktop for selected period.

Но не должна автоматически утверждать причину.

---

# 9. USER PATHS

Нужно построить ограниченный V1 path analysis.

Цель — ответить:

- с какой страницы чаще начинают;
- какие страницы посещают перед lead;
- какие 1–3 шага чаще встречаются перед `lead_submitted`.

Не строить бесконечный graph всех URL.

V1:

- top entry pages;
- top pre-lead pages;
- top last page before lead;
- common short paths up to configurable depth.

Если текущие локальные данные Stage 07 не позволяют восстановить последовательность событий/страниц, это должно быть зафиксировано как **data gap**, а не сфабриковано из агрегатов.

В таком случае Stage 10 допускает добавление минимального session/path event storage, если:
- отсутствует PII;
- есть retention;
- объём контролируем;
- есть ясный use case.

---

# 10. ISSUE DETECTION

Нужен rule-based слой «Требует внимания».

Каждая карточка должна содержать:

### FACT
Например:

> На mobile шаг `form_started → lead_submitted` за 7 дней: 8.2%, desktop: 17.6%.

### HYPOTHESIS
Например:

> Возможна проблема мобильного UX формы.

### RECOMMENDATION
Например:

> Проверить форму на ширине 360–430 px и ошибки `form_error` на mobile.

Гипотеза не считается фактом.

---

# 11. MINIMUM ISSUE RULES

Реализовать минимум:

### 11.1 Large funnel drop-off
Если падение между шагами существенно выше нормы/предыдущего периода.

### 11.2 Device conversion gap
Если mobile/desktop отличаются materially при достаточном sample.

### 11.3 Form error spike
Если ошибки формы выросли относительно comparable period.

### 11.4 Landing underperformance
Страница с достаточным трафиком имеет существенно более низкую lead conversion.

### 11.5 Sudden lead-rate anomaly
Трафик есть, но lead rate резко изменилась.

Каждое правило обязано иметь:

- minimum sample;
- current value;
- baseline/comparison;
- severity;
- evidence;
- no-causality wording.

---

# 12. SEVERITY

Минимально:

- `INFO`
- `ATTENTION`
- `CRITICAL`

Severity должна определяться по прозрачным rule thresholds.

Не использовать LLM для severity на Stage 10.

---

# 13. DATA QUALITY GATES

Поведенческая аналитика должна учитывать:

- Metrika freshness;
- event availability;
- event cutover date;
- ClientID coverage;
- sample size;
- partial historical periods.

Если данных недостаточно:

- показывать `INSUFFICIENT_DATA`;
- не показывать искусственные 0%;
- не создавать issue.

---

# 14. EVENT CONTRACT AUDIT

Перед реализацией executor обязан составить:

`docs/analytics/BEHAVIOR_EVENT_CONTRACT.md`

Для каждого события:

- exact event name;
- где вызывается;
- success/error semantics;
- params;
- PII review;
- first production availability date;
- используется ли сейчас в Metrika;
- можно ли построить funnel step;
- known limitations.

---

# 15. METRIKA DATA SOURCE

Сначала проверить, можно ли получить нужные behavior данные через:

1. текущий Reports API;
2. уже локально сохранённые aggregates;
3. новые безопасные Reports API queries.

Не переходить автоматически на Logs API.

Если Reports API недостаточен для последовательностей/path analysis — зафиксировать это отдельно.

Logs API можно предлагать только как отдельное архитектурное решение с оценкой:

- объёма;
- retention;
- rate limits;
- latency;
- storage;
- privacy.

Не включать Logs API без отдельного reviewer decision.

---

# 16. LOCAL STORAGE

Dashboard не должен зависеть от live Yandex API на каждый запрос.

Если Stage 10 добавляет новые Metrika aggregates:

- локальная Postgres storage;
- idempotent sync;
- scheduler integration;
- locks;
- retry;
- reconciliation;
- refresh window.

Следовать паттернам Stage 07.

---

# 17. API

Добавить read-only endpoints в текущий analytics dashboard API.

Рекомендуемо:

- `GET /analytics/dashboard/behavior/summary`
- `GET /analytics/dashboard/behavior/funnels`
- `GET /analytics/dashboard/behavior/errors`
- `GET /analytics/dashboard/behavior/pages`
- `GET /analytics/dashboard/behavior/devices`
- `GET /analytics/dashboard/behavior/issues`

Все:

- ADMIN only;
- feature flag compatible;
- preset validation;
- no PII;
- no raw secrets;
- no live Metrika API on dashboard request.

---

# 18. DASHBOARD UI

В `/crm/analytics` добавить раздел:

**Поведение**

Минимальные блоки:

### 18.1 Основная воронка
Step funnel с:
- объёмом;
- conversion;
- drop-off.

### 18.2 По направлениям
- Photo
- T-shirt
- Canvas

### 18.3 Ошибки форм
Top errors.

### 18.4 Устройства
Mobile/Desktop comparison.

### 18.5 Страницы
Top / weak pages при достаточном sample.

### 18.6 Требует внимания
Rule-based issue cards.

---

# 19. UI RULES

- ru-RU;
- никаких технических event IDs для руководителя;
- tooltips;
- loading;
- empty;
- error;
- insufficient data;
- stale;
- partial historical.

Не смешивать:

- event count;
- visit count;
- unique users.

Они должны быть явно подписаны.

---

# 20. COMPARISON

Все behavior metrics, где это математически корректно, должны поддерживать comparable period.

Нельзя делать misleading comparison, если:

- предыдущий период до event cutover;
- sample слишком мал;
- данные partial;
- событие тогда ещё не существовало.

---

# 21. CUTOVER

Для каждого нового behavior event/metric фиксировать:

- `availableFrom`;
- production deploy timestamp;
- историческую неполноту.

Dashboard должен учитывать эту дату.

---

# 22. PERFORMANCE

Цели:

- summary <= 3s cold production-like;
- cached <= 200ms;
- no N+1;
- dashboard does not call Metrika live.

---

# 23. TESTS

Обязательно покрыть:

### Backend
- auth;
- preset validation;
- zero denominator;
- insufficient sample;
- cutover;
- partial previous period;
- stale;
- missing events;
- comparison;
- severity thresholds;
- FACT/HYPOTHESIS/RECOMMENDATION contract.

### Funnel
- drop-off;
- zero entrants;
- repeated events;
- user/event distinction;
- out-of-order/duplicate input where applicable.

### UI
- funnel rendering;
- empty;
- error;
- insufficient data;
- mobile;
- issue cards;
- comparison suppressed where invalid.

---

# 24. RECONCILIATION

Нужен production-like reconciliation.

Минимально:

- behavior API = behavior service;
- service = source aggregates;
- selected funnel metrics manually verified for 3 periods;
- error counts match source;
- device totals reconcile where mathematically expected.

Все расхождения должны быть объяснены.

---

# 25. PRIVACY

Особое требование.

Behavior layer НЕ должен собирать PII.

Запрещено сохранять:

- typed text;
- phone;
- email;
- customer name;
- uploaded image content;
- form free text;
- Telegram/Max identifiers.

Можно хранить:

- anonymous ClientID/session id;
- event;
- page path;
- device;
- timestamp;
- technical error code;
- predefined option values where safe.

---

# 26. PRODUCT PRINCIPLE

Цель Stage 10 — не «больше графиков».

После реализации руководитель должен уметь ответить:

> Где сейчас наиболее вероятная потеря клиентов и какие данные это подтверждают?

Если dashboard этого не позволяет — Stage 10 не выполнен.

---

# 27. DOCUMENTATION

Обновить:

- `10_BEHAVIOR_AND_FUNNELS.md`
- `00_MASTER_PLAN.md`
- `01_CURRENT_STATE.md`

Создать:

- `BEHAVIOR_EVENT_CONTRACT.md`

При необходимости:

- `BEHAVIOR_DATA_MODEL.md`
- `BEHAVIOR_RULES.md`

---

# 28. PRODUCTION SAFETY

На implementation этапе production не изменять.

Разрешается:

- read-only production inspection;
- Metrika read-only API probes;
- production-like copy.

Запрещается без отдельного rollout gate:

- deploy;
- env changes;
- migration deploy;
- scheduler enable;
- production event changes.

После implementation report Reviewer отдельно решает production rollout.

---

# 29. EXECUTOR REPORT FORMAT

Исполнитель возвращает:

## RESULT
`READY_FOR_REVIEW / BLOCKED`

## GIT

## EVENT AUDIT

## DATA GAPS

## DATA MODEL

## SYNC

## FUNNELS

## FORM ERRORS

## PAGES

## DEVICES

## PATHS

## ISSUE RULES

## API

## UI

## DATA QUALITY

## TESTS

## PERFORMANCE

## RECONCILIATION

## RESPONSIVE

## PRIVACY

## FILES_CHANGED

## NEW FACTS

## DEVIATIONS

## OPEN ISSUES

---

# 30. DECISION GATE

Stage 10 может быть принят только если:

- event contract фактически проверен;
- funnel semantics прозрачны;
- event counts не выданы за users;
- есть global funnel;
- есть product/direction funnels где данные позволяют;
- form errors анализируются;
- device comparison работает;
- landing/page behavior работает;
- low sample не создаёт ложных выводов;
- issue cards разделяют FACT / HYPOTHESIS / RECOMMENDATION;
- нет причинных утверждений без доказательств;
- исторический cutover учитывается;
- data quality visible;
- no PII;
- dashboard не вызывает live Metrika API;
- API read-only ADMIN;
- тесты зелёные;
- reconciliation принят;
- performance acceptable;
- production не тронут без отдельного разрешения.

---

# 31. FIRST EXECUTOR COMMAND

Передать исполнителю:

> Приступай к Stage 10 строго по `docs/analytics/10_BEHAVIOR_AND_FUNNELS.md`.
>
> Сначала сделай аудит фактического event model сайта и создай `BEHAVIOR_EVENT_CONTRACT.md`. Не считай документацию Stage 04 достаточным доказательством — проверь production code.
>
> Затем определи, какие funnel/error/page/device/path metrics реально можно построить на текущих локальных данных и Reports API. Не придумывай последовательности из агрегатов.
>
> Если данных для path/funnel недостаточно, зафиксируй DATA GAP и предложи минимальное безопасное расширение event/storage model. Не включай Logs API без отдельного Reviewer decision.
>
> Реализуй behavior service, read-only API и раздел «Поведение» в `/crm/analytics`, включая funnel, form errors, devices, pages и rule-based «Требует внимания».
>
> Все выводы разделяй на FACT / HYPOTHESIS / RECOMMENDATION. Никаких причинных утверждений без доказательств.
>
> Production не изменяй. После реализации верни полный EXECUTOR_REPORT по формату Stage 10.

---

# 32. EXECUTOR_REPORT — 14.09.2026

## RESULT

```text
READY_FOR_REVIEW
```

Реализация выполнена и проверена на свежей копии production-базы (`crm_stage10_test`, снята 14.09.2026
23:15 MSK) с живой синхронизацией Reports API (read-only) за 13.08–14.09. Production не изменялся:
ни деплоя, ни env, ни миграции, ни изменений событий сайта. Все read-only проверки боя — Management API
(список целей), Reports API (пробы), чтение таблиц.

## GIT

```text
repo:               racpechatca, ветка feature/analytics-foundation (master не тронут, = be591d3 production)
commits:            85e1be3 docs: ТЗ этапа 10 в репозитории
                    2e49dad feat: аудит событий, наборы Метрики, воронки и правила (backend + миграция)
                    2bcf9b2 feat: раздел «Поведение» в /crm/analytics (frontend)
                    01960ec fix: правило отвала без перехода «визит → первое действие»; мобильная вёрстка; скриншоты
                    + этот коммит: BEHAVIOR_DATA_MODEL.md, BEHAVIOR_RULES.md, каталог, контракт, отчёт, master plan, current state
push:               origin/feature/analytics-foundation
web-photo:          не менялся (аудит по origin/feature/cms-admin = 8a9b33c, production-образ web 14.09 18:20)
```

## EVENT AUDIT

`BEHAVIOR_EVENT_CONTRACT.md` — по production-коду сайта и 21 цели счётчика 111569944 (Management API 14.09 22:29 MSK):

```text
событий в реестре METRIKA_GOALS:            34
вызываются в коде и имеют цель:             14  (form_started, lead_submit_attempt, lead_submitted, form_error,
                                                lead_submitted_photo/canvas/tshirt, view_custom_tshirt, choose_size,
                                                add_tshirt_lead, submit_tshirt_order_success/_error, messenger_click, phone_click)
вызываются, но цели в счётчике нет:         10  (view_tshirt_catalog, view_product, choose_shirt_type, choose_color,
                                                submit_tshirt_order, canvas_format_select, canvas_size_select,
                                                canvas_send_photo_later, reviews_source_click, canvas_upload_click*)
объявлены, но не вызываются:                 9  (select_product, configure_tshirt, choose_print_position, upload_print,
                                                cross_sell_click, canvas_upload_success, canvas_quality_warning,
                                                canvas_edge_select, canvas_extra_open); *canvas_upload_click — в несмонтированном компоненте
без дедупликации (событий > визитов):        form_started у контактов, add_tshirt_lead у футболок/мерча
серверная ошибка без события:                фото, холст, контакты (только у футболок есть submit_tshirt_order_error)
параметры целей:                             sanitizeGoalParams режет name/phone/email/contactValue/comment/note/address;
                                             Метрика хранит их как параметры визита — доступны Reports API
фильтр согласия на cookie:                   счётчик грузится только при accepted — все поведенческие данные по согласившимся
документация этапа 04 vs код:                расхождений в именах нет; шаги «upload/quality/edge/print position» из ТЗ
                                             этапа 10 в коде не существуют
```

## DATA GAPS

```text
G1  9 мёртвых событий → шаги «позиция принта», «загрузка макета/фото», «предупреждение о качестве», «края»
    не измеримы и на сайте не существуют (холст без загрузки). Ничего не добавлять; удалить ключи — задача сайта.
G2  10 событий без целей → нет шагов каталог→карточка и крой/цвет у футболок, попытки отправки у футболок,
    формат→размер у холста. Минимальное расширение: JS-цели в счётчике (владелец): submit_tshirt_order,
    view_product, canvas_size_select. Задним числом не восстановятся — availableFrom = дата создания.
G3  нет события серверной ошибки у фото/холста/контактов → предложение lead_submit_error{product, code} (правка сайта, gate).
G4  дублирующиеся события → единица шага — целевые визиты; события подписаны отдельно.
G5  последовательности страниц/событий в визите Reports API не отдаёт → пути V1 только агрегатами;
    полные пути — Logs API (объём ≈ 150 визитов/1000 просмотров в день, ≈ 5–10 МБ CSV/мес, задержка ≈ сутки,
    retention 90 дней, без URL с etext/ybaip) — только по отдельному решению Reviewer, НЕ включён.
G6  form_error одновременно по product и field не разложить (параметры визита — дерево двух веток) →
    по полям суммарно и по устройствам; по направлениям — через страницу входа визита.
G7  уникальные посетители шага за произвольные даты — нет; для 8 пресетов — снимок (реализовано).
G8  телефоны 08–14.09: 64 визита, 0 начал формы — факт для правила 11.2; причина не установлена.
```

## DATA MODEL

`BEHAVIOR_DATA_MODEL.md`; миграция `20260914200000_metrika_behavior_tables` (сгенерирована `prisma migrate diff`,
применена на копии `migrate deploy` → 78 миграций up to date; на production не применялась):

```text
MetrikaDailyBehaviorDevice    день × устройство × цель      reaches / goalVisits / convertedUsers   uq (date, deviceRaw, goalId)
MetrikaDailyBehaviorLanding   день × страница входа × цель  то же                                   uq (date, landingPath, goalId)
MetrikaDailyVisitParam        день × устройство × ключ × значение (белый список 12 ключей)  visits/users/paramsNumber
MetrikaDailyPathPage          день × kind × путь            visits | pageviews, users               kind: entry_lead/viewed_lead/exit_all/exit_nolead
MetrikaDailyDeviceEngagement  день × устройство             visits, bounces, pageviews, durationSeconds (аддитивные)
MetrikaPeriodGoalSnapshot     период × цель                 users (посетители периода), preset, fetchedAt, sampled
```

Старые таблицы не изменены. PII нет по построению (ключи параметров — только белый список).

## SYNC

```text
каталог:        5 новых наборов в DATASET_SPECS (behaviorDevices, behaviorLandings, behaviorParams, behaviorPaths,
                behaviorEngagement); ReportQuery.filters проброшен через fetcher в getStats
паттерны 07:    delete+insert за диапазон в транзакции, MetrikaSyncRun по набору, advisory lock, accuracy=full при выборке,
                расписание без изменений (все наборы по умолчанию) — новые наборы подхватятся тем же тиком
снимок:         MetrikaPeriodSnapshotService — второй запрос на пресет: ym:s:goal<id>users × 14 (кэш списка целей 10 мин)
запросов/тик:   было 11 + 8 снимков → станет 23 + 16 снимков (≈ 940/сутки при 24 тиках)
live verify:    metrika:sync verify — 12/12 наборов OK, sampled=false (14.09 23:2x MSK)
live sync копии: 13.08–14.09: behaviorDevices 213→994 строк (3 запроса), behaviorLandings 369→1722 (3),
                behaviorParams 348 (1), behaviorPaths 390 (4), behaviorEngagement 71 (1); 13 запросов, 16,3 с, SUCCESS
snapshots копии: 8/8 пресетов, «целей 14» у каждого, 16 запросов; last_7_days users 94 / visits 145
idempotency:    повтор 08–14.09 для behaviorDevices/behaviorParams — SUCCESS, строки заменены (238 / 122), дублей нет
                (уникальные ключи), суммы те же (сверка ниже совпала после повтора)
```

## FUNNELS

`behavior-compute.ts::computeFunnel`; единица шага — целевые визиты, рядом события и посетители (снимок) —
никогда не подменяются.

```text
global   визит → form_started → lead_submit_attempt → lead_submitted                         все шаги — цели
photo    [каталог: not_measured] → начали форму фото (param productSlug) → lead_submitted_photo   basis param + goal
tshirt   view_custom_tshirt → [крой/цвет: not_measured] → choose_size → add_tshirt_lead → [попытка: not_measured] → lead_submitted_tshirt
canvas   взаимодействие с конфигуратором (param product=canvas) → [загрузка: not_measured — на сайте нет] → lead_submitted_canvas
contact  форма контактов (param form=contact) → обращение (param product=contact)
```

Копия, 08–14.09 (реальные): global 145 визитов → 13 (25 событий, 3 посетителя) → 4 → 4; конверсии шагов
8,97 % / 30,77 % / 100 %; tshirt 11 → 2 → 1 → 0; photo 32 → 2; canvas 11 → 0; contact 0 → 0.
Неизмеримые шаги — `availability: not_measured` с причиной, из конверсий исключены; период до 10.09 —
`insufficient_data` / воронка `unavailable`; частичный — `PARTIAL_BEHAVIOR_PERIOD`.

## FORM ERRORS

```text
итоги:          formErrorEvents / formErrorVisits / formStartedVisits / attemptEvents; errorRate = визиты с ошибкой /
                визиты с началом формы; errorsPerAttempt = события ошибок / (попытки + ошибки); серверные — submit_tshirt_order_error
по полям:       параметр визита field → label (Имя, Телефон, Контакт, Согласие, …), events / visits / доля
по устройствам: цель form_error из behaviorDevices; по входам: из behaviorLandings (с порогом выборки)
копия 08–14.09: 3 события / 1 визит; contactValue 3 (75 %), name 1; только компьютер; доля от начавших 7,69 %; серверных 1
PII:            нет — только имя поля (field=name — это поле «Имя», а не имя клиента)
```

## PAGES

Страницы входа × визиты / сумма дневных посетителей (подписана) / начали форму / отправили / заявки / ошибки /
сопоставленные заказы; доли — от визитов страницы; `sample` (< 30 визитов → LOW_SAMPLE) и `leadConversionVsSite`
(п.п.) только при OK. Копия, 7 дней: `/` 105 визитов, 12 начали, 4 заявки (3,81 %, +1,1 п.п. к сайту);
остальные страницы — LOW_SAMPLE.

## DEVICES

Компьютер / телефон / планшет / другое: визиты, начали / отправили / заявки / ошибки, доли, вовлечённость
(отказы, глубина, время — из аддитивных сумм), `gap` (mobile/desktop по конверсии в заявку или доле начала
формы). Копия, 7 дней: компьютер 78 визитов, 13 начали (16,67 %), 4 заявки (5,13 %), отказы 5,13 %, глубина 8,7,
5 мин 55 с; телефон 64 визита, 0 начали, 0 заявок, отказы 6,25 %, глубина 3,3, 2 мин 04 с → gap COMPARABLE, ratio 0.
Формулировка в UI — наблюдение, «причина по данным не установлена».

## PATHS

V1 агрегаты (Reports API): вход визитов с заявкой, страницы, просмотренные в визитах с заявкой (просмотры),
выход визитов без заявки и всех. Копия, 7 дней: вход заявок — `/` 4/4; просмотры в визитах с заявкой —
`/` 84, `/catalog/foto-10x15-s-polyami` 19, `/catalog/foto-10x15-bez-polej` 15, `/futbolki/svoy-print` 15;
выход без заявки — `/` 72, `/catalog/foto-10x15-bez-polej` 13, `/interer/holst` 12. Последовательности — DATA GAP G5,
текст gap отдаётся в ответе и показывается в UI.

## ISSUE RULES

`BEHAVIOR_RULES.md`; 5 правил, пороги в `behavior-rules.ts`, severity INFO / ATTENTION / CRITICAL по порогам, без LLM:

```text
11.1 FUNNEL_DROPOFF          вход ≥ 20 визитов; отвал ≥ 90 % → ATTENTION; падение конверсии шага ≥ 15 п.п. → CRITICAL;
                             переход «визит → первое действие» не считается отвалом
11.2 DEVICE_GAP              оба устройства ≥ 30 визитов; mobile/desktop ≤ 0,5 → ATTENTION, ≤ 0,25 или 0 → CRITICAL
11.3 FORM_ERROR_SPIKE        ≥ 5 визитов с ошибкой; ×2 к сопоставимому периоду → ATTENTION, ×3 → CRITICAL;
                             или ≥ 30 % от начавших при ≥ 10 начавших
11.4 LANDING_UNDERPERFORMANCE visits ≥ 30, ожидаемых заявок ≥ 3, конверсия ≤ 50 % средней → ATTENTION
11.5 LEAD_RATE_ANOMALY       оба периода ≥ 30 визитов, сопоставимы, ≥ 3 заявок; |Δ| ≥ 50 % → ATTENTION (падение) / INFO (рост)
```

Каждая карточка: `fact` (только числа), `hypothesis` («Возможно…», без причинности), `recommendation` (что проверить),
`evidence[]` с `sample`/`minSample`, `causality: 'NOT_ESTABLISHED'`; правила без вывода — в `skipped[]` с причиной.
Копия, 7 дней: DEVICE_GAP CRITICAL (телефоны 0 % при 64 визитах vs компьютеры 5,13 %), FUNNEL_DROPOFF ATTENTION
(фото: 32 → 2, отвал 93,8 %); пропущено 7 правил с причинами. 30 дней: + отвал в воронке футболок.

## API

```text
GET /analytics/dashboard/behavior/status | summary | funnels | errors | pages | devices | paths | issues
guards:      JwtAuthGuard + RolesGuard(ADMIN) — копия: без токена 401, EXECUTOR 403 (включая /status), ADMIN 200
flag:        ANALYTICS_DASHBOARD_ENABLED (тот же) — выключен → 404 «Раздел аналитики выключен» (кроме /status)
period:      ?preset= | ?from&to (≤ 366 дней) — bogus → 400, > 366 дней → 400 (копия)
cache:       DashboardCache 45 с, ключи behavior-<kind>:… не пересекаются с ключами этапа 09
PII/secrets: в ответах только агрегаты; live Metrika API с запроса дашборда не вызывается
```

## UI

Вкладка «Поведение» (`/crm/analytics?tab=behavior`): сводка (визиты → начали → отправили → заявка, ошибки,
число карточек), предупреждения качества, «Требует внимания» (Факт / Гипотеза / Что проверить, «причина не
установлена», список пропущенных правил), общая воронка (3 единицы подписаны и объяснены подсказками, полосы,
конверсия и отвал шага, дельта визитов при сопоставимом периоде), направления (фото / футболки / холсты /
контакты, неизмеримые шаги — текстом), ошибки форм (итоги, поля, устройства, входы), устройства (таблица +
вовлечённость + текст разрыва), страницы входа (порог выборки, «к среднему», «Показать все»), пути-агрегаты
с текстом gap. Состояния: загрузка (по блокам, страница не блокируется), пусто («поведенческих данных нет»),
ошибка блока с «Повторить», `not_measured`, `LOW_SAMPLE`, stale/partial предупреждения. ru-RU, без ID событий
для руководителя (идентификаторы — только в подсказках и контракте).

## DATA QUALITY

```text
freshness:        lastMetrikaSyncAt как в этапе 08 (FRESH/STALE/NO_DATA → заметки)
availability:     BEHAVIOR_GOALS_AVAILABLE_FROM = 2026-09-10; DIRECTION_GOALS_AVAILABLE_FROM = 2026-09-12;
                  период до → PERIOD_BEFORE_* (unavailable, шаги insufficient_data); частично → PARTIAL_BEHAVIOR_PERIOD
sync gate:        behaviorRows = 0 за период → BEHAVIOR_NOT_SYNCED (unavailable — «нет данных», не нули)
sample:           < 30 визитов → LOW_SAMPLE; 0 → INSUFFICIENT_DATA; правила молчат
snapshot:         нет снимка периода → NO_PERIOD_GOAL_SNAPSHOT, users = null
comparison:       предыдущий период до даты доступности или без строк → COMPARISON_UNAVAILABLE, дельт нет
```

## TESTS

```text
backend:   CRM 955 tests / 86 suites (было 912): metrika-behavior-datasets.spec 10, behavior-compute.spec 26
           (три единицы, повторные события, нулевые входы, снимок null, not_measured, param-шаги, cutover, partial,
           comparison, stale, not synced, ошибки, страницы, устройства/gap, пути, 5 правил + пороги + контракт карточки,
           сводка), behavior-dashboard.controller.spec 6 (guards/ADMIN, status, 404 флаг, маршруты, 400, кэш),
           period-snapshot.spec +1 (снимок по целям), sync.service.spec обновлён (12 наборов); nginx-routes зелёный
frontend:  vitest 30 (было 21): behavior.test.tsx 9 — единицы подписаны, not_measured текстом, посетители «—»,
           период до целей → «нет данных», карточка Факт/Гипотеза/Что проверить + «Причина не установлена»,
           пропущенные правила, пустое/загрузка, ошибки форм (доли, поля, пусто), устройства (текст разрыва,
           INSUFFICIENT_DATA), behaviorWarnings без дублей
build:     nest build OK; frontend tsc -b && vite build OK; prettier/eslint новых файлов чистые
```

## PERFORMANCE

```text
где:            копия через SSH-туннель к боевому Postgres (RTT ≈ 40–60 мс на запрос) — верхняя оценка
service:        loadInput = 13 groupBy/aggregate на период (+ 13 на предыдущий для сравнения), без N+1
HTTP холодный:  summary 1,0–2,1 с; funnels 0,7–1,6 с; errors 0,8–1,1 с; pages 0,4–1,0 с; devices 0,3–0,7 с;
                paths 0,4–0,9 с; issues 0,6–1,1 с (три периода)
HTTP кэш:       summary повторно 86–322 мс (в основном 86–144 мс)
ожидание на бою (локальная БД, как этап 09: 4,3 с через туннель → 1,4 с в контейнере): summary ≲ 0,5 с холодный
dashboard не вызывает live Metrika API: подтверждено кодом (только Prisma) и отсутствием запросов клиента при HTTP
```

## RECONCILIATION

Копия `crm_stage10_test`, A = HTTP `/analytics/dashboard/behavior/*` (ADMIN), B = `BehaviorMetricsService`
(та же сборка), C = независимый SQL по таблицам-источникам (`MetrikaDailyGoal`, `MetrikaDailyTraffic`,
`MetrikaDailyBehaviorDevice/Landing`, `MetrikaDailyDevice/Landing`, `MetrikaDailyVisitParam`,
`MetrikaDailyDeviceEngagement`, `MetrikaDailyPathPage`, `MetrikaPeriodGoalSnapshot`):

```text
period         A vs B (все листья JSON 7 маршрутов)   A vs C (метрики)   device totals
today          797 листьев, diffs 0                    25 / 25 = 0        Σ по устройствам = итог (визиты 13, начали 0)
last_7_days    1037 листьев, diffs 0                   31 / 31 = 0        визиты 145 = 145; начали 13 = 13
last_30_days   1352 листьев, diffs 0                   31 / 31 = 0        визиты 589 = 589; начали 13 = 13
```

Проверенные вручную числа (7 дней): visits 145; form_started 13 визитов / 25 событий / 3 посетителя (снимок);
attempt 4; lead 4 (1 посетитель); form_error 1 визит / 3 события; по полям contactValue 3, name 1; компьютер
78 визитов / 13 начали / 4 заявки, телефон 64 / 0 / 0, планшет 3; `/` 105 визитов / 12 начали; отказы компьютер
5,128 %, телефон 6,25 %; выход без заявки `/` 72, `/catalog/foto-10x15-bez-polej` 13. Расхождений нет; после
повторной синхронизации (idempotency) сверка совпала повторно.

## RESPONSIVE

Desktop 1440: сетки 2 колонки для направлений и блоков ошибок/путей; таблицы в overflow-контейнерах.
Mobile 390 (Chrome mobile emulation): KPI по 2 в ряд, таблицы скроллятся внутри карточек, `scrollWidth ==
clientWidth` (после исправления `min-w-0` у колонок сетки — до него 577 px). Скриншоты —
`docs/analytics/screenshots/10_behavior/` (loading, desktop 7d/30d, период до целей, mobile 7d, блоки issues /
funnel / errors / devices) — данные копии production, не фикстуры.

## PRIVACY

Локально: дата, устройство, путь страницы, идентификатор цели, ключ/значение параметра из белого списка
(`field, product, form, productSlug, intent, format, size, value, location, channel, kind, topic`), счётчики.
Не хранится и не запрашивается: ClientID, тексты, телефоны, e-mail, имена, файлы, Telegram/MAX. Проверено
по фактическим ключам параметров счётчика за 08–14.09 (19 ключей, все технические) и по `sanitizeGoalParams`.

## FILES_CHANGED

```text
crm-new/prisma/schema.prisma                                         +6 моделей
crm-new/prisma/migrations/20260914200000_metrika_behavior_tables     new
crm-new/src/metrika/analytics/metrika-behavior-goals.ts               new — BEHAVIOR_EVENTS, behaviorGoals, белый список параметров
crm-new/src/metrika/analytics/metrika-query-catalog.ts                +5 наборов, filters, типы строк
crm-new/src/metrika/analytics/metrika-report-fetcher.ts               filters → getStats
crm-new/src/metrika/analytics/metrika-sync-store.ts                   replaceRows для 5 таблиц
crm-new/src/metrika/analytics/metrika-analytics-inspect.ts            состояние/качество по новым таблицам
crm-new/src/metrika/analytics/metrika-period-snapshot.service.ts      снимок посетителей по целям
crm-new/src/metrika/analytics/*.spec.ts                               обновлены/добавлены (datasets, snapshot, sync)
crm-new/src/analytics/metrika-sync.ts                                 вывод «целей N» у снимков
crm-new/src/analytics/behavior/{behavior-contract,behavior-rules,behavior-compute,behavior-metrics.service,
  behavior-dashboard.controller,behavior.module}.ts + 2 spec           new
crm-new/src/app.module.ts                                             + BehaviorModule
frontend/src/types/behavior.ts, frontend/src/types/analytics.ts (Freshness)  new / export
frontend/src/api/analytics.ts                                         + behaviorApi
frontend/src/features/analytics/{behavior-view.ts,behavior-sections.tsx}  new
frontend/src/features/analytics/__tests__/behavior.test.tsx           new
frontend/src/pages/AnalyticsPage.tsx                                  вкладка «Поведение»
docs/analytics/{BEHAVIOR_EVENT_CONTRACT,BEHAVIOR_DATA_MODEL,BEHAVIOR_RULES}.md  new
docs/analytics/{METRIKA_QUERY_CATALOG,DASHBOARD_CONTRACT,10_BEHAVIOR_AND_FUNNELS,00_MASTER_PLAN,01_CURRENT_STATE}.md
docs/analytics/screenshots/10_behavior/*.png                          9 скриншотов
```

## NEW FACTS

- Метрика хранит параметры `reachGoal` как параметры визита и записывает их даже для событий **без цели**
  (`format`, `size`, `value` есть в счётчике при отсутствии целей) — поэтому шаги «формат/размер холста» и
  «начали форму фото/контактов» измеримы через параметры, хотя целей нет.
- Фильтр `ym:s:goal<id>IsReached` работает с измерениями `ym:pv:*` — можно считать просмотры страниц внутри
  визитов с заявкой; метрики `ym:pv` с метриками `ym:s:goal` — по-прежнему нельзя.
- `ym:s:bounces` и `ym:s:sumVisitDurationSeconds` существуют — вовлечённость хранится аддитивно и агрегируется точно.
- Бой 08–14.09: 145 визитов, 94 посетителя; форму начали в 13 визитах (3 посетителя), отправили 4, заявок 4 —
  все на компьютерах; на телефонах 64 визита и 0 начатых форм; ошибок формы 1 визит (3 события, поле
  «Контакт»); футболки: 11 открыли конструктор, 2 выбрали размер, 1 дошёл до формы, 0 заявок, 1 серверная ошибка.
- 21 цель в счётчике: 14 поведенческих + 4 CRM + авто-цели «отправка формы» (602325854, с 26.08, 85 достижений),
  «переход в мессенджер» (608401685), URL `/thanks` (602316919, 76 достижений с 30.08) — исторические прокси.
- Даты доступности: JS-цели серии 6113794xx–6113863xx — первые достижения 10–11.09; цели направлений и form_error — 12.09.
- Доля визитов с началом формы (≈ 9 %) — не «отвал»: правило 11.1 намеренно не считает первый переход.

## DEVIATIONS

```text
1. § 5.2/5.4 (photo/canvas funnels): шаги «каталог», «загрузка», «предупреждение о качестве», «края», «позиция
   принта» не реализованы — событий нет в production-коде (G1); показаны как not_measured, не как 0.
2. § 9 (paths): последовательности не строятся — Reports API их не отдаёт (G5); V1 — агрегаты входа/просмотров/
   выхода; Logs API не включён (нужно решение Reviewer).
3. § 7/8 (users на страницах и устройствах): показана сумма дневных посетителей с подписью, не уникальные периода —
   уникальные по разрезам потребовали бы отдельных снимков на каждый разрез.
4. § 17: добавлен /behavior/status (даты доступности, пороги) — панель показывает их в подсказках.
5. § 22 (performance): измерено через туннель (summary 1,0–2,1 с холодный, кэш 86–322 мс); прямой замер на бою
   невозможен без выкладки.
6. Белый список параметров расширен на form и productSlug — без них не определить начало формы контактов и фото.
```

## OPEN ISSUES

```text
1. Production rollout — отдельный документ и gate (миграция 20260914200000 применится на старте контейнера;
   scheduler подхватит наборы автоматически; +12 запросов к Reports API на тик и +8 на снимки; первый тик после
   деплоя заполнит 3 дня, суточный — 21 день; историю 13.08–09.09 при желании добить CLI `metrika:sync --from … --to … --dataset …`).
2. Решения владельца/Reviewer по gap: создать цели submit_tshirt_order, view_product, canvas_size_select (G2);
   событие серверной ошибки для фото/холста/контактов (G3); дедупликация form_started/add_tshirt_lead на сайте (G4);
   Logs API для путей (G5) — по отдельной оценке.
3. Копия crm_stage10_test удалена после отчёта; временные пользователи stage10_admin/stage10_executor были только в копии.
4. Наблюдение из данных (не вывод): на телефонах за 08–14.09 ни одного начала формы при 64 визитах — правило 11.2
   выдаёт CRITICAL; гипотезы (форма/страница на мобильных, состав трафика, доля согласия на cookie по устройствам)
   требуют ручной проверки; данных о согласии по устройствам нет.
5. Security debt без изменений (ротация токена/секрета Яндекса).
```

---

# 33. PRODUCTION ROLLOUT — 15.09.2026

Выполнен по `10_PRODUCTION_ROLLOUT.md` (команда «СТАРТ» 14.09 23:5x, продолжение с § 4 после NEEDS_FIX по маршруту
`/analytics` на домене raspechatkaa.ru — исправлено 15.09 00:01, § 18.14 отчёта этапа 09). Полный
`EXECUTOR_REPORT_PRODUCTION_ROLLOUT` — `10_PRODUCTION_ROLLOUT.md` § 21. Ключевое:

```text
master be591d3 → 80921d9 (ff, 00:18:31 MSK); backend d8c9dd7313da (00:21:33–00:22:06), frontend 844bb9f8704a
(00:22:11–00:22:44); миграция 20260914200000 применена на старте контейнера (78 applied, только CREATE);
initial sync 13.08–15.09 из контейнера при выключенном расписании: 994 / 1722 / 348 / 390 / 71 строк, снимки целей
8/8 × 14 = 112; сверки на бою: HTTP = service (702 / 1015 / 1332 листьев, diff 0), HTTP = SQL (9 / 31 / 31, diff 0);
privacy — только ключи белого списка, PII нет; perf — summary 25 SQL, HTTP 61–249 мс, кэш 9–20 мс;
расписание включено 00:31:41 — тики 00:33 (daily) и 01:31–09:31 (9 hourly) SUCCESS, дублей 0, overlap 0;
Stage 06 (outbox 8) и Stage 09 (recon diff 0, P&L август = /reports/monthly) без регресса.
Бой 09–15.09: 116 визитов → 13 начали форму (25 событий, 3 посетителя) → 4 отправили → 4 заявки — все на
компьютерах; телефоны 51 визит / 0 начатых форм → DEVICE_GAP CRITICAL как наблюдение.
```

DEVIATION к правилу 11.1 (для решения Reviewer): в окнах, начинающихся до 12.09, воронки photo/canvas сравнивают шаг
«по параметрам визита» (данные с 13.08) с целью направления (с 12.09) — карточка FUNNEL_DROPOFF за 30 дней
(«117 → 2, отвал 98,3 %») структурно завышена; воронка несёт `PARTIAL_BEHAVIOR_PERIOD`, но карточка об этом не
говорит. Предложение FIX_01: считать param-шаги направлений только с даты доступности цели направления и/или не
создавать FUNNEL_DROPOFF при `PARTIAL_BEHAVIOR_PERIOD`. Без решения смещение исчезает само: 7 дней — с 19.09,
30 дней — с 12.10. Код в ходе rollout не менялся.

Owner smoke — § 15 `10_PRODUCTION_ROLLOUT.md` (`https://raspechatkaa.ru/crm/analytics` → «Поведение»): **ПРОЙДЕН**
владельцем 15.09.2026 (~10:34 MSK, «OWNER SMOKE STAGE 10 ПРОЙДЕН») — зафиксировано в § 21.16 rollout-документа.
Production после включения расписания (00:31) не менялся. Открыты только решения Reviewer: verdict DONE и FIX_01.

---

# 34. FIX_01 — PARTIAL PERIOD FUNNEL DROPOFF (15.09.2026)

Задание Reviewer: не создавать `FUNNEL_DROPOFF`, если сравниваемые шаги воронки имеют несовместимые периоды
доступности данных; числа и пороги не подгонять; историю не превращать в 0; причину подавления вернуть в
`issues`; после наступления сопоставимого периода правило должно включаться само; через метаданные шагов, не
hardcode. Выполнено на `feature/analytics-foundation`; production не тронут.

## ROOT_CAUSE

```text
Правило 11.1 считало отвал между соседними измеренными шагами, не проверяя, что оба шага измерены за один и тот же
отрезок периода. У воронок photo/canvas первый шаг — параметр визита (productSlug / product=canvas): параметры
reachGoal записываются в Метрику независимо от целей, поэтому в MetrikaDailyVisitParam они есть с начала счётчика
(13.08; на бою до 10.09 — 108 визитов с productSlug). Второй шаг — цель направления, созданная 12.09. За 30 дней
(17.08–15.09) отношение 2 / 118 сравнивало 4 дня цели с 30 днями параметра — математически верно по хранимым
строкам, аналитически несопоставимо. Дополнительно метаданные параметр-шагов утверждали availableFrom = 10.09,
хотя данные шага старше, — окно шага в контракте описывалось неверно. У футболок тот же дефект на переходе
add_tshirt_lead (10.09) → lead_submitted_tshirt (12.09).
```

## IMPLEMENTATION

```text
crm-new/src/analytics/behavior/behavior-contract.ts
  FunnelStep.measuredFrom: string | null — первый день периода, с которого шаг реально измерен (max(period.from, availableFrom))
  FunnelStep.transition: StepTransition | null — { status: 'comparable' | 'partial', comparableFrom } к предыдущему измеренному шагу
  BehaviorIssues.skipped: SkippedRule[] = { rule, code: SkipCode, reason }; SkipCode = LOW_SAMPLE | PARTIAL_BEHAVIOR_PERIOD |
  COMPARISON_UNAVAILABLE | NO_LEADS
crm-new/src/analytics/behavior/behavior-compute.ts
  measuredFrom(availableFrom, period); transitionOf(prev, step, period): окна совпадают → comparable, иначе partial;
  comparableFrom = поздняя из дат доступности двух шагов (null, если обе null)
  FUNNEL_DEFS: параметр-шаги (photo form_started_photo, canvas canvas_interaction, contact contact_form / contact_lead) —
  availableFrom: null (с начала счётчика) вместо 2026-09-10; goal-шаги без изменений (10.09 / 12.09)
  computeFunnel: заполняет measuredFrom и transition; числа, conversions, not_measured, insufficient_data — без изменений
  computeIssues 11.1: переход с transition.status === 'partial' пропускается ДО проверки входа ≥ 20 и порогов; в skipped[]
  — код PARTIAL_BEHAVIOR_PERIOD и текст «<воронка>: «A» → «B» — шаги измерены с разных дат (ДД.ММ.ГГГГ и ДД.ММ.ГГГГ),
  конверсия шага несопоставима; правило вернётся для периодов, начинающихся не раньше ДД.ММ.ГГГГ». Переход «визит →
  первое действие» по-прежнему не оценивается. Пороги (90 %, 15 п.п., 20 входов) не тронуты.
  Остальные пропуски получили коды: DEVICE_GAP / FORM_ERROR_SPIKE / LANDING (нет страниц) — LOW_SAMPLE; LANDING (нет заявок)
  — NO_LEADS; LEAD_RATE_ANOMALY — COMPARISON_UNAVAILABLE (нет сопоставимого периода) или LOW_SAMPLE (< 30 визитов).
frontend/src/types/behavior.ts — зеркало контракта
frontend/src/features/analytics/behavior-view.ts — SKIP_CODE_LABELS, partialTransitionText()
frontend/src/features/analytics/behavior-sections.tsx — у шага с partial: доля серым + строка «окна измерения не совпадают —
  доля не сравнивается» с подсказкой (даты обоих шагов, с какого начала периода сопоставимо); список пропущенных правил
  переименован в «Правила без вывода (мало данных или несопоставимые периоды)», у каждого пункта — подпись кода
Автоматический возврат: transition считается от period.from и availableFrom при каждом запросе — для 7 дней правило по
photo/canvas/tshirt вернётся с 19.09 (окно 12–18.09 → 13–19.09), для 30 дней — с 12.10; переключателей нет.
```

## TESTS

```text
CRM (jest): 960 / 960, 86 suites (было 955) — behavior-compute.spec.ts +5:
  • «30 дней сейчас»: боевые числа 117 → 2 (photo) и 20 → 0 (canvas) на 17.08–15.09 — в воронке числа те же
    (117, 2; stepConversion 1,71 %), PARTIAL_BEHAVIOR_PERIOD, transition partial / comparableFrom 2026-09-12;
    FUNNEL_DROPOFF нет; skipped PARTIAL для Фотопечать / Футболки / Холсты с датами «17.08.2026 и 12.09.2026»;
    catalog и canvas_upload остаются not_measured с visits null; DEVICE_GAP по-прежнему CRITICAL
  • «период целиком после дат доступности» (19–25.09, те же числа): transition comparable, карточка photo 28 → 2
    ATTENTION появляется сама, PARTIAL-пропусков нет
  • «искусственная воронка ≥ 90 %»: photo 40 → 2 на 12–18.09 — карточка; те же числа на 11–17.09 — карточки нет,
    причина «(11.09.2026 и 12.09.2026) … не раньше 12.09.2026» (граница даты)
  • «одинаковые даты доступности»: общая воронка 40 → 2 на 05–11.09 — окна совпадают (обе цели с 10.09), правило
    работает и на частичном периоде; переход «визит → начали форму» помечен partial, но 11.1 его не оценивает
  • measuredFrom / transitionOf: max(period.from, availableFrom), null-даты, comparableFrom
  Обновлены: «на боевых данных недели» (08–14.09) — карточки photo больше нет, 3 PARTIAL-пропуска с текстом;
  «малая выборка» — все коды из допустимого множества; LEAD_RATE_ANOMALY без сопоставимого периода —
  COMPARISON_UNAVAILABLE. Регресс DEVICE_GAP / FORM_ERROR_SPIKE / LANDING_UNDERPERFORMANCE / LEAD_RATE_ANOMALY —
  прежние тесты зелёные без правок ожиданий по этим правилам.
Панель (vitest): 30 / 30 — фикстуры с measuredFrom/transition/code; FunnelCard показывает пометку у partial-перехода и
  не показывает у comparable; IssuesBlock показывает код «несопоставимые окна измерения» и текст причины.
Build: nest build OK; tsc -b && vite build OK. Lint: eslint src/analytics (без правила prettier) — в behavior/ 0
  проблем (7 прежних no-unnecessary-type-assertion в backfill/metrika-orders — вне этапа); prettier --check
  (end-of-line auto) behavior/*.ts — чисто; frontend eslint src/features/analytics src/types src/api — 0 проблем
  (19 проблем репозитория вне аналитики — как на HEAD).
```

## BEFORE / AFTER (production-данные 15.09 ~10:57 MSK, read-only через туннель; before = сборка HEAD 4d5a027, after = f2db719)

```text
period        BEFORE (код production)                                        AFTER (FIX_01)
today         issues 0, skipped 9 (все < порогов)                              issues 0, skipped 9 [LOW_SAMPLE]
last_7_days   DEVICE_GAP CRITICAL (52 / 64 визитов, 0 % vs 7,8 %);             DEVICE_GAP CRITICAL — без изменений;
09–15.09      FUNNEL_DROPOFF photo 26 → 2 (ATTENTION)                          FUNNEL_DROPOFF нет; skipped [PARTIAL_BEHAVIOR_PERIOD]:
                                                                               Фотопечать (09.09 и 12.09), Футболки (10.09 и 12.09),
                                                                               Холсты (09.09 и 12.09) — «не раньше 12.09.2026»
last_30_days  DEVICE_GAP CRITICAL (281 / 295, 0 % vs 1,7 %);                   DEVICE_GAP CRITICAL — без изменений;
17.08–15.09   FUNNEL_DROPOFF photo 118 → 2; FUNNEL_DROPOFF canvas 20 → 0       FUNNEL_DROPOFF нет; skipped [PARTIAL]: Фотопечать
                                                                               (17.08 и 12.09), Футболки (10.09 и 12.09), Холсты (17.08 и 12.09)
воронки       photo 118 → 2, canvas 20 → 0, tshirt 12 → 2 → 1 → 0 (PARTIAL)   те же числа; у шага-цели transition partial (from 12.09);
                                                                               not_measured — не 0; PARTIAL_BEHAVIOR_PERIOD сохранён
LEAD_RATE     skipped «< 30 визитов или предыдущий период до целей»            skipped [COMPARISON_UNAVAILABLE] с точной причиной
```

## REGRESSION

```text
DEVICE_GAP — те же карточки и severity на 7д/30д (см. выше) и в тестах; FORM_ERROR_SPIKE — тесты ×2/×3 и «< 5» без
изменений; LANDING_UNDERPERFORMANCE — тест ≤ 50 % без изменений, пропуски получили коды; LEAD_RATE_ANOMALY — падение /
рост / несопоставимость без изменений. Воронки: числа, stepConversion, cumulativeConversion, dropoff, not_measured,
insufficient_data, comparison — идентичны (изменились только новые поля и availableFrom параметр-шагов 10.09 → null).
Панель: FunnelCard / FormErrorsBlock / DevicesBlock / IssuesBlock тесты зелёные. Попутно (отдельный коммит be7a282):
пять таблиц раздела «Поведение» вкладывали <table> внутрь <table> обёртки TableWrap (невалидный DOM, предупреждение
React в тестах) — внутренние <table> убраны, разметка как в разделах этапа 09; тесты/сборка зелёные.
```

## GIT

```text
feature/analytics-foundation: f2db719 fix(FIX_01) — 7 файлов (+479 / −45): behavior-contract.ts, behavior-compute.ts,
behavior-compute.spec.ts, frontend types/behavior.ts, behavior-view.ts, behavior-sections.tsx, __tests__/behavior.test.tsx;
be7a282 fix(панель) — вложенные таблицы; e24afb9 — документация FIX_01 (этот раздел, BEHAVIOR_RULES.md,
BEHAVIOR_EVENT_CONTRACT.md § 3, DASHBOARD_CONTRACT.md § 11a, BEHAVIOR_DATA_MODEL.md, 10_PRODUCTION_ROLLOUT.md § 21,
00_MASTER_PLAN.md, 01_CURRENT_STATE.md). master = 80921d9 — не менялся.
```

## PRODUCTION_UNTOUCHED

```text
Ни одного изменения на сервере: master 80921d9, контейнеры backend d8c9dd7313da / frontend 844bb9f8704a, .env и compose
не редактировались, деплоя не было (auto-update.log после 00:28 — пусто). Для BEFORE/AFTER выполнялись только SELECT
production-агрегатов через SSH-туннель с рабочей станции (пароль БД — в переменных процесса, в выводе редактируется);
туннель закрыт. Production API по-прежнему отдаёт карточки photo/canvas до выкладки FIX_01 — отдельный gate.
```

## READY_FOR_REVIEW

```text
FIX_01 = READY_FOR_REVIEW → выложен в production 15.09.2026 11:20–11:26 MSK по команде «СТАРТ — Stage 10 FIX_01
production rollout» (10_PRODUCTION_ROLLOUT.md § 22 план, § 23 отчёт): master = b04681f, миграций/env нет, BEFORE = AFTER
по числам воронок, FUNNEL_DROPOFF photo/canvas/tshirt на 7д/30д заменён на skipped PARTIAL_BEHAVIOR_PERIOD, DEVICE_GAP
без изменений, Stage 06/09 без регресса, тики SUCCESS. Verdict — Reviewer.
```
