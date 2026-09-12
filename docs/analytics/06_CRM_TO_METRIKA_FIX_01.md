# 06_CRM_TO_METRIKA_FIX_01.md

# Этап 06 — FIX 01: порядок статусов outbox, migration drift и корректный live-test candidate

## Статус

```text
REVIEW — READY_FOR_LIVE_WRITE_TEST
```

Выполнено 12.09.2026 — отчёт в разделе 21. Живой POST не выполнялся.

> Фаза 1 в целом реализована качественно, но перед разрешением live write нужно закрыть три архитектурно-операционных риска:
>
> 1. worker сейчас строит `order_status` из ТЕКУЩЕГО состояния заказа и может потерять/переставить реальные переходы;
> 2. несколько outbox-событий одного заказа должны доставляться строго по порядку;
> 3. в production DB есть три применённые Prisma migration, файлов которых нет в репозитории.
>
> Дополнительно кандидат для первого live write должен попадать в окно первичного CRM→visit matching Яндекс Метрики.

---

# 1. Главный дефект: нельзя заменять intended status текущим состоянием заказа

В отчёте фазы 1 указано:

```text
Отправляется текущее состояние заказа в момент обработки.
```

Так делать нельзя.

Пример:

```text
LEAD → NEW
→ outbox #1 intended = IN_PROGRESS

через 5 секунд:

NEW → PAID
→ outbox #2 intended = PAID
```

Если worker ещё не успел обработать #1, а payload строится по текущему `OrderPhoto.status`, получится:

```text
#1 → PAID
#2 → PAID
```

Реальный переход:

```text
IN_PROGRESS
```

потерян.

Ещё опаснее:

```text
NEW → PAID → CANCELLED
```

При задержке worker все три строки могут превратиться в:

```text
CANCELLED
CANCELLED
CANCELLED
```

Это ломает смысл CRM goals и историю бизнеса.

---

# 2. Решение: outbox обязан хранить intended normalized status

Для каждого status transition при enqueue сохранить:

```text
sourceStatusHistoryId
targetMetrikaStatus
```

где:

```text
LEAD → NEW        → IN_PROGRESS
... → PAID        → PAID
... → CANCELLED   → CANCELLED
CANCELLED → NEW   → IN_PROGRESS
```

Worker должен отправлять:

```text
outbox.targetMetrikaStatus
```

а НЕ повторно вычислять статус из:

```text
OrderPhoto.status
```

в момент доставки.

---

# 3. Что разрешено читать из актуального OrderPhoto

При обработке outbox разрешено брать актуальные canonical поля:

```text
OrderPhoto.id
yandexClientId
createdAt
revenue snapshot source
cost snapshot source
currency
```

Но смысл конкретного business transition берётся только из outbox:

```text
targetMetrikaStatus
```

---

# 4. Порядок событий одного заказа — обязательный

Нельзя допустить:

```text
PAID доставился
↓
старый IN_PROGRESS retry сработал позже
↓
заказ в Метрике откатился обратно в IN_PROGRESS
```

Поэтому outbox должен обеспечивать:

```text
per-order ordering
```

Для одного `orderId` нельзя обрабатывать более позднюю transition-row, пока более ранняя unresolved row не завершена.

---

# 5. Целевая очередь

Для каждого заказа:

```text
row 1 IN_PROGRESS
row 2 PAID
row 3 CANCELLED
```

Worker видит только:

```text
самую раннюю unresolved row этого orderId
```

Следующая становится eligible только после того, как предыдущая получила terminal state:

```text
PROCESSED
SKIPPED
```

Для `FAILED` принять безопасную модель:

```text
FAILED_BLOCKING
```

То есть более поздние события этого заказа НЕ идут наружу, пока оператор:

```text
requeue
или
explicit skip/resolve
```

не закроет раннюю проблему.

---

# 6. Многопроцессная безопасность

Решение должно работать не только при одном worker.

Проверить сценарий:

```text
worker A
worker B
```

Оба не должны одновременно забрать разные transitions одного `orderId`.

Допустимые реализации:

- SQL selection только earliest unresolved row per order;
- advisory lock per `orderId`;
- отдельный order-level lock;
- другой эквивалентный transactional механизм.

Использовать PostgreSQL и conventions проекта.

---

# 7. Обязательные race tests

Добавить тесты.

## A. NEW → PAID до первого worker tick

Ожидаемые remote statuses:

```text
IN_PROGRESS
PAID
```

ровно в таком порядке.

---

## B. NEW → CANCELLED до worker tick

Ожидается:

```text
IN_PROGRESS
CANCELLED
```

---

## C. NEW → PAID → CANCELLED

Ожидается:

```text
IN_PROGRESS
PAID
CANCELLED
```

---

## D. CANCELLED → NEW reopen

Ожидается новый transition:

```text
IN_PROGRESS
```

на том же:

```text
OrderPhoto.id
```

---

## E. Первый transition временно падает

```text
IN_PROGRESS → 503
PAID row уже существует
```

Ожидается:

```text
PAID НЕ отправляется
```

пока IN_PROGRESS не доставлен.

После retry success:

```text
IN_PROGRESS
↓
PAID
```

---

## F. Первый transition permanent-failed

```text
IN_PROGRESS → validation FAILED
```

Ожидается:

```text
PAID = blocked behind failed row
```

до explicit operator action.

---

## G. Два worker одновременно

Не должно быть:

```text
same order
→ two statuses in flight concurrently
```

---

# 8. Idempotency сохраняется

Оставить:

```text
dedupe = history:<StatusHistory.id>
```

если он действительно обеспечивает 1 outbox row на 1 фактический transition.

Remote:

```text
id = OrderPhoto.id
merge_mode = SAVE
```

оставить.

---

# 9. Prisma migration drift — исправить до production rollout

Новый факт:

В production DB есть применённые migrations:

```text
…add_yandex_request_id
…add_delivery_info
…add_gulian_transactional_outbox
```

но соответствующих migration directories/files нет в текущем repository history.

Это нельзя оставлять как известный drift перед дальнейшим расширением схемы.

---

# 10. Задача по migration history

Исполнитель должен:

1. получить точные migration names из `_prisma_migrations`;
2. определить, в каком коммите/ветке файлы существовали;
3. восстановить ОРИГИНАЛЬНЫЕ migration files из Git history, если возможно;
4. не генерировать "примерно похожий SQL", если оригинал можно восстановить;
5. если оригинал недоступен — реконструировать только после сравнения production schema + Git history и явно отметить это;
6. проверить checksum implications;
7. не редактировать production `_prisma_migrations` вручную;
8. не выполнять `migrate resolve` без отдельной необходимости и объяснения.

Цель:

```text
repo migration history
≈
production applied migration history
```

так, чтобы новый environment можно было воспроизвести из repository.

---

# 11. Проверка fresh-schema

После восстановления migration files:

создать пустую PostgreSQL schema/database и выполнить:

```text
prisma migrate deploy
```

с нуля.

Проверить, что итоговая схема содержит как минимум:

- yandex request id изменения;
- delivery info;
- Gulian outbox;
- analytics attribution migrations;
- firstTouchUrl;
- MetrikaOrderOutbox.

То есть не только:

```text
production-copy accepts migrate deploy
```

но и:

```text
fresh DB can be fully built from repository migrations
```

---

# 12. Candidate для live write: старый заказ 20260815-050 НЕ использовать первым

Текущий кандидат:

```text
20260815-050
created: 2026-08-15
```

На дату этапа:

```text
2026-09-11
```

ему уже больше 21 дня.

Для первичной передачи CRM order Яндекс Метрика сопоставляет новый заказ с визитом в 21-дневном окне.

Поэтому этот заказ может проверить HTTP/CSV upload, но НЕ является хорошим end-to-end тестом реальной привязки к визиту.

---

# 13. Новый candidate rule

Перед фазой live write найти заказ:

```text
createdAt не старше 21 дней
yandexClientId != null
eligible accepted order
revenue корректен
cost корректен или документированно отсутствует
```

Приоритет:

```text
1. recent PAID order
2. если recent PAID нет — recent IN_PROGRESS/NEW accepted order
```

В отчёте вернуть кандидата:

```text
order number/id
createdAt
current normalized status
age in days
ClientID present: yes
```

Сам ClientID не показывать.

---

# 14. Если recent PAID отсутствует

Не искажать CRM status ради теста.

Допустимо первое live write выполнить для реального:

```text
IN_PROGRESS
```

заказа.

Это докажет:

```text
CRM Order created
```

и matching pipeline.

`PAID` затем должен пройти либо на естественном переходе этого/другого recent order, либо отдельным approved live test на реально PAID заказе.

---

# 15. Counter timezone

До live write обязательно получить реальное:

```text
time_zone_name
time_zone_offset
```

из counter metadata.

В payload preview показать:

```text
DB createdAt
→ counter-local create_date_time
```

без предположения timezone.

---

# 16. Financial terminology

Текущую финансовую реализацию можно оставить, если parity действительно доказан.

Но зафиксировать семантику:

```text
Yandex revenue = total contractual order value
Yandex cost = canonical CRM COGS
Yandex revenue - cost = gross contribution / gross profit metric
```

Не называть:

```text
Yandex revenue - cost
```

"чистой прибылью CRM".

CRM net/business profit позже должен считаться из собственной P&L логики с учётом дополнительных расходов, зарплаты, доставки и иных категорий, которые не входят в canonical COGS.

Эту пометку передать в:

```text
07_METRIKA_TO_ANALYTICS
08_ANALYTICS_METRICS
09_DASHBOARD_V1
```

---

# 17. Live write пока запрещён

До review этого FIX:

```text
НЕ выполнять POST simple_orders
```

Даже если владелец ранее говорил, что хочет продолжать.

Сначала вернуть:

```text
EXECUTOR_REPORT_FIX_01
```

---

# 18. Security preconditions остаются

До live write всё ещё обязательны:

```text
old exposed token revoked
new token issued
new token stored securely
Client Secret rotated
```

Не показывать значения секретов.

---

# 19. Формат отчёта

## EXECUTOR_REPORT_FIX_01

### 1. RESULT

```text
READY_FOR_LIVE_WRITE_TEST
PARTIAL
BLOCKED
```

### 2. OUTBOX STATUS SOURCE

```text
before:
after:
targetMetrikaStatus stored:
worker uses:
```

### 3. PER-ORDER ORDERING

```text
mechanism:
earliest unresolved definition:
multi-worker protection:
failed-blocking behavior:
manual resolution:
```

### 4. RACE TESTS

Таблица:

```text
Scenario | Expected statuses | Actual | PASS/FAIL
```

Для A–G из этого MD.

### 5. MIGRATION DRIFT

```text
missing migration names:
original files recovered: yes/no
source commits:
checksums preserved:
manual _prisma_migrations edits: no
```

### 6. FRESH DATABASE TEST

```text
database:
prisma migrate deploy:
all migrations:
schema validation:
```

### 7. LIVE CANDIDATE

```text
order:
createdAt:
age:
normalized status:
ClientID present:
revenue:
cost:
within 21 days:
```

Без ClientID.

### 8. COUNTER TIMEZONE

Если новый token уже установлен:

```text
time_zone_name:
time_zone_offset:
source:
```

Если token ещё нет:

```text
LIVE_TOKEN_REQUIRED_BEFORE_WRITE
```

### 9. FINANCIAL SEMANTICS

Подтвердить:

```text
Yandex revenue:
Yandex cost:
revenue-cost label:
CRM net profit remains:
```

### 10. TESTS

```text
Command | Result
```

### 11. SECURITY

```text
old token revoked:
new token secure:
client secret rotated:
write requests executed: no
```

### 12. GIT

```text
repo:
branch:
commit:
push:
status:
master touched:
```

### 13. NEW FACTS

Если нет:

```text
none
```

### 14. OPEN ISSUES

Только реально оставшиеся блокеры.

---

# 20. Decision Gate

После FIX можно разрешить live write, если:

- outbox отправляет intended transition status;
- статусы одного orderId идут строго по порядку;
- retry старого события не может откатить новый remote status;
- multiple workers не нарушают порядок;
- migration history восстановлена;
- fresh DB строится полностью из migrations;
- выбран recent candidate ≤ 21 дней;
- counter timezone будет получен до POST;
- live write ещё не выполнялся;
- secrets готовы или единственный оставшийся блокер явно отмечен.

Тогда:

```text
06_CRM_TO_METRIKA = READY_FOR_LIVE_WRITE_TEST
```

И только после отдельной команды владельца:

```text
разрешаю live write
```

выполняется один реальный POST.

---

# 21. EXECUTOR_REPORT_FIX_01 — 12.09.2026

## 1. RESULT

```text
READY_FOR_LIVE_WRITE_TEST
```

Все три риска закрыты кодом и тестами; история миграций восстановлена,
пустая база собирается из репозитория. Живой POST не выполнялся. Production
не тронут. Единственный оставшийся блокер — секреты (раздел 11).

## 2. OUTBOX STATUS SOURCE

```text
before:                      воркер брал OrderPhoto.status в момент отправки
                             и нормализовал его; строка хранила target только справочно
after:                       воркер отправляет targetMetrikaStatus строки; из
                             актуального OrderPhoto берутся только id, yandexClientId,
                             createdAt, totalOrder и позиции для себестоимости
targetMetrikaStatus stored:  да — при enqueue вместе с sourceStatusHistoryId
                             (LEAD→NEW → IN_PROGRESS, →PAID → PAID, →CANCELLED → CANCELLED,
                             CANCELLED→NEW → IN_PROGRESS)
worker uses:                 row.targetMetrikaStatus (buildOrderSnapshot(order, target, …));
                             право на CANCELLED решается историей ДО этого перехода
                             (StatusHistory.createdAt ≤ createdAt перехода-источника)
```

## 3. PER-ORDER ORDERING

```text
mechanism:                    SQL выборки воркера: строка берётся, только если у того же
                              orderId нет более ранней строки (createdAt, id) со статусом
                              pending/processing/failed:
                                WHERE o.status='pending' AND o.nextAttemptAt<=now()
                                  AND NOT EXISTS (SELECT 1 FROM MetrikaOrderOutbox e
                                    WHERE e.orderId=o.orderId
                                      AND e.status IN ('pending','processing','failed')
                                      AND (e.createdAt,e.id)<(o.createdAt,o.id))
                                ORDER BY nextAttemptAt, createdAt, id LIMIT 10
                                FOR UPDATE OF o SKIP LOCKED
earliest unresolved definition: минимальная (createdAt, id) среди строк заказа со статусом
                              pending | processing | failed; закрывают строку только
                              delivered и skipped (UNRESOLVED_STATUSES в outbox.service)
multi-worker protection:      pending считается незакрытой, поэтому поздняя строка не
                              проходит NOT EXISTS даже в момент, когда другой воркер ещё
                              не зафиксировал захват ранней; сама ранняя под FOR UPDATE —
                              второй воркер её пропускает по SKIP LOCKED. Захват атомарен
                              (UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)).
                              Зависший processing (>10 мин, воркер упал) возвращается
                              в pending перед каждым захватом.
failed-blocking behavior:     failed входит в незакрытые → все более поздние переходы
                              заказа не идут наружу; processById (CLI) тоже подчиняется
                              порядку и возвращает null с перечнем блокирующих строк
manual resolution:            npm run metrika:orders -- requeue --order <id> (failed → pending)
                              npm run metrika:orders -- skip --row <id>   (failed/pending → skipped/manual)
```

Повтор старого события физически не может откатить новый статус: новый не
отправляется, пока старый не закрыт, а закрытый повторно не берётся.

## 4. RACE TESTS

Unit (jest, in-memory модель той же выборки) и e2e на настоящем PostgreSQL
(копия боевой базы, фиктивный клиент Метрики, без сети):

```text
Scenario                                   | Expected statuses            | Actual (unit)                | Actual (e2e Postgres)        | PASS/FAIL
-------------------------------------------+------------------------------+------------------------------+------------------------------+----------
A. LEAD→NEW, NEW→PAID до первого тика      | IN_PROGRESS, PAID            | IN_PROGRESS, PAID (2 тика)   | —  (покрыто C)               | PASS
B. NEW→CANCELLED до тика                   | IN_PROGRESS, CANCELLED       | IN_PROGRESS, CANCELLED       | —                            | PASS
C. NEW→PAID→CANCELLED                      | IN_PROGRESS, PAID, CANCELLED | IN_PROGRESS, PAID, CANCELLED | IN_PROGRESS → PAID → CANCELLED (3 тика, 4-й пуст) | PASS
D. CANCELLED→NEW reopen                    | IN_PROGRESS на том же id     | IN_PROGRESS, id order-1      | —                            | PASS
E. первый переход 503, PAID уже в очереди  | PAID не уходит; после повтора IN_PROGRESS, PAID | тик1 retry, тик2 пусто, затем IN_PROGRESS, PAID | тик1 retry, тик2 «PAID blocked», после паузы IN_PROGRESS → PAID | PASS
F. первый переход failed навсегда          | PAID заблокирован до оператора | failed/pending; processById→null; после requeue — по порядку; после skip — PAID | 400 → failed/pending; processById→null; blockingRows=[IN_PROGRESS/failed]; markSkipped → PAID delivered | PASS
G. два воркера одновременно                | ≤1 статус одного заказа в полёте | maxInFlight по заказу 1; o1: IN_PROGRESS, PAID | два процессора, 2 заказа × 2 перехода: o1 IN_PROGRESS→PAID, o2 IN_PROGRESS→PAID, max in flight per order = 1 | PASS
+ старый повтор не откатывает новый        | поздняя не уходит, пока ранняя не закрыта | processOnce → []            | —                            | PASS
+ зависший processing                      | возвращается и уходит        | releaseStaleLocks вызван     | «возвращено 1» → delivered   | PASS
+ история ДО перехода                      | LEAD→CANCELLED skip, CANCELLED→NEW → IN_PROGRESS | skipped/rejected_lead, затем IN_PROGRESS | —              | PASS
```

## 5. MIGRATION DRIFT

```text
missing migration names:      20260531222621_add_yandex_request_id
                              20260531224724_add_delivery_info
                              20260728190000_add_gulian_transactional_outbox
original files recovered:     20260728190000 — ДА, из Git: коммит f106dca, ветка
                              wip/gulian-integration-prod-2026-07-29T18-20-41
                              («автосохранение работы с прода»); sha256 файла
                              e81cc9db… = checksum в _prisma_migrations боя.
                              20260531222621 и 20260531224724 — НЕТ: ни в одном коммите
                              и ни в одной ветке (git log --all -S по именам и полям);
                              в текущей боевой схеме их объектов нет (более поздний
                              `db push` их удалил). Созданы каталоги с migration.sql,
                              состоящим только из комментария-объяснения: SQL не
                              выдуман, история совпадает с боем по именам.
source commits:               f106dca (wip/gulian-integration-prod-2026-07-29T18-20-41)
checksums preserved:          НЕТ, осознанно, для всех трёх:
                              - 20260728190000: у всех ADD COLUMN добавлено IF NOT EXISTS —
                                иначе пустая база падает: на бою эта миграция шла ПЕРВОЙ
                                (28.07 17:19), а 20260728150000_add_gulian_fields с теми же
                                колонками — после (29.07 18:33); по именам порядок обратный.
                              - две от 31.05: содержимого нет.
                              Проверено эмпирически на копии боя: `migrate status` —
                              «Database schema is up to date!», `migrate deploy` —
                              «No pending migrations»; несовпадение контрольных сумм
                              применённых миграций Prisma 7 не считает ошибкой.
manual _prisma_migrations edits: no
migrate resolve:              не выполнялся
```

**Дополнительно найдено и исправлено (не было в FIX_01):** пустую базу нельзя
было собрать даже без этих трёх миграций — уже вторая миграция
`20260613000000_salary_architecture` падала на `relation "User" does not
exist`. До 13.06.2026 схема боя менялась `prisma db push` без миграций:
таблицы `User`, `ItemTshirt`, перечисления `EnumRole`, `EnumProductCategory`,
`EnumTshirtSize`, `EnumTshirtGender`, `EnumPrintLocation`, `EnumPrintType`,
значения `EnumStatus.LEAD`/`DONE`, колонки `OrderPhoto.productCategory/
deadline/isUrgent` не создаёт ни одна миграция. Добавлена
`20260601000000_baseline_db_push_era` — восстановлена по боевой схеме
(pg_dump копии), только в том виде, в каком объекты существовали до
последующих миграций, полностью идемпотентна (IF NOT EXISTS / DO-блоки):
на бою — no-op, на пустой базе — недостающий фундамент. Место в порядке —
между первой миграцией и salary_architecture.

## 6. FRESH DATABASE TEST

```text
database:              crm_fresh_test — пустая база на сервере (PostgreSQL контейнера),
                       через SSH-туннель; создана DROP/CREATE DATABASE
prisma migrate deploy: «All migrations have been successfully applied» — 75 миграций
                       с нуля, включая baseline, три восстановленных имени,
                       attribution/firstTouchUrl, MetrikaOrderOutbox
all migrations:        75 = 68 общих с боем + 3 восстановленных имени + baseline
                       + 3 этапа аналитики (02, 04, 06); `migrate status` — up to date
schema validation:     `migrate diff` пустая база → боевая копия: единственное
                       расхождение — тип gulianLastAttemptAt/gulianLastSyncedAt
                       (на бою TIMESTAMP(3): их создала WIP-миграция первой; на пустой
                       базе TIMESTAMPTZ(3): их создала 150000). Всё остальное совпадает,
                       включая «хвост» WIP (GulianOutboxEvent, IntegrationAuditLog,
                       два enum, 4 колонки).
                       `migrate diff` (пустая база и копия боя одинаково) → schema.prisma:
                       унаследованный дрейф master, не связанный с этапом: TIMESTAMPTZ
                       в GulianOutbox/ExpenseOrder/executorSentAt против DateTime
                       в схеме; DEFAULT now() у updatedAt в ExpenseOrder/SalaryAccrual/
                       SalaryPayment; SalaryAccrual_orderId_fkey ON DELETE SET NULL против
                       схемы; индекс GulianOutbox_status_next_idx против
                       …_status_nextAttemptAt_idx; лишние индексы sentAt и
                       clientGreetedAt; объекты WIP. Ничего из этого миграции не ломает
                       (Prisma 7 при deploy схему с базой не сверяет); фиксируется как факт.
Rollout на бою:        смоделирован на копии: `migrate deploy` применяет ОДНУ миграцию —
                       baseline — как no-op (schema diff копии до и после идентичен);
                       `migrate status` после — «up to date», предупреждения «migrations
                       from the database are not found locally» больше нет.
```

Обязательный минимум § 11 в пустой базе: Gulian outbox — есть (GulianOutbox
из 160000 и GulianOutboxEvent из WIP); attribution — есть; firstTouchUrl —
есть; MetrikaOrderOutbox — есть; yandex request id / delivery info —
объектов не существует и на бою (см. раздел 5).

## 7. LIVE CANDIDATE

Recent PAID с ClientID нет (единственный PAID — 20260815-050, 28 дней,
вне окна). По § 14 — реальный IN_PROGRESS:

```text
order:              20260909-091  (id f40a79d6-7a3b-4a5c-9ced-c441449fe2f0)
createdAt:          2026-09-09 11:25:57 UTC
age:                3 дня (на 12.09.2026)
normalized status:  IN_PROGRESS  (CRM: NEW; история LEAD→NEW→FOLDER_STRUCTURE_CREATED→NEW)
ClientID present:   yes (19 цифр)
revenue:            534 ₽ (totalOrder)
cost:               12 ₽ (бумага, надёжна)
within 21 days:     yes
```

Запасной: 20260908-082 (фото, SENT → IN_PROGRESS, 4 дня, ClientID есть,
400 ₽). PAID пройдёт естественным переходом одного из recent-заказов после
включения воркера либо отдельным одобренным тестом.

## 8. COUNTER TIMEZONE

```text
LIVE_TOKEN_REQUIRED_BEFORE_WRITE
```

Токена на сервере нет; пояс не читался и не предполагался. Preview без токена
печатает `create_date_time: LIVE_TOKEN_REQUIRED_BEFORE_WRITE`; с токеном —
`DB createdAt UTC → counter-local (time_zone_name)`; `status` печатает
`time_zone_name` и `time_zone_offset` из счётчика. Воркер без пояса не шлёт.

## 9. FINANCIAL SEMANTICS

```text
Yandex revenue:          total contractual order value = OrderPhoto.totalOrder
                         (позиции + доставка + дизайн + срочность — что платит клиент)
Yandex cost:             canonical CRM COGS = orderCostOfGoods (order-cogs.ts): бумага /
                         вознаграждение партнёру / подрядчик холстов; без зарплаты,
                         доставки перевозчику и операционных расходов
revenue-cost label:      валовая прибыль (gross contribution) — в коде, в 00_MASTER_PLAN
                         (пометки к 07, 08, 09) и в 01_CURRENT_STATE
CRM net profit remains:  только из P&L reports.service.ts (finalize().netProfit):
                         минус зарплата начисленная, доставка перевозчику,
                         операционные расходы; в Метрику не передаётся
```

Паритет revenue/cost с отчётом — order-cogs.spec.ts (без изменений).

## 10. TESTS

```text
Command                                              | Result
-----------------------------------------------------+----------------------------------------------
npx jest src/metrika/orders                          | 87 passed (в т.ч. A–G, история до перехода,
                                                     | stale lock, markSkipped/blockingRows)
npx jest                                             | 70 suites, 745 passed
npm run build                                        | OK
npx prisma validate                                  | OK
Пустая база crm_fresh_test: migrate deploy           | 75 миграций, all applied; status up to date
Копия боя crm_stage06_test: migrate deploy           | применена только baseline (no-op); status up to date
migrate diff fresh → копия боя                       | только TIMESTAMPTZ vs TIMESTAMP у 2 gulian-колонок
e2e на копии (Postgres, фиктивный клиент, без сети)  | A/C, E, F, stale lock, G — все ожидания выполнены
metrika:orders preview --order 20260909-091          | IN_PROGRESS, 534/12, LIVE_TOKEN_REQUIRED_BEFORE_WRITE
```

## 11. SECURITY

```text
old token revoked:        unknown  (действие владельца; в чат не сообщалось)
new token secure:         no — ключей YANDEX_METRIKA_* на сервере нет (проверено 11.09)
client secret rotated:    unknown
write requests executed:  no
```

## 12. GIT

```text
repo:            racpechatca
branch:          feature/analytics-foundation
commit:          abab3b2 (код + миграции), далее — документы этого отчёта
push:            origin/feature/analytics-foundation
status:          чисто
master touched:  no
```

## 13. NEW FACTS

1. **История миграций репозитория никогда не собирала пустую базу**: до
   13.06.2026 схема жила через `db push`. Исправлено baseline-миграцией; при
   любом новом окружении (staging, CI) теперь достаточно `migrate deploy`.
2. `20260728190000_add_gulian_transactional_outbox` — боевая миграция из
   WIP-ветки, оставившая на бою неиспользуемые `GulianOutboxEvent`,
   `IntegrationAuditLog`, два enum и 4 колонки `OrderPhoto`. Убирать —
   отдельным решением владельца (drop таблиц на бою).
3. На бою есть унаследованный дрейф схемы против `schema.prisma` (раздел 6):
   безвреден для работы и миграций, но `migrate dev` на боевой базе никогда
   не запускать — он предложит «выровнять» и снести WIP-объекты.
4. Prisma 7 при `migrate deploy`/`status` не проверяет контрольные суммы уже
   применённых миграций — изменённый файл применённой миграции проходит молча.
5. Все заказы с ClientID (11) — фото; recent PAID с ClientID нет, поэтому
   первый live write — IN_PROGRESS.

## 14. OPEN ISSUES

1. Секреты: отозвать показанный токен, выпустить новый (`metrika:read` +
   `metrika:offline_data`), положить в `/opt/raspechatka/.env`; перевыпустить
   Client Secret — владелец. Единственный блокер live write.
2. Команда владельца «разрешаю live write» → один POST по 20260909-091 из
   копии `crm_stage06_test` (там уже есть таблица очереди и ClientID); бой
   не тронут. Копия `crm_fresh_test` и `crm_stage06_test` остаются на
   сервере до фазы 2, затем удалить.
