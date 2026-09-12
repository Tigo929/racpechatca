# 06_CRM_TO_METRIKA_LIVE_WRITE.md

# Этап 06 — Live write: один реальный CRM order через outbox

## Статус

```text
REVIEW — LIVE WRITE ВЫПОЛНЕН
```

12.09.2026 11:45 MSK по команде владельца выполнен один контрольный POST через
очередь: заказ 20260909-091 → IN_PROGRESS, HTTP 200, PASSED, elements 1,
uploading 54f3af75-…; production не тронут. Отчёт — раздел 24. Ротация
токена/секрета — отдельная security-задача владельца.

> FIX_01 принят.
> Архитектурных доработок перед live write больше не требуется.
> Сам этап 06 остаётся НЕ DONE до успешного controlled write.

# 1. Решение Reviewer

Фаза 1 + FIX_01 принимаются.

Подтверждено:

```text
targetMetrikaStatus хранится в outbox
per-order ordering есть
failed row блокирует более поздние transition
multi-worker race закрыт
fresh DB собирается из repository migrations
recent candidate найден
live POST ещё не выполнялся
```

Статус:

```text
06_CRM_TO_METRIKA = READY_FOR_LIVE_WRITE_TEST
```

Но live write разрешается только после выполнения security preconditions и явной команды владельца:

```text
разрешаю live write
```

# 2. Security preconditions

До POST обязательно подтвердить:

```text
[ ] ранее раскрытый OAuth token отозван
[ ] выпущен новый OAuth token
[ ] новый token имеет metrika:read + metrika:offline_data
[ ] новый token хранится только в secure env
[ ] ранее раскрытый Client Secret перевыпущен
```

Значения token/secret в отчёт не выводить.

Если хотя бы один пункт не выполнен:

```text
BLOCKED — SECURE_OAUTH_REQUIRED
```

POST не выполнять.

# 3. Новый token

Целевой server secret location:

```text
/opt/raspechatka/.env
```

Должно присутствовать:

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<new secret>
```

Production backend перезапускать для live test НЕ требуется.

Допустимо безопасно прочитать env из server secret store только в environment тестового процесса.

# 4. Counter timezone — обязательный preflight

Перед payload preview выполнить read-only counter request и получить реальные:

```text
time_zone_name
time_zone_offset
```

Записать их в отчёт.

После этого показать преобразование:

```text
candidate OrderPhoto.createdAt UTC
→ Yandex create_date_time in counter timezone
```

Не отправлять POST, если timezone определить не удалось.

# 5. Candidate

Текущий предпочтительный кандидат:

```text
order: 20260909-091
id: f40a79d6-...
createdAt: 2026-09-09 11:25:57 UTC
age: ~3 days
expected normalized status from last review: IN_PROGRESS
ClientID: present
revenue: 534 RUB
cost: 12 RUB
```

ClientID в отчёте не показывать.

# 6. КРИТИЧЕСКИЙ preflight: не доверять старой копии вслепую

Перед live POST выполнить READ-ONLY сверку кандидата с ТЕКУЩЕЙ production DB.

Проверить:

```text
OrderPhoto.id
current CRM status
StatusHistory latest transition
yandexClientId present
createdAt
totalOrder
cost inputs
```

Production DB НЕ изменять.

Если production state изменился после создания `crm_stage06_test`:

```text
не отправлять старый IN_PROGRESS snapshot
```

Нужно:

```text
A. обновить тестовую копию фактическими безопасными данными кандидата
или
B. выбрать другого recent candidate
```

Отправляемый normalized status обязан соответствовать реальному бизнес-состоянию заказа.

# 7. Не искажать историю ради теста

Не менять production order status.

Не переводить заказ искусственно:

```text
NEW → PAID
PAID → CANCELLED
```

только для тестирования API.

Использовать фактический normalized state.

Если `20260909-091` уже стал PAID:

```text
targetMetrikaStatus = PAID
```

только если eligibility/history подтверждает, что accepted order действительно существует.

Если он CANCELLED — применить реальную eligibility rule.

# 8. Live write должен пройти через OUTBOX pipeline

Первый реальный POST должен проверять не только CSV client, но и нашу production-intended архитектуру:

```text
outbox row
↓
processor
↓
payload builder
↓
YandexMetrikaClient
↓
simple_orders
```

Не считать достаточным direct CLI вызов, который обходит:

```text
MetrikaOrderOutbox
ordering
retry
processedAt
```

Допустимый подход на `crm_stage06_test`:

1. создать/подготовить ОДНУ outbox row для candidate;
2. `sourceStatusHistoryId` должен соответствовать реальному transition либо явно маркированному controlled live-test source;
3. `targetMetrikaStatus` = фактический normalized status;
4. обработать именно через `MetrikaOrderOutboxProcessor`;
5. worker production при этом не включать.

Если существующий CLI `send --order --live` уже внутри вызывает тот же outbox processor — показать это в отчёте.

# 9. Один POST

Разрешено:

```text
ровно 1 POST
```

к:

```text
POST /cdp/api/v1/counter/111569944/data/simple_orders
```

Параметры:

```text
merge_mode=SAVE
delimiter_type=COMMA
```

Если запрос вернул техническую ошибку ДО принятия payload:

- не выполнять серию ручных повторов;
- сохранить outbox failure/retry state;
- вернуть отчёт.

Автоматический retry допустим только согласно уже реализованной policy, если reviewer-approved live runner действительно использует worker semantics. Для первого controlled test предпочтительно остановиться после первого понятного результата, если нет уверенности, был ли POST принят.

# 10. Payload

Перед POST показать REDACTED preview:

```text
id
create_date_time
client_ids = [REDACTED]
order_status
revenue
cost
currency
```

Проверить:

```text
currency = RUB
ClientID остаётся строкой
cost не подменяется нулём при unknown
status берётся из outbox.targetMetrikaStatus
```

# 11. Success criteria API

Успех только если одновременно:

```text
HTTP 200
api_validation_status = PASSED
elements_count = 1
uploading_id получен
```

Сохранить response metadata в outbox.

# 12. Outbox success criteria

После успеха:

```text
status = delivered / processed
processedAt != null
attemptCount корректен
lastError пуст
remoteUploadingId сохранён
apiValidationStatus = PASSED
```

Более поздняя row того же заказа, если она существует:

```text
НЕ должна была уйти раньше этой
```

# 13. Last uploadings verification

После POST выполнить read-only:

```text
GET /cdp/api/v1/counter/111569944/last_uploadings
```

Проверить, что controlled upload виден.

Зафиксировать:

```text
source
format
status/validation
uploading_id
```

# 14. Проверка matching / появления CRM order

Если API предоставляет read-only способ убедиться, что заказ принят как CRM order — выполнить.

Если немедленного read-after-write подтверждения связи заказа с визитом API не предоставляет:

```text
не выдумывать результат matching
```

Тогда зафиксировать только:

```text
upload accepted
validation PASSED
```

А фактическую атрибуцию/CRM goals проверим следующим read-only шагом после доступной задержки данных.

# 15. Не включать production worker

На этом шаге:

```text
YANDEX_METRIKA_ORDERS_SYNC_ENABLED
```

в production НЕ включать.

Не делать:

```text
merge → master
production deploy
production restart
historical mass sync
```

Live write выполняется из controlled runner/test copy.

# 16. Migration recovery — принято с ограничением

FIX_01 по migrations принимается для текущего проекта.

Зафиксировать operational rule:

```text
prisma migrate dev НЕ запускать против production DB
```

Production deployment использует:

```text
prisma migrate deploy
```

В будущем любые изменения historical migration files требуют отдельного review.

Не выполнять:

```text
manual _prisma_migrations edit
migrate resolve
```

без отдельного ТЗ.

# 17. Cleanup test databases

После завершения live write и сохранения всех нужных результатов удалить оставленные временные DB:

```text
crm_stage06_test
crm_fresh_test
```

ТОЛЬКО если они больше не нужны для повторного анализа.

В отчёте:

```text
deleted: yes/no
reason if kept:
```

Production DB не трогать.

# 18. False browser purchase

Даже после успешного live write:

```text
НЕ отключать production browser purchase в рамках этого шага
```

Сначала Reviewer проверяет live-write report.

Только после решения:

```text
06_CRM_TO_METRIKA = DONE
```

будет сформирован coordinated rollout:

```text
CRM deploy
→ worker enable
→ обязательные goals
→ web deploy
→ false purchase off
```

# 19. Формат отчёта

## EXECUTOR_REPORT_LIVE_WRITE

### 1. RESULT

```text
READY_FOR_REVIEW
BLOCKED
FAILED
```

### 2. SECURITY PRECONDITIONS

```text
old exposed token revoked:
new token present:
required scopes:
client secret rotated:
token printed/logged:
```

Значения не показывать.

### 3. COUNTER TIMEZONE

```text
time_zone_name:
time_zone_offset:
source:
```

### 4. CANDIDATE PRODUCTION RECHECK

```text
order:
copy state:
production current state:
latest StatusHistory:
same as copy: yes/no
ClientID present:
createdAt:
age:
revenue:
cost:
chosen normalized status:
```

Без ClientID.

### 5. REDACTED PAYLOAD

```text
id:
create_date_time:
client_ids: [REDACTED]
order_status:
revenue:
cost:
currency:
```

### 6. OUTBOX PATH

```text
row id:
sourceStatusHistoryId:
targetMetrikaStatus:
processed via outbox processor: yes/no
direct client bypass: no
```

### 7. API RESULT

```text
HTTP:
api_validation_status:
elements_count:
uploading_id:
duration:
```

### 8. OUTBOX RESULT

```text
status:
attemptCount:
processedAt:
lastError:
remoteUploadingId:
apiValidationStatus:
```

### 9. LAST UPLOADINGS

```text
found:
uploading_id match:
source:
format:
validation:
```

### 10. MATCHING STATUS

Одно из:

```text
confirmed
not yet observable
failed
```

Не считать `PASSED` доказательством визитного matching, если API этого не показывает.

### 11. CRM ISOLATION

```text
production order modified: no
production worker enabled: no
production restarted: no
master merged: no
```

### 12. TEMP DB CLEANUP

```text
crm_stage06_test:
crm_fresh_test:
```

### 13. SECURITY

```text
token committed: no
token logged: no
PII beyond approved contract: no
unexpected write requests: no
total POST count:
```

### 14. NEW FACTS

Если нет:

```text
none
```

### 15. OPEN ISSUES

Если нет:

```text
none
```

### 16. GIT

Если code/docs изменились:

```text
repo:
branch:
commit:
push:
status:
```

Если code не менялся — написать это.

# 20. Final Decision Gate

Reviewer может поставить:

```text
06_CRM_TO_METRIKA = DONE
```

если:

- security preconditions выполнены;
- timezone получен реально;
- candidate сверён с текущим production состоянием;
- candidate ≤ 21 days;
- POST прошёл именно через outbox processing path;
- HTTP 200;
- `api_validation_status=PASSED`;
- `elements_count=1`;
- outbox стал processed/delivered;
- last_uploadings подтверждает upload;
- production order/CRM/site не изменялись;
- false purchase ещё не отключён;
- секреты не раскрыты.

После этого создаётся rollout-план этапа 06 и затем:

```text
07_METRIKA_TO_ANALYTICS.md
```

# 21. Команда исполнителю

Пока НЕ выполнять POST.

Сначала владелец должен:

1. отозвать старый OAuth token;
2. выпустить новый;
3. положить новый token в secure env;
4. перевыпустить Client Secret;
5. написать:

```text
разрешаю live write
```

После этой команды выполнить строго этот документ и сделать не более одного controlled CRM-order POST через outbox pipeline.

---

# 22. PREFLIGHT перед live write — 12.09.2026 (POST не выполнялся)

Команды «разрешаю live write» не было; секреты не подготовлены. Выполнено
только то, что документ разрешает до POST: read-only сверка кандидата с
боевой базой, проверка наличия токена по именам ключей, подготовка пути
отправки через очередь.

## 1. RESULT

```text
BLOCKED — SECURE_OAUTH_REQUIRED
```

## 2. SECURITY PRECONDITIONS

```text
old exposed token revoked:  unknown  (владелец не сообщал)
new token present:          no — в /opt/raspechatka/.env нет ключей
                            YANDEX_METRIKA_COUNTER_ID / YANDEX_METRIKA_OAUTH_TOKEN /
                            YANDEX_METRIKA_ORDERS_SYNC_ENABLED (проверено по именам,
                            значения не читались)
required scopes:            не проверялись — токена нет
client secret rotated:      unknown
token printed/logged:       no
```

## 3. COUNTER TIMEZONE

```text
LIVE_TOKEN_REQUIRED_BEFORE_WRITE — без токена метаданные счётчика не читаются;
пояс не предполагается. При живом запуске `metrika:orders status` печатает
time_zone_name / time_zone_offset, `preview` — createdAt UTC → counter-local.
```

## 4. CANDIDATE PRODUCTION RECHECK (read-only, боевая база `crm`, 12.09.2026)

```text
order:                    20260909-091  (id f40a79d6-7a3b-4a5c-9ced-c441449fe2f0)
copy state:               NEW; история LEAD→NEW (09.09 11:49), NEW→FOLDER_STRUCTURE_CREATED
                          (11.09 12:48), FOLDER_STRUCTURE_CREATED→NEW (11.09 14:15)
production current state: NEW — совпадает
latest StatusHistory:     FOLDER_STRUCTURE_CREATED → NEW @ 2026-09-11 14:15 — совпадает
same as copy:             yes
ClientID present:         yes (на бою — в тексте note, колонки yandexClientId там ещё нет:
                          миграции этапа 02 на бой не выкладывались; в копии — в колонке
                          после backfill)
createdAt:                2026-09-09 11:25:57 UTC
age:                      3 дня
revenue:                  534 ₽ (totalOrder)
cost:                     12 ₽ — 1 позиция «Печать фото в стиле Instax» ×13 → 7 листов × 1,6 ₽
chosen normalized status: IN_PROGRESS  (recent PAID с ClientID на бою нет)
```

Запасной 20260908-082: на бою SENT (11.09 14:57), фото Polaroid ×25, 400 ₽,
ClientID в note есть, 4 дня — тоже IN_PROGRESS; в копии он SENT с той же
историей.

## 5. REDACTED PAYLOAD (preview на копии; дата пока в UTC — пояс придёт из счётчика)

```text
id:                f40a79d6-7a3b-4a5c-9ced-c441449fe2f0
create_date_time:  2026-09-09 11:25:57 UTC → <counter-local после чтения time_zone_name>
client_ids:        [REDACTED] (19 цифр, строка)
order_status:      IN_PROGRESS  (= outbox.targetMetrikaStatus)
revenue:           534
cost:              12
currency:          RUB
```

## 6. OUTBOX PATH — как пойдёт контрольная отправка

`npm run metrika:orders -- send --order 20260909-091 --live` (из checkout
ветки, DATABASE_URL → копия `crm_stage06_test`, токен — в окружении процесса):

```text
1. ищет в StatusHistory заказа последний переход, чей нормализованный итог =
   текущему статусу Метрики → для 20260909-091 это LEAD → NEW @ 09.09 11:49;
2. enqueueTransition с этим StatusHistory.id (dedupe history:<id>) — ровно та
   строка, которую создал бы боевой updateStatusOrder/ScenarioDraftService;
   если реального перехода нет — ручная строка с пометкой live-test;
3. processById → MetrikaOrderOutboxProcessor: захват с проверкой порядка
   (более ранних незакрытых строк у заказа нет), пояс из счётчика,
   buildOrderSnapshot(order, targetMetrikaStatus) → CSV → YandexMetrikaClient
   .uploadSimpleOrders(SAVE, COMMA) — один POST;
4. итог в строке: delivered + uploading_id/PASSED/elements_count/processedAt,
   либо failed/pending-с-паузой без ручных повторов (воркер не запущен —
   автоматического повтора не будет; отчёт по первому результату);
5. затем read-only GET last_uploadings (тот же `status`).
direct client bypass: no — прямого вызова клиента в CLI нет.
```

Без токена команда останавливается на «Клиент не настроен — отправка
невозможна» (код 2), POST не делает.

## 7–10. API RESULT / OUTBOX RESULT / LAST UPLOADINGS / MATCHING

```text
не выполнялось — POST запрещён до команды владельца
```

## 11. CRM ISOLATION

```text
production order modified: no
production worker enabled: no  (ключа нет; по умолчанию выключен)
production restarted:      no
master merged:             no
```

## 12. TEMP DB CLEANUP

```text
crm_stage06_test: kept — нужна для live write (таблица очереди + ClientID в колонке)
crm_fresh_test:   kept — удалить вместе с копией после live write
```

## 13. SECURITY

```text
token committed: no   token logged: no   PII beyond approved contract: no
unexpected write requests: no   total POST count: 0
```

## 14. NEW FACTS

1. На бою колонки `yandexClientId` ещё нет (этап 02 не выложен) — ClientID
   кандидата подтверждён по тексту `note`. Для live write из копии это не
   мешает: backfill на копии уже перенёс ClientID в колонку.

## 15. OPEN ISSUES

1. Секреты: отозвать показанный токен, выпустить новый с `metrika:read` +
   `metrika:offline_data`, положить в `/opt/raspechatka/.env`
   (`YANDEX_METRIKA_COUNTER_ID=111569944`, `YANDEX_METRIKA_OAUTH_TOKEN=…`);
   перевыпустить Client Secret. Затем команда «разрешаю live write».
2. Перед POST сверка кандидата с боем повторяется (состояние могло измениться).

## 16. GIT

```text
repo: racpechatca   branch: feature/analytics-foundation
commit: см. историю — «feat(аналитика, этап 06 / live write): контрольная отправка через реальный переход»
push: origin   status: чисто   master touched: no
```

---

# 23. Попытка live write по команде владельца — 12.09.2026 (POST не выполнялся)

Команда «РАЗРЕШАЮ LIVE WRITE» получена; отзыв/ротация токена по решению
владельца отложены в отдельную security-задачу. Указано: использовать текущий
токен из secure env.

## RESULT

```text
BLOCKED — LIVE_TOKEN_REQUIRED (secure env пуст)
```

## Что проверено

```text
/opt/raspechatka/.env:              ключей YANDEX_METRIKA_COUNTER_ID / YANDEX_METRIKA_OAUTH_TOKEN нет
все .env* и compose в /opt/raspechatka: упоминаний YANDEX_METRIKA_OAUTH_TOKEN нет
контейнер raspechatka-backend-1:    переменных YANDEX_METRIKA_* нет
(проверялись только имена ключей; значения не читались)
```

Токен существует только в переписке (показан владельцем 11.09). Документ
LIVE_WRITE (§ 3) допускает брать токен ТОЛЬКО из серверного secret store в
окружение тестового процесса; токен из чата этим требованием не является, и
исполнитель его не сохранял. Поэтому POST не выполнен.

## Read-only перепроверка кандидата на бою (12.09.2026, повторно)

```text
20260909-091 (f40a79d6-…): NEW, создан 2026-09-09 11:25:57 UTC, total 534, PHOTO,
ClientID в note есть, 1 позиция «Печать фото в стиле Instax» ×13, updated 11.09 14:15;
история: LEAD→NEW 09.09 11:49, NEW→FOLDER_STRUCTURE_CREATED 11.09 12:48,
FOLDER_STRUCTURE_CREATED→NEW 11.09 14:15 — без изменений против копии.
Копия crm_stage06_test: NEW, ClientID в колонке, строк очереди 0.
```

## Что нужно от владельца (одно действие)

Дописать в `/opt/raspechatka/.env` две строки (значение токена — в файл,
не в чат):

```env
YANDEX_METRIKA_COUNTER_ID=111569944
YANDEX_METRIKA_OAUTH_TOKEN=<текущий токен>
```

Перезапуск боевого backend не нужен: тестовый процесс прочитает эти строки
из файла в своё окружение сам. После этого — повтор команды, и исполнитель
выполняет § 4–13 документа за один прогон: пояс счётчика, повторная
read-only сверка кандидата, один POST через MetrikaOrderOutboxProcessor,
проверка api_validation_status / outbox / last_uploadings.

---

# 24. EXECUTOR_REPORT_LIVE_WRITE — 12.09.2026 11:45 MSK

Команда владельца «РАЗРЕШАЮ LIVE WRITE» получена; отзыв/ротация токена по
решению владельца вынесены в отдельную security-задачу после live write.
Токен взят из `/opt/raspechatka/.env` (владелец дописал его сам) в окружение
одного тестового процесса; на диск исполнителя не попадал.

## 1. RESULT

```text
READY_FOR_REVIEW
```

## 2. SECURITY PRECONDITIONS

```text
old exposed token revoked:  no — по решению владельца отложено (отдельная security-задача)
new token present:          в /opt/raspechatka/.env положен текущий (тот же) токен;
                            YANDEX_METRIKA_COUNTER_ID=111569944 — тоже
required scopes:            metrika:read — подтверждён (counter, last_uploadings прочитаны);
                            metrika:offline_data — подтверждён фактически: POST simple_orders
                            принят (HTTP 200, PASSED)
client secret rotated:      no — отложено (владелец)
token printed/logged:       no (CLI не печатает; вывод дополнительно фильтровался)
```

## 3. COUNTER TIMEZONE

```text
time_zone_name:    Europe/Moscow
time_zone_offset:  180 (минут)
source:            GET /management/v1/counter/111569944 (read-only), 12.09.2026 11:44:56 MSK
```

## 4. CANDIDATE PRODUCTION RECHECK (read-only, боевая база `crm`, непосредственно перед POST)

```text
order:                    20260909-091  (id f40a79d6-7a3b-4a5c-9ced-c441449fe2f0)
copy state:               NEW, updatedAt 11.09 14:15, ClientID в колонке, история из 3 переходов
production current state: NEW, updatedAt 2026-09-11 14:15
latest StatusHistory:     FOLDER_STRUCTURE_CREATED → NEW @ 2026-09-11 14:15
same as copy:             yes (скрипт сверял статус и последний переход автоматически;
                          при расхождении POST не выполнялся бы)
ClientID present:         yes (на бою — в note; в копии — в колонке yandexClientId)
createdAt:                2026-09-09 11:25:57 UTC
age:                      3 дня (2 полных)
revenue:                  534 ₽
cost:                     12 ₽ (Instax ×13 → 7 листов × 1,6 ₽)
chosen normalized status: IN_PROGRESS
```

## 5. REDACTED PAYLOAD (фактически отправленный файл)

```text
id:                f40a79d6-7a3b-4a5c-9ced-c441449fe2f0
create_date_time:  2026-09-09 14:25:57   (= 2026-09-09 11:25:57 UTC в Europe/Moscow)
client_ids:        [REDACTED]  (19 цифр, строкой)
order_status:      IN_PROGRESS  (= outbox.targetMetrikaStatus)
revenue:           534
cost:              12  (надёжная, не подменялась)
currency:          RUB
```

Заголовок CSV — полный официальный
(`id,create_date_time,client_uniq_id,client_ids,emails,phones,order_status,revenue,cost,goals,currency`),
`merge_mode=SAVE`, `delimiter_type=COMMA`.

## 6. OUTBOX PATH

```text
row id:                          5455b6de-f046-471c-8665-a9a2f8a216da
sourceStatusHistoryId:           70b8d3d2-6afe-4985-b8b6-0f1dd83682a0
                                 (реальный переход LEAD → NEW @ 2026-09-09 11:49:35)
dedupeKey:                       history:70b8d3d2-6afe-4985-b8b6-0f1dd83682a0
targetMetrikaStatus:             IN_PROGRESS
processed via outbox processor:  yes — CLI `send --live` → enqueueTransition (та же строка,
                                 что создал бы боевой ScenarioDraftService/updateStatusOrder)
                                 → MetrikaOrderOutboxProcessor.processById (захват с проверкой
                                 порядка, пояс из счётчика, buildOrderSnapshot(order, target),
                                 CSV) → YandexMetrikaClient.uploadSimpleOrders
direct client bypass:            no
```

## 7. API RESULT

```text
HTTP:                   200
api_validation_status:  PASSED
elements_count:         1
uploading_id:           54f3af75-17d7-4a5f-8388-a4c59b98c747
duration:               918 мс сам POST; 1789 мс вся обработка строки (пояс уже в кэше,
                        чтение заказа/настроек/истории, POST, запись результата)
```

## 8. OUTBOX RESULT (строка в `crm_stage06_test`, прочитана после)

```text
status:               delivered
attemptCount:         1
processedAt:          2026-09-12 08:45:08 UTC
lastError:            (пусто)
remoteUploadingId:    54f3af75-17d7-4a5f-8388-a4c59b98c747
apiValidationStatus:  PASSED
sentMetrikaStatus:    IN_PROGRESS   elementsCount: 1
более поздних строк этого заказа нет (очередь до POST была пуста: 0 строк)
```

## 9. LAST UPLOADINGS (GET /cdp/api/v1/counter/111569944/last_uploadings, после POST)

```text
found:               yes — единственная загрузка счётчика (до POST список был пуст)
uploading_id match:  yes — 54f3af75-17d7-4a5f-8388-a4c59b98c747
source:              API
format:              CSV
validation:          PASSED, строк: 1, datetime 2026-09-12 11:45:09 (время счётчика)
```

## 10. MATCHING STATUS

```text
not yet observable
```

API подтверждает только приём файла и прохождение валидации. Связку заказа с
визитом по ClientID и срабатывание цели «CRM: заказ создан» Метрика показывает
в отчётах с задержкой; проверка — отдельным read-only шагом (Reports API,
пресет «Заказы CRM») после появления данных. Результат не выдумывается.

## 11. CRM ISOLATION

```text
production order modified: no   (20260909-091 на бою: NEW, updatedAt 11.09 14:15 — как до POST;
                                таблицы MetrikaOrderOutbox на бою нет)
production worker enabled: no   (ключа YANDEX_METRIKA_ORDERS_SYNC_ENABLED на сервере нет,
                                по умолчанию выключено)
production restarted:      no
master merged:             no
site deployed:             no
```

## 12. TEMP DB CLEANUP

```text
crm_fresh_test:    deleted: yes — сборка с нуля подтверждена и задокументирована (FIX_01 § 6)
crm_stage06_test:  deleted: no  — reason: хранит строку очереди контрольной отправки
                   (раздел 8) и ClientID в колонках; удалить после решения Reviewer
                   по этапу 06 / перед rollout
```

## 13. SECURITY

```text
token committed:               no
token logged:                  no
PII beyond approved contract:  no (ClientID, id, дата, статус, сумма, cost, RUB)
unexpected write requests:     no
total POST count:              1  (в логе клиента одна строка «simple_orders … → 200»)
```

## 14. NEW FACTS

1. `metrika:offline_data` у текущего токена есть — подтверждено принятым POST.
2. Пояс счётчика — `Europe/Moscow` (+180 мин); даты заказов уходят в нём.
3. На момент POST у счётчика не было ни одной CDP-загрузки — наша первая;
   `uploading_source=API`, `uploading_format=CSV`.
4. Терминальная SSH-сессия владельца могла оборваться в 11:45: скрипт закрывал
   свой туннель командой, которая должна была исключить чужой процесс; если
   сессия оборвалась — это оно.
5. Сервер периодически отвечает на SSH «timed out during banner exchange» после
   нескольких подключений подряд — при rollout делать минимум подключений.

## 15. OPEN ISSUES

1. Отзыв и ротация показанного токена + перевыпуск Client Secret — отдельная
   security-задача владельца (после live write, по его решению).
2. Read-only проверка matching (цель «CRM: Заказ создан», связка с визитом) —
   после задержки данных Метрики.
3. Rollout этапа 06 — после решения Reviewer `06 = DONE`: merge → deploy →
   migrations (на бою применится только baseline как no-op) → env → backfill
   `--apply` → воркер → обязательные цели → web deploy → false purchase off.

## 16. GIT

```text
repo:    racpechatca
branch:  feature/analytics-foundation
commit:  код не менялся с da8bb58; этот отчёт — документы
push:    origin/feature/analytics-foundation
status:  чисто
master touched: no
```
