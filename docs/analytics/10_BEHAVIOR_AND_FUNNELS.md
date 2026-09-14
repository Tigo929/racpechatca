# 10_BEHAVIOR_AND_FUNNELS.md

## STATUS

`TODO`

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
