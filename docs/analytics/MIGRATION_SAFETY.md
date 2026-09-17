# MIGRATION_SAFETY — миграции Prisma и drift (этап 13, раздел 17; R3)

## Статус

```text
Проверено 17.09.2026: fresh DB migrate deploy (83 миграции применены), production-copy migrate deploy («No pending»),
schema↔migrations diff (единственная разница — SalaryPayment.updatedAt default), destructive SQL scan (аналитические
миграции этапов 05–12 — только CREATE/ADD/INDEX), порядок и baseline. Drift не исправлялся; предложен отдельный FIX.
```

## 1. Как миграции применяются в production

- Compose: `command: sh -c "npx prisma migrate deploy && node dist/src/main"` — миграции применяются **на старте контейнера
  backend**, до старта приложения. Ошибка `migrate deploy` → контейнер не стартует → auto-update увидит нездоровый
  контейнер («ВНИМАНИЕ … не поднялся здоровым») и не будет считать обновление успешным; предыдущий образ при этом уже
  остановлен (compose recreate) → **простой до отката**. Правило rollout: перед deploy миграция проверяется на копии.
- Запрещено на production: `prisma migrate dev`, `migrate reset`, `migrate resolve`, ручные правки `_prisma_migrations`
  (закреплено в rollout-планах этапов 07–12 и в `deploy-safety.spec.ts` — compose не содержит этих команд).
- Каталог `prisma/migrations` (83) копируется в образ; диагностика `/analytics/ops/status` сравнивает его с
  `_prisma_migrations` (`DATABASE_MIGRATION_MISMATCH`: не применённые на диске — CRITICAL, применённые, но
  отсутствующие на диске (образ старше базы) — WARNING, `rolled_back_at` — WARNING).

## 2. Проверки 17.09.2026

| Проверка | Как | Результат |
|---|---|---|
| fresh DB migrate deploy | пустая временная БД `crm_fresh_drill` на серверном Postgres, `prisma migrate deploy` кандидата этапа 13 через туннель | «83 migrations found … have been applied» |
| fresh DB schema ↔ migrations | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | exit 2: только `SalaryPayment.updatedAt` default `now()` → нет (§ 6) |
| production-copy migrate deploy | восстановленная копия `crm_restore_drill` (BACKUP_RESTORE_RUNBOOK.md) | «No pending migrations to apply»; `migrate status` → «Database schema is up to date!» |
| production сама | read-only: `_prisma_migrations` 83 applied, `rolled_back_at` 0, последняя `20260916120000_analytics_insights`; таблиц 62 | совпадает с образом d8590e7c9e67 |
| destructive SQL | grep по всем 83 файлам | `DROP TABLE` 0, `TRUNCATE` 0, `DELETE FROM` 0, `ALTER … TYPE` 0; `DROP COLUMN` 6 и `RENAME COLUMN` 1 — все в миграциях 06–07.2026 (`expense_category`, `swap_telegram_username`, `partner_outbound_rework`), до аналитики; в миграциях этапов 05–12 (`2026-08/09`) — только `CREATE TABLE/INDEX`, `ADD COLUMN`, FK и два `ALTER COLUMN … DROP NOT NULL` (salary_bonus, task_local_agents — не аналитика) |
| ordering / baseline | имена `YYYYMMDDHHMMSS_*` строго возрастают (`sort -c`), baseline `20260529230226_format_paper_to_string`, конец `20260916120000_analytics_insights` | порядок детерминирован; `IF EXISTS/IF NOT EXISTS` в 25 файлах |
| очистка | временные БД удалены; production не трогалась | базы на сервере: `crm`, `postgres` |

## 3. Стратегия отката миграций

Аналитические миграции (этапы 07–12) — аддитивные: новые таблицы, индексы, FK между новыми таблицами. Откат кода
(revert в master → auto-update) **не требует** отката схемы: старый код не знает о новых таблицах и не читает их.
Таблицы остаются — безвредно; удалять их — отдельным решением и только после подтверждения владельца. Откат
`_prisma_migrations` руками не делается никогда.

Для будущих миграций правило rollout: (1) `migrate deploy` на восстановленной копии production; (2) grep на
DROP/TRUNCATE/DELETE/ALTER TYPE; (3) деплой сразу после SUCCESS тика; (4) backup compose/.env/pg_dump до deploy.

## 4. Риск «образ старше базы»

Сценарий: откат образа на предыдущий sha после того, как новая миграция применена. `migrate deploy` старого образа
не откатывает — стартует; Prisma-клиент старого образа не знает новых столбцов — работает, если новые столбцы
nullable/с default (наш случай: аналитические таблицы отдельные). Диагностика покажет `unknownMigrations` (WARNING).

## 5. Concurrent deploy + tick

Recreate backend во время синхронизации: процесс умирает → advisory lock снимается с соединением; строка
`MetrikaSyncRun` остаётся RUNNING и закрывается как FAILED через 60 мин следующим запуском; транзакция замены набора
откатывается Postgres — данных набора не портит. Новый контейнер стартует, `migrate deploy` (при новой миграции)
проходит до старта приложения, первый тик через 90 с — суточный (21 день) — пересинхронизирует всё. Правило: деплой
сразу после SUCCESS тика (окно ~58 мин).

## 6. Drift `SalaryPayment.updatedAt` (R3)

**Происхождение.** Миграция `20260613000000_salary_architecture` написана вручную («feat: extend Prisma schema with
salary architecture and safe SQL migration», затем «fix(db): harden salary migration constraints») и объявила
`"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` (строки 104 и 160 файла — две таблицы). В `schema.prisma`
у `SalaryPayment` поле `updatedAt DateTime @updatedAt` без `@default`: Prisma заполняет его сам при create/update, и
для такого поля не генерирует DB-default. Поэтому `prisma migrate diff` (миграции → схема) видит «default изменился
с now() на нет». У второй таблицы разницы нет (там схема содержит `@default(now())`).

**Реальное состояние production:** `information_schema.columns`: `SalaryPayment.updatedAt` — `CURRENT_TIMESTAMP`,
`NOT NULL`. Копия после restore — идентично (diff столбцов 0).

**Риск.** Функционально нулевой: Prisma всегда передаёт `updatedAt` явно; DB-default сработал бы только при вставке
сырым SQL без этого столбца — таких вставок в коде нет. `migrate deploy` drift не проверяет → деплои не ломаются.
Единственный эффект — `prisma migrate dev` (запрещён на production, не используется в CI) предложил бы миграцию
`ALTER COLUMN "updatedAt" DROP DEFAULT`, и любой автоматический drift-check (например, в этапе 14) будет «красным».

**Предложение (отдельный FIX, не «заодно»):** миграция `2026MMDD…_salary_payment_updated_at_default`:
`ALTER TABLE "SalaryPayment" ALTER COLUMN "updatedAt" DROP DEFAULT;` — метаданные, без блокировки данных, обратима
(`SET DEFAULT CURRENT_TIMESTAMP`). Применяется как обычно на старте контейнера. Решение — владелец/Reviewer; до него
`schema ↔ migrations diff` в проверках считать «известное отклонение: SalaryPayment.updatedAt».
