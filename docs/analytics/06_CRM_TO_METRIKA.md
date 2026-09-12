# 06_CRM_TO_METRIKA.md

# Этап 06 — CRM → Яндекс Метрика: реальные заказы, оплаты, отмены и надёжная доставка

## Статус

```text
REVIEW — READY_FOR_LIVE_WRITE_TEST
```

Фаза 1 (реализация без production write) выполнена 11.09.2026 — отчёт в
разделе 71; замечания FIX_01 (статус из перехода, строгий порядок очереди,
история миграций, recent-кандидат) закрыты 12.09.2026 — отчёт в
`06_CRM_TO_METRIKA_FIX_01.md`, раздел 21. Живой POST не выполнялся: ждёт
нового токена на сервере и команды владельца «разрешаю live write».

> Исполнитель не имеет права самостоятельно ставить этапу `DONE`.
> После выполнения этап переводится в `REVIEW`.
> Решение `DONE / NEEDS_FIX / BLOCKED` принимает ChatGPT после проверки отчёта.

---

# 1. Входной контекст

Приняты этапы:

```text
00_MASTER_PLAN            = DONE
01_CURRENT_STATE          = DONE
02_ANALYTICS_DATA_MODEL   = DONE
03_HISTORICAL_BACKFILL    = DONE
04_EVENT_MODEL            = DONE
05_YANDEX_METRIKA_API     = DONE
```

Этап 05 принят, потому что реальный live smoke успешно подтвердил:

```text
counter 111569944 → HTTP 200
permission → own
goals → 13
Reports API → работает
visits/users/pageviews → получены
sampling → false
```

Фактический live smoke:

```text
2026-09-05..2026-09-11

visits:    218
users:     151
pageviews: 1189
```

Фактические цели после сверки:

```text
configured: 10
missing:    10
extra/stale: 3
unknown:     0
```

Из 10 missing:

```text
обязательные:
- lead_submitted_photo
- lead_submitted_canvas
- lead_submitted_tshirt
- form_error

желательные:
- 6 целей воронок
```

---

# 2. Критический security precondition

OAuth token, использованный для live smoke этапа 05, считать скомпрометированным, если он был раскрыт в переписке.

До ЛЮБОГО write-запроса этапа 06:

```text
старый token → revoke
↓
выпустить новый token
↓
новый token НЕ отправлять в чат
↓
положить в /opt/raspechatka/.env
```

Runtime production:

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<new secret>
```

Новый token должен иметь:

```text
metrika:read
metrika:offline_data
```

Client Secret OAuth-приложения, ранее показанный открыто, также должен быть перевыпущен владельцем до production rollout.

Client Secret CRM runtime не нужен.

---

# 3. Главная цель этапа

Перестать считать:

```text
заявка = покупка
```

и начать передавать в Яндекс Метрику реальные бизнес-статусы из CRM:

```text
заявка
→ lead_submitted на сайте

принятый заказ
→ CRM order IN_PROGRESS

оплата
→ CRM order PAID

отмена
→ CRM order CANCELLED
```

В результате Метрика должна видеть:

```text
визит
↓
ClientID
↓
заявка
↓
реальный заказ из CRM
↓
реальная оплата / отмена
↓
revenue
↓
cost
```

---

# 4. Выбранный API

Для V1 использовать:

```text
POST /cdp/api/v1/counter/{counterId}/data/simple_orders
```

То есть:

```text
Simplified CRM order upload
```

Причины выбора:

1. CRM пока не имеет отдельной полноценной сущности Customer/Contact.
2. У нас уже есть `yandexClientId` непосредственно на `OrderPhoto`.
3. Simplified orders позволяют передавать:
   - CRM order id;
   - create_date_time;
   - ClientID;
   - order status;
   - revenue;
   - cost;
   - currency.
4. Можно обновлять один и тот же заказ по стабильному `id`.
5. Не требуется сначала создавать отдельные contacts, product lists и status mappings.
6. Для нашей сквозной аналитики V1 этого достаточно.

---

# 5. Почему НЕ detailed orders сейчас

Не использовать пока:

```text
/cdp/api/v1/counter/{counterId}/data/orders/json
```

или полноценную detailed CRM schema как основной путь.

Detailed orders требуют отдельной модели клиента:

```text
client_uniq_id
client_type=CONTACT
```

и отдельной загрузки customer/contact data.

У CRM сейчас отдельной сущности клиента нет.

Не создавать искусственную customer model только ради API Метрики.

---

# 6. Товары в Метрику на этом этапе не передавать

Detailed API умеет товары.

Simplified V1 — нет необходимости тащить туда product catalog.

Наш dashboard позже всё равно получает товарную аналитику напрямую из:

```text
ItemPhoto
ItemTshirt
ItemCanvas
```

Поэтому:

```text
product analytics
→ наша CRM / Analytics DB
```

а не обязательное условие этапа 06.

Если позже станет полезно видеть продукты непосредственно внутри Яндекс Метрики:

```text
отдельный upgrade detailed CRM import
```

после нормализации Customer entity.

---

# 7. Идентификатор связи с визитом

Основной идентификатор:

```text
OrderPhoto.yandexClientId
```

Яндекс рекомендует ClientID как наиболее точный способ связи CRM-заказа с визитом.

Важно:

```text
yandexClientId хранить/передавать как строку
```

Не преобразовывать его в JS number.

Причина:

значения могут иметь 19–20 цифр и превышать безопасную integer precision JavaScript.

---

# 8. yclid

`yclid` у нас хранится:

```text
TTL 21 день
```

Но simplified orders использует:

```text
client_ids
emails
phones
...
```

и в этой реализации основным идентификатором является:

```text
ClientID
```

Не пытаться втиснуть `yclid` в колонку `client_ids`.

Не вводить параллельно offline-conversion API только ради yclid в этом этапе.

`yclid` остаётся дополнительным attribution evidence в нашей CRM.

---

# 9. Заказы без ClientID

В V1:

```text
OrderPhoto.yandexClientId == null
→ заказ НЕ отправляется через simple_orders
```

Не использовать сейчас:

- phone из `note`;
- email из `note`;
- hash персональных данных;
- approximate matching.

Причина:

эти данные не нормализованы и это расширит privacy/scope.

Нужно учитывать:

```text
skipped_no_client_id
```

как отдельную метрику/причину пропуска.

---

# 10. Стабильный order ID

В поле:

```text
id
```

отправлять:

```text
OrderPhoto.id
```

То есть реальный стабильный ID CRM.

Не использовать:

```text
web-<uuid>
browser purchase id
новый случайный UUID
```

Один и тот же `OrderPhoto.id` должен использоваться при:

```text
IN_PROGRESS
PAID
CANCELLED
повторной синхронизации
```

Это позволяет Метрике обновлять один заказ, а не создавать несколько.

---

# 11. create_date_time

Использовать:

```text
OrderPhoto.createdAt
```

Но передавать время в:

```text
часовом поясе счётчика Яндекс Метрики
```

Перед live write получить из counter metadata:

```text
time_zone_name
time_zone_offset
```

и записать фактическое значение в executor report.

НЕ предполагать автоматически:

```text
Europe/Moscow
UTC+3
```

даже если это вероятно.

---

# 12. Формат даты

Для simplified CSV использовать официальный поддерживаемый формат:

```text
yyyy-MM-dd HH:mm:ss
```

Пример:

```text
2026-09-11 18:30:00
```

в часовом поясе counter.

`create_date_time` для одного и того же order ID должен быть детерминирован и никогда не меняться между повторными отправками.

---

# 13. merge_mode

Использовать:

```text
merge_mode=SAVE
```

Причина:

мы каждый раз отправляем полный canonical snapshot обязательных и используемых нами полей заказа.

Цель:

```text
повторная отправка одного OrderPhoto.id
→ детерминированно обновляет тот же order
```

---

# 14. CSV contract V1

Минимальный CSV:

```text
id,
create_date_time,
client_ids,
order_status,
revenue,
cost,
currency
```

Разрешается отправлять полный официальный header с пустыми optional fields, если это проще и надёжнее.

Например:

```text
id,create_date_time,client_uniq_id,client_ids,emails,phones,order_status,revenue,cost,goals,currency
```

Но:

```text
emails
phones
client_uniq_id
goals
```

на этом этапе оставлять пустыми.

---

# 15. Currency

Использовать:

```text
RUB
```

явно.

Не полагаться только на default, чтобы contract был однозначным.

---

# 16. Status mapping

Целевая нормализация CRM → Metrika:

```text
CRM accepted order
→ IN_PROGRESS

CRM PAID
→ PAID

CRM CANCELLED
→ CANCELLED
```

Не отправлять каждый внутренний production status как отдельный Metrika status.

---

# 17. Какие CRM статусы считаются IN_PROGRESS

Бизнес-смысл:

```text
LEAD
= ещё заявка
```

Она НЕ является CRM order для Метрики.

Первый момент, когда заявка стала заказом:

```text
LEAD → NEW
```

Поэтому основной триггер:

```text
первый переход в NEW
→ IN_PROGRESS
```

Дальнейшие внутренние статусы:

```text
APPROVAL_SENT
FOLDER_STRUCTURE_CREATED
IN_PROGRESS
PRINTED
READY
SHIPMENT_CREATED
DONE
SENT
READY_FOR_REVIEW
COMPLETED
PROBLEM
```

сами по себе не должны создавать новую CRM-status синхронизацию в Метрику, если normalized Metrika state остаётся:

```text
IN_PROGRESS
```

или уже:

```text
PAID
```

---

# 18. PAID

Строго:

```text
CRM status = PAID
→ Metrika order_status = PAID
```

Использовать существующий:

```text
clientPaidAt
```

для нашей собственной аналитики.

Но `create_date_time` заказа остаётся:

```text
OrderPhoto.createdAt
```

и не заменяется датой оплаты.

---

# 19. CANCELLED

```text
CRM status = CANCELLED
→ Metrika order_status = CANCELLED
```

Но есть важная eligibility rule.

---

# 20. Lead cancellation vs real order cancellation

Если заявка:

```text
LEAD
→ CANCELLED
```

и никогда не была принята как order:

```text
NEW
```

не создавать из неё CRM order в Метрике только ради CANCELLED.

То есть:

```text
rejected lead
≠ cancelled accepted order
```

Отправлять CANCELLED только если заказ считается eligible.

---

# 21. Order eligibility

Заказ eligible для CRM order sync, если выполняется хотя бы одно:

```text
A. В истории был NEW или более поздний рабочий order-state
B. Текущий статус PAID
C. Заказ уже ранее был успешно синхронизирован в Метрику как order
```

Исполнитель обязан проверить реальные переходы `StatusHistory` и уточнить rule, если фактическая модель требует небольшого изменения.

Любое изменение описать в отчёте.

---

# 22. Reopen / повторные переходы

Система должна корректно переживать:

```text
NEW → CANCELLED → NEW
```

или:

```text
PAID → CANCELLED
```

или другие разрешённые возвраты.

Так как используется один:

```text
OrderPhoto.id
```

следующая отправка должна обновлять тот же order.

Нельзя ставить unique constraint вида:

```text
(orderId, metrikaStatus)
```

который навсегда запретит повторный переход в тот же normalized status.

---

# 23. Revenue

Передавать:

```text
revenue
```

из существующей CRM business logic.

Не создавать новую независимую формулу.

Исполнитель должен исследовать текущий расчёт:

```text
reports.service.ts
isRevenueRealized
totalOrder
deliveryCost
prepaidAmount
```

и определить canonical order revenue snapshot для CRM order upload.

---

# 24. Важное различие: order value vs realized revenue

Не смешивать автоматически:

```text
order total
```

и:

```text
кассово признанная выручка в P&L
```

Yandex `revenue` означает сумму заказа для сквозной аналитики.

Поэтому исполнитель должен отдельно ответить:

```text
Какое поле является total contractual order value?
Как CRM P&L признаёт revenue?
Какое значение будет передаваться в Yandex?
```

Предпочтительная исходная гипотеза:

```text
Yandex revenue = totalOrder
```

но принять её только после сверки реального кода.

---

# 25. Cost

Нужно передавать:

```text
cost
```

только из уже существующей бизнес-логики себестоимости.

Источники известны:

```text
ItemPhoto.thermalCost + paper settings
ItemTshirt.blankCost + thermalCost + designCost
ItemCanvas.contractorCostPosition
ExpenseOrder
```

Не дублировать формулу вручную в Metrika service, если уже есть reusable financial calculation.

---

# 26. Reuse P&L

Требование:

> Metrika cost calculation и CRM report cost calculation не должны расходиться.

Исполнитель обязан:

1. найти существующий canonical расчёт;
2. переиспользовать его;
3. либо безопасно вынести shared helper/service;
4. доказать parity тестами.

После refactor:

```text
monthly/weekly reports
```

не должны изменить исторические результаты.

---

# 27. Неполная себестоимость

Если для конкретного заказа себестоимость нельзя надёжно определить:

```text
НЕ отправлять выдуманный 0
```

Лучше:

```text
cost = blank/omitted
```

если API contract допускает.

В отчёте показать:

```text
cost coverage:
orders with reliable cost:
orders without reliable cost:
```

---

# 28. Transactional outbox — обязательна

Нельзя делать:

```text
updateStatusOrder
↓
await Yandex API
↓
save CRM status
```

Яндекс не должен находиться внутри критического пути изменения заказа.

Архитектура:

```text
DB transaction
├─ обновление OrderPhoto
├─ StatusHistory
└─ MetrikaOutbox event
COMMIT
        ↓
worker
        ↓
Yandex Metrika
```

---

# 29. Использовать существующий outbox pattern

В проекте уже упоминался:

```text
GulianOutbox
```

Перед реализацией:

1. изучить фактическую модель;
2. изучить worker;
3. изучить locking/retry;
4. использовать те же conventions, если они подходят.

Не создавать второй принципиально иной механизм очереди без причины.

---

# 30. Предлагаемая сущность

Точное имя — по conventions проекта.

Например:

```text
MetrikaOrderOutbox
```

Минимально требуется хранить:

```text
id
orderId
sourceStatusHistoryId / source transition reference
targetMetrikaStatus
dedupeKey
attemptCount
nextAttemptAt
lockedAt
processedAt
lastError
remoteUploadingId
apiValidationStatus
createdAt
updatedAt
```

Допустимо адаптировать под существующий `GulianOutbox`.

---

# 31. Dedupe / idempotency

Нужно две защиты.

## 31.1. Local

Повторная обработка одного и того же CRM transition не должна бесконечно плодить outbox rows.

Предпочтительно привязать dedupe к:

```text
StatusHistory.id
```

или другому стабильному ID фактического перехода.

---

## 31.2. Remote

Повторный upload должен быть безопасен, потому что:

```text
id = OrderPhoto.id
merge_mode = SAVE
```

То есть повторная доставка одного snapshot обновляет существующий order.

---

# 32. Payload snapshot

Исполнитель должен выбрать и документировать стратегию:

```text
A. payload snapshot хранится в outbox
или
B. payload строится из актуального OrderPhoto при отправке
```

Рекомендация для V1:

```text
outbox хранит intended normalized status + source transition
payload строится из canonical актуального заказа
```

Но:

```text
create_date_time
order id
normalized transition meaning
```

должны оставаться детерминированными.

Если исполнитель выбирает snapshot — объяснить почему.

---

# 33. Worker

Worker должен:

1. взять due row;
2. безопасно lock;
3. построить payload;
4. проверить eligibility;
5. отправить;
6. проверить HTTP;
7. проверить:

```text
api_validation_status == PASSED
```

8. сохранить:

```text
uploading_id
processedAt
```

9. при временной ошибке — retry;
10. при permanent validation error — failed/dead-letter state.

---

# 34. Retry policy

Retry для:

```text
429
5xx
network
timeout
```

Не бесконечно.

Использовать exponential/backoff, совместимый с архитектурой проекта.

Например:

```text
1 min
5 min
15 min
1 h
...
```

Точная политика — после аудита существующего outbox.

---

# 35. Permanent errors

Не retry бесконечно:

```text
400 invalid payload
403 permission/scope
validation FAILED
```

Но 403 из-за временно неверной конфигурации token может быть операционно исправим.

Поэтому outbox row не удалять.

Сохранять:

```text
lastError
attemptCount
status
```

и предусмотреть manual retry/requeue.

---

# 36. Upload response

После:

```text
POST simple_orders
```

сохранить:

```text
uploading_id
api_validation_status
elements_count
datetime
```

Для одного-row V1 ожидается:

```text
elements_count = 1
```

---

# 37. Батчинг

Текущий объём CRM небольшой.

Поэтому V1 разрешается:

```text
1 order = 1 API upload
```

Это проще для:

- retry;
- отладки;
- дедупликации;
- tracing.

Не оптимизировать заранее.

Если исполнитель хочет batching — должен доказать, что не возникает проблема нескольких transitions одного order в одном CSV.

---

# 38. Last uploads diagnostics

Добавить read-only диагностический метод:

```text
GET /cdp/api/v1/counter/{counterId}/last_uploadings
```

или CLI-команду для проверки последних API uploads.

Не нужно делать polling каждого upload бесконечно.

---

# 39. CLI для безопасной диагностики

Предпочтительно:

```text
npm run metrika:orders:status
```

или аналог.

Показывать:

```text
pending outbox
failed outbox
processed
last uploadings
```

Без token.

---

# 40. Live write test — НЕ сразу

После реализации и unit/integration tests:

```text
не отправлять production order автоматически
```

до explicit owner approval.

Executor должен сначала вернуть:

```text
READY_FOR_LIVE_WRITE_TEST
```

с prepared payload preview без PII/secret.

---

# 41. Live write gate

Перед первым реальным POST должны быть выполнены ВСЕ условия:

```text
[ ] старый OAuth token revoked
[ ] новый token создан
[ ] новый token в /opt/raspechatka/.env
[ ] Client Secret перевыпущен
[ ] metrika:offline_data доступен
[ ] production code ещё не переключён
[ ] выбран один безопасный реальный order
[ ] owner дал явное разрешение на live write
```

Без этого:

```text
НЕ POST
```

---

# 42. Первый live test order

Выбрать существующий реальный order, который:

```text
имеет yandexClientId
имеет понятный status
имеет корректный createdAt
имеет понятные revenue/cost
```

Предпочтительно:

```text
не использовать случайный synthetic ClientID
```

потому что нам нужно проверить реальную linkage capability.

Но executor сначала возвращает order ID-кандидат без раскрытия персональных данных.

---

# 43. Live write sequence

После разрешения владельца:

### Test 1

Отправить один order:

```text
IN_PROGRESS
```

если это соответствует реальному текущему/историческому состоянию выбранного заказа.

Или его фактический normalized current status.

Не искажать реальную историю ради теста.

### Проверить

```text
HTTP 200
api_validation_status = PASSED
uploading_id получен
elements_count = 1
```

---

# 44. Проверка metrika:offline_data

Первый успешный:

```text
POST /cdp/api/v1/counter/111569944/data/simple_orders
```

фактически подтверждает write capability нужного token/scopes.

Не выполнять отдельный destructive/write request только ради scope test.

---

# 45. Production rollout — последовательность

Production rollout должен быть отдельным контролируемым шагом после review.

Целевая последовательность:

```text
1. merge CRM feature/analytics-foundation → master
2. deploy CRM
3. Prisma migrations
4. добавить/проверить OAuth token env
5. dry health check
6. запустить historical analytics backfill --apply
7. проверить backfill
8. включить Metrika outbox worker
9. отправить один controlled order
10. проверить upload
11. убедиться, что новые PAID идут из CRM
12. создать/проверить обязательные JS goals
13. merge web feature/analytics-event-model → feature/cms-admin
14. production site deploy
15. ложный browser purchase исчезает
16. lead_submitted остаётся
```

Порядок может быть скорректирован executor'ом только с объяснением.

---

# 46. Критическое правило false purchase

До того как CRM→Metrika live write доказан:

```text
production browser purchase НЕ отключать
```

После того как:

```text
controlled order upload = success
и
PAID worker = доказан
```

можно выполнять координированный merge сайта.

---

# 47. Двойной учёт во время rollout

Нужно минимизировать окно, когда одновременно существуют:

```text
browser false purchase
+
CRM PAID order
```

Целевая стратегия:

```text
доказали CRM sync
↓
в тот же rollout window
↓
отключили false browser purchase
```

В отчёте executor должен оценить, возникнет ли короткое overlap window и как оно повлияет на данные.

---

# 48. Missing goals before web rollout

До production merge:

```text
feature/analytics-event-model
→ feature/cms-admin
```

нужно создать или осознанно отложить обязательные JS goals:

```text
lead_submitted_photo
lead_submitted_canvas
lead_submitted_tshirt
form_error
```

Иначе новые события будут отправляться, но воронка целей останется неполной.

---

# 49. Не использовать metrika:write в коде этапа 06

Если цели создаются вручную владельцем через UI:

```text
metrika:write не нужен
```

Не расширять OAuth scopes только ради convenience.

Если исполнитель хочет автоматизировать goals — это отдельный review item, не делать самостоятельно.

---

# 50. Built-in CRM goals

Передача статусов:

```text
IN_PROGRESS
PAID
CANCELLED
```

создаёт/использует системную CRM-логику Метрики:

```text
CRM: Order created
CRM: Order paid
CRM: Order canceled
```

Не создавать вручную JS goal:

```text
paid
```

только ради этого этапа.

---

# 51. Backfill старых CRM orders в Метрику

НЕ выполнять массовую историческую отправку заказов на этапе 06 автоматически.

Сначала:

```text
new live transitions
```

должны работать стабильно.

После этого можно создать отдельный controlled task:

```text
06_CRM_TO_METRIKA_HISTORICAL_SYNC
```

если это будет полезно и допустимо по окнам сопоставления.

---

# 52. 21-дневное окно

Не ожидать, что старые месяцы заказов автоматически идеально свяжутся с древними визитами.

Поэтому исторический mass sync не является критерием готовности 06.

Основная ценность начинается:

```text
с новых заказов
```

при которых ClientID уже структурирован.

---

# 53. Privacy

В simple_orders V1 отправлять:

```text
ClientID
order id
status
revenue
cost
currency
date
```

Не отправлять:

```text
имя
телефон
email
note
designNote
комментарии клиента
```

---

# 54. Tests — mapper

Покрыть:

```text
LEAD → no sync
LEAD→NEW → IN_PROGRESS
NEW→APPROVAL_SENT → no duplicate normalized status
NEW→PAID → PAID
NEW→CANCELLED → CANCELLED
LEAD→CANCELLED without accepted order → no CRM order sync
CANCELLED→NEW reopen → IN_PROGRESS
PAID→CANCELLED → CANCELLED
```

Если фактическая бизнес-логика запрещает некоторые переходы — тестировать реальный разрешённый graph.

---

# 55. Tests — identifiers

Проверить:

```text
ClientID 20 digits
```

не теряет precision.

Тест:

```text
"12345678901234567890"
```

должен остаться точной строкой в CSV.

---

# 56. Tests — dates

Проверить:

- UTC DB date;
- conversion в `counter.time_zone_name`;
- DST, если timezone имеет DST;
- повторный upload даёт тот же `create_date_time`.

---

# 57. Tests — CSV escaping

Пусть сейчас PII не передаётся, всё равно CSV builder должен корректно работать.

Проверить:

```text
commas
quotes
newlines
empty values
```

Использовать библиотеку/надёжный serializer либо хорошо протестированный helper.

---

# 58. Tests — financial parity

Выбрать representative orders:

```text
Photo
Tshirt
Canvas
```

Сравнить:

```text
financial snapshot для Metrika
vs
существующий CRM P&L
```

Не должно появиться новая независимая математика.

---

# 59. Tests — outbox transaction

Проверить:

```text
CRM status transaction rollback
→ outbox row тоже rollback
```

и:

```text
CRM status commit
→ outbox row существует
```

---

# 60. Tests — worker retry

Проверить:

```text
429
500
timeout
network
```

→ retry.

Проверить:

```text
validation FAILED
400
```

→ не бесконечный retry.

---

# 61. Tests — idempotency

Повторная обработка одного outbox row:

```text
не создаёт второй order ID
```

Повторная remote отправка:

```text
тот же OrderPhoto.id
merge_mode=SAVE
```

---

# 62. Analytics failure isolation

Если Metrika:

```text
лежит
token сломан
429
timeout
```

то:

```text
смена статуса CRM всё равно успешна
```

Outbox остаётся для retry.

---

# 63. Monitoring

Минимальные operational metrics/log fields:

```text
pending
processed
failed
retrying
skipped_no_client_id
last_success_at
last_failure_at
```

Логировать:

```text
orderId
normalized status
attempt
HTTP status
duration
uploading_id
```

Не логировать token.

---

# 64. Documentation

Создать/обновить:

```text
docs/analytics/06_CRM_TO_METRIKA.md
docs/analytics/00_MASTER_PLAN.md
docs/analytics/01_CURRENT_STATE.md
```

Если появляются новые confirmed business facts — обновить current state.

В Master:

```text
05_YANDEX_METRIKA_API = DONE
06_CRM_TO_METRIKA = REVIEW
```

после реализации.

Не ставить:

```text
06 = DONE
```

самостоятельно.

---

# 65. Формат ответа исполнителя — фаза реализации

## EXECUTOR_REPORT

### 1. RESULT

Одно из:

```text
READY_FOR_REVIEW
READY_FOR_LIVE_WRITE_TEST
PARTIAL
BLOCKED
```

### 2. GIT

```text
repo:
branch:
commit:
push:
git status:
master touched:
web production touched:
```

### 3. API DECISION

```text
endpoint:
merge_mode:
format:
why simple_orders:
```

### 4. COUNTER TIMEZONE

```text
time_zone_name:
time_zone_offset:
source:
```

### 5. STATUS MAPPING

Таблица:

```text
CRM transition/state | normalized Metrika status | enqueue? | reason
```

### 6. ELIGIBILITY

```text
accepted order definition:
lead cancellation behavior:
no ClientID behavior:
reopen behavior:
```

### 7. PAYLOAD

Показать redacted пример:

```text
id
create_date_time
client_ids
order_status
revenue
cost
currency
```

Без реальных ClientID.

### 8. FINANCIAL MAPPING

```text
revenue source:
cost source:
shared P&L logic:
refactor made:
parity result:
cost coverage:
```

### 9. OUTBOX

```text
model:
dedupe strategy:
source transition id:
locking:
retry:
dead-letter/manual retry:
```

### 10. WORKER

```text
trigger/schedule:
batch size:
timeout:
success condition:
failure handling:
```

### 11. SECURITY

```text
old token revoked: yes/no/unknown
new token on server: yes/no
client secret rotated: yes/no/unknown
token logged: no
PII sent: list
```

### 12. TESTS

Таблица:

```text
Команда | Результат
```

### 13. LIVE WRITE

До approval:

```text
executed: no
candidate order:
candidate normalized status:
payload validation ready:
owner approval required: yes
```

### 14. FILES_CHANGED

```text
Файл | Что | Почему
```

### 15. NEW FACTS DISCOVERED

Все новые факты, которые влияют на 07/08.

### 16. DEVIATIONS

Если нет:

```text
none
```

### 17. OPEN ISSUES

Если нет:

```text
none
```

### 18. QUESTIONS FOR REVIEWER

Только блокирующие архитектурные вопросы.

---

# 66. Decision Gate — до live write

ChatGPT проверяет реализацию.

Если архитектура корректна:

```text
06_CRM_TO_METRIKA = READY_FOR_LIVE_WRITE_TEST
```

После этого владелец отдельно разрешает:

```text
разрешаю live write
```

Только тогда выполняется один реальный POST.

---

# 67. Формат LIVE WRITE отчёта

## EXECUTOR_REPORT_LIVE_WRITE

### 1. RESULT

```text
READY_FOR_REVIEW
BLOCKED
```

### 2. PRECONDITIONS

```text
new secure token:
client secret rotated:
offline_data write enabled:
owner approval:
```

### 3. TEST ORDER

```text
order id:
CRM status:
Metrika normalized status:
ClientID present: yes/no
revenue present:
cost present:
```

Не выводить ClientID.

### 4. API RESULT

```text
HTTP:
api_validation_status:
elements_count:
uploading_id:
duration:
```

### 5. OUTBOX RESULT

```text
created:
attempts:
processedAt:
lastError:
```

### 6. CRM ISOLATION

Подтвердить:

```text
CRM status update waited for Yandex: no
CRM remained successful during simulated API failure: yes
```

### 7. LAST UPLOADINGS CHECK

```text
upload found:
source:
format:
validation:
```

### 8. WRITE SECURITY

```text
token printed: no
PII beyond allowed contract: no
unexpected write calls: no
```

### 9. NEXT ROLLOUT DECISION

```text
safe to merge CRM:
safe to switch off browser purchase:
blocking issues:
```

---

# 68. Final Decision Gate

Этап 06 считается DONE только если:

- simple_orders integration реализована;
- ClientID не теряет precision;
- status mapping корректна;
- LEAD не превращается в order;
- rejected lead не создаёт CANCELLED order без eligibility;
- revenue/cost используют существующую business logic;
- transactional outbox работает;
- CRM status changes не зависят от Yandex;
- retry/idempotency работают;
- один реальный controlled order успешно принят API;
- `api_validation_status=PASSED`;
- token остаётся секретом;
- production false purchase ещё не отключён до финального rollout решения;
- есть конкретный безопасный rollout plan.

После этого:

```text
06_CRM_TO_METRIKA = DONE
```

и следующий этап:

```text
07_METRIKA_TO_ANALYTICS.md
```

---

# 69. Что НЕ делать сейчас

Не делать:

- массовый historical order import;
- detailed contacts/orders API;
- customer entity;
- phone/email matching;
- products catalog в Метрике;
- Reports sync database;
- dashboard;
- Logs API;
- Direct API;
- automated insights;
- multi-touch attribution;
- новую финансовую формулу;
- массовое создание целей API write-scope;
- merge production branches до review.

---

# 70. Команда исполнителю

Выполни `06_CRM_TO_METRIKA.md` в две фазы.

## Фаза 1 — реализация без production write

1. Изучи `GulianOutbox`.
2. Реализуй simple_orders client.
3. Реализуй normalized status mapping.
4. Реализуй financial snapshot с переиспользованием существующего P&L.
5. Реализуй transactional outbox.
6. Реализуй worker/retry/idempotency.
7. Покрой тестами.
8. Не выполняй live POST.
9. Верни `EXECUTOR_REPORT`.

Если всё готово — результат:

```text
READY_FOR_LIVE_WRITE_TEST
```

## Фаза 2 — только после отдельного разрешения владельца

После команды:

```text
разрешаю live write
```

и только если новый безопасный OAuth token установлен:

1. отправь один выбранный реальный order;
2. проверь `PASSED`;
3. проверь outbox;
4. проверь last_uploadings;
5. верни `EXECUTOR_REPORT_LIVE_WRITE`.

Production branches не сливай без отдельной команды.

---

# 71. EXECUTOR_REPORT — фаза 1, 11.09.2026

## 1. RESULT

```text
READY_FOR_LIVE_WRITE_TEST
```

Реализация без production write выполнена целиком: очередь, воркер, снимок
заказа, финансы из P&L, тесты. Живой POST не выполнялся. Production не тронут.

## 2. GIT

```text
repo:                    racpechatca
branch:                  feature/analytics-foundation
commit:                  12cb9d8 (этап 06), b24d2f2 (merge origin/master → ветка),
                         далее — документы
push:                    origin/feature/analytics-foundation
git status:              чисто
master touched:          no  (master слит В ветку, чтобы она осталась
                         сливаемой: за день на master ушёл Web Push;
                         обратного слияния не было)
web production touched:  no  (сайт не менялся; feature/analytics-event-model
                         не слита, browser purchase на бою по-прежнему есть)
```

## 3. API DECISION

```text
endpoint:          POST /cdp/api/v1/counter/111569944/data/simple_orders
                   ?merge_mode=SAVE&delimiter_type=COMMA
                   multipart/form-data, поле file (orders.csv)
merge_mode:        SAVE — каждый раз уходит полный канонический снимок заказа
format:            CSV, полный официальный заголовок:
                   id,create_date_time,client_uniq_id,client_ids,emails,phones,
                   order_status,revenue,cost,goals,currency
                   заполняем id, create_date_time, client_ids, order_status,
                   revenue, cost, currency=RUB; остальное пусто
why simple_orders: у CRM нет сущности клиента; ClientID лежит прямо на
                   OrderPhoto; один стабильный id обновляет заказ; не нужны
                   contacts/product lists/status mapping. Товары не передаём.
диагностика:       GET /cdp/api/v1/counter/111569944/last_uploadings (только чтение)
проверено по документации: форматы дат CSV (yyyy-MM-dd HH:mm:ss — поддерживаемый),
                   колонки simple_orders, ответ uploading{uploading_id,
                   api_validation_status PASSED|FAILED, elements_count, …}
```

## 4. COUNTER TIMEZONE

```text
time_zone_name:    не читался — токена нет (см. § 11); в коде НЕ предполагается
time_zone_offset:  —
source:            воркер перед первой отправкой читает
                   GET /management/v1/counter/111569944 → time_zone_name
                   (IANA), проверяет через Intl, кэширует на процесс; пояс не
                   прочитан или непригоден → строка ждёт повтора, отправки нет.
                   Фактическое значение будет записано в отчёте фазы 2
                   (`metrika:orders status` печатает пояс и смещение).
```

## 5. STATUS MAPPING

```text
CRM transition/state                      | normalized Metrika status | enqueue? | reason
------------------------------------------+---------------------------+----------+------------------------------------------
LEAD (создание заявки)                    | —                         | нет      | заявка — не заказ
LEAD → NEW                                | IN_PROGRESS               | да       | первый момент «заявка стала заказом»
NEW → APPROVAL_SENT/FOLDER…/IN_PROGRESS/  | IN_PROGRESS               | нет      | нормализованный статус не изменился
   PRINTED/READY/SHIPMENT_CREATED/DONE/   |                           |          |
   SENT/READY_FOR_REVIEW/COMPLETED/PROBLEM|                           |          |
любой рабочий → PAID                      | PAID                      | да       | оплата
любой рабочий → CANCELLED                 | CANCELLED                 | да       | отмена принятого заказа
LEAD → CANCELLED                          | CANCELLED                 | ставится | воркер проверит право: без принятия —
                                          |                           |          | skipped/not_eligible_rejected_lead
CANCELLED → NEW (и любой рабочий)         | IN_PROGRESS               | да       | возврат в работу
PAID → CANCELLED                          | CANCELLED                 | да       | отмена оплаченного
PAID → рабочий                            | IN_PROGRESS               | да       | оплату сняли — заказ снова в работе
NEW → LEAD (откат в заявку)               | —                         | нет      | в Метрике заказ остаётся как был:
                                          |                           |          | это не отмена, врать нельзя
```

~~Отправляется всегда текущее нормализованное состояние заказа в момент
обработки строки.~~ **Отменено FIX_01 (12.09.2026):** отправляется статус
перехода (`targetMetrikaStatus` строки), строки одного заказа идут строго
по порядку — см. `06_CRM_TO_METRIKA_FIX_01.md`, раздел 21.

Точки постановки — все места CRM, где пишется StatusHistory и меняется статус:
`OrderPhotoService.updateStatusOrder` (панель), `ScenarioDraftService`
(оформление заказа из заявки: LEAD → NEW), `SalaryService` (выплата зарплаты
переводит заказ в PAID), `PartnerApiController` (партнёр: in_progress/ready —
обычно ничего не ставит, но покрывает возврат отменённого). Два писателя без
постановки — по построению не меняют нормализованный статус: `partner-status-poll`
исключает PAID/CANCELLED, `telegram-update` ставит только рабочие статусы и
отказывает по отменённым.

## 6. ELIGIBILITY

```text
accepted order definition:  текущий статус — любой рабочий или PAID (B); либо
                            в StatusHistory есть переход С или В рабочий статус
                            (A: читается по toStatus И fromStatus — заказ,
                            заведённый руками сразу в NEW, строки «→ NEW» не
                            имеет, но его отмена запишется как NEW → CANCELLED);
                            либо заказ уже доставлялся в Метрику (C: есть
                            строка очереди delivered)
lead cancellation behavior: LEAD → CANCELLED без принятия → skipped,
                            skipReason=not_eligible_rejected_lead; заказ в
                            Метрике не создаётся
no ClientID behavior:       skipped, skipReason=no_client_id; телефон/почта из
                            note не используются; считается отдельно в CLI
                            (skippedNoClientId)
reopen behavior:            CANCELLED → NEW ставит IN_PROGRESS; тот же
                            OrderPhoto.id, SAVE обновляет заказ; уникальных
                            ограничений вида (orderId, status) нет — dedupe
                            только по StatusHistory.id
```

Уточнение правила 21 по фактической модели: PROBLEM в StatusHistory — строка
(telegram пишет toStatus='PROBLEM', а статус заказа ставит IN_PROGRESS);
считается рабочим статусом принятого заказа.

## 7. PAYLOAD

Реальный заказ из копии базы (ClientID скрыт):

```text
id,create_date_time,client_uniq_id,client_ids,emails,phones,order_status,revenue,cost,goals,currency
2a20a0df-8ff5-4711-acaa-8e9321dddfef,2026-08-15 18:40:12,,1786…(19 цифр),,,PAID,500,13,,RUB
```

(дата — в поясе Europe/Moscow, который в проверке подставлял фиктивный
клиент; в бою пояс придёт из счётчика.)

## 8. FINANCIAL MAPPING

```text
revenue source:    OrderPhoto.totalOrder — договорная сумма заказа целиком:
                   позиции + доставка + дизайн + срочность; то, что платит клиент.
                   Гипотеза «Yandex revenue = totalOrder» подтверждена кодом:
                   отчёт кладёт totalOrder в оборот (PnlRaw.totalRevenue), а
                   выручку признаёт по оплате (clientPaidAt → completedAt → …).
                   Для Метрики revenue = сумма заказа, признание — статусом PAID.
cost source:       себестоимость по заказу = ровно cogs P&L-отчёта:
                   фото — бумага по формату (photo-material.ts, копейки → ceil ₽);
                   футболки — вознаграждение партнёру (settleOrder(settlementPositions)):
                   материалы + доля маржи; холсты — сумма contractorCostPosition.
                   Зарплата и доставка перевозчику НЕ входят — в отчёте они тоже
                   вне cogs (отдельные строки). ExpenseOrder не используется:
                   в отчёте авто-расходы подрядчиков в себестоимость не идут
                   (иначе двойной учёт).
shared P&L logic:  crm-new/src/reports/order-cogs.ts — orderCostOfGoods(order,
                   settings), costSettingsFrom(partnerSettings)
refactor made:     формула вынесена из addOrder (reports.service.ts) в
                   order-cogs.ts; addOrder и costSettings() теперь вызывают её.
                   Числа не менялись — только место.
parity result:     order-cogs.spec.ts: для фото/футболок/холстов cogs заказа ==
                   то, что addOrder кладёт в bucket, и == finalize(b).cogs;
                   существующие reports-pnl тесты зелёные.
cost coverage:     ненадёжной считается себестоимость без позиций или для
                   неизвестной категории → колонка cost пустая (не 0).
                   На копии базы у 11 заказов с ClientID: 10 с позициями
                   (cost надёжен), 1 заявка без позиций (LEAD, не отправляется).
```

## 9. OUTBOX

```text
model:                  MetrikaOrderOutbox (Prisma), миграция
                        20260912090000_metrika_order_outbox — новая таблица,
                        FK → OrderPhoto (cascade), индексы (status,nextAttemptAt),
                        (orderId), unique(dedupeKey)
поля:                   id, orderId, dedupeKey, sourceStatusHistoryId,
                        targetMetrikaStatus, sentMetrikaStatus, status
                        (pending|processing|delivered|failed|skipped), skipReason,
                        attemptCount, nextAttemptAt, lockedAt, processedAt,
                        lastError, responseCode, remoteUploadingId,
                        apiValidationStatus, elementsCount, createdAt, updatedAt
dedupe strategy:        dedupeKey = history:<StatusHistory.id> (unique);
                        повтор — P2002, молча пропускается; ручные строки —
                        manual:<uuid>
source transition id:   StatusHistory.id (та же транзакция, что статус)
locking:                UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)
                        RETURNING — как у GulianOutbox
retry:                  60 с, 5 мин, 15 мин, 1 ч, 6 ч (далее 6 ч), максимум 20
                        попыток — как у GulianOutbox; только на 429/5xx/сеть/
                        таймаут; not_configured — пауза 1 ч без расхода попытки
dead-letter/manual:     400, 401, 403, api_validation_status≠PASSED, заказ не
                        найден → failed сразу; строка не удаляется;
                        `metrika:orders requeue --order <id> | --all-failed`
payload strategy:       B — очередь хранит intended status + переход, снимок
                        строится из актуального заказа при отправке;
                        create_date_time/id детерминированы
```

## 10. WORKER

```text
trigger/schedule:   setInterval 30 с + первый прогон через 5 с
                    (как GulianOutboxProcessor); только при
                    YANDEX_METRIKA_ORDERS_SYNC_ENABLED=true И настроенном клиенте
batch size:         10 строк за прогон; 1 заказ = 1 upload
timeout:            10 с на запрос (клиент), без повторов внутри клиента для POST
success condition:  HTTP 200 и api_validation_status == PASSED →
                    delivered, сохранены uploading_id, elements_count,
                    sentMetrikaStatus, processedAt
failure handling:   см. § 9; лог: orderId, статус, попытка, HTTP, мс,
                    uploading_id, ClientID маской (4 цифры)
switch:             YANDEX_METRIKA_ORDERS_SYNC_ENABLED (compose, .env.example);
                    по умолчанию false — очередь копится, наружу не уходит.
                    Контрольная отправка из CLI рубильник обходит намеренно.
```

## 11. SECURITY

```text
old token revoked:    unknown  (действие владельца; в чат не сообщалось)
new token on server:  no       (ключей YANDEX_METRIKA_* в /opt/raspechatka/.env нет)
client secret rotated: unknown
token logged:         no
PII sent:             ничего: ClientID, id заказа, дата, статус, сумма,
                      себестоимость, RUB. Имя/телефон/почта/note/designNote —
                      нет (колонки emails/phones/client_uniq_id пустые)
```

## 12. TESTS

| Команда | Результат |
|---|---|
| `npx jest src/metrika/orders` | 74 passed: статусы и переходы (§54), eligibility A/B/C, CSV/экранирование (§57), ClientID 20 цифр (§55), даты/DST/детерминизм (§56), снимок/пропуски, постановка в tx + rollback (§59), воркер: PASSED, FAILED, 429/500/таймаут/сеть → retry (§60), 400/401/403 → failed, паузы 60→21600 с, 20 попыток, идемпотентность (§61), изоляция сбоев, рубильник |
| `npx jest src/reports` | order-cogs паритет с addOrder/finalize (§58) + существующие P&L |
| `npx jest src/metrika` | 93 passed (клиент: POST multipart, merge_mode=SAVE, без повторов на POST, 403 → offline_data, last_uploadings) |
| `npx jest` (вся CRM) | **70 suites, 730 passed** |
| `npm run build` | OK |
| `npx tsc --noEmit` | без новых ошибок (те же 4 старых в двух spec-файлах master) |
| Копия боевой базы `crm_stage06_test` на сервере (pg_dump crm), через SSH-туннель | `prisma migrate deploy` — 3 миграции применились; `analytics:backfill --apply` на копии — 11 ClientID; e2e-скрипт с фиктивным клиентом: постановка в транзакции, откат транзакции → строки нет, дубль по unique → пропуск, захват FOR UPDATE SKIP LOCKED, 503 → retry → delivered (attempts=2), skipped rejected_lead и no_client_id, processById на не-pending → null, counters; `metrika:orders status/preview` работают |
| Запуск CRM (`node dist/src/main.js`) против копии | DI собрался: MetrikaOrdersModule initialized, воркер: «отправка выключена» |

Живой POST в Метрику **не выполнялся** ни в одном тесте.

## 13. LIVE WRITE

```text
executed:                    no
candidate order:             20260815-050  (id 2a20a0df-8ff5-4711-acaa-8e9321dddfef)
                             ЗАМЕНЁН в FIX_01 (старше 21 дня): → 20260909-091, IN_PROGRESS
                             фото, PAID с 02.09.2026, создан 15.08.2026 15:40 UTC,
                             ClientID есть (19 цифр), totalOrder 500, cost 13 ₽,
                             история LEAD→NEW→SENT→PAID — реальный заказ,
                             история не искажается
candidate normalized status: PAID
запасной кандидат:           20260909-091 (фото, NEW → IN_PROGRESS, создан
                             09.09.2026, ClientID есть, 534 ₽ / cost 12 ₽)
payload validation ready:    yes — `npm run metrika:orders -- preview --order 20260815-050`
owner approval required:     yes
где выполнять:               из checkout ветки с новым токеном в окружении
                             процесса, DATABASE_URL → копия crm_stage06_test
                             (там уже есть таблица очереди и ClientID), команда
                             `npm run metrika:orders -- send --order 20260815-050 --live`
                             — один POST, строка очереди ляжет в копию, бой не тронут
```

## 14. FILES_CHANGED

| Файл | Что | Почему |
|---|---|---|
| `crm-new/prisma/schema.prisma` | модель `MetrikaOrderOutbox`, связь с OrderPhoto | § 28–30 |
| `crm-new/prisma/migrations/20260912090000_metrika_order_outbox/` | новая таблица | § 30 |
| `crm-new/src/metrika/orders/metrika-order-status.ts` (+spec) | нормализация статусов, переходы, eligibility | § 16–22 |
| `crm-new/src/metrika/orders/metrika-order-csv.ts` (+spec) | CSV, экранирование, дата в поясе счётчика | § 11–15, 57 |
| `crm-new/src/metrika/orders/metrika-order-payload.ts` (+spec) | снимок заказа, пропуски, маска ClientID | § 7–10, 23–27, 53 |
| `crm-new/src/metrika/orders/metrika-order-outbox.service.ts` (+spec) | постановка в очередь в транзакции, dedupe, requeue, счётчики | § 28–31 |
| `crm-new/src/metrika/orders/metrika-order-outbox-processor.service.ts` (+spec) | воркер: захват, снимок, POST, PASSED, retry, failed | § 33–36 |
| `crm-new/src/metrika/orders/metrika-orders.module.ts` | модуль, фабрика воркера с рубильником | — |
| `crm-new/src/metrika/metrika-api.client.ts` (+spec) | `uploadSimpleOrders` (POST multipart, без повторов), `getLastUploadings` | § 4, 38 |
| `crm-new/src/metrika/metrika.types.ts` | time_zone_*, типы загрузок | § 11, 36 |
| `crm-new/src/metrika/metrika.config.ts` | `metrikaOrdersSyncEnabledFromEnv` | § 40 |
| `crm-new/src/reports/order-cogs.ts` (+spec) | себестоимость заказа — общая функция | § 25–26 |
| `crm-new/src/reports/reports.service.ts` | addOrder/costSettings через order-cogs | § 26 |
| `crm-new/src/order-photo/order-photo.service.ts` | постановка в очередь в транзакции updateStatusOrder | § 28 |
| `crm-new/src/scenarios/scenario-draft.service.ts` | LEAD → NEW ставит IN_PROGRESS | § 17 |
| `crm-new/src/salary/salary.service.ts` | выплата → PAID ставит PAID | § 18 |
| `crm-new/src/partner/partner-api.controller.ts` | транзакция + постановка | § 22 |
| модули order-photo, scenario, salary, partner | импорт MetrikaOrdersModule | — |
| `crm-new/src/analytics/metrika-orders.ts`, `package.json` | CLI status/preview/send/requeue | § 38–39 |
| spec-файлы salary/scenarios/order-photo | заглушка очереди в конструкторах | — |
| `docker-compose.prod.yml`, `.env.example` | `YANDEX_METRIKA_ORDERS_SYNC_ENABLED` | § 40 |
| `docs/analytics/06_CRM_TO_METRIKA.md`, `00_MASTER_PLAN.md`, `01_CURRENT_STATE.md` | этот отчёт, статусы, факты | § 64 |

## 15. NEW FACTS DISCOVERED

1. **Боевая база содержит три миграции, которых нет в репозитории**
   (`20260531222621_add_yandex_request_id`, `20260531224724_add_delivery_info`,
   `20260728190000_add_gulian_transactional_outbox`) — `prisma migrate status`
   на копии показал их как «в базе, но не локально». Deploy это терпит
   (применяет только недостающие), но при первом же `migrate diff`/resolve
   нужно помнить о дрейфе.
2. **master ушёл вперёд на 5 коммитов (Web Push, миграция
   `20260911120000_web_push`)** — слит в ветку; конфликты только в модулях и
   конструкторе OrderPhotoService. Ветка снова сливаема.
3. Статус меняют **шесть** мест в CRM, не одно (панель, оформление из заявки,
   выплата зарплаты, партнёрский API, опрос партнёра, Telegram-кнопки).
   Постановка в очередь стоит в четырёх; два оставшихся нормализованный
   статус не меняют по построению.
4. Все 11 заказов с ClientID на текущий момент — фото; футболки и холсты с
   ClientID появятся только с новыми заявками после выкладки этапа 04.
5. В себестоимости отчёта нет доставки перевозчику и зарплаты — они отдельные
   строки P&L; поэтому в Метрику `cost` = чистая себестоимость товара
   (бумага / партнёр / подрядчик). Для этапов 07–08: «прибыль» Метрики
   (revenue − cost) будет выше чистой прибыли CRM ровно на зарплату и
   доставку — это ожидаемо и должно быть подписано в дашборде.
6. Дата CSV: официально поддерживаемые форматы включают `yyyy-MM-dd HH:mm:ss`
   (страница «Форматы даты и времени»); в примерах Яндекса — `dd.MM.yyyy HH:mm`.
   Используем первый.

## 16. DEVIATIONS

1. § 11 «перед live write получить time_zone_name» — токена нет, пояс не
   прочитан; в коде он читается перед первой отправкой и без него отправки
   нет. Фактическое значение — в отчёте фазы 2.
2. § 30 — набор полей расширен (`status`, `skipReason`, `sentMetrikaStatus`,
   `responseCode`, `elementsCount`) по образцу GulianOutbox.
3. § 40/45 — добавлен рубильник `YANDEX_METRIKA_ORDERS_SYNC_ENABLED`: без него
   выкладка ветки с токеном в окружении начала бы отправлять заказы сама, до
   контрольного теста.
4. Слит origin/master в ветку (не наоборот) — иначе ветку нельзя было бы
   выложить без конфликтов; master не менялся.

## 17. OPEN ISSUES

1. Токен: отозвать показанный, выпустить новый (metrika:read +
   metrika:offline_data), положить в `/opt/raspechatka/.env` — владелец.
2. Client Secret — перевыпустить (владелец).
3. Явное разрешение «разрешаю live write» — владелец; после него один POST
   по заказу 20260815-050 из копии базы.
4. Копия `crm_stage06_test` на сервере оставлена для фазы 2 (данные боевые,
   доступ только внутри сети контейнеров); после фазы 2 удалить.
5. Три миграции в боевой базе без файлов в репозитории (факт 1) — не блокер,
   но перед rollout проверить `prisma migrate status` на бою.

## 18. QUESTIONS FOR REVIEWER

```text
none
```
