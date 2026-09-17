# INCIDENT_RUNBOOK — операционные условия аналитики и действия оператора (этап 13, разделы 5–6, 21–22)

## Статус

```text
Условия вычисляет GET /analytics/ops/status (ADMIN-only, только Postgres и окружение, без секретов/PII). Пороги —
OPS_THRESHOLDS (crm-new/src/analytics/ops/ops-status.compute.ts) и отдаются в ответе (`thresholds`). Деловые сигналы
этапа 12 сюда не входят — это отдельная лента. Реализовано 17.09.2026, production — после rollout этапа 13.
```

## 1. Словарь состояний подсистем

`HEALTHY` — работает и свежо · `DEGRADED` — работает с оговоркой (backlog, отставание, миграции неизвестны базе) ·
`STALE` — работает, но данные старше порога · `FAILED` — последний запуск/ответ неудачен или процесс завис ·
`DISABLED` — выключено флагом или не настроено (не ошибка) · `RECOVERING` — после FAILED идёт новый запуск.

Подсистемы: `crmBusiness`, `database`, `metrikaApi`, `metrikaOrdersOutbox`, `metrikaAnalyticsSync`, `periodSnapshots`,
`behaviorAnalytics`, `growthEvaluations`, `automatedInsights`, `analyticsDashboard`. Инвариант: отказ Метрики никогда
не делает `crmBusiness` не-HEALTHY (единственный FAILED для него — недоступная база).

## 2. Условия

| Код | Порог / источник | Severity | Что означает | Действие оператора |
|---|---|---|---|---|
| `DATABASE_UNAVAILABLE` | `SELECT 1` не выполняется | CRITICAL | база недоступна — это уже CRM-инцидент | контейнер postgres, диск, `docker logs raspechatka-postgres-1`; аналитика вторична |
| `DATABASE_MIGRATION_MISMATCH` | миграции на диске не применены (CRITICAL) / применённые отсутствуют на диске или rolled_back (WARNING) | CRITICAL / WARNING | образ и база разной версии | не запускать `migrate dev/resolve`; сверить образ (build в /health) и `_prisma_migrations`; MIGRATION_SAFETY.md |
| `METRIKA_NOT_CONFIGURED` | нет счётчика/токена | WARNING | синхронизация и очередь ждут | задать переменные, пересоздать backend `--no-deps` |
| `METRIKA_SYNC_FAILED` | последний завершённый запуск FAILED/PARTIAL | WARNING; CRITICAL если данным > 6 ч | Метрика ответила ошибкой или набор не записался | класс ошибки в `sync.lastError`: unauthorized/forbidden → SECRET_ROTATION_RUNBOOK; rate_limited/server/timeout → ждать следующего тика; other → `MetrikaSyncRun.lastError` |
| `METRIKA_SYNC_STALE` | нет SUCCESS > 2 ч (WARNING) / > 6 ч (CRITICAL) при включённом флаге | WARNING / CRITICAL | планировщик молчит или Метрика недоступна | лог «scheduler:hourly»; `MetrikaSyncRun` за последний час; при отсутствии тиков — рестарт backend в окне (rollout-процедура) |
| `METRIKA_SYNC_STUCK` | RUNNING > 60 мин | CRITICAL | процесс умер посреди синхронизации | ничего не удалять: следующий запуск закроет строку как FAILED; если запусков нет — см. STALE |
| `SNAPSHOT_STALE` | снимки пресетов старше 2 ч | WARNING | тики идут, а снимки нет | лог `MetrikaPeriodSnapshotService`; дашборд читает агрегаты, пресетные снимки — вспомогательные |
| `OUTBOX_FAILED` | failed > 0 | WARNING | переходы заказов не ушли в Метрику; failed блокирует поздние переходы того же заказа | `npm run metrika:orders:status`; после устранения — `requeue`; осознанно — `skip`; массовый resend запрещён |
| `OUTBOX_BACKLOG` | pending > 50 или старейшая pending > 2 ч при включённой отправке | WARNING | воркер не успевает / Метрика отвечает 429/5xx | лог воркера (каждые 30 с); ждать расписания повторов |
| `OUTBOX_STUCK` | processing > 10 мин | WARNING | воркер умер посреди запроса | воркер вернёт строку в pending сам; если нет — backend не запущен |
| `GROWTH_RUN_FAILED` | есть ACTIVE-изменения, автооценки нет > 26 ч | WARNING | хук роста не отработал | лог «Рост: автооценка», ошибки хука; ручная оценка через панель не заменяет scheduled |
| `INSIGHTS_RUN_FAILED` | последний запуск FAILED | WARNING | движок сигналов упал | `AnalyticsInsightRun.errors` (санитизировано в ответе); синхронизация не пострадала; следующий тик повторит |
| `INSIGHTS_RUN_STUCK` | RUNNING > 10 мин | WARNING | процесс умер во время запуска | следующий запуск закроет как FAILED и продолжит |

Порядок в ответе: CRITICAL первыми, внутри уровня — по коду. Условия детерминированы: тот же снимок базы → тот же список.

## 3. Ручные действия и их границы (раздел 22)

| Действие | Кто | Ограничение | Аудит |
|---|---|---|---|
| `POST /analytics/dashboard/insights/run` | ADMIN | назначение — controlled rollout / сверка; замок RUNNING ≤ 10 мин + флаг процесса → параллельный вызов даёт строку `LOCKED`, не второй пересчёт; объём ограничен контекстом (~140 SQL, ~4 с); UI-кнопки нет | строка `AnalyticsInsightRun kind=manual` |
| `POST …/insights/:id/acknowledge`, `resolve` | ADMIN | DTO whitelist; причина 3–300 символов; повтор → 400 | статусы/`resolvedReason` в карточке |
| `POST …/growth/changes/:id/evaluate` | ADMIN | новая версия `manual` (аудит) | версия |
| `metrika:orders` requeue/skip | оператор (CLI на сервере) | по одной строке / заказу; массовый resend запрещён | `lastError`, статус |
| retention apply | оператор | только rollout, `--apply` + `ANALYTICS_RETENTION_APPLY=1` | вывод команды в отчёт |

HTTP: HTTPS через nginx фронтенда; helmet (HSTS, nosniff, frame-options); CORS по списку origins; `trust proxy 1`;
ValidationPipe whitelist + forbidNonWhitelisted; стандартные тела ошибок Nest без stack trace (проверено F7 и на
production: stack-trace строк в логе 0). Поверхность методов аналитики — только GET/POST/PATCH (DELETE/PUT → 404).

## 4. Логи: что искать

| Событие | Строка |
|---|---|
| тик | `Метрика: синхронизация <from>..<to> (scheduler:hourly|daily) — SUCCESS|PARTIAL|FAILED, наборов N, запросов N, строк N` |
| зависшие | `Метрика: N зависших запусков закрыты как FAILED`; `Сигналы: N зависших запусков закрыты как FAILED` |
| хуки | `Рост: автооценка — изменений N, запросов снимков окон N, ошибок N`; `Сигналы: запуск daily|hourly|manual — обнаружено …, ошибок N` |
| ошибка хука | `Метрика: хук после тика «insights:run» завершился ошибкой — …` (тик остаётся SUCCESS) |
| очередь | `Метрика: заказ <id> <status> — окончательная ошибка …` / доставки |
| выкладка | `/var/log/auto-update.log`: `Обновляю …`, `Готово …`, `Сборка подтверждена …`, `ВНИМАНИЕ …` |

Структурные поля (component / operation / runId / status / durationMs / attempt / errorClass) присутствуют в журналах
БД (`MetrikaSyncRun`, `AnalyticsInsightRun`, `MetrikaOrderOutbox`) и в текстах лога Nest (компонент в скобках, операция,
статус, длительность у клиента Метрики); переход на JSON-логгер — не в scope этапа 13 (предложение для этапа 14).
