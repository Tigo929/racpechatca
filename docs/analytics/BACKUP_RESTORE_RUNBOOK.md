# BACKUP_RESTORE_RUNBOOK — резервные копии и восстановление CRM (этап 13, раздел 14)

## Статус

```text
Restore drill выполнен 17.09.2026 14:55–15:35 MSK в изолированной временной БД crm_restore_drill на боевом сервере
Postgres (production БД crm только читалась pg_dump-ом; после drill временные БД удалены). Результат — успех:
restore 6 с, ошибок 0, миграции 83 = 83, таблицы 62 = 62, индексы 172 = 172, FK 45 = 45, схема столбцов diff 0,
ключевые счётчики строк равны, сверка этапов 09–12 (сервисы production-образа против копии) diff 0.
```

## 1. Что и как бэкапится сейчас

| Что | Как | Когда | Где хранится | Retention |
|---|---|---|---|---|
| БД `crm` | `/opt/raspechatka/backup-db.sh`: `pg_dump -U crm_user -d crm \| gzip`, проверка размера ≥ 1 КБ | cron `0 3 * * *` (03:00 MSK) | локально `/opt/raspechatka/backups/crm_<ts>.sql.gz`; облако Yandex Object Storage (`raspechatka-backups1`, `db/`) | локально 14 копий; облако — по правилам бакета |
| Том `uploads` (ТЗ-фото) | выгрузка в тот же бакет (`techspec/`, 546 файлов 17.09) | ежедневно | облако | — |
| Pre-migration дампы | тот же `pg_dump \| gzip`, имя `premigration_<stage>_<ts>.sql.gz`, запись в `backup.log` | перед каждым rollout (этапы 07–12) | локально | вручную |
| compose / .env | копии `*.bak-stage<N>-<ts>` рядом | перед каждым rollout | `/opt/raspechatka/` | вручную |

Лог: `/opt/raspechatka/backups/backup.log` («OK облако db/crm_20260917_030001.sql.gz», «OK облако techspec/ (546 файлов)»).
Размер дампа: ~0,8 МБ (99 CREATE TABLE в дампе, 62 таблицы в `public`).

## 2. Restore drill 17.09.2026 — evidence (шаги спецификации 1–7)

```text
1. свежий дамп production:  drill_stage13_20260917_145511.sql.gz — 831 042 B, CREATE TABLE 99, 1 с, заголовок
                            «PostgreSQL database dump» читается
2. изолированная БД:        create database crm_restore_drill (базы: crm, crm_restore_drill, postgres)
3. restore:                 zcat | psql -d crm_restore_drill -v ON_ERROR_STOP=0 → 6 с, строк ERROR: 0
4. схема / миграции:        _prisma_migrations 83 = 83 (последняя 20260916120000_analytics_insights, rolled_back 0);
                            таблиц 62 = 62; индексов 172 = 172; FK 45 = 45; information_schema.columns
                            (имя:тип:default) diff 0 строк
                            prisma migrate deploy (кандидат этапа 13) против копии → «No pending migrations to apply»;
                            prisma migrate status → «Database schema is up to date!»
5. ключевые счётчики:       User 5=5, OrderPhoto 345=345, Task 71=71, SalaryPayment 12=12, GulianOutbox 58=58,
                            MetrikaOrderOutbox 54=54, MetrikaSyncRun 1349=1349, 12 таблиц MetrikaDaily* равны
                            (Traffic 36, Goal 756, Source 121, Landing 141, BehaviorDevice 1078, BehaviorLanding 1974,
                            VisitParam 374, PathPage 454 …), MetrikaPeriodSnapshot 39=39, MetrikaPeriodGoalSnapshot 336=336,
                            AnalyticsChange 2=2, AnalyticsChangeEvaluation 10=10, AnalyticsInsight 8=8,
                            AnalyticsInsightVersion 8=8, AnalyticsInsightRun 7=7
6. сверка этапов 09–12:     сервисы production-образа (dist) против обеих баз, только чтение:
                            Stage 09 overview 7d / 30d — 115 / 116 листьев, diff 0, 19 SQL;
                            Stage 10 issues / funnels / summary 7d — 43 / 343 / 105 листьев, diff 0, 25 SQL;
                            Stage 11 changes 72 листа diff 0, оценка A v10 INCOMPARABLE = v10 INCOMPARABLE, 620 листьев diff 0;
                            Stage 12 карточки 8 = 8, payloadHash равны; runDetectors(ctx) на обеих базах: detected 8/8,
                            suppressed 49/49; канонические нагрузки различались у 6 карточек ТОЛЬКО порядком перечисления
                            двух пересекающихся изменений в confounder OVERLAPPING_CHANGE (физический порядок строк после
                            restore) → исправлено в коде этапа 13 (orderBy startedAt, id) — NEW FACT
7. cleanup:                 drop database crm_restore_drill, crm_fresh_drill; drill-дамп удалён; базы: crm, postgres;
                            production: 83 миграции, 62 таблицы, контейнеры не перезапускались
```

Отдельно проверено «fresh DB»: пустая `crm_fresh_drill` + `prisma migrate deploy` кандидата → 83 миграции применены;
`migrate diff` против schema.prisma → единственная разница `SalaryPayment.updatedAt` default (MIGRATION_SAFETY.md).

## 3. Процедура восстановления (runbook)

### 3.1 Восстановление во временную БД (проверка / разбор инцидента) — без остановки CRM

```bash
F=/opt/raspechatka/backups/<dump>.sql.gz
docker exec raspechatka-postgres-1 psql -U crm_user -d postgres -c 'create database crm_restore_check'
zcat "$F" | docker exec -i raspechatka-postgres-1 psql -U crm_user -d crm_restore_check -q -v ON_ERROR_STOP=0 2>&1 | grep -c '^ERROR'   # ожидание 0
docker exec raspechatka-postgres-1 psql -U crm_user -d crm_restore_check -tAc 'select count(*) from _prisma_migrations'  # = числу миграций образа
# … проверки § 2 п. 4–6 …
docker exec raspechatka-postgres-1 psql -U crm_user -d postgres -c 'drop database crm_restore_check'
```

### 3.2 Полное восстановление production (только при потере/порче данных, решение владельца)

1. Остановить запись: `docker compose -f docker-compose.prod.yml stop backend` (сайт и панель отдадут 502 на API — это
   ожидаемо; nginx жив). Отключать синхронизацию Метрики отдельно не нужно — она в backend.
2. Снять дамп текущего состояния «как есть» (`premigration_<incident>_<ts>.sql.gz`) — даже повреждённого.
3. Выбрать дамп для восстановления (локальный или из облака: `aws --profile yandex --endpoint-url https://storage.yandexcloud.net s3 cp s3://raspechatka-backups1/db/<file> .`).
4. Восстановить сначала во временную БД (§ 3.1) и убедиться: 0 ошибок, миграции = образу, счётчики правдоподобны.
5. Переключить: `alter database crm rename to crm_broken_<ts>; alter database crm_restore_check rename to crm;`
   (внутри `psql -d postgres`; активные соединения предварительно завершить `pg_terminate_backend`). Старую базу
   не удалять до подтверждения владельца.
6. `docker compose up -d --no-deps backend` → на старте `prisma migrate deploy` → «No pending» (если образ новее дампа —
   применит недостающие миграции: это штатно). Проверить `/health`, `/analytics/ops/status` (миграции = диску,
   `DATABASE_MIGRATION_MISMATCH` нет), заказы в панели.
7. Аналитика после restore: следующий тик пересинхронизирует 21 день (boot-тик суточный) — дневные агрегаты за период
   восстановятся из Метрики; карточки этапа 12 пересчитаются (dedupe по отпечатку); журналы — из дампа.
8. Записать инцидент: причина, дамп, время простоя, что потеряно (данные между дампом и остановкой).

Запрещено при восстановлении: `prisma migrate dev`, `migrate reset`, `migrate resolve`, ручные правки `_prisma_migrations`.

### 3.3 Uploads (ТЗ-фото)

Восстановить из бакета `techspec/` в том `raspechatka_uploads` (`/var/lib/docker/volumes/raspechatka_uploads/_data`);
права владельца файлов — как у контейнера backend.

## 4. Проверки, которые стоит автоматизировать (предложение)

- еженедельный drill § 3.1 по cron с проверкой «0 ERROR, миграции = образу, счётчики ≥ вчерашних» и записью в `backup.log`;
- контроль возраста последнего облачного бэкапа (сейчас — только строка OK в логе): условие `BACKUP_STALE` в диагностике —
  кандидат на этап 14.

## 5. RPO / RTO (фактические)

- RPO: до 24 ч (дамп 03:00) для CRM-данных; аналитические агрегаты Метрики восстанавливаются синхронизацией (21 день) —
  потери нет; журналы синхронизации/сигналов между дампом и сбоем теряются (не критично).
- RTO: restore 0,8 МБ — секунды; полная процедура § 3.2 с проверками — ~15–30 мин ручной работы.
