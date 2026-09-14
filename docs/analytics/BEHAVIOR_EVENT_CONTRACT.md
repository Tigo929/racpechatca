# BEHAVIOR_EVENT_CONTRACT.md

# Контракт поведенческих событий сайта (этап 10, аудит 14.09.2026)

## Статус

```text
AUDITED 14.09.2026 — по production-коду сайта (web-photo, ветка feature/cms-admin = 8a9b33c,
образ web выложен auto-update 14.09 18:20 MSK) и по целям счётчика 111569944 (Management API,
read-only, 14.09.2026 22:29 MSK). Документация этапа 04 (04_EVENT_MODEL.md, EVENT_CATALOG.md)
проверена против кода, а не принята на веру.
```

Источник истины по событиям — `apps/web/src/lib/metrika.ts` (`METRIKA_GOALS`, `reachGoal`,
`sanitizeGoalParams`) и `apps/web/src/lib/lead-events.ts` (`reportLeadSubmitted`). Все вызовы
идут только через `METRIKA_GOALS` (тип `MetrikaGoal` закрепляет это компилятором). Литеральных
имён целей вне реестра в коде нет (проверено `git grep`).

---

# 1. Как события попадают в Метрику — три фильтра

1. **Согласие на cookie.** Счётчик (`components/Analytics.tsx`) инициализируется только при
   `cookie choice = accepted` (или внутри фрейма Метрики). Без согласия `window.ym` нет →
   `reachGoal` молча выходит. Все поведенческие цифры — только по посетителям с согласием.
   Это же причина пустого `yandexClientId` у естественных заявок (этапы 08–09).
2. **Цель в счётчике.** Метрика записывает `reachGoal(name)` только если в счётчике есть
   JS-цель (`action`) с этим идентификатором. Событие без цели теряется без следа и не
   восстанавливается задним числом (`GOALS_MANIFEST.md`). Из 34 событий реестра целями
   покрыты **14**.
3. **`sanitizeGoalParams`.** Из параметров вырезаются ключи `name, phone, email, contactValue,
   comment, note, address`. В Метрике параметры цели становятся **параметрами визита**
   (`ym:s:paramsLevel1/2`), поэтому они доступны Reports API — см. § 5.

Метрика не хранит порядок событий внутри визита в Reports API: доступны только «в визите
достигнута цель X» (`ym:s:goal<id>IsReached`) и счётчики достижений. Последовательности —
только Logs API (не включён, решение Reviewer) — см. § 7.

---

# 2. Реестр событий: код сайта × цели счётчика

Колонки: событие; где вызывается (production-код); семантика; параметры (после sanitize);
цель в счётчике (id) и первое достижение в локальных данных (`MetrikaDailyGoal`, 13.08–14.09);
годится ли для шага воронки.

## 2.1 Общие события заявки (все формы)

| Событие | Где вызывается | Семантика | Параметры | Цель | Воронка |
|---|---|---|---|---|---|
| `form_started` | `product/OrderPanel.tsx:149` (фото, `onFocusCapture`, **один раз** на монтирование); `canvas/CanvasOrderForm.tsx:232` (холст, один раз, `started` state); `marketing/ContactForm.tsx:168` (контакты, `onFocus` поля **без дедупликации** — повторные фокусы = повторные события) | Пользователь начал заполнять форму | фото: `productSlug, productName`; холст: `product:'canvas', size`; контакты: `form:'contact'` | **611379430** «Сколько людей вообще начали заполнять», первое достижение 10.09.2026 | да — шаг 2 общей воронки (счётчик визитов, не событий: у контактов события дублируются) |
| `lead_submit_attempt` | `OrderPanel.tsx:231` (после успешной клиентской валидации, до `fetch`); `CanvasOrderForm.tsx:312`; `ContactForm.tsx:93` | Форма прошла проверку, отправка на сервер начата | фото: `order_price, price, currency, productSlug, productName, quantity`; холст: `product:'canvas'`; контакты: `form:'contact', topic` | **611379504**, первое достижение 11.09.2026 | да — шаг 3. **Футболки и мерч не шлют** (у них `submit_tshirt_order`) |
| `lead_submitted` | только `lib/lead-events.ts:58` через `reportLeadSubmitted` — из ветки `response.ok` пяти форм: фото `OrderPanel:251`, холст `CanvasOrderForm:368`, футболка `TshirtLeadForm:180`, мерч `MerchForm:127`, контакты `ContactForm:128` | Сервер принял заявку (ровно одно значение; не «нажал», не «оплатил») | `product` (photo/canvas/tshirt/merch/contact) + `order_price, quantity, productSlug, productName, size, product_id, topic, kind, currency:'RUB'` | **611379890** (канон `lead`), первое достижение 11.09.2026 | да — шаг 4 (финал) |
| `lead_submitted_photo` | вместе с `lead_submitted` для `product=photo` | Заявка фотопечати | те же | **612290270**, создана 12.09.2026, первое достижение 13.09 | да — финал воронки «Фото» |
| `lead_submitted_canvas` | для `product=canvas` | Заявка холста | те же | **612290370**, создана 12.09.2026, достижений пока 0 | да — финал «Холст» |
| `lead_submitted_tshirt` | для `product=tshirt` **и `merch`** | Заявка футболки/мерча | те же | **612290451**, создана 12.09.2026, достижений 0 | да — финал «Футболки» |
| `form_error` | `OrderPanel.tsx:180` `{product:'photo', field}`; `CanvasOrderForm.tsx:290` `{product:'canvas', field}`; `TshirtLeadForm.tsx:127` `{product:'tshirt', field}`; `ContactForm.tsx:80` `{form:'contact', field}`. **Мерч не шлёт.** | Клиентская валидация отбила форму; `field` — первое поле с ошибкой (`name, phone, contactValue, contacts, consent, agreed, delivery, paperType, comment, quantity, form, unknown`) | `product|form, field` | **612290566**, создана 12.09.2026, первое достижение 13.09 (3 достижения / 1 визит) | да — анализ ошибок; `field` доступен через параметры визита |

Ошибка **сервера** (`fetch` не `ok`) у фото / холста / контактов **события не даёт** — DATA GAP (§ 6).

## 2.2 Футболки (`/futbolki/*`, `/merch`)

| Событие | Где | Семантика | Параметры | Цель | Воронка |
|---|---|---|---|---|---|
| `view_tshirt_catalog` | `catalog/CatalogViewTracker.tsx:21` на `/futbolki/printy` и `/futbolki/printy/[slug]` (категория), `useEffect` | Показ каталога принтов | `items, category?` | **нет** | нет (теряется) |
| `view_product` | `CatalogViewTracker.tsx:45` (`ProductViewTracker`) на `/futbolki/printy/[slug]` (карточка принта) | Показ карточки принта | `product_id, product_name, price` | **нет** | нет |
| `view_custom_tshirt` | `tshirt/CustomTshirtViewTracker.tsx:19` на `/futbolki/[intent]` | Открыт конструктор «своя футболка» | `intent` (слаг намерения) | **611381532**, первое достижение 10.09 | да — шаг 1 воронки «Футболки» |
| `choose_shirt_type` | `tshirt/TshirtConfigurator.tsx:105` | Выбор кроя | `value` | **нет** | нет |
| `choose_color` | `TshirtConfigurator.tsx:129` | Выбор цвета | `value` | **нет** | нет |
| `choose_size` | `TshirtConfigurator.tsx:157` | Выбор размера | `value` | **611382416**, первое достижение 12.09 | да — шаг 2 |
| `add_tshirt_lead` | `tshirt/TshirtLeadForm.tsx:250` (`onFocus` поля имени, **без дедупликации**); `tshirt/MerchForm.tsx:232` (`{kind:'merch'}`) | Дошёл до формы заявки (аналог `form_started` для футболок) | — / `kind:'merch'` | **611384704**, первое достижение 13.09 | да — шаг 3 (считать визиты, не события) |
| `submit_tshirt_order` | `TshirtLeadForm.tsx:139` `{product_id, quantity}`; `MerchForm.tsx:94` `{kind:'merch', quantity}` | Попытка отправки (аналог `lead_submit_attempt`) | | **нет** | нет — шаг попытки у футболок **не измеряется** (DATA GAP) |
| `submit_tshirt_order_success` | `TshirtLeadForm.tsx:174`; `MerchForm.tsx:123` — вместе с `lead_submitted(_tshirt)` | Сервер принял | `product_id, quantity` / `kind` | **611379979**, достижений 0 | дубль `lead_submitted_tshirt` (исторический счётчик заявок футболок) |
| `submit_tshirt_order_error` | `TshirtLeadForm.tsx:198`; `MerchForm.tsx:139` | Сервер/сеть отказали | `product_id` / `kind` | **611386291**, первое достижение 13.09 (1) | да — серверные ошибки футболок |
| `select_product`, `configure_tshirt`, `choose_print_position`, `upload_print`, `cross_sell_click` | **не вызываются** (объявлены в реестре, вызовов в коде нет) | — | — | нет | нет — шаги «позиция принта» и «загрузка макета» из ТЗ этапа 10 **не существуют** |

## 2.3 Холст (`/interer/holst`, `/interer/holst/[size]/zakaz`)

| Событие | Где | Семантика | Параметры | Цель | Воронка |
|---|---|---|---|---|---|
| `canvas_format_select` | `canvas/CanvasProduct.tsx:66` (`/interer/holst`) | Выбор формата (портрет/альбом/квадрат/панорама) | `format` | **нет** | нет |
| `canvas_size_select` | `CanvasProduct.tsx:71`; `CanvasOrderForm.tsx:218` | Выбор размера | `product:'canvas', size` | **нет** | нет |
| `canvas_send_photo_later` | `CanvasOrderForm.tsx:315` — **всегда** вместе с `lead_submit_attempt` | Фото пришлют в переписке (единственный сценарий: загрузки с сайта нет) | `product:'canvas'` | **нет** | нет; смысла как отдельный шаг не имеет |
| `canvas_upload_click` | `canvas/CanvasEditor.tsx:263` — компонент **не смонтирован** ни на одной странице | мёртвый код | | нет | нет |
| `canvas_upload_success`, `canvas_quality_warning`, `canvas_edge_select`, `canvas_extra_open` | **не вызываются** | — | | нет | нет — шаги «загрузка», «предупреждение о качестве», «края» из ТЗ этапа 10 **не существуют** на сайте: холст оформляется без загрузки файла |

Реальная воронка холста сегодня: визит на `/interer/holst*` → `form_started{product:canvas}` →
`lead_submit_attempt{product:canvas}` → `lead_submitted_canvas`. Разделить `form_started`
по направлениям в Метрике можно только через параметр визита `product` (§ 5), не через цели.

## 2.4 Фото (`/catalog/[slug]`, категории `/[category]`)

| Событие | Где | Семантика | Параметры | Цель |
|---|---|---|---|---|
| e-commerce `detail` (dataLayer) | `OrderPanel.tsx:113` `trackProductDetail` | Просмотр товара фотопечати | id, name, price, brand, category | не цель — отчёт «Электронная коммерция» |
| `form_started` / `form_error` / `lead_submit_attempt` / `lead_submitted(_photo)` | см. § 2.1 | | `productSlug, productName` (у `form_started`/`attempt`), `product:'photo'` (у `form_error`/`lead_submitted`) | |

Событий «просмотр каталога / карточки» для фото как целей нет; шаг 1 воронки «Фото» — визиты
со страницей входа `/catalog/*` или `/[category]` (по агрегатам страниц входа), не событие.

## 2.5 Контакты и клики

| Событие | Где | Параметры | Цель |
|---|---|---|---|
| `phone_click` | `TrackedPhoneLink.tsx:21` | `location` | **611380045**, достижений 0 за 33 дня |
| `messenger_click` | `MessengerLink.tsx:60` | `channel` (название мессенджера), `location` | **611380009**, первое достижение 10.09 |
| `reviews_source_click` | `TrackedReviewLink.tsx:21` | `source` | **нет** |
| авто-цели Метрики | «отправка формы» **602325854** (form, с 26.08), «переход в мессенджер» **608401685** (с 05.09), URL `/thanks` **602316919** (с 30.08) | — | исторические прокси заявок до 10.09 (в этапах 08–09 — `legacyThanks`) |

---

# 3. Даты доступности (cutover)

| Что | availableFrom | Основание |
|---|---|---|
| Счётчик (визиты, страницы, устройства) | 2026-08-13 | `COUNTER_DATA_SINCE` |
| `form_started`, `lead_submit_attempt`, `lead_submitted`, `view_custom_tshirt`, `choose_size`, `add_tshirt_lead`, `submit_tshirt_order_*`, `messenger_click`, `phone_click` (id 611379430–611386291) | **2026-09-10** | первые достижения 10–11.09; цели одной серии; в GOALS_MANIFEST помечены `configured` до 12.09 |
| `lead_submitted_photo/canvas/tshirt`, `form_error` (612290270–612290566) | **2026-09-12 13:19 MSK** | созданы владельцем 12.09 ≈ 13:00 (`GOALS_MANIFEST.md`), сайт с событиями выложен 13:19:22 (`FALSE_BROWSER_PURCHASE_STOPPED_AT`) |
| Параметры визита (`field`, `product`, …) | вместе с событиями, которые их несут (10.09 / 12.09) | |
| Новые агрегаты этапа 10 (по устройствам/входам, параметры, пути) | дата первой синхронизации набора; история подтягивается запросами за прошлые дни в пределах Reports API (цели — не раньше своего создания) | |

Константы: `BEHAVIOR_GOALS_AVAILABLE_FROM = '2026-09-10'`, `DIRECTION_GOALS_AVAILABLE_FROM = '2026-09-12'`
(`analytics-constants.ts`). Сравнение с периодом, начавшимся раньше даты доступности шага, —
недействительно (UI показывает «сравнение недоступно», не «−100 %»).

---

# 4. Проверка PII

- В параметрах целей ключи `name, phone, email, contactValue, comment, note, address` вырезаются
  (`sanitizeGoalParams`, тест `metrika-events.test.ts`).
- Фактические ключи параметров визитов в счётчике за 08–14.09 (Reports API `ym:s:paramsLevel1`):
  `productName, productSlug, intent, value, product, price, size, quantity, currency, location,
  order_price, format, items, channel, product_id, category, product_name, field, size_mb` —
  все технические (слаги, суммы, коды); персональных данных нет. Значение `field=name` — имя поля,
  не имя клиента.
- Этап 10 хранит локально только: дату, устройство, путь страницы, идентификатор цели, ключ и
  значение параметра из **белого списка** (`field, product, form, productSlug, intent, format, size, value,
  location, channel, kind, topic`), счётчики. `form=contact` и `productSlug` — признаки начала формы
  контактов и фотопечати (у этих событий нет `product`). Никаких ClientID, текстов, файлов, Telegram/MAX-идентификаторов.

---

# 5. Что даёт Reports API (проверено read-only 14.09.2026, период 08–14.09)

| Запрос | Результат | Вывод |
|---|---|---|
| `metrics goal<id>reaches/visits/users` по шагам общей воронки | 145 визитов / 94 посетителя; form_started 25 / 13 / 3; attempt 4 / 4 / 1; lead 4 / 4 / 1; form_error 3 / 1 / 1 | шаги считаются в трёх единицах: события, целевые визиты, посетители |
| то же `dimensions ym:s:deviceCategory` | PC 78 визитов: form_started 13 визитов; Smartphones 64: **0**; Tablets 3: 0 | воронка по устройствам возможна; факт для правила 11.2 |
| то же `dimensions ym:s:startURLPath` | 14 строк; `/` 105 визитов, form_started 12 визитов, lead 4 | воронка по страницам входа возможна |
| `filters ym:s:goal<form_started>IsReached=='Yes'` + `goal<lead>visits` | 13 визитов начали форму, из них 4 дошли до заявки | пересечение шагов внутри визита — честная «конверсия шага» |
| `dimensions paramsLevel1, paramsLevel2; filters paramsLevel1=='field'` | `contactValue` 1 визит (3 параметра), `name` 1 визит | ошибки формы по полям — из параметров визита |
| то же + `deviceCategory` | PC: contactValue, name | ошибки по устройствам возможны |
| `filters paramsLevel1=='product'` | canvas 11 визитов (5 посетителей), photo 3 | разрез «направление» для form_started/attempt/error — через параметр `product` |
| `startURLPath`, `filters goal<lead>IsReached=='Yes'` | `/` — 4 визита, 1 посетитель | «с какой страницы начинались визиты с заявкой» |
| `ym:pv:URLPath`, `filters goal<lead>IsReached=='Yes'` | 12 страниц: `/` 84 просмотра, `/catalog/foto-10x15-s-polyami` 19, `/catalog/foto-10x15-bez-polej` 15, `/futbolki/svoy-print` 15 … | «какие страницы смотрели в визитах с заявкой» — фильтр по визиту работает с пространством просмотров |
| `ym:s:endURLPath` | 17 строк; `/` 73, `/catalog/foto-10x15-bez-polej` 14, `/interer/holst` 12 | страницы выхода доступны → «где визит закончился без заявки» |
| `bounceRate, pageDepth, avgVisitDurationSeconds` по устройствам | PC: отказы 5,1 %, глубина 8,7, 355 с; Smartphones: 6,3 %, 3,25, 124 с | контекст вовлечённости по устройствам |
| порядок событий / путь страниц внутри визита | **недоступен** в Reports API | DATA GAP → § 7 |

Ограничения API (этап 07): ≤ 20 метрик, ≤ 10 измерений, `ym:pv:*` несовместим с `ym:s:goal…`
**в метриках** (но фильтр по цели с измерением `ym:pv:URLPath` работает — строка выше),
нулевые строки не возвращаются.

---

# 6. DATA GAPS (факты, без домыслов)

| # | Gap | Следствие | Минимальное безопасное расширение (предложение; production-события не менять без отдельного gate) |
|---|---|---|---|
| G1 | 8 объявленных событий не вызываются: `select_product, configure_tshirt, choose_print_position, upload_print, cross_sell_click, canvas_upload_success, canvas_quality_warning, canvas_edge_select, canvas_extra_open`; `canvas_upload_click` — в несмонтированном компоненте | Шаги «позиция принта», «загрузка макета», «загрузка фото холста», «предупреждение о качестве», «края» из ТЗ **не измеримы**; на сайте таких шагов нет (холст без загрузки, у футболок позиция принта не выбирается) | Ничего не добавлять: измерять несуществующие шаги нельзя. Удалить мёртвые ключи из реестра — отдельная задача сайта |
| G2 | 10 отправляемых событий не имеют целей: `view_tshirt_catalog, view_product, choose_shirt_type, choose_color, submit_tshirt_order, canvas_format_select, canvas_size_select, canvas_send_photo_later, reviews_source_click` (+ мёртвый `canvas_upload_click`) | Нет шагов «каталог → карточка» и «крой/цвет» у футболок; нет попытки отправки у футболок; нет «формат → размер» у холста | Создать в счётчике JS-цели (владелец, Management UI): минимум `submit_tshirt_order` (попытка у футболок), `view_product`, `canvas_size_select`. После создания — `availableFrom` = дата создания |
| G3 | Серверная ошибка отправки у фото / холста / контактов события не даёт (`submit_tshirt_order_error` есть только у футболок/мерча) | «Форма прошла проверку, но сервер отказал» невидимо для трёх направлений | Событие `lead_submit_error{product, code}` во всех формах — правка сайта, отдельный gate |
| G4 | `form_started` у контактов и `add_tshirt_lead` у футболок/мерча не дедуплицируются (каждый фокус = событие) | `reaches` завышены; корректная единица шага — **целевые визиты** (`goalVisits`) | В воронках шаг считать визитами; события показывать отдельно с подписью |
| G5 | Порядок событий и последовательность страниц внутри визита недоступны (Reports API) | «Путь до заявки», «последняя страница перед заявкой» как последовательность — невозможно | V1: страницы входа визитов с заявкой, страницы, просмотренные в визитах с заявкой, страницы выхода без заявки (агрегаты). Полные пути — только Logs API (решение Reviewer) или собственный beacon-storage без PII |
| G6 | `form_error` разложить одновременно по `product` и `field` нельзя: параметры визита — дерево `{product:…}` и `{field:…}` в разных ветках уровня 1 | Ошибки по полям — суммарно и по устройствам; по направлениям — только через страницу входа визита | Если нужно точно: параметр вида `field:'photo:phone'` в коде сайта (правка сайта, отдельный gate) |
| G7 | Уникальные посетители на шаге за период — только отдельным запросом за период (как снимки этапа 08); дневные `convertedUsers` не суммируются | В воронке за произвольные даты посетители недоступны | Снимки посетителей по целям для 8 пресетов (расширение `MetrikaPeriodSnapshot`-механизма, 1 запрос на пресет) |
| G8 | Мобильные визиты за 08–14.09: 64, `form_started` 0 | Для правила 11.2 — факт; причина не установлена (согласие на cookie на мобильных? форма? трафик по намерению?) | Только гипотезы в карточке; проверка — сравнить доли согласия по устройствам (данных нет) и ручной тест формы на 360–430 px |

---

# 7. Logs API — не включать

Reports API покрывает воронки, ошибки, устройства, страницы и агрегатные «пути». Полные
последовательности требуют Logs API (`visits` с `ym:s:goalsID/goalsDateTime`, `hits` с URL).
Оценка для отдельного решения Reviewer: объём ≈ 150 визитов и 1 000 просмотров в день (≈ 5–10 МБ
CSV в месяц), retention 90 дней, лимит запросов на создание логов (1 запрос в сутки на диапазон
достаточно), задержка данных ≈ сутки, хранение — отдельные таблицы без PII (ClientID — псевдоним,
не персональные данные, но хранить только хэш), приватность — не хранить `URL` с параметрами
`etext/ybaip` целиком. **В этапе 10 не реализуется.**

---

# 8. Что из этого строит этап 10

- Общая воронка: визит → `form_started` → `lead_submit_attempt` → `lead_submitted` — по
  целевым визитам (канон), событиям и посетителям (снимок периода / null).
- Направления: **Фото** — `form_started`/`attempt` с параметром `product=photo` (визиты с
  параметром) → `lead_submitted_photo`; **Холст** — `product=canvas` → `lead_submitted_canvas`;
  **Футболки** — `view_custom_tshirt` → `choose_size` → `add_tshirt_lead` →
  `lead_submitted_tshirt` (+ `submit_tshirt_order_error`); **Контакты** — `form:contact`.
  Отсутствующие шаги (G1–G3) показываются как «шаг не измеряется», не как 0.
- Ошибки форм: `form_error` всего и по устройствам/входам (цель), по полям (параметр `field`),
  доля от попыток; серверные ошибки — только футболки/мерч.
- Страницы: страницы входа × шаги воронки (визиты, посетители по дням, form_started, attempt,
  lead, form_error) + порог выборки.
- Устройства: то же по устройствам + вовлечённость (отказы, глубина, длительность).
- Пути V1: входы визитов с заявкой, просмотренные страницы визитов с заявкой, выходы без заявки.
- Правила «Требует внимания» 11.1–11.5 с FACT / HYPOTHESIS / RECOMMENDATION.
