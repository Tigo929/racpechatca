# 06_PRODUCTION_ROLLOUT.md

# Этап 06 — Production rollout CRM → Яндекс Метрика

## Статус

```text
IN_PROGRESS — PHASE B–H выполнены 12.09.2026; I (цели, владелец), J (web, по подтверждению), K, L — впереди
```

Отчёт по PHASE B–H — раздел 33.

> Основной этап `06_CRM_TO_METRIKA` принят как DONE:
>
> - controlled live write прошёл;
> - HTTP 200;
> - `api_validation_status=PASSED`;
> - `elements_count=1`;
> - outbox = delivered;
> - `last_uploadings` подтвердил тот же upload.
>
> Этот документ — обязательный production rollout перед началом этапа 07.
> Исполнитель не ставит rollout в DONE самостоятельно.

---

# 1. Что уже доказано

Live test 12.09.2026:

```text
counter: 111569944
timezone: Europe/Moscow (+03:00)

candidate:
20260909-091

normalized CRM status:
IN_PROGRESS

API:
HTTP 200
api_validation_status = PASSED
elements_count = 1
uploading_id = 54f3af75-17d7-4a5f-8388-a4c59b98c747

outbox:
delivered
attemptCount = 1

last_uploadings:
тот же uploading_id
PASSED
```

Production CRM/order/site при test write не менялись.

---

# 2. Цель rollout

Перевести систему из:

```text
feature implementation + controlled test
```

в:

```text
production CRM
→ structured attribution
→ transactional outbox
→ Yandex Metrika simple_orders
```

и затем синхронно заменить ложную browser-семантику:

```text
lead = ecommerce.purchase
```

на:

```text
lead = lead_submitted
real order/payment = CRM → Metrika
```

---

# 3. Важные текущие факты production

На production сейчас:

```text
структурированные поля этапов 02/04 ещё не развернуты
yandexClientId исторически находится в note
analytics backfill --apply ещё не выполнялся
MetrikaOrderOutbox таблицы на production ещё нет
production worker выключен / отсутствует
browser ecommerce.purchase при заявке ещё работает
web analytics event-model branch ещё не выложена
```

Поэтому порядок rollout менять без причины нельзя.

---

# 4. Security decision

Владелец проекта принял решение:

```text
текущий рабочий OAuth token можно использовать для rollout
```

Ротация ранее раскрытого token и Client Secret:

```text
SECURITY DEBT
```

а не blocking condition текущего rollout.

Исполнитель:

- не выводит token;
- не коммитит token;
- не логирует Authorization;
- не переносит token из `.env` в код.

После rollout оставить отдельное напоминание:

```text
ROTATE_YANDEX_OAUTH_TOKEN
ROTATE_YANDEX_CLIENT_SECRET
```

---

# 5. PHASE A — pre-deploy checks

Перед merge проверить:

```text
racpechatca feature/analytics-foundation clean
web-photo feature/analytics-event-model clean
оба branch актуальны относительно deploy branches
```

Проверить:

```text
CRM tests
CRM build
Prisma validate
web tests
web tsc/build
```

Не переходить к production при красных тестах.

---

# 6. PHASE B — CRM merge

Цель:

```text
feature/analytics-foundation
→ master
```

Перед merge:

1. fetch;
2. проверить текущий `master`;
3. убедиться, что новые production-коммиты уже учтены;
4. разрешить конфликты только осознанно;
5. не переписывать историю production.

После merge:

```text
push master
```

учитывая, что push в `master` запускает production CRM rebuild/restart.

---

# 7. PHASE C — Prisma production migration

Production применяет только:

```text
prisma migrate deploy
```

СТРОГО запрещено:

```text
prisma migrate dev
```

против production DB.

После deploy проверить:

```text
OrderPhoto.yandexClientId
OrderPhoto.yclid
OrderPhoto.utmSource
OrderPhoto.utmMedium
OrderPhoto.utmCampaign
OrderPhoto.utmContent
OrderPhoto.utmTerm
OrderPhoto.conversionPageUrl
OrderPhoto.firstTouchUrl
OrderPhoto.clientPaidAt

MetrikaOrderOutbox
```

и необходимые индексы.

---

# 8. Migration drift safety

Production исторически пережил `db push`, а часть старых migration names была восстановлена/baselined.

После production deploy проверить:

```text
prisma migrate status
```

Ожидается:

```text
Database schema is up to date
```

Не выполнять:

```text
migrate resolve
manual UPDATE _prisma_migrations
manual schema cleanup
```

в этом rollout.

Не удалять старые WIP Gulian objects.

---

# 9. PHASE D — analytics backfill dry-run

Сначала:

```text
npm run analytics:backfill
```

без `--apply`.

Ожидаемый порядок величин по последнему проверенному production snapshot:

```text
yandexClientId ≈ 11
yclid ≈ 10
conversionPageUrl ≈ 16
clientPaidAt ≈ 204
UTM historical ≈ 0
orders changed ≈ 219
```

Точные числа могут измениться из-за новых заказов.

Исполнитель должен объяснить существенное отклонение до apply.

---

# 10. PHASE E — analytics backfill apply

Только после нормального dry-run:

```text
npm run analytics:backfill -- --apply
```

После apply обязательно:

```text
npm run analytics:backfill
```

Ожидается:

```text
orders to change = 0
```

или только чётко объяснимые новые concurrent rows.

Проверить:

- исходный `note` не удалён;
- `designNote` не изменён;
- `StatusHistory` не переписан;
- existing structured values не перезаписаны.

---

# 11. PHASE F — OAuth/API health

Из production environment выполнить безопасный read-only smoke:

```text
counter 111569944
Reports API
```

Проверить:

```text
HTTP 200
counter timezone = Europe/Moscow
```

Token не печатать.

---

# 12. PHASE G — worker initially OFF

После deploy переменная:

```text
YANDEX_METRIKA_ORDERS_SYNC_ENABLED=false
```

или эквивалент должна оставаться выключенной.

Причина:

сначала проверяем DB/migrations/backfill и очередь.

---

# 13. Проверка production enqueue

С worker OFF выполнить только естественный business flow или безопасно дождаться нового реального transition.

Проверить:

```text
LEAD → NEW
```

создаёт:

```text
MetrikaOrderOutbox
targetMetrikaStatus=IN_PROGRESS
```

и API пока не вызывается.

Не менять status искусственно ради теста.

Если естественного transition быстро нет — допускается проверить существующие enqueue unit/integration guarantees и перейти дальше без ручной мутации production заказа.

---

# 14. PHASE H — включение worker

После проверок установить:

```text
YANDEX_METRIKA_ORDERS_SYNC_ENABLED=true
```

способом, соответствующим production env.

Выполнить необходимый штатный restart/redeploy backend, если env читается только на boot.

Зафиксировать:

```text
restart time
backend health
worker started
```

---

# 15. Первый production worker check

После включения worker проверить:

```text
pending
processed
failed
retrying
skipped_no_client_id
last_success_at
last_failure_at
```

Не должно быть массового неожиданного historical enqueue.

Если очередь неожиданно огромная:

```text
worker OFF
```

и investigation до продолжения.

---

# 16. Не делать historical CRM order mass sync

Этап 06 rollout НЕ должен создавать outbox для всех старых заказов.

Только:

```text
новые status transitions после production rollout
```

и явно уже существующие строки, если они были созданы production-кодом после deploy.

Historical mass CRM→Metrika — отдельная задача.

---

# 17. PHASE I — обязательные goals

Перед web rollout создать вручную в интерфейсе Метрики четыре JavaScript-event goals:

```text
lead_submitted_photo
lead_submitted_canvas
lead_submitted_tshirt
form_error
```

Тип:

```text
JavaScript event
```

Identifier должен точно совпадать с event name.

Не использовать:

```text
metrika:write
```

ради этого rollout.

После создания сделать read-only API reconciliation.

Ожидается:

```text
эти 4 = CONFIGURED
unknown = 0
```

---

# 18. Старую URL-цель не удалять

Цель:

```text
"Заявка отправлена" → /thanks
```

сейчас исторически существует.

Она не является нашим canonical lead KPI.

Не удалять в этом rollout, чтобы не ломать историю.

Зафиксировать:

```text
canonical lead goal = lead_submitted
legacy URL goal = historical/secondary
```

---

# 19. PHASE J — web merge

Только после:

```text
CRM production healthy
migrations OK
backfill OK
worker active
CRM simple_orders реально работает
4 обязательные goals созданы
```

выполнить:

```text
web-photo feature/analytics-event-model
→ feature/cms-admin
```

Учитывать:

```text
push feature/cms-admin = production site deploy
```

Перед merge подтянуть все UX/content изменения, появившиеся после ответвления analytics branch.

Не затирать более новые изменения сайта.

---

# 20. Что web rollout изменяет

После deploy:

```text
lead_submitted работает на всех 5 формах
photo/canvas/tshirt directional goals отправляются
firstTouchUrl собирается
yclid TTL = 21 days
PII исключён из analytics params
analytics exceptions не ломают business flow
```

И главное:

```text
false ecommerce.purchase при lead submission
→ прекращается
```

---

# 21. False purchase cutover marker

Зафиксировать точное production время:

```text
FALSE_BROWSER_PURCHASE_STOPPED_AT
```

Это важно для аналитики.

Данные ecommerce purchase:

```text
до этой даты/времени
```

нельзя смешивать с будущими реальными CRM order/payment semantics без специальной пометки.

---

# 22. Двойной учёт

Controlled test order этапа 06 уже был отправлен в Метрику:

```text
f40a79d6-7a3b-4a5c-9ced-c441449fe2f0
IN_PROGRESS
```

Он не был browser purchase replacement в production и является отдельной контрольной записью.

В rollout report явно отметить его как:

```text
CONTROLLED_STAGE06_TEST
```

чтобы позже не принять за обычный production-generated outbox event.

---

# 23. PHASE K — post-web smoke

После production web deploy проверить без создания фальшивых заказов:

```text
страница загружается
Metrika загружается после consent
forms работают
analytics unavailable не ломает формы
```

При следующей естественной заявке проверить:

```text
lead_submitted
directional event
CRM lead
ClientID persisted
firstTouchUrl
conversionPageUrl
UTM/yclid при наличии
```

---

# 24. PHASE L — first natural order lifecycle

На первом естественном:

```text
LEAD → NEW
```

проверить:

```text
outbox IN_PROGRESS
→ delivered
→ PASSED
```

На первом естественном:

```text
→ PAID
```

проверить:

```text
outbox PAID
→ delivered
→ PASSED
```

На первом естественном:

```text
→ CANCELLED
```

если он возникнет, проверить то же.

Не создавать фиктивную оплату/отмену.

---

# 25. Matching verification

После доступной задержки Метрики выполнить read-only проверку:

```text
CRM: Order created
CRM: Order paid
```

и связку с визитом там, где она наблюдаема.

Если matching ещё не виден:

```text
не считать rollout failed
```

при условии, что upload PASSED.

Записать lag и проверить позднее.

---

# 26. Rollback — CRM worker

Если worker вызывает проблемы:

```text
YANDEX_METRIKA_ORDERS_SYNC_ENABLED=false
```

и штатный restart/redeploy.

Outbox rows НЕ удалять.

После fix:

```text
requeue
```

---

# 27. Rollback — web

Если production web event-model ломает формы/UX:

вернуть предыдущий deploy commit `feature/cms-admin`.

Но учитывать:

```text
browser false purchase
```

тогда временно вернётся.

Зафиксировать rollback time, чтобы данные можно было правильно трактовать.

---

# 28. Не откатывать database migrations без крайней необходимости

Nullable attribution fields и outbox schema не требуют destructive rollback.

При проблемах:

```text
disable worker
rollback app code
```

а не удалять колонки/таблицы в горячем режиме.

---

# 29. Temporary DB cleanup

После успешного rollout удалить:

```text
crm_stage06_test
```

если она больше не нужна.

`crm_fresh_test` уже удалена.

---

# 30. Security debt после rollout

Не блокирует rollout по решению владельца, но оставить открытыми:

```text
ROTATE_YANDEX_OAUTH_TOKEN
ROTATE_YANDEX_CLIENT_SECRET
```

После rotation обязательно выполнить read-only smoke нового token.

---

# 31. EXECUTOR_REPORT_ROLLOUT

## 1. RESULT

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
```

## 2. GIT / DEPLOY

```text
CRM merge commit:
CRM production deploy:
web merge commit:
web production deploy:
```

## 3. MIGRATIONS

```text
migrate deploy:
migrate status:
schema fields verified:
MetrikaOrderOutbox verified:
```

## 4. BACKFILL

```text
dry-run:
apply:
post-apply dry-run:
structured values:
source text preserved:
```

## 5. API HEALTH

```text
counter:
timezone:
Reports API:
```

## 6. WORKER

```text
enabled:
started at:
pending:
processed:
failed:
retrying:
skipped_no_client_id:
```

## 7. GOALS

```text
lead_submitted_photo:
lead_submitted_canvas:
lead_submitted_tshirt:
form_error:
API reconciliation:
```

## 8. WEB CUTOVER

```text
deployed:
FALSE_BROWSER_PURCHASE_STOPPED_AT:
lead_submitted current:
purchase-on-lead current:
```

## 9. NATURAL LIVE EVENTS

```text
first natural LEAD:
first natural NEW / IN_PROGRESS:
first natural PAID:
first natural CANCELLED:
```

Если событие ещё не происходило:

```text
not observed yet
```

## 10. MATCHING

```text
controlled stage06 upload:
natural order matching:
lag:
```

## 11. SECURITY

```text
token committed/logged:
OAuth rotation debt:
Client Secret rotation debt:
```

## 12. TEMP DB

```text
crm_stage06_test:
```

## 13. NEW FACTS

Все новые факты для этапов 07–09.

## 14. DEVIATIONS

Если нет:

```text
none
```

## 15. OPEN ISSUES

Только реальные оставшиеся проблемы.

---

# 32. Decision Gate

Rollout принимается, если:

- CRM feature слит и production работает;
- migrations применены через `migrate deploy`;
- backfill applied и повторный dry-run чист;
- worker включён и не ломает CRM;
- 4 обязательные goals созданы;
- web analytics branch выложена;
- ложный browser purchase прекращён;
- lead_submitted продолжает работать;
- новые CRM transitions создают outbox;
- хотя бы IN_PROGRESS production flow подтверждён либо ожидается естественное событие без технических блокеров;
- rollback strategy остаётся доступной;
- временная stage06 DB удалена после завершения проверки.

После этого:

```text
06_PRODUCTION_ROLLOUT = DONE
```

и начинается:

```text
07_METRIKA_TO_ANALYTICS.md
```

---

# 33. EXECUTOR_REPORT_ROLLOUT — PHASE B–H, 12.09.2026

## 1. RESULT

```text
PARTIAL — PHASE B–H выполнены, production CRM работает с новой схемой, backfill
применён, воркер включён. PHASE I (4 цели — владелец), J (web deploy — по
отдельному подтверждению владельца), K, L — впереди.
```

## 2. GIT / DEPLOY

```text
CRM merge commit:       d72ffff — fast-forward feature/analytics-foundation → master
                        (master был на 81e7fd0, 0 коммитов впереди ветки), push 11:59:28 MSK
CRM production deploy:  GitHub Actions run success 12:07:05 MSK (тесты + образы);
                        auto-update.sh: frontend 12:02–12:03, backend 12:09:54 → 12:10:27
                        «обновлён и здоров», nginx перечитан, холст прогрет;
                        образ backend 8f9dd2f7… → de021522…
web merge commit:       не выполнялся (PHASE J — по отдельному подтверждению)
web production deploy:  не выполнялся
pre-deploy (PHASE A):   CRM 748 tests / build / prisma validate / панель build — OK;
                        web 389+77+38 tests, tsc 0, next build — OK; обе ветки чистые,
                        0 позади своих deploy-веток
server compose:         /opt/raspechatka/docker-compose.prod.yml — резервная копия
                        docker-compose.prod.yml.bak-20260912_115914; точечно добавлены
                        YANDEX_METRIKA_COUNTER_ID / _OAUTH_TOKEN / _ORDERS_SYNC_ENABLED в
                        environment backend; локальное отличие (TZ у greeter) сохранено;
                        `docker compose config` OK
```

## 3. MIGRATIONS

```text
migrate deploy:   на старте контейнера (12:10:14 MSK): «75 migrations found», применены 4 —
                  20260601000000_baseline_db_push_era (no-op на бою),
                  20260911180000_order_attribution_fields,
                  20260911200000_order_first_touch_url,
                  20260912090000_metrika_order_outbox — «All migrations have been
                  successfully applied». После штатного пересоздания в PHASE H:
                  «No pending migrations to apply»
migrate status:   «Database schema is up to date!» (из контейнера); в _prisma_migrations 75
schema fields verified:  OrderPhoto: yandexClientId, yclid, utmSource, utmMedium, utmCampaign,
                  utmContent, utmTerm, conversionPageUrl, firstTouchUrl (text),
                  clientPaidAt (timestamp) — есть; индексы OrderPhoto_yandexClientId_idx,
                  OrderPhoto_clientPaidAt_idx — есть
MetrikaOrderOutbox verified:  19 колонок; индексы pkey, dedupeKey_key (unique),
                  status_nextAttemptAt_idx, orderId_idx; FK MetrikaOrderOutbox_orderId_fkey
migrate resolve / ручные правки _prisma_migrations / чистка WIP-объектов: не выполнялись
```

## 4. BACKFILL

```text
dry-run (PHASE D, 12:1x):  просмотрено 323 заказа, к изменению 219; yandexClientId 11,
                  yclid 10, conversionPageUrl 16, UTM 0, clientPaidAt 204; конфликтов 0 —
                  ровно ожидаемые величины
apply (PHASE E):  записано 219 строк, конфликтов 0, 4,7 с
post-apply dry-run:  «Заказов с изменениями: 0»; все найденные значения «уже есть»
structured values:  clientId 0→11, yclid 0→10, conversionPageUrl 0→16, clientPaidAt 0→204
source text preserved:  md5(note по всем заказам) c81481eb… до = после;
                  md5(designNote) ca1a0d25… до = после; StatusHistory 1453 = 1453;
                  заказов 323 = 323; существующих структурных значений до apply не было —
                  перезаписывать было нечего
кандидат 20260909-091:  NEW, yandexClientId заполнен, conversionPageUrl
                  https://raspechatkaa.ru/catalog/instax, clientPaidAt пуст (не оплачен)
```

## 5. API HEALTH (PHASE F, read-only из боевого контейнера)

```text
counter:      111569944 → HTTP 200, permission own, code_status CS_ERR_UNKNOWN (cookie-gate, известно)
timezone:     Europe/Moscow, смещение 180 мин
Reports API:  2026-09-06..2026-09-12 — визиты 178, посетители 126, просмотры 997,
              sampled=false, data_lag=0; 3 запроса за 701 мс
goals:        17 (было 13) — см. NEW FACTS
last_uploadings:  1 — контрольная загрузка 54f3af75-… 11:45:09, PASSED, CSV/API
```

## 6. WORKER

```text
enabled:      yes — YANDEX_METRIKA_ORDERS_SYNC_ENABLED=true в /opt/raspechatka/.env
              (резервная копия .env.bak-metrika-worker-20260912_121941)
started at:   пересоздание backend 12:19:41 → running:healthy 12:20:15 MSK; лог
              «Метрика: воркер отправки заказов запущен» 12:20:10; nginx перечитан;
              /health ok; панель через nginx — HTTP 200
до включения (PHASE G/§13):  лог «отправка заказов выключена — очередь копится»;
              естественных переходов статуса с момента деплоя (12:10) не было — 0 строк
              StatusHistory, 0 строк очереди; постановка в очередь подтверждена
              тестами (unit + e2e на копии базы), заказы руками не двигались
pending: 0    processed: 0    failed: 0    retrying: 0    skipped_no_client_id: 0
last_success_at: —   last_failure_at: —   (первый естественный переход ещё не случился;
              суббота)
массового исторического enqueue нет: очередь пуста — код ставит только новые переходы
```

## 7. GOALS (PHASE I — действие владельца, пока не выполнено)

```text
lead_submitted_photo:   MISSING
lead_submitted_canvas:  MISSING
lead_submitted_tshirt:  MISSING
form_error:             MISSING
API reconciliation:     17 целей в счётчике = 13 прежних + 4 системные CRM-цели, которые
                        Метрика показала после первой CDP-загрузки:
                        596990603 «CRM: Заказ создан» (cdp_order_in_progress),
                        596990604 «CRM: Заказ оплачен» (cdp_order_paid),
                        596990605 «CRM: Спам заказ», 596990606 «CRM: Заказ отменен».
                        Четырёх обязательных JS-целей нет — создать в интерфейсе
                        (JavaScript-событие, идентификатор = имя события).
legacy URL goal:        602316919 «Заявка отправлена» → /thanks — не удалять;
                        canonical lead goal = lead_submitted (611379890)
```

## 8. WEB CUTOVER

```text
deployed:                          no — PHASE J ждёт (а) четырёх целей, (б) отдельного
                                   подтверждения владельца
FALSE_BROWSER_PURCHASE_STOPPED_AT: — (browser purchase на бою по-прежнему уходит)
lead_submitted current:            работает на бою в текущей версии сайта (цель 611379890)
purchase-on-lead current:          да, пока работает (feature/analytics-event-model не выложена)
```

## 9. NATURAL LIVE EVENTS

```text
first natural LEAD:                not observed yet (после деплоя 12:10 MSK заявок не было)
first natural NEW / IN_PROGRESS:   not observed yet
first natural PAID:                not observed yet
first natural CANCELLED:           not observed yet
```

## 10. MATCHING

```text
controlled stage06 upload:  CONTROLLED_STAGE06_TEST — заказ f40a79d6-7a3b-4a5c-9ced-c441449fe2f0
                            (20260909-091) → IN_PROGRESS, uploading 54f3af75-…, PASSED;
                            выполнен 12.09 11:45 из тестовой копии, НЕ из боевой очереди
                            (на бою строки очереди по нему нет). Не считать боевым событием.
                            Появление системных целей «CRM: Заказ создан/оплачен/…» в счётчике
                            после этой загрузки — признак, что Метрика приняла её как CRM-заказ.
natural order matching:     not yet observable — естественных переходов не было
lag:                        проверить Reports API (пресет «Заказы CRM») позже, после задержки данных
```

## 11. SECURITY

```text
token committed/logged:        no (в compose — подстановка ${…}; в логах — операция/код/мс)
OAuth rotation debt:           OPEN — ROTATE_YANDEX_OAUTH_TOKEN (по решению владельца не блокирует)
Client Secret rotation debt:   OPEN — ROTATE_YANDEX_CLIENT_SECRET
после ротации:                 read-only smoke новым токеном (npm run metrika:smoke в контейнере)
```

## 12. TEMP DB

```text
crm_stage06_test:  deleted (12:21 MSK) — результаты контрольной отправки сохранены в
                   06_CRM_TO_METRIKA_LIVE_WRITE.md § 24; на сервере остались только postgres и crm
crm_fresh_test:    deleted ранее (12.09)
```

## 13. NEW FACTS

1. **Системные CRM-цели появились в счётчике сами** после первой CDP-загрузки:
   «CRM: Заказ создан / оплачен / отменен / Спам заказ» (id 5969906xx). Для
   этапов 07–09 это готовые цели для конверсии «визит → заказ → оплата».
2. Боевая база теперь: 75 миграций, структурная атрибуция заполнена по
   219 заказам (11 ClientID, 10 yclid, 16 страниц, 204 дат оплаты);
   `note`/`designNote`/`StatusHistory` байт в байт как до.
3. Деплой CRM занимает ~11 минут от push до здорового контейнера (CI 7,5 мин,
   auto-update — в течение минуты после образа); при штатном пересоздании
   backend nginx нужно перечитывать вручную — auto-update делает это сам,
   ручной `compose up` — нет (сделано).
4. Серверный compose не синхронизируется из git: `MARKETPLACE_SECRET` из master
   там по-прежнему отсутствует (не относится к этапу; поведение не меняется —
   пусто = откат на JWT_SECRET). Отдельный пункт на будущее.
5. Любой push в `master` (в т.ч. только документы) пересобирает образ и
   пересоздаёт боевой backend — поэтому отчёты этого этапа коммитятся в
   `feature/analytics-foundation`, а в master уйдут со следующим кодовым
   слиянием.

## 14. DEVIATIONS

1. § 13 — естественного перехода за время rollout не случилось (суббота);
   по документу перешли дальше, опираясь на тесты постановки в очередь.
   Заказы руками не двигались.
2. § 29 — `crm_stage06_test` удалена уже сейчас, до PHASE J: все её результаты
   зафиксированы в отчётах, дальше она не нужна.

## 15. OPEN ISSUES

1. PHASE I — владелец создаёт 4 JS-цели; затем сверка по API (`metrika:smoke`).
2. PHASE J — web merge `feature/analytics-event-model → feature/cms-admin`
   только по отдельному подтверждению владельца (после целей).
3. PHASE L / matching — дождаться первого естественного LEAD→NEW и PAID;
   проверить строку очереди → delivered/PASSED; позже — отчёт «Заказы CRM».
4. Security debt: ROTATE_YANDEX_OAUTH_TOKEN, ROTATE_YANDEX_CLIENT_SECRET.
5. Серверный compose: добавить `MARKETPLACE_SECRET` (дрейф с master, вне этапа).
