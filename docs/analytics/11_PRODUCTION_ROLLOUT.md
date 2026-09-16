# 11_PRODUCTION_ROLLOUT.md

## STATUS

```text
REVIEW — technical rollout выполнен 15.09.2026 23:10–23:23 MSK по команде Reviewer «СТАРТ» (кандидат 0c3b84a,
fast-forward до docs-only потомка 5922175): раздел выложен выключенным (23:13, миграция на старте контейнера, 59 таблиц),
OFF-gate пройден (§ 9; отклонение § 9.5 — 400 от ValidationPipe до проверки флага, записей 0), controlled enable 23:17:35,
изменения A (деплой 12.09) и B (инцидент 14–15.09) зарегистрированы реальными датами, сверка A = B = C diff 0, версии
неизменяемы, лок первичной метрики, контракт наблюдательности без нарушений, тест 12.09 = INCOMPARABLE (не +88,9 %),
инцидент = OVERLAPPING_CHANGE, P&L = /reports/weekly diff 0, PII 0, cold evaluate 2,23 с, 13 автоматических циклов
(00:17…12:17 16.09) SUCCESS, Stage 06/09/10 diff 0. Остановка на owner-smoke gate (§ 27). Отчёт — § 35. Production после
отчёта не менялся; DONE ставит Reviewer после owner smoke.
```

## STAGE

**11 — Growth & Experiments / Production Rollout**

## PURPOSE

Безопасно вывести в production реестр изменений и наблюдательные оценки «до / после»
(`11_GROWTH_AND_EXPERIMENTS.md` § 31) так, чтобы:

- ничего не сломать в работающих этапах 06 / 07–08 / 09 / 10;
- раздел появился **выключенным** и включался отдельным контролируемым шагом;
- каждая цифра, показанная руководителю, была сверена тремя способами на боевых данных;
- система ни на одном шаге не назвала наблюдательную разницу доказанным эффектом.

В rollout входит: backend `GrowthModule` (реестр, оценка, API под двумя флагами, хук после тика
расписания), миграция `20260915130000_analytics_change_registry`, вкладка панели «Рост / Изменения»,
строка флага в серверном compose, документация. Регистрируются только **реальные** события
(деплой 12.09, инцидент 14–15.09, по желанию владельца — правка шапки 15.09); искусственные заявки,
заказы, оплаты и «тестовые изменения» в production не создаются.

В rollout **не входит** (§ 30): назначение вариантов A/B, изменения event model `web-photo`,
Logs API, G2–G5 этапа 10, правки workflow сайта (§ 31 — только фиксация долга и предложение схемы).

---

## 1. REVIEWER VERDICT BEFORE START

Implementation: `READY_FOR_PRODUCTION_ROLLOUT` (Reviewer, 15.09.2026).
Этот план: `READY_FOR_REVIEW` → Reviewer подтверждает план **и кандидата § 2**.
Production меняется только после отдельной команды `СТАРТ`. До неё — ни одного шага из § 4 и далее.

---

## 2. EXPECTED GIT STATE (требование 1)

```text
CRM repo racpechatca
production master (до rollout):     3ac9be8  (коммиты владельца 15.09: Telegram-темы, локальные агенты)
reviewed implementation HEAD:       8d10b7c  (Stage 11 backend + панель + docs § 31)
rollout candidate (код):            0c3b84a  = 8d10b7c + FIX_00 (свой флаг ANALYTICS_GROWTH_ENABLED)
fast-forward до:                    docs-only потомка 0c3b84a на feature (этот план и его правки; код тот же —
                                    проверять `git diff --stat 0c3b84a..<tip> -- . ':!docs'` = пусто)
ветка:                              feature/analytics-foundation (master ⊂ feature, fast-forward возможен)
```

Коммиты `3ac9be8..0c3b84a` (все — исполнитель; неожиданных owner-коммитов нет):

| Коммит | Что | Область |
|---|---|---|
| 5b3d9fb, bf9bb62, c78fac7 | Stage 10 FIX_01 rollout — только docs (§ 22–23); выложенный код b04681f уже в master | `docs/analytics/` |
| 51f850d | спецификация Stage 11 от Reviewer как получена | `docs/analytics/11_*.md` |
| 41be79b | backend: `crm-new/src/analytics/growth/*`, schema + миграция, хук `registerAfterSync`, `app.module.ts` +2 строки | crm-new |
| e2583cb | панель: `types/growth.ts`, `api/analytics.ts`, `features/analytics/growth-*`, `pages/AnalyticsPage.tsx` | frontend |
| 70f4aab | merge `origin/master` 3ac9be8 → feature (без конфликтов, 1012 тестов) | — |
| 5328917 | правила после сверки: SHORT_WINDOW, оговорки по заявленным метрикам, меньше загрузок заказов | growth |
| 8d10b7c | docs: § 31 отчёт, GROWTH_DATA_CONTRACT, GROWTH_STATISTICS, § 11b, скриншоты | docs |
| 0c3b84a | FIX_00: `growth-flags.ts`, гейт хука в `growth.module.ts`, строка compose-шаблона, текст вкладки, 3 теста | growth, compose, frontend |
| df276fb… | этот план и правки docs после него — только `docs/analytics/` | docs |

Изменённые **существующие** файлы (`git diff --diff-filter=M 3ac9be8..0c3b84a`; 17 удалённых строк — все в docs):
`prisma/schema.prisma` (+79, только новые модели), `app.module.ts` (+2), `metrika-analytics-scheduler.service.ts`
(+24, 0 удалений — хук), `metrika-analytics.module.ts` (экспорт сервиса), `frontend/src/api/analytics.ts` (+21),
`AnalyticsPage.tsx` (+4/−1 — вкладка), `docker-compose.prod.yml` (+4 — строка флага), docs.

Pre-deploy git gate (STOP при любом отклонении):

1. `git fetch origin` → `origin/master` = `3ac9be8`; если появились новые owner-коммиты — STOP: merge в feature,
   полный прогон тестов, новый кандидат, повторный review;
2. `git merge-base --is-ancestor origin/master <candidate>` = true (fast-forward);
3. `git log --oneline origin/master..<candidate>` совпадает с таблицей выше — ни одного лишнего коммита;
4. `git diff --stat origin/master..<candidate>` — файлы только из перечисленных областей; никаких правок
   `web-photo`, `.env`, nginx, `auto-update.sh`, сервисов этапов 06/09/10 (кроме хука расписания);
5. clean worktree, никаких force push, `master` пушится один раз fast-forward.

Web: `web-photo` этим rollout не меняется (event model, workflow, ветки — § 30, § 31).

---

## 3. BUILD / TEST GATE (перед push)

- `prisma validate`; `prisma migrate diff --from-migrations --to-schema-datamodel` — пусто (schema = миграции);
- CRM jest полностью (эталон на кандидате: **1015 / 1015, 94 suites**), в т. ч. `src/analytics/growth` (47) и
  `metrika-analytics-scheduler.service.spec` (хук);
- панель vitest (**35 / 35**), `tsc -b`, `vite build`; `nest build`; eslint growth = 0, prettier чист;
- зафиксировать BEFORE: последний SUCCESS тик расписания и `MetrikaSyncRun` за 24 ч (SUCCESS/FAILED/RUNNING), число
  снимков `MetrikaPeriodSnapshot`, Stage 06 outbox pending/failed, JSON `/analytics/dashboard/status`,
  `/analytics/dashboard/overview?period=30d`, `/behavior/issues?period=7d` (для § 9 и § 26).

---

## 4. BACKUPS (требование 2) — первый шаг после «СТАРТ»

```text
cp /opt/raspechatka/docker-compose.prod.yml /opt/raspechatka/docker-compose.prod.yml.bak-stage11-$(date +%Y%m%d-%H%M)
cp /opt/raspechatka/.env                    /opt/raspechatka/.env.bak-stage11-$(date +%Y%m%d-%H%M)
docker exec raspechatka-postgres-1 pg_dump -U crm_user -d crm -Fc -f /var/lib/postgresql/data/crm-pre-stage11-$(date +%Y%m%d-%H%M).dump
```

Проверить размер dump > 0 и что `pg_restore --list` читает заголовок. Секреты не выводить; в отчёт — только имена
файлов и размеры. Backup делается **до** правки compose (§ 6) и до deploy (§ 8).

---

## 5. MIGRATION REVIEW (требование 3)

`crm-new/prisma/migrations/20260915130000_analytics_change_registry/migration.sql` — 60 строк:

```text
CREATE TABLE  "AnalyticsChange"                (реестр: name, description, status, changeType, startedAt, endedAt,
                                                deploymentRef, surface, audienceDefinition JSONB, primaryMetric,
                                                secondaryMetrics JSONB, expectedDirection, hypothesis, maturityDays,
                                                evaluationDays, primaryLockedAt, createdAt, updatedAt)
CREATE TABLE  "AnalyticsChangeEvaluation"      (версии: changeId, version, evaluatedAt, trigger, observationCutoff,
                                                beforeFrom/To, afterFrom/To DATE, metricVersion, primaryMetric,
                                                verdict, maturity, result JSONB, flags JSONB, lastSyncRunId)
CREATE INDEX  "AnalyticsChange_status_startedAt_idx"
CREATE INDEX  "AnalyticsChangeEvaluation_changeId_evaluatedAt_idx"
CREATE UNIQUE INDEX "AnalyticsChangeEvaluation_changeId_version_key"
ALTER TABLE   "AnalyticsChangeEvaluation" ADD CONSTRAINT …_changeId_fkey FOREIGN KEY → "AnalyticsChange"(id)
              ON DELETE CASCADE ON UPDATE CASCADE
DROP / TRUNCATE / DELETE / UPDATE / RENAME / ALTER существующих таблиц — 0
```

Gate: в файле нет ни одной существующей таблицы (Order*, Metrika*, Behavior*, User*…); единственный `ALTER TABLE` —
FK на новой таблице; `grep -ciE "^(drop|truncate|delete|update|alter table \"(order|metrika|user|task|expense))"` = 0.
Миграция применяется **на старте контейнера** штатным `prisma migrate deploy` (как этапы 07–10); `migrate dev`,
`migrate resolve`, ручные правки `_prisma_migrations` запрещены. На боевой базе до rollout: таблиц `AnalyticsChange*`
0, строк миграции 0 (проверено 15.09 ~21:25 MSK).

После deploy: `select migration_name, finished_at, rolled_back_at from _prisma_migrations order by finished_at desc
limit 3` → `20260915130000_…` с `finished_at`, `rolled_back_at` null; таблиц 2 (пустых), индексов 3 + 2 PK, FK 1;
число таблиц `public` = 57 + 2 = **59**.

---

## 6. FEATURE FLAG — выкатываем выключенным (требование 4)

Общий `ANALYTICS_DASHBOARD_ENABLED` в бою = true (этапы 09–10), поэтому у раздела свой флаг (FIX_00):

```text
ANALYTICS_GROWTH_ENABLED  (default false; crm-new/src/analytics/growth/growth-flags.ts)
  выключен → GET /analytics/dashboard/growth/status → { enabled: false, … }; остальные маршруты роста — 404;
             вкладка «Рост / Изменения» → «Раздел «Рост / Изменения» выключен»;
             GrowthModule.onModuleInit: хук расписания НЕ регистрируется (лог «выключен … хук не подключён»)
  включён  → только при обоих флагах (общий дашборда И свой)
```

Шаг перед deploy (после backup § 4); серверный compose редактируется руками, как на этапе 09:

```text
# /opt/raspechatka/docker-compose.prod.yml → backend.environment, строкой после ANALYTICS_DASHBOARD_ENABLED:
      ANALYTICS_GROWTH_ENABLED: ${ANALYTICS_GROWTH_ENABLED:-false}
docker compose -f docker-compose.prod.yml config | grep ANALYTICS_GROWTH_ENABLED   → "false"
```

`.env` на этом шаге не трогать (переменной нет → default false). Compose-правку делать непосредственно перед deploy
(урок этапа 09: изменившийся env пересоздаёт backend старым образом при следующем `up`).

---

## 7. SCHEDULER WINDOW

Stage 11 не добавляет наборов и не меняет расписание; при выключенном флаге хук не подключён. Флаги
`YANDEX_METRIKA_*` не менять. Deploy начинать сразу после SUCCESS часового тика (:31 каждого часа по логам этапа 10),
убедившись `select count(*) from "MetrikaSyncRun" where status = 'RUNNING'` = 0 — тогда пересоздание backend не
оборвёт запуск. Окно упущено — ждать следующего тика, а не выключать расписание.

---

## 8. MERGE / DEPLOY CODE

1. `git checkout master && git merge --ff-only <candidate> && git push origin master` — один push, без force;
2. GitHub Actions «Сборка образов» → SUCCESS (~3 мин); `/opt/deploy/auto-update.sh` (таймер, каждую минуту) тянет
   образы и пересоздаёт backend + frontend; следить по `/var/log/auto-update.log`;
3. проверить: новые image id backend/frontend; `docker ps` — оба `healthy`; boot-лог backend: `prisma migrate deploy`
   → 1 migration applied; строка `[GrowthModule] Раздел «Рост / Изменения» выключен (ANALYTICS_GROWTH_ENABLED): хук
   расписания не подключён`; ошибок Nest 0;
4. nginx: префикс `/analytics/` уже в обоих белых списках (sslip-хост из образа, домен из `nginx-photo.conf`) — новых
   префиксов нет; `curl -s -o /dev/null -w '%{http_code}' https://raspechatkaa.ru/api/analytics/dashboard/growth/status`
   без токена → **401 JSON** (не HTML) на обоих хостах;
5. если compose пересоздал и другие сервисы из-за зависимостей — зафиксировать, проверить health, ошибкой не считать.

---

## 9. DISABLED-STATE CHECKS (требование 5) — сразу после deploy, флаг OFF

Временный ADMIN JWT подписывается **внутри контейнера** (`process.env.JWT_SECRET`, `expiresIn: 5m`) и в лог/отчёт не
попадает; EXECUTOR-токен — так же с ролью EXECUTOR.

| # | Запрос | Ожидание |
|---|---|---|
| 1 | без токена `GET …/growth/status`, `GET …/growth/changes` | 401 |
| 2 | EXECUTOR `GET …/growth/changes`, `POST …/growth/changes` | 403 |
| 3 | ADMIN `GET …/growth/status` | 200, `enabled: false`, `abCapability: NO_VARIANT_ASSIGNMENT`, каталог 21 метрики |
| 4 | ADMIN `GET …/growth/changes`, `POST …/growth/changes` (валидное тело), `GET …/changes/x/evaluations/latest` | **404** «Раздел аналитики выключен»; сервис не вызывался — в БД 0 строк |
| 5 | ADMIN `POST …/growth/changes` с телом `{}` | 404 (флаг проверяется раньше валидации); 400 появится только после включения |
| 6 | Stage 09 `GET /analytics/dashboard/status`, `overview?period=30d`; Stage 10 `/behavior/summary`, `/behavior/issues` | 200, числа = BEFORE (§ 3) |
| 7 | панель `/crm/analytics?tab=growth` | карточка «Раздел «Рост / Изменения» выключен»; остальные вкладки как прежде |
| 8 | ближайший тик расписания | SUCCESS; в логе нет `growth:evaluate`; дублей `MetrikaSyncRun` 0 |

Все 8 обязательны до § 10.

---

## 10. CONTROLLED ENABLE (требование 6)

```text
cp /opt/raspechatka/.env /opt/raspechatka/.env.bak-stage11-enable-$(date +%Y%m%d-%H%M)
echo 'ANALYTICS_GROWTH_ENABLED=true' >> /opt/raspechatka/.env
cd /opt/raspechatka && docker compose -f docker-compose.prod.yml config | grep ANALYTICS_GROWTH_ENABLED   → "true"
docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps backend
```

Проверить: backend healthy; boot-лог `[GrowthModule] Раздел «Рост / Изменения» включён: хук расписания подключён`;
`status.enabled = true`; `GET …/growth/changes` → `[]`; `POST …/growth/changes` `{}` → **400** со списком ошибок;
с лишним полем `customerPhone` → 400 `property customerPhone should not exist`; EXECUTOR → 403; без токена → 401.
Включение — в окне после SUCCESS тика (§ 7).

---

## 11. РЕГИСТРАЦИЯ РЕАЛЬНЫХ ИЗМЕНЕНИЙ (искусственных данных нет)

Регистрирует исполнитель через API от имени ADMIN (или владелец через форму — по его выбору). Все три — реальные
события сайта с реальными датами:

| # | Изменение | Поля |
|---|---|---|
| A | Деплой `web-photo` 12.09.2026 13:19 MSK — единый `lead_submitted`, заявка ≠ покупка, first-touch (этап 04) | `changeType SITE`, `surface site:forms`, `startedAt 2026-09-12T10:19:00Z`, `deploymentRef d9a6488 / cb2dd96`, `primaryMetric siteLeadRate`, `secondaryMetrics [visits, formStarts, crmLeads]`, `expectedDirection INCREASE`, `evaluationDays 7`, `status ACTIVE` |
| B | **Инцидент** 14.09 18:20 → 15.09 20:32 MSK — сайт работал на августовском коде (пуш устаревшей ветки перезаписал `latest`) | `changeType SITE`, `surface site:rollback-incident`, `startedAt 2026-09-14T15:20:00Z`, `endedAt 2026-09-15T17:32:00Z`, `deploymentRef 8a9b33c → cc9bc89`, `primaryMetric visits`, `expectedDirection NEUTRAL`, `hypothesis «не исследуемое изменение: граница данных / confounder для всех окон, пересекающих период»`, `status COMPLETED` |
| C | (по желанию владельца) правка шапки 15.09 21:38 MSK — «Холсты» без выпадающего меню (`812f9cb`) | `SITE`, `surface site:header`, `primaryMetric visits` или `formStarts`, `NEUTRAL`, `ACTIVE` |

Точные границы B — из `/var/log/auto-update.log` (пересоздание `photo-web-1` 14.09 ~18:20 и 15.09 20:32 MSK); в отчёт
— с точностью до минуты. Никаких изменений с выдуманными датами и метриками «для теста».

---

## 12. PRODUCTION RECONCILIATION (требование 7): API = service = SQL

Скрипт `stage11/recon.js` (использованный на копии) запускается **внутри backend-контейнера** против `dist/` (тот же
образ, та же база; пишет только сами оценки):

```text
A  HTTP     POST …/changes/{A}/evaluate; GET …/changes; GET …/changes/{A}/evaluations/latest
B  service  AnalyticsGrowthService (dist, PrismaClient контейнера): listChanges / getEvaluation на тех же строках;
            evaluate — сравнивать B на ТОЙ ЖЕ сохранённой версии, а не на новой (иначе evaluatedAt разойдётся)
C  SQL      реестр: "AnalyticsChange" / "AnalyticsChangeEvaluation" ↔ поля API 1:1;
            окна: visits = Σ MetrikaDailyTraffic.visits по датам окна; siteLeads = Σ MetrikaDailyGoal(lead_submitted);
            formStarts — form_started; formErrors — form_error; устройства — MetrikaDailyBehaviorDevice;
            источники — MetrikaDailySource; когорты crmLeads / acceptedOrders / paidOrders —
            Overview.crmFunnel.cohorts этапа 08 за те же даты (сверен с SQL в 08_PRODUCTION_ROLLOUT);
            periodUsers — MetrikaPeriodSnapshot по точным датам окна или null
```

Gate: A = B по всем листьям JSON (diff 0); A = C по каждому числу (visits, siteLeads, rate, formStarts, crmLeads,
acceptedOrders, periodUsers) diff 0. Любая разница — STOP.

---

## 13. IMMUTABLE VERSIONS (требование 8) и PRIMARY LOCK (требование 9)

1. A: `POST evaluate` → v1 (сохранить JSON целиком); повторный `POST evaluate` → v2; `GET …/evaluations/1` =
   сохранённый v1 байт в байт (`result`, `flags`, `verdict`, `windows`, `evaluatedAt`); `GET …/evaluations/latest` =
   v2; `GET …/evaluations` → `[v1, v2]`; в БД `count(*) where changeId = A` = 2, `unique(changeId, version)` цел;
2. `PATCH …/changes/{A}` `{ primaryMetric: 'visits' }` → **400** «зафиксирована первой оценкой»;
   `{ expectedDirection: 'DECREASE' }` → 400; `{ description: '…' }` → 200; `primaryLockedAt` заполнен;
   `primaryMetric` в БД не изменился;
3. если зарегистрировано C: до его первой оценки `PATCH primaryMetric` → 200 — фиксация происходит именно первой
   оценкой, а не при создании.

---

## 14. OBSERVATIONAL CONTRACT (требование 10)

По каждой сохранённой оценке (A v1/v2, B, C) и по `status`:

```text
evidenceType   == "OBSERVATIONAL_BEFORE_AFTER"           во всех оценках
causality      == "NOT_ESTABLISHED"                       во всех оценках
abCapability   == "NO_VARIANT_ASSIGNMENT"                 в status и в оценках
disclaimer     присутствует, содержит «не доказывает»
тексты FACT / INTERPRETATION / RECOMMENDATION: grep -iE "доказан|доказыва|причин[аы]|благодаря|привел[оа] к|вызвал" = 0
UI: плашка NO_VARIANT_ASSIGNMENT и дисклеймер видны; заголовок карточки — вердикт, а не процент
```

Любое нарушение — STOP (это дефект, а не настройка).

---

## 15. VERDICT GATES (требование 11)

На дату rollout T (не ранее 16.09) для A после cutover доступны полные дни 13.09 … T−1:

| Проверка | Ожидание |
|---|---|
| `siteLeadRate` (primary A) | `INCOMPARABLE`: `METRIC_UNAVAILABLE_BEFORE` + `MEASUREMENT_DEFINITION_CHANGED` (единый lead_submitted с 12.09); процент прироста — не заголовок |
| `visits` (secondary A), T < 20.09 | `INSUFFICIENT_DATA` с `SHORT_WINDOW` (< 7 дней, текст «короче недели»), `WEEKDAY_MIX_MISMATCH`, `OVERLAPPING_CHANGE [B]`, MDE словами, `requiredSample` |
| `visits`, T ≥ 20.09 (13–19.09 vs 05–11.09) | вердикт по статистике, но обязательно `OVERLAPPING_CHANGE [B]` и упоминание инцидента в INTERPRETATION (§ 17) |
| `crmLeads` (secondary; scope CRM для SITE) | `scopeCompatibility: context_only` → блок «Контекст» с подписью «контекст описывает бизнес, а не эффект изменения»; в вердикт не входит |
| `leadToPaidRate` / `paidOrders` (если добавлены) | `IMMATURE` до `after.to + maturity(paid)`; `maturityUntil` в будущем |
| MDE / sample gate | `statistics.mde`, `relativeMde`, `requiredSample` заполнены; `NO_CLEAR_CHANGE` только при `relativeMde ≤ 20 %` — при 25–50 визитах/день ожидаемо `INSUFFICIENT_DATA` |
| `WEEKDAY_MIX_MISMATCH` | есть у любого окна не из целых недель; нет у 7/14-дневных |
| B как изменение | `INSUFFICIENT_DATA` (после-окно ≤ 1 день до `endedAt`), `AFTER_WINDOW_TRUNCATED_BY_END`, `SHORT_WINDOW` |

Пороги `growth-rules.ts` на бою не подстраиваются: другой вердикт — факт в отчёт, не правка констант.

---

## 16. PRODUCTION TEST: изменение 12.09.2026 13:19 MSK (требование 12)

Ожидание для A на любой T:

```text
verdict.primary   = INCOMPARABLE           (не POSITIVE_SIGNAL)
primary.before    = 3,92 % (2/51) по данным до 12.09 — показано приглушённо, подпись «не является выводом»
primary.after     = 7,41 % (2/27) на окне 13–14.09 (при T = 16.09 — свои числа за 13–15.09)
relativeChange    = +88,9 % есть в данных, но UI — «разница не оценивается»; FACT — числа с оговоркой;
                    INTERPRETATION — причины несопоставимости; RECOMMENDATION — сравнивать только окна после 12.09
                    и когда появится сопоставимое окно
```

Gate: `verdict != POSITIVE_SIGNAL && headlineIsDelta == false && confounders ∋ MEASUREMENT_DEFINITION_CHANGED`.
Скриншот вкладки для A → `screenshots/11_growth/prod-incomparable.png` (без PII).

---

## 17. ИНЦИДЕНТ 14.09 18:20 → 15.09 20:32 MSK КАК CHANGE BOUNDARY (требование 13)

Факт: ~26 часов сайт отдавал августовскую сборку — без единого `lead_submitted`, без first-touch и правок этапа 04;
счётчик Метрики получал события старой модели. Следствия:

1. поведенческие цели за вечер 14.09 и 15.09 до 20:32 **неполные** — `siteLeads`, `formStarts`, `siteLeadRate` за
   эти дни занижены не по вине аудитории; `visits` корректны (счётчик работал);
2. любое окно, пересекающее 14.09 18:20–15.09 20:32, нельзя читать как чистое влияние исследуемого изменения.

Меры в rollout:

- регистрация B (§ 11) со `status COMPLETED` → механизм пересечений автоматически даёт `OVERLAPPING_CHANGE [B]` всем
  оценкам, чьи окна затрагивают период (проверить на A: after-окно 13–14.09 / 13–19.09 → флаг есть, id B в списке);
- запись факта в `01_CURRENT_STATE.md` § 5j и `GROWTH_DATA_CONTRACT.md` как известного confounder с точными границами;
- **OPEN DECISION для Reviewer** (код в этом rollout не меняется): добавить ли в каталог метрик `definitionCutovers`
  для поведенческих метрик на 2026-09-14/15 — тогда окна, пересекающие инцидент, станут `INCOMPARABLE` формально, а не
  через оговорку. Предложение исполнителя — да, отдельным FIX после rollout.

---

## 18. MATURITY (требование 14)

`GET …/growth/status → maturityPolicy` на боевых lifecycles: ожидаемо `accepted` p90 ≈ 1 день (n ≥ 20, empirical),
`paid` — 14 дней по умолчанию с `MATURITY_HISTORY_INSUFFICIENT`, если пар «заявка → оплата» < 20 (на копии 15.09 так).
Проверки на оценке с CRM-метриками (A: `crmLeads`; по желанию владельца — `acceptedOrders`, `leadToPaidRate`,
`paidOrders`, `paidOrderValue`, `realizedRevenue`, `netProfit` в контексте):

| Класс | Ожидание на T |
|---|---|
| immediate (visits, siteLeads, form*) | `MATURE` всегда |
| accepted (acceptedOrders, leadToAcceptedRate, matchedAccepted) | `MATURE`, если T−1 ≥ after.to + 1 день; иначе `IMMATURE` с `maturityUntil` |
| paid (paidOrders, leadToPaidRate, paidAov, paidOrderValue, matchedPaid) | `IMMATURE` / `PARTIALLY_MATURE` до after.to + 14 дн.; вердикт `IMMATURE`, даже если разница велика |
| revenue / profit (realizedRevenue, netProfit — контекст для SITE) | показаны как контекст; `COGS_INCOMPLETE` → `INSUFFICIENT_DATA`; прибыль не «растёт» на неполных расходах |

Когорты — по дате заявки/принятия в окне с исходами до конца дня наблюдения (не календарные оплаты): `crmLeads` /
`acceptedOrders` A = `Overview.crmFunnel.cohorts` за те же даты (§ 12 C).

---

## 19. SITE LEADS ≠ CRM ORDERS (требование 15)

- `siteLeads` (цель `lead_submitted` Метрики) и `crmLeads` (заказы CRM по дате заявки — сайт, Avito, звонки,
  мессенджеры) — разные строки с разными подписями; `siteLeadRate = siteLeads / visits`, никогда `crmLeads / visits`;
- для `changeType SITE` любая CRM-метрика — `context_only` (JSON `scopeCompatibility` и раздел «Контекст» в UI);
  CRM-метрика как первичная для SITE даёт `METRIC_SCOPE_MISMATCH → INCOMPARABLE` (проверено тестами и на копии; на
  бою искусственное изменение ради этого не регистрировать — достаточно контекста A);
- FACT называет источник каждого числа («заявок с сайта по Метрике», «заказов в CRM по дате заявки»).

---

## 20. CLIENTID COVERAGE GATE (требование 16)

`matchedAccepted`, `matchedAcceptedRate`, `matchedPaid` (`availableFrom 2026-09-13`): у A окно «до» раньше 13.09 →
`METRIC_UNAVAILABLE_BEFORE → INCOMPARABLE`, если добавлены; для окон целиком после 13.09 — гейт покрытия:
`clientIdCoverageAccepted` за окно < 50 % → `MATCHED_COVERAGE_LOW → INSUFFICIENT_DATA`, `value` показан, вывода нет.
Доля покрытия = `GET /analytics/dashboard/overview?from&to` (attribution) — одно и то же число.

---

## 21. COGS / P&L RECONCILIATION (требование 17)

`realizedRevenue`, `netProfit`, `contractValue`, `paidOrderValue` в контексте A за окна до/после = `GET
/analytics/dashboard/overview?from=…&to=…` (канонические метрики этапа 08, сверенные с `/reports/*` в
`08_PRODUCTION_ROLLOUT.md`) — diff 0; если окно совпадает с целой отчётной неделей — дополнительно
`GET /reports/weekly?year&month` (realized / cogs / net по неделе) — diff 0. `COGS_INCOMPLETE` обязан появиться,
если в окне есть выполненные заказы без себестоимости (SQL: заказы окна с пустым COGS > 0 ⇔ флаг). Прибыль без флага
при неполных расходах — STOP.

---

## 22. EXACT PERIOD SNAPSHOTS (требование 18)

- до первого тика после включения: `periodUsers.before/after = null` + `UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW`;
  сумма дневных уникальных нигде не выдаётся за уникальных периода (grep JSON: `periodUsers` null или из снимка);
- после тика с хуком: `MetrikaPeriodSnapshot` получает строки `preset = null` с `periodStart/periodEnd` = окна A/B/C;
  запросов к Метрике ≤ 4 на изменение (2 окна × 2 отчёта); лог хука `{ evaluated, snapshotRequests, errors: 0 }`;
  на следующем тике для устоявшихся окон `snapshotRequests = 0`;
- новая оценка (v3 A) показывает `periodUsers` из снимка: значения ≤ Σ дневных `users` и равны
  `select users from "MetrikaPeriodSnapshot" where "periodStart" = … and "periodEnd" = …`.

---

## 23. SCHEDULER afterSync (требование 19)

| Проверка | Ожидание |
|---|---|
| тик сразу после включения (нового полного дня нет) | хук выполнен: `evaluated: 0`, `snapshotRequests ≤ 4·N`, `errors: 0`; новых версий 0 |
| первый тик нового московского дня (00:31) | `evaluated` = число ACTIVE (A, C); у каждого +1 версия `trigger: 'scheduled'`, `lastSyncRunId` = id тика; ровно одна версия на изменение: `count(*) group by changeId, observationCutoff` ≤ 1 (дублей нет) |
| второй автоматический цикл | тик SUCCESS; повторной оценки без нового дня нет; новых снимков окон 0 |
| гонки | advisory lock 700701 расписания покрывает хук; ручной `POST evaluate` во время тика даёт отдельную версию `manual`; `unique(changeId, version)` — 0 ошибок в логе |
| сбой хука | тик остаётся SUCCESS (юнит-тест); в бою — лог `growth:evaluate` без stack trace |

Минимум **два** успешных автоматических цикла после включения до owner smoke; `FAILED` = 0, зависших `RUNNING` 0.

---

## 24. PERFORMANCE на production (требование 20)

Внутри контейнера (`curl -w '%{time_total}'` на localhost:3000), cold — сразу после recreate:

| Запрос | Цель |
|---|---|
| `POST …/changes/{A}/evaluate` cold / warm | ≤ 3,0 с / ≤ 2,0 с (копия через туннель RTT 122 мс: 2,2–2,7 с; в бою БД в соседнем контейнере) |
| `GET …/growth/status` | ≤ 1,0 с |
| `GET …/growth/changes` | ≤ 0,5 с |
| `GET …/evaluations/latest` | ≤ 0,3 с |
| Stage 09 `overview?period=30d` после deploy | как BEFORE ± 10 % |

N+1: `pg_stat_statements` в бою нет → число запросов оценки — из копии (76, постоянное, не зависит от числа заказов);
в бою — `pg_stat_database.tup_returned` до/после одной оценки: прирост порядка десятков тысяч строк, не миллионов;
повторная оценка — тот же прирост (±5 %). Live Metrika API из запросов дашборда: во время всех HTTP-проб лог клиента
Метрики пуст — обращения только в тике расписания (§ 22). Превышение 3 с cold — NEW FACT + OPEN DECISION (оптимизация
отдельным FIX); превышение 10 с — STOP.

---

## 25. PRIVACY (требование 21)

```sql
select id, name, description, hypothesis, surface, "audienceDefinition" from "AnalyticsChange";
select "result"::text, "flags"::text from "AnalyticsChangeEvaluation";
```

Regex по тексту: телефоны `\+?7\d{10}|8\d{10}`, e-mail, `@username`, 19-значные ClientID, выборочно 5 фамилий
клиентов из `OrderPhoto` → **0** совпадений (даты и хвосты float — ложные, как на копии; отмечать явно). Тексты A/B/C —
внутренние описания без имён клиентов. API JSON (`changes`, `latest`) и UI-скриншоты — тот же regex → 0. Логи backend
за rollout — без токенов/паролей (grep `Bearer`, `JWT_SECRET`, `password` = 0).

---

## 26. REGRESSION Stage 06 / 09 / 10 (требование 22)

| Этап | Проверка | Ожидание |
|---|---|---|
| 06 | outbox pending/failed до/после; последний успешный push заказов в Метрику | pending не растёт, failed = BEFORE, worker шлёт |
| 07/08 | тики SUCCESS каждый час, снимки пресетов 16 на тик | как до rollout |
| 09 | `/analytics/dashboard/status`, `overview`, `trend`, `sources` — 200, числа = BEFORE за тот же период | diff 0 |
| 10 | `/behavior/summary`, `funnels`, `issues` 7d/30d — 200; `skipped` с `PARTIAL_BEHAVIOR_PERIOD` (FIX_01) на месте | diff 0 с BEFORE |
| UI | вкладки «Обзор / Источники / Товары / Страницы / Поведение» без ошибок консоли; новая вкладка не ломает ширину 390 px | скриншоты |
| CRM | заказы, задачи, Telegram-темы владельца (3ac9be8) работают — backend один и тот же | health, лог без ошибок |

---

## 27. OWNER SMOKE (требование 23)

Владелец, `/crm/analytics → Рост / Изменения`:

1. видит плашку «наблюдательное сравнение, вариантов A/B нет» и дисклеймер;
2. в списке — A «деплой форм 12.09» с вердиктом «Окна несопоставимы» (не «+88,9 %»), B «инцидент 14–15.09» как
   завершённое, C — если регистрировал;
3. открывает A: окна с исключённым днём 12.09, до → после, ФАКТ / ИНТЕРПРЕТАЦИЯ / ЧТО ДЕЛАТЬ понятны без глоссария,
   оговорки перечислены (в т. ч. инцидент), версии v1…vN, «Оценить сейчас» даёт новую версию;
4. форма: регистрирует своё реальное изменение или отменяет — поля понятны, московское время, метрики другой области
   подписаны «только контекст»;
5. телефон 390 px — без горизонтальной прокрутки.

Результат владелец фиксирует сам («OWNER SMOKE STAGE 11 ПРОЙДЕН» / замечания); исполнитель записывает в отчёт § 33.

---

## 28. STOP CONDITIONS (требование 24)

Немедленно STOP, ничего дальше не менять, отчёт Reviewer:

- git: `origin/master ≠ 3ac9be8`, лишние коммиты в диапазоне, fast-forward невозможен;
- миграция: любой DROP/ALTER существующих таблиц; `_prisma_migrations` с ошибкой или `rolled_back_at`; таблиц ≠ 59;
- backend не healthy 5 минут после пересоздания; ошибки Nest при старте; `GrowthModule` не залогировал состояние;
- при OFF: любой маршрут роста, кроме `status`, отвечает не 404; хук присутствует в логе;
- auth: 200 без токена или для EXECUTOR на любом маршруте роста;
- reconciliation: A ≠ B или A ≠ C хотя бы по одному числу;
- версия v1 изменилась после v2; PATCH первичной метрики после оценки прошёл;
- `causality ≠ NOT_ESTABLISHED`, `evidenceType ≠ OBSERVATIONAL_BEFORE_AFTER`, тексты с «доказано / причина»;
- A получило `POSITIVE_SIGNAL`, или дельта стала заголовком при INCOMPARABLE / INSUFFICIENT_DATA / IMMATURE;
- прибыль без `COGS_INCOMPLETE` при неполных расходах; `periodUsers` = сумма дневных;
- тик FAILED / дубли `MetrikaSyncRun` / две версии за один `observationCutoff` / зависший RUNNING;
- числа Stage 06/09/10 ≠ BEFORE; outbox failed растёт;
- PII в реестре / оценках / API / UI; секрет в логе или отчёте;
- evaluate > 10 с, или запросы к Метрике из HTTP-запросов дашборда.

---

## 29. ROLLBACK (без деструктивного отката БД)

```text
уровень 1 — выключить раздел:  ANALYTICS_GROWTH_ENABLED=false в .env (или удалить строку) →
                                docker compose up -d --force-recreate --no-deps backend → status.enabled = false,
                                хук не подключён; таблицы и оценки остаются — безвредны, никто их не читает
уровень 2 — откатить код:      revert коммитов диапазона в master (docs можно оставить) → push → auto-update;
                                таблицы AnalyticsChange* остаются — их НЕ дропать; compose-строка флага безвредна;
                                «prisma migrate resolve» не применять
уровень 3 — compose / .env:    восстановить из .bak-stage11-* только если правка сломала запуск контейнера
DB restore из dump § 4:        только при повреждении данных, не связанном со Stage 11 (миграция существующие таблицы
                                не трогает); решение и выполнение — владелец по своему процессу
```

Ни один уровень не удаляет строк из существующих таблиц и не правит `_prisma_migrations` руками.

---

## 30. A/B И WEB-PHOTO (требование 25)

- назначения вариантов (`variant assignment`), событий экспозиции, `experimentId / variantId` в `web-photo` в этом
  rollout **нет**; все оценки — `OBSERVATIONAL_BEFORE_AFTER`, `abCapability: NO_VARIANT_ASSIGNMENT`;
- event model `web-photo` (события, цели Метрики, параметры визитов, `lead_submitted`) **не меняется**; сборка сайта
  этим rollout не запускается. Правка шапки 15.09 (`812f9cb`, «Холсты» без выпадающего меню) — отдельная просьба
  владельца, выполнена вне Stage 11 и событий не меняет; для аналитики это кандидат C § 11;
- будущий контракт A/B — отдельная спецификация Reviewer (`GROWTH_DATA_CONTRACT.md`, раздел A/B gate).

---

## 31. CI SAFETY DEBT — production `latest` сайта из feature-ветки

**Проблема (инцидент 14.09 18:17 → 15.09 20:32 MSK).** В `web-photo` workflow `.github/workflows/build-images.yml`
собирает и публикует `ghcr.io/tigo929/web-photo-{web,api}:latest` на push в ветки из списка `on.push.branches`
**того файла, который лежит в пушнутой ветке**. Устаревшая ветка `feature/print-card-lead-form` (август) перечисляет
саму себя → её пуш («отправить всё на origin») пересобрал `latest` из августовского кода, а `/opt/deploy/auto-update.sh`
(каждую минуту тянет `latest`) выложил его на сайт. Ни merge, ни review, ни явного деплоя не было. Восстановлено
пересборкой из production-ветки `feature/cms-admin` (`cc9bc89`). Текущий список в `feature/cms-admin`:
`[main, feature/yandex-yml-feed, feature/canvas-section, feature/cms-admin]` — три из четырёх веток не production;
`main` сайта устарел с 21.08.

**В рамках Stage 11 workflow и ветки не менять** (отдельное решение Reviewer). Предлагаемая безопасная схема:

```text
1. :latest публикуется только из одной разрешённой production-ветки
     on.push.branches: [feature/cms-admin]   (или переименовать production-ветку в `production` и защитить её)
     шаг тегов: `latest` — только при github.ref == refs/heads/<production-ветка>; иначе публиковать лишь
     :<sha> и :<branch> (или не публиковать вовсе) — feature-ветка физически не может задеть боевой тег
2. Разорвать «пушнутая ветка решает сама»: production-сборка — отдельный workflow с `workflow_dispatch` +
   `environment: production` (required reviewer = владелец) или, минимум, защита production-ветки
   (запрет force push, только PR) — тогда старый файл workflow в чужой ветке не имеет права на `latest`
3. auto-update.sh: тянуть не плавающий `latest`, а тег/digest, записанный владельцем (`/opt/deploy/site-release`),
   и после пересоздания сверять `/api/health → build` с ожидаемым sha; расхождение — откат к предыдущему digest
   и уведомление в Telegram (отправка отчётов у владельца уже есть — 3ac9be8)
4. Гигиена: удалить на origin устаревшие ветки, чей workflow перечисляет их самих (feature/print-card-lead-form; при
   подтверждении — feature/yandex-yml-feed, feature/canvas-section); `main` либо синхронизировать с production-веткой,
   либо перестать считать его production
5. Для аналитики: любой такой откат — событие реестра Stage 11 (как B § 11) с точными границами, чтобы окна,
   пересекающие его, автоматически получали OVERLAPPING_CHANGE
```

Долг зафиксирован также в `01_CURRENT_STATE.md` § 5j; исполнение — после решения Reviewer и команды владельца.

---

## 32. ACCEPTANCE GATE

Rollout выполнен со стороны исполнителя, когда:

1. § 2–3 пройдены; master = кандидат; образы новые; health OK; миграция применена (59 таблиц);
2. § 9 (OFF) — 8/8; § 10 (enable) — все проверки; § 11 — A и B зарегистрированы реальными датами;
3. § 12 diff 0; § 13 версии / лок; § 14 контракт; § 15–16 вердикты и тест 12.09; § 17 инцидент как confounder;
   § 18–22 maturity / scope / coverage / P&L / snapshots;
4. § 23 — минимум два успешных автоматических цикла; § 24 perf в цели или NEW FACT; § 25 PII = 0; § 26 регрессий 0;
5. § 27 owner smoke пройден владельцем;
6. § 33 отчёт записан; DONE ставит Reviewer.

---

## 33. EXECUTOR_REPORT_STAGE11_ROLLOUT — формат

```text
RESULT (DONE_PENDING_REVIEW | BLOCKED | ROLLED_BACK)
GIT / DEPLOY          master до/после, кандидат, образы, время MSK
BACKUPS               имена файлов, размеры — без содержимого
MIGRATION             строки _prisma_migrations, таблиц 59, объекты
FLAG OFF CHECKS       § 9, 8 пунктов
ENABLE                § 10: время, лог модуля
REGISTRY              A / B / C — id, даты, поля
RECONCILIATION        A = B, A = C — числа и diff
VERSIONS / LOCK       § 13
OBSERVATIONAL CONTRACT § 14
VERDICTS              § 15–16, таблица факт / ожидание
INCIDENT BOUNDARY     § 17
MATURITY / SCOPE / COVERAGE / P&L / SNAPSHOTS   § 18–22
SCHEDULER             тики, хук, версии, дубли
PERFORMANCE           cold / warm, tup_returned, Metrika calls = 0
PRIVACY               § 25
REGRESSION 06/09/10   § 26
OWNER SMOKE           запись владельца
NEW FACTS / DEVIATIONS / OPEN DECISIONS
```

---

## 34. START COMMAND

Rollout начинается только после отдельной команды Reviewer:

`СТАРТ`

с указанием подтверждённого кандидата (`0c3b84a` с FIX_00 или иное решение по флагу). До команды production не
менять; этот документ — план, не отчёт.

---

# 35. EXECUTOR_REPORT_STAGE11_PRODUCTION_ROLLOUT — 15–16.09.2026

## RESULT

```text
DONE_PENDING_REVIEW — technical rollout выполнен 15.09.2026 23:10–23:23 MSK (техническая часть), контроль автоциклов до 16.09 13:18 MSK по команде Reviewer «СТАРТ»
(кандидат 0c3b84a, fast-forward до docs-only потомка 5922175). Раздел выложен ВЫКЛЮЧЕННЫМ (23:13), OFF-gate пройден,
controlled enable 23:17:35; изменения A (деплой 12.09) и B (инцидент 14–15.09) зарегистрированы реальными датами;
сверка A = B = C diff 0; версии неизменяемы; лок первичной метрики работает; контракт наблюдательности без нарушений;
тест 12.09: 3,92 % → 7,41 % (+88,9 %) = INCOMPARABLE, не POSITIVE_SIGNAL; инцидент — OVERLAPPING_CHANGE; P&L = /reports/weekly
diff 0; PII 0; cold evaluate 2,23 с; автоматических циклов после включения: 13 (00:17…12:17 MSK 16.09) (все SUCCESS, хук без ошибок);
Stage 06/09/10 без регрессий (diff 0). Остановка на owner-smoke gate (§ 27). Production после этого отчёта не менялся.
Отклонения от плана — § 35.20 (главное: § 9.5 — при выключенном флаге POST с невалидным телом даёт 400 от ValidationPipe
раньше проверки флага; данных не раскрывает, записей не создаёт; не трактовано как STOP — решение за Reviewer).
```

## 1. GIT / DEPLOY

```text
origin/master до:      3ac9be8 (проверено 22:2x и повторно перед push 23:10 — новых owner-коммитов нет)
кандидат:              0c3b84a (код) → fast-forward до 5922175 (docs-only: план § 2 + правка § 2); diff 0c3b84a..5922175 -- ':!docs' = пусто
диапазон:              3ac9be8..5922175 = 12 коммитов исполнителя, как в § 2 (5b3d9fb, bf9bb62, c78fac7, 51f850d, 41be79b, e2583cb,
                       70f4aab, 5328917, 8d10b7c, 0c3b84a, df276fb, 5922175); области файлов — только перечисленные в § 2
gate § 3:              prisma validate OK; CRM jest 1015/1015 (94 suites); панель 35/35; nest build, tsc -b, vite build OK; eslint growth 0
push master:           15.09 23:10:16 MSK (fast-forward, без force); GitHub Actions «Сборка образов» → образы созданы 23:12:17 MSK
auto-update:           23:12:55 «Обновляю backend» f8fa6cdfccfe → 191f27494fbc, 23:13:27 «Готово: backend обновлён и здоров»;
                       23:13:32 «Обновляю frontend» 960bfeb81987 → 5022f7ad3030, 23:14:05 «Готово», nginx перечитан 23:14:05
health:                backend running:healthy 23:13:27, frontend running:healthy 23:14:06; ошибок деплоя 0; побочных пересозданий нет
                       (frontend не пересоздавал backend — env backend уже совпадал с compose)
nginx:                 оба хоста → 401 JSON без токена на /analytics/dashboard/growth/status (raspechatkaa.ru и 195-2-75-249.sslip.io);
                       новых префиксов не требовалось (/analytics/ в обоих белых списках с этапа 09)
```

## 2. BACKUPS (§ 4)

```text
compose:  /opt/raspechatka/docker-compose.prod.yml.bak-stage11-20260915-2226 (173 строки)
.env:     /opt/raspechatka/.env.bak-stage11-20260915-2226 (50 строк; содержимое не выводилось)
          /opt/raspechatka/.env.bak-stage11-enable-20260915-2317 (50 строк — перед включением флага)
DB:       /opt/raspechatka/backups/premigration_stage11_growth_20260915_222656.sql.gz — 744 159 байт, 94 CREATE TABLE в дампе,
          заголовок «PostgreSQL database dump» читается, запись в backups/backup.log (процесс backup-db.sh: pg_dump | gzip + размер)
```

## 3. MIGRATION (§ 5)

```text
файл:      20260915130000_analytics_change_registry/migration.sql — 60 строк: CREATE TABLE 2, CREATE INDEX 2, CREATE UNIQUE INDEX 1,
           ALTER TABLE 1 (FK на новой таблице, ON DELETE CASCADE); DROP/TRUNCATE/DELETE/UPDATE/RENAME 0; существующих таблиц в файле 0
предпроверка порядка (22:3x): на временной БД crm_stage11_mig из свежего дампа с ТЕКУЩИМ production-образом
           `prisma migrate deploy` применил 20260915130000 после уже применённых 20260915170000/173000 владельца
           («82 migrations found», 1 applied) → 59 таблиц; временная БД удалена; production не тронут (AnalyticsChange* = 0)
production: применена на старте контейнера 23:13:13 MSK (лог: «Applying migration 20260915130000_analytics_change_registry …
           All migrations have been successfully applied»); _prisma_migrations: applied 82, rolled_back_at null
объекты:   таблиц public 59 (было 57); AnalyticsChange + AnalyticsChangeEvaluation (0 строк на момент деплоя); индексов 5 (3 + 2 PK); FK 1
повторный старт 23:17 (enable): «No pending migrations to apply»
```

## 4. FLAG OFF CHECKS (§ 9) — 23:14–23:16 MSK, ANALYTICS_GROWTH_ENABLED не задан → false

```text
compose (§ 6, 22:29): + ANALYTICS_GROWTH_ENABLED: ${ANALYTICS_GROWTH_ENABLED:-false}; `compose config` → "false"; .env не менялся
boot-лог 23:13:19:  [GrowthModule] Раздел «Рост / Изменения» выключен (ANALYTICS_GROWTH_ENABLED): хук расписания не подключён
env в контейнере:   dashboard=true growth=false analytics_sync=true orders_sync=true
1 без токена:       GET status → 401, GET changes → 401                                                        ✓
2 EXECUTOR:         GET changes → 403 «Недостаточно прав», POST changes → 403                                    ✓
3 ADMIN status:     200, enabled=false, abCapability NO_VARIANT_ASSIGNMENT, evidenceTypes [OBSERVATIONAL_BEFORE_AFTER],
                    metrics 21, counts {DRAFT 0, ACTIVE 0, COMPLETED 0, CANCELLED 0}                              ✓
4 ADMIN при OFF:    GET changes → 404 «Раздел аналитики выключен»; POST валидное тело → 404; GET …/evaluations/latest → 404;
                    AnalyticsChange строк после проб 0                                                              ✓
5 ADMIN POST {}:    → 400 (10 ошибок валидации), НЕ 404 — ValidationPipe отрабатывает до проверки флага в методе;
                    записей 0, данных раздела не раскрывает                                                    ✗ ожидание плана (DEVIATION 1)
6 Stage 09/10 JSON: status / overview 30d / overview 7d / behavior summary 7d / issues 7d / issues 30d / funnels 7d —
                    BEFORE (22:25) vs AFTER (23:15): листьев 14/214/214/109/69/69/346, diffs 0 (без volatile-полей)   ✓
7 UI (replay production-JSON в сборке кандидата): вкладка «Рост / Изменения» → карточка «Раздел «Рост / Изменения» выключен»,
                    запросов к growth-маршрутам кроме status нет; вкладки Обзор / Поведение рендерятся без ошибок
                    (скриншот screenshots/11_growth/off-growth-disabled.png)                                        ✓
8 тик при OFF:      23:14:50–23:15:05 (scheduler:daily 26.08–15.09, первый тик после старта) — 12/12 SUCCESS, снимки 8/8,
                    строк «growth:evaluate»/«автооценка» в логе 0; дублей MetrikaSyncRun 0; RUNNING 0                ✓
```

## 5. ENABLE (§ 10)

```text
23:17: .env + ANALYTICS_GROWTH_ENABLED=true (51 строка; backup .env.bak-stage11-enable-20260915-2317); compose config → "true"
       RUNNING sync runs = 0 (окно после тика 23:15) → docker compose up -d --force-recreate --no-deps backend 23:17:10 →
       healthy 23:17:38 (image 191f27494fbc, тот же); frontend не пересоздавался; nginx reload ok
boot-лог 23:17:35: [GrowthModule] Раздел «Рост / Изменения» включён: хук расписания подключён; «No pending migrations»
пробы (23:17:55): status enabled=true; без токена 401; EXECUTOR GET/POST 403; ADMIN POST {} → 400 (10 ошибок);
       ADMIN POST с customerPhone → 400 «property customerPhone should not exist»; строк после проб 0
```

## 6. REGISTRY (§ 11) — только реальные события

```text
B  28b7033d-4136-400a-81c7-260112e9244d «Инцидент 14.09 18:20 → 15.09 20:32: сайт работал на августовской сборке»
   SITE / site:rollback-incident / startedAt 2026-09-14T15:20Z (18:20 MSK) / endedAt 2026-09-15T17:32Z (20:32 MSK) /
   deploymentRef «web-photo latest ← 8a9b33c (август) → cc9bc89» / primary visits, secondary [siteLeads, formStarts] / NEUTRAL /
   status COMPLETED / hypothesis «не исследуемое изменение: граница данных / confounder…»; cutoverDay 2026-09-14
A  222c1b8e-4c7f-428c-9383-3c3805b4f324 «Деплой сайта 12.09: единый lead_submitted, заявка ≠ покупка, first-touch (этап 04)»
   SITE / site:forms / startedAt 2026-09-12T10:19Z (13:19 MSK) / deploymentRef «web-photo d9a6488 / cb2dd96 …» /
   primary siteLeadRate, secondary [visits, formStarts, crmLeads, acceptedOrders, leadToPaidRate, paidOrders, netProfit] /
   INCREASE / evaluationDays 7 / ACTIVE; cutoverDay 2026-09-12; PATCH description до первой оценки → 200
C  не регистрировалось (по желанию владельца; § 11)
Границы B — из /var/log/auto-update.log (14.09 18:20 пересоздание photo-web-1 из августовского образа; 15.09 20:32 восстановление cc9bc89).
```

## 7. RECONCILIATION (§ 12) — изменение A, 23:17:58 MSK (observationCutoff 14.09 = вчера по Москве)

```text
окна:      before 10–11.09.2026, after 13–14.09.2026 (2 дня; день изменения 12.09 исключён), flags [EXCLUDED_CUTOVER_DAY, SHORT_WINDOW, WEEKDAY_MIX_MISMATCH]
A (HTTP POST evaluate, cold) 2231 ms → v1: verdict INCOMPARABLE, maturity MATURE (первичная)
B (AnalyticsGrowthService.evaluate в контейнере, те же строки) → v2: A vs B по 617 листьям JSON — diffs 0 (service 2542 ms)
C (SQL по MetrikaDailyTraffic / MetrikaDailyGoal 611379890 / MetrikaDailyBehaviorDevice form_started / MetrikaPeriodSnapshot
   + когорты этапа 08 Overview.crmFunnel.cohorts + Overview.siteFunnel.matchedAccepted + Overview.financials.realized):
   visits 51/27; siteLeads 2/2; siteLeadRate 3,922/7,407 %; formStarts 8/3; crmLeads 0/1; acceptedOrders 5/9; matchedAccepted 0/0;
   realizedRevenue 14 740/26 537 ₽; netProfit 8 193/14 850 ₽; periodUsers null/null (снимков окон ещё не было) —
   20 проверок, diffs 0
реестр:    GET changes / GET changes/:id = строки AnalyticsChange 1:1 (id, даты, метрики, статус, primaryLockedAt)
```

## 8. VERSIONS / LOCK (§ 13)

```text
v1 (23:17:58, manual, INCOMPARABLE) → после v2 (service) и v3 (HTTP POST evaluate 23:2x): GET …/evaluations/1 байт в байт
равен себе до и после новых оценок (true); строка БД v1 (result, flags, evaluatedAt) не изменилась (true);
latest = последняя версия; history по убыванию версий; unique(changeId, version) — дублей 0.
Всего версий A на момент отчёта: 9 (v1–v8 manual 15.09, v9 scheduler 16.09 00:17:50) (все manual, кроме scheduled из тика 00:19 — см. § 35.13); лишние ручные
версии v4–v6 — повторный прогон сверочного скрипта (DEVIATION 3), все INCOMPARABLE, данные идентичны.
PATCH primaryMetric → 400 «Первичная метрика зафиксирована первой оценкой и не меняется; создайте новое изменение»;
PATCH expectedDirection → 400; PATCH description → 200; в БД primaryMetric siteLeadRate, expectedDirection INCREASE,
primaryLockedAt = 23:17:58 (первая оценка).
```

## 9. OBSERVATIONAL CONTRACT (§ 14)

```text
по всем сохранённым оценкам A (v1…v9 (v1–v8 manual 15.09, v9 scheduler 16.09 00:17:50)): evidenceType OBSERVATIONAL_BEFORE_AFTER, causality NOT_ESTABLISHED,
abCapability NO_VARIANT_ASSIGNMENT, disclaimer содержит «не доказывает», FACT/INTERPRETATION/RECOMMENDATION без слов
«доказан/доказыва/причина/благодаря/привело к/вызвал» — нарушений 0. status: abCapability NO_VARIANT_ASSIGNMENT,
evidenceTypes [OBSERVATIONAL_BEFORE_AFTER]. UI: плашка «A/B-тесты с разделением аудитории недоступны (NO_VARIANT_ASSIGNMENT) —
все оценки наблюдательные» и дисклеймер «Совпадение по времени не доказывает, что изменение вызвало результат…» (в шапке и под оценкой).
```

## 10. VERDICTS (§ 15–16) — A, факт / ожидание

```text
siteLeadRate (primary)  INCOMPARABLE ✓ — codes [METRIC_UNAVAILABLE_BEFORE, MEASUREMENT_DEFINITION_CHANGED, INCOMPARABLE_WINDOWS],
                         measuredFrom 13.09 / 13.09, cutoversInside [2026-09-13]
                         3,92 % (2/51) → 7,41 % (2/27), +3,49 п.п. (+88,89 %), Фишер p = 0,606, 95 % ДИ [−7,24; +19,7] п.п.,
                         MDE ±12,94 п.п. (±330 % базы), для 20 % нужно ≈ 10 533 визита на окно
                         UI: заголовок «Окна несопоставимы», дельта приглушённая («не является выводом — см. вердикт»),
                         FACT — числа с оговоркой, INTERPRETATION — «определение изменилось 13.09 … разница не является эффектом»,
                         RECOMMENDATION — «сравнивать окна, целиком лежащие после смены определения» → тест 12.09 ПРОЙДЕН:
                         verdict ≠ POSITIVE_SIGNAL, headlineIsDelta = false, confounders ∋ MEASUREMENT_DEFINITION_CHANGED
visits (secondary)      INSUFFICIENT_DATA ✓ (51 → 27 за 2 дня); flags SHORT_WINDOW (< 7 дней), WEEKDAY_MIX_MISMATCH, LOW_SAMPLE
formStarts              INSUFFICIENT_DATA ✓ (8 → 3)
crmLeads / acceptedOrders (CRM для SITE)  scopeCompatibility context_only ✓ — в UI помечены «контекст», подпись
                         «контекст описывает бизнес, а не эффект изменения»; вердикт INSUFFICIENT_DATA; в первичный вердикт не входят
leadToPaidRate / paidOrders / netProfit / realizedRevenue  IMMATURE ✓ (класс paid, maturityUntil 28.09.2026 = after.to + 14 дн.),
                         несмотря на +81 % прибыли (8 193 → 14 850 ₽) — UI «Исход ещё созревает · не созрело»
matchedAccepted (context) INCOMPARABLE ✓ (availableFrom 13.09 → METRIC_UNAVAILABLE_BEFORE) + MATCHED_COVERAGE_LOW (покрытие 0 %/0 %)
MDE / sample gate       заполнены (mde absolute/relative, requiredSample.perWindow); NO_CLEAR_CHANGE не появился ✓
WEEKDAY_MIX_MISMATCH    есть (окна по 2 дня: чт–пт vs сб–вс) ✓; EXCLUDED_CUTOVER_DAY ✓
confounders A           WEEKDAY_MIX_MISMATCH[ATTENTION], MEASUREMENT_DEFINITION_CHANGED[ATTENTION], OVERLAPPING_CHANGE[ATTENTION]→B, LOW_SAMPLE[ATTENTION]
сегменты (устройства)   Компьютер 7,14 % → 13,33 % INCOMPARABLE; Телефон 0 % → 0 % INCOMPARABLE — как первичная
A v9 (scheduler, 16.09 00:17:50, cutoff 15.09; окна 09–11.09 / 13–15.09, 3 дня): INCOMPARABLE — 2/78 = 2,56 % → 3/37 = 8,11 %,
                         Фишер p 0,326, MDE ±8,84 п.п. (±345 %); flags EXCLUDED_CUTOVER_DAY, SHORT_WINDOW, WEEKDAY_MIX_MISMATCH;
                         confounders WEEKDAY_MIX_MISMATCH, SOURCE_MIX_SHIFT (новый — смесь источников сдвинулась), MEASUREMENT_DEFINITION_CHANGED,
                         OVERLAPPING_CHANGE [B]; periodUsers {54, 27} из точных снимков; visits 78 → 37 INSUFFICIENT_DATA; formStarts INCOMPARABLE
                         (окно «до» 09–11.09 начинается раньше доступности form_started с 10.09 — PARTIAL_MEASUREMENT_PERIOD); crmLeads 2 → 2,
                         acceptedOrders 15 → 15 INSUFFICIENT_DATA (контекст); paidOrders 3 → 1, netProfit 29 474 → 20 312 ₽ IMMATURE
                         (падение прибыли тоже НЕ вердикт — исход не созрел); causality NOT_ESTABLISHED
B как изменение         15.09: POST evaluate → 400 «После cutover (2026-09-14) ещё нет ни одного полного московского дня с данными —
                         оценивать нечего (NO_COMPLETE_DAYS_AFTER)» — строже ожидания плана (INSUFFICIENT_DATA): оценка невозможна
                         до 16.09; изменение в реестре, как confounder работает (см. § 35.11). Повторно 16.09 13:18 (cutoff 15.09): снова 400 NO_COMPLETE_DAYS_AFTER — у B нет ни одного полного московского дня
                         внутри его жизни (начался 14.09 18:20, закончился 15.09 20:32), поэтому как самостоятельное изменение он
                         не оценивается никогда — по замыслу; его роль — граница/confounder (OVERLAPPING_CHANGE у A v1–v9).
```

## 11. INCIDENT BOUNDARY (§ 17)

```text
B зарегистрирован COMPLETED с точными границами 14.09 18:20 → 15.09 20:32 MSK. Все оценки A (after-окно 13–14.09 пересекает
14.09) получили confounder OVERLAPPING_CHANGE [28b7033d] — в UI «Другое изменение рядом: одновременно действовали другие
изменения: «Инцидент 14.09 18:20 → 15.09 20:32: сайт работал на августовской сборке» … — разницу нельзя приписать одному
изменению» ✓. Факт с последствиями (цели lead_submitted / form_started за вечер 14.09 и 15.09 до 20:32 неполные, визиты корректны)
записан в 01_CURRENT_STATE.md § 5j. OPEN DECISION — definitionCutovers на 14–15.09 (§ 17 плана) остаётся за Reviewer.
```

## 12. MATURITY / SCOPE / COVERAGE / P&L / SNAPSHOTS (§ 18–22)

```text
maturityPolicy (бой):  daysByClass {immediate 0, accepted 1, paid 14}; leadToAccepted n 25, median 0, p90 0,6 дн. (empirical);
                       acceptedToPaid n 212, median 10, p90 20 дн.; paid — default 14 дн. (пар заявка → оплата < 20)
классы в оценке A:     immediate MATURE (visits, formStarts, crmLeads, acceptedOrders); accepted → matchedAccepted PARTIALLY_MATURE
                       (до 15.09); paid → IMMATURE до 28.09 (leadToPaidRate, paidOrders, netProfit, realizedRevenue)
site leads ≠ CRM:      siteLeads (цель Метрики) 2/2 и crmLeads (когорта CRM по дате заявки) 0/1 — разные строки/подписи;
                       siteLeadRate = 2/51, не crmLeads/visits; CRM-метрики для SITE — context_only ✓
ClientID coverage:     clientIdCoverageAccepted 0 % / 0 % (= overview.dataQuality) → matchedAccepted MATCHED_COVERAGE_LOW,
                       вывода нет ✓ (данные сопоставления с 13.09, покрытие пока нулевое)
P&L:                   контекст A realizedRevenue 14 740/26 537, netProfit 8 193/14 850 = overview(custom окна) diff 0;
                       overview(custom) vs ReportsService.getWeeklyReport(2026, 9) (недели Пн–Вс): 07–13.09: totalRevenue 52 541 /
                       netProfit 37 164 / orders 32 — diff 0; 01–06.09: 74 658 / 38 838 / 53 — diff 0; HTTP /reports/weekly = service.
                       COGS: financials.quality.completeness = complete в обоих окнах → флага COGS_INCOMPLETE нет — корректно
                       (прибыль при этом IMMATURE, не «растёт»)
exact snapshots:       до первого тика periodUsers null/null (флаг UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW); тик 23:19 с хуком →
                       MetrikaPeriodSnapshot preset=null: 10–11.09 users 35 visits 51; 13–14.09 users 21 visits 27 (fetchedAt 23:19:18);
                       запросов снимков окон 4 (2 окна × stats+goals), ошибок 0; новая оценка (v7, 23:22) → periodUsers {before 35, after 21},
                       флаг снят; снимок users < Σ дневных users (35 < 37, 21 < 23) — уникальные не суммируются ✓; visits = Σ дневных ✓
```

## 13. SCHEDULER (§ 23)

```text
тик 23:14:50 (после деплоя, флаг OFF):  12/12 SUCCESS, снимки 8/8, хука нет
тик 23:19:05–23:19:18 (после enable):    12/12 SUCCESS, снимки 8/8 (16 req), хук: «Рост: автооценка — изменений 0,
                                         запросов снимков окон 4, ошибок 0» (нового полного дня нет → переоценки 0) — цикл 1 ✓
тик 00:17:35–00:17:44 16.09 (новый московский день): 12/12 SUCCESS, снимки 8/8; хук 00:17:51: «изменений 1, запросов снимков
                                         окон 4, ошибок 0» → A v9 trigger scheduler, observationCutoff 15.09, окна 09–11.09 / 13–15.09 (3 дня),
                                         lastSyncRunId = id тика (3a2b63f3…), INCOMPARABLE; снимки окон 09–11.09 (users 54, visits 78) и 13–15.09
                                         (users 27, visits 37) — цикл 2 ✓; B (COMPLETED) не переоценивался
тики 01:17 … 12:17 16.09 (11 циклов): каждый 12/12 SUCCESS, снимки 8/8; хук «изменений 0, запросов снимков окон 2,
                                         ошибок 0» — переоценки без нового дня нет; 2 запроса/тик = обновление снимка after-окна 13–15.09,
                                         пока оно не «устоялось» (w.to < cutoff станет true 17.09 00:17) — циклы 3–13 ✓
дубли:     count(*) group by (changeId, observationCutoff, trigger='scheduled') ≤ 1 — 0 (одна scheduler-версия на cutoff 15.09); unique(changeId, version) цел
гонки:     ручные оценки (manual) и хук — отдельные версии, ошибок в логе 0
Metrika API из HTTP-запросов дашборда: 0 (все строки YandexMetrikaClient в логе — только внутри тиков 23:14:50–23:15:12,
                                         23:19:05–23:19:18 и далее в :17 каждого часа 16.09; в остальные минуты строк клиента Метрики нет)
```

## 14. PERFORMANCE (§ 24, production-контейнер, БД в соседнем контейнере)

```text
POST evaluate A cold (первый после recreate 23:17):  2231 ms  (цель ≤ 3,0 с ✓)
POST evaluate warm:                                  1902 / 1051 / 2797 / 2221 ms  (цель ≤ 2,0 с — 2 из 4 выше: 2797 ms при
                                                      первой оценке с новыми снимками окон; ≤ 3 с все) — NEW FACT
service evaluate (в контейнере):                      2542 ms
GET status 257–355 ms (lifecycles для эмпирики; цель ≤ 1,0 с ✓); GET changes 22–81 ms (≤ 0,5 ✓); GET latest 11–18 ms (≤ 0,3 ✓)
Stage 09 overview 30d после деплоя: 2,1 с BEFORE → 1,9–3,0 с AFTER (в пределах шума; первый вызов после recreate холодный)
N+1: pg_stat_database.tup_returned за одну оценку +15 570 и +16 012 строк (±3 %, десятки тысяч, не миллионы);
     xact_commit +79 ≈ число SQL-запросов (76 на копии + запись версии) — константа, не растёт с числом заказов
```

## 15. PRIVACY (§ 25)

```text
Строки AnalyticsChange (1 523 символа) + AnalyticsChangeEvaluation (result + flags, ~117–119 тыс. символов):
телефоны (строгий паттерн с границами) 0; e-mail 0; @username 0; 19-значные ClientID 0; ссылки t.me/max.ru/wa.me 0;
контакты клиентов из OrderPhoto.urlCommunication (12 значений, не печатались) — вхождений 0.
Нестрогий паттерн 7\d{10} дал 60 «попаданий» — все внутри десятичных дробей статистики (например 7,4074074074…) — ложные.
API JSON (changes, latest) и UI-скриншоты — те же тексты; секреты в логах/отчёте не выводились (JWT подписывались внутри
контейнера и не печатались; .env — только имена backup-файлов и число строк).
```

## 16. REGRESSION Stage 06 / 09 / 10 (§ 26)

```text
06:  outbox delivered=1 skipped=9 до и после (без изменений); orders_sync=true; ошибок воркера в логе 0
07/08: тики 23:09 (до), 23:14, 23:19 и далее в :17 каждого часа 16.09; в остальные минуты строк клиента Метрики нет — все SUCCESS, снимки 8/8; FAILED 0, RUNNING 0, дублей 0
09:  /analytics/dashboard/status, overview 30d/7d — BEFORE 22:25 = AFTER 23:15 (OFF) = 23:3x (ON): diffs 0 (214 листьев)
10:  /behavior/summary 7d, issues 7d/30d, funnels 7d — diffs 0 (109/69/69/346 листьев); skipped PARTIAL_BEHAVIOR_PERIOD (FIX_01) на месте
UI:  production-JSON в сборке кандидата: вкладки Обзор и Поведение рендерятся (маркеры «Визит», «Требует внимания»), слов
     «Ошибка / не удалось» 0; телефон 390 px — scrollWidth 390 (скриншоты prod-tab-overview/behavior в scratch, prod-growth-mobile-390.png в docs)
CRM: backend один и тот же (191f27494fbc); health ok (uptime 50 393 с к 13:17 16.09 — с enable без перезапусков); Telegram-темы
     владельца (3ac9be8) — код в образе, ошибок при старте 0; единственный ERROR в логе за ночь — 04:11 TelegramPollingService
     «getUpdates падает 5 раз подряд: timeout» (сетевой таймаут Telegram, не Stage 11; polling восстановился)
```

## 17. UI (production-JSON → сборка кандидата; под учётной записью владельца исполнитель не входил)

```text
screenshots/11_growth/prod-growth-desktop-A.png — A: «Окна несопоставимы», 3,92 % → 7,41 %, дельта приглушённая, ДИ/p/метод/MDE словами,
   ФАКТ / ИНТЕРПРЕТАЦИЯ / ЧТО ДЕЛАТЬ, дисклеймер, «Оговорки (4)» с инцидентом, «Другие метрики» (контекст подписан),
   сегменты по устройствам, «Уникальные посетители за окна: до 35, после 21», созревание «принятые 1 дн., оплаты 14 дн. (по умолчанию —
   истории мало)»; prod-growth-desktop-B.png — B: «Завершено», «Оценок ещё нет»; prod-growth-mobile-390.png — без горизонтальной прокрутки;
   off-growth-disabled.png — состояние при выключенном флаге
```

## 18. OWNER SMOKE (§ 27)

```text
НЕ ВЫПОЛНЕН ИСПОЛНИТЕЛЕМ — gate владельца. Чек-лист § 27: /crm/analytics → «Рост / Изменения»: плашка NO_VARIANT_ASSIGNMENT и дисклеймер;
A «Деплой сайта 12.09…» — «Окна несопоставимы» (не +88,9 %), B «Инцидент 14.09…» — завершено; в A — окна с исключённым 12.09,
ФАКТ / ИНТЕРПРЕТАЦИЯ / ЧТО ДЕЛАТЬ, оговорки (в т. ч. инцидент), версии, «Оценить заново»; форма регистрации; телефон 390 px.
Ориентиры для чтения: до 10–11.09 (3,92 %, 2 из 51), после 13–14.09 (7,41 %, 2 из 27) — при проверке владельца 16.09 после тика
00:19 окна сдвинутся (after 13–15.09, before 09–11.09) и числа будут другими — это ожидаемо (новый полный день).
Результат владелец фиксирует сам («OWNER SMOKE STAGE 11 ПРОЙДЕН» / замечания).
```

## 19. NEW FACTS

```text
1. Тики расписания в бою идут не в :31, а через 90 с после старта backend и далее ежечасно: после перезапуска владельцем 19:09 — в :09;
   после деплоя 23:13 — 23:14:50; после enable 23:17 — 23:19:05 и далее в :19. Оба «тика при старте» — daily (окно 21 день), SUCCESS.
2. Первое окно оценки A на 15.09: 2 дня (13–14.09) vs 2 дня (10–11.09) — SHORT_WINDOW; первое недельное окно после 12.09 — с 20.09.
3. Покрытие ClientID у принятых заказов в окнах A = 0 % (сопоставление работает с 13.09, за 13–14.09 совпадений нет) → любые matched-метрики
   пока INSUFFICIENT_DATA / INCOMPARABLE — честно.
4. Заявок с сайта за 13–14.09 — 2 при 27 визитах; заказов CRM по дате заявки — 1 (0 до); принятых 9 (5 до) — контекст, не эффект.
5. Точные снимки окон: 4 запроса к Метрике за тик на одно изменение, потом 0; users снимка меньше суммы дневных (35 vs 37, 21 vs 23) —
   суммирование дневных завышало бы уникальных на 6–10 %.
6. Инцидент B нельзя оценить как изменение до 16.09 (после endedAt 15.09 20:32 нет полного дня) — сервис отвечает 400
   NO_COMPLETE_DAYS_AFTER, не выдумывает окно.
7. P&L недельного отчёта владельца (Пн–Вс) и канонические метрики этапа 08 за те же даты совпадают до рубля (2 недели сентября).
```

## 20. DEVIATIONS

```text
1. § 9.5: при выключенном флаге ADMIN POST /growth/changes с телом {} → 400 (ValidationPipe), а не 404. Проверка флага — внутри метода
   контроллера, глобальный ValidationPipe срабатывает раньше. Данные раздела не раскрываются, записей нет (0 строк), валидное тело → 404.
   Формально попадает под STOP «любой маршрут кроме status отвечает не 404» — исполнитель НЕ остановил rollout (сочтено дефектом
   ожидания плана, а не утечкой; поведение идентично другим DTO-маршрутам проекта). Решение — за Reviewer; предложение: FIX —
   перенести проверку флага в guard (до пайпов) → 404 и на невалидное тело.
2. A получил 7 secondary-метрик вместо 3 из § 11 (добавлены acceptedOrders, leadToPaidRate, paidOrders, netProfit — чтобы проверить
   § 18/21 на реальном изменении, план § 18 это допускал «если добавлены»); для SITE они context_only и на вердикт не влияют.
3. Лишние ручные версии A: v4–v6 созданы повторным прогоном сверочного скрипта (ошибка исполнителя в режиме запуска), v7–v8 — проверка
   periodUsers/perf. Все manual, INCOMPARABLE, данные идентичны; версии неизменяемы, удалять их нельзя и не нужно.
4. B (инцидент) 15.09 не оценивается (400 NO_COMPLETE_DAYS_AFTER) — план ожидал INSUFFICIENT_DATA + AFTER_WINDOW_TRUNCATED_BY_END; фактическое
   поведение строже. Причина — endedAt 15.09 20:32 обрезает after-окно до нуля полных дней: изменение длительностью ~26 ч без единого
   полного дня не оценивается как изменение вообще (ни 15.09, ни 16.09). Для роли «граница/confounder» это не мешает.
5. § 21: сравнение с /reports/weekly выполнено для двух полных недель Пн–Вс (07–13.09, 01–06.09), а не для окон A (2-дневные окна
   с неделей отчёта не совпадают) — цепочка «контекст A = overview(окна) = diff 0» + «overview(неделя) = weekly diff 0».
6. Изменение C (правка шапки 15.09) не регистрировалось — решение владельца (§ 11).
7. Тесты § 3 запускались до push на tip 5922175 (docs-only потомок кандидата), migrate diff со shadow-БД локально не выполнялся —
   заменён предпроверкой migrate deploy на временной копии production-дампа.
```

## 21. OPEN DECISIONS

```text
1. DEVIATION 1 — принять как есть или FIX (флаг в guard → 404 до валидации).
2. definitionCutovers 14–15.09 для поведенческих метрик (окна, пересекающие инцидент, → INCOMPARABLE формально) — отдельный FIX.
3. Owner smoke § 27 — владелец.
4. CI safety debt сайта (§ 31 плана) — отдельный технический gate после Stage 11; workflow и ветки web-photo не трогались.
5. Warm evaluate до 2,8 с при первой оценке с новыми снимками окон (цель ≤ 2 с) — оптимизация не требуется до роста трафика; решение Reviewer.
```
