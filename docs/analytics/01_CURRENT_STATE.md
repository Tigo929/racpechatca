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
| Цели | `lead_submitted`, автоцель формы — есть; четыре из 2.2 — нет |
| Электронная коммерция | включена; наполняется `purchase` с заявки |
| Передача данных из CRM / офлайн-конверсии | **не включены** в настройках счётчика |
| OAuth-приложение | создано владельцем 11.09.2026 (ClientID есть; секрет был показан в переписке и подлежит перевыпуску); токен не выпущен |
| Показ во фрейме для карт | разрешён (см. 2.1) |

Точка отсчёта по отчётам за 5–8.09.2026: ~55 визитов/день,
28 заявок за 4 дня, конверсия в заявку 11,96 %, 45 нажатий «Отправить».

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
| 9 | Четыре цели не созданы в Метрике | настройки счётчика | события по товарам и ошибки формы отбрасываются |

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
