# METRIKA_QUERY_CATALOG.md

# Каталог запросов к Reports API Яндекс Метрики (этап 07)

Единственный источник правды о том, какие измерения и метрики CRM забирает
из Метрики, — типизированный реестр `crm-new/src/metrika/analytics/metrika-query-catalog.ts`
(`DATASET_SPECS`). Этот документ — его человеческое описание; при
расхождении прав код, и документ надо поправить.

Общее для всех наборов:

```text
endpoint:        GET /stat/v1/data  (V1 Reports API), через YandexMetrikaClient.getStats
counter:         111569944
timezone:        Europe/Moscow — все даты набора это календарные дни счётчика;
                 в базе колонка DATE = «календарная дата Метрики в поясе счётчика»
date grain:      1 день (измерение ym:s:date / ym:pv:date)
lang:            ru — названия измерений на русском; ключами служат коды (id), они от языка не зависят
limit:           100 000 (максимум API); если total_rows больше — период делится пополам,
                 постраничного чтения (offset) нет: порядок равных строк между страницами не гарантирован
sort:            по измерению даты (детерминированный порядок, на результат не влияет)
attribution:     lastsign — «последний значимый переход» (источники, UTM); названо явно в имени измерения
accuracy:        политика «по умолчанию, при выборке — повтор с full» (см. ниже)
replacement:     за запрошенный период строки набора удаляются и вставляются заново в одной транзакции
live verified:   12.09.2026 — все семь наборов, `npm run metrika:sync -- verify`, sampled=false
```

## Политика точности (accuracy / sampling)

1. Первый запрос — без параметра `accuracy` (умолчание API: Метрика сама
   решает, нужна ли выборка).
2. Если в ответе `sampled=true`, тот же запрос повторяется с `accuracy=full`,
   и сохраняется **его** результат вместе с **его** признаком выборки.
3. В `MetrikaSyncRun` по каждому набору записываются `sampled`,
   `sampleShare`, `dataLag`, `accuracy` (`default` | `full`). Если выборка
   осталась даже при `full`, строка запуска так и говорит `sampled=true`,
   воркер пишет предупреждение, отчёт качества показывает период.

Так `accuracy=full` (в 8–10 раз медленнее на живом счётчике: 3 с против
0,3 с) включается только когда он меняет результат, а выборка никогда не
выдаётся за точные данные. На счётчике 111569944 за 90 дней ни один запрос
выборки не потребовал.

## Ограничения API, проверенные живьём 12.09.2026

| Что | Факт |
|---|---|
| Метрик в запросе | ≤ 20 (`4015 Exceeded number of metrics`) |
| Измерений в запросе | ≤ 10 |
| `ym:pv:*` + `ym:s:goal…` | несовместимы (`4011`) — у набора страниц нет целей |
| `ym:pv:visits` | не существует (`4002`) — у страниц только просмотры и посетители |
| Строки с нулевыми метриками | API не отдаёт: дни без визитов и цели без достижений отсутствуют в ответе |
| Пустое измерение | `{"name": null, "id": null}` — прямые заходы без движка, визит без UTM |
| Данные счётчика | с 2026-08-13 (создан в августе 2026); раньше — нули |

Из-за пропуска нулевых строк в запросах по целям есть **якорная метрика
`ym:s:visits`**: она возвращает каждый день с трафиком, и таблица целей
получается плотной — нули записаны явно, а не подразумеваются.

---

## Наборы

### traffic — `MetrikaDailyTraffic`

```text
dimensions:  ym:s:date
metrics:     ym:s:visits, ym:s:users, ym:s:pageviews
filters:     нет
grain:       1 строка = 1 день
unique key:  date
запросов:    1
live API verified: yes (12.09.2026)
```

`users` — уникальные посетители **за день**; сумма по дням ≠ уникальные за
период (за 06–12.09: сумма дневных 146, уникальных за период 128).

### goals — `MetrikaDailyGoal`

```text
dimensions:  ym:s:date
metrics:     ym:s:visits (якорь) + для каждой цели счётчика:
             ym:s:goal<id>reaches, ym:s:goal<id>visits, ym:s:goal<id>users
цели:        все цели счётчика из Management API на момент запуска (21 на 12.09.2026),
             по 6 целей в запросе (18 метрик + якорь = 19 ≤ 20)
grain:       день × goalId
unique key:  (date, goalId)
запросов:    ceil(целей / 6) — сейчас 4
live API verified: yes (12.09.2026)
```

Поля: `reaches` — достижения цели, `goalVisits` — целевые визиты,
`convertedUsers` — достигшие цели посетители. `goalName` и
`goalIdentifier` (идентификатор JS-события у целей типа `action`) —
справочно, из Management API. Конверсия не хранится: она равна
`goalVisits / MetrikaDailyTraffic.visits` за тот же день.

Историческое ограничение: JS-цели считают достижения только с момента
своего создания. У `lead_submitted` (611379890) за 90 дней ровно 2
достижения, оба 11.09.2026; четыре обязательные цели этапа 06 созданы
12.09.2026 ≈ 13:00 MSK. За август достижений нет не потому, что не было
заявок (в CRM за 23.08–12.09 — 97 принятых заказов), а потому, что не было
целей. Для исторических периодов заявки считать по CRM, не по Метрике.

### sources — `MetrikaDailySource`

```text
dimensions:  ym:s:date, ym:s:lastsignTrafficSource, ym:s:lastsignSourceEngine
metrics:     ym:s:visits, ym:s:users, ym:s:pageviews,
             ym:s:goal<lead>reaches, ym:s:goal<crmOrderCreated>reaches, ym:s:goal<crmOrderPaid>reaches
grain:       день × источник × движок
unique key:  (date, trafficSource, sourceEngine) — коды Метрики: ad, organic, direct, referral, social, …;
             движок — ad.Яндекс: Директ, organic.yandex, referral.chatgpt.com, …; '' — не определён
запросов:    1
live API verified: yes (12.09.2026)
```

Номера канонических целей подставляются из реестра
(`metrika-goal-registry.ts`) на каждом запуске; без любой из трёх набор
не собирается и честно падает (FAILED с причиной), а не пишет нули.

### utm — `MetrikaDailyUtm`

```text
dimensions:  ym:s:date, ym:s:lastsignUTMSource, ym:s:lastsignUTMMedium,
             ym:s:lastsignUTMCampaign, ym:s:lastsignUTMContent, ym:s:lastsignUTMTerm
metrics:     ym:s:visits, ym:s:users,
             ym:s:goal<lead>reaches, ym:s:goal<crmOrderCreated>reaches, ym:s:goal<crmOrderPaid>reaches
grain:       день × пять UTM
unique key:  (date, utmSource, utmMedium, utmCampaign, utmContent, utmTerm); '' — метки нет
запросов:    1
live API verified: yes (12.09.2026)
```

Это UTM **визита по Метрике**, не last-touch UTM, сохранённый в заказе CRM
(`OrderPhoto.utm*`). Их можно сравнивать, но нельзя смешивать. На счётчике
UTM почти нет: реклама Директа размечена yclid, а не UTM (за 90 дней 573 из
582 визитов без UTM; единственная кампания — `utm_source=chatgpt.com`).

### landings — `MetrikaDailyLanding`

```text
dimensions:  ym:s:date, ym:s:startURLPath
metrics:     ym:s:visits, ym:s:users,
             ym:s:goal<lead>reaches, ym:s:goal<crmOrderCreated>reaches, ym:s:goal<crmOrderPaid>reaches
grain:       день × путь страницы входа
unique key:  (date, landingPath) — путь как отдаёт Метрика; normalizedPath — нижний регистр без завершающего слэша
запросов:    1
live API verified: yes (12.09.2026)
```

Почему путь, а не полный URL (`ym:s:startURL`): у 200 из 238 строк полного
URL за 43 дня в параметрах — `etext`/`ybaip` Директа, уникальные на клик.
Такие строки — почти отдельные визиты, а этап 07 хранит только агрегаты
(раздел 28 ТЗ). Параметры входа, которые нужны аналитике (UTM), живут в
наборе `utm`.

### devices — `MetrikaDailyDevice`

```text
dimensions:  ym:s:date, ym:s:deviceCategory
metrics:     ym:s:visits, ym:s:users,
             ym:s:goal<lead>reaches, ym:s:goal<crmOrderCreated>reaches, ym:s:goal<crmOrderPaid>reaches
grain:       день × устройство
unique key:  (date, deviceRaw) — код Метрики: desktop | mobile | tablet | tv
normalized:  deviceCategory — desktop | mobile | tablet | other (tv и неизвестное → other)
запросов:    1
live API verified: yes (12.09.2026)
```

### pages — `MetrikaDailyPage`

```text
dimensions:  ym:pv:date, ym:pv:URLPath
metrics:     ym:pv:pageviews, ym:pv:users
grain:       день × путь страницы
unique key:  (date, pagePath); normalizedPath — как у страниц входа
запросов:    1
live API verified: yes (12.09.2026)
```

Ограничения: визитов по странице нет (`ym:pv:visits` не существует), целей
нет (другое пространство имён). `ym:pv:pageviews` за период (1142 за
06–12.09) ≠ `ym:s:pageviews` (1023): первое — все просмотры-хиты, второе —
просмотры внутри визитов; оба сходятся с прямым API каждый по-своему.
Товар из пути не выводится: сопоставление `путь → товар/категория CRM`
неоднозначно (главная, `/formaty`, `/thanks`) — отложено до этапа 08.

---

## Реестр канонических целей

Правда — Management API; в коде только правила поиска (`CANONICAL_GOAL_RULES`)
и ожидаемые номера из `GOALS_MANIFEST.md` (`EXPECTED_GOAL_IDS`) для
предупреждения о расхождении.

| Ключ реестра | Как ищется | Номер (12.09.2026) |
|---|---|---|
| canonicalLeadGoalId | JS-событие `lead_submitted` | 611379890 |
| photoLeadGoalId | JS-событие `lead_submitted_photo` | 612290270 |
| canvasLeadGoalId | JS-событие `lead_submitted_canvas` | 612290370 |
| tshirtLeadGoalId | JS-событие `lead_submitted_tshirt` | 612290451 |
| formErrorGoalId | JS-событие `form_error` | 612290566 |
| crmOrderCreatedGoalId | тип `cdp_order_in_progress` | 596990603 |
| crmOrderPaidGoalId | тип `cdp_order_paid` | 596990604 |
| crmOrderCancelledGoalId | тип `cdp_order_cancelled` | 596990606 |
| crmOrderSpamGoalId | тип `cdp_order_spam` | 596990605 |
| legacyThanksGoalId | URL-цель, условие содержит `/thanks` | 602316919 |

JS-цель = `type: "action"`, идентификатор события в `conditions[].url`.
Системные CRM-цели ищутся по типу, потому что их название можно сменить в
интерфейсе, а тип — нет.

---

## Расписание и запуски

```text
scheduler:      MetrikaAnalyticsSchedulerService — каждый час окно 3 дня (сегодня, вчера, позавчера
                по Москве); первый тик нового московского дня — окно 21 день (глубина
                сопоставления заказов CRM с ClientID). Первый тик — через 90 с после старта.
flag:           YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED (по умолчанию false; CLI работает всегда)
lock:           pg_try_advisory_lock(700701) в отдельном соединении на время всего запуска;
                занято → LOCKED, ничего не пишется
journal:        MetrikaSyncRun — строка на набор и период; RUNNING → SUCCESS | FAILED;
                зависшие RUNNING старше часа закрываются как FAILED на следующем запуске
requests/run:   11 на полный запуск (1 список целей + 10 отчётов) — 24 запуска в сутки ≈ 270 запросов
CLI:            npm run metrika:sync -- --from YYYY-MM-DD --to YYYY-MM-DD [--dataset …]
                npm run metrika:sync -- status | verify | reconcile | quality | coverage
```
