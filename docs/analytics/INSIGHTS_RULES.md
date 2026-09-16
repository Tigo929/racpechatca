# INSIGHTS_RULES.md

# Детекторы V1 и пороги движка сигналов (этап 12)

## Статус

```text
IMPLEMENTED 16.09.2026 — crm-new/src/analytics/insights/insights-engine.ts (детекторы), insights-rules.ts (все пороги V1,
отдаются в GET /analytics/dashboard/insights/status → thresholds). Статистика, MDE, сопоставимость и созревание —
из этапа 11 (evaluateMetric / computeConfounders на скользящих окнах 7/7), своих формул у этапа 12 нет.
FIX_01 (16.09.2026): детектор quality.eventNotMeasured — 19 детекторов; пороги остальных не менялись.
```

## 1. Общее

- **Окна**: последние 7 полных московских дней («после») против предыдущих 7 («до»); строятся `buildWindows` этапа 11
  с `startedAt = 00:00 MSK` первого дня «после» → оба окна целые недели, `WEEKDAY_MIX_MISMATCH` не возникает.
  Данные Метрики начинаются с 13.08.2026 — при нехватке истории запуск `SKIPPED`.
- **Оценка метрики** = `evaluateMetric(key, 'secondary', inputs)` этапа 11 с псевдо-изменением
  `{changeType: 'ANALYTICS', expectedDirection: 'NEUTRAL'}`: сопоставимость по `availableFrom` и `definitionCutovers`
  (12.09 — единый `lead_submitted`), гейт выборки (`LOW_SAMPLE`: < 30 визитов / < 5 событий / < 5 заказов), созревание
  (accepted / paid по эмпирике CRM), статистика (Wilson/Newcombe/z/Фишер/Пуассон/бутстрэп), MDE и требуемая выборка,
  вердикт `POSITIVE_SIGNAL … INCOMPARABLE`.
- **Сигнал ≠ существенность**: `statisticalStrength` (вердикт этапа 11) и `businessMateriality` (пороги ниже) хранятся
  отдельно; карточка появляется только при `SIGNAL` **и** `MATERIAL`; иначе — причина молчания в диагностике.
- **Полярность**: как в каталоге этапа 11, кроме `visits` — контекст (`neutral`): изменение трафика всегда `INFO`.
- **Уровни**: `INFO` — наблюдение / положительный сигнал / качество данных / оценка этапа 11; `ATTENTION` — существенный
  отрицательный сигнал, прошедший гейты; `CRITICAL` — только пять ситуаций (§ 3).

## 2. Пороги (`insights-rules.ts`)

| Порог | Значение | Где применяется |
|---|---|---|
| `ROLLING_WINDOW_DAYS` | 7 | окна daily-запуска |
| `MIN_SAMPLE_VISITS` / `MIN_EVENTS` / `MIN_ORDERS` | 30 / 5 / 5 | гейт выборки этапа 11 |
| `MIN_ENTITY_VISITS` | 30 | источник / страница входа — меньше в обоих окнах → `LOW_SAMPLE` |
| `MATERIAL_RATE_POINTS` | 2 п.п. | доли: существенность |
| `MATERIAL_COUNT_RELATIVE` / `MATERIAL_COUNT_ABSOLUTE` | 20 % и 10 единиц | счётчики (визиты, заказы) — оба условия |
| `MATERIAL_MONEY_RUB` / `MATERIAL_MONEY_RELATIVE` | 5 000 ₽ и 10 % | деньги — оба условия |
| `MATERIAL_ERROR_VISITS` | 5 визитов с ошибкой | ошибки форм: минимум затронутых |
| `MIX_SHIFT_POINTS` | 15 п.п. | сдвиг смеси источников (как confounder этапа 11) |
| `MIRRORS_GLOBAL_TRAFFIC_POINTS` | 20 п.п. | источник/страница, движущиеся вместе с общим трафиком, карточки не получают |
| `CRITICAL_LEADS_VANISHED_MIN_VISITS` / `…_BASELINE_LEADS` | 150 визитов / 3 заявки | заявки исчезли |
| `CRITICAL_FUNNEL_BREAK_MIN_VISITS` / `…_BASELINE_STARTS` | 100 визитов / 5 форм | обрыв воронки |
| `CRITICAL_FORM_ERROR_VISITS` | 10 визитов | подтверждённый рост ошибок |
| `CRITICAL_STALE_SECONDS` | 6 ч | просрочка данных (порог STALE этапа 08 — меньше, даёт ATTENTION) |
| `CLIENT_ID_COVERAGE_MIN_PCT` / `…_MIN_ACCEPTED` | 50 % / 5 принятых | DATA_QUALITY покрытие ClientID |
| `EVENT_GAP_MIN_FUNNEL_VISITS` | 20 визитов | FIX_01: не измеряемый шаг ограничивает анализ отвала, только если на входе измеренной части воронки в окне «после» не меньше этого числа (= `MIN_STEP_ENTRANTS` правила 11.1 этапа 10); меньше → `LOW_SAMPLE`, карточки нет |
| `EVENT_GAP_STEP_KINDS` | catalog / choose_type_color / submit_tshirt_order → `INSTRUMENTATION_GAP`; canvas_upload → `NOT_ON_SITE` | FIX_01: вид пропуска по ключу шага этапа 10; `NOT_ON_SITE` (шага на сайте не существует) анализу не нужен — карточки нет (`NO_MATERIAL_CHANGE` с объяснением); неизвестный шаг — по примечанию этапа 10 («не существует» / «нет на сайте» → `NOT_ON_SITE`), иначе `INSTRUMENTATION_GAP` |
| `REOPEN_WINDOW_DAYS` / `COOLDOWN_DAYS` / `MAX_ACTIVE_PER_DETECTOR` | 7 / 3 / 3 | жизненный цикл (INSIGHTS_DATA_CONTRACT.md § 4) |

Статистические допущения — этапа 11: α 0,05 двусторонний, мощность 0,8, целевой эффект 20 %.

## 3. Таблица детекторов

| id | Категория | Входные метрики | Окно | Мин. выборка | Существенность | Стат. гейт | Гейты качества | Уровень | Причины молчания | Гипотеза (шаблон) | Рекомендация (шаблон) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `traffic.visits` | TRAFFIC_CHANGE | visits | 7/7 | 30 визитов | count | Пуассон (этап 11) | stale, сопоставимость | INFO всегда (полярность neutral) | LOW_SAMPLE, INSUFFICIENT_DATA, NO_MATERIAL_CHANGE, MEASUREMENT_DEFINITION_CHANGED | «изменение визитов совпало со сдвигом долей источников»; «визиты источника «X» снизились более чем вдвое» | наблюдать; зарегистрировать изменение перед правкой |
| `site.leadRate` | SITE_CONVERSION_CHANGE | siteLeadRate (+ siteLeads, visits) | 7/7 | 30 визитов, 5 событий | 2 п.п. | z / Фишер + MDE | availableFrom 12.09, cutover 13.09, stale | ATTENTION при падении, INFO при росте; **CRITICAL**: заявок 0 при ≥ 150 визитах и ≥ 3 в базе | как выше + IMMATURE не бывает (immediate) | devices-mix / формы-ошибки / источники / пересекающиеся изменения (§ 5) | CHECK_TECHNICAL / CHECK_MANUALLY / COMPARE_SEGMENT / OBSERVE (§ 6) |
| `site.formStartRate` | FUNNEL_DROPOFF | formStartRate (+ formStarts) | 7/7 | 30 / 5 | 2 п.п. | z / Фишер | form_started с 10.09 | ATTENTION / INFO; **CRITICAL**: форм 0 при ≥ 100 визитах и ≥ 5 в базе | как выше | как для конверсии | как для конверсии |
| `site.formErrorRate` | FORM_ERROR_CHANGE | formErrorRate (+ formErrors, formStarts) | 7/7 | начавших форму ≥ 30, событий ≥ 5 | рост и ≥ 5 визитов с ошибкой | z / Фишер | form_error с 10.09 | ATTENTION; **CRITICAL** при ≥ 10 визитов с ошибкой | LOW_SAMPLE, NO_MATERIAL_CHANGE (нет роста / < 5 визитов) | «рост ошибок формы совпал по времени со снижением завершения формы» — только если конверсия упала | CHECK_TECHNICAL |
| `stage10.issues` | по правилу: FUNNEL_DROPOFF / DEVICE_GAP / FORM_ERROR_CHANGE / LANDING_CHANGE / SITE_CONVERSION_CHANGE | `BehaviorMetricsService.getIssues(after)` | окно «после» + предыдущее этапа 10 | правила этапа 10 | правила этапа 10 | правила этапа 10 | `skipped` этапа 10 → PARTIAL_BEHAVIOR_PERIOD / LOW_SAMPLE / INCOMPARABLE_PERIODS | как у правила этапа 10 | как `skipped` | гипотеза правила этапа 10 (с пометкой «Гипотеза:») | рекомендация правила этапа 10 |
| `source.mixShift` | SOURCE_MIX_SHIFT | доли источников (confounder этапа 11) | 7/7 | 30 визитов | ≥ 15 п.п. | нет (описательно) | — | INFO | NO_MATERIAL_CHANGE | нет | COMPARE_SEGMENT |
| `source.performance` | SOURCE_PERFORMANCE_CHANGE | visits, siteLeads по источнику (getTrafficSources) | 7/7 | 30 визитов в одном из окон; доля заявок — 30 в обоих и 5 событий | визиты: 20 % и 10; доля: 2 п.п. | Пуассон; доли — computeStatistics этапа 11 | сопоставимость siteLeadRate | ATTENTION при падении доли заявок; INFO иначе | LOW_SAMPLE, INSUFFICIENT_DATA, NO_MATERIAL_CHANGE, DUPLICATE (движется с общим трафиком) | нет | COMPARE_SEGMENT |
| `landing.change` | LANDING_CHANGE | visits, siteLeads по странице входа (getLandings) | 7/7 | как источники | как источники | как источники | как источники | как источники | как источники | нет | COMPARE_SEGMENT |
| `product.change` | PRODUCT_CHANGE | acceptedOrders по категории (getProducts) | 7/7 | 5 событий | 20 % и 10 | Пуассон | — | INFO; ограничения CRM_INCLUDES_OFFLINE, IMMATURE_OUTCOME | LOW_SAMPLE, INSUFFICIENT_DATA, NO_MATERIAL_CHANGE | нет | CHECK_MANUALLY |
| `crm.leadToAccepted` | CRM_CONVERSION_CHANGE | leadToAcceptedRate (когорты) | 7/7 | 5 заказов | 2 п.п. | z / Фишер | созревание accepted (эмпирика, ~1 день) | ATTENTION / INFO | IMMATURE, LOW_SAMPLE, … | нет | CHECK_MANUALLY |
| `crm.leadToPaid` | CRM_CONVERSION_CHANGE | leadToPaidRate | 7/7 | 5 | 2 п.п. | z / Фишер | созревание paid (14 дн. по умолчанию) | ATTENTION / INFO | IMMATURE (для 7-дневного окна — всегда, пока когорта не созрела) | нет | CHECK_MANUALLY |
| `money.realizedRevenue` | REVENUE_CHANGE | realizedRevenue (P&L этапа 08) | 7/7 | 5 заказов | 5 000 ₽ и 10 % | нет (сумма — описательно → INSUFFICIENT_DATA у этапа 11) | созревание paid; COGS | INFO / ATTENTION — практически всегда IMMATURE/DESCRIPTIVE | IMMATURE, INSUFFICIENT_DATA | нет | CHECK_MANUALLY |
| `money.netProfit` | PROFIT_CHANGE | netProfit | 7/7 | 5 | 5 000 ₽ и 10 % | нет | COGS_INCOMPLETE → INSUFFICIENT_DATA; созревание | как выше | IMMATURE, COGS_INCOMPLETE | «при сопоставимом объёме заказов изменилась прибыль» — только если заказы ±20 % и COGS полная | CHECK_MANUALLY |
| `change.evaluation` | CHANGE_EVALUATION | последняя оценка каждого ACTIVE/COMPLETED изменения этапа 11 | окна оценки | — | — | вердикт этапа 11 без переинтерпретации | флаги оценки | INFO; ATTENTION при NEGATIVE_SIGNAL | INSUFFICIENT_DATA (оценок нет), DUPLICATE (версия уже поднята) | «Гипотеза: INTERPRETATION этапа 11» | RECOMMENDATION этапа 11 дословно |
| `quality.stale` | DATA_QUALITY | freshness (последний SUCCESS тик) | — | — | — | — | — | ATTENTION при STALE; CRITICAL при NO_DATA или ≥ 6 ч | NO_MATERIAL_CHANGE (свежие) | нет | IMPROVE_DATA_QUALITY |
| `quality.clientIdCoverage` | DATA_QUALITY | clientIdCoverageAccepted (overview) | «после» | 5 принятых | < 50 % | — | — | INFO (одна продолжающаяся карточка) | LOW_SAMPLE, NO_MATERIAL_CHANGE | нет | IMPROVE_DATA_QUALITY |
| `quality.cogs` | DATA_QUALITY | COGS_UNRELIABLE_ORDERS в окнах | 7/7 | — | — | — | — | INFO | NO_MATERIAL_CHANGE | нет | IMPROVE_DATA_QUALITY |
| `quality.paidWithoutDate` | DATA_QUALITY | orders.paidWithoutDate (этап 08) | «после» | — | > 0 | — | — | INFO | NO_MATERIAL_CHANGE | нет | IMPROVE_DATA_QUALITY |
| `quality.eventNotMeasured` (FIX_01) | DATA_QUALITY | воронки этапа 10 (`behavior.funnels`): шаги с `availability = not_measured` | «после» | ≥ 20 визитов на входе измеренной части (`EVENT_GAP_MIN_FUNNEL_VISITS`) | есть хотя бы один пропуск вида `INSTRUMENTATION_GAP` | — | — | INFO всегда (одна агрегированная карточка на воронку, `entityKey` = ключ воронки; уровень от числа пропусков не растёт) | LOW_SAMPLE (вход < 20 — анализ отвала не идёт, пропуск ничего не ограничивает), NO_MATERIAL_CHANGE (все пропуски `NOT_ON_SITE`) | `NO_SUPPORTED_HYPOTHESIS` («отсутствие измерения — факт настройки счётчика, а не поведение клиентов») | IMPROVE_DATA_QUALITY: проверить измерение шага в счётчике (цель на уже отправляемое событие; иначе зафиксировать шаг как намеренно неизмеряемый или запланировать измерение отдельным решением); event model web-photo не менять; выводов об отвале на этих шагах не делать |

Режим обновления: `change.evaluation` и `quality.stale` — `hourly` (лёгкий контекст без загрузки окон, 12 SQL);
остальные — `daily` (полный контекст, ~140–157 SQL, число не зависит от числа заказов/страниц).

FACT `quality.eventNotMeasured` называет: какой анализ ограничен (отвал воронки «X», правило этапа 10), какой шаг не
измеряется (подпись шага и примечание этапа 10), что значение шага — `not_measured`, а не 0, и какие выводы нельзя
сделать (по месту шага среди измеренных: «нельзя посчитать конверсию из «A» в «B»», «переход «A» → «B» нельзя разложить
через «X»», «нельзя измерить завершение воронки после «A»»). Дневные числа шагов и окно в FACT не входят — иначе версия
росла бы каждый день без изменения сути (числа — во вкладке «Поведение»); состав пропусков — суть: другой набор → новая
версия при том же отпечатке. В `evidence.context` не измеряемые шаги — `before/after = null`; ограничения
`NOT_MEASURED_STEPS`, `STAGE10_RULE_MIRROR`. Карточка живёт, пока шаг не измеряется; появилось измерение → `RESOLVED`
(условие пропало), новый пропуск в окне переоткрытия → та же карточка, позже → новый эпизод (INSIGHTS_DATA_CONTRACT.md § 4).

## 4. Правила уровня CRITICAL (закрытый список)

1. Заявки с сайта исчезли: `siteLeads.after = 0` при `visits.after ≥ 150` и `siteLeads.before ≥ 3` (метрика сопоставима).
2. Обрыв воронки: `formStarts.after = 0` при `visits.after ≥ 100` и `formStarts.before ≥ 5`.
3. Ошибки форм: рост доли ошибок и ≥ 10 визитов с ошибкой (5–9 — ATTENTION).
4. Данные Метрики: NO_DATA или возраст ≥ 6 ч (STALE моложе — ATTENTION).
5. Правило этапа 10 со своим CRITICAL (например, DEVICE_GAP) — зеркалится с тем же уровнем.

Большой относительный процент на малой выборке CRITICAL не даёт никогда (гейт выборки срабатывает раньше).

## 5. Генератор гипотез V1 (rule-based, только из сопутствующих фактов)

| Основной сигнал | Сопутствующие факты | Гипотеза |
|---|---|---|
| конверсия / начало формы изменились | confounder `DEVICE_MIX_SHIFT` | сдвиг структуры устройств может быть одним из факторов |
| то же | `formErrorRate` NEGATIVE_SIGNAL или рост ≥ 2 п.п. при ≥ 5 визитах с ошибкой | рост ошибок формы совпал по времени со снижением завершения формы — проверить форму |
| то же | confounder `SOURCE_MIX_SHIFT` | изменилась структура источников — сравнение может отражать смену аудитории |
| то же | confounder `OVERLAPPING_CHANGE` | действовали зарегистрированные изменения — разницу нельзя приписать одному |
| визиты изменились | `SOURCE_MIX_SHIFT`; источник с ≥ 30 визитов упал ≥ вдвое | совпало со сдвигом долей / падением источника «X» |
| прибыль изменилась | принятые заказы ±20 %, COGS полная | при сопоставимом объёме заказов изменилась прибыль — проверить структуру выручки и затрат |
| ошибки форм выросли | конверсия упала | совпадение по времени — проверить форму |
| иначе | — | `NO_SUPPORTED_HYPOTHESIS` («Гипотезы нет: сопутствующих фактов … не найдено») |
| пропуск измерения (`quality.eventNotMeasured`) | — | всегда `NO_SUPPORTED_HYPOTHESIS` («Гипотезы нет: отсутствие измерения — известный факт настройки счётчика, а не поведение клиентов») |

Каждая гипотеза: префикс «Гипотеза: », суффикс «Причинность не установлена.», список поддерживающих фактов числами.
Психологических объяснений («не нравится», «отпугивает», «слабый CTA») нет и быть не может (INSIGHTS_LANGUAGE_POLICY.md).

## 6. Генератор рекомендаций V1

| Условие | kind | Текст |
|---|---|---|
| есть `OVERLAPPING_CHANGE` | OBSERVE | не делать вывода до чистого окна; оценивать изменение через «Рост / Изменения» |
| гипотеза про ошибки | CHECK_TECHNICAL | проверить форму и логи; ошибки по устройствам и полям во вкладке «Поведение» |
| гипотеза про устройства | CHECK_MANUALLY | пройти путь до заявки на проблемном устройстве |
| гипотеза про источники | COMPARE_SEGMENT | сравнить источник с наибольшим сдвигом; выводы о конверсии только внутри источника |
| CRM / P&L метрика | CHECK_MANUALLY | проверить вклад каналов и категорий; итоги CRM не приписывать сайту без оценки этапа 11 |
| иначе | OBSERVE | наблюдать; перед следующей правкой зарегистрировать изменение |
| Stage 11 | USE_STAGE11_RECOMMENDATION | RECOMMENDATION оценки дословно |
| качество данных | IMPROVE_DATA_QUALITY | конкретное действие по данным (COGS, даты оплат, покрытие, синхронизация) |
| пропуск измерения шага | IMPROVE_DATA_QUALITY | проверить измерение шага в счётчике Метрики (цель на уже отправляемое событие; иначе зафиксировать шаг как намеренно неизмеряемый или запланировать измерение отдельным решением); event model web-photo в рамках этапа 12 не менять; выводов об отвале на этих шагах до появления измерения не делать |
| источник / страница | COMPARE_SEGMENT | сравнить сегменты; объём трафика сам по себе не хороший и не плохой |

Рекомендации никогда не предлагают отключить рекламу, менять бюджет, цены, удалять страницы или откатывать сайт.
