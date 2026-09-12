# 06_PRODUCTION_ROLLOUT.md

# Этап 06 — Production rollout CRM → Яндекс Метрика

## Статус

```text
IN_PROGRESS
```

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
