# 01_CURRENT_STATE.md

# Текущее состояние: что уже есть для сквозной аналитики

Аудит проведён 11.09.2026, только чтение, ничего не менялось.
Ссылки на файлы и строки — на состояние репозиториев в этот день.

---

# 1. Репозитории и стек

| | Сайт | CRM |
|---|---|---|
| Репозиторий | `web-photo` | `racpechatca` |
| Ветка на момент аудита | `feature/cms-admin` | `master` |
| `git status` | чисто | чисто |
| Приложения | `apps/web` — Next.js 15, React 19, Tailwind 4; `apps/api` — NestJS; `packages/shared` — общие типы и расчёт цен | `crm-new` — NestJS + Prisma + PostgreSQL 16; `frontend` — React (Vite); `greeter` — Python/Telethon, пишет клиентам в Telegram |
| Выкладка | GitHub Actions → ghcr.io → `auto-update.sh` на сервере (таймер 5 мин) | то же; сборка на любой push в `master` |
| База | нет своей: CMS сайта живёт в базе CRM, схема `cms` | база `crm`, схема `public` |

Все контейнеры — на одном сервере, nginx CRM-фронтенда единственный вход
(`/opt/raspechatka/frontend/nginx-photo.conf`).

---

# 2. Сайт: что собирается и куда уходит

## 2.1. Счётчик Метрики

- Номер: **111569944**, зашит в образ переменной `NEXT_PUBLIC_METRIKA_ID`
  (`.github/workflows/build-images.yml:72`).
- Загрузчик: `apps/web/src/components/Analytics.tsx`. Инициализация:
  `clickmap: true, trackLinks: true, accurateTrackBounce: true,
  webvisor: true, ecommerce: true`.
- **Счётчик стартует только после согласия на cookie**
  (`CookieNotice.tsx`, выбор в `localStorage['cookie-consent']`).
  Исключение — фрейм самой Метрики для карт и Вебвизора
  (`apps/web/src/lib/metrika-frame.ts`). Следствие: у части посетителей
  Метрики нет вовсе, а заявку они оставить могут.
- Заголовок `Content-Security-Policy: frame-ancestors` разрешает
  показывать сайт во фрейме доменам Метрики (карты, Вебвизор) —
  `deploy/nginx-domain.conf`, применено на сервере 10–11.09.2026.

## 2.2. События (цели) — `apps/web/src/lib/metrika.ts`, `METRIKA_GOALS`

Отправляются через `reachGoal`. Цель в Метрике должна быть создана
руками или через API управления — иначе событие отбрасывается.

| Группа | Идентификаторы |
|---|---|
| Заявка | `lead_submitted`, `lead_submit_attempt`, `lead_submitted_photo`, `lead_submitted_canvas`, `lead_submitted_tshirt` |
| Форма | `form_started`, `form_error` |
| Связь | `phone_click`, `messenger_click`, `reviews_source_click` |
| Товар | `view_product`, `select_product`, `view_tshirt_catalog`, `view_custom_tshirt`, `cross_sell_click` |
| Конфигуратор футболки | `configure_tshirt`, `choose_shirt_type`, `choose_color`, `choose_size`, `choose_print_position`, `upload_print`, `add_tshirt_lead`, `submit_tshirt_order`, `submit_tshirt_order_success`, `submit_tshirt_order_error` |
| Холст | `canvas_upload_click`, `canvas_upload_success`, `canvas_quality_warning`, `canvas_size_select`, `canvas_format_select`, `canvas_edge_select`, `canvas_extra_open`, `canvas_send_photo_later` |

Подтверждённо созданы в Метрике: `lead_submitted` («Заявка отправлена»)
и автоцель «Отправка формы». **Не созданы** (по состоянию на 11.09):
`lead_submitted_photo`, `lead_submitted_canvas`, `lead_submitted_tshirt`,
`form_error`. Остальные — проверить в `Настройки → Цели`.

## 2.3. Электронная коммерция

`trackLeadPurchase` (`apps/web/src/lib/metrika.ts:206`) отправляет
`purchase` в `dataLayer` **сразу после успешного ответа API на заявку**
(`components/product/OrderPanel.tsx`, после `fetch('/api/lead')`).
Сумма — расчётная сумма заявки. Аналогично у холста и футболок.

Идентификатор покупки — `web-<uuid>`, генерируется в браузере
(`createAnalyticsLeadId`, `OrderPanel.tsx:717`). Он **не равен**
идентификатору заявки в CRM (см. 2.5).

## 2.4. Атрибуция, собираемая на сайте

| Данные | Где берётся | Где хранится до заявки |
|---|---|---|
| ClientID Метрики | `getYandexClientId()` — `ym(id, 'getClientID')` | запрашивается в момент отправки |
| `yclid` | из адреса страницы | `sessionStorage`, `lib/yclid.ts` |
| UTM (source, medium, campaign, content, term) | из адреса первой страницы визита | `sessionStorage`, `lib/utm.ts` |
| Адрес страницы заявки | `window.location.href` | — |

ClientID, `yclid` и адрес страницы уходят с заявкой любого типа.
**UTM до этапа 02 отправляли только формы футболок и контактов** — формы
фотопечати (`OrderPanel`) и холста (`CanvasOrderForm`) их не слали, и в
DTO `apps/api` для этих двух типов полей UTM не было. Уточнено 11.09.2026
при реализации этапа 02; там же исправлено (см. 02, раздел 21).

## 2.5. Путь заявки

```text
браузер
  POST /api/lead            apps/web/src/app/api/lead/route.ts (прокси)
    → POST {API_URL}/api/leads      apps/api/src/leads/leads.controller.ts
      (аналогично /canvas-leads, /tshirt-leads, /contact-leads)
      → каналы: CRM, e-mail        apps/api/src/leads/channels/
        → POST {CRM}/order-photo/lead    crm-new/src/order-photo/lead.controller.ts:50
          → OrderPhoto в статусе LEAD    crm-new/src/order-photo/order-photo.service.ts (~596–680)
```

Тело запроса в CRM — `apps/api/src/leads/channels/crm.channel.ts`:
`leadId` (`web-photo-<sha256 от submittedAt|phone|slug|quantity|total>`),
категория и товар, тираж и цены, контакты, доставка, бумага, параметры
холста и футболки, `utmSource…utmTerm`, `yclid`, `yandexClientId`,
`pageUrl`, `submittedAt`. Подпись HMAC (`X-Lead-Signature`) плюс bearer.

---

# 3. CRM: как устроен заказ

## 3.1. Модели (`crm-new/prisma/schema.prisma`)

| Модель | Строка | Назначение |
|---|---|---|
| `OrderPhoto` | 57 | заявка и заказ — одна строка; отличаются статусом |
| `ItemPhoto` | 793 | позиции фотопечати |
| `ItemTshirt` | 823 | позиции футболок |
| `ItemCanvas` | 851 | позиции холста |
| `StatusHistory` | 1008 | каждый переход статуса: откуда, куда, кто, когда; таблица с 13.06.2026 |
| `ExpenseOrder` | 1044 | расходы, привязанные к заказу |
| `GulianOutbox` | 1181 | очередь доставки во внешнюю систему — образец для очереди в Метрику |

Отдельной сущности «клиент» **нет**: имя и контакт живут текстом
в `note`, канал связи — `communicationPlatform` + `urlCommunication`.

## 3.2. Поля `OrderPhoto`, важные для аналитики

| Поле | Тип | Смысл |
|---|---|---|
| `createdAt` | DateTime | момент создания (для заявки с сайта — момент приёма) |
| `status` / `statusChangedAt` | enum / DateTime | текущий статус и когда он сменился |
| `sourceOrder` | enum `AVITO / OZON / WB / LOCAL` | все заявки сайта — `LOCAL`; канал внутри сайта не различается |
| `communicationPlatform` | enum `AVITO / TELEGRAM / MAX / OZON` | как связываемся |
| `productCategory` | `PHOTO / TSHIRT / CANVAS` | |
| `totalOrder` | Int | позиции + `deliveryCost` |
| `deliveryCost` | Int | |
| `prepaidAmount` | Int? | фактически внесённая предоплата |
| `clientPaidAt` | DateTime? | **есть в схеме, никогда не записывается** (только читается в отчётах) |
| `completedAt`, `sentAt`, `closedAt` | DateTime? | `closedAt` ставится при `PAID / COMPLETED / CANCELLED` |
| `externalRequestId` | String? @unique | = `leadId` с сайта |
| `note` | String? | свободный текст; сюда попадают ClientID, yclid, страница |

## 3.3. Статусы (`EnumStatus`, строка 762)

```text
LEAD → NEW → APPROVAL_SENT → FOLDER_STRUCTURE_CREATED → IN_PROGRESS
     → PRINTED → READY → SHIPMENT_CREATED → DONE → SENT → PAID
     → READY_FOR_REVIEW → COMPLETED
CANCELLED, PROBLEM — вне цепочки
```

| Момент | Как определяется сейчас |
|---|---|
| заявка создана | `status = LEAD` при приёме с сайта |
| стала заказом | переход `LEAD → NEW` менеджером |
| оплачена | `status = PAID`; дата — `statusChangedAt` этого перехода или `StatusHistory` |
| выполнена | `COMPLETED` (у фото также `DONE` / `SENT`) |
| отменена | `CANCELLED` |

Нюанс: `SENT` у фото — «отправлен клиенту», у футболок и холстов —
«передан производителю». Отчёты CRM это учитывают
(`reports.service.ts`, `isRevenueRealized`).

## 3.4. Деньги

- Выручка признаётся, когда заказ **отдан клиенту или оплачен**
  (`PAID / COMPLETED / DONE / SHIPMENT_CREATED`, у фото также `SENT`).
- Дата признания — `clientPaidAt ?? completedAt ?? statusChangedAt ?? sentAt ?? createdAt`
  (`reports.service.ts:177`). Поскольку `clientPaidAt` пуст всегда,
  фактически работает `completedAt` / `statusChangedAt`.
- Себестоимость по типам:
  фото — `ItemPhoto.thermalCost` + бумага по формату из настроек партнёра;
  футболки — `ItemTshirt.blankCost`, `thermalCost`, `designCost`;
  холст — `ItemCanvas.contractorCostPosition` (снимок цены подрядчика),
  `profitPosition`; плюс `ExpenseOrder` по заказу.
- Отдельного факта «платёж на сумму N» нет; есть `prepaidAmount`.
- Готовый P&L: `GET /reports/monthly`, `/reports/weekly`, `/reports/years`
  (`crm-new/src/reports/`) — выручка, себестоимость, зарплата, прибыль,
  маржа, средний чек по периодам. Переиспользовать, не дублировать.

## 3.5. Куда попадают данные атрибуции с сайта

`order-photo.service.ts`, приём заявки (~строки 605–660):

| Данные | Куда пишутся | Пригодность для запросов |
|---|---|---|
| `yandexClientId` | строка `Yandex ClientID: …` в `note` | только парсингом текста |
| `yclid` | строка `yclid: …` в `note` | только парсингом |
| `pageUrl` | строка `Страница: …` в `note` | только парсингом |
| `utmSource / Medium / Campaign` | **только у футболок**: `Источник: a / b / c` в `ItemTshirt.designNote` (`buildTshirtNote`, ~2056) | только парсингом |
| `utmContent`, `utmTerm` | принимаются DTO (`create-lead.dto.ts:256–273`), **никуда не пишутся** | теряются |
| `leadId` | `externalRequestId` | да |
| `submittedAt` | строка в `note` | только парсингом |

Поля появились в приёме заявки: `yclid` — 09.06.2026,
`yandexClientId` — 13.08.2026. Раньше этих дат в `note` их нет.

---

# 4. Метрика: состояние на стороне Яндекса

| | Состояние |
|---|---|
| Счётчик | работает, Вебвизор и карты включены |
| Цели | **21** (по API 12.09.2026): 14 JS-целей с именами событий кода (в т.ч. `lead_submitted`, `lead_submitted_photo/canvas/tshirt`, `form_error`), 4 системные CRM-цели (заказ создан/оплачен/отменён/спам — появились после первой CDP-загрузки), две автоцели и историческая URL-цель «Заявка отправлена» = `/thanks` (считает только фото и холст). Нет только шести желательных целей воронок. Подробно — `GOALS_MANIFEST.md` |
| Электронная коммерция | включена; наполняется `purchase` с заявки |
| Передача данных из CRM / офлайн-конверсии | **не включены** в настройках счётчика |
| OAuth-приложение | создано владельцем 11.09.2026 (ClientID есть; секрет был показан в переписке и подлежит перевыпуску). Токен выпущен под аккаунтом владельца счётчика (permission `own`); показан в чате → ротация отложена владельцем в отдельную задачу; с 12.09 лежит в `/opt/raspechatka/.env` |
| Проверка кода счётчика | `code_status = CS_ERR_UNKNOWN` — робот Яндекса не видит счётчик, потому что он загружается только после согласия на cookie; на сбор данных не влияет |
| Показ во фрейме для карт | разрешён (см. 2.1) |

Точка отсчёта по отчётам за 5–8.09.2026: ~55 визитов/день,
28 заявок за 4 дня, конверсия в заявку 11,96 %, 45 нажатий «Отправить».
**Поправка 11.09.2026:** «28 заявок / 11,96 %» считались URL-целью `/thanks`,
куда попадают только фото и холст, — заявки на футболки, мерч и контакты
в этом числе нет. По Reports API за 2026-09-05..11: 218 визитов, 151
посетитель, 1189 просмотров, без семплирования.

---

# 5. Найденные проблемы

| № | Проблема | Где | Последствие |
|---|---|---|---|
| 1 | ClientID, yclid, страница входа — в свободном тексте `note` | `order-photo.service.ts:654–656` | нет джойна с Метрикой без парсинга |
| 2 | UTM пишутся только у футболок и только три из пяти; формы фото и холста UTM не отправляют вовсе | `buildTshirtNote`, ~2056; `apps/api/src/leads/dto/create-lead.dto.ts`, `create-canvas-lead.dto.ts` | у фото и холста источник неизвестен; `utm_content`, `utm_term` теряются везде |
| 3 | `sourceOrder = LOCAL` для всего сайта | `OrderPhoto.sourceOrder` | канал внутри сайта не различить на уровне CRM |
| 4 | `clientPaidAt` не заполняется | нет записи ни в одном сервисе | дата оплаты восстановима только из `StatusHistory` |
| 5 | Заявка отправляется в Метрику как `purchase` | `metrika.ts:206`, `OrderPanel.tsx` | Метрика считает покупкой каждую заявку; отчёты e-commerce завышены |
| 6 | Id «покупки» в Метрике ≠ id заявки в CRM | `web-<uuid>` против `web-photo-<sha256>` | сопоставить можно только через ClientID |
| 7 | Нет сущности клиента | — | повторные заказы не различаются автоматически |
| 8 | Часть посетителей без Метрики (отказ от cookie) | `Analytics.tsx` | заявки надо считать по CRM, не по Метрике |
| 9 | Четыре обязательные цели не созданы в Метрике (`lead_submitted_photo/canvas/tshirt`, `form_error`), ещё шесть воронок — тоже; подтверждено API 11.09.2026 | настройки счётчика | события по направлениям и ошибки формы отбрасываются |
| 10 | Цель «Заявка отправлена» — URL `/thanks`, а не событие | настройки счётчика | конверсия в отчётах занижена: футболки, мерч и контакты не попадают на `/thanks` |

---

# 5a. Объём и состав исторических данных (замер 11.09.2026, этап 03)

Только чтение боевой базы, значения не выводились — счётчики.

| Показатель | Значение |
|---|---|
| Заказов всего | 323 (с 31.05.2026) |
| Заказов с сайта (`sourceOrder = LOCAL`) | 25; с пометкой «Заявка с сайта» в `note` — 16 |
| `note` со строкой `Yandex ClientID:` | 11 (с 15.08.2026), все — только цифры |
| `note` со строкой `yclid:` | 10 (с 02.09.2026) |
| `note` со строкой `Страница:` | 16 (с 15.08.2026), все `https://raspechatkaa.ru/…` |
| Иные написания маркеров | 0 |
| `ItemTshirt.designNote` со строкой `Источник:` (UTM) | **0 из 116** — UTM исторически не сохранялись ни для одного заказа |
| `StatusHistory` | 1453 строк, первая — 14.06.2026 23:02 (таблица создана миграцией 13.06.2026) |
| Переходов в `PAID` | 205; заказов с таким переходом — 204; один заказ оплачивался дважды |
| Заказов в `PAID / READY_FOR_REVIEW / COMPLETED` **без** перехода в истории | 16 — оплачены до появления истории, дату восстановить неоткуда |
| `clientPaidAt` заполнено | 0 |

Следствие для backfill (этап 03): восстанавливаются 11 ClientID, 10 yclid,
16 страниц заявки и 204 даты оплаты; UTM — ничего. Заявок с сайта до
15.08.2026 (5 штук) — без маркеров, восстановить нечего.

---

# 5b. Атрибуция и события на сайте — уточнения этапа 04 (11.09.2026)

| Факт | Подробности |
|---|---|
| `yclid` — 21 день (FIX_01) | было: `localStorage['yclid']` бессрочно, клик любой давности приписывался следующему заказу. Стало (ветка `feature/analytics-event-model`): JSON с `capturedAt`, срок 21 день, прежние записи без даты недействительны. UTM и first-touch — `sessionStorage` (жизнь вкладки) |
| UTM внутри визита — last-touch | новый набор `utm_*` в адресе перезаписывает сохранённый целиком |
| `first_touch_url` | новое: первая страница вкладки, ставится один раз (`lib/first-touch.ts`), уходит с заявкой как `firstTouchUrl` → `OrderPhoto.firstTouchUrl` |
| `lead_submitted` у футболок и мерча | до этапа 04 **не отправлялся** — общая цель занижена на футболки за всю историю; исправлено в `feature/analytics-event-model` |
| `purchase` при заявке | удалён в `feature/analytics-event-model`; в production (`feature/cms-admin`) пока отправляется — до слияния вместе с этапом 06 |
| Реестр событий | 34 имени, 25 отправляются, 9 объявлены и не отправляются; полный список — `EVENT_CATALOG.md` |
| `document.referrer` | не читается и не отправляется |
| Ветка выкладки сайта | `feature/cms-admin` — единственная feature-ветка сайта в списке сборки CI; push в неё = production через ~10 минут |
| `getYandexClientId` | ждёт ClientID ≤ 800 мс; без счётчика — сразу `undefined` |

---

# 5c. Интеграция с API Метрики — состояние после этапа 05 (11.09.2026)

| Факт | Подробности |
|---|---|
| Клиент | `crm-new/src/metrika/YandexMetrikaClient`: чтение счётчика, целей, отчётов; таймаут 10 с; повторы на 429/5xx/сеть; ошибки семи видов; токен в логи и ошибки не попадает |
| Конфигурация | `YANDEX_METRIKA_COUNTER_ID`, `YANDEX_METRIKA_OAUTH_TOKEN` — из `/opt/raspechatka/.env` через `environment:` backend в `docker-compose.prod.yml`; пусто — интеграция выключена, CRM работает |
| Токен | на сервере **отсутствует**; живой smoke выполнен 11.09.2026 разовым запуском из окружения процесса — токен показан в чате и подлежит отзыву/перевыпуску владельцем |
| Live smoke | counter 111569944 → HTTP 200, permission `own`, 13 целей; Reports API 2026-09-05..11 → 218 визитов / 151 посетитель / 1189 просмотров, `sampled=false`; 3 запроса за 1057 мс; только GET |
| Поведение API | недействительный токен → **403**, не 401 (проверено живым запросом); `code_status` счётчика = `CS_ERR_UNKNOWN` из-за cookie-gate |
| CLI | `npm run metrika:smoke` (dist): счётчик, цели, отчёт за 7 дней; без токена — exit 2 |

---

# 5d. CRM → Метрика — состояние после этапа 06, фаза 1 (11.09.2026)

| Факт | Подробности |
|---|---|
| Очередь | `MetrikaOrderOutbox`: строка появляется в той же транзакции, что смена статуса и `StatusHistory`; dedupe по `StatusHistory.id`; статусы pending/processing/delivered/failed/skipped. **Порядок внутри заказа строгий**: уходит первая незакрытая строка (pending/processing/failed блокируют поздние), failed ждёт requeue/skip оператора; два воркера не возьмут два перехода одного заказа |
| Кто меняет статус | шесть мест: `updateStatusOrder` (панель), `ScenarioDraftService` (LEAD → NEW), `SalaryService` (выплата → PAID), `PartnerApiController`, `partner-status-poll`, `telegram-update`; постановка в очередь — в первых четырёх, два последних нормализованный статус не меняют |
| Что уходит | `simple_orders` (merge_mode=SAVE), один заказ — один файл: `OrderPhoto.id`, `createdAt` в поясе счётчика, ClientID строкой, **статус перехода** (`targetMetrikaStatus` строки, не текущий статус заказа) IN_PROGRESS/PAID/CANCELLED, `totalOrder`, себестоимость из `order-cogs.ts` (та же, что в P&L), RUB. Без имени/телефона/почты/note. `revenue − cost` в Метрике — валовая прибыль, не чистая |
| Что не уходит | заявки (LEAD), отклонённые заявки (LEAD → CANCELLED без принятия), заказы без ClientID (skipped/no_client_id) |
| Рубильник | `YANDEX_METRIKA_ORDERS_SYNC_ENABLED` — по умолчанию выключено: очередь копится, наружу не уходит |
| CLI | `npm run metrika:orders -- status \| preview --order <id> \| send --order <id> [--live] \| requeue` |
| Себестоимость | вынесена в `reports/order-cogs.ts`; отчёт и Метрика считают одной функцией; в неё не входят зарплата и доставка перевозчику (в P&L они отдельными строками) |
| Живой POST | **выполнен 12.09.2026 11:45 MSK** по команде владельца: заказ 20260909-091 → IN_PROGRESS через очередь (строка на реальный переход LEAD→NEW), HTTP 200, PASSED, elements 1, uploading `54f3af75-17d7-4a5f-8388-a4c59b98c747`; last_uploadings — единственная загрузка счётчика (API, CSV). Matching с визитом — пока не наблюдаем (задержка данных Метрики). Production не тронут |
| Счётчик: пояс | `Europe/Moscow`, смещение +180 мин (из API 12.09.2026) |
| Токен | лежит в `/opt/raspechatka/.env` (владелец положил 12.09); это показанный ранее токен — отзыв/ротация и перевыпуск Client Secret отложены владельцем в отдельную security-задачу. `metrika:offline_data` подтверждён принятым POST |
| История миграций | **восстановлена 12.09.2026**: `20260728190000_add_gulian_transactional_outbox` — из Git (f106dca, WIP-ветка; ADD COLUMN → IF NOT EXISTS ради сборки с нуля); две от 31.05 — каталоги с объяснением (файлы утеряны, объектов на бою нет); новая `20260601000000_baseline_db_push_era` — User, ItemTshirt, 6 enum, LEAD/DONE, productCategory/deadline/isUrgent эпохи `db push`, идемпотентна. **Пустая база собирается из репозитория (75 миграций)**; на бою deploy применит только baseline как no-op |
| master | ушёл вперёд (Web Push, 11.09.2026) — слит в `feature/analytics-foundation`; обратно не сливался |
| Дрейф схемы на бою | против `schema.prisma`: TIMESTAMPTZ в GulianOutbox/ExpenseOrder/executorSentAt, DEFAULT у updatedAt в трёх таблицах, FK SalaryAccrual ON DELETE SET NULL, имя индекса GulianOutbox, лишние индексы sentAt/clientGreetedAt, WIP-объекты GulianOutboxEvent/IntegrationAuditLog/2 enum/4 колонки. Безвредно для работы и `migrate deploy`; `migrate dev` на бою не запускать |

---
# 5e. Production после rollout PHASE B–H (12.09.2026 12:21 MSK)

| Факт | Подробности |
|---|---|
| CRM на бою | `master` = d72ffff (этапы 02–06 + Web Push); образ backend de021522…; 75 миграций, `migrate status` up to date |
| Схема | `OrderPhoto`: yandexClientId, yclid, utm*, conversionPageUrl, firstTouchUrl, clientPaidAt + индексы; таблица `MetrikaOrderOutbox` |
| Backfill | применён: 219 заказов — 11 ClientID, 10 yclid, 16 conversionPageUrl, 204 clientPaidAt; повторный dry-run 0; `note`/`designNote`/`StatusHistory` не изменены |
| Воркер Метрики | **включён** 12:20 MSK (`YANDEX_METRIKA_ORDERS_SYNC_ENABLED=true` в `/opt/raspechatka/.env`); каждые 30 с; очередь пуста — ждём первый естественный переход |
| Метрика с боя | counter 200, пояс Europe/Moscow (+180), Reports API работает; в счётчике 17 целей: 13 прежних + 4 системные CRM-цели (заказ создан/оплачен/отменён/спам), появившиеся после первой CDP-загрузки |
| Сайт | **выложен 12.09.2026**: `feature/cms-admin` = cb2dd96 (этап 04); **FALSE_BROWSER_PURCHASE_STOPPED_AT = 2026-09-12 13:19:22 MSK** — с этого момента браузер не шлёт `purchase` при заявке; `lead_submitted` + directional цели + `first_touch_url` работают; 4 обязательные JS-цели созданы (612290270/370/451/566). Данные `purchase` до отсечки — ложная семантика заявки, после — заказы/оплаты только из CRM (CDP) |
| Серверный compose | точечно дополнен переменными YANDEX_METRIKA_*; `MARKETPLACE_SECRET` из master там всё ещё отсутствует (вне этапа) |
| Временные базы | `crm_stage06_test`, `crm_fresh_test` удалены; на сервере только `crm` |

---
# 5f. Локальный слой данных Метрики — этап 07 (12.09.2026, в production с 17:08 MSK)

| Факт | Подробности |
|---|---|
| Таблицы | `MetrikaSyncRun` (журнал: набор × период, статус, строки, запросы, sampled/share/lag/accuracy), `MetrikaDailyTraffic`, `MetrikaDailyGoal` (день × goalId), `MetrikaDailySource`, `MetrikaDailyUtm`, `MetrikaDailyLanding`, `MetrikaDailyDevice`, `MetrikaDailyPage`; `DATE` = календарная дата Метрики в Europe/Moscow. Миграция `20260912140000_metrika_analytics_tables` |
| Источник | только V1 Reports API `GET /stat/v1/data` через существующий `YandexMetrikaClient` (+ параметр `lang`); Logs API и Direct API не используются; дашборд к API Яндекса не ходит |
| Каталог | `crm-new/src/metrika/analytics/metrika-query-catalog.ts` ↔ `docs/analytics/METRIKA_QUERY_CATALOG.md`; атрибуция lastsign, lang=ru, limit 100000 без offset, accuracy: по умолчанию → повтор `full` при sampled |
| Цели | реестр резолвит по Management API: JS — по событию, CRM — по типу `cdp_order_*`, legacy — по `/thanks`; номера совпадают с GOALS_MANIFEST.md (lead 611379890, photo 612290270, canvas 612290370, tshirt 612290451, form_error 612290566, created 596990603, paid 596990604, cancelled 596990606, spam 596990605, /thanks 602316919) |
| Синхронизация | `MetrikaAnalyticsSyncService`: pg advisory lock 700701 → цели → по набору RUNNING → запросы → разбор → транзакция «удалить период + вставить» → SUCCESS/FAILED; итог запуска SUCCESS/PARTIAL/FAILED/LOCKED. Расписание (флаг `YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED`, default false): каждый час 3 дня, раз в московские сутки 21 день |
| CLI | `npm run metrika:sync -- --from … --to … [--dataset …]`, `status`, `verify` (live read-only), `reconcile`, `quality`, `coverage` — токен не печатает |
| Проверено на копии `crm_stage07_test` | verify 7/7; 7 дней (06–12.09): 181 визитов / 146 дневных уникальных / 1023 просмотров, lead 2, CRM created 1, paid 0 — прямой API даёт то же (0 расхождений); 90 дней (15.06–12.09): 1426 строк, данные с 13.08.2026, sampled=false; lock двумя процессами — второй LOCKED |
| Ограничения данных | JS-цели считают только с момента создания (`lead_submitted` — 2 достижения, оба 11.09; обязательные — с 12.09 13:00); UTM почти нет (Директ = yclid); `ym:pv:pageviews` ≠ `ym:s:pageviews`; дневные `users` не суммируются в периодные |
| Production | **выложено 12.09.2026**: `master` = b57c067 (образ backend eb9fb783…), миграция `20260912140000_metrika_analytics_tables` применена 17:07 MSK (76 миграций, up to date); в боевой базе 90 дней данных (1428 строк, с 13.08.2026); `YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true` в `/opt/raspechatka/.env` с 17:11 MSK (compose дополнен строкой с умолчанием false; backup обоих файлов рядом); расписание: суточный тик 17:13 и часовой 18:11 — SUCCESS, lock/overlap/дубли проверены; копия `crm_stage07_test` удалена. Отчёт — `07_METRIKA_TO_ANALYTICS.md` § 38 |
| Бой 18:21 MSK (read-only) | очередь MetrikaOrderOutbox пуста, воркер заказов запущен после каждого рестарта; после cutover 13:19 заявок с сайта не было; 20260912-109 (12:59, до cutover, utm chatgpt.com) — LEAD; 20260912-110 (Avito, 14:02) создан сразу NEW без перехода и без ClientID — в очередь не попадает по дизайну |

---
# 5g. Канонические метрики — этап 08 (12.09.2026; в production с 22:13 MSK)

| Факт | Подробности |
|---|---|
| Сервис | `AnalyticsMetricsService` (`crm-new/src/analytics/metrics/`): getOverview / getFunnel / getTrafficSources / getUtm / getLandings / getDevices / getProducts / getSalesChannels / getComparison / getDataQuality; формулы — чистые функции `metrics-compute.ts`, контракт — `metrics-contract.ts`, словарь — `METRICS_DICTIONARY.md` |
| Три пространства | site (Метрика: визиты, lead_submitted, CRM-цели по сопоставленным заказам), crm (все заказы: leadAt / acceptedAt / paidAt / firstCancelledAt·lastCancelledAt·currentlyCancelled·wasEverCancelled / realizedAt из `deriveOrderLifecycle`; FIX_01 — отмена историческая, возврат в работу её не стирает), pnl (`ReportsService.pnlForRange` — та же математика, что `/reports/monthly`) |
| Уникальные периода | `MetrikaPeriodSnapshot` (миграция `20260912160000_metrika_period_snapshot`): отдельный запрос к API за период; 8 пресетов обновляются тиком расписания этапа 07 и `metrika:sync snapshots`; без снимка `periodUsers = null`, `sumDailyUsers` отдаётся под своим именем (30 дней: 323 vs 408) |
| Сверки (копия crm_stage08_test) | трафик vs таблицы этапа 07 — 0; CRM (leads/accepted/paid/cancelled/paidWithoutDate/paidOrderValue) vs независимый SQL — 0 за 30 дней и за 01.06–12.09; P&L vs `/reports/monthly` и `/reports/weekly` — 0 по 12 строкам за июль и август 2026 |
| Данные на 12.09 | 325 заказов, 267 начали в NEW (оператор/Avito), 26 — в LEAD; отмен нет; PAID без clientPaidAt — 13; ClientID у принятых за 30 дней 7,7 %; siteLeads 2 против crmLeads 29 за 30 дней (цель молодая) |
| Диагностика | `npm run metrics:report -- overview|slices|reconcile-traffic|reconcile-crm|reconcile-pnl|perf`; getOverview — 29 SQL-запросов независимо от числа заказов (в контейнере ≈2,3 с с прогревом) |
| Бой 13:00 MSK 13.09 (read-only) | после cutover 2 естественные заявки с сайта (20260913-111 02:43, 20260913-112 11:58 MSK): first-touch и страница конверсии есть, ClientID пуст (вероятно, без cookie-согласия), обе LEAD; 16 переходов CRM — все внутри IN_PROGRESS, очередь этапа 06 пуста по дизайну; первый LEAD→NEW/PAID через очередь — not observed yet. Хост выключался хостингом 08:51–09:42 MSK, всё поднялось само |
| Production | **выложено 12.09.2026 22:13 MSK**: `master` = e7e936d (образ backend b03d34f3…), миграция `20260912160000_metrika_period_snapshot` (77 миграций); расписание было временно OFF на время деплоя и проверок (backup `.env.bak-stage08-*`), включено 22:57; снимки 8 пресетов обновляются после каждого тика (≈19 запросов/тик); periodUsers на бою = прямой API (131 / 323), сверки трафик/CRM/P&L из контейнера 0/0/0. Таблица снимков растёт ≈6 строк/сутки (старые диапазоны остаются, ключ — диапазон). Отчёт — `08_PRODUCTION_ROLLOUT.md` § 26 |

---
# 5h. Дашборд руководителя — этап 09 (14.09.2026; в production с 19:16 MSK)

| Факт | Подробности |
|---|---|
| Статус | Reviewer 14.09.2026: `00–08 = DONE`, `09 = READY_FOR_PRODUCTION_ROLLOUT`; rollout выполнен 14.09 18:44–20:17 MSK по команде «СТАРТ» строго по `09_PRODUCTION_ROLLOUT.md` — отчёт § 18; owner smoke § 11 пройден владельцем 14.09 (UI под ADMIN на боевых данных: пресеты, раздельные воронки, coverage-предупреждение, разделы — без критических ошибок); Stage 09 = REVIEW, DONE ставит Reviewer |
| Production | **выложено 14.09.2026**: `master` = be591d3 (ff из feature), образы backend `4d8cdf1c…` (19:10:38–19:11:11), frontend `2b96a48c…` (19:03:22–19:04:23); серверный compose получил строку `ANALYTICS_DASHBOARD_ENABLED: ${ANALYTICS_DASHBOARD_ENABLED:-false}` (backup `.bak-stage09-20260914-1844`); флаг включён 19:16:39 (`.env.bak-stage09-20260914-1916`, recreate backend, nginx reload). Миграций нет (77 up to date). Снаружи `/analytics/dashboard/*` без токена → 401 JSON; EXECUTOR → 403; ADMIN → 200 |
| Сверка на бою (19:18) | HTTP = service = `metrics:report --json`: today / last_7_days / last_30_days — все листья JSON (494 / 764 / 1244) diff 0; 10 ключевых метрик diff 0; P&L август 2026 = `/reports/monthly` (12 строк, 0). Цифры: 7 дней — визиты 144, посетители 93, заявки сайта 4, принято 33, оплат 10, выручка 66 455 ₽, прибыль 44 015 ₽; 30 дней — 588 / 326 / 4 / 127 / 70 / 229 231 ₽ / 132 573 ₽; ClientID у принятых 6–7 %, eligibleAccepted 0 |
| Перф на бою | getOverview 29 SQL / 2,57 с (отдельный процесс с прогревом), HTTP overview холодный 1,97 с → кэш 45 мс; trend 0,94 с; срезы ≤ 0,45 с |
| Расписание после деплоя | тики 19:12 и 19:18 (daily при старте) и 20:16 (hourly) — SUCCESS, снимки 8/8, 18 строк без дублей, FAILED 0 за 24 ч; воркер этапа 06 жив (outbox 8 skipped/no_client_id) |
| API | `GET /analytics/dashboard/{status,overview,trend,sources,utm,landings,devices,products,sales-channels}` (`crm-new/src/analytics/dashboard/`): тонкая обёртка над `AnalyticsMetricsService`, контракт ответа = `metrics-contract.ts`; `JwtAuthGuard` + `RolesGuard(ADMIN)`; период `?preset=` или `?from&to` (≤366 дней, MSK); кэш 45 с в памяти процесса; новый `getTrend` (дни: Метрика + lifecycle + `ReportsService.pnlBuckets`, та же `buildPnl`) |
| Флаг | `ANALYTICS_DASHBOARD_ENABLED` (default false → 404 на всё, кроме `/status`); в `docker-compose.prod.yml` `${ANALYTICS_DASHBOARD_ENABLED:-false}`, на бою переменная не задана — после деплоя раздел выключен до решения владельца |
| Панель | `/crm/analytics` (только ADMIN, меню «Управление → Аналитика»): KPI Визиты / Посетители (снимок) / Заявки сайта / Принятые / Оплаты / Выручка / Себестоимость / Прибыль / Средний чек со сравнением и полярностью; воронка сайта (ClientID) и воронка CRM отдельно; «Требует внимания» (правила без причин); SVG-график одного показателя; «Деньги подробно» (три базы); вкладки Источники (источники + UTM), Товары (товары + каналы продаж), Страницы (входы + устройства), Качество данных; ru-RU форматы; sessionStorage для периода. Контракт и правила предупреждений — `DASHBOARD_CONTRACT.md` |
| Проверка | копия `crm_stage09_test` (13.09 13:39 MSK, удалена): HTTP = service = `metrics:report overview --json` по всем листьям JSON для today / last_7_days / last_30_days (единственное различие — секунды возраста данных); 10 ключевых метрик diff 0; auth 401/403/400/404 по маршрутам; скриншоты desktop 1440 и mobile 390 на реальных данных — `docs/analytics/screenshots/09_dashboard_v1/` |
| Цифры копии (07–13.09) | визиты 151, посетители 106 (сумма по дням 121), заявки сайта 2, CRM-заявки 10, принято 34, оплат 3, выручка 51 053 ₽, себестоимость 6 761 ₽, прибыль 36 512 ₽, средний чек 6 233,33 ₽; ClientID у принятых 8,82 %, eligibleAccepted 0 → сопоставленные конверсии «—» («Недостаточно сопоставленных заказов») |
| Известное свойство | Σ дневных `netProfit` из `/trend` отличается от `Overview.netProfit` на единицы рублей (ceil копеек фото в каждом бакете `buildPnl`; 36 511 vs 36 512 за 7 дней, 138 497 vs 138 504 за 30) — как в недельных/месячных разрезах отчёта; в UI подписано «сумма по дням» |
| Тесты | CRM 912 (83 suites), панель 21 (vitest + testing-library, `npm test` в `frontend/`, шаг в CI); `tsc -b && vite build` OK (vitest-конфиг отдельным `vitest.config.ts`) |
| Бой 13–14.09 (read-only) | расписание Метрики работает (hourly SUCCESS, 8/8 снимков); auto-update 13.09 19:48–19:49 MSK выложил коммиты владельца 13a76a7..4349ae2 (backend + frontend healthy); 14.09 14:42 разовая ошибка pull из реестра — обновлять было нечего |

---
# 5i. Поведение и воронки — этап 10 (14.09.2026; в production с 15.09.2026 00:22 MSK)

| Факт | Подробности |
|---|---|
| Статус | Stage 10 = REVIEW: technical rollout выполнен 15.09 00:13–00:42 MSK по команде «СТАРТ» строго по `10_PRODUCTION_ROLLOUT.md` — отчёт § 21; остановлено на owner-smoke gate (§ 15, фиксирует владелец); DONE ставит Reviewer |
| Production | `master` = 80921d9 (ff из feature 00:18:31); auto-update: backend `d8c9dd73…` 00:21:33–00:22:06 (миграция `20260914200000` применена на старте, 78 applied), frontend `844bb9f8…` 00:22:11–00:22:44; backups `.bak-stage10-20260915-0013` (compose, .env) и `premigration_stage10_behavior_20260915_001341.sql.gz`; расписание аналитики выключалось 00:17–00:31 на время миграции и initial sync; маршрут `/analytics` на домене raspechatkaa.ru добавлен во второй белый список nginx 15.09 00:01 (NEEDS_FIX; фикс в репо — `frontend/nginx.conf` комментарий, web-photo `deploy/nginx-domain.conf`) |
| Initial sync (00:24–00:27) | из контейнера при выключенном расписании: 7 дней → полное окно 13.08–15.09 — behaviorDevices 994, behaviorLandings 1722, params 348, paths 390, engagement 71 строк; снимки целей 8/8 × 14 = 112; повтор идемпотентен, дублей 0; ключи параметров — только белый список |
| Сверка на бою (00:28) | HTTP = service по всем листьям JSON 7 маршрутов (702 / 1015 / 1332, diff 0); HTTP = независимый SQL 9 / 31 / 31 метрик diff 0; Σ по устройствам = итогам; Stage 09 recon diff 0, P&L август = `/reports/monthly` |
| Цифры боя 09–15.09 | 116 визитов (76 посетителей); форму начали 13 визитов (25 событий, 3 посетителя), отправили 4, заявок 4 — все на компьютерах (62 визита); телефоны 51 визит / 0 начатых форм (DEVICE_GAP CRITICAL как наблюдение; за 30 дней 280 / 0); ошибок формы 1 визит (3 события, поле «Контакт»); фото 25 → 2; футболки 11 → 2 → 1 → 0 |
| Правила на бою | 7д: DEVICE_GAP CRITICAL, FUNNEL_DROPOFF photo ATTENTION, 7 пропусков с причинами; 30д: + FUNNEL_DROPOFF canvas. DEVIATION: на окнах до 12.09 param-шаг (с 13.08) сравнивается с целью направления (с 12.09) — предложение FIX_01 в `10_BEHAVIOR_AND_FUNNELS.md` § 33 (решение Reviewer) |
| Perf / auth на бою | getSummary 25 SQL, 120 мс тёплый; HTTP summary 61–249 мс, кэш 9–20 мс; 401 / 403 / 400 / 200 в контейнере и через домен; Stage 09 маршруты 200 |
| Расписание после деплоя | включено 00:31:41; тик 00:33 (daily 26.08–15.09) — 12 наборов SUCCESS, 23 запроса + снимки 8/8; hourly 01:31–09:31 — 9 тиков SUCCESS (12/12 наборов, 23 запроса, 6–9 с, снимки 8/8 + 112 целей каждый); дублей 0, overlap 0, FAILED 0, WARN/ERROR 0 (контроль 10:23); воркер этапа 06 жив (outbox 8) |
| Аудит событий | `BEHAVIOR_EVENT_CONTRACT.md`: 34 события реестра сайта → 14 с целями в счётчике, 10 отправляются без целей (теряются), 9 объявлены и не вызываются (`canvas_upload_click` — в несмонтированном компоненте); `form_started` (контакты) и `add_tshirt_lead` без дедупликации; серверная ошибка отправки есть только у футболок; счётчик грузится лишь при согласии на cookie; параметры целей — параметры визита без PII |
| DATA GAPS | G1 мёртвые события (шаги загрузки/качества/краёв/позиции принта не существуют на сайте); G2 нет целей для `submit_tshirt_order`, `view_product`, `canvas_size_select` и др.; G3 нет события серверной ошибки для фото/холста/контактов; G4 дубли событий → единица шага — целевые визиты; G5 последовательностей нет в Reports API (Logs API — отдельное решение); G6 `form_error` по product×field не разложить; G7 уникальные шага только снимком для пресетов; G8 телефоны 08–14.09: 64 визита, 0 начал формы |
| Данные | миграция `20260914200000_metrika_behavior_tables`: `MetrikaDailyBehaviorDevice`, `MetrikaDailyBehaviorLanding`, `MetrikaDailyVisitParam` (белый список 12 ключей), `MetrikaDailyPathPage` (entry_lead / viewed_lead / exit_all / exit_nolead), `MetrikaDailyDeviceEngagement` (аддитивные bounces / pageviews / seconds), `MetrikaPeriodGoalSnapshot`; наборы в каталоге этапа 07 с `filters`; +12 запросов на тик и +8 на снимки (`BEHAVIOR_DATA_MODEL.md`) |
| Слой метрик и API | `crm-new/src/analytics/behavior/`: контракт, пороги (`behavior-rules.ts`), чистый `behavior-compute.ts`, `BehaviorMetricsService` (13 groupBy на период), `GET /analytics/dashboard/behavior/{status,summary,funnels,errors,pages,devices,paths,issues}` — ADMIN, флаг `ANALYTICS_DASHBOARD_ENABLED`, кэш 45 с; даты доступности 2026-09-10 / 2026-09-12 |
| Воронки | global (визит → начали форму → отправили → заявка), photo / canvas / contact (шаг 1 по параметрам визита), tshirt (4 цели); единицы: события / целевые визиты / посетители периода; неизмеримые шаги — `not_measured` с причиной; период до целей — `insufficient_data`; сравнение только с периодом после даты доступности |
| Правила | `BEHAVIOR_RULES.md`: FUNNEL_DROPOFF (≥ 90 % при входе ≥ 20; не для «визит → первое действие»), DEVICE_GAP (оба ≥ 30 визитов; ≤ 0,5 / ≤ 0,25), FORM_ERROR_SPIKE (≥ 5; ×2 / ×3 или ≥ 30 % от начавших), LANDING_UNDERPERFORMANCE (≥ 30 визитов, ожидаемых ≥ 3, ≤ 50 % средней), LEAD_RATE_ANOMALY (оба ≥ 30, |Δ| ≥ 50 %); карточки FACT / HYPOTHESIS / RECOMMENDATION, `causality: NOT_ESTABLISHED`, пропуски с причиной |
| UI | вкладка «Поведение» в `/crm/analytics`: сводка, «Требует внимания», общая воронка, направления, ошибки форм, устройства (+ вовлечённость, текст разрыва), страницы входа, пути-агрегаты; состояния loading/empty/error/not_measured/LOW_SAMPLE; mobile без горизонтального скролла |
| Сверка (копия `crm_stage10_test`, 14.09 23:15 MSK, live sync 13.08–14.09, удалена) | HTTP = service по всем листьям JSON (797 / 1037 / 1352, diff 0); HTTP = независимый SQL по таблицам-источникам 25 / 31 / 31 метрик diff 0; Σ по устройствам = итогам; idempotency повтора — без дублей и дрейфа; `metrika:sync verify` 12/12 |
| Цифры боя 08–14.09 | 145 визитов / 94 посетителя; форму начали в 13 визитах (25 событий, 3 посетителя), отправили 4, заявок 4 — все на компьютерах; телефоны 64 визита / 0 начал формы (DEVICE_GAP CRITICAL как наблюдение); ошибок формы 1 визит (3 события, поле «Контакт»); футболки 11 → 2 → 1 → 0; фото: 32 визита с формой → 2 заявки |
| Тесты | CRM 955 (86 suites), панель 30 (vitest); build OK |

---
# 6. Что уже готово из целевой картины

- Сайт собирает всё нужное для атрибуции и доставляет в CRM — данные
  **доходят**, вопрос только в том, куда они ложатся (проблемы 1–2).
- В CRM есть история статусов, себестоимость по типам и рабочий P&L.
- Есть образец очереди во внешнюю систему (`GulianOutbox`).
- Есть канал доставки владельцу — Telegram-аккаунт CRM (`greeter`).
- Есть точка отсчёта по цифрам (раздел 4).

Оценка готовности сбора данных — около 75 %: не хватает колонок,
даты оплаты и обратного потока в Метрику.

---

# 7. Ограничения, которые надо помнить при следующих этапах

1. **21 день.** Метрика привязывает заказ из CRM к визиту только в этом
   окне. Backfill истории в Метрику невозможен.
2. **Согласие.** ClientID есть только у согласившихся; деньги считаем
   по CRM.
3. **Объём.** Дневные срезы — шум; сравнения — неделя к неделе, решения —
   по месяцу.
4. **Любой push в `master` CRM пересобирает и перезапускает CRM**
   (`.github/workflows/build-images.yml`). Документацию и код лучше
   вносить одним коммитом с кодом либо добавить `paths-ignore` для `docs/`.

---

# 8. Открытые вопросы к владельцу

1. Какие из целей раздела 2.2, кроме `lead_submitted`, уже созданы
   в Метрике? Нужен список из `Настройки → Цели`.
2. Идёт ли сейчас реклама в Директе? От этого зависит, нужен ли
   этап с расходами (CPL/ROAS) в ближайшие месяцы.
3. Считать ли `DONE`/`SENT` у фото оплатой, если `PAID` не выставлен?
   Сейчас отчёт CRM считает это признанной выручкой.
