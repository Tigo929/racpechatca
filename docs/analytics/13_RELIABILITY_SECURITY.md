# 13 — RELIABILITY & SECURITY

## 0. STATUS
```text
STAGE = 13_RELIABILITY_SECURITY
STATUS = READY_FOR_PRODUCTION_ROLLOUT (Reviewer APPROVED 17.09.2026); rollout-план 13_PRODUCTION_ROLLOUT.md = READY_FOR_REVIEW
PRODUCTION_CHANGE = FORBIDDEN_UNTIL_REVIEWER_ROLLOUT_GATE (production не менялся: master 1f8b7b4)
NEXT_STAGE = 14_FINAL_ACCEPTANCE
IMPLEMENTATION = feature/analytics-foundation 806e328 + 51f27ae + docs; web-photo feature/ci-safety 441d795
REPORT = § 32 EXECUTOR_REPORT_STAGE13_RELIABILITY_SECURITY; документы: RELIABILITY_SECURITY_AUDIT.md,
  SCHEDULER_RELIABILITY.md, IDEMPOTENCY_MATRIX.md, RETENTION_POLICY.md, BACKUP_RESTORE_RUNBOOK.md,
  SECRET_ROTATION_RUNBOOK.md, MIGRATION_SAFETY.md, DEPLOYMENT_SAFETY.md, INCIDENT_RUNBOOK.md
```

Исходный статус спецификации: `TODO`; команда «СТАРТ IMPLEMENTATION STAGE 13» — § 31.

## 1. ЦЕЛЬ
Доказать, что аналитическая система этапов 05–12 безопасна, наблюдаема, восстанавливаема и при отказах не ломает основной CRM/site business path.

Критический принцип:
```text
BUSINESS_PATH > ANALYTICS_PATH
```
Отказ Metrika API, CRM→Metrika, scheduler, growth, insights или dashboard не должен блокировать создание/ведение заказов, существующие CRM-отчёты, P&L или основной сайт.

## 2. SCOPE
Проверить и при необходимости harden:
- YandexMetrikaClient;
- CRM→Metrika outbox;
- Metrika→local sync;
- snapshots/metrics;
- dashboard/behavior/growth/insights;
- scheduler/hooks/locks;
- PostgreSQL analytics tables;
- migrations;
- auth/privacy;
- secrets/logs;
- backup/restore;
- retention;
- CI/CD и production image safety;
- compose/auto-update;
- health/readiness/build identity.

Не добавлять новые KPI, funnels, goals, Logs API, A/B, event-model изменения, P&L-формулы или Stage 14.

## 3. ОБЯЗАТЕЛЬНЫЙ CURRENT-STATE AUDIT
Создать `docs/analytics/RELIABILITY_SECURITY_AUDIT.md`.

Для каждого: Component | Failure mode | Current protection | Gap | Severity | Proposed action.

Минимум: API timeout/401/403/429/5xx/network/malformed response; scheduler overlap/restart; DB loss/partial transaction; stuck RUNNING; outbox transient/permanent/duplicate; migration failure; stale analytics; missing snapshot; dashboard failure; flag OFF; JWT/role; secret leakage; storage growth; backup/restore; deploy image mismatch; compose/env mismatch; concurrent deploy+tick; Europe/Moscow/timezone.

Сначала зафиксировать CURRENT STATE, потом исправлять.

## 4. ИЗВЕСТНЫЕ РИСКИ, КОТОРЫЕ НУЖНО ПРОВЕРИТЬ

### R1 OAuth credentials
Не выводить значения. Проверить git/logs/API/docs/screenshots на утечки. Подготовить rotation runbook. Реальную production rotation — только отдельным Reviewer-approved rollout.

### R2 Auto-update
На Stage 12 обнаружено `up -d --force-recreate <svc>` без `--no-deps`, что может recreate зависимый сервис и создать mixed-version window. Найти root cause и безопасно устранить/изолировать.

### R3 Prisma drift
Исследовать `SalaryPayment.updatedAt default`: происхождение, реальное состояние schema, deploy risk. Не менять production schema молча.

### R4 stale web feature → production latest
Ранее stale feature branch смог заменить актуальный production web image. Удаление `feature/print-card-lead-form` не является исправлением. Цель: non-production/stale branch MUST NOT publish/deploy production artifact.

### R5 storage growth
Измерить рост sync runs, snapshots, evaluations, insight versions/runs и aggregates; спроектировать retention без потери audit/history.

## 5. FAILURE STATES
Для subsystem использовать единый operational vocabulary:
`HEALTHY / DEGRADED / STALE / FAILED / DISABLED / RECOVERING`.

Subsystem минимум: crmBusiness, metrikaApi, metrikaOrdersOutbox, metrikaAnalyticsSync, periodSnapshots, behaviorAnalytics, growthEvaluations, automatedInsights, analyticsDashboard, database.

Metrika failure не должен делать CRM business path unhealthy.

## 6. HEALTH / READINESS
Аудит `/api/health`. Не делать live Metrika request на каждый health check.

Operational analytics diagnostics должны уметь безопасно показать:
- flags;
- last successful/failed sync;
- data age;
- RUNNING/stuck jobs;
- outbox pending/failed + oldest age;
- last growth/insights success;
- snapshot freshness;
- scheduler enabled.

Никаких token/secret/DB URL/ClientID/PII. Детальная диагностика — ADMIN-only.

## 7. SCHEDULER RELIABILITY
Создать `docs/analytics/SCHEDULER_RELIABILITY.md`.

Для каждой Stage 06–12 job: frequency, lock, timeout, retry, stuck recovery, idempotency, failure isolation.

Доказать:
- overlap исключён;
- restart не оставляет false SUCCESS;
- stuck обнаруживается;
- failure insights/growth не откатывает успешный sync;
- фактический hook order зафиксирован (`sync → snapshots → growth → insights` или фактический эквивалент);
- календарные окна согласованы с `Europe/Moscow`.

## 8. STUCK RECOVERY
Для run/outbox состояний определить threshold, recovery action, actor, audit record и idempotency.

`RUNNING older than threshold → STUCK → controlled recovery`.

Нельзя автоматически повторять non-idempotent/destructive operation.

## 9. CRM→METRIKA OUTBOX
Не менять Stage 06 semantics. Проверить transactional enqueue, dedupe, ordering, SKIP LOCKED, retry schedule/max attempts, permanent errors, requeue/skip, restart, duplicates, malformed payload, missing ClientID, reopen, queue growth.

Operational summary:
`pending / processing / failed / delivered / skipped / oldestPendingAge / oldestFailedAge`.

Никакого historical mass resend.

## 10. METRIKA CLIENT
Проверить тестами:
- 401/403 → no retry + normalized auth error;
- 429 → retry;
- 500/502/503 → retry;
- timeout/network reset → retry;
- malformed response → safe failure;
- token absent → analytics degraded/disabled, CRM alive;
- secrets redacted.

Failure injection только test/copy.

## 11. DATA CONSISTENCY
Проверить atomicity Stage 07–12: aggregate replacement, snapshots, growth versions, insight+version+run, lifecycle resolve/reopen, scheduler markers.

Инвариант:
`SUCCESS = committed usable state`.
Failure-injection tests должны исключить false SUCCESS и partial dataset.

## 12. IDEMPOTENCY
Создать `docs/analytics/IDEMPOTENCY_MATRIX.md`.

Покрыть: historical backfill, CRM enqueue/outbox, daily/hourly sync, snapshots, growth evaluate, insights run. Для каждого — repeat expected, duplicate protection, evidence.

## 13. RETENTION
Создать `docs/analytics/RETENTION_POLICY.md`.

Измерить production read-only: rows/table, bytes/indexes, growth/day, прогноз 30/90/365.

Retention:
- deterministic;
- dry-run;
- сохраняет failed/error evidence;
- не ломает dashboard presets, Stage11 windows/audit, Stage12 lifecycle;
- tests обязательны.

Production DELETE в implementation запрещён.

## 14. BACKUP / RESTORE
Создать `docs/analytics/BACKUP_RESTORE_RUNBOOK.md`.

Обязателен реальный restore drill НЕ в production DB:
1. свежий production backup;
2. isolated temporary DB;
3. restore;
4. schema/migrations check;
5. key row counts;
6. read-only Stage09/10/11/12 reconciliation;
7. cleanup temporary DB.

Никакого `prisma migrate dev` на production.

## 15. SECRETS
Создать `docs/analytics/SECRET_ROTATION_RUNBOOK.md`.

Secret classes без значений: Yandex OAuth token, Yandex app client secret, JWT secret, DB credentials, найденные integrations.

Для каждого: owner/location/consumers/rotation/rollback/verification/downtime.

Провести git-history + logs/API/CLI/scheduler/docs/screenshots scan. Если secret найден — НЕ ПЕЧАТАТЬ его; report только `SECRET_FOUND=yes/no`, location class, rotation_required.

Фактическую rotation не выполнять без отдельного rollout approval.

## 16. AUTH / PRIVACY
Автоматическая route matrix для Stage09–13:
unauthenticated / EXECUTOR / ADMIN / flag OFF / flag ON / invalid DTO / unknown resource.

Проверить OFF-before-ValidationPipe там, где это контракт Stage11/12, DTO whitelist и отсутствие лишнего enumeration.

PII scan analytics DB/API/logs: phone, email, Telegram/MAX, names/free text, Yandex ClientID, yclid, tokens/auth headers. Цель `PII_LEAKS_FOUND=0` либо blocker.

## 17. MIGRATION SAFETY
Создать `docs/analytics/MIGRATION_SAFETY.md`.

Проверить:
- fresh DB migrate deploy;
- production-copy migrate deploy;
- schema↔migration diff;
- destructive SQL;
- ordering/baseline;
- rollback strategy;
- `SalaryPayment.updatedAt` drift.

Drift не исправлять «заодно». Установить origin/risk и предложить отдельный FIX, если нужен.

## 18. CI/CD PRODUCTION IMAGE SAFETY — P0
Исследовать workflows обоих repos, особенно web-photo.

Acceptance:
`Only explicitly approved production source can publish/deploy production image.`

Предпочтительно image tag by commit SHA/digest; production deploy references approved immutable artifact; `latest` не единственный source of truth.

Безопасным static/config test доказать, что stale feature branch больше не может заменить production. Не пушить stale branch ради production-теста.

## 19. AUTO-UPDATE / COMPOSE — P0
Найти источник `--force-recreate` без `--no-deps`.

Acceptance:
- frontend update не recreate backend;
- analytics env edit не запускает старый backend image;
- deterministic deployment order;
- health подтверждает фактический build.

Добавить deployment invariant/documentation/tests.

## 20. BUILD IDENTITY
Production app должен позволять безопасно определить commit/build id и, если доступно, image digest. Reviewer должен отличать фактически работающий build без секретов.

## 21. LOGGING / OPERATIONAL CONDITIONS
Проверить structured fields: component, operation, runId, status, durationMs, attempt, errorClass.

Не логировать token/JWT/DB credentials/customer PII.

Определить deterministic conditions:
`METRIKA_SYNC_STALE, METRIKA_SYNC_FAILED, OUTBOX_BACKLOG, OUTBOX_FAILED, SNAPSHOT_STALE, GROWTH_RUN_FAILED, INSIGHTS_RUN_FAILED, INSIGHTS_RUN_STUCK, DATABASE_MIGRATION_MISMATCH`.

Для каждого threshold/severity/source/operator action. Не смешивать с business insights.

## 22. HTTP / MANUAL ACTION SECURITY
Проверить HTTPS/CORS/private cache/stack traces/method surface.

Особенно `POST /analytics/dashboard/insights/run`: ADMIN-only, bounded workload, lock/cooldown, audit trail, защита от parallel storm. Назначение endpoint не расширять.

## 23. PERFORMANCE
Production-like copy: daily/hourly sync, Stage11, Stage12 daily/hourly, dashboard/behavior/growth/insights, DB connections/transactions/memory при возможности. Проверить bounded batches, indexes, отсутствие N+1. Не оптимизировать без bottleneck.

## 24. FAILURE-INJECTION F1–F8
Только test/copy:

F1 Metrika timeout → sync FAILED, old good data readable, CRM alive.
F2 429→success → retry, single committed result.
F3 DB error during replacement → no partial dataset / no false SUCCESS.
F4 stale RUNNING/process death → detected + controlled recovery.
F5 insights fail after successful sync → sync SUCCESS, insights FAILED, next run recovers.
F6 duplicate scheduler invocation → one writer, second locked/skipped.
F7 dashboard metrics throws → explicit error, not fake zeros.
F8 flag OFF → contractual disabled behavior, no background writes.

## 25. REQUIRED DOCS
К концу implementation:
- `13_RELIABILITY_SECURITY.md`
- `RELIABILITY_SECURITY_AUDIT.md`
- `SCHEDULER_RELIABILITY.md`
- `IDEMPOTENCY_MATRIX.md`
- `RETENTION_POLICY.md`
- `BACKUP_RESTORE_RUNBOOK.md`
- `SECRET_ROTATION_RUNBOOK.md`
- `MIGRATION_SAFETY.md`

При необходимости: `INCIDENT_RUNBOOK.md`, `DEPLOYMENT_SAFETY.md`.

## 26. PRIORITY
`P0 business outage/secret exposure/production overwrite → P1 corruption/false SUCCESS/stuck → P2 monitoring/retention → P3 docs`.

## 27. PRODUCTION RULE
Implementation и rollout — разные gates.

Во время implementation запрещены production migrations/restarts/env edits/secret rotation/retention deletes/CI deploy/data repair/failure injection.

После implementation Reviewer принимает только:
`READY_FOR_PRODUCTION_ROLLOUT / NEEDS_FIX / BLOCKED`.

Только после этого создаётся `13_PRODUCTION_ROLLOUT.md`.

## 28. ACCEPTANCE
Reliability:
- Metrika failure не ломает business path;
- jobs isolated;
- stuck detected/recoverable;
- idempotency доказана;
- false SUCCESS исключён;
- outbox observable;
- retention dry-run;
- isolated restore drill успешен.

Security:
- API private + route matrix;
- PII/secret leakage 0 либо blocker;
- rotation runbook;
- diagnostics sanitized;
- manual actions bounded/audited.

Deployment:
- stale feature cannot publish production artifact;
- targeted update не recreate unrelated service;
- deployed build identifiable;
- drift investigated;
- backup/restore verified.

Regression:
Stage06, 07/08, 09, 10, 11, 12 semantics/reconciliation unchanged.

## 29. STOP CONDITIONS
Вернуть BLOCKED/NEEDS_FIX при active secret leak, unknown destructive migration, изменении order/P&L/Stage10–12 semantics, unsafe CI fix, failed restore, необходимости production write/restart во время implementation, невозможности доказать analytics/business isolation или неустранимой PII leakage.

Не маскировать STOP изменением теста/threshold.

## 30. EXECUTOR REPORT
Вернуть `EXECUTOR_REPORT_STAGE13_RELIABILITY_SECURITY` с разделами:
RESULT; GIT; AUDIT; FAILURE_ISOLATION; HEALTH/DIAGNOSTICS; SCHEDULER/LOCKS; OUTBOX; TRANSACTIONS/IDEMPOTENCY; RETENTION; BACKUP/RESTORE; SECRETS; AUTH/PRIVACY; MIGRATIONS; CI/CD SAFETY; AUTO-UPDATE SAFETY; BUILD IDENTITY; FAILURE-INJECTION F1–F8; PERFORMANCE; REGRESSION Stage06–12; TESTS; NEW_FACTS; DEVIATIONS; OPEN_DECISIONS; PRODUCTION_UNTOUCHED.

## 31. КОМАНДА ИСПОЛНИТЕЛЮ
```text
СТАРТ IMPLEMENTATION STAGE 13.

Выполняй Stage 13 строго по docs/analytics/13_RELIABILITY_SECURITY.md.
Сначала audit current state, затем P0/P1 fixes. Production не менять.

Особое внимание:
1. stale feature branch не должна иметь возможность перезаписать production image;
2. targeted service update не должен recreate unrelated dependencies;
3. SalaryPayment.updatedAt drift исследовать, но не исправлять молча;
4. выполнить настоящий restore drill в isolated DB;
5. secrets проверять без вывода значений;
6. OAuth token/client secret только подготовить к rotation;
7. не менять Stage06 business semantics, Stage08 KPI, Stage10 behavior,
   Stage11 growth, Stage12 thresholds/semantics;
8. Stage14 не начинать.

В конце вернуть EXECUTOR_REPORT_STAGE13_RELIABILITY_SECURITY.
```

---

# 32. EXECUTOR_REPORT_STAGE13_RELIABILITY_SECURITY — 17.09.2026

## RESULT

```text
READY_FOR_PRODUCTION_ROLLOUT
```

Implementation выполнена в feature-ветках (`racpechatca` `feature/analytics-foundation`: 806e328 код, 51f27ae детерминизм
роста, docs; `web-photo` `feature/ci-safety`: 441d795). Production не менялся: master 1f8b7b4, серверные compose/.env/
auto-update прежние, контейнеры не перезапускались, миграций и удалений не было, ротация секретов не выполнялась, failure
injection — только тесты и временная копия. P0 (подмена production-образа устаревшей веткой; пересоздание соседнего
сервиса при выкладке) и P1 (зависшие RUNNING, недетерминированный порядок confounder, restore drill, скан секретов)
закрыты в коде и документах; production-применение — `13_PRODUCTION_ROLLOUT.md` (создаётся после verdict Reviewer).

## GIT

```text
racpechatca feature/analytics-foundation: 8f1707d (Stage 12 docs) → 3d45f4c спецификация Stage 13 как получена →
  806e328 feat(этап 13): диагностика /analytics/ops/status, закрытие зависших RUNNING сигналов, retention (dry-run),
          /health build + Dockerfile BUILD_SHA/LABEL, workflow production-метки по github.ref, compose :production,
          auto-update --no-deps + порядок + сверка build, deploy-safety.spec, HTTP-матрица маршрутов, F7/F8 →
  51f27ae fix: orderBy в overlappingChanges (детерминизм) → <docs>: 13_RELIABILITY_SECURITY.md (STATUS + этот отчёт),
  RELIABILITY_SECURITY_AUDIT.md, SCHEDULER_RELIABILITY.md, IDEMPOTENCY_MATRIX.md, RETENTION_POLICY.md,
  BACKUP_RESTORE_RUNBOOK.md, SECRET_ROTATION_RUNBOOK.md, MIGRATION_SAFETY.md, DEPLOYMENT_SAFETY.md, INCIDENT_RUNBOOK.md,
  00_MASTER_PLAN.md, 01_CURRENT_STATE.md.
  Изменённые существующие файлы: .github/workflows/build-images.yml, crm-new/Dockerfile.prebuilt, crm-new/package.json
  (скрипт analytics:retention), src/health.controller.ts, src/app.module.ts (+OpsModule), analytics-insights.service.ts
  (зависшие RUNNING), analytics-growth.service.ts (orderBy), deploy/auto-update.sh, docker-compose.prod.yml, 4 spec.
  Новые: src/analytics/ops/* (7), src/analytics/retention/* (3) + retention-cli.ts, analytics-route-matrix.spec.ts,
  deploy-safety.spec.ts. Схема Prisma и миграции — без изменений. origin/master = 1f8b7b4 (production), не менялся.
web-photo feature/ci-safety (от production-ветки feature/cms-admin 812f9cb): 441d795 — workflow: branches [feature/cms-admin],
  production-метки по github.ref, BUILD_SHA/revision, шаг scripts/ci-safety-check.mjs до сборки. Пуш ветки сборок
  не вызвал (проверено по Actions API: последний запуск — 15.09 18:29 feature/cms-admin). feature/cms-admin не менялась.
  web-photo event model / Logs API / nginx-domain.conf — не трогались; feature/print-card-lead-form — не трогалась.
```

## AUDIT

```text
RELIABILITY_SECURITY_AUDIT.md: сводка по 15 подсистемам + матрица отказов (37 строк: Component | Failure mode | Current
protection | Gap | Severity | Proposed action), включая API timeout/401/403/429/5xx/network/malformed, overlap/restart,
DB loss/partial transaction, stuck RUNNING, outbox transient/permanent/duplicate, migration failure, stale, missing snapshot,
dashboard failure, flag OFF, JWT/role, secret leakage, storage growth, backup/restore, image mismatch, compose/env mismatch,
concurrent deploy+tick, Europe/Moscow. CURRENT STATE зафиксирован до правок; правки помечены [сделано в 13] / [rollout 13] /
[решение владельца]. P0: CI stale branch, auto-update --no-deps. P1: зависшие RUNNING сигналов; недетерминированный
порядок confounder (найден drill); restore никогда не отрабатывался; runbook ротации отсутствовал. P2: диагностика,
условия, retention, nginx access log с yclid, docker log rotation, drift. P3: lastDailyDate в памяти, снимки после FAILED.
```

## FAILURE_ISOLATION

```text
BUSINESS_PATH > ANALYTICS_PATH: аналитика — отдельные модули/таблицы; хуки после тика ловят исключения (тик остаётся
SUCCESS); воркеры и HTTP не связаны; /health — SELECT 1 без Метрики. Диагностика: crmBusiness становится FAILED только
при недоступной базе; отказ Метрики (401) → metrikaApi FAILED, metrikaAnalyticsSync FAILED, crmBusiness HEALTHY
(ops-status.compute.spec «BUSINESS_PATH > ANALYTICS_PATH»). Token absent → METRIKA_NOT_CONFIGURED, расписание не
стартует, очередь ждёт, CRM работает (клиент: тест H; диагностика: DISABLED). Production 17.09: Insights ENABLED,
8 карточек; ошибок Nest за 7 дней 0; stack-trace строк 0.
```

## HEALTH / DIAGNOSTICS

```text
/health (публичный для docker healthcheck): status, database, build (BUILD_SHA из образа, нижний регистр, null у сборок
без аргумента), uptimeSeconds, timestamp — без Метрики. Новый GET /analytics/ops/status (ADMIN, JwtAuthGuard + RolesGuard,
не зависит от флагов разделов): flags (вкл/выкл + metrikaConfigured без значений), subsystems ×10 со словарём
HEALTHY/DEGRADED/STALE/FAILED/DISABLED/RECOVERING, conditions (код, severity, source, detail, since, operatorAction),
thresholds, database (миграции диск↔база), sync (lastSuccessAt, dataAgeSeconds, lastDataDay, lastRunStatus, lastError
санитизированный, running, failedLast24h), outbox (pending/processing/failed/delivered/skipped, oldest ages, lastDeliveredAt),
snapshots, growth, insights (последний запуск, RUNNING, openCards). Никаких token/secret/DB URL/ClientID/PII: тест
«в ответе нет ключей и значений, похожих на секреты»; sanitizeError скрывает OAuth/Bearer/y0_/postgresql://…/JWT.
Стоимость: ~14 индексных запросов, все Promise.all; база недоступна → честный DATABASE_UNAVAILABLE без исключения.
Для UI не подключалась (спецификация не требует; данные для этапа 14).
```

## SCHEDULER / LOCKS

```text
SCHEDULER_RELIABILITY.md: 7 задач (outbox 30 с, sync 60 мин / boot 90 с, снимки, growth-хук, insights-хук, auto-update 5 мин,
backup 03:00) с частотой, замком, таймаутом, повторами, stuck-recovery, идемпотентностью, изоляцией. Доказательства:
наложение — advisory lock 700701 + running-флаг + RUNNING-строка сигналов (тесты + production LOCKED 0); рестарт без
ложного SUCCESS — статусы после коммита, зависшие RUNNING → FAILED (60 мин sync / 10 мин insights — новое); stuck
обнаруживается — METRIKA_SYNC_STUCK / INSIGHTS_RUN_STUCK / OUTBOX_STUCK; ошибка сигналов/роста не откатывает sync —
scheduler.spec; порядок хуков sync → snapshots → growth → insights зафиксирован по логу 17.09 09:34:56–09:35:05;
Europe/Moscow — calendarDateIn / rollingWindow / periodBoundsUtc / observationCutoffOf (тесты metrika-dates, scheduler
«21:00 UTC — новый день по Москве»). Ограничения задокументированы: интервал привязан к минуте старта; boot-тик суточный.
```

## OUTBOX

```text
Семантика этапа 06 не менялась. Проверено по коду и спецификациям (565 + 212 строк): транзакционный enqueue при смене
статуса (sourceStatusHistoryId), dedupe (одна строка на переход), строгий порядок внутри заказа (ранняя незакрытая
блокирует позднюю; failed блокирует), FOR UPDATE SKIP LOCKED (два воркера не берут один заказ), расписание 1/5/15/60/360
мин, MAX_ATTEMPTS 20, permanent (400/401/403/валидация) → failed сразу без удаления, requeue/skip оператором, рестарт:
processing > 10 мин → pending, malformed payload → permanent, missing ClientID → skipped (по дизайну этапа 06),
not_configured → повтор через час, рост очереди — лимит 10 за проход. Operational summary: диагностика отдаёт
pending / processing / failed / delivered / skipped / oldestPendingAge / oldestFailedAge (+ OUTBOX_BACKLOG/FAILED/STUCK).
Production 17.09: delivered 11, skipped 43, pending 0, failed 0, processing 0. Historical mass resend не выполнялся и
запрещён runbook-ом.
```

## TRANSACTIONS / IDEMPOTENCY

```text
IDEMPOTENCY_MATRIX.md: 15 операций (backfill, enqueue, отправка outbox, daily/hourly sync, снимки, scheduled/manual
оценка роста, daily/hourly/зависший запуск сигналов, deploy, migrate deploy, retention dry-run/apply) с ожиданием
повтора, защитой от дублей, атомарностью и evidence. Инвариант SUCCESS = committed usable state: замена набора — одна
транзакция (тест «падение транзакции → FAILED, прежние строки целы»); карточки+версии+журнал сигналов — одна транзакция
(«ошибка контекста → FAILED»); версии роста — одна вставка; outbox delivered только после uploading_id.
Production evidence: manual run сразу после daily → created 0 / versioned 0 / unchanged 7 (Stage 12 § 35.7).
NEW: детерминизм overlappingChanges (orderBy startedAt, id) — без него повтор после restore дал бы версии без данных.
```

## RETENTION

```text
Замер production read-only 17.09 14:13: БД 25 МБ; MetrikaSyncRun 1 337 строк (288/сутки), дневные агрегаты ~196 строк/сутки,
AnalyticsInsightRun 24/сутки, снимки ограничены upsert-ом; прогноз без retention ~135 МБ/год (RETENTION_POLICY.md § 2).
Политика: SyncRun SUCCESS 90 д / FAILED+PARTIAL 365 д; InsightRun SUCCESS/SKIPPED/LOCKED 90 д / FAILED 365 д; Outbox
delivered/skipped 180 д; НИКОГДА: MetrikaDaily*, снимки, AnalyticsChange*, AnalyticsInsight/Version, outbox pending/
processing/failed. Реализация: retention-policy.ts, retention.service.ts, CLI analytics:retention (dry-run по умолчанию;
apply только --apply + ANALYTICS_RETENTION_APPLY=1); тесты 5 (детерминизм, отказы без подтверждений, удаление ровно
плана, RUNNING/pending/failed не трогаются). Production DELETE не выполнялся; dry-run на production — после выкладки кода
(план на 17.09 пуст: старейшая строка 12.09). Пресеты дашборда, окна этапов 11–12, lifecycle — не затронуты (данные не удаляются).
```

## BACKUP / RESTORE

```text
Текущая схема: cron 03:00 pg_dump|gzip (14 локальных копий) + Yandex Object Storage (db/, techspec/), premigration-дампы
перед rollout, backup.log. Restore drill 17.09 14:55–15:35 (BACKUP_RESTORE_RUNBOOK.md § 2), НЕ production DB:
1) свежий дамп 831 042 B, 99 CREATE TABLE; 2) временная БД crm_restore_drill; 3) restore 6 с, ERROR 0; 4) миграции 83 = 83,
таблицы 62 = 62, индексы 172 = 172, FK 45 = 45, столбцы diff 0, prisma migrate deploy → No pending, migrate status → up to date;
5) счётчики 24 таблиц равны (OrderPhoto 345, MetrikaSyncRun 1349, BehaviorLanding 1974, AnalyticsInsight 8 …);
6) read-only сверка сервисами production-образа: Stage 09 overview 7d/30d diff 0 (115/116 листьев), Stage 10 issues/
funnels/summary diff 0, Stage 11 changes + оценка A v10 INCOMPARABLE diff 0 (620 листьев), Stage 12 карточки 8=8
payloadHash равны, детекторы 8/8 detected, 49/49 suppressed — различие только в порядке двух пересекающихся изменений
в confounder (→ исправлено, NEW FACT 1); 7) cleanup: обе временные БД удалены, дамп drill удалён, базы crm + postgres.
Runbook § 3: восстановление во временную БД, полное восстановление production (rename БД, без migrate dev), uploads; RPO ≤ 24 ч.
```

## SECRETS

```text
SECRET_FOUND = no. Скан (SECRET_ROTATION_RUNBOOK.md § 1): racpechatca дерево + вся история git — 0 (одно совпадение y0_ —
тестовая фикстура «never_printed»); web-photo дерево + история — 0 production-секретов (dev-compose пароль локального
Postgres ≠ production по sha256); логи 4 контейнеров за 7 дней — 0 (y0_/OAuth/Bearer/JWT/password/JWT_SECRET/DATABASE_URL);
API-ответы и скриншоты — 0; диагностика — 0 по построению. Классы (значения не приводятся): Yandex OAuth token, Yandex
app client secret (на сервере отсутствует, только в кабинете OAuth), JWT secret, DB credentials (CRM и CMS), Telegram,
интеграции партнёра/Avito/Gulian/сайта, S3-ключи бэкапа, SSH-ключ — для каждого owner/location/consumers/rotation/
rollback/verification/downtime. Реальная ротация не выполнялась (отдельный approval). Hardening-факт: sshd
PasswordAuthentication yes при ключевом входе — рекомендация владельцу.
```

## AUTH / PRIVACY

```text
analytics-route-matrix.spec.ts — 9 HTTP-тестов (Nest + supertest, настоящие RolesGuard/InsightsEnabledGuard/ValidationPipe,
JwtAuthGuard подменён заголовком роли): 19 маршрутов этапов 09–13 × {без токена → 401, EXECUTOR → 403, ADMIN OFF → status 200
enabled:false + данные 404 (+ ops 200), ADMIN ON → 200/201, невалидное DTO → 400 с именем поля (customerPhone should not exist),
неизвестный ресурс → 404 без перечисления соседей, DELETE/PUT → 404}. OFF-before-ValidationPipe — этап 12 (guard):
{} / короткий reason / PII-поле / severity=WRONG → 404, сервис не вызывался; этап 11 — флаг в обработчике: валидное тело
→ 404, невалидное → 400 (факт § 9.5 rollout этапа 11, зафиксирован как факт). PII-скан production read-only: 21
аналитическая таблица — phone/email/telegram/ClientID19/yclid/token = 0 (4 «телефона» — UUID с 11 цифрами подряд);
логи 4 контейнеров 7 дней — 0; исключение: nginx access log сайта содержит yclid=<19–20 цифр> (575 строк/7 д, в т. ч. бот
YandexMetrika) и IP — стандартный формат; PII_LEAKS_FOUND = 0 по данным/API/логам приложений; yclid в access log —
P2, rollout 13 (log_format без query или маскирование).
```

## MIGRATIONS

```text
MIGRATION_SAFETY.md: fresh DB migrate deploy — 83 применены (временная БД); production-copy migrate deploy — No pending,
status up to date; schema↔migrations diff — только SalaryPayment.updatedAt default; destructive scan 83 файлов — DROP TABLE/
TRUNCATE/DELETE/ALTER TYPE 0, DROP COLUMN 6 + RENAME 1 в миграциях 06–07.2026 (до аналитики), аналитические миграции —
только CREATE/ADD/INDEX/FK; порядок имён строго возрастает, baseline 20260529230226; compose применяет migrate deploy на
старте, migrate dev/reset/resolve отсутствуют (deploy-safety.spec). Drift R3: происхождение — ручная миграция
20260613 (DEFAULT CURRENT_TIMESTAMP при @updatedAt без @default); реальное состояние production — DEFAULT CURRENT_TIMESTAMP,
NOT NULL; риск функционально нулевой, деплои не ломает; предложен отдельный FIX (ALTER COLUMN … DROP DEFAULT) — не
применялся. Диагностика: DATABASE_MIGRATION_MISMATCH (диск ↔ _prisma_migrations, rolled_back).
```

## CI/CD SAFETY

```text
Acceptance «only explicitly approved production source can publish/deploy production image» (DEPLOYMENT_SAFETY.md § 2):
racpechatca workflow — метки :<sha> всегда; :production и :latest только при github.ref == refs/heads/master (шаг «Метки
образа»); build-args BUILD_SHA, labels revision/source; тесты перед сборкой (как было). web-photo (ветка feature/ci-safety)
— branches [feature/cms-admin]; production-метки только при github.ref == refs/heads/feature/cms-admin; шаг
scripts/ci-safety-check.mjs до build-push: проверяет инварианты и моделирует пуш устаревшей ветки (получит только :<sha>);
на старом production-workflow сайта проверка даёт 9 нарушений (негативный тест выполнен локально). Сервер потребляет
:production (compose + auto-update) → :latest устаревших веток больше не деплоится. Пуш stale-ветки для production-теста
не выполнялся; пуш feature/ci-safety сборок не вызвал (Actions API). GitHub-настройки (branch protection, environment
production с branch policy, удаление устаревших веток) — рекомендации владельцу (DEPLOYMENT_SAFETY.md § 5), не код.
```

## AUTO-UPDATE SAFETY

```text
Root cause R2: /opt/deploy/auto-update.sh (= deploy/auto-update.sh в репо, sha 1219cba1…) выполнял
`docker compose up -d --force-recreate "$svc"` без --no-deps; compose depends_on frontend → backend; при изменившемся env
compose пересоздал backend текущим (старым) образом (17.09 09:21, boot-тик 09:23; та же природа у урока этапа 09).
Исправление в репо: --no-deps на единственной исполняемой строке up; IMAGE_TAG=production по умолчанию; TARGETS фиксируют
порядок api → web, backend → frontend; verify_build сверяет LABEL org.opencontainers.image.revision образа с "build" из
/health контейнера (CRM /health, сайт /api/health; образы без метки — пропуск), расхождение → «ВНИМАНИЕ … работает не та
сборка» и failed++. Инварианты — deploy-safety.spec (6 тестов). На сервере скрипт не менялся (rollout).
```

## BUILD IDENTITY

```text
CRM: Dockerfile.prebuilt ARG BUILD_SHA=unknown → ENV + LABEL org.opencontainers.image.revision; workflow передаёт
github.sha; /health отвечает build (валидный hex, нижний регистр; иначе null). Сайт: было (BUILD_SHA → /api/health build,
на production 812f9cb2…), добавлена метка revision. Reviewer различает работающую сборку без секретов: /health.build ↔
git sha ↔ тег образа :<sha> ↔ LABEL; auto-update сверяет автоматически. Digest образа доступен на сервере (docker image
inspect RepoDigests) — в /health не выводится (внутри контейнера недоступен).
```

## FAILURE-INJECTION F1–F8 (только тесты / копия)

```text
F1 Metrika timeout → sync FAILED, старые данные читаемы, CRM жив: metrika-analytics-sync.service.spec «таймаут/сеть на всех
   наборах → каждый FAILED, итог FAILED, ни одной записи» + клиент G; диагностика: metrikaApi DEGRADED, crmBusiness HEALTHY
F2 429 → success, один committed результат: клиент F (повтор со второй попытки) + sync «idempotency: тот же период дважды»
F3 DB error во время replacement → без partial dataset / ложного SUCCESS: sync «падение транзакции записи → набор FAILED,
   прежние строки не тронуты»
F4 stale RUNNING / смерть процесса → обнаружено + контролируемое восстановление: sync «зависший RUNNING старше часа →
   FAILED»; НОВОЕ insights «висящий RUNNING … старше — закрывается как FAILED и не блокирует (F4)»: FAILED с текстом,
   finishedAt, повтор идемпотентен; диагностика METRIKA_SYNC_STUCK / INSIGHTS_RUN_STUCK
F5 insights fail после успешного sync → sync SUCCESS, insights FAILED, следующий запуск восстанавливает: scheduler.spec
   «хуки после тика: ошибка хука не мешает остальным» + insights «ошибка контекста → FAILED в журнале» + повтор SUCCESS
F6 duplicate scheduler invocation → один writer, второй LOCKED/skipped: sync «lock: два одновременных запуска», scheduler
   «тик во время идущего тика», insights «висящий RUNNING моложе 10 мин → LOCKED без записей»
F7 dashboard metrics throws → явная ошибка, не нули: НОВОЕ analytics-route-matrix «F7»: 500 JSON без данных и без текста
   исключения, следующий запрос 200 (кэш ошибку не хранит)
F8 flag OFF → контрактное поведение, без фоновых записей: матрица (status 200 enabled:false, данные 404, сервисы не
   вызывались), growth-flags.spec (хук не регистрируется), НОВОЕ insights-dashboard.controller.spec «F8: при выключенном
   разделе хук не регистрируется», scheduler.spec «выключенный рубильник — таймеры не ставятся»; production Stage 12 OFF-gate
```

## PERFORMANCE

```text
На копии production (crm_restore_drill, read-only, внутри backend-контейнера) и production read-only:
Stage 09 overview 7d 1,9–2,8 с / 30d 0,5–0,6 с (19 SQL); Stage 10 issues 0,23–0,27 с, funnels 0,12–0,21 с, summary
0,07–0,11 с (25 SQL); Stage 11 getEvaluation мс; Stage 12 buildContext daily 139 SQL 2,2–3,0 с, hourly 4 SQL 0,12 с, feed
3 SQL 54 мс; production run daily (хук) 4,3 с, manual 3,7 с, hourly 35 мс; sync production по журналу: 12 наборов, 23 запроса,
~4–5 с на тик; соединения Postgres: 16 (активных 1) при max_connections 100. Bounded batches: outbox ≤ 10/проход, наборы
по одному, детекторы — константное число SQL (не зависит от заказов/страниц). N+1 не обнаружено (числа SQL константны:
19/25/139/4/3). Индексы: журналы по (status, startedAt) / (dataset, startedAt) / (batchId); AnalyticsInsight по (status,
severity, lastDetectedAt). Оптимизаций не делалось — bottleneck нет; самое долгое — overview 7d ~2 с (cold).
```

## REGRESSION Stage 06–12

```text
Семантика не менялась: Stage 06 (outbox) — код не трогался; Stage 07/08 — не трогались; Stage 09/10 — не трогались;
Stage 11 — overlappingChanges только orderBy (то же множество), evaluate/verdict/статистика без изменений (тесты 47 + 1);
Stage 12 — только закрытие зависших RUNNING при старте run (thresholds, детекторы, контракты не менялись; 63 + F4/F8).
Reconciliation production vs копия (сервисы production-образа): Stage 09/10/11/12 diff 0 (см. BACKUP / RESTORE). Все
прежние тесты зелёные: CRM 1120 / 1120 (104 suites; было 1078 / 99), панель 42 / 42 (без изменений).
```

## TESTS

```text
CRM jest: 1120 / 1120, 104 suites (+42 теста, +5 suites): ops-status.compute.spec 11, ops-dashboard.controller.spec 4,
retention.spec 5, deploy-safety.spec 11, analytics-route-matrix.spec 9 (HTTP), + F4 расширение (service.spec), + F8
(insights controller spec), + overlappingChanges orderBy (growth spec). nest build OK; eslint по новым/изменённым файлам 0
(в старых файлах backfill/metrika-smoke — прежние prettier-замечания, не трогались); prettier по новым файлам чист.
Панель: vitest 42 / 42 (код панели не менялся). web-photo: scripts/ci-safety-check.mjs → OK на новом workflow, 9 нарушений
на старом (негативный тест). Сборка образов не запускалась.
```

## NEW_FACTS

```text
1. Недетерминированный порядок пересекающихся изменений: findMany без orderBy → после restore порядок строк другой →
   текст confounder OVERLAPPING_CHANGE и relatedChangeIds меняются местами → 6 из 8 карточек этапа 12 получили бы новую
   версию без новых данных (обнаружено restore drill). Исправлено (51f27ae); на production порядок совпадает с новым
   (A 12.09 раньше B 14.09) — версий после выкладки не добавится.
2. Зависшие RUNNING сигналов раньше оставались в журнале навечно (не блокировали, но врали); теперь FAILED с текстом.
3. Root cause R2: `up -d --force-recreate <svc>` без --no-deps + depends_on frontend→backend + изменённый env.
4. Root cause R4: workflow из пушнутой ветки; список веток в файле не защищает; защита — метки по github.ref + сервер
   потребляет :production.
5. Drift SalaryPayment.updatedAt: ручная миграция 20260613 с DEFAULT CURRENT_TIMESTAMP при @updatedAt; риск нулевой;
   отдельный FIX предложен.
6. Рост журналов: MetrikaSyncRun 288 строк/сутки (~50 МБ/год), всего аналитика ~135 МБ/год; БД 25 МБ; диск 31 %.
7. Backups: cron 03:00 + Yandex Object Storage (db/ и techspec/), 14 локальных копий; restore до этапа 13 не проверялся —
   теперь проверен (6 с, 0 ошибок, diff 0).
8. Секреты: SECRET_FOUND=no по двум репозиториям (дерево + история), логам, API. Хардening: sshd PasswordAuthentication yes.
9. nginx access log сайта хранит yclid (19–20 цифр) и IP; docker json-file без ротации (объёмы малы).
10. Порядок тиков после recreate привязан к минуте старта (после enable 17.09 — :33); boot-тик всегда суточный
    (lastDailyDate в памяти) — 23 запроса к API при каждом рестарте.
11. Stage 11 при OFF: невалидное тело → 400 (флаг в обработчике) — зафиксировано матрицей как факт.
```

## DEVIATIONS

```text
1. Restore drill и fresh-DB migrate deploy выполнены на боевом сервере Postgres во ВРЕМЕННЫХ базах (crm_restore_drill,
   crm_fresh_drill), затем удалены; production БД только читалась pg_dump-ом; дамп drill удалён из backups/.
2. Read-only сверка сервисами production-образа выполнялась внутри backend-контейнера (docker exec node …) — как в rollout
   этапов 11–12; вспомогательные скрипты из контейнера удалены.
3. Метрики `latest` продолжают публиковаться параллельно с `production` (переходный период) — иначе первый rollout этапа 13
   не смог бы доехать до сервера, пока тот потребляет latest; удаление latest — OPEN DECISION.
4. Диагностика не выведена в UI панели (спецификация требует API; UI — этап 14 по решению Reviewer).
5. Логи Nest остаются текстовыми (component/operation/duration в тексте, структурные поля — в журналах БД); JSON-логгер
   не вводился (не в scope).
6. Retention dry-run на production не запускался (код не выложен); замер сделан SQL read-only; план на текущую дату пуст.
7. Секреты: один тестовый y0_-литерал в spec клиента распознаётся сканером — оставлен (фикстура с текстом never_printed).
8. web-photo: изменения только в ветке feature/ci-safety (workflow + скрипт); nginx-domain.conf, event model — не трогались.
```

## OPEN_DECISIONS

```text
1. Убрать публикацию :latest после rollout этапа 13 (когда оба сервера потребляют :production).
2. GitHub-настройки: branch protection, environment production с branch policy, удаление устаревших веток сайта.
3. Отдельный FIX drift SalaryPayment.updatedAt (ALTER COLUMN DROP DEFAULT).
4. nginx: log_format без query-string / маскирование yclid для сайта; docker log rotation (daemon.json).
5. sshd PasswordAuthentication → no (сервер, владелец).
6. Плановая ротация OAuth-токена Метрики (runbook § 2) — отдельный approval.
7. Retention apply на production и расписание — после dry-run в rollout.
8. lastDailyDate в базе вместо памяти (лишний суточный тик при рестарте) — при частых рестартах.
9. Скан секретов в CI (gitleaks / grep-шаг).
```

## PRODUCTION_UNTOUCHED

```text
master = 1f8b7b4 (проверено git fetch); контейнеры backend d8590e7c9e67 / frontend 1485aa9b3150 не перезапускались (Up 6 h
на момент отчёта); /opt/raspechatka/.env, docker-compose.prod.yml, /opt/deploy/auto-update.sh (sha 1219cba1…), /opt/photo/*
— не редактировались; миграции production не применялись (83), таблиц 62; данные не удалялись и не исправлялись; секреты
не ротировались; failure injection на production не выполнялась; CI-сборок не запускалось (Actions: последний запуск сайта
15.09 18:29, CRM — Stage 12 rollout 17.09 09:21). Временные БД drill удалены (базы: crm, postgres). web-photo
feature/cms-admin = 812f9cb, feature/print-card-lead-form — не трогалась. Stage 14 не начинался.
```
