# 12_AUTOMATED_INSIGHTS — автоматические выводы и приоритизация сигналов

## 0. STATUS

`READY_FOR_IMPLEMENTATION`

Reviewer принимает Stage 11 как закрытый:

- `11_GROWTH_AND_EXPERIMENTS = DONE`
- `11_PRODUCTION_ROLLOUT = DONE`
- production master на момент закрытия Stage 11: `5922175`

Stage 12 выполняется **только в feature-ветке** до отдельного production-rollout gate. Production, `.env`, compose, миграции production, `web-photo`, event model, Yandex Logs API и CI сайта на implementation-этапе не менять.

---

## 1. ЦЕЛЬ ЭТАПА

Построить слой автоматических аналитических сигналов поверх уже принятых Stage 07–11, который регулярно отвечает менеджеру:

1. **Что фактически изменилось?**
2. **Насколько сигнал заслуживает внимания?**
3. **Какие известные факторы могут объяснять или искажать наблюдение?**
4. **Что имеет смысл проверить дальше?**
5. **Каких выводов делать нельзя из имеющихся данных?**

Stage 12 — не «AI, который угадывает причины». Это детерминированный аналитический движок с прозрачными правилами.

Ключевой контракт каждого insight:

`FACT → HYPOTHESIS → RECOMMENDATION`

где:

- `FACT` — только вычислимый и проверяемый факт из данных;
- `HYPOTHESIS` — возможное объяснение, явно маркированное как гипотеза;
- `RECOMMENDATION` — безопасное следующее действие для проверки/наблюдения;
- ни одна гипотеза не должна превращаться в утверждение о причине.

---

## 2. НЕ ЦЕЛИ STAGE 12

Не реализовывать:

- LLM-генерацию бизнес-выводов;
- автоматическое изменение сайта;
- автоматическое изменение рекламных кампаний;
- автоматическое изменение цен;
- автоматический запуск A/B-тестов;
- психологические объяснения поведения посетителей;
- персональные рекомендации по конкретному клиенту;
- Logs API;
- сырые пользовательские сессии;
- PII;
- новые browser events;
- variant assignment;
- прогнозирование будущей выручки как факта;
- «аномалии» без явной формулы и baseline;
- причинные формулировки вроде «из-за», «благодаря», «это привело к».

Stage 12 только обнаруживает и объясняет **наблюдаемые сигналы** в рамках существующих агрегатов.

---

## 3. ИСТОЧНИКИ ДАННЫХ — ТОЛЬКО ПРИНЯТЫЕ СЛОИ

Переиспользовать существующие сервисы/контракты. Не создавать параллельные формулы KPI.

### 3.1 Stage 07

Локальные агрегаты Метрики:

- `MetrikaDailyTraffic`
- `MetrikaDailyGoal`
- `MetrikaDailySource`
- `MetrikaDailyUtm`
- `MetrikaDailyLanding`
- `MetrikaDailyDevice`
- `MetrikaDailyPage`
- поведенческие наборы Stage 10
- `MetrikaSyncRun`
- `MetrikaPeriodSnapshot`

### 3.2 Stage 08

Использовать канонические метрики через `AnalyticsMetricsService`:

- visits;
- periodUsers, если существует корректный snapshot;
- siteLeads;
- CRM lifecycle;
- acceptedOrders;
- paidOrders;
- financials;
- ClientID coverage;
- COGS completeness;
- freshness/quality flags.

Нельзя самостоятельно переопределять paid/accepted/P&L.

### 3.3 Stage 09

Переиспользовать dashboard/trend/slice contracts, где это возможно.

### 3.4 Stage 10

Переиспользовать:

- behavior funnels;
- errors;
- devices;
- pages/landings;
- paths в доступной агрегированной форме;
- `availableFrom`;
- `measuredFrom`;
- `transition`;
- `comparable()`;
- `not_measured`;
- `PARTIAL_BEHAVIOR_PERIOD`;
- существующие issue rules.

Stage 10 issues не дублировать. Stage 12 может агрегировать/приоритизировать их и связывать с другими фактами.

### 3.5 Stage 11

Переиспользовать:

- `AnalyticsChange`;
- `AnalyticsChangeEvaluation`;
- observational before/after contract;
- maturity;
- MDE/sample-size logic;
- overlapping changes;
- confounders;
- measurement-definition cutovers;
- `INCOMPARABLE`;
- `INSUFFICIENT_DATA`;
- `IMMATURE`;
- `SHORT_WINDOW`;
- `WEEKDAY_MIX_MISMATCH`;
- `NO_VARIANT_ASSIGNMENT`;
- `causality: NOT_ESTABLISHED`.

Нельзя создавать упрощённую вторую реализацию статистики Stage 11.

---

## 4. ОСНОВНОЙ ПРИНЦИП: СИГНАЛ ≠ ПРИЧИНА

Каждый insight обязан содержать:

```ts
{
  fact: {...},
  hypothesis: {...},
  recommendation: {...},
  evidence: {...},
  limitations: [...],
  causality: 'NOT_ESTABLISHED'
}
```

### 4.1 FACT

Факт должен быть воспроизводимым числом/событием.

Допустимо:

> За последние 7 полных дней доля заявок составила 4.1%, в предыдущем сопоставимом окне — 7.0%.

Недопустимо:

> Пользователи стали хуже воспринимать форму.

### 4.2 HYPOTHESIS

Гипотеза — только потенциальное объяснение, поддерживаемое доступными сопутствующими фактами.

Пример:

> Гипотеза: изменение может быть связано со сдвигом структуры источников — доля рекламного трафика изменилась на 19 п.п.

Нельзя:

> Причина падения — реклама.

Если данных для осмысленной гипотезы нет:

`hypothesis.status = 'NO_SUPPORTED_HYPOTHESIS'`.

Система **не обязана придумывать гипотезу для каждого сигнала**.

### 4.3 RECOMMENDATION

Рекомендация должна быть следующим аналитическим/операционным действием, а не автоматическим бизнес-решением.

Допустимо:

- проверить источник с наибольшим сдвигом;
- дождаться созревания paid cohort;
- собрать ещё N визитов;
- проверить форму на мобильном устройстве;
- зарегистрировать изменение в Stage 11 перед следующей правкой;
- проверить техническую ошибку, если вырос `form_error`.

Недопустимо автоматически:

- отключить рекламу;
- увеличить бюджет;
- удалить страницу;
- поменять цену;
- откатить сайт.

---

## 5. DATA QUALITY GATE — ДО ЛЮБОГО INSIGHT

Insight не создаётся как обычный actionable signal, если нарушен критический quality gate.

Проверять минимум:

1. freshness;
2. последний успешный sync;
3. наличие метрики;
4. `availableFrom`;
5. сопоставимость окон;
6. measurement-definition cutovers;
7. sample size;
8. maturity;
9. ClientID coverage для matched metrics;
10. COGS completeness для profit-related metrics;
11. overlapping changes;
12. partial period;
13. период до начала данных Метрики;
14. период до production cutover `12.09.2026 13:19 MSK` для новых lead semantics;
15. известный incident boundary `14.09.2026 18:20 → 15.09.2026 20:32 MSK` там, где он влияет на трактовку.

### 5.1 Quality insight

Если проблема качества сама заслуживает внимания, допускается отдельный insight типа `DATA_QUALITY`.

Например:

> FACT: ClientID coverage принятых заказов = 7%.
>
> HYPOTHESIS: NO_SUPPORTED_HYPOTHESIS.
>
> RECOMMENDATION: не использовать matched site→order conversion как основной KPI до роста покрытия.

Это лучше, чем молча скрывать проблему.

---

## 6. INSIGHT CATEGORIES V1

Обязательные категории:

```text
TRAFFIC_CHANGE
SITE_CONVERSION_CHANGE
FUNNEL_DROPOFF
FORM_ERROR_CHANGE
DEVICE_GAP
SOURCE_MIX_SHIFT
SOURCE_PERFORMANCE_CHANGE
LANDING_CHANGE
PRODUCT_CHANGE
CRM_CONVERSION_CHANGE
REVENUE_CHANGE
PROFIT_CHANGE
CHANGE_EVALUATION
DATA_QUALITY
```

Допускается расширение только если оно основано на реальном существующем metric contract.

---

## 7. BASELINE И ПЕРИОДЫ

### 7.1 По умолчанию

Автоматический daily insight run сравнивает **полные московские дни**.

Основные окна:

- последние 7 полных дней vs предыдущие 7;
- последние 28 полных дней vs предыдущие 28 — только если история доступна и сопоставима.

Сегодняшний неполный день не использовать для обычных trend verdicts.

### 7.2 День недели

Для коротких окон обязателен одинаковый weekday mix.

Если mix различается:

- либо выбрать корректные равные окна;
- либо пометить `WEEKDAY_MIX_MISMATCH`;
- не повышать такой сигнал до сильного actionable verdict.

### 7.3 История Метрики

Фактические локальные данные начинаются с `13.08.2026`.

Нельзя сравнивать период с отсутствующей историей как с нулём.

### 7.4 Unique users

Для произвольного окна unique users использовать только существующий/корректно созданный `MetrikaPeriodSnapshot`.

Никогда:

`periodUsers = SUM(dailyUsers)`.

Если snapshot отсутствует и insight не требует users — использовать visits.

Если users принципиальны — `INSUFFICIENT_DATA`/quality limitation либо корректное snapshot-refresh по принятому Stage 11 механизму.

---

## 8. SIGNAL DETECTION

Нельзя создавать insight только потому, что число изменилось.

Каждый detector должен иметь:

- metric;
- current value;
- baseline value;
- absolute delta;
- relative delta, если определён;
- denominator/sample;
- minimum sample;
- materiality threshold;
- statistical/uncertainty information, если применимо;
- quality gates;
- polarity;
- evidence refs;
- suppression/dedupe policy.

### 8.1 Не копировать Stage 11

Для метрик, где Stage 11 уже умеет корректно оценивать изменение, использовать его statistical primitives/services.

### 8.2 Low traffic

При текущем масштабе проекта небольшие проценты не должны создавать шум.

Пример:

`2 → 3 leads` не должен автоматически превращаться в «конверсия выросла на 50%».

Если статистическая/практическая определённость недостаточна:

`INSUFFICIENT_DATA`.

Такой результат может храниться как evaluation evidence, но по умолчанию не должен занимать верх actionable feed.

### 8.3 MDE

Для conversion/rate insights использовать MDE logic Stage 11.

Если данных недостаточно для обнаружения практического эффекта, явно сообщать:

- текущий MDE;
- целевой detectable effect;
- ориентировочную требуемую выборку.

---

## 9. MATERIALITY

Статистическая необычность сама по себе не равна бизнес-важности.

Ввести отдельное понятие:

```text
statisticalStrength
businessMateriality
```

Не объединять их в непрозрачный magic score.

### 9.1 Business materiality examples

Для money metrics учитывать абсолютную разницу ₽.

Для rate metrics — изменение п.п. + denominator.

Для errors — число затронутых visits/forms, а не только %.

Пороговые значения вынести в один конфиг (`insight-rules.ts` или эквивалент), документировать и покрыть тестами.

Reviewer должен видеть все V1 thresholds в документации.

---

## 10. PRIORITY / SEVERITY

Разрешённые уровни:

```text
INFO
ATTENTION
CRITICAL
```

Severity — **не оценка причины и не бизнес-приказ**.

Она показывает только срочность проверки.

Пример логики:

### INFO

- интересное наблюдение;
- качество данных;
- недостаточная выборка, но полезный контекст;
- завершившееся Stage 11 evaluation.

### ATTENTION

- материальный отрицательный сигнал;
- прошёл sample/quality gates;
- заслуживает ручной проверки.

### CRITICAL

Только для ограниченного набора ситуаций, например:

- почти полное исчезновение lead events при достаточном трафике;
- резкий подтверждённый рост технических form errors;
- критическая stale/sync failure;
- сильный production funnel break.

`CRITICAL` нельзя присваивать просто из-за большого относительного процента на малой выборке.

---

## 11. POLARITY

Переиспользовать/расширить Stage 09 metric polarity map.

Примеры:

- visits: contextual / usually higher is not automatically better;
- siteLeadRate: higher better;
- formErrorRate: lower better;
- accepted conversion: higher better;
- cancellation: lower better;
- revenue: higher better;
- COGS alone: contextual;
- netProfit: higher better;
- ClientID coverage: higher better;
- stale age: lower better.

Не делать вывод «traffic down = bad» без контекста результата.

---

## 12. CROSS-METRIC CONTEXT

Stage 12 должен быть полезнее простого списка алертов.

Когда основной сигнал найден, собрать **контекст**, но не объявлять его причиной.

Пример:

Основной факт:

> Site lead rate снизился.

Контекст:

- visits;
- form starts;
- form errors;
- device mix;
- source mix;
- landing mix;
- registered site changes;
- data-quality flags.

На основании контекста допускается сформировать гипотезу:

> Одновременно выросла доля mobile и mobile lead rate ниже desktop; это возможный фактор, но причинность не установлена.

Если одновременно менялись несколько факторов — перечислить их, а не выбрать один «главный» без доказательств.

---

## 13. TRAFFIC / SOURCE INSIGHTS

### 13.1 Traffic

Detect:

- material visit change;
- disappearance/appearance of traffic;
- unusual source mix shift.

Не считать traffic growth автоматически положительным.

### 13.2 Canonical source

Использовать Metrika source dimensions, не `sourceOrder`.

### 13.3 UTM

UTM анализировать отдельно.

Отсутствие UTM ≠ direct traffic.

### 13.4 SOURCE_MIX_SHIFT

Переиспользовать Stage 11 mix-shift logic там, где возможно.

Показывать изменение доли в п.п.

Не писать:

> Конверсия упала из-за Директа.

Допустимо:

> Одновременно доля рекламного трафика выросла с X% до Y%; это возможный confounder.

---

## 14. SITE CONVERSION / FUNNEL

Использовать site funnel отдельно от CRM funnel.

Никогда не строить:

`total CRM paid / Metrika visits`.

### 14.1 Site funnel

Доступные шаги Stage 10 и их реальные measurement contracts.

Missing step = `not_measured`, не 0.

### 14.2 Funnel dropoff

Переиспользовать исправленную Stage 10 comparable-window logic.

Если переход `partial`:

- не создавать обычный FUNNEL_DROPOFF insight;
- limitation `PARTIAL_BEHAVIOR_PERIOD`.

### 14.3 Site lead semantics

Учитывать cutover `12.09.2026 13:19 Europe/Moscow`.

Периоды с несовместимой семантикой не сравнивать как одинаковую метрику.

---

## 15. FORM ERRORS

Сигнал должен учитывать:

- error events;
- affected visits/forms;
- baseline;
- страницу/форму;
- device, если доступно;
- sample.

Нельзя создавать CRITICAL на `0 → 1` ошибке.

Если одновременно lead rate падает и form errors materially растут, гипотеза допустима только в форме:

> Рост технических ошибок совпал по времени со снижением завершения формы; стоит проверить форму. Причинность не установлена.

---

## 16. DEVICE / LANDING / PAGE

### 16.1 Device

Переиспользовать Stage 10 device gap logic.

Не дублировать одинаковый DEVICE_GAP одновременно в Stage 10 и Stage 12 feed: Stage 12 должен ссылаться/агрегировать существующий issue либо создать canonical insight с source=`STAGE10_RULE`.

### 16.2 Landing

Минимальный sample по умолчанию не ниже принятого Stage 10 baseline (`<30 visits = LOW_SAMPLE`), если Reviewer не утвердит другое значение.

### 16.3 Page

Pageviews не подменять visits.

Учитывать различие `ym:s:pageviews` и `ym:pv:pageviews`, принятое Stage 08.

---

## 17. CRM INSIGHTS

CRM funnel анализируется отдельно:

`CRM leads → accepted → paid`.

### 17.1 Cohort semantics

Использовать lifecycle/cohort definitions Stage 08/11.

### 17.2 Maturity

Paid/revenue/profit outcomes не оценивать окончательно до maturity.

Если cohort immature:

`IMMATURE`.

Не писать «продажи упали», пока послеокно ещё не успело оплатиться.

### 17.3 Offline / messenger orders

CRM totals включают не только заявки сайта.

Поэтому изменение CRM accepted/revenue нельзя автоматически приписывать изменению сайта.

---

## 18. MONEY INSIGHTS

Переиспользовать существующий P&L.

Обязательные понятия не смешивать:

- contractValue;
- paidOrderValue;
- realizedRevenue;
- COGS;
- grossContribution;
- netProfit.

### 18.1 Profit quality

Если COGS incomplete — profit insight не должен выглядеть точным.

### 18.2 Revenue/profit causality

Даже значимое изменение прибыли — факт бизнеса, но не доказанный результат конкретного site change без корректной Stage 11 evaluation.

---

## 19. STAGE 11 CHANGE EVALUATIONS AS INSIGHTS

Stage 12 должен автоматически поднимать новые/обновлённые оценки Stage 11 в общий feed.

Например:

```text
CHANGE_EVALUATION
FACT: оценка изменения X обновилась до версии 12.
INTERPRETATION: INSUFFICIENT_DATA / INCOMPARABLE / IMMATURE / ...
RECOMMENDATION: дождаться N / проверить confounder / данных достаточно для ручного решения.
```

Не переинтерпретировать Stage 11 verdict.

Если Stage 11 говорит `INCOMPARABLE`, Stage 12 не может сделать `POSITIVE` по тем же данным.

---

## 20. INSIGHT LIFECYCLE

Нужна стабильная сущность, чтобы feed не создавал одинаковую карточку каждый час.

Предлагаемый статус:

```text
OPEN
ACKNOWLEDGED
RESOLVED
SUPERSEDED
```

`ACKNOWLEDGED` — пользователь увидел/принял к сведению; это не означает исправление.

`RESOLVED` — условие сигнала больше не выполняется либо закрыто вручную с причиной.

`SUPERSEDED` — более новая версия того же сигнала заменила старую.

Не реализовывать destructive deletion истории.

---

## 21. DATA MODEL

Исполнитель должен сначала проверить существующую схему и предложить минимальную модель.

Ожидаемый минимум — аналог:

### AnalyticsInsight

- id UUID
- fingerprint unique
- category
- severity
- status
- scope
- metricKey nullable
- entityKey nullable
- periodStart DATE
- periodEnd DATE
- baselineStart DATE nullable
- baselineEnd DATE nullable
- fact JSONB
- hypothesis JSONB
- recommendation JSONB
- evidence JSONB
- limitations JSONB
- quality JSONB
- causality
- firstDetectedAt
- lastDetectedAt
- resolvedAt nullable
- acknowledgedAt nullable
- latestVersion
- createdAt
- updatedAt

### AnalyticsInsightVersion

- id UUID
- insightId FK
- version
- immutable payload JSONB
- generatedAt
- syncRunId nullable
- unique(insightId, version)

Допустима другая нормализация, если она лучше вписывается в существующую архитектуру.

### 21.1 Требования

- migration additive only;
- immutable versions;
- stable fingerprint;
- никакого PII;
- никакого хранения OAuth/token;
- никакого raw user-level payload.

---

## 22. FINGERPRINT / DEDUPE

Один и тот же сигнал не должен появляться каждый hourly tick как новая карточка.

Fingerprint должен зависеть минимум от:

- category;
- metric;
- scope/entity;
- detector/rule identity.

Период не должен автоматически создавать совершенно новую сущность каждый час, если это продолжающийся один сигнал.

При изменении evidence:

- новая immutable version;
- `lastDetectedAt` обновляется;
- карточка остаётся той же.

Если условие перестало выполняться — resolve policy.

Если потом возникает заново после meaningful clear interval — определить и документировать reopen/new-episode policy.

---

## 23. SUPPRESSION / NOISE CONTROL

Это критично при малом трафике.

Обязательные механизмы:

1. low sample suppression;
2. insufficient-data suppression;
3. duplicate suppression;
4. cooldown;
5. no hourly version churn без meaningful data change;
6. partial/incomparable suppression;
7. maturity suppression;
8. max active insights per detector/entity;
9. prioritization without hiding data-quality warnings.

### 23.1 Meaningful change

Новая version не создаётся, если payload фактически не изменился после очередного sync.

Сравнение должно быть deterministic/canonical, без timestamp noise.

---

## 24. AUTOMATIC SCHEDULE

Переиспользовать Stage 07 after-sync architecture.

### 24.1 Frequency

Не нужно генерировать полный insight set каждый час без причины.

Предпочтительная схема:

- hourly after successful sync: refresh только detectors, которым нужен свежий rolling state;
- daily после появления нового полного Moscow day: полный insight run;
- Stage 11 change evaluation update — по его существующему lifecycle/hook.

Исполнитель должен измерить фактическую стоимость и выбрать минимальный безопасный режим.

### 24.2 Lock

Обязателен lock / защита от overlap.

### 24.3 Failure isolation

Ошибка insight engine не должна ломать:

- Metrika sync;
- Stage 06 order worker;
- dashboard;
- CRM.

---

## 25. RULE ENGINE

Все V1 правила должны быть кодом/конфигом, а не prompt'ом.

Пример интерфейса:

```ts
interface InsightDetector {
  id: string;
  evaluate(context: InsightContext): Promise<DetectedInsight[]>;
}
```

Каждый detector:

- deterministic;
- unit-testable;
- documented;
- versionable;
- имеет явные thresholds;
- возвращает evidence и suppression reason.

---

## 26. SUPPRESSION REASONS

Минимальный словарь:

```text
LOW_SAMPLE
INSUFFICIENT_DATA
IMMATURE
INCOMPARABLE_PERIODS
PARTIAL_BEHAVIOR_PERIOD
METRIC_NOT_AVAILABLE
MEASUREMENT_DEFINITION_CHANGED
WEEKDAY_MIX_MISMATCH
MATCHED_COVERAGE_LOW
COGS_INCOMPLETE
STALE_DATA
DUPLICATE
COOLDOWN
NO_MATERIAL_CHANGE
```

Suppressed detector result должен быть диагностируемым Reviewer/quality endpoint, но не обязательно показываться менеджеру в основном feed.

---

## 27. HYPOTHESIS GENERATOR V1 — ТОЛЬКО RULE-BASED

Никакого LLM.

Гипотезы строятся только из проверяемых concurrent facts.

Примеры разрешённых связок:

### Conversion down + device mix shift

FACT:
- lead rate снизился;
- mobile share вырос materially;
- mobile lead rate ниже desktop при достаточном sample.

HYPOTHESIS:
> Сдвиг структуры устройств может быть одним из факторов наблюдаемой разницы.

### Conversion down + form errors up

> Рост ошибок формы совпал по времени со снижением завершения формы; техническое состояние формы стоит проверить.

### Traffic down + source disappeared

> Снижение визитов совпало с уменьшением/исчезновением источника X.

### Profit down + volume stable

Если COGS complete и revenue/volume context поддерживает:

> При сопоставимом объёме заказов снизился net profit; стоит проверить структуру выручки и затрат.

Нельзя автоматически выбирать психологические объяснения:

- «цена отпугивает»;
- «дизайн не нравится»;
- «клиенты не доверяют»;
- «CTA слабый».

Для них нет данных.

---

## 28. RECOMMENDATION GENERATOR V1

Тоже rule-based.

Рекомендация должна соответствовать evidence.

Примеры:

- `LOW_SAMPLE` → дождаться ориентировочной выборки;
- `FORM_ERROR_CHANGE` → технически проверить форму/логи приложения;
- `DEVICE_GAP` → вручную проверить flow на проблемном device;
- `SOURCE_MIX_SHIFT` → сравнить источник и качество трафика;
- `IMMATURE` → повторить оценку после maturity date;
- `OVERLAPPING_CHANGE` → не делать вывод до чистого окна;
- `DATA_QUALITY` → восстановить/повысить качество данных;
- Stage 11 evaluation → использовать recommendation Stage 11, не придумывать другую.

---

## 29. API

Read-only manager API + минимальные lifecycle actions.

Предлагаемый namespace:

`/analytics/dashboard/insights/*`

Минимум:

```text
GET /status
GET /feed
GET /:id
GET /:id/versions
GET /quality
POST /:id/acknowledge
POST /:id/resolve   // только если ручное закрытие действительно нужно по принятой модели
```

Если ручной resolve создаёт лишнюю сложность, разрешено оставить V1 только `acknowledge`, а resolve делать автоматически — deviation обосновать.

### 29.1 Auth

Только ADMIN, аналогично Stage 09–11.

### 29.2 Feature flag

Отдельный:

`ANALYTICS_INSIGHTS_ENABLED=false`

Не использовать общий dashboard flag как единственный gate.

При OFF:

- status может вернуть `enabled:false`;
- feed/data endpoints не должны раскрывать insight data;
- scheduler hook не подключается.

Учесть урок Stage 11: если ValidationPipe выполняется раньше flag check и даёт 400 вместо 404 для невалидного body, определить контракт заранее и покрыть тестом; не оставлять случайным поведением.

---

## 30. UI — «Инсайты»

Добавить отдельный раздел в `/crm/analytics`.

Цель — не ещё одна таблица KPI, а очередь того, что требует внимания.

### 30.1 Карточка insight

Обязательно показать:

- severity;
- category;
- период;
- FACT;
- HYPOTHESIS;
- RECOMMENDATION;
- ограничения;
- качество данных;
- когда впервые/последний раз обнаружено;
- статус;
- ссылку/переход к связанному блоку аналитики, если возможно.

### 30.2 Визуальная иерархия

FACT должен визуально отличаться от HYPOTHESIS.

Гипотеза никогда не должна выглядеть как установленный факт.

### 30.3 Feed filters

Минимум:

- active/all;
- severity;
- category.

Не делать сложный BI-конструктор.

### 30.4 Empty state

Если actionable insights нет:

> «Сейчас нет сигналов, требующих внимания».

Не писать «всё хорошо» — отсутствие сигнала не доказывает отсутствие проблем.

### 30.5 Suppressed/quality diagnostics

Можно отдельным блоком показать количество правил, которые не дали вывод из-за sample/maturity/quality, без перегрузки основного feed.

---

## 31. PRIORITY FEED

Сортировка должна быть deterministic.

Рекомендуемый порядок:

1. CRITICAL data/technical break;
2. CRITICAL business signal;
3. ATTENTION;
4. INFO;
5. newest/lastDetectedAt внутри уровня.

Не создавать opaque numeric «AI score».

Если нужен tie-break score — он должен быть техническим и полностью документированным, но UI не должен выдавать его за вероятность важности.

---

## 32. KNOWN CURRENT SCALE

На старте Stage 12 трафик низкий.

Исторически в районе implementation Stage 10/11 наблюдалось порядка десятков визитов в день, а site leads — единицы.

Поэтому engine должен быть **тихим по умолчанию**.

Нормальная ситуация: в feed 0–3 действительно полезных сигнала, а не десятки карточек с процентами.

Тестовая фикстура обязана проверить, что `2 → 3`, `0 → 1` и похожие изменения на малых denominators не создают громких actionable insights.

---

## 33. HISTORICAL / CUTOVER RULES

Обязательные известные границы:

- Metrika local history: с 13.08.2026;
- canonical new browser event semantics production cutover: 12.09.2026 13:19 MSK;
- directional goals имеют собственные `availableFrom`;
- production rollback incident: 14.09.2026 18:20 → 15.09.2026 20:32 MSK — использовать как известный confounder/change boundary там, где релевантно;
- старые browser `purchase` до cutover нельзя использовать как корректную оплату.

Не размазывать эти даты hardcode по detectors. Должен быть единый metadata/availability contract.

---

## 34. CHANGE-AWARE INSIGHTS

Если период insight пересекается с зарегистрированным `AnalyticsChange`:

- указать change как контекст;
- не приписывать ему автоматически сигнал;
- если есть Stage 11 evaluation — ссылаться на её verdict;
- если evaluation `INCOMPARABLE`/`IMMATURE`/`INSUFFICIENT_DATA`, insight не может обойти этот gate.

Если несколько изменений пересекаются:

`OVERLAPPING_CHANGE` limitation.

---

## 35. DATA QUALITY INSIGHTS

Минимум предусмотреть detectors:

### 35.1 STALE_ANALYTICS

Если sync действительно просрочен относительно ожидаемого расписания.

### 35.2 CLIENT_ID_COVERAGE_LOW

Не дублировать каждый день новую карточку; одна ongoing episode.

### 35.3 COGS_INCOMPLETE

Только если materially влияет на анализ прибыли.

### 35.4 PAID_WITHOUT_DATE

Использовать уже существующий quality metric.

### 35.5 EVENT_NOT_MEASURED

Не создавать десяток карточек на каждый intentionally missing Stage 10 step. Лучше агрегированный data-gap insight, если он действительно мешает конкретному анализу.

---

## 36. RELIABILITY

Stage 12 не должен становиться критической зависимостью CRM.

Требования:

- insight failure isolated;
- scheduler errors recorded;
- retries только там, где безопасно;
- no unbounded loops;
- bounded query count;
- no N+1;
- DB transactions для version/state update;
- concurrent run protection;
- idempotent repeated run;
- no duplicate versions on race;
- dashboard read не вызывает Yandex API.

---

## 37. PERFORMANCE TARGET

Production-like implementation gate:

- `GET feed` cold ≤ 3 s;
- detail/version routes существенно быстрее;
- full detector run должен быть измерен и задокументирован;
- query count должен быть bounded относительно числа detectors, а не заказов/страниц;
- active feed не должен пересчитывать всю аналитику синхронно на каждый HTTP request.

Предпочтительно: вычислять insights в scheduler и читать materialized result из Postgres.

---

## 38. PRIVACY / SECURITY

Запрещено сохранять/возвращать:

- phone;
- email;
- Telegram/MAX identifiers;
- customer names;
- addresses;
- free-form order notes;
- raw ClientID values;
- yclid values;
- OAuth token;
- Client Secret.

Допустимы только агрегаты и технические идентификаторы analytics entities/change IDs.

DTO whitelist.

ADMIN auth.

Логи без секретов.

---

## 39. TEST MATRIX — ОБЯЗАТЕЛЬНО

Минимум покрыть:

### A. Determinism

A1. одинаковые данные → одинаковый detector result.

A2. повторный run без новых данных → нет новой version.

A3. concurrent run → нет duplicate insight/version.

### B. Small sample

B1. 2→3 leads → не ATTENTION/CRITICAL.

B2. 0→1 error → не CRITICAL.

B3. большой относительный % на малом denominator → LOW_SAMPLE/INSUFFICIENT_DATA.

### C. Comparability

C1. период пересекает metric availableFrom → suppression/incomparable.

C2. partial Stage 10 transition → нет funnel dropoff conclusion.

C3. missing history → null/not available, не 0.

C4. weekday mismatch → limitation.

### D. Maturity

D1. paid/revenue/profit cohort immature → нет финального negative/positive conclusion.

D2. после maturity detector автоматически может вернуться к обычной оценке.

### E. Cross-domain

E1. site leads не смешиваются с CRM orders.

E2. matched metric при низком ClientID coverage suppressed.

E3. incomplete COGS блокирует точный profit insight.

### F. Causality language

F1. все generated insights `causality=NOT_ESTABLISHED`.

F2. запрещённые causal phrases отсутствуют в FACT/HYPOTHESIS/RECOMMENDATION templates.

F3. NO_SUPPORTED_HYPOTHESIS корректно работает.

### G. Stage 11

G1. Stage 11 `INCOMPARABLE` не превращается Stage 12 в positive/negative signal.

G2. `IMMATURE` сохраняется.

G3. overlapping change отображается как limitation.

### H. Incident fixture

Период, пересекающий 14.09 18:20 → 15.09 20:32, не должен трактоваться как чистый эффект другого site change.

### I. Quality

I1. stale → DATA_QUALITY insight.

I2. после восстановления sync insight resolve/supersede согласно lifecycle.

### J. Auth/privacy

J1. no token 401.

J2. EXECUTOR 403.

J3. flag off contract.

J4. PII fields rejected.

J5. response/storage scan без PII.

### K. UI

K1. FACT/HYPOTHESIS визуально различимы.

K2. no insights empty state.

K3. loading/error/disabled.

K4. mobile 390 px no horizontal overflow.

K5. filters.

K6. acknowledged state.

### L. Regression

Stage 06/09/10/11 tests + builds.

---

## 40. REQUIRED IMPLEMENTATION ARTIFACTS

Создать/обновить минимум:

```text
docs/analytics/12_AUTOMATED_INSIGHTS.md
docs/analytics/INSIGHTS_DATA_CONTRACT.md
docs/analytics/INSIGHTS_RULES.md
docs/analytics/INSIGHTS_LANGUAGE_POLICY.md
```

В `INSIGHTS_RULES.md` таблицей перечислить каждый detector:

- id;
- category;
- input metrics;
- comparison window;
- minimum sample;
- materiality threshold;
- statistical gate;
- quality gate;
- severity logic;
- suppression reasons;
- hypothesis template;
- recommendation template.

В `INSIGHTS_LANGUAGE_POLICY.md` отдельно зафиксировать разрешённые и запрещённые формулировки.

---

## 41. REQUIRED SCREENSHOTS

Implementation review должен содержать реальные/production-copy данные, не нарисованный mock:

- desktop feed;
- insight detail;
- FACT/HYPOTHESIS/RECOMMENDATION;
- low sample / insufficient data diagnostic;
- data quality insight;
- empty state;
- disabled state;
- error state;
- mobile 390 px.

Production для этого не трогать.

---

## 42. IMPLEMENTATION WORKFLOW

1. Audit Stage 07–11 contracts.
2. Зафиксировать `INSIGHTS_DATA_CONTRACT.md`.
3. Предложить detectors V1 и thresholds.
4. Зафиксировать `INSIGHTS_RULES.md` до реализации либо одновременно с тестами.
5. Спроектировать additive DB migration.
6. Реализовать deterministic engine.
7. Реализовать lifecycle/fingerprint/versioning.
8. Реализовать scheduler integration с flag OFF by default.
9. Реализовать API.
10. Реализовать UI.
11. Выполнить reconciliation.
12. Выполнить test matrix.
13. Performance/privacy review.
14. Screenshots.
15. Обновить status docs.
16. Вернуть отчёт Reviewer.

Production не менять.

---

## 43. RECONCILIATION GATE

На production-copy/актуальной копии:

### A = API

Результат insight API.

### B = service

Прямой вызов insight service.

### C = source calculations

Канонические Stage 08/10/11 services + SQL только там, где это необходимо для независимой сверки.

Для выбранных fixtures:

`A = B = C` для всех числовых FACT/evidence полей.

Hypothesis/recommendation проверять deterministic template equality.

Обязательно fixtures:

1. small sample;
2. device gap;
3. form error change;
4. Stage 11 incomparable change;
5. immature paid outcome;
6. stale/quality;
7. no-signal period.

---

## 44. ACCEPTANCE CRITERIA

Stage 12 implementation можно передать Reviewer только если:

- [ ] production untouched;
- [ ] отдельный `ANALYTICS_INSIGHTS_ENABLED`, default false;
- [ ] additive migration only;
- [ ] no PII;
- [ ] deterministic rule engine;
- [ ] immutable versions;
- [ ] stable fingerprint/dedupe;
- [ ] no version churn без новых данных;
- [ ] low traffic не создаёт шум;
- [ ] Stage 10 comparability preserved;
- [ ] Stage 11 verdicts preserved;
- [ ] maturity preserved;
- [ ] MDE/sample gates preserved;
- [ ] site/CRM funnels separated;
- [ ] P&L reused;
- [ ] ClientID/COGS quality gates;
- [ ] FACT/HYPOTHESIS/RECOMMENDATION separated;
- [ ] causality NOT_ESTABLISHED;
- [ ] no unsupported psychological explanations;
- [ ] Stage 06/09/10/11 regression clean;
- [ ] API ADMIN-only;
- [ ] UI responsive;
- [ ] scheduler isolated/idempotent;
- [ ] no live Metrika API from dashboard request;
- [ ] performance measured;
- [ ] reconciliation A=B=C;
- [ ] docs/screenshots complete.

---

## 45. STOP CONDITIONS

Исполнитель должен остановиться и вернуть `BLOCKED`/`NEEDS_REVIEW`, если для выполнения Stage 12 требуется:

- изменить production;
- изменить `web-photo` event model;
- включить Logs API;
- добавить A/B variant assignment;
- собирать PII;
- переопределить Stage 08 business metrics;
- обойти Stage 10 comparability;
- обойти Stage 11 maturity/MDE/incomparability;
- использовать LLM для определения фактов/причин;
- автоматически менять рекламу/сайт/цены;
- destructive migration;
- скрыть существенное противоречие существующим данным.

Не обходить STOP condition молча.

---

## 46. EXECUTOR REPORT FORMAT

Вернуть:

```markdown
# EXECUTOR_REPORT_STAGE12_AUTOMATED_INSIGHTS

## RESULT
READY_FOR_REVIEW | NEEDS_FIX | BLOCKED

## AUDIT
Что переиспользовано из Stage 07–11.

## DATA_MODEL
Таблицы, migration, additive/destructive review.

## DETECTORS
Полный список V1 detectors и thresholds.

## FACT_HYPOTHESIS_RECOMMENDATION
Примеры и language-policy proof.

## QUALITY_GATES
Sample / MDE / maturity / comparability / coverage / COGS / freshness.

## LIFECYCLE_DEDUPE
Fingerprint, versions, cooldown, resolve/reopen.

## STAGE10_REUSE
Доказательство отсутствия дублирования/обхода behavior rules.

## STAGE11_REUSE
Доказательство сохранения verdict/confounders/statistics.

## RECONCILIATION
A = B = C fixtures и diff.

## SCHEDULER
Frequency, lock, idempotency, query/API cost.

## API_UI
Routes, auth, flag, screenshots, responsive.

## PERFORMANCE
SQL/query count, cold/warm timings, N+1.

## PRIVACY
PII scan, DTO whitelist, secrets.

## TESTS
CRM/panel/build/lint totals.

## GIT
branch, commits, origin/master, production untouched.

## NEW_FACTS
Новые факты, найденные на данных.

## DEVIATIONS
Все отклонения от спецификации.

## OPEN_DECISIONS
Только решения, действительно требующие Reviewer/owner.

## PRODUCTION_UNTOUCHED
Явное подтверждение.
```

---

## 47. DECISION GATE

Исполнитель **не ставит Stage 12 = DONE самостоятельно**.

Допустимый финал implementation:

```text
12_AUTOMATED_INSIGHTS = READY_FOR_REVIEW
```

После отчёта Reviewer принимает одно решение:

```text
DONE → подготовить 12_PRODUCTION_ROLLOUT.md
NEEDS_FIX → отдельный targeted FIX MD
BLOCKED → запросить только необходимые решения
```

До verdict Reviewer production не менять и Stage 13 не начинать.

---

## 48. КОМАНДА ИСПОЛНИТЕЛЮ

```text
СТАРТ.
Выполняй Stage 12 строго по docs/analytics/12_AUTOMATED_INSIGHTS.md.
Production не менять.
Не переходить к Stage 13.
Не использовать LLM для генерации аналитических причин или verdicts.
Сначала переиспользовать принятые Stage 07–11 contracts, затем реализовать минимальный deterministic insights layer.
При конфликте с фактической архитектурой не обходить требование молча — вернуть deviation/blocker Reviewer.
В конце вернуть EXECUTOR_REPORT_STAGE12_AUTOMATED_INSIGHTS по § 46.
```
