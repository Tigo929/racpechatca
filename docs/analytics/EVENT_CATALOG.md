# EVENT_CATALOG.md

# Каталог событий сайта raspechatkaa.ru

Составлен 11.09.2026 по коду `web-photo` (этап 04). Источник имён —
единственный реестр `apps/web/src/lib/metrika.ts` → `METRIKA_GOALS`;
`reachGoal` принимает только имена из него (тип `MetrikaGoal`).
Строковых имён целей вне реестра в коде нет — проверено поиском
`reachGoal('`. Прямых вызовов `ym(` вне `lib/metrika.ts` и
`Analytics.tsx` нет. `apps/api` событий в Метрику не отправляет.

Три слоя (раздел 3 этапа 04):

- **Поведение** — что человек делал на сайте. Цели в Метрике нужны
  выборочно, для воронки.
- **Конверсия сайта** — `lead_submitted`: сервер принял заявку. Не заказ,
  не оплата.
- **Бизнес-события** — статусы заказа в CRM (`LEAD → NEW → … → PAID →
  COMPLETED`, `CANCELLED`). Источник истины — CRM; в Метрику их отправит
  CRM на этапе 06.

Условные обозначения решения: **KEEP** — имя и смысл сохраняются;
**KEEP (дубль)** — оставлено ради истории, смысл покрыт другим событием;
**DEPRECATED** — объявлено в реестре, но ничем не отправляется;
**REMOVED** — убрано на этапе 04.

Параметры везде без персональных данных: `reachGoal` вырезает ключи
`name, phone, email, contactValue, comment, note, address` до отправки.

---

## Acquisition / Communication

| Событие | Триггер | Смысл | Где | Параметры | Цель? | E-com | Решение |
|---|---|---|---|---|---|---|---|
| `phone_click` | клик по номеру телефона | хочет позвонить | `TrackedPhoneLink.tsx` | `location` | да (воронка связи) | нет | KEEP |
| `messenger_click` | клик по Telegram / MAX | хочет написать | `MessengerLink.tsx` | `channel`, `location` | да | нет | KEEP |
| `reviews_source_click` | клик по рейтингу площадки в шапке | проверяет доверие | `TrackedReviewLink.tsx` | `source` | нет | нет | KEEP |

## Product

| Событие | Триггер | Смысл | Где | Параметры | Цель? | E-com | Решение |
|---|---|---|---|---|---|---|---|
| `view_product` | открыта карточка готового принта | просмотр товара | `catalog/CatalogViewTracker.tsx` | `product_id`, `product_name`, `price` | нет | `detail` уходит отдельно у фотопечати (`trackProductDetail`, `OrderPanel`) | KEEP |
| `view_tshirt_catalog` | открыта витрина принтов | просмотр каталога | `catalog/CatalogViewTracker.tsx` | `items`, `category?` | нет | нет | KEEP |
| `view_custom_tshirt` | открыта страница «свой принт» | просмотр посадочной | `tshirt/CustomTshirtViewTracker.tsx` | `intent` | нет | нет | KEEP |
| `select_product` | — | — | не отправляется | — | — | — | DEPRECATED |
| `cross_sell_click` | — | — | не отправляется (`CrossSell` без события) | — | — | — | DEPRECATED |

## Configurator — футболки

| Событие | Триггер | Смысл | Где | Параметры | Цель? | Решение |
|---|---|---|---|---|---|---|
| `choose_shirt_type` | выбрал крой | шаг 1 | `TshirtConfigurator.tsx` | `value` | воронка | KEEP |
| `choose_color` | выбрал цвет | шаг 2 | то же | `value` | воронка | KEEP |
| `choose_size` | выбрал размер | шаг 3 | то же | `value` | воронка | KEEP |
| `configure_tshirt` | — | — | не отправляется | — | — | DEPRECATED |
| `choose_print_position` | — | шаг убран 11.09.2026 | не отправляется | — | — | DEPRECATED |
| `upload_print` | — | шаг убран 11.09.2026 | не отправляется | — | — | DEPRECATED |
| `add_tshirt_lead` | фокус в первое поле формы футболки/мерча | начал заполнять форму | `TshirtLeadForm.tsx`, `MerchForm.tsx` | `kind?` | воронка | KEEP (дубль `form_started`) |

## Configurator — холст

| Событие | Триггер | Смысл | Где | Параметры | Цель? | Решение |
|---|---|---|---|---|---|---|
| `canvas_format_select` | выбрал формат (портрет/альбом/квадрат/панорама) | первый отсекатель размеров | `canvas/CanvasProduct.tsx` | `format` | воронка | KEEP |
| `canvas_size_select` | выбрал размер | шаг | `CanvasProduct.tsx`, `CanvasOrderForm.tsx` | `product`, `size` | воронка | KEEP |
| `canvas_upload_click` | нажал «загрузить фото» в редакторе | пытается приложить файл | `canvas/CanvasEditor.tsx` | `product` | нет | KEEP |
| `canvas_send_photo_later` | отправил заявку без файла | фото пришлёт в переписке | `CanvasOrderForm.tsx` | `product` | нет | KEEP |
| `canvas_upload_success` | — | — | не отправляется | — | — | DEPRECATED |
| `canvas_quality_warning` | — | — | не отправляется | — | — | DEPRECATED |
| `canvas_edge_select` | — | выбор торца убран из карточки | не отправляется | — | — | DEPRECATED |
| `canvas_extra_open` | — | — | не отправляется | — | — | DEPRECATED |

## Form

| Событие | Триггер | Смысл | Где | Параметры | Цель? | Решение |
|---|---|---|---|---|---|---|
| `form_started` | первое взаимодействие с формой заявки | начал заполнять | `OrderPanel.tsx` (фото), `CanvasOrderForm.tsx`, `ContactForm.tsx` | `product` / `form`, `productSlug?`, `size?` | да (воронка) | KEEP |
| `form_error` | форма не прошла проверку на клиенте | споткнулся на поле | `OrderPanel`, `CanvasOrderForm`, `TshirtLeadForm`, `ContactForm` | `product` / `form`, `field` | **да — ещё не создана** | KEEP |
| `lead_submit_attempt` | нажал «Отправить», проверка пройдена, запрос ушёл | попытка | `OrderPanel`, `CanvasOrderForm`, `ContactForm` | `product` / `form`, суммы | нет | KEEP |
| `submit_tshirt_order` | то же для футболок и мерча | попытка | `TshirtLeadForm`, `MerchForm` | `product_id`, `quantity` / `kind` | нет | KEEP (дубль `lead_submit_attempt`) |
| `submit_tshirt_order_error` | сервер ответил ошибкой | заявка не принята | `TshirtLeadForm`, `MerchForm` | `product_id` / `kind` | нет | KEEP |

Замечание: у `MerchForm` нет `form_error` — ошибки проверки мерча
в Метрику не уходят. Кандидат на добавление на этапе 07.

## Lead — конверсия сайта

| Событие | Триггер | Смысл | Где | Параметры | Цель? | E-com | Решение |
|---|---|---|---|---|---|---|---|
| `lead_submitted` | **сервер ответил 2xx на создание заявки** | заявка принята системой | все пять форм через `lib/lead-events.ts` → `reportLeadSubmitted` | `product` (`photo/canvas/tshirt/merch/contact`), `order_price?`, `quantity?`, `productSlug?`, `size?`, `product_id?`, `topic?`, `kind?`, `currency: 'RUB'` | **да, создана** («Заявка отправлена») | нет | KEEP; унифицировано |
| `lead_submitted_photo` | вместе с `lead_submitted`, `product = photo` | заявка на фотопечать | то же | те же | **да — не создана** | нет | KEEP |
| `lead_submitted_canvas` | `product = canvas` | заявка на холст | то же | те же | **да — не создана** | нет | KEEP |
| `lead_submitted_tshirt` | `product = tshirt` **или** `merch` | заявка на футболки (мерч — партией) | то же | те же | **да — не создана** | нет | KEEP |
| `submit_tshirt_order_success` | сервер принял заявку футболки/мерча | то же, что `lead_submitted_tshirt` | `TshirtLeadForm`, `MerchForm` | `product_id` / `kind` | нет | нет | KEEP (дубль `lead_submitted_tshirt`); историю не переименовываем |
| Автоцель «Отправка формы» | Метрика сама ловит `submit` любой формы | нажатие «Отправить», удачное или нет | — | — | да, создана | нет | вне кода; в отчётах сравнивать с `lead_submitted` |

До этапа 04 `lead_submitted` **не отправляли** форма футболок и форма
мерча — общая цель недосчитывала их целиком. Исправлено в
`feature/analytics-event-model`.

## Ecommerce

| Событие | Триггер | Смысл | Где | Решение |
|---|---|---|---|---|
| `detail` (dataLayer) | открыта карточка формата фотопечати | просмотр товара | `OrderPanel.tsx` → `trackProductDetail` | KEEP |
| `purchase` (dataLayer) | **было:** сервер принял заявку | **было:** «покупка» на сумму заявки | было в `OrderPanel`, `CanvasOrderForm`, `TshirtLeadForm` | **REMOVED** в `feature/analytics-event-model`; покупка = `PAID` в CRM, отправит CRM (этап 06). В production ещё отправляется — до слияния ветки |

## Атрибуция заявки (не события, но уходят с ней)

| Поле | Смысл | Окно |
|---|---|---|
| `utmSource…utmTerm` | маркетинговая атрибуция — **last-touch UTM внутри визита** (вкладки) | sessionStorage |
| `yclid` | клик по Директу — свидетельство, дополнение к ClientID | **21 день** с момента клика (FIX_01); прежние бессрочные записи недействительны |
| `yandexClientId` | посетитель в Метрике — главный ключ связи | без срока |
| `firstTouchUrl` | входная страница визита — измерение поведения, **не** рекламный источник | sessionStorage, один раз на вкладку |
| `conversionPageUrl` | страница, на которой отправлена заявка | момент отправки |

## Order / Payment / Completion — бизнес-события (CRM)

Не события сайта. Источник — `OrderPhoto.status` и `StatusHistory`:

| Событие | Определение | Дата |
|---|---|---|
| заявка создана | `status = LEAD` при приёме с сайта | `createdAt` |
| заказ принят | `LEAD → NEW` менеджером | `StatusHistory` |
| оплачен | первый переход в `PAID` | `clientPaidAt` (с этапа 02; история — backfill 03) |
| выполнен | `COMPLETED` (у фото также `DONE` / `SENT` как отправка клиенту) | `completedAt` / `StatusHistory` |
| отменён | `CANCELLED` | `StatusHistory` |

---

## Итог

| | Количество |
|---|---|
| Имён в реестре | 34 |
| Отправляются кодом | 25 |
| DEPRECATED (объявлены, не отправляются) | 9: `select_product`, `cross_sell_click`, `configure_tshirt`, `choose_print_position`, `upload_print`, `canvas_upload_success`, `canvas_quality_warning`, `canvas_edge_select`, `canvas_extra_open` |
| Дубли по смыслу (сохранены) | `add_tshirt_lead` ≈ `form_started`; `submit_tshirt_order` ≈ `lead_submit_attempt`; `submit_tshirt_order_success` ≈ `lead_submitted_tshirt` |
| Переименовано | 0 |
| Новых имён | 0 |
| Удалено из кода | `purchase` (e-commerce) при заявке |

Константы DEPRECATED из реестра пока не удалены: семь из них
соответствуют шагам, убранным из интерфейса в сентябре 2026, и могут
вернуться. Решение об удалении — на этапе 07, когда будет видно, нужны
ли они отчётам.
