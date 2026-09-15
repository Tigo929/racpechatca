# 11_PRODUCTION_ROLLOUT.md

## STATUS

```text
READY_FOR_REVIEW — план production rollout Stage 11 подготовлен 15.09.2026 по решению Reviewer
«11_GROWTH_AND_EXPERIMENTS = READY_FOR_PRODUCTION_ROLLOUT». Production НЕ менялся, rollout НЕ начат.
Начало — только по отдельной команде Reviewer «СТАРТ» (§ 34). Кандидат — § 2 и требует подтверждения
Reviewer: FIX_00 (0c3b84a) добавляет свой флаг раздела поверх reviewed 8d10b7c — без него требование
«выкатывать выключенным» невыполнимо, потому что общий флаг дашборда в бою уже включён.
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
