# 13 — RELIABILITY & SECURITY

## 0. STATUS
```text
STAGE = 13_RELIABILITY_SECURITY
STATUS = TODO
PRODUCTION_CHANGE = FORBIDDEN_UNTIL_REVIEWER_ROLLOUT_GATE
NEXT_STAGE = 14_FINAL_ACCEPTANCE
```

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
