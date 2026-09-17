# RELIABILITY_SECURITY_AUDIT — текущее состояние аналитического контура (этап 13)

## Статус

```text
CURRENT STATE зафиксирован 17.09.2026 (implementation Stage 13, production master 1f8b7b4, Insights ENABLED).
Источники: код crm-new (этапы 05–12), production read-only (журналы, размеры таблиц, логи контейнеров, конфиги
сервера), Stage 12 rollout. Исправления этапа 13 — в столбце «Действие» с пометкой [сделано в 13] / [rollout 13] /
[решение владельца]. Принцип: BUSINESS_PATH > ANALYTICS_PATH — отказ любой аналитической подсистемы не должен
трогать заказы, отчёты, P&L и сайт.
```

Приоритеты: **P0** — остановка бизнеса / утечка секрета / подмена production; **P1** — порча данных, ложный SUCCESS,
зависание; **P2** — наблюдаемость, хранение; **P3** — документация.

## 1. Сводка по подсистемам

| Подсистема | Текущая защита | Главный разрыв | Приоритет |
|---|---|---|---|
| CRM business path (заказы, задачи, P&L, сайт) | аналитика — отдельные модули и таблицы; ошибки хуков ловятся; воркеры не блокируют HTTP; `/health` — только `SELECT 1` | не было операционной диагностики, которая показывает «аналитика сломана, CRM жив» одним ответом | P2 → [сделано в 13] `/analytics/ops/status` |
| YandexMetrikaClient | таймаут 10 с; 2 повтора только на 429/5xx/сеть/таймаут; 401/403 без повторов; POST без повторов; токен не попадает в ошибки и лог (тесты A–K) | — | — |
| CRM→Metrika outbox (этап 06) | транзакционная запись при смене статуса; `FOR UPDATE SKIP LOCKED`; строгий порядок внутри заказа; расписание повторов 1/5/15/60/360 мин, максимум 20; permanent-ошибки → failed сразу; processing > 10 мин → pending; рубильник `YANDEX_METRIKA_ORDERS_SYNC_ENABLED` | нет сводки pending/failed/oldest age вне CLI | P2 → [сделано в 13] в диагностике |
| Metrika→local sync (этап 07) | advisory lock 700701 в отдельном соединении; RUNNING → набор → замена периода в одной транзакции → SUCCESS/FAILED; PARTIAL честный; RUNNING > 60 мин закрывается как FAILED следующим запуском; наборы независимы | `lastDailyDate` в памяти процесса → каждый рестарт начинается с суточного тика (21 день, 23 запроса) — безвредно, но лишние запросы к API | P3, документировано |
| Снимки пресетов (этап 08) | upsert по пресету (не растут); обновляются после тика | обновляются и после FAILED синхронизации (16 запросов к API даже когда данные не обновились) | P3, решение: оставить (снимки не зависят от наборов) |
| Дашборд / поведение (этапы 09–10) | только Postgres; кэш с TTL, ошибки не кэшируются; флаг → 404; ADMIN | ошибка сервиса → 500 (правильно), но текст исключения стандартный Nest — проверено F7 | — |
| Рост (этап 11) | хук после успешного тика; версии неизменяемы, unique(changeId, version); публичные загрузчики | у хука нет своего замка/журнала (защищён последовательностью хуков в одном процессе); **порядок пересекающихся изменений не был детерминирован** — текст confounder зависел от физического порядка строк (обнаружено restore drill) | P1 → [сделано в 13] `orderBy startedAt, id` |
| Сигналы (этап 12) | замок: флаг процесса + строка RUNNING ≤ 10 мин; журнал; идемпотентность (dedupe по отпечатку); guard 404 до валидации | зависшие RUNNING оставались в журнале навечно (не блокировали, но врали) | P1 → [сделано в 13] закрываются как FAILED |
| PostgreSQL / миграции | `prisma migrate deploy` на старте контейнера; миграции только аддитивные для аналитики; backups 03:00 + S3 | drift `SalaryPayment.updatedAt` (см. MIGRATION_SAFETY.md); не было проверки «образ ↔ база» | P2 → [сделано в 13] `DATABASE_MIGRATION_MISMATCH` в диагностике; drift — [решение владельца] |
| Auth / privacy | JwtAuthGuard + RolesGuard(ADMIN) на всех маршрутах аналитики; ValidationPipe whitelist + forbidNonWhitelisted; helmet; CORS по списку | не было автоматической матрицы маршрутов | P2 → [сделано в 13] HTTP-матрица (9 тестов) |
| Секреты / логи | секреты только в `.env` сервера и compose `${VAR}`; клиент Метрики не логирует токен; JWT для проб подписывается в контейнере | не было runbook ротации; нет сканера в CI | P1 → [сделано в 13] runbook + скан (SECRET_FOUND=no); CI-скан — [решение владельца] |
| Backup / restore | cron 03:00: pg_dump\|gzip, 14 локальных копий, выгрузка в Yandex Object Storage + том uploads; лог backup.log | restore никогда не отрабатывался | P1 → [сделано в 13] restore drill (BACKUP_RESTORE_RUNBOOK.md) |
| Хранение | таблицы малы (БД 25 МБ) | журнал синхронизации растёт ~288 строк/сутки без предела; docker json-file без ротации | P2 → [сделано в 13] политика + dry-run; ротация логов — [rollout 13] |
| CI/CD | тесты до сборки (CRM); образы `:sha` + `:latest` | **workflow пушнутой ветки решает сам, публиковать ли `latest`** → устаревшая ветка подменила бой (14.09) | P0 → [сделано в 13] production-метка по `github.ref`, сервер потребляет `:production`; GitHub-настройки — [rollout 13] |
| compose / auto-update | таймер 5 мин; сравнение id образа; health-ожидание; nginx reload; прогрев холста | `up -d --force-recreate <svc>` без `--no-deps` пересоздавал зависимый backend старым образом (17.09) | P0 → [сделано в 13] `--no-deps`, порядок, сверка build |
| Health / build identity | `/health` (SELECT 1, uptime) | нет идентификатора сборки у CRM (у сайта есть) | P2 → [сделано в 13] `build` в `/health`, LABEL revision |

## 2. Матрица отказов (Component | Failure mode | Current protection | Gap | Severity | Proposed action)

| Компонент | Отказ | Текущая защита | Разрыв | Sev | Действие |
|---|---|---|---|---|---|
| MetrikaApiClient | timeout (10 с) | `AbortSignal.timeout`, класс `timeout`, 2 повтора (500/1500 мс) | — | — | тесты G (клиент), «таймаут/сеть на всех наборах» (sync) |
| MetrikaApiClient | 401 / 403 | без повторов, класс `unauthorized`/`forbidden`, человеческий текст, токен не в ошибке | оператор узнавал только из лога | P2 | [сделано] `metrikaApi FAILED` + `METRIKA_SYNC_FAILED` с классом ошибки и действием (ротация) |
| MetrikaApiClient | 429 | повтор по расписанию клиента; в очереди — по расписанию очереди | — | — | тест F |
| MetrikaApiClient | 5xx | 2 повтора, затем `server` | — | — | тест F |
| MetrikaApiClient | сеть / reset | класс `network`, повторы | — | — | тест G |
| MetrikaApiClient | не JSON | класс `http`, без падения | — | — | тест «не JSON» |
| MetrikaApiClient | токен отсутствует | `not_configured`: расписание не запускается, очередь ждёт (повтор раз в час), CRM работает | не было видно в одном месте | P2 | [сделано] `METRIKA_NOT_CONFIGURED`, `metrikaApi DISABLED` |
| Планировщик (этап 07) | наложение тиков | флаг `running` в процессе; advisory lock 700701 между процессами; второй → LOCKED | — | — | тесты «lock: два одновременных запуска», scheduler «тик во время тика» |
| Планировщик | рестарт контейнера | первый тик через 90 с — суточный (`lastDailyDate` в памяти); boot-тик идемпотентен | лишние 23 запроса к API при каждом рестарте | P3 | документировать; при частых рестартах — хранить `lastDailyDate` в базе (отдельный FIX) |
| Синхронизация | падение БД во время замены | delete + insert набора в одной транзакции → набор FAILED, прежние строки целы | — | — | тест «падение транзакции записи → набор FAILED, прежние строки не тронуты» (F3) |
| Синхронизация | зависший RUNNING (процесс умер) | RUNNING > 60 мин → FAILED при следующем запуске | пока нет следующего запуска — видно только в базе | P2 | [сделано] `METRIKA_SYNC_STUCK` (CRITICAL) |
| Синхронизация | часть наборов упала | PARTIAL, остальные записаны | — | — | тест «failure isolation» |
| Outbox (этап 06) | временная ошибка | retry 1/5/15/60/360 мин, ≤ 20 попыток | — | — | спец 565 строк |
| Outbox | постоянная ошибка (400/401/403/валидация) | failed сразу, без удаления; `requeue`/`skip` оператором | не было сводки | P2 | [сделано] `OUTBOX_FAILED` с возрастом |
| Outbox | дубликат / порядок | строгий порядок внутри заказа; SKIP LOCKED; `uploading_id` в журнале | — | — | тесты порядка |
| Outbox | processing зависло | > 10 мин → pending | — | P3 | [сделано] `OUTBOX_STUCK` |
| Outbox | рост очереди | воркер каждые 30 с, лимит 10 за проход | — | P3 | [сделано] `OUTBOX_BACKLOG` (pending > 50 или старейшая > 2 ч) |
| Миграции | падение `migrate deploy` на старте | контейнер не стартует → старый образ не заменяется (auto-update ждёт healthy и пишет ВНИМАНИЕ) | образ и база могут разойтись без сигнала | P1 | [сделано] `DATABASE_MIGRATION_MISMATCH`; MIGRATION_SAFETY.md |
| Аналитика | данные устарели | Stage 12 `quality.stale` (ATTENTION < 6 ч / CRITICAL ≥ 6 ч) — деловой сигнал | операционного условия не было | P2 | [сделано] `METRIKA_SYNC_STALE` (WARNING 2 ч / CRITICAL 6 ч) |
| Снимки | не обновились | — | не было сигнала | P3 | [сделано] `SNAPSHOT_STALE` |
| Дашборд | сервис бросает исключение | 500 JSON стандартный, кэш ошибки не хранит | — | — | F7 в матрице маршрутов |
| Флаги | раздел OFF | 404 (этап 12 — до валидации; этапы 09–11 — в обработчике), хуки не регистрируются | — | — | матрица маршрутов, F8 |
| Auth | без токена / чужая роль | 401 / 403 на всех маршрутах | — | — | матрица маршрутов |
| Секреты | утечка в git / логи / API | grep-скан: репозитории (рабочее дерево + история), логи 7 дней, API-ответы | нет автоматического сканера в CI | P1 | SECRET_ROTATION_RUNBOOK.md; CI-скан — предложение |
| Хранение | рост журналов | — | ~105 тыс. строк/год в `MetrikaSyncRun` | P2 | RETENTION_POLICY.md, dry-run CLI |
| Backup/restore | восстановление не проверено | ежедневный дамп + S3 | drill не проводился | P1 | [сделано] drill: restore 6 с, 0 ошибок, 83/62/172/45 совпали, сверка этапов 09–12 diff 0 |
| Deploy | образ ≠ ожидаемый | сравнение id образа | нет проверки, какой код реально работает | P2 | [сделано] `build` в `/health` + сверка в auto-update |
| Deploy | compose/env расходятся | правка compose руками; `${VAR:-default}` | правка env перед приходом образа → рестарт старым образом | P0 | [сделано] `--no-deps`; DEPLOYMENT_SAFETY.md: правку env делать до push или с `--no-deps` |
| Deploy | деплой во время тика | recreate убивает контейнер посреди синхронизации → RUNNING → FAILED через 60 мин; замена периода транзакционна → данных не портит | окно до 60 мин без сигнала | P2 | [сделано] `METRIKA_SYNC_STUCK`; правило rollout: деплой сразу после SUCCESS тика |
| Время | Europe/Moscow | окна и cutoff считаются в MSK (`calendarDateIn`, `periodBoundsUtc`); БД в UTC | — | — | SCHEDULER_RELIABILITY.md § 6 |
| nginx | access log хранит `yclid=<19 цифр>` (клик-идентификатор рекламы) и IP | стандартный log_format | спец относит yclid к PII-скану | P2 | [rollout 13] log_format без query-string для сайта либо маскирование `yclid`; ротация json-file |
| Docker логи | json-file без ротации | размеры малы (1,5 МБ / 7 дней) | рост без предела | P3 | [rollout 13] daemon.json `max-size 50m, max-file 5` |

## 3. Что уже подтверждено тестами / замерами (evidence)

- Клиент Метрики: `metrika-api.client.spec.ts` (A–K): 401/403 без повторов, 429/5xx повтор, таймаут/сеть, не JSON, токен не утекает.
- Синхронизация: `metrika-analytics-sync.service.spec.ts`: idempotency, replacement, failure isolation, таймаут → FAILED без записи, падение транзакции → прежние строки целы, lock, NOT_CONFIGURED, зависший RUNNING → FAILED.
- Планировщик: `metrika-analytics-scheduler.service.spec.ts`: суточный/часовой план, тик во время тика, LOCKED, хуки после SUCCESS/PARTIAL и не после FAILED, ошибка хука не останавливает остальные, выключенный рубильник — без таймеров.
- Очередь заказов: `metrika-order-outbox*.spec.ts` (565 + 212 строк): порядок, SKIP LOCKED, повторы, permanent, requeue/skip, зависший processing.
- Этап 13: `ops-status.compute.spec.ts` (11), `ops-dashboard.controller.spec.ts` (4), `retention.spec.ts` (5), `deploy-safety.spec.ts` (11), `analytics-route-matrix.spec.ts` (9, HTTP), F4 в `analytics-insights.service.spec.ts`, F8 в `insights-dashboard.controller.spec.ts`, детерминизм `overlappingChanges` в `analytics-growth.service.spec.ts`.
- Production read-only: PII в 21 аналитической таблице — 0 (4 «телефона» — UUID), в логах 4 контейнеров за 7 дней — 0 секретов/PII; секреты в двух репозиториях (дерево + история) — 0 (SECRET_FOUND=no); restore drill — успешен.

## 4. Открытые пункты (не закрываются в implementation)

1. GitHub: environment `production` с deployment-branch policy и запретом publish из чужих веток; репозиторный доступ пакетов GHCR — DEPLOYMENT_SAFETY.md § 5 (настройки владельца).
2. Drift `SalaryPayment.updatedAt` — отдельная миграция `ALTER COLUMN "updatedAt" DROP DEFAULT` по решению владельца (MIGRATION_SAFETY.md § 6).
3. nginx access log: убрать query-string / маскировать `yclid`; docker log rotation — rollout 13.
4. Ротация OAuth-токена и client secret — по runbook, отдельным approval.
5. Retention apply — только rollout, после dry-run на production.
