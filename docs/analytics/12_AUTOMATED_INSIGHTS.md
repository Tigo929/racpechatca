# 12_AUTOMATED_INSIGHTS — автоматические выводы и приоритизация сигналов

## 0. STATUS

`READY_FOR_REVIEW` (после `NEEDS_FIX` → `12_FIX_01` выполнен 16.09.2026, отчёт § 50: агрегированный детектор
`quality.eventNotMeasured` — одна карточка на воронку, FACT про `not_measured ≠ 0` и ограниченные выводы,
NO_SUPPORTED_HYPOTHESIS, IMPROVE_DATA_QUALITY без правок event model; 19 детекторов; CRM 1078 / панель 42) —
реализовано 16.09.2026 в `feature/analytics-foundation`: детерминированный движок сигналов
FACT → HYPOTHESIS → RECOMMENDATION поверх этапов 08/10/11 (19 детекторов, окна 7/7 через строитель этапа 11, оценки
метрик и confounders этапа 11, зеркало правил этапа 10, оценки этапа 11 в ленте дословно), реестр карточек с отпечатком,
неизменяемыми версиями и журналом запусков (миграция 20260916120000 — только CREATE), хук после тика (daily / hourly),
ADMIN API под своим флагом `ANALYTICS_INSIGHTS_ENABLED` (guard до валидации), вкладка «Инсайты». Сверка на копии
production A = B = C diff 0; тесты CRM 1078 / панель 42. Production не тронут. Отчёты — § 49, § 50 (FIX_01); контракты —
`INSIGHTS_DATA_CONTRACT.md`, `INSIGHTS_RULES.md`, `INSIGHTS_LANGUAGE_POLICY.md`. Verdict — Reviewer.

Исходный статус спецификации: `READY_FOR_IMPLEMENTATION`.

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

---

# 49. EXECUTOR_REPORT_STAGE12_AUTOMATED_INSIGHTS — 16.09.2026

## RESULT

```text
READY_FOR_REVIEW
```

Реализовано в `feature/analytics-foundation` (коммиты b983676 backend, 0a0c6cf панель, 8753faf правки после сверки,
docs), проверено на свежей копии production `crm_stage12_test` (снята 16.09 16:07 MSK, удалена после проверок).
Production не менялся: master 5922175 не трогался; env / compose на сервере / миграции production / web-photo /
event model / Logs API / CI сайта — без изменений. Раздел выкатывается выключенным (`ANALYTICS_INSIGHTS_ENABLED` default false).

## AUDIT

```text
Переиспользовано (INSIGHTS_DATA_CONTRACT.md § 1): этап 07 — MetrikaSyncRun (свежесть), хук после тика registerAfterSync;
этап 08 — AnalyticsMetricsService.getOverview / lifecycles / getTrafficSources / getLandings / getProducts (данные окон,
когорты, покрытие ClientID, COGS_UNRELIABLE_ORDERS, paidWithoutDate, P&L); этап 09 — срезы Slice / CrmSlice, полярность
каталога; этап 10 — BehaviorMetricsService.getIssues / getFunnels / loadInput (правила зеркалятся без пересчёта, skipped →
причины молчания); этап 11 — buildWindows / observationCutoffOf / evaluateMetric / computeStatistics / computeConfounders /
poissonRateComparison / maturityPolicyFrom / lagInputsFrom, AnalyticsGrowthService.loadWindow / overlappingChanges /
lastDataDay (сделаны публичными — visibility-only, поведение и тесты этапа 11 без изменений), AnalyticsChange +
последняя AnalyticsChangeEvaluation. Своих формул KPI / статистики / созревания нет. Границы данных — единый
DATA_BOUNDARIES (13.08.2026, 12.09 13:19 MSK, инцидент 14.09 18:20 → 15.09 20:32 MSK).
Противоречий с фактической архитектурой не нашлось; отклонения — DEVIATIONS.
```

## DATA_MODEL

```text
AnalyticsInsight (карточка-эпизод: fingerprint unique, baseFingerprint, episode, category, severity, status, scope,
source, detectorId, metricKey, entityKey, periodStart/End, baselineStart/End DATE, title, fact / hypothesis /
recommendation / evidence / limitations / quality JSONB, causality, link, first/lastDetectedAt, resolvedAt,
resolvedReason, acknowledgedAt, latestVersion, payloadHash) + AnalyticsInsightVersion (insightId FK cascade, version,
generatedAt, syncRunId, runId, payload JSONB, payloadHash; unique(insightId, version)) + AnalyticsInsightRun (журнал:
kind, status RUNNING/SUCCESS/FAILED/LOCKED/SKIPPED, cutoff, счётчики, suppressed JSONB, errors, seenEvaluations).
Миграция 20260916120000_analytics_insights — 97 строк: CREATE TABLE 3, CREATE INDEX 5 (2 unique), ALTER TABLE 1 (FK на
новой таблице); DROP / TRUNCATE / DELETE / UPDATE / RENAME — 0; существующих таблиц в файле нет. Применена на копии
(83 migrations found, 1 applied → 62 таблицы), в production — нет. Без PII, без токенов, без сырых user-level данных.
```

## DETECTORS

```text
18 детекторов V1 (INSIGHTS_RULES.md § 3, пороги § 2 — все в insights-rules.ts, отдаются в status.thresholds):
traffic.visits (TRAFFIC_CHANGE, INFO всегда), site.leadRate (+ CRITICAL «заявки исчезли» ≥ 150 визитов / ≥ 3 в базе),
site.formStartRate (FUNNEL_DROPOFF, + CRITICAL «обрыв воронки» ≥ 100 / ≥ 5), site.formErrorRate (≥ 5 визитов с ошибкой,
CRITICAL ≥ 10), stage10.issues (зеркало правил этапа 10 → FUNNEL_DROPOFF / DEVICE_GAP / FORM_ERROR_CHANGE / LANDING_CHANGE /
SITE_CONVERSION_CHANGE), source.mixShift (≥ 15 п.п.), source.performance и landing.change (≥ 30 визитов; визиты — Пуассон,
доля заявок — статистика долей этапа 11; движущиеся с общим трафиком → DUPLICATE), product.change (принятые по категории),
crm.leadToAccepted, crm.leadToPaid, money.realizedRevenue, money.netProfit, change.evaluation (hourly), quality.stale
(hourly; STALE → ATTENTION, ≥ 6 ч / NO_DATA → CRITICAL), quality.clientIdCoverage (< 50 % при ≥ 5 принятых),
quality.cogs, quality.paidWithoutDate.
Существенность отдельно от статистики: доли 2 п.п.; счётчики 20 % и 10; деньги 5 000 ₽ и 10 %; ошибки 5 визитов.
Полярность каталога этапа 11, visits — контекст. Каждый детектор детерминирован, возвращает evidence и причину молчания.
```

## FACT_HYPOTHESIS_RECOMMENDATION

```text
Контракт InsightPayload: fact (числа, знаменатели, окна, MDE/p), hypothesis {status SUPPORTED_BY_CONCURRENT_FACTS |
NO_SUPPORTED_HYPOTHESIS, text «Гипотеза: … Причинность не установлена.», supportingFacts[]}, recommendation {text, kind},
causality NOT_ESTABLISHED. Гипотезы — только rule-based связки (INSIGHTS_RULES.md § 5): device-mix, ошибки форм,
источники, пересекающиеся изменения, прибыль при стабильном объёме; иначе NO_SUPPORTED_HYPOTHESIS. Рекомендации —
проверить / сравнить / дождаться / зарегистрировать; бизнес-приказов нет.
Language policy (INSIGHTS_LANGUAGE_POLICY.md): 15 запрещённых паттернов (из-за, благодаря, привело к, вызвал, причина,
доказано, отпугивает, не нравится, не доверяют, слабый CTA, плохой дизайн, пользователи стали…) с исключениями для
отрицаний; проверяется тестами F1–F3 на всех детекторах и движком перед записью (нарушение → ошибка запуска).
Примеры с копии production (16.09): FACT «Визиты: за 09.09.2026–15.09.2026 126, в предыдущем сопоставимом окне
(02.09.2026–08.09.2026) 244; разница −118 (−48,4 %); p = 0,000; при текущем объёме заметен эффект от ±25 % базы.»
HYPOTHESIS «Гипотеза: визиты источника «Переходы по рекламе» снизились более чем вдвое. Причинность не установлена.»
(поддерж. факт «181 → 79 визитов») RECOMMENDATION «Не делать вывода об эффекте до чистого окна без пересекающихся
изменений; оценивать конкретное изменение — через «Рост / Изменения».» Запрещённых формулировок в ленте копии: 0.
```

## QUALITY_GATES

```text
Sample — гейт этапа 11 (30 визитов / 5 событий / 5 заказов) + 30 визитов на сущность; MDE и требуемая выборка — в каждой
причине молчания словами («MDE ±… % от базы; для 20 % нужно ≈ N на окно»). Maturity — политика этапа 11 по эмпирике CRM:
на копии accepted 1 дн., paid 14 дн. → realizedRevenue / netProfit / leadToPaidRate за последние 7 дней всегда IMMATURE
(в диагностике «созревание до 29.09.2026»). Comparability — availableFrom / definitionCutovers: окна 02–08.09 → 09–15.09
пересекают cutover 12.09 → siteLeadRate / formStartRate / formErrorRate MEASUREMENT_DEFINITION_CHANGED (на копии заявок
до 12.09 в новом определении 0 → без гейта был бы «рост 0 → 4 %»). Coverage — clientIdCoverageAccepted 6,45 % <
50 % → matched-метрики INSUFFICIENT_DATA и карточка DATA_QUALITY. COGS — COGS_UNRELIABLE_ORDERS → netProfit
INSUFFICIENT_DATA + карточка quality.cogs. Freshness — STALE → ATTENTION/CRITICAL карточка, флаг ANALYTICS_STALE в
ограничениях. Инцидент 14–15.09 — INCIDENT_BOUNDARY у всех карточек с окнами, пересекающими его.
```

## LIFECYCLE_DEDUPE

```text
fingerprint = sha1(category | detectorId | metricKey | entityKey) — без периода; канонический хэш нагрузки (сортировка
ключей, округление 1e-6, без freshness и ссылок sync_run): тот же → только lastDetectedAt; другой → version + 1
(неизменяемая строка). Условие пропало → RESOLVED «условие сигнала больше не выполняется»; вернулось ≤ 7 дн. → тот же
эпизод OPEN (reopened); 7–10 дн. → COOLDOWN; позже → новый эпизод fingerprint#N, старый SUPERSEDED. Лимит 3 активных на
детектор (лишние → COOLDOWN в диагностике). Один отпечаток за запуск (DUPLICATE). change.evaluation: версия оценки
поднимается один раз (seenEvaluations в журнале), карточка живёт пока изменение в реестре. acknowledge / resolve с
причиной; удаления нет. На копии: повторный запуск без новых данных → created 0, versioned 0, unchanged 3 ✓.
```

## STAGE10_REUSE

```text
stage10.issues читает BehaviorMetricsService.getIssues(after) и переносит issue.fact / hypothesis / recommendation /
severity / evidence как есть (source STAGE10_RULE, ограничение STAGE10_RULE_MIRROR, подпись «вычислено правилом этапа
10»); skipped этапа 10 → причины молчания PARTIAL_BEHAVIOR_PERIOD / LOW_SAMPLE / INCOMPARABLE_PERIODS; сам этап 12
воронки не пересчитывает, DEVICE_GAP не дублирует (своего детектора устройств нет — только зеркало). На копии:
DEVICE_GAP[CRITICAL] «На телефонах конверсия заметно ниже» — fact и severity равны правилу этапа 10 (C diff 0);
FUNNEL_DROPOFF — 3 × PARTIAL_BEHAVIOR_PERIOD и 2 × LOW_SAMPLE в диагностике, карточек нет ✓ (C2).
```

## STAGE11_REUSE

```text
Все метрические детекторы — evaluateMetric этапа 11 на окнах buildWindows (псевдо-изменение ANALYTICS / NEUTRAL, роль
secondary): вердикт, статистика, MDE, сопоставимость, созревание, флаги — без второй реализации. Confounders этапа 11
(SOURCE/DEVICE/LANDING_MIX_SHIFT, OVERLAPPING_CHANGE, ANALYTICS_STALE, …) идут в evidence и в гипотезы. change.evaluation
поднимает последнюю оценку каждого изменения дословно: FACT + «Вердикт этапа 11: …», гипотеза = INTERPRETATION,
рекомендация = RECOMMENDATION (kind USE_STAGE11_RECOMMENDATION), evidence.verdict / metricEvaluation / confounders —
из оценки. На копии: изменение 12.09 v9 INCOMPARABLE → карточка INFO «окна несопоставимы», FACT-префикс и
RECOMMENDATION равны оценке (C diff 0); G1–G3 тестами: INCOMPARABLE не становится сигналом, IMMATURE сохраняется,
OVERLAPPING_CHANGE — ограничение и рекомендация OBSERVE.
```

## RECONCILIATION

```text
Копия crm_stage12_test (16.09 16:07 MSK, 59 → 62 таблиц), backend :3000 (флаги ON), пользователи stage12_* только в копии.
A = HTTP POST /insights/run (manual) + GET feed/get/versions; B = AnalyticsInsightsService.buildContext + runDetectors на
тех же строках; C = SQL по MetrikaDailyTraffic / MetrikaDailyGoal(611379890) / MetrikaDailyBehaviorDevice + Overview этапа 08
+ getIssues этапа 10 + getEvaluation этапа 11.
Окна 02–08.09 → 09–15.09 (cutoff 15.09). A: detected 4, created 4, suppressed 51; лента — [CRITICAL] DEVICE_GAP (этап 10),
[INFO] CHANGE_EVALUATION (12.09, INCOMPARABLE), [INFO] DATA_QUALITY (ClientID 6 %), [INFO] TRAFFIC_CHANGE (244 → 126).
A = B: 3 карточки по канонической нагрузке diff 0 (change.evaluation в B — DUPLICATE, версия уже поднята); причины
молчания A = B по всем кодам. A/B = C: 13 чисел diff 0 (visits 244/126, siteLeads 0/5, rate 3,968 %, formStarts 17,
formErrors 1, crmLeads 4, acceptedOrders 31, realizedRevenue 75 772, netProfit 43 521, coverage 6,452 %, paidWithoutDate 0)
+ 3 карточки (DEVICE_GAP fact/severity = этап 10; change.evaluation verdict/FACT/RECOMMENDATION = этап 11;
clientIdCoverage = overview) diff 0.
Фикстуры § 43: 1 small sample — site.leadRate молчит (MEASUREMENT_DEFINITION_CHANGED; 0 → 5 заявок не стало «ростом»);
2 device gap — карточка CRITICAL из правила этапа 10; 3 form errors — молчит (0 → 1 ошибка, определение менялось);
4 Stage 11 incomparable — INFO с STAGE11_VERDICT_PRESERVED; 5 immature paid — realizedRevenue / leadToPaid IMMATURE
«созревание до 29.09»; 6 stale/quality — с часами +8 ч карточка CRITICAL «данные устарели: 9 ч назад», покрытие ClientID —
карточка INFO; 7 no-signal — кроме качества данных и оценки этапа 11 всего 2 карточки (правило этапа 10 и трафик).
Детерминизм: повторный запуск → created 0 / versioned 0 / unchanged 3; часовой запуск → 2 детектора, новых 0.
```

## SCHEDULER

```text
Хук insights:run после успешного тика этапа 07 (регистрируется только при включённом флаге): daily при новом полном дне
(cutoff > cutoff последнего SUCCESS daily), иначе hourly (лёгкий контекст: свежесть + оценки этапа 11). Замок: флаг в
процессе + строка журнала RUNNING моложе 10 мин (advisory lock отклонён — с пулом Prisma unlock уходил в другое
соединение и блокировал все следующие запуски; найдено на копии). Идемпотентность: тот же контекст → без версий.
Изоляция: ошибка контекста / записи → FAILED в журнале, тик расписания не затронут (юнит-тесты + существующий try/catch
хуков этапа 11). Стоимость на копии: daily 153 SQL / 4,3–5,2 с через туннель (RTT ~120 мс; на бою ожидается ≤ 1,5 с);
hourly 12 SQL / 1,4 с; запросов к API Метрики — 0.
```

## API_UI

```text
/analytics/dashboard/insights: GET status | feed | quality | :id | :id/versions; POST :id/acknowledge | :id/resolve |
run — ADMIN (JwtAuthGuard + RolesGuard), флаги ANALYTICS_DASHBOARD_ENABLED + ANALYTICS_INSIGHTS_ENABLED, InsightsEnabledGuard
до ValidationPipe (OFF → 404 на всё, кроме status, даже при невалидном теле — тест J3). На копии: без токена 401, EXECUTOR
403, feed?severity=HIGH&customerPhone=1 → 400 whitelist, acknowledge 200 → повтор 400, resolve с PII-полем → 400.
UI — вкладка «Инсайты» (`?tab=insights`): карточки ФАКТ / ГИПОТЕЗА — НЕ ФАКТ (пунктир, курсив, поддерж. факты) / ЧТО
ПРОВЕРИТЬ, уровень, категория, окна, ограничения, качество, впервые/последний раз/версия/эпизод, источник, переход,
«Принять к сведению», «Детали» (сила статистики и существенность отдельно, контекст, confounders, ручное закрытие),
фильтры active/all/закрытые × уровень × категория, пустое состояние «Сейчас нет сигналов, требующих внимания», блок
«Правил без вывода» с причинами. Скриншоты (копия production, 16.09): docs/analytics/screenshots/12_insights/
insights-desktop-feed, insights-desktop-detail-and-diagnostics (детали + диагностика LOW_SAMPLE/IMMATURE/…),
insights-desktop-data-quality, insights-desktop-empty, insights-desktop-error (500 через перехват), insights-desktop-disabled
(status enabled:false), insights-loading, insights-mobile-390 (scrollWidth 390).
```

## PERFORMANCE

```text
Чтение (Postgres, копия через туннель RTT ~120 мс): GET feed 195–272 мс (3 SQL), status 193–235 мс, quality ~210 мс,
get 198–264 мс — цель ≤ 3 с cold выполнена с запасом; лента не пересчитывает аналитику на запрос (материализованные
строки). Полный запуск (manual/daily): 140 SQL контекста + запись = 153 SQL, 5,0–6,0 с HTTP через туннель (≈ 140 × RTT);
на бою (БД рядом) ожидается ≤ 1,5 с. Число запросов не зависит от числа заказов/страниц (агрегаты: 2 окна × (overview,
behavior, sources) + срезы + правила этапа 10 + реестр). hourly: 12 SQL. N+1 нет.
```

## PRIVACY

```text
Хранимые строки копии (4 карточки, 4 версии, ~34 тыс. символов): телефоны (строгий паттерн) 0, e-mail 0, @username 0,
19-значные ClientID 0, ссылки t.me/max.ru/wa.me 0, токены 0; 12 контактов клиентов из OrderPhoto.urlCommunication —
вхождений 0. Тексты содержат только агрегаты, коды, пути страниц, названия источников и id изменений. DTO whitelist
(лишние поля → 400), ADMIN only, JWT/пароли в логах и отчёте не выводились.
```

## TESTS

```text
CRM jest: 1069 / 1069, 98 suites (этап 12 — 54: insights-engine.spec 38 [A детерминизм, B малые выборки, C сопоставимость,
D созревание, E домены, F язык, G этап 11, H инцидент, I качество, сущности/товары/сдвиг, тихий период, реестр],
analytics-insights.service.spec 11 [версии/RESOLVED/переоткрытие/эпизоды/кулдаун/лимит/acknowledge+resolve/замок/FAILED/
daily vs hourly/SKIPPED/порядок ленты], insights-dashboard.controller.spec 5 [guards, J3 флаг до валидации, J4 DTO/PII,
флаги], фикстура 1). Этапы 06/09/10/11 — прежние тесты зелёные без правок (L).
Панель vitest: 41 / 41 (insights.test 6: K1 факт/гипотеза различимы, K2 пустое состояние, K3 loading/error/disabled,
K5 фильтры, K6 acknowledged). Build: nest build OK; tsc -b + vite build OK. Lint: eslint insights/growth 0, prettier чист;
frontend eslint по аналитике 0 (19 прежних проблем вне аналитики — как на HEAD).
```

## GIT

```text
feature/analytics-foundation: fdb483d (Stage 11 DONE + спецификация как получена) → b983676 backend → 0a0c6cf панель →
8753faf замок/hourly/dedupe → <docs> (INSIGHTS_DATA_CONTRACT, INSIGHTS_RULES, INSIGHTS_LANGUAGE_POLICY, отчёт § 49,
DASHBOARD_CONTRACT § 11c, master plan, current state, скриншоты). origin/master = 5922175 (production), не менялся;
master ⊂ feature.
```

## NEW_FACTS

```text
1. За 09–15.09 трафик сайта 126 визитов против 244 за 02–08.09 (−48 %, Пуассон p < 0,001); рекламный источник 181 → 79
   (движется с общим трафиком). Заявок сайта 5 (новое определение), в предыдущем окне 0 в новом определении — сравнение
   конверсии несопоставимо до 20.09 (первое недельное окно после 12.09 — 13–19.09; оба окна в новом определении — с 27.09).
2. Покрытие ClientID у принятых за 09–15.09 — 6,45 % (2 из 31): сопоставленные метрики бесполезны как KPI.
3. Правило этапа 10 DEVICE_GAP на окне 09–15.09 — CRITICAL: телефоны 0 % (54 визита) против компьютеров 7,2 % (69).
4. Advisory lock сессии Postgres через пул Prisma не подходит для долгих запусков — unlock попадает в другое соединение.
5. Часовой запуск с полным контекстом стоил 81 SQL; лёгкий — 12.
```

## DEVIATIONS

```text
1. Manual run в API (POST /insights/run, ADMIN) — не требовался спецификацией; добавлен для сверки и ручной проверки
   (тот же код, что хук). Убрать — по решению Reviewer.
2. Ручной resolve оставлен (с обязательной причиной), а не только acknowledge — сложности не добавил.
3. Источник / страница входа, чьи визиты движутся вместе с общим трафиком (< 20 п.п. разницы относительных изменений),
   карточки не получают (DUPLICATE) — иначе одно падение трафика давало 3 карточки; сущность попадает в гипотезу
   карточки визитов. Порог MIRRORS_GLOBAL_TRAFFIC_POINTS = 20.
4. EVENT_NOT_MEASURED (35.5) отдельным детектором не реализован: not_measured шаги уже описаны в правилах этапа 10 и в
   причинах молчания (PARTIAL_BEHAVIOR_PERIOD / LOW_SAMPLE); постоянная карточка «шаг не измеряется» шумела бы.
5. Замок запуска — строка журнала RUNNING (≤ 10 мин) + флаг в процессе вместо pg advisory lock (см. NEW FACT 4).
6. Длинное окно 28/28 (7.1) в V1 не строится: истории с 13.08 хватит на 28/28 только с 08.10; порог LONG_WINDOW_DAYS
   заведён, детектор — при появлении истории (отдельным FIX).
7. Загрузчики этапа 11 loadWindow / overlappingChanges / lastDataDay сделаны публичными (без изменения поведения).
8. Реконсиляция stale выполнена через сервис со сдвинутыми часами (на копии данные свежие); через HTTP stale не
   воспроизводится без остановки синхронизации.
```

## OPEN_DECISIONS

```text
1. Оставить ли POST /insights/run в API (DEVIATION 1).
2. Пороги V1 (INSIGHTS_RULES.md § 2), особенно MAX_ACTIVE_PER_DETECTOR = 3 и MIRRORS_GLOBAL_TRAFFIC_POINTS = 20.
3. Production rollout — отдельный документ/gate (миграция на старте контейнера, compose-строка флага, включение после
   OFF-проверок; предложение — включать после 27.09, когда оба окна 7/7 целиком в новом определении заявок).
4. Детектор длинного окна 28/28 — после накопления истории (08.10).
```

## PRODUCTION_UNTOUCHED

```text
Production CRM не менялся: master 5922175, образы и контейнеры не пересоздавались, env / compose на сервере не
редактировались, миграция 20260916120000 применялась только на копии crm_stage12_test (удалена), таблиц AnalyticsInsight*
в боевой базе нет. web-photo, event model сайта, Logs API, CI сайта и ветка feature/print-card-lead-form — не трогались.
```

---

# 50. EXECUTOR_REPORT_STAGE12_FIX01 — 16.09.2026

## RESULT

```text
READY_FOR_REVIEW (FIX_01 выполнен)
```

Реализован агрегированный детерминированный детектор `quality.eventNotMeasured` (EVENT_NOT_MEASURED, категория
DATA_QUALITY) — одна карточка на воронку этапа 10, а не карточка на каждый отсутствующий event. Коммиты
`feature/analytics-foundation`: 5f90e68 (детектор, пороги, тесты, UI-пометка), 0d7e901 (точная формулировка
рекомендации), docs. Проверено на свежей копии production `crm_stage12_test` (снята 16.09 19:41 MSK, удалена после
проверок). Production не менялся. Пороги остальных детекторов, архитектура планировщика, контракты этапов 10/11 —
без изменений.

## DETECTOR

```text
Вход: ctx.behavior.funnels этапа 10 (те же воронки, что во вкладке «Поведение»), шаги с availability = not_measured.
Вид пропуска (EVENT_GAP_STEP_KINDS, insights-rules.ts): INSTRUMENTATION_GAP — шаг на сайте есть, измерения в счётчике
нет (catalog, choose_type_color, submit_tshirt_order); NOT_ON_SITE — шага на сайте не существует (canvas_upload: фото
холста присылают в переписке). Неизвестный ключ — по примечанию этапа 10 («не существует» / «нет на сайте» → NOT_ON_SITE),
иначе INSTRUMENTATION_GAP.
Правило: карточка только если в воронке есть хотя бы один INSTRUMENTATION_GAP и на входе измеренной части воронки в окне
«после» ≥ EVENT_GAP_MIN_FUNNEL_VISITS = 20 визитов (= MIN_STEP_ENTRANTS правила 11.1 этапа 10 — анализ отвала реально идёт).
  · все пропуски NOT_ON_SITE → suppressed NO_MATERIAL_CHANGE «шаг(и) … на сайте не существуют — ни одному анализу не нужны,
    карточка не создаётся»;
  · вход < 20 → suppressed LOW_SAMPLE «… но на входе измеренной части N визитов (< 20) — анализ отвала сейчас не идёт,
    пропуск ничего не ограничивает».
Карточка: severity INFO всегда (от числа пропусков не растёт), scope data, metricKey funnelSteps, entityKey = ключ воронки
→ fingerprint стабилен (sha1(DATA_QUALITY|quality.eventNotMeasured|funnelSteps|<funnel>)).
FACT называет: какой анализ ограничен («Анализ отвала воронки «X» (правило этапа 10) ограничен»), какой шаг не измеряется
(подпись + примечание этапа 10, например «Выбрали фото / формат» (цели catalog в счётчике нет)), что значение —
not_measured, не 0, какие выводы нельзя сделать (по месту шага: «нельзя посчитать конверсию из «A» в «B» и долю потерь до
этого шага» / «переход «A» → «B» нельзя разложить через «X»» / «нельзя измерить завершение воронки после «A»»), и
измеренную часть воронки. Дневных чисел и окна в тексте нет (иначе версия росла бы каждый день без изменения сути).
HYPOTHESIS: status NO_SUPPORTED_HYPOTHESIS, «Гипотезы нет: отсутствие измерения — известный факт настройки счётчика, а не
поведение клиентов». RECOMMENDATION (IMPROVE_DATA_QUALITY): проверить измерение шага в счётчике Метрики — если событие
уже отправляется сайтом, завести на него цель; если события нет — зафиксировать шаг как намеренно неизмеряемый или
запланировать измерение отдельным решением; event model web-photo в рамках этапа 12 не менять; до появления измерения
выводы об отвале на этих шагах не делать.
evidence.context: step:<key> с before/after = null (unit visits); statisticalStrength NONE, businessMateriality LOW;
limitations NOT_MEASURED_STEPS + STAGE10_RULE_MIRROR; note «не измеряемые шаги отдаются как not_measured (null), в 0 не
превращаются»; link → вкладка «Поведение». refresh daily; status.thresholds.eventGapMinFunnelVisits = 20; детектор в
status.detectors (19).
Жизненный цикл: тот же отпечаток день за днём → unchanged (версий 0; двигаются lastDetectedAt и окно карточки);
измерение появилось → RESOLVED «условие сигнала больше не выполняется»; вернулось в 7 дней → та же карточка OPEN,
позже → новый эпизод #N (общий механизм § 4 контракта). Каноническая нагрузка теперь без fact.period / baselinePeriod
(для всех детекторов — окна сами по себе не новые данные; на прежних карточках копии хэши не изменились: повтор → unchanged 5).
UI: карточки scope = data подписаны «Качество измерения — не поведение клиентов» (вместо «Гипотеза — не факт») и чипом
«качество данных, не поведение»; ограничение NOT_MEASURED_STEPS — «часть шагов не измеряется».
```

## BEFORE

```text
Копия crm_stage12_test 16.09 16:07 MSK (отчёт § 49), окна 02–08.09 → 09–15.09: 18 детекторов, 4 карточки
([CRITICAL] DEVICE_GAP этапа 10, [INFO] визиты 244 → 126, [INFO] покрытие ClientID 6 %, [INFO] оценка изменения 12.09),
51 причина молчания. Пропуски измерения шагов воронок (photo: «Выбрали фото / формат» not_measured; tshirt: «Выбрали
крой / цвет», «Отправили форму» not_measured; canvas: «Загрузили фото» not_measured) в ленте никак не отражались —
только косвенно через skipped FUNNEL_DROPOFF правил этапа 10 (LOW_SAMPLE / PARTIAL_BEHAVIOR_PERIOD) в диагностике.
Detector EVENT_NOT_MEASURED (35.5) отсутствовал (§ 49 DEVIATION 4) → NEEDS_FIX.
```

## AFTER

```text
Копия crm_stage12_test 16.09 19:41 MSK (свежее production), те же окна 02–08.09 → 09–15.09; ANALYTICS_INSIGHTS_ENABLED=true
только у локального backend против копии:
GET status: detectors=19 (quality.eventNotMeasured DATA_QUALITY daily STAGE12_DETECTOR), thresholds.eventGapMinFunnelVisits=20.
POST run (manual = daily): detectors 19, detected 6, created 6, versioned 0, suppressed 52:
  [CRITICAL] stage10.issues DEVICE_GAP (как было)
  [INFO] traffic.visits 244 → 126 (как было)
  [INFO] quality.clientIdCoverage 6 % (как было)
  [INFO] quality.paidWithoutDate — 11 оплаченных без даты оплаты (новая карточка из более свежих данных production,
         к FIX_01 не относится; на копии 16:07 было 0)
  [INFO] quality.eventNotMeasured (photo) — «Воронка «Фотопечать»: шаг не измеряется — анализ отвала ограничен»:
         не измеряется «Выбрали фото / формат» (цели catalog в счётчике нет); not_measured, не 0; нельзя посчитать
         конверсию из «Выбрали фото / формат» в «Начали форму фотопечати» и долю потерь до этого шага; измеренная часть
         «Открыли раздел фотопечати» → «Начали форму фотопечати» → «Заявка на фото принята»; на входе ≥ 20 визитов.
         HYPOTHESIS NO_SUPPORTED_HYPOTHESIS; RECOMMENDATION IMPROVE_DATA_QUALITY; limitations NOT_MEASURED_STEPS,
         STAGE10_RULE_MIRROR; evidence.context step:catalog before/after null.
  [INFO] change.evaluation 12.09 (как было)
Диагностика quality.eventNotMeasured (объясняет, почему карточки нет):
  · tshirt LOW_SAMPLE: «воронка «Футболки»: не измеряются «Выбрали крой / цвет», «Отправили форму», но на входе измеренной
    части 13 визитов (< 20) — анализ отвала сейчас не идёт, пропуск ничего не ограничивает»;
  · canvas NO_MATERIAL_CHANGE: «воронка «Холсты»: шаг(и) «Загрузили фото» на сайте не существуют — ни одному анализу не
    нужны, карточка не создаётся».
Итого одна агрегированная карточка на 4 не измеряемых шага трёх воронок; ни одной карточки на отдельный event.
Повторный run → created 0, versioned 0, unchanged 5 (в т. ч. eventNotMeasured v1), resolved 0.
Часовой запуск: detectors 2 (quality.stale, change.evaluation) — набор hourly не изменился; 12 SQL.
Скриншот: screenshots/12_insights/insights-fix01-event-not-measured.png (фильтр DATA_QUALITY, карточка раскрыта,
подпись «Качество измерения — не поведение клиентов», чип, блок «Правил без вывода»).
```

## TESTS

```text
Новый файл insights-event-gap.spec.ts — 9 тестов (требуемые 1–8 Reviewer):
 1  анализ воронки с активностью + не измеряемый шаг → одна карточка DATA_QUALITY INFO, scope data, FACT с названием
    анализа / шага / «not_measured, не 0» / «нельзя …», hypothesis NO_SUPPORTED_HYPOTHESIS, IMPROVE_DATA_QUALITY без
    правок web-photo, limitations, link behavior;
 2  четыре не измеряемых шага одного анализа → одна карточка, не четыре; уровень остаётся INFO;
 3  шаг, не нужный ни одному анализу (canvas_upload не существует на сайте) → карточки нет, NO_MATERIAL_CHANGE с
    объяснением; вход < 20 → LOW_SAMPLE с объяснением (карточки нет);
 3b входной не измеряемый шаг фото при активности → вывод «нельзя посчитать конверсию из … в …»;
 4  not_measured никогда не превращается в 0 — в fact.current/baseline/sample и evidence.context только null;
 5  жизненный цикл на memory-Prisma: карточка живёт, пока шаг не измеряется (повтор → unchanged, версий 0); измерение
    появилось → RESOLVED «условие сигнала больше не выполняется»; версия неизменяемая;
 6  повторный запуск, другие дневные числа и другое окно → тот же отпечаток и тот же хэш (version churn 0); другой состав
    пропусков → тот же отпечаток, другой хэш (новая версия);
 7  никаких причинных / психологических формулировок (violatesLanguagePolicy = null для title/fact/hypothesis/recommendation);
 8  реестр 19 детекторов, hourly-набор прежний [change.evaluation, quality.stale], INSIGHT_THRESHOLDS.eventGapMinFunnelVisits = 20,
    прежние 18 детекторов дают те же payloadHash с funnels и без них.
Панель: insights.test.tsx +1 (K7: карточка scope data → подпись «Качество измерения — не поведение клиентов» и чип
«качество данных, не поведение»; обычная карточка — «Гипотеза — не факт», чипа нет).
Итого: CRM jest 1078 / 1078 (99 suites; этап 12 — 63), панель vitest 42 / 42 (insights 7). nest build OK; tsc -b + vite build OK;
eslint crm-new src/analytics/insights 0; prettier чист; frontend eslint по аналитике 0.
```

## RECONCILIATION

```text
Копия 16.09 19:41, окна 02–08.09 → 09–15.09, cutoff 15.09:
A (HTTP, ADMIN JWT в процессе) = B (сервис против копии): matched 5, diffs 0 (канонические нагрузки карточек совпадают,
  в т. ч. quality.eventNotMeasured; change.evaluation исключена как уже поднятая версия); причины молчания B — те же
  коды/сущности (eventNotMeasured tshirt LOW_SAMPLE / canvas NO_MATERIAL_CHANGE в обоих).
A/B = C (прямой SQL по копии): 13 контрольных чисел (визиты / заявки / формы / принятые / оплаты / выручка / прибыль /
  покрытие ClientID / stale) + состав карточек — diffs 0. Шаги воронок в FACT совпадают с вкладкой «Поведение» этапа 10
  (тот же BehaviorMetricsService: photo catalog not_measured; tshirt choose_type_color / submit_tshirt_order not_measured;
  canvas canvas_upload not_measured; вход photo ≥ 20, tshirt 13).
Повтор run: created 0 / versioned 0 / unchanged 5 / reopened 0. Язык: запрещённых формулировок 0; causality всех карточек
NOT_ESTABLISHED; гипотез без пометки 0. PII: feed/quality/status/get/versions — только агрегаты; DTO с лишним полем → 400.
Производительность: daily 157 SQL (было 153: +4 SQL воронок этапа 10 на 3 воронки), 5,5 с через туннель; hourly 12 SQL, 1,4 с;
feed 3 SQL, 0,14 с.
```

## REGRESSION

```text
· Остальные 18 детекторов: те же payloadHash с funnels в контексте и без (тест 8); на копии карточки DEVICE_GAP / visits /
  clientIdCoverage / change.evaluation — те же тексты и числа, что до FIX_01 (§ 49), причины молчания те же коды
  (LOW_SAMPLE 30 → 31 только за счёт eventNotMeasured tshirt).
· Пороги остальных детекторов (INSIGHTS_RULES.md § 2), окна 7/7, hourly-набор, замок RUNNING, хук после тика — не менялись.
· Этапы 10/11: контракты (FunnelStep availability/not_measured, evaluateMetric, buildWindows) не трогались; их тесты —
  прежние, зелёные (входят в 1078). Этапы 06/09 — без правок.
· Побочная правка в insights-language.ts (в коммите 5f90e68): hypothesisText обрезает конечную пунктуацию тела и
  ставит точку перед «Причинность не установлена.» — только формат текста гипотез, содержимого не меняет; тесты
  языка зелёные.
· UI: у карточек не data-scope подпись «Гипотеза — не факт» прежняя (тест K7 проверяет обе ветки); 390 px без прокрутки.
```

## GIT

```text
feature/analytics-foundation: bbbf4bf (§ 49 docs) → 5f90e68 детектор EVENT_NOT_MEASURED (+ пороги EVENT_GAP_*, тесты 1–8,
UI-пометка data-scope, каноническая нагрузка без окон, unchanged двигает окно карточки) → 0d7e901 формулировка рекомендации
→ <docs> (INSIGHTS_RULES.md § 2/3/5/6, INSIGHTS_DATA_CONTRACT.md § 4/7, этот отчёт § 50, STATUS, master plan, current state,
скриншот). Изменённые файлы кода: insights-engine.ts, insights-rules.ts, insights-language.ts, analytics-insights.service.ts,
insights-event-gap.spec.ts (новый), frontend insights-sections.tsx, insights.test.tsx. Схема Prisma и миграции — без изменений.
origin/master = 5922175 (production), не менялся; master ⊂ feature. В main/master не сливалось.
```

## DEVIATIONS

```text
1. Для стабильности версии каноническая нагрузка всех детекторов больше не включает fact.period / baselinePeriod, а при
   неизменной нагрузке обновляются столбцы окна карточки (periodStart/End, baselineStart/End). На прежних карточках копии
   хэши не изменились (повтор → unchanged 5). Это уточнение § 4 контракта, а не смена архитектуры.
2. Пороговое условие «анализ реально ограничен» взято равным MIN_STEP_ENTRANTS = 20 правила 11.1 этапа 10 (а не 30 визитов
   MIN_SAMPLE_VISITS этапа 11): карточка появляется ровно тогда, когда правило отвала этапа 10 считалось бы, если бы шаг
   измерялся. Константа своя (EVENT_GAP_MIN_FUNNEL_VISITS), в status.thresholds.
3. Побочная правка формата hypothesisText (REGRESSION п. 4).
```

## OPEN_DECISIONS

```text
1. Классификация шагов EVENT_GAP_STEP_KINDS задана в коде по фактам этапа 10 (canvas_upload — не существует на сайте).
   Если владелец решит считать какой-то шаг намеренно неизмеряемым — добавить ключ в NOT_ON_SITE (без изменения детектора).
2. POST /insights/run и пороги V1 — прежние OPEN_DECISIONS § 49.
```

## PRODUCTION_UNTOUCHED

```text
Production CRM не менялся: master 5922175 (проверено git rev-parse origin/master), образы и контейнеры не пересоздавались,
/opt/raspechatka/.env и compose на сервере не редактировались, миграции production не применялись (82 applied, как до
FIX_01), таблиц AnalyticsInsight* в боевой базе crm нет (59 таблиц). Копия crm_stage12_test удалена, туннель закрыт,
локальные backend/vite остановлены. web-photo, event model сайта, Logs API, CI сайта — не трогались.
```
