# 12_PRODUCTION_ROLLOUT.md

## STATUS

```text
DONE_PENDING_REVIEW (исполнитель, 17.09.2026). Technical rollout выполнен 17.09.2026 09:10–10:37 MSK по команде Reviewer
«СТАРТ» (docs-tip 53d2d25, кодовый кандидат 1f8b7b4; решение § 10 — включить в том же окне): master = 1f8b7b4 (push 09:19),
раздел выложен выключенным (миграция на старте контейнера 09:29:31, 62 таблицы), OFF-gate 9/9 с 404 до ValidationPipe,
включён 09:33:16, первый запуск — хук boot-тика 09:35 (19 детекторов, 8 карточек / 49 причин молчания, ошибок 0),
ручной run идемпотентен, сверка A = B = C diff 0, EVENT_NOT_MEASURED — одна карточка на воронку как качество измерения,
not_measured нигде не 0, causal claims 0, PII 0, perf в цели, два автоматических цикла (daily 09:35, hourly 10:33),
Stage 06/09/10/11 без регресса, STOP-условий не было. Отчёт — § 35. Остановка на owner-smoke (§ 27) / reviewer gate:
Stage 12 не закрыт, production после enable не менялся. План (§ 1–34) — как был на момент «СТАРТ».
```

## STAGE

**12 — Automated Insights / Production Rollout**

## PURPOSE

Безопасно вывести в production движок автоматических сигналов FACT → HYPOTHESIS → RECOMMENDATION
(`12_AUTOMATED_INSIGHTS.md` § 49–50) так, чтобы:

- ничего не сломать в работающих этапах 06 / 07–08 / 09 / 10 / 11;
- раздел появился **выключенным** (миграция применена, хук не подключён, маршруты данных → 404 до валидации)
  и включался отдельным контролируемым шагом с наблюдаемым первым запуском;
- каждая карточка, показанная руководителю, была сверена тремя способами (API = service = SQL) на боевых данных;
- ни одна карточка не назвала наблюдательную разницу причиной, гипотезу — фактом, `not_measured` — нулём,
  несопоставимые / незрелые / малые сигналы — сигналами;
- планировщик остался одним и тем же процессом с той же защитой от наложений.

В rollout входит: backend `InsightsModule` (движок 19 детекторов, реестр карточек, журнал запусков, ADMIN API под
двумя флагами, хук `insights:run` после тика расписания), миграция `20260916120000_analytics_insights` (только
CREATE), вкладка панели «Инсайты», строка флага в серверном compose, документация. Данные — только реальные:
искусственные заявки, заказы, оплаты, «тестовые изменения» и «тестовые карточки» в production не создаются.

В rollout **не входит** (§ 30): правки `web-photo`, event model сайта, Logs API, CI сайта, ветки
`feature/print-card-lead-form`; изменение порогов V1 (`INSIGHTS_RULES.md` § 2) без обнаруженной ошибки; расширение
назначения `POST /insights/run` (остаётся ADMIN-only инструментом controlled rollout).

---

## 1. REVIEWER VERDICT BEFORE START

Implementation: `READY_FOR_PRODUCTION_ROLLOUT` (Reviewer, 16.09.2026; FIX_01 принят).
Этот план: `READY_FOR_REVIEW` → Reviewer подтверждает план **и кандидата § 2**.
Production меняется только после отдельной команды `СТАРТ`. До неё — ни одного шага из § 4 и далее.

---

## 2. EXPECTED GIT STATE

```text
CRM repo racpechatca
production master (до rollout):     5922175  (Stage 11 rollout; проверено 16.09 ~20:00 MSK: origin/master = 5922175)
reviewed implementation HEAD:       1f8b7b4  (Stage 12 backend + панель + FIX_01 + docs § 49–50)
rollout candidate (код):            1f8b7b4
fast-forward до:                    docs-only потомка 1f8b7b4 на feature (этот план и его правки; код тот же —
                                    проверять `git diff --stat 1f8b7b4..<tip> -- . ':!docs'` = пусто)
ветка:                              feature/analytics-foundation (master ⊂ feature, fast-forward возможен)
```

Коммиты `5922175..1f8b7b4` (все — исполнитель; неожиданных owner-коммитов нет):

| Коммит | Что | Область |
|---|---|---|
| f45ad8e, e9db97c, 9b3029f | Stage 11 rollout — только docs (§ 35, owner smoke) | `docs/analytics/` |
| fdb483d | Stage 11 = DONE; спецификация Stage 12 как получена | `docs/analytics/` |
| b983676 | backend: `crm-new/src/analytics/insights/*`, schema + миграция, `app.module.ts` +2 строки, публичные загрузчики этапа 11 | crm-new |
| 0a0c6cf | панель: `types/insights.ts`, `api/analytics.ts` (+21), `features/analytics/insights-*`, `AnalyticsPage.tsx` (вкладка) | frontend |
| 8753faf | замок запуска строкой RUNNING, лёгкий часовой контекст, DUPLICATE для зеркал трафика, строка compose-шаблона | insights, compose |
| bbbf4bf | docs: § 49, INSIGHTS_DATA_CONTRACT / RULES / LANGUAGE_POLICY, скриншоты | docs |
| 5f90e68, 0d7e901 | FIX_01: детектор `quality.eventNotMeasured`, пороги `EVENT_GAP_*`, 9 тестов, UI-пометка data-scope | insights, frontend |
| 1f8b7b4 | docs: § 50 FIX_01, правила / контракт, скриншот | docs |
| <план>… | этот план и правки docs после него — только `docs/analytics/` | docs |

Изменённые **существующие** файлы вне docs (`git diff --stat --diff-filter=M 5922175..1f8b7b4 -- . ':!docs'` —
6 файлов, 147 добавлений, 10 удалений):

```text
crm-new/prisma/schema.prisma                                  +92   только новые модели AnalyticsInsight / Version / Run
crm-new/src/analytics/growth/analytics-growth.service.ts      +24/−10  loadWindow / overlappingChanges / lastDataDay стали
                                                                    публичными (сигнатуры), поведение оценки не изменилось —
                                                                    Stage 11 тесты (47) прежние
crm-new/src/app.module.ts                                     +2    InsightsModule
docker-compose.prod.yml (шаблон в репо)                        +3    строка ANALYTICS_INSIGHTS_ENABLED
frontend/src/api/analytics.ts                                  +21   insightsApi
frontend/src/pages/AnalyticsPage.tsx                           +4/−1 вкладка «Инсайты»
удалённых файлов — 0
```

Pre-deploy git gate (STOP при любом отклонении):

1. `git fetch origin` → `origin/master` = `5922175`; появились owner-коммиты — STOP: merge в feature, полный прогон
   тестов, новый кандидат, повторный review;
2. `git merge-base --is-ancestor origin/master <candidate>` = true (fast-forward);
3. `git log --oneline origin/master..<candidate>` совпадает с таблицей выше — ни одного лишнего коммита;
4. `git diff --stat origin/master..<candidate>` — файлы только из перечисленных областей; никаких правок `web-photo`,
   `.env`, nginx, `auto-update.sh`, сервисов этапов 06/09/10, планировщика этапа 07 (хук регистрируется через уже
   существующий `registerAfterSync`), правил этапа 10, статистики этапа 11;
5. clean worktree, никаких force push, `master` пушится один раз fast-forward; CI собирает только `master`.

---

## 3. BUILD / TEST GATE (перед push) и BEFORE-снимок

- `prisma validate`; `prisma migrate diff --from-migrations --to-schema-datamodel` — пусто (schema = миграции);
- CRM jest полностью (эталон на кандидате: **1078 / 1078, 99 suites**), в т. ч. `src/analytics/insights` (63),
  `growth` (47), `behavior`, `metrika-analytics-scheduler.service.spec` (хуки);
- панель vitest (**42 / 42**), `tsc -b`, `vite build`; `nest build`; eslint insights = 0, prettier чист;
- BEFORE на production (read-only, до любых правок; JSON сохранить для § 9 / § 25):
  - последний SUCCESS тик расписания и минута тика (после 15.09 23:17 — `:17` каждого часа; уточнить по логу),
    `MetrikaSyncRun` за 24 ч (SUCCESS / FAILED / RUNNING), снимки `MetrikaPeriodSnapshot`;
  - Stage 06 outbox pending / failed; Stage 09 `status`, `overview?period=30d`; Stage 10 `/behavior/summary`,
    `/behavior/issues?period=7d`, `/behavior/funnels?period=7d` (шаги `not_measured` — фото `catalog`, футболки
    `choose_type_color` / `submit_tshirt_order`, холсты `canvas_upload`; входные визиты воронок);
  - Stage 11 `growth/status`, `growth/changes` (A `222c1b8e…` ACTIVE, B `28b7033d…` COMPLETED), номер последней
    версии A и её вердикт (ожидание — `INCOMPARABLE`);
  - БД: таблиц `public` = **59**, `_prisma_migrations` = **82**, таблиц `AnalyticsInsight*` = **0**;
  - `pg_stat_database.tup_returned / xact_commit` для § 24.

---

## 4. BACKUPS — первый шаг после «СТАРТ»

```text
cp /opt/raspechatka/docker-compose.prod.yml /opt/raspechatka/docker-compose.prod.yml.bak-stage12-$(date +%Y%m%d-%H%M)
cp /opt/raspechatka/.env                    /opt/raspechatka/.env.bak-stage12-$(date +%Y%m%d-%H%M)
docker exec raspechatka-postgres-1 pg_dump -U crm_user -d crm -Fc -f /var/lib/postgresql/data/crm-pre-stage12-$(date +%Y%m%d-%H%M).dump
```

Проверить размер dump > 0 и что `pg_restore --list` читает заголовок. Секреты не выводить; в отчёт — только имена
файлов и размеры. Backup делается **до** правки compose (§ 6) и до deploy (§ 8).

---

## 5. MIGRATION REVIEW — `20260916120000_analytics_insights`

`crm-new/prisma/migrations/20260916120000_analytics_insights/migration.sql` — 97 строк:

```text
CREATE TABLE  "AnalyticsInsight"          (карточка-эпизод: fingerprint, baseFingerprint, episode, category, severity,
                                           status, scope, source, detectorId, metricKey, entityKey, periodStart/End,
                                           baselineStart/End DATE, title, fact / hypothesis / recommendation / evidence /
                                           limitations / quality JSONB, causality, link JSONB, firstDetectedAt,
                                           lastDetectedAt, resolvedAt, resolvedReason, acknowledgedAt, latestVersion,
                                           payloadHash, createdAt, updatedAt)
CREATE TABLE  "AnalyticsInsightVersion"   (insightId, version, generatedAt, syncRunId, runId, payload JSONB, payloadHash)
CREATE TABLE  "AnalyticsInsightRun"       (kind, status, startedAt, finishedAt, observationCutoff, syncRunId, счётчики
                                           detectors / detected / created / versioned / unchanged / resolved / reopened,
                                           suppressed JSONB, errors JSONB, durationMs, seenEvaluations JSONB)
CREATE UNIQUE INDEX "AnalyticsInsight_fingerprint_key"
CREATE INDEX  "AnalyticsInsight_status_severity_lastDetectedAt_idx"
CREATE INDEX  "AnalyticsInsight_baseFingerprint_idx"
CREATE UNIQUE INDEX "AnalyticsInsightVersion_insightId_version_key"
CREATE INDEX  "AnalyticsInsightRun_startedAt_idx"
ALTER TABLE   "AnalyticsInsightVersion" ADD CONSTRAINT …_insightId_fkey FOREIGN KEY → "AnalyticsInsight"(id)
              ON DELETE CASCADE ON UPDATE CASCADE
DROP / TRUNCATE / DELETE / UPDATE / RENAME / ALTER существующих таблиц — 0
```

Gate: в файле нет ни одной существующей таблицы (Order*, Metrika*, Behavior*, AnalyticsChange*, User*…); единственный
`ALTER TABLE` — FK между двумя новыми таблицами; `grep -ciE "^(drop|truncate|delete|update|alter table
\"(order|metrika|user|task|expense|analyticschange))"` = 0. Миграция применяется **на старте контейнера** штатным
`prisma migrate deploy` (как этапы 07–11); `migrate dev`, `migrate resolve`, ручные правки `_prisma_migrations`
запрещены. На боевой базе до rollout: таблиц `AnalyticsInsight*` 0, строк миграции 0 (проверено 16.09 после cleanup
копии: 82 миграции, 59 таблиц).

После deploy: `select migration_name, finished_at, rolled_back_at from _prisma_migrations order by finished_at desc
limit 3` → `20260916120000_…` с `finished_at`, `rolled_back_at` null; таблиц 3 (пустых), индексов 5 + 3 PK, FK 1;
число таблиц `public` = 59 + 3 = **62**; `_prisma_migrations` = **83**.

---

## 6. FEATURE FLAG — выкатываем выключенным

Общий `ANALYTICS_DASHBOARD_ENABLED` и `ANALYTICS_GROWTH_ENABLED` в бою = true, поэтому у раздела свой флаг:

```text
ANALYTICS_INSIGHTS_ENABLED  (default false; crm-new/src/analytics/insights/insights-flags.ts)
  выключен → GET /analytics/dashboard/insights/status → { enabled: false, detectors: 19, thresholds, boundaries… }
             (@AllowWhenDisabled); все остальные маршруты раздела — 404 «Раздел аналитики выключен» из
             InsightsEnabledGuard, который стоит ДО ValidationPipe: даже POST с телом {} или с PII-полем → 404, не 400;
             вкладка «Инсайты» → «Раздел «Инсайты» выключен»;
             InsightsModule.onModuleInit: хук расписания НЕ регистрируется
             (лог «Раздел «Инсайты» выключен (ANALYTICS_INSIGHTS_ENABLED): хук расписания не подключён»)
  включён  → только при обоих флагах (общий дашборда И свой); лог «Раздел «Инсайты» включён: хук расписания подключён»
```

Шаг перед deploy (после backup § 4); серверный compose редактируется руками, как на этапах 09–11:

```text
# /opt/raspechatka/docker-compose.prod.yml → backend.environment, строкой после ANALYTICS_GROWTH_ENABLED:
      ANALYTICS_INSIGHTS_ENABLED: ${ANALYTICS_INSIGHTS_ENABLED:-false}
docker compose -f docker-compose.prod.yml config | grep ANALYTICS_INSIGHTS_ENABLED   → "false"
```

`.env` на этом шаге не трогать (переменной нет → default false). Compose-правку делать непосредственно перед deploy
(урок этапа 09: изменившийся env пересоздаёт backend старым образом при следующем `up`).

---

## 7. SCHEDULER WINDOW

Stage 12 не добавляет наборов Метрики и не меняет расписание (0 обращений к API Метрики — только Postgres); при
выключенном флаге хук не подключён. Флаги `YANDEX_METRIKA_*` не менять. Deploy начинать сразу после SUCCESS часового
тика (`:17` каждого часа после Stage 11 — сверить по логу), убедившись `select count(*) from "MetrikaSyncRun" where
status = 'RUNNING'` = 0 и `select count(*) from "AnalyticsInsightRun" where status = 'RUNNING'` = 0 (после deploy) —
тогда пересоздание backend не оборвёт запуск. Окно упущено — ждать следующего тика, а не выключать расписание.

Порядок хуков в тике: `growth:evaluate` (этап 11) регистрируется раньше `insights:run` (порядок модулей в
`app.module.ts`), поэтому карточка `change.evaluation` в том же тике видит новую версию оценки — проверяется по
порядку строк лога (§ 21).

---

## 8. MERGE / DEPLOY CODE

1. `git checkout master && git merge --ff-only <candidate> && git push origin master` — один push, без force;
2. GitHub Actions «Сборка образов» → SUCCESS (~3 мин); `/opt/deploy/auto-update.sh` (таймер, каждую минуту) тянет
   образы и пересоздаёт backend + frontend; следить по `/var/log/auto-update.log`;
3. проверить: новые image id backend / frontend; `docker ps` — оба `healthy`; boot-лог backend: `prisma migrate deploy`
   → 1 migration applied; строка `[InsightsModule] Раздел «Инсайты» выключен (ANALYTICS_INSIGHTS_ENABLED): хук
   расписания не подключён`; `[GrowthModule] … включён` как прежде; ошибок Nest 0;
4. nginx: префикс `/analytics/` уже в обоих белых списках (sslip-хост из образа, домен) — новых префиксов нет;
   `curl -s -o /dev/null -w '%{http_code}' https://raspechatkaa.ru/api/analytics/dashboard/insights/status` без токена
   → **401 JSON** (не HTML) на обоих хостах;
5. если compose пересоздал и другие сервисы из-за зависимостей — зафиксировать, проверить health, ошибкой не считать.

---

## 9. DISABLED-STATE CHECKS (OFF-gate) — сразу после deploy, флаг OFF

Временный ADMIN JWT подписывается **внутри контейнера** (`process.env.JWT_SECRET`, `expiresIn: 5m`) и в лог / отчёт не
попадает; EXECUTOR-токен — так же с ролью EXECUTOR.

| # | Запрос | Ожидание |
|---|---|---|
| 1 | без токена `GET …/insights/status`, `GET …/insights/feed`, `POST …/insights/run` | 401 |
| 2 | EXECUTOR `GET …/insights/feed`, `POST …/insights/run`, `POST …/insights/x/acknowledge` | 403 |
| 3 | ADMIN `GET …/insights/status` | 200, `enabled: false`, `engineVersion insights-v1`, `causality NOT_ESTABLISHED`, `detectors` — 19 id (в т. ч. `quality.eventNotMeasured`), `thresholds` = `INSIGHTS_RULES.md` § 2 (в т. ч. `eventGapMinFunnelVisits: 20`), `counts` все 0, `lastRun null`, `boundaries` (13.08 / 12.09 / инцидент 14–15.09) |
| 4 | ADMIN `GET …/insights/feed`, `GET …/insights/quality`, `GET …/insights/<uuid>`, `GET …/insights/<uuid>/versions` | **404** «Раздел аналитики выключен» |
| 5 | ADMIN `POST …/insights/run` (пустое тело), `POST …/insights/<uuid>/resolve` с телом `{}`, с телом `{ reason: 'x' }` (короче 3), с телом `{ customerPhone: '+7…' }` | **404** во всех четырёх — guard раньше ValidationPipe; ни 400, ни 201; в БД `AnalyticsInsightRun` = 0 строк, `AnalyticsInsight` = 0 |
| 6 | `GET …/insights/feed?severity=WRONG` | 404 (не 400 — валидация query тоже после guard) |
| 7 | Stage 09 `status`, `overview?period=30d`; Stage 10 `/behavior/summary`, `/behavior/issues?period=7d`; Stage 11 `growth/status`, `growth/changes` | 200, числа = BEFORE (§ 3) |
| 8 | панель `/crm/analytics?tab=insights` (production-JSON `status` в сборке кандидата) | карточка «Раздел «Инсайты» выключен»; остальные вкладки как прежде |
| 9 | ближайший тик расписания (boot-тик через ~1,5 мин после recreate и следующий часовой) | SUCCESS; в логе нет `insights:run` и строк «Сигналы: запуск»; `AnalyticsInsightRun` = 0; хук роста отработал как прежде |

Все 9 обязательны до § 11. Пункты 5–6 — обязательный gate «404 до ValidationPipe» (закрытие отклонения § 9.5 этапа 11).

---

## 10. МОМЕНТ ВКЛЮЧЕНИЯ — решение

**Вопрос Reviewer:** есть ли техническая причина откладывать enable до 27.09 (предложение исполнителя в § 49
OPEN_DECISIONS 3)?

Календарь сопоставимости для окон 7/7 (cutoff = T−1, «после» = [T−7, T−1], «до» = [T−14, T−8]):

| Дата rollout T | Окна | Заявки / формы (cutover 12.09 13:19) | Инцидент 14–15.09 | Воронки этапа 10 (шаги измеряются с 09 / 10 / 12.09) |
|---|---|---|---|---|
| 17.09 | 03–09.09 → 10–16.09 | «после» содержит 12.09 → `MEASUREMENT_DEFINITION_CHANGED` (вердикт этапа 11 `INCOMPARABLE`) — молчание с причиной | «после» пересекает → `INCIDENT_BOUNDARY` (ограничение в карточках, не молчание) | переходы с разными `measuredFrom` → `PARTIAL_BEHAVIOR_PERIOD` (зеркало этапа 10) |
| 20–26.09 | 06–12.09 → 13–19.09 | «до» содержит 12.09 → по-прежнему `MEASUREMENT_DEFINITION_CHANGED` | «до» пересекает → `INCIDENT_BOUNDARY` | окно «после» целиком после 12.09 — переходы сопоставимы |
| 27–29.09 | 13–19.09 → 20–26.09 | оба окна в новом определении → сравнение возможно, но ≈ 5 заявок / неделя → `LOW_SAMPLE` / `INSUFFICIENT_DATA` (MIN_EVENTS 5, MDE ≫ 20 %) | «до» пересекает 14–15.09 → `INCIDENT_BOUNDARY` | сопоставимы |
| ≥ 30.09 | 16–22.09 → 23–29.09 | как выше — сигнал по заявкам появится только при росте объёма | оба окна после инцидента | сопоставимы |

Что это меняет для production сейчас: **ничего технически опасного.** Каждое из ограничений — штатный путь движка:
несопоставимые метрики уходят в диагностику с кодом причины, инцидент становится ограничением карточки, незрелые
CRM-метрики — `IMMATURE`, малые выборки — `LOW_SAMPLE`. Ожидание до 27.09 не даёт сигналов по заявкам (объём всё равно
ниже гейта) и лишает владельца двух недель работающих детекторов, которым сопоставимость заявок не нужна: визиты
(Пуассон), зеркало правил этапа 10 (`DEVICE_GAP` — уже CRITICAL во вкладке «Поведение»), оценки этапа 11 дословно,
качество данных (покрытие ClientID, оплаты без даты, COGS, свежесть), пропуски измерения (FIX_01).

**Решение плана:** включать **в том же rollout-окне сразу после OFF-gate § 9** (как этапы 09–11), с ожидаемой
картиной первого запуска (§ 12): карточки по визитам / этапу 10 / этапу 11 / качеству данных, молчание по заявкам и
формам с кодами `MEASUREMENT_DEFINITION_CHANGED` / `INCOMPARABLE_PERIODS`, `IMMATURE` по оплатам, `LOW_SAMPLE` по
сущностям. Даты 20.09 / 27.09 / 30.09 — **контрольные точки наблюдения** (NEW FACTS в отчёт после каждого
автоматического daily-запуска), а не gate включения. Единственные технические условия enable — OFF-gate § 9 пройден
9/9 и тик расписания после deploy SUCCESS.

Если Reviewer всё же предпочтёт отложенное включение — план тот же, § 11 выполняется отдельной командой позже;
между deploy и enable раздел безвреден (миграция применена, хук не подключён, таблицы пустые).

---

## 11. CONTROLLED ENABLE

```text
cp /opt/raspechatka/.env /opt/raspechatka/.env.bak-stage12-enable-$(date +%Y%m%d-%H%M)
echo 'ANALYTICS_INSIGHTS_ENABLED=true' >> /opt/raspechatka/.env
cd /opt/raspechatka && docker compose -f docker-compose.prod.yml config | grep ANALYTICS_INSIGHTS_ENABLED   → "true"
docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps backend
```

Проверить сразу после старта (до первого тика): backend healthy; boot-лог `[InsightsModule] Раздел «Инсайты» включён:
хук расписания подключён`; `GET status` → `enabled: true`, `counts` 0, `lastRun null`; `GET feed` → `items: []`,
`suppressedSummary` пустой, `lastRun null` (пустое состояние — «Сейчас нет сигналов, требующих внимания»);
`POST …/<uuid>/resolve` `{}` → **400** со списком ошибок (валидация теперь работает); с лишним полем `customerPhone` →
400 `property customerPhone should not exist`; `GET …/<несуществующий uuid>` → 404 «Сигнал не найден»; EXECUTOR → 403;
без токена → 401. Включение — в окне после SUCCESS тика (§ 7).

---

## 12. CONTROLLED FIRST RUN

Первый запуск движка — **хук boot-тика** расписания (~1,5 мин после recreate; `afterSync`: SUCCESS daily-запусков
нет → `kind = daily`, полный контекст ~157 SQL). Исполнитель наблюдает его вживую:

1. лог: `Рост: автооценка …` → затем `Сигналы: запуск daily — обнаружено N, новых N, версий 0, без изменений 0, закрыто 0,
   переоткрыто 0, промолчало M, ошибок 0`; тик SUCCESS;
2. `AnalyticsInsightRun`: ровно 1 строка, `kind daily`, `status SUCCESS`, `observationCutoff = T−1`, `detectors 19`,
   `detected = created = N`, `errors []`, `durationMs` (цель § 24), `syncRunId` = id тика, `seenEvaluations {A: v}`;
3. `GET status` → `lastRun` = эта строка, `counts.OPEN = N`; `GET feed` → N карточек; `GET quality` → M причин молчания
   с текстами; `GET …/<id>/versions` → у каждой карточки ровно `[v1]`;
4. **сохранить JSON** `feed?status=all`, `quality`, `status` и все `versions` — эталон для § 13 и § 17;
5. затем **один** ручной `POST …/insights/run` (ADMIN, `kind manual`) — проверка идемпотентности и измерение § 24:
   ожидание `created 0, versioned 0, unchanged N, resolved 0, reopened 0` (исключение — `change.evaluation`, если между
   запусками этап 11 записал новую версию оценки: тогда `versioned 1` с `seenEvaluations` новой версии — зафиксировать).

Ожидаемая картина N / M при T ≈ 17–19.09 (ожидание, не требование; пороги под неё не подстраиваются):

```text
карточки (N ≈ 4–7):  [CRITICAL] stage10.issues DEVICE_GAP — если правило этапа 10 в окне «после» CRITICAL (сверить § 15.1)
                     [INFO] traffic.visits — если изменение визитов существенно (Пуассон + 20 % и 10 визитов)
                     [INFO] change.evaluation — оценка A этапа 11, вердикт INCOMPARABLE дословно (§ 15.3)
                     [INFO] quality.clientIdCoverage — покрытие ClientID у принятых (≈ 6 %) < 50 %
                     [INFO] quality.paidWithoutDate — оплаченные без даты оплаты (> 0 на 16.09: 11)
                     [INFO] quality.eventNotMeasured (photo) — если вход воронки фото ≥ 20 визитов (§ 15.2)
                     [INFO] quality.cogs — только при COGS_UNRELIABLE_ORDERS в окнах
молчание (M ≈ 45–55): site.leadRate / formStartRate / formErrorRate — MEASUREMENT_DEFINITION_CHANGED (INCOMPARABLE)
                     crm.leadToAccepted / leadToPaid — IMMATURE или LOW_SAMPLE; money.* — INSUFFICIENT_DATA / NO_MATERIAL_CHANGE /
                     COGS_INCOMPLETE; source.* / landing.change / product.change — LOW_SAMPLE (< 30 визитов) или DUPLICATE
                     (движутся с общим трафиком); stage10.issues — PARTIAL_BEHAVIOR_PERIOD / LOW_SAMPLE по переходам;
                     quality.stale — NO_MATERIAL_CHANGE (данные свежие); quality.eventNotMeasured — tshirt LOW_SAMPLE,
                     canvas NO_MATERIAL_CHANGE («шага на сайте не существует»)
```

Любая карточка вне этого списка — не STOP сама по себе (данные могли измениться), но обязана пройти § 13–16;
STOP — § 28.

---

## 13. PRODUCTION RECONCILIATION: API = service = SQL

Скрипт `stage12/recon.js` (использованный на копии) запускается **внутри backend-контейнера** против `dist/` (тот же
образ, та же база), режим **read-only** для B и C (ничего не пишет; единственная запись production — ручной run § 12.5):

```text
A  HTTP     GET feed?status=all, GET status, GET quality, GET <id>, GET <id>/versions — сохранённые карточки
B  service  AnalyticsInsightsService.buildContext('daily') + runDetectors(ctx, DETECTORS) в памяти (без записи):
            канонические нагрузки (canonicalPayload: без freshness / generatedAt / period / baselinePeriod / sync_run)
            каждой обнаруженной карточки = нагрузка сохранённой версии v1 (тот же payloadHash); причины молчания —
            те же коды и entityKey, что в журнале запуска
C  SQL      по датам окон из status.lastRun / карточек:
            visits «до» / «после» = Σ MetrikaDailyTraffic.visits; siteLeads / formStarts / formErrors = Σ MetrikaDailyGoal
            (lead_submitted / form_started / form_error); устройства — MetrikaDailyBehaviorDevice (для DEVICE_GAP);
            источники / страницы входа — MetrikaDailySource / MetrikaDailyLanding (для source.* / landing.change, в т. ч.
            причин DUPLICATE); шаги воронок — как /behavior/funnels?from&to (BehaviorMetricsService, тот же код этапа 10)
            и Σ MetrikaDailyGoal по целям шагов; когорты CRM — Overview.crmFunnel.cohorts этапа 08 за те же даты;
            покрытие ClientID — принятые заказы окна с ClientID / всего; paidWithoutDate — count(paid без paidAt);
            COGS_UNRELIABLE — как отчёты; свежесть — последний SUCCESS MetrikaSyncRun; оценка A — AnalyticsChangeEvaluation
            latest (verdict, version, тексты)
```

Gate: A = B по всем карточкам (matched N, diffs 0) и по кодам молчания; A/B = C по каждому числу в FACT / evidence
(current, baseline, sample, delta) diff 0; вердикт и версия этапа 11 в карточке `change.evaluation` = БД этапа 11.
Любая разница — STOP. На копии 16.09: matched 5 / diffs 0; 13 контрольных чисел diff 0.

---

## 14. ВСЕ 19 ДЕТЕКТОРОВ

`status.detectors` = 19 id; `lastRun.detectors = 19`; `errors = []`. Для каждого детектора в отчёте — строка
«исход на production»: карточка (id, уровень) **или** причина молчания (код + текст «чего не хватило» + выборка) **или**
«сущностей нет» с объяснением. Детектор без ни одного исхода при наличии сущностей — дефект (STOP).

| Детектор | Ожидание при T ≈ 17–19.09 | Чем сверяется |
|---|---|---|
| `traffic.visits` | INFO при существенном изменении, иначе NO_MATERIAL_CHANGE / LOW_SAMPLE; всегда `neutral` → не ATTENTION | C: Σ visits обоих окон; Пуассон этапа 11 |
| `site.leadRate`, `site.formStartRate`, `site.formErrorRate` | MEASUREMENT_DEFINITION_CHANGED (вердикт `INCOMPARABLE`), не карточка | Σ целей; окно содержит 12.09 |
| `stage10.issues` | зеркало `/behavior/issues?from&to` окна «после»: CRITICAL/ATTENTION те же, `skipped` → PARTIAL_BEHAVIOR_PERIOD / LOW_SAMPLE | § 15.1 |
| `source.mixShift` | карточка только при сдвиге ≥ 15 п.п. долей, иначе NO_MATERIAL_CHANGE | MetrikaDailySource |
| `source.performance`, `landing.change`, `product.change` | LOW_SAMPLE (< 30 визитов в обоих окнах) или DUPLICATE («движутся с общим трафиком») — карточки по сущностям только при собственном движении | MetrikaDailySource / MetrikaDailyLanding; товары — срез этапа 09 (`getProducts`) |
| `crm.leadToAccepted`, `crm.leadToPaid` | IMMATURE (maturityUntil в будущем) или LOW_SAMPLE (< 5 заказов) | когорты этапа 08 |
| `money.realizedRevenue`, `money.netProfit` | INSUFFICIENT_DATA / NO_MATERIAL_CHANGE; при неполной себестоимости — `COGS_INCOMPLETE` в ограничениях или причина молчания | `/reports/weekly` за те же даты |
| `change.evaluation` (hourly) | INFO: оценка A, вердикт INCOMPARABLE дословно; B (COMPLETED) — карточки нет | § 15.3 |
| `quality.stale` (hourly) | NO_MATERIAL_CHANGE с возрастом данных в тексте; карточки нет при FRESH | § 19 |
| `quality.clientIdCoverage` | INFO (≈ 6 % < 50 %, принятых ≥ 5) | § 15.4 |
| `quality.cogs` | INFO только при COGS_UNRELIABLE_ORDERS в окнах | § 15.4 |
| `quality.paidWithoutDate` | INFO при > 0 | § 15.4 |
| `quality.eventNotMeasured` (FIX_01) | photo — карточка или LOW_SAMPLE; tshirt — LOW_SAMPLE (вход < 20) или карточка; canvas — NO_MATERIAL_CHANGE | § 15.2 |

Пороги (`INSIGHTS_RULES.md` § 2) в бою **не подстраиваются**: другой исход — факт в отчёт, не правка констант.
Правка порога допустима только при обнаруженной ошибке (отдельный FIX через Reviewer).

---

## 15. ОТДЕЛЬНЫЕ PRODUCTION-ПРОВЕРКИ

### 15.1 DEVICE_GAP (зеркало правила этапа 10)

- `GET /behavior/issues?from=<after.from>&to=<after.to>` → issue `DEVICE_GAP` (уровень, доли по устройствам, визиты);
- карточка `stage10.issues` (entityKey `device:mobile`): тот же уровень (CRITICAL остаётся CRITICAL — закрытый список
  п. 5), те же числа в FACT (доля телефонов / компьютеров, визиты) и в `evidence.context`, `limitations` содержит
  `STAGE10_RULE_MIRROR`, `source STAGE10_RULE`, `link.tab = behavior`;
- в FACT нет причины («из-за», «потому что»); гипотеза — rule-based по сопутствующим фактам или NO_SUPPORTED_HYPOTHESIS;
  рекомендация — `CHECK_MANUALLY` (пройти путь на телефоне), не «переделать сайт»;
- если правило в окне «после» не CRITICAL — карточки CRITICAL быть не должно (тогда ATTENTION/INFO или молчание с кодом).

### 15.2 EVENT_NOT_MEASURED (FIX_01) — качество измерения, не поведение; `not_measured ≠ 0`

- `GET /behavior/funnels?from=<after.from>&to=<after.to>`: шаги `availability: 'not_measured'` имеют `visits: null`
  (не 0) — фото `catalog`, футболки `choose_type_color` / `submit_tshirt_order`, холсты `canvas_upload`; входные визиты
  каждой воронки;
- карточек `quality.eventNotMeasured` — **не больше одной на воронку** (entityKey = ключ воронки), ни одной «на шаг»;
  ожидание: photo — карточка при входе ≥ 20, иначе LOW_SAMPLE; tshirt — LOW_SAMPLE «на входе измеренной части N визитов
  (< 20) — анализ отвала сейчас не идёт»; canvas — NO_MATERIAL_CHANGE «шаг «Загрузили фото» на сайте не существует —
  ни одному анализу не нужен» (в `quality.suppressed` с этими текстами);
- карточка (если есть): `severity INFO`, `scope data`, `category DATA_QUALITY`; FACT называет анализ («анализ отвала
  воронки «Фотопечать» (правило этапа 10) ограничен»), шаг («Выбрали фото / формат» (цели catalog в счётчике нет)),
  «not_measured, не 0», список «нельзя сделать выводы: …», измеренную часть; `hypothesis.status
  NO_SUPPORTED_HYPOTHESIS` с текстом про настройку счётчика; `recommendation.kind IMPROVE_DATA_QUALITY`, текст содержит
  «web-photo … не менять»; `limitations` ⊇ [`NOT_MEASURED_STEPS`, `STAGE10_RULE_MIRROR`]; `evidence.context` только
  `step:<key>` с `before: null, after: null`; `fact.current / baseline / sample.current / sample.baseline` = null;
- **`not_measured` нигде не 0**: по всем карточкам и версиям — SQL `payload::text` не содержит `"before":0` / `"after":0`
  для `metric` вида `step:*`; в `/behavior/funnels` ни один `not_measured` шаг не имеет `visits: 0`; в `stage10.issues`
  переходы через не измеряемый шаг отсутствуют (Stage 10 их пропускает); UI (production-JSON в сборке кандидата):
  карточка подписана **«Качество измерения — не поведение клиентов»** (не «Гипотеза — не факт») и чипом «качество
  данных, не поведение», ограничение «часть шагов не измеряется», во вкладке «Поведение» шаг показан «не измеряется»,
  не «0».

### 15.3 Stage 11 INCOMPARABLE (карточка `change.evaluation`)

- `GET growth/changes/<A>/evaluations/latest` → `verdict.primary INCOMPARABLE`, версия v; карточка `change.evaluation`
  (entityKey = id A): заголовок содержит вердикт словами («окна несопоставимы»), не процент; `source
  STAGE11_EVALUATION`; `statisticalStrength` соответствует вердикту (не SIGNAL); `recommendation.kind
  USE_STAGE11_RECOMMENDATION` и текст = RECOMMENDATION оценки дословно; `limitations` ⊇ [`STAGE11_VERDICT_PRESERVED`];
  `evidence` хранит version v; `lastRun.seenEvaluations[A] = v`;
- дельта 0 → 4 % конверсии заявок **не** является заголовком или «положительным сигналом» ни в одной карточке
  (`site.leadRate` молчит с MEASUREMENT_DEFINITION_CHANGED);
- при новой версии оценки A на следующем daily-тике → карточка получает версию +1 в том же тике (порядок хуков § 7),
  без дублей карточек;
- B (COMPLETED) карточки не даёт; окна, пересекающие 14–15.09 → `INCIDENT_BOUNDARY` в `limitations` соответствующих
  карточек и `OVERLAPPING_CHANGE` среди confounders.

### 15.4 Quality detectors

| Детектор | Сверка |
|---|---|
| `quality.clientIdCoverage` | процент и знаменатель = Stage 09 `overview?from&to` (`clientIdCoverageAccepted`) и SQL по принятым заказам окна; текст «сопоставление сайт → заказ ненадёжно», рекомендация IMPROVE_DATA_QUALITY, без «клиенты …» |
| `quality.paidWithoutDate` | число = `select count(*) from "Order" where paid и paidAt is null` (как этап 08 `orders.paidWithoutDate`) |
| `quality.cogs` | число заказов с неполной себестоимостью = P&L `/reports/weekly` (COGS_UNRELIABLE_ORDERS) за окна |
| `quality.stale` | § 19 |

Все четыре — `INFO`, `category DATA_QUALITY`, гипотез о поведении клиентов нет.

---

## 16. FACT / HYPOTHESIS / RECOMMENDATION, ЯЗЫК, ОТСУТСТВИЕ CAUSAL CLAIMS

По каждой карточке и версии на production (скрипт в контейнере поверх `dist/insights-language`):

```text
causality              == "NOT_ESTABLISHED"      во всех строках AnalyticsInsight и во всех payload версий; в status
fact.text              описывает измеренное: числа = C (§ 13), окно, выборка; без слов причины
hypothesis             status ∈ {SUPPORTED_BY_CONCURRENT_FACTS, NO_SUPPORTED_HYPOTHESIS}; текст либо «Гипотеза: … . Причинность не установлена.»
                       с supportingFacts (числа), либо «Гипотезы нет: …»; для scope=data — всегда NO_SUPPORTED_HYPOTHESIS
recommendation         kind из словаря V1; никаких «отключить рекламу / менять бюджет / цены / удалить страницу / откатить сайт»
quality.notes          содержит DISCLAIMER (наблюдательные данные, не доказательство)
violatesLanguagePolicy(title | fact | hypothesis | recommendation | notes | suppressed.detail) == null для всех — 0 нарушений
grep -iE "доказан|доказыва|причин(а|ы|ой) (в|—)|благодаря|привел[оа] к|вызвал|из-за|отпугива|не нравится|слабый" по тем же
                       текстам = 0 (кроме разрешённого «Причинность не установлена»)
CRITICAL               только по закрытому списку (§ 4 правил): заявки исчезли / обрыв воронки / ошибки ≥ 10 / stale ≥ 6 ч /
                       CRITICAL этапа 10; ни одного CRITICAL из относительного процента на малой выборке
statisticalStrength ≠ businessMateriality хранятся отдельно; карточка с verdict INCOMPARABLE / INSUFFICIENT_DATA / IMMATURE
                       не имеет statisticalStrength SIGNAL
UI                     блоки ФАКТ / ГИПОТЕЗА — НЕ ФАКТ (пунктир, курсив) / ЧТО ПРОВЕРИТЬ визуально различимы; дисклеймер в шапке
```

Любое нарушение — STOP (это дефект, а не настройка).

---

## 17. LIFECYCLE / DEDUPE / VERSIONING / RESOLVED / REOPEN — без искусственных данных

| Проверка | Как на production | Ожидание |
|---|---|---|
| dedupe | ручной `POST run` сразу после первого (§ 12.5) | `created 0, versioned 0, unchanged N`; карточек по-прежнему N; `fingerprint` unique цел |
| stable fingerprint | сравнить `fingerprint` карточек между первым daily и daily следующего дня | те же значения (период в отпечаток не входит); карточек не стало «по одной на день» |
| versioning | daily-запуск следующего московского дня (00:17): у карточек с изменившимися числами (visits, coverage…) | `latestVersion 2`, `GET versions` → `[v1, v2]`; **v1 байт в байт = сохранённый JSON § 12.4** (`payload`, `payloadHash`, `generatedAt`); у карточек с той же сутью (`eventNotMeasured`, `paidWithoutDate` при том же числе) — `unchanged`, версия 1, `lastDetectedAt` и окно карточки сдвинуты |
| RESOLVED | естественно: условие пропало на одном из daily (например, `paidWithoutDate` → 0 после проставления дат владельцем, или `traffic.visits` вернулись в норму) | `status RESOLVED`, `resolvedAt`, `resolvedReason` «условие сигнала больше не выполняется»; версии сохранены; в `feed?status=active` нет, в `all` есть |
| reopen | естественно: условие вернулось ≤ 7 дней после RESOLVED | та же карточка `OPEN`, `reopened +1`, версия +1; между 7 и 10 днями → `COOLDOWN` в диагностике; позже → эпизод `#2` |
| MAX_ACTIVE_PER_DETECTOR | по журналу | лишние обнаружения детектора → `COOLDOWN`, активных ≤ 3 на детектор |
| ручные действия | **исполнитель не делает** acknowledge / resolve на production; владелец в owner smoke (§ 27) сам «принимает к сведению» карточку по своему выбору | после этого в БД `status ACKNOWLEDGED`, `acknowledgedAt`; повторный acknowledge → 400; карточка остаётся в `active` |
| удаления | — | строк из `AnalyticsInsight*` никто не удаляет; история версий полная |

RESOLVED / reopen на production проверяются **наблюдением по журналу** в дни после rollout (механизм покрыт тестами
5 FIX_01 и service.spec); в отчёте rollout фиксируется состояние на момент отчёта, остальное — NEW FACTS.

---

## 18. SUPPRESSION / DIAGNOSTICS

- `lastRun.suppressed` (журнал) = `quality.suppressed` (API) = `feed.suppressedSummary` по кодам; сумма по кодам = M;
- у каждой записи: `detectorId`, `metricKey`, `entityKey`, `reason` из словаря `SuppressionReason`, `detail` — текст
  «чего не хватило» с числами (выборка, порог, вердикт этапа 11), `sample`;
- обязательные объяснения: почему **нет** карточки заявок (`MEASUREMENT_DEFINITION_CHANGED`, вердикт INCOMPARABLE),
  почему **нет** карточек источников / страниц (`LOW_SAMPLE` с числом визитов или `DUPLICATE` «движутся вместе с общим
  трафиком — см. карточку визитов»), почему **нет** карточки EVENT_NOT_MEASURED по футболкам / холстам (§ 15.2),
  почему **нет** карточки оплат (`IMMATURE` с `maturityUntil`);
- UI: блок «Правил без вывода в последнем запуске» с разбивкой по причинам и текст «Молчание правила — не подтверждение
  отсутствия проблем»;
- в диагностике нет PII (§ 23) и нет причинных формулировок (§ 16).

---

## 19. STALE DETECTOR

На production данные свежие (тик каждый час), искусственно останавливать синхронизацию **запрещено** (флаги
`YANDEX_METRIKA_*` не трогать). Проверка:

- каждый hourly-запуск: `detectors 2` (`quality.stale`, `change.evaluation`), в `suppressed` — `quality.stale
  NO_MATERIAL_CHANGE` с возрастом данных в тексте («последняя синхронизация N мин назад»), `status.lastRun` и
  `quality.freshness` карточек = `FRESH`; порог `criticalStaleSeconds 21600` в `status.thresholds`;
- сценарии STALE (ATTENTION) / NO_DATA или ≥ 6 ч (CRITICAL) — тесты `insights-engine.spec` (I) и сверка на копии со
  сдвинутыми часами (§ 49 RECONCILIATION 6); на production воспроизводятся только при реальном сбое синхронизации —
  тогда карточка обязана появиться в ближайший hourly (наблюдение, NEW FACT).

---

## 20. GATES: MATURITY / MDE / COMPARABILITY / CLIENTID / COGS

| Gate | Где виден на production | Ожидание |
|---|---|---|
| maturity | `crm.leadToAccepted`, `crm.leadToPaid`, `money.*` в диагностике | `IMMATURE` с `maturityUntil` > cutoff (эмпирика CRM этапа 11); карточек по незрелым когортам нет |
| MDE / sample | `evidence.statistics` карточек по метрикам (`mde`, `relativeMde`, `requiredSample`); диагностика `LOW_SAMPLE` / `INSUFFICIENT_DATA` | заполнены; `NO_MATERIAL_CHANGE` не выдаётся при `relativeMde > 20 %` вместо `INSUFFICIENT_DATA` |
| comparability | `site.*` и любые метрики с окнами через 12.09 | `MEASUREMENT_DEFINITION_CHANGED` / `INCOMPARABLE_PERIODS`; `WEEKDAY_MIX_MISMATCH` отсутствует (окна — целые недели) |
| incident | окна через 14–15.09 | `INCIDENT_BOUNDARY` в `limitations` карточек, `OVERLAPPING_CHANGE` в confounders; `status.boundaries.incident` заполнен |
| ClientID | `quality.clientIdCoverage`; сопоставленные метрики | покрытие ≈ 6 % → карточка INFO; метрики, зависящие от сопоставления, не подаются как KPI (`MATCHED_COVERAGE_LOW`) |
| COGS | `money.netProfit`, `quality.cogs` | при неполной себестоимости — `COGS_INCOMPLETE` (ограничение или причина молчания); прибыль без оговорки при неполных расходах — STOP |
| polarity | `traffic.visits` | всегда INFO (neutral), никогда ATTENTION за падение трафика |

---

## 21. SCHEDULER daily / hourly И OVERLAP PROTECTION

| Проверка | Ожидание |
|---|---|
| boot-тик после enable | хук `insights:run` после `growth:evaluate` (порядок строк лога); `kind daily` (§ 12); тик SUCCESS |
| следующие часовые тики (`:17`) | `kind hourly`: `detectors 2`, ~12 SQL, `durationMs` ≪ daily; новых карточек нет (кроме `change.evaluation` при новой версии этапа 11 или stale при сбое) |
| первый тик нового московского дня (00:17) | `kind daily` (cutoff сдвинулся), `observationCutoff = вчера`; версии по изменившимся числам (§ 17); ровно один SUCCESS daily на cutoff: `count(*) where kind in (daily, manual) and status = SUCCESS group by observationCutoff` — версий за один cutoff у карточки ≤ 1 (кроме `change.evaluation`) |
| overlap | `AnalyticsInsightRun` со `status RUNNING` старше 10 мин — 0; ручной `POST run` во время тика → строка `LOCKED` (без записи карточек), а не вторая параллельная обработка; `unique(insightId, version)` — 0 ошибок в логе |
| сбой хука | тик остаётся SUCCESS (тест `metrika-analytics-scheduler.service.spec`); в бою — строка `FAILED` в журнале с `errors`, без stack trace в ответах API |
| циклы | минимум **два** автоматических цикла (boot-тик daily + часовой hourly) до owner smoke; желательно дождаться 00:17 daily для проверки версий (§ 17); `FAILED` = 0, зависших `RUNNING` = 0 |
| Метрика | число запросов к API Метрики за тик = как до rollout (Stage 12 к API не обращается) |

---

## 22. ОТСУТСТВИЕ LIVE-ЗАПРОСОВ К МЕТРИКЕ ИЗ ДАШБОРДА

Во время всех HTTP-проб § 9–18 и § 24 лог `YandexMetrikaClient` пуст — строки клиента Метрики только внутри тиков
(`:17`). Stage 12 читает только Postgres (`buildContext`) — в `dist/analytics/insights` нет импорта клиента Метрики
(`grep -l YandexMetrika dist/src/analytics/insights/*.js` = пусто). Любой запрос к Метрике вне тика — STOP.

---

## 23. PRIVACY

```sql
select title, fact::text, hypothesis::text, recommendation::text, evidence::text, quality::text, "entityKey" from "AnalyticsInsight";
select payload::text from "AnalyticsInsightVersion";
select suppressed::text, errors::text from "AnalyticsInsightRun";
```

Regex по тексту: телефоны `\+?7\d{10}|8\d{10}`, e-mail, `@username`, 19-значные ClientID, выборочно 5 фамилий клиентов
из `OrderPhoto` → **0** совпадений (даты и хвосты float — ложные, как на копии; отмечать явно). `entityKey` страниц
входа — только путь без query-string (`ym:s:startURLPath` → `landingPath` этапа 07); источники — названия каналов; товары — ключи каталога.
API JSON (`feed`, `quality`, `status`, `versions`) и UI-скриншоты — тот же regex → 0. DTO: лишние поля → 400 (§ 11).
Логи backend за rollout — без токенов / паролей (grep `Bearer`, `JWT_SECRET`, `password` = 0); JWT для проб —
только в памяти процесса внутри контейнера.

---

## 24. PERFORMANCE непосредственно на production

Внутри контейнера (`curl -w '%{time_total}'` на localhost:3000), cold — сразу после recreate:

| Запрос | Цель | STOP |
|---|---|---|
| хук daily (boot-тик) / `POST run` manual (daily) | `durationMs` ≤ 5,0 с (копия через туннель RTT 122 мс: 5,5–6,6 с при 157 SQL; в бою БД в соседнем контейнере) | > 20 с |
| hourly (12 SQL) | ≤ 2,0 с | > 10 с |
| `GET feed` (active / all) | ≤ 0,5 с (3 SQL) | > 3 с |
| `GET status`, `GET quality` | ≤ 0,5 с | > 3 с |
| `GET <id>`, `GET <id>/versions` | ≤ 0,3 с | > 2 с |
| Stage 09 `overview?period=30d`, Stage 11 `growth/status` после deploy | как BEFORE ± 10 % (шум первого холодного вызова допустим) | деградация × 2 |

N+1: `pg_stat_statements` в бою нет → число запросов — из копии (daily 157, hourly 12; константа, не зависит от числа
заказов / страниц); в бою — `pg_stat_database.xact_commit` до / после одного `POST run` ≈ 160 (±10 %), `tup_returned`
прирост порядка десятков тысяч строк, не миллионов; повторный run — тот же прирост (±5 %). Тик расписания с двумя
хуками (рост + сигналы) укладывается в интервал до следующего тика с большим запасом (минуты, не десятки минут).
Превышение цели — NEW FACT + OPEN DECISION (оптимизация отдельным FIX); STOP-порог — из таблицы.

---

## 25. REGRESSION Stage 06 / 09 / 10 / 11

| Этап | Проверка | Ожидание |
|---|---|---|
| 06 | outbox pending / failed до / после; последний успешный push заказов в Метрику | pending не растёт, failed = BEFORE, worker шлёт |
| 07/08 | тики SUCCESS каждый час, снимки пресетов 8 на тик (как после этапа 11) | как до rollout |
| 09 | `/analytics/dashboard/status`, `overview`, `trend`, `sources` — 200, числа = BEFORE за тот же период | diff 0 |
| 10 | `/behavior/summary`, `funnels`, `issues` 7d / 30d — 200; `skipped` с `PARTIAL_BEHAVIOR_PERIOD` на месте; `not_measured` шаги `visits: null` | diff 0 с BEFORE |
| 11 | `growth/status`, `growth/changes`, `changes/<A>/evaluations/latest` — 200, те же версии / вердикты; хук `growth:evaluate` на тиках как прежде (daily-версия A в 00:17); публичные `loadWindow / overlappingChanges / lastDataDay` не изменили оценку — v(T) A совпадает с ожиданием § 15 плана этапа 11 (INCOMPARABLE, OVERLAPPING_CHANGE [B]) | diff 0; Stage 11 тесты 47 прежние |
| UI | вкладки «Обзор / Инсайты / Поведение / Рост / Источники / Товары / Страницы / Качество» без ошибок консоли; новая вкладка не ломает ширину 390 px | скриншоты § 26 |
| CRM | заказы, задачи, Telegram-темы владельца — backend один и тот же | health, лог без ошибок |

---

## 26. UI DESKTOP / MOBILE

Как на этапе 11 (§ 35.17): исполнитель **не входит** в production-UI под учётной записью владельца; проверка UI —
production-JSON (`status`, `feed?status=all`, `quality`, карточки, `versions`) воспроизводится в сборке кандидата
(puppeteer, 1440 × 900 и 390 × 844):

- шапка: дисклеймер, `boundaries` (данные с 13.08, заявки с 12.09, инцидент 14–15.09);
- фильтры активные / все / закрытые × уровень × категория; сортировка: CRITICAL → ATTENTION → INFO;
- карточка: уровень, категория, окна «до / после», заголовок, ФАКТ / ГИПОТЕЗА — НЕ ФАКТ / ЧТО ПРОВЕРИТЬ, ограничения
  подписями, качество данных, впервые / последний раз / версия / эпизод, источник (этап 10 / этап 11 / детектор),
  переход к связанной вкладке, «Принять к сведению», «Детали» (сила статистики и существенность отдельно, контекст,
  confounders);
- карточка `scope = data` (FIX_01): подпись «Качество измерения — не поведение клиентов» + чип; обычные карточки —
  «Гипотеза — не факт»;
- блок «Правил без вывода» с причинами; пустое состояние при фильтре без карточек;
- 390 px: без горизонтальной прокрутки (`scrollWidth = clientWidth`), кнопки доступны, тексты не обрезаны;
- скриншоты в `docs/analytics/screenshots/12_insights/prod-*` (regex PII → 0).

---

## 27. OWNER SMOKE

Владелец, `raspechatkaa.ru/crm/analytics → Инсайты`:

1. видит дисклеймер и границы данных; понимает по подписям, где ФАКТ, где ГИПОТЕЗА — НЕ ФАКТ, где ЧТО ПРОВЕРИТЬ;
2. карточка «На телефонах конверсия заметно ниже» (если есть) совпадает по числам с вкладкой «Поведение» и не
   утверждает причину;
3. карточка «Оценка изменения 12.09» показывает «окна несопоставимы», а не процент роста;
4. карточки качества данных (покрытие ClientID, оплаты без даты, «шаг не измеряется») подписаны как качество данных /
   измерения, а не поведение клиентов; в карточке «шаг не измеряется» видно, какой шаг и что значение «не измеряется»,
   а не 0;
5. блок «Правил без вывода» объясняет, почему нет карточек по заявкам (несопоставимость с 12.09) и по оплатам (не созрели);
6. «Принять к сведению» на одной карточке по своему выбору → статус меняется, карточка остаётся видимой в «активные»;
7. телефон 390 px — без горизонтальной прокрутки.

Результат владелец фиксирует сам («OWNER SMOKE STAGE 12 ПРОЙДЕН» / замечания); исполнитель записывает в отчёт § 33.

---

## 28. STOP CONDITIONS

Немедленно STOP, ничего дальше не менять, отчёт Reviewer:

- git: `origin/master ≠ 5922175`, лишние коммиты в диапазоне, fast-forward невозможен, код кандидата ≠ 1f8b7b4;
- миграция: любой DROP / ALTER существующих таблиц; `_prisma_migrations` с ошибкой или `rolled_back_at`; таблиц ≠ 62;
- backend не healthy 5 минут после пересоздания; ошибки Nest при старте; `InsightsModule` не залогировал состояние;
- при OFF: любой маршрут раздела, кроме `status`, отвечает не 404 (в т. ч. **400 вместо 404** на теле `{}` — дефект
  guard); хук `insights:run` в логе; строки в `AnalyticsInsightRun`;
- auth: 200 без токена или для EXECUTOR на любом маршруте раздела;
- первый запуск: `status FAILED`, `errors ≠ []`, `detectors ≠ 19`, `LOCKED` при отсутствии другого запуска, `RUNNING`
  дольше 10 мин;
- reconciliation: A ≠ B или A/B ≠ C хотя бы по одному числу или коду молчания;
- `causality ≠ NOT_ESTABLISHED`; текст с причинной / психологической формулировкой; гипотеза без пометки; CRITICAL вне
  закрытого списка; `statisticalStrength SIGNAL` при вердикте INCOMPARABLE / INSUFFICIENT_DATA / IMMATURE; дельта
  конверсии заявок 0 → 4 % как заголовок или «положительный сигнал»;
- `not_measured` показан как 0 (payload, API этапа 10, UI); карточек `eventNotMeasured` больше одной на воронку или
  карточка по шагу, которого на сайте нет (canvas_upload); карточка data-scope подписана как гипотеза о поведении;
- прибыль без `COGS_INCOMPLETE` при неполных расходах; `traffic.visits` уровня ATTENTION;
- повторный run создал дубли (`created > 0` при тех же данных) или лишние версии (`versioned > 0` без изменения
  чисел / оценки этапа 11); v1 изменилась после v2;
- тик FAILED / дубли `MetrikaSyncRun` / зависший RUNNING / хук роста перестал писать версии;
- числа Stage 06/09/10/11 ≠ BEFORE; outbox failed растёт;
- PII в карточках / диагностике / API / UI; секрет в логе или отчёте;
- запуск daily > 20 с, feed > 3 с, или запросы к Метрике из HTTP-запросов дашборда.

---

## 29. ROLLBACK (без деструктивного отката БД)

```text
уровень 1 — выключить раздел:  ANALYTICS_INSIGHTS_ENABLED=false в .env (или удалить строку) →
                                docker compose up -d --force-recreate --no-deps backend → status.enabled = false,
                                маршруты → 404, хук не подключён; карточки, версии и журнал остаются — безвредны,
                                никто их не читает; при повторном включении движок продолжит с них (dedupe по отпечатку)
уровень 2 — откатить код:      revert коммитов диапазона в master (docs можно оставить) → push → auto-update;
                                таблицы AnalyticsInsight* остаются — их НЕ дропать; compose-строка флага безвредна;
                                «prisma migrate resolve» не применять; публичные загрузчики этапа 11 возвращаются к
                                private вместе с revert (оценка не меняется)
уровень 3 — compose / .env:    восстановить из .bak-stage12-* только если правка сломала запуск контейнера
DB restore из dump § 4:        только при повреждении данных, не связанном со Stage 12 (миграция существующие таблицы
                                не трогает); решение и выполнение — владелец по своему процессу
```

Ни один уровень не удаляет строк из существующих таблиц и не правит `_prisma_migrations` руками. Карточки — производные
данные: их можно пересчитать заново, поэтому «откат карточек» не нужен.

---

## 30. ВНЕ ROLLOUT / ЗАПРЕТЫ

- `web-photo`: код, event model (события, цели Метрики, параметры визитов), сборка сайта, CI (`build-images.yml`),
  ветка `feature/print-card-lead-form` — **не трогаются**; CI safety debt остаётся как зафиксирован в
  `11_PRODUCTION_ROLLOUT.md` § 31 (решение Reviewer / владельца отдельно);
- Logs API Метрики — не используется и не подключается;
- пороги V1 (`INSIGHTS_RULES.md` § 2, `insights-rules.ts`) во время rollout **не меняются**; неожиданный исход детектора
  — факт в отчёт; правка порога — только при обнаруженной ошибке отдельным FIX после решения Reviewer;
- `POST /analytics/dashboard/insights/run` остаётся **ADMIN-only** инструментом controlled rollout (первый запуск,
  идемпотентность, perf, сверка); кнопки в UI нет; назначение не расширяется (не «пересчитать по кнопке» для
  менеджеров); ручных запусков на production — не больше необходимого (§ 12.5, § 24: 2–3), каждый — строка журнала;
- искусственных данных нет: ни заявок, ни оплат, ни «тестовых изменений» этапа 11, ни ручных resolve исполнителем;
- контракты этапов 10 / 11, планировщик этапа 07 — не меняются.

---

## 31. ACCEPTANCE GATE

Rollout выполнен со стороны исполнителя, когда:

1. § 2–3 пройдены; master = кандидат; образы новые; health OK; миграция применена (62 таблицы, 83 миграции);
2. § 9 (OFF) — 9/9, в т. ч. 404 до ValidationPipe; § 11 (enable) — все проверки; § 12 — первый запуск наблюдён,
   журнал и эталонные JSON сохранены, ручной run идемпотентен;
3. § 13 diff 0; § 14 — исход каждого из 19 детекторов записан; § 15.1–15.4 — DEVICE_GAP / EVENT_NOT_MEASURED
   (качество измерения, `not_measured ≠ 0`) / INCOMPARABLE этапа 11 / quality — сверены; § 16 язык и causality без
   нарушений; § 17–18 lifecycle и диагностика; § 19–20 stale и гейты;
4. § 21 — минимум два автоматических цикла (daily + hourly), overlap-защита; § 22 Метрика 0; § 23 PII 0; § 24 perf в
   цели или NEW FACT; § 25 регрессий 0; § 26 UI desktop / mobile;
5. § 27 owner smoke пройден владельцем;
6. § 32 отчёт записан; DONE ставит Reviewer.

---

## 32. EXECUTOR_REPORT_STAGE12_PRODUCTION_ROLLOUT — формат

```text
RESULT (DONE_PENDING_REVIEW | BLOCKED | ROLLED_BACK)
GIT / DEPLOY           master до/после, кандидат, образы, время MSK
BACKUPS                имена файлов, размеры — без содержимого
MIGRATION              строки _prisma_migrations, таблиц 62, объекты
FLAG OFF CHECKS        § 9, 9 пунктов (404 до валидации отдельно)
ENABLE DECISION        § 10 — принятое решение и дата enable
ENABLE                 § 11: время, лог модуля
FIRST RUN              § 12: журнал, N карточек / M причин, идемпотентность
RECONCILIATION         § 13: A = B, A/B = C — числа и diff
DETECTORS 19           § 14: таблица исходов
DEVICE_GAP / EVENT_NOT_MEASURED / STAGE11 INCOMPARABLE / QUALITY   § 15
LANGUAGE / CAUSALITY   § 16
LIFECYCLE / DEDUPE / VERSIONS   § 17
SUPPRESSION            § 18
STALE / GATES          § 19–20
SCHEDULER              § 21: тики, kind, версии, overlap
METRIKA CALLS          § 22 = 0
PRIVACY                § 23
PERFORMANCE            § 24: cold / warm, xact_commit, tup_returned
REGRESSION 06/09/10/11 § 25
UI                     § 26: скриншоты desktop / mobile
OWNER SMOKE            запись владельца
NEW FACTS / DEVIATIONS / OPEN DECISIONS
PRODUCTION STATE       флаги, таблицы, что дальше не менять
```

---

## 33. ЧТО ФИКСИРУЕТСЯ ПОСЛЕ ROLLOUT (наблюдение, без действий на production)

- daily-запуски 20.09, 27.09, 30.09 — смена кодов молчания по заявкам / инциденту (§ 10 календарь) → NEW FACTS;
- первые естественные RESOLVED / reopen / версии — § 17;
- детектор длинного окна 28/28 — отдельный FIX после накопления истории (08.10; § 49 OPEN_DECISIONS 4).

---

## 34. START COMMAND

Rollout начинается только после отдельной команды Reviewer:

`СТАРТ`

с указанием подтверждённого кандидата (`1f8b7b4` или его docs-only потомок) и решения по моменту включения (§ 10:
в том же окне — по умолчанию плана; либо отложенно). До команды production не менять; этот документ — план, не отчёт.

---

# 35. EXECUTOR_REPORT_STAGE12_PRODUCTION_ROLLOUT — 17.09.2026

## RESULT

```text
DONE_PENDING_REVIEW — technical rollout выполнен 17.09.2026 09:10–10:37 MSK по команде Reviewer «СТАРТ» (docs-tip 53d2d25,
кодовый кандидат 1f8b7b4; решение § 10 — включить в том же окне). Раздел «Инсайты» выложен выключенным (09:29), OFF-gate
9/9 (в т. ч. 404 до ValidationPipe), включён 09:33:16, первый запуск — хук boot-тика 09:35:00 (daily, 8 карточек / 49 причин
молчания, ошибок 0), ручной run идемпотентен, сверка A = B = C diff 0, 19 детекторов с исходом, EVENT_NOT_MEASURED —
одна карточка на воронку как качество измерения, not_measured нигде не 0, causal claims 0, PII 0, perf в цели, два
автоматических цикла (daily 09:35 + hourly 10:33), Stage 06/09/10/11 без регресса. STOP-условий не возникло.
Исполнитель остановился на owner-smoke / reviewer gate: Stage 12 не закрыт, production после enable не менялся.
```

## 1. GIT / DEPLOY

```text
Pre-deploy gate (§ 2, 08:57–09:19 MSK): origin/master = 5922175 (owner-коммитов нет); кандидат 1f8b7b4, docs-tip 53d2d25
  (git diff --stat 1f8b7b4..53d2d25 -- . ':!docs' = пусто); master ⊂ 1f8b7b4 (fast-forward); список коммитов 5922175..1f8b7b4 =
  таблице § 2 (11 коммитов); изменённые файлы вне docs — 26, все в crm-new/prisma, crm-new/src/analytics/insights,
  analytics/growth (публичные загрузчики), app.module.ts, docker-compose.prod.yml, frontend/src/{api,features/analytics,pages,types};
  запрещённых областей (web-photo, .env, nginx, auto-update, behavior/, metrics/, metrika/, growth-rules, .github) — 0; worktree чист.
Build/test gate (§ 3): prisma validate OK; CRM jest 1078 / 1078 (99 suites); nest build OK; eslint insights 0; prettier чист;
  панель vitest 42 / 42, tsc -b OK, vite build OK, eslint аналитики 0. Schema = миграции: все 83 миграции применены на пустую
  временную БД prisma_shadow_stage12 (на сервере Postgres, удалена сразу после), prisma migrate diff → единственная разница —
  SalaryPayment.updatedAt default (миграция 20260613, есть в production master, к этапу 12 не относится — NEW FACT 4);
  по таблицам AnalyticsInsight* разницы нет.
Merge / push: git merge --ff-only 1f8b7b4 → push origin master 09:19:05 MSK (один push, без force); origin/master = 1f8b7b4.
CI «Сборка образов»: образы созданы 09:21:19 MSK. auto-update: frontend 5022f7ad3030 → 1485aa9b3150 09:21:27–09:22:27
  (nginx перечитан); backend 191f27494fbc → d8590e7c9e67 09:29:10–09:29:42 (между ними auto-update ждал окно перегенерации
  холста 09:22–09:28 — штатно). Boot backend 09:29:31–09:29:37: «83 migrations found… Applying 20260916120000_analytics_insights…
  All migrations have been successfully applied»; [GrowthModule] включён; [InsightsModule] «Раздел «Инсайты» выключен
  (ANALYTICS_INSIGHTS_ENABLED): хук расписания не подключён»; Nest started; health ok; ошибок 0.
nginx: GET https://raspechatkaa.ru/api/analytics/dashboard/insights/status и sslip-хост без токена → 401 JSON (оба).
Тик расписания после deploy (boot, 09:31:16, daily 28.08–17.09): SUCCESS 12/12, снимки 8/8, хук роста отработал, хука сигналов нет.
```

## 2. BACKUPS (§ 4)

```text
16.09 22:52 (первая попытка, сессия прервалась до деплоя): docker-compose.prod.yml.bak-stage12-20260916-2252, .env.bak-stage12-20260916-2252,
  backups/premigration_stage12_insights_20260916_225256.sql.gz — 789 826 B.
17.09 09:10 (использованы в rollout): /opt/raspechatka/docker-compose.prod.yml.bak-stage12-20260917-0910 (176 строк),
  /opt/raspechatka/.env.bak-stage12-20260917-0910 (51 строка; содержимое не выводилось),
  /opt/raspechatka/backups/premigration_stage12_insights_20260917_091010.sql.gz — 804 076 B, CREATE TABLE в дампе 96, заголовок
  «PostgreSQL database dump» читается, запись в backups/backup.log. Перед enable: .env.bak-stage12-enable-20260917-0932.
```

## 3. MIGRATION (§ 5)

```text
Файл 20260916120000_analytics_insights/migration.sql (97 строк, sha256 606f241ad17bc943…): CREATE TABLE 3, CREATE INDEX 5
(2 unique), ALTER TABLE 1 (FK AnalyticsInsightVersion → AnalyticsInsight ON DELETE CASCADE), DROP/TRUNCATE/DELETE/UPDATE/RENAME/
ALTER существующих таблиц 0; ссылок на Order*/Metrika*/User*/Task*/Expense*/AnalyticsChange*/Behavior*/Salary* — 0.
До deploy: 82 миграции, 59 таблиц, AnalyticsInsight* 0. Применена на старте контейнера 09:29:31 MSK (prisma migrate deploy):
_prisma_migrations: 20260916120000_analytics_insights finished_at 09:29:31, rolled_back_at null; applied = 83.
После: таблиц public = 62; AnalyticsInsight, AnalyticsInsightVersion, AnalyticsInsightRun (0/0/0 строк на момент deploy);
индексов по ним 8 (5 + 3 PK), FK 1. migrate dev / migrate resolve / правки _prisma_migrations — не применялись.
```

## 4. FLAG OFF CHECKS (§ 9) — 09:30:5x–09:31:03 MSK, ANALYTICS_INSIGHTS_ENABLED не задан → false

```text
1  без токена GET status / GET feed / POST run                        → 401 / 401 / 401 ✓
2  EXECUTOR GET feed / POST run / POST :id/acknowledge                 → 403 / 403 / 403 ✓
3  ADMIN GET status                                                    → 200: enabled false, engineVersion insights-v1,
                                                                          causality NOT_ESTABLISHED, detectors 19 (в т. ч.
                                                                          quality.eventNotMeasured; hourly = change.evaluation,
                                                                          quality.stale), thresholds 26 (eventGapMinFunnelVisits 20,
                                                                          criticalStaleSeconds 21600), counts все 0, lastRun null,
                                                                          boundaries 13.08 / 12.09 10:19Z / инцидент 14.09 15:20Z–15.09 17:32Z ✓
4  ADMIN GET feed / quality / :uuid / :uuid/versions                    → 404 «Раздел аналитики выключен» ×4 ✓
5  ADMIN POST run (без тела); POST :uuid/resolve {} / {"reason":"x"} / {"reason":"probe reason","customerPhone":"+7…"};
   POST :uuid/acknowledge {}                                           → 404 ×5 — guard раньше ValidationPipe, ни одного 400 ✓
6  ADMIN GET feed?severity=WRONG                                       → 404 (не 400) ✓
   БД после проб: AnalyticsInsightRun 0, AnalyticsInsight 0 ✓
7  Stage 09 status / overview 30d / 7d; Stage 10 summary / issues / funnels 7d; Stage 11 growth status / changes / A latest → 200 ✓
   (сравнение с BEFORE 09:10 — § 16)
8  панель (production-JSON status в сборке кандидата): карточка «Раздел «Инсайты» выключен», запросов раздела кроме status — 0;
   вкладки Обзор / Поведение / Рост рендерятся ✓ (screenshots/12_insights/prod-insights-disabled.png)
9  boot-тик 09:31:16 (daily): SUCCESS 12/12, снимки 8/8; в логе insights:run = 0, «Сигналы: запуск» = 0; AnalyticsInsightRun 0 ✓
Итого 9/9. Отклонение § 9.5 этапа 11 (400 вместо 404) не воспроизводится.
```

## 5. ENABLE DECISION (§ 10)

```text
Reviewer подтвердил решение плана: после успешного OFF-gate включить ANALYTICS_INSIGHTS_ENABLED=true в том же окне.
Технических причин ждать 27.09 нет: несопоставимые заявки/формы (окна через 12.09) ушли в диагностику
MEASUREMENT_DEFINITION_CHANGED, незрелые CRM/деньги — IMMATURE, инцидент — INCIDENT_BOUNDARY; работают детекторы, которым
сопоставимость заявок не нужна (визиты, зеркало этапа 10, оценка этапа 11, качество данных, FIX_01). Контрольные точки
наблюдения — 20.09 / 27.09 / 30.09 (§ 33).
```

## 6. ENABLE (§ 11) — 09:32:51–09:33:36 MSK

```text
.env: строка ANALYTICS_INSIGHTS_ENABLED=true добавлена (52 строки); compose config → "true"; RUNNING sync 0, insight runs 0.
docker compose up -d --force-recreate --no-deps backend 09:32:51 → running:healthy 09:33:19; образ d8590e7c9e67 (тот же);
frontend не пересоздавался. Boot: «No pending migrations to apply»; [InsightsModule] «Раздел «Инсайты» включён: хук расписания
подключён» 09:33:16; env в контейнере dashboard=true growth=true insights=true; nginx reload ok.
Проверки до первого запуска: GET status 200 enabled true, counts 0, lastRun null; GET feed 200 items [] (пустое состояние);
POST :uuid/resolve {} → 400 (reason: string 3–300); с customerPhone → 400 «property customerPhone should not exist»;
GET :uuid → 404 «Сигнал не найден»; GET feed?severity=WRONG → 400 (INFO/ATTENTION/CRITICAL); EXECUTOR → 403; без токена → 401.
```

## 7. FIRST RUN (§ 12)

```text
Boot-тик 09:34:56 (scheduler:daily 28.08–17.09, наборов 12, запросов 23, строк 3858) → снимки 8/8 09:35:00 →
[AnalyticsGrowthService] Рост: автооценка — изменений 0 (09:35:00) → [AnalyticsInsightsService] 09:35:05:
«Сигналы: запуск daily — обнаружено 8, новых 8, версий 0, без изменений 0, закрыто 0, переоткрыто 0, промолчало 49, ошибок 0».
Порядок хуков: рост → сигналы (строки лога 09:35:00 → 09:35:05) ✓.
AnalyticsInsightRun #1: kind daily, SUCCESS, 09:35:00–09:35:05, observationCutoff 2026-09-16, detectors 19, detected 8, created 8,
versioned 0, unchanged 0, resolved 0, reopened 0, suppressed 49, errors [], durationMs 4282, syncRunId = id тика (совпадает с
последним SUCCESS MetrikaSyncRun), seenEvaluations {222c1b8e… (A): 10}. Окна 03–09.09 → 10–16.09.
Карточки (8; status OPEN; latestVersion 1 у всех; periodStart/End 10.09–16.09):
  [ATTENTION] DEVICE_GAP           stage10.issues (device:mobile)   «На телефонах конверсия заметно ниже, чем на компьютерах»
  [INFO] CHANGE_EVALUATION         change.evaluation (A)             «Оценка изменения «Деплой сайта 12.09…» обновилась: v10 — окна несопоставимы»
  [INFO] PRODUCT_CHANGE            product.change (PHOTO)            «Категория PHOTO: принятых заказов меньше — 38 → 19 за 7 дней»
  [INFO] DATA_QUALITY              quality.clientIdCoverage          «Покрытие ClientID у принятых заказов 15 % — сопоставление сайт → заказ ненадёжно»
  [INFO] DATA_QUALITY              quality.eventNotMeasured (photo)  «Воронка «Фотопечать»: шаг не измеряется — анализ отвала ограничен»
  [INFO] DATA_QUALITY              quality.paidWithoutDate           «6 оплаченных заказов без даты оплаты — когорты оплат смещены»
  [INFO] SOURCE_MIX_SHIFT          source.mixShift (Переходы по рекламе) «Структура источников сдвинулась: «Переходы по рекламе» 75,1 % → 59,5 % визитов»
  [INFO] TRAFFIC_CHANGE            traffic.visits                    «Визиты снизились: 229 → 116 за 7 дней»
CRITICAL — 0 (DEVICE_GAP в окне 10–16.09 у этапа 10 уровня ATTENTION — зеркалится как есть).
Эталонные JSON сохранены (/root/stage12/on/first: status, feed all/active, quality, 8 карточек, 8 versions; sha256 v1 payload:
eventNotMeasured 9abdc738ff02dd62, change.evaluation a4770277638f24ab, stage10.issues 342d76b5984f0b6d, traffic.visits 46b7ead75fa36579,
source.mixShift 2be206fca45d7cd9, paidWithoutDate 2adb140772e2d76c, clientIdCoverage b26c0a556dbf488a, product.change 2eb3b3dea693066c;
generatedAt 09:35:00 у всех) — для проверки неизменяемости v1 после первой версии v2.
Ручной POST run (§ 12.5, единственный, 09:36:13): HTTP 200 за 3901 мс; kind manual, SUCCESS, cutoff 16.09, detectors 19, detected 7,
created 0, versioned 0, unchanged 7, resolved 0, reopened 0, suppressed 50 (= 49 + change.evaluation DUPLICATE: версия v10 уже
учтена), errors [], durationMs 3694. Версий по-прежнему 8, карточек 8, запусков 2 ✓ (идемпотентность).
```

## 8. RECONCILIATION (§ 13) — s12-recon.js внутри backend-контейнера, read-only, 09:39 MSK

```text
A (HTTP ADMIN, JWT подписан в процессе): status 200 (counts OPEN 8), feed all 8 / active 8, quality (suppressed 50, recentRuns 2),
  versions у каждой карточки = [v1]; feed.suppressedSummary = quality.suppressedSummary = журнал.
B (сервис: buildContext('daily', {}) + runDetectors в памяти, без записи): 139 SQL, 3,7 с; окна 03–09.09 → 10–16.09, cutoff 16.09,
  freshness FRESH, изменений реестра 2, confounders SOURCE_MIX_SHIFT, DEVICE_MIX_SHIFT, MEASUREMENT_DEFINITION_CHANGED,
  OVERLAPPING_CHANGE, MATCHED_COVERAGE_LOW; detected 8, suppressed 49, errors 0.
A = B: matched 8, diffs 0 (канонические нагрузки сохранённых v1 = нагрузки B по всем 8 карточкам, включая change.evaluation),
  A-only 0; причины молчания (без change.evaluation, чей DUPLICATE зависит от seenEvaluations): A 46 = B 46, only-A 0, only-B 0.
C (SQL / сервисы этапов 08–11 за те же даты):
  visits.before 229 = 229; visits.after 116 = 116; siteLeads.before 0 = 0; siteLeads.after 8 = 8; siteLeadRate.after 6,897 = 6,897;
  formStarts.after 23 = 23; formErrors.after 1 = 1; crmLeads.after (когорты этапа 08) 5 = 5; acceptedOrders.after 26 = 26;
  realizedRevenue.after 54 996 = 54 996; netProfit.before 49 515 = 49 515; clientIdCoverageAccepted 15,385 = 15,385; paidWithoutDate 6 = 6.
  Карточки: stage10.issues DEVICE_GAP — FACT и уровень = /behavior/issues окна «после» (ATTENTION); traffic.visits 229 → 116 = Σ SQL;
  source.mixShift FACT = confounder этапа 11; paidWithoutDate 6 = overview; clientIdCoverage 15,385 = overview;
  change.evaluation — вердикт INCOMPARABLE = этап 11 v10, FACT начинается с FACT оценки, RECOMMENDATION дословно,
  kind USE_STAGE11_RECOMMENDATION.
A/B = C: 13 чисел + карточки, diffs 0.
```

## 9. DETECTORS 19 (§ 14) — исход в последнем полном запуске (manual 09:36)

```text
traffic.visits            daily   карточка INFO (229 → 116, Пуассон p 1,2e-9, полярность neutral)
site.leadRate             daily   MEASUREMENT_DEFINITION_CHANGED «0,0 % (0 из 229) → 6,9 % (8 из 116); вердикт этапа 11 — INCOMPARABLE»
site.formStartRate        daily   MEASUREMENT_DEFINITION_CHANGED «0,0 % → 19,8 % (23 из 116); INCOMPARABLE»
site.formErrorRate        daily   MEASUREMENT_DEFINITION_CHANGED
stage10.issues            daily   карточка ATTENTION DEVICE_GAP; молчание 6: PARTIAL_BEHAVIOR_PERIOD ×3 (FUNNEL_DROPOFF фото / футболки /
                                  холсты — шаги измерены с разных дат 10.09 и 12.09), LOW_SAMPLE ×2 (форма контактов < 20; ошибок формы < 5),
                                  INCOMPARABLE_PERIODS ×1 (LEAD_RATE_ANOMALY — нет сопоставимого предыдущего периода)
source.mixShift           daily   карточка INFO (доля «Переходы по рекламе» 75,11 → 59,48 %, −15,63 п.п.)
source.performance        daily   LOW_SAMPLE ×4, DUPLICATE ×1 («Переходы по рекламе» движутся с общим трафиком — см. карточку визитов)
landing.change            daily   LOW_SAMPLE ×23, DUPLICATE ×1 («/» движется с общим трафиком)
product.change            daily   карточка INFO (PHOTO: принятых 38 → 19, p 0,016; CRM_INCLUDES_OFFLINE, IMMATURE_OUTCOME); INSUFFICIENT_DATA ×2
crm.leadToAccepted        daily   IMMATURE («100,0 % (14 из 14) → 100,0 % (5 из 5); созревание до …»)
crm.leadToPaid            daily   IMMATURE
money.realizedRevenue     daily   IMMATURE («78 033 ₽ → 54 996 ₽; созревание до 30.09.2026»)
money.netProfit           daily   IMMATURE («49 515 ₽ → 26 977 ₽; созревание до 30.09.2026»)
change.evaluation         hourly  карточка INFO (A v10 INCOMPARABLE); в повторе DUPLICATE ×1 (версия учтена), INSUFFICIENT_DATA ×1 (B COMPLETED)
quality.stale             hourly  NO_MATERIAL_CHANGE «данные Метрики свежие (возраст 77 с, порог 7200 с)»
quality.clientIdCoverage  daily   карточка INFO (15 % при 26 принятых, порог 50 %)
quality.cogs              daily   NO_MATERIAL_CHANGE (заказов с ненадёжной себестоимостью в окнах нет)
quality.paidWithoutDate   daily   карточка INFO (6)
quality.eventNotMeasured  daily   карточка INFO (photo); LOW_SAMPLE ×1 (tshirt), NO_MATERIAL_CHANGE ×1 (canvas)
Все 19 имеют исход; детекторов без исхода 0; errors []. Пороги V1 не менялись.
```

## 10. DEVICE_GAP / EVENT_NOT_MEASURED / STAGE 11 INCOMPARABLE / QUALITY (§ 15)

```text
15.1 DEVICE_GAP: /behavior/issues окна 10–16.09 → DEVICE_GAP [ATTENTION] device:mobile; skipped: FUNNEL_DROPOFF PARTIAL_BEHAVIOR_PERIOD ×3,
  FUNNEL_DROPOFF LOW_SAMPLE, FORM_ERROR_SPIKE LOW_SAMPLE, LEAD_RATE_ANOMALY COMPARISON_UNAVAILABLE. Карточка: ATTENTION (тот же уровень),
  source STAGE10_RULE, FACT = fact правила («телефоны 4,3 % (47 визитов), компьютеры 9 % (67 визитов); отношение 0.48»), рекомендация =
  recommendation правила (CHECK_MANUALLY: пройти путь на 360–430 px, сравнить ошибки формы и источники по устройствам), гипотеза
  «Возможны трудности с формой или страницей на мобильных, либо разный состав трафика по устройствам — данные это не различают.
  Причинность не установлена.», limitations STAGE10_RULE_MIRROR + INCIDENT_BOUNDARY, link → «Поведение». Причин в FACT нет.
15.2 EVENT_NOT_MEASURED: /behavior/funnels окна «после» — global: вход 116, not_measured нет; photo: вход form_started_photo 31,
  catalog visits = null; tshirt: вход view_custom_tshirt 13, choose_type_color / submit_tshirt_order visits = null; canvas: вход 7,
  canvas_upload visits = null; contact: вход 0. Нулей среди not_measured шагов — 0.
  Карточек quality.eventNotMeasured — 1 (photo), максимум на воронку 1, «на шаг» — 0. Карточка: INFO, scope data, DATA_QUALITY;
  FACT: «Анализ отвала воронки «Фотопечать» (правило этапа 10) ограничен: не измеряется шаг — «Просмотр каталога / товара» (События
  просмотра каталога фото нет; есть только e-commerce «detail»…). Значение таких шагов — not_measured, не 0. Нельзя сделать выводы: …»;
  hypothesis NO_SUPPORTED_HYPOTHESIS «Гипотезы нет: отсутствие измерения — известный факт настройки счётчика, а не поведение
  клиентов»; recommendation IMPROVE_DATA_QUALITY (цель на уже отправляемое событие / зафиксировать как намеренно неизмеряемый /
  измерение отдельным решением; «Событийную модель сайта (web-photo) … не менять»); limitations NOT_MEASURED_STEPS, STAGE10_RULE_MIRROR;
  fact.current / baseline / sample.current / sample.baseline = null (minimum 20); evidence.context [{step:catalog, before null, after null}].
  Молчание: tshirt LOW_SAMPLE «не измеряются «Выбрали крой / цвет», «Отправили форму», но на входе измеренной части 13 визитов (< 20) —
  анализ отвала сейчас не идёт, пропуск ничего не ограничивает»; canvas NO_MATERIAL_CHANGE «шаг(и) «Загрузили фото» на сайте не
  существуют — ни одному анализу не нужны, карточка не создаётся».
  not_measured ≠ 0: в payload всех версий «step:*» с before/after = 0 — 0; в API этапа 10 not_measured шаги — visits null; во вкладке
  «Поведение» (replay) «не измеряется … 0» — 0 совпадений; в карточке подпись «Качество измерения — не поведение клиентов» + чип
  «качество данных, не поведение» (у трёх data-карточек), ограничение «часть шагов не измеряется».
15.3 Stage 11: A latest v10 INCOMPARABLE; карточка change.evaluation v1 INFO, statisticalStrength NONE, businessMateriality NONE,
  заголовок «… обновилась: v10 — окна несопоставимы» (процента нет), recommendation USE_STAGE11_RECOMMENDATION = RECOMMENDATION оценки
  дословно («Сравнивать окна, целиком лежащие после смены определения (13.09.2026); до этого — не делать выводов»), limitations
  STAGE11_VERDICT_PRESERVED, EXCLUDED_CUTOVER_DAY, SHORT_WINDOW, WEEKDAY_MIX_MISMATCH, METRIC_UNAVAILABLE_BEFORE,
  MEASUREMENT_DEFINITION_CHANGED, INCOMPARABLE_WINDOWS, OVERLAPPING_CHANGE; seenEvaluations {A: 10}. Дельта конверсии заявок
  (0 → 6,9 % в окнах 7/7; +494 % в оценке этапа 11) заголовком или «положительным сигналом» не является: site.leadRate молчит
  (MEASUREMENT_DEFINITION_CHANGED), заголовков про заявки с процентом — 0. B (COMPLETED) карточки не даёт (INSUFFICIENT_DATA).
  INCIDENT_BOUNDARY — у stage10.issues, traffic.visits, source.mixShift; OVERLAPPING_CHANGE — в confounders контекста и в limitations
  traffic.visits.
15.4 Quality: clientIdCoverage 15,385 % (26 принятых) = overview.dataQuality.clientIdCoverageAccepted; paidWithoutDate 6 = overview.orders;
  quality.cogs — NO_MATERIAL_CHANGE (COGS_UNRELIABLE_ORDERS нет); quality.stale — § 12. Все INFO, DATA_QUALITY, гипотез о поведении нет.
```

## 11. LANGUAGE / CAUSALITY (§ 16)

```text
94 текста (title / fact / hypothesis / recommendation / quality.notes 8 карточек + 50 detail причин молчания):
violatesLanguagePolicy по title / fact / hypothesis / recommendation / detail — 0; causality NOT_ESTABLISHED — 8/8 и в status;
гипотезы: 3 SUPPORTED_BY_CONCURRENT_FACTS (все с префиксом «Гипотеза: » и суффиксом «Причинность не установлена.»), 5 NO_SUPPORTED_HYPOTHESIS
(в т. ч. все три data-scope); CRITICAL вне закрытого списка — 0 (CRITICAL нет); statisticalStrength SIGNAL при INCOMPARABLE /
INSUFFICIENT_DATA / IMMATURE — 0; дисклеймер в quality.notes — у 8/8; рекомендации: CHECK_MANUALLY 2, IMPROVE_DATA_QUALITY 3, OBSERVE 1,
COMPARE_SEGMENT 1, USE_STAGE11_RECOMMENDATION 1 — предложений отключить рекламу / менять бюджет, цены / удалять страницы / откатывать сайт нет.
Единственные срабатывания (8 policy + 8 grep) — сам текст дисклеймера в quality.notes: «Сигнал — наблюдение по данным, а не
установленная причина: совпадение по времени не доказывает связь» (слова «причина», «не доказывает» в отрицании причинности).
В UI causal-regex даёт 9 = 8 дисклеймеров карточек + дисклеймер шапки. Причинных утверждений — 0 (NEW FACT 5: область проверки).
```

## 12. LIFECYCLE / DEDUPE / VERSIONS (§ 17)

```text
dedupe: ручной run сразу после первого → created 0, versioned 0, unchanged 7 (+ change.evaluation DUPLICATE); карточек 8, версий 8;
  fingerprint unique цел (8 отпечатков без «#N»).
versions: у всех карточек latestVersion 1, versions = [v1] (generatedAt 09:35:00); sha256 v1 payload записаны (§ 7) — неизменяемость
  проверяется при первой v2 (первый daily с изменившимися числами — 18.09 00:35 или позже) → NEW FACT после rollout.
RESOLVED / reopen / COOLDOWN / MAX_ACTIVE — на production не форсируются (искусственных данных нет); механизм — тесты (service.spec 11,
  FIX_01 тест 5); первые естественные RESOLVED / переоткрытия — наблюдение (§ 33). MAX_ACTIVE_PER_DETECTOR: активных ≤ 1 на детектор.
ручные действия: исполнитель acknowledge / resolve на production не выполнял; статусы 8 × OPEN; «Принять к сведению» — владелец в owner smoke.
удалений строк нет.
```

## 13. SUPPRESSION / DIAGNOSTICS (§ 18)

```text
Журнал последнего полного запуска (manual) = GET quality.suppressed = feed.suppressedSummary: 50 = {LOW_SAMPLE 30,
MEASUREMENT_DEFINITION_CHANGED 3, PARTIAL_BEHAVIOR_PERIOD 3, INCOMPARABLE_PERIODS 1, DUPLICATE 3, INSUFFICIENT_DATA 3, IMMATURE 4,
NO_MATERIAL_CHANGE 3} (boot daily: 49 — без DUPLICATE change.evaluation). У каждой записи detectorId / metricKey / entityKey / reason /
detail с числами и порогом. Объяснено: нет карточки заявок (MEASUREMENT_DEFINITION_CHANGED, вердикт INCOMPARABLE), нет карточек
источников / страниц (LOW_SAMPLE с числами визитов; DUPLICATE «движутся вместе с общим трафиком — см. карточку визитов»), нет карточек
EVENT_NOT_MEASURED по футболкам / холстам (§ 10), нет карточек оплат / прибыли (IMMATURE, созревание до 30.09). UI: блок «Правил без
вывода в последнем запуске: 50» с разбивкой по причинам и текст «Молчание правила — не подтверждение отсутствия проблем».
PII и причинных формулировок в detail — 0.
```

## 14. STALE / GATES (§ 19–20)

```text
stale: данные свежие — quality.stale в daily / hourly → NO_MATERIAL_CHANGE «данные Метрики свежие (возраст 77 с, порог 7200 с)»;
  freshness FRESH во всех карточках; status.thresholds.criticalStaleSeconds 21600. Сценарии STALE / NO_DATA — тесты и сверка на копии
  (§ 49); на production воспроизводятся только при реальном сбое синхронизации.
maturity: crm.leadToAccepted / leadToPaid / money.* → IMMATURE с «созревание до 30.09.2026»; карточек по незрелым когортам нет
  (product.change PHOTO — по принятым заказам с ограничением IMMATURE_OUTCOME и CRM_INCLUDES_OFFLINE).
MDE / sample: traffic.visits evidence.metricEvaluation.statistics — метод poisson_conditional_binomial_exact, p 1,18e-9,
  MDE 59,96 визитов (26,18 %), requiredSample.perWindow 432; в FACT «при текущем объёме заметен эффект от ±26 % базы».
  LOW_SAMPLE 30 / INSUFFICIENT_DATA 3 в диагностике; NO_MATERIAL_CHANGE вместо INSUFFICIENT_DATA при большом MDE — не наблюдается.
comparability: site.* → MEASUREMENT_DEFINITION_CHANGED; WEEKDAY_MIX_MISMATCH у окон 7/7 нет (есть только внутри карточки оценки этапа 11 —
  её собственные окна). incident: INCIDENT_BOUNDARY у трёх карточек; status.boundaries.incident заполнен. ClientID: 15 % → карточка,
  MATCHED_COVERAGE_LOW в confounders. COGS: полная (NO_MATERIAL_CHANGE), прибыль без оговорки не показывается (IMMATURE).
polarity: traffic.visits INFO при −49 % (не ATTENTION).
```

## 15. SCHEDULER (§ 21)

```text
После enable интервал тиков сдвинулся на минуту старта контейнера (:33 вместо :17):
цикл 1  boot-тик 09:34:56 → daily (первый полный запуск, § 7) — SUCCESS, 4282 мс, syncRunId = id тика
        (ручной run 09:36 — kind manual, отдельная строка журнала, замок не сработал — запусков параллельно не было)
цикл 2  часовой тик 10:33:24 (hourly 15–17.09, 12/12 SUCCESS, строк 513) → снимки → «Рост: автооценка — изменений 0» 10:33:29 →
        «Сигналы: запуск hourly — обнаружено 0, новых 0, версий 0, без изменений 0, закрыто 0, переоткрыто 0, промолчало 3, ошибок 0»;
        AnalyticsInsightRun #3: kind hourly, SUCCESS, detectors 2, suppressed 3 (change.evaluation DUPLICATE «версия v10 уже поднята в
        ленту», change B INSUFFICIENT_DATA, quality.stale NO_MATERIAL_CHANGE), durationMs 35 — лёгкий контекст; карточек/версий не добавил
overlap: RUNNING старше 10 мин — 0; LOCKED — 0; FAILED — 0; unique(insightId, version) — ошибок в логе 0.
Порядок хуков в каждом тике: синхронизация → снимки → «Рост: автооценка» → «Сигналы: запуск» ✓.
Следующий daily — первый тик нового московского дня (18.09 00:33): cutoff 17.09, версии по изменившимся числам (§ 12 неизменяемость v1).
MetrikaSyncRun 17.09 с 09:00: тики 09:17, 09:23, 09:31, 09:34, 10:33 — все 12/12 SUCCESS (60 строк); RUNNING 0; FAILED 0; дублей снимков 0 (39).
```

## 16. METRIKA CALLS (§ 22) / REGRESSION 06/09/10/11 (§ 25)

```text
Строки клиента Метрики в логе текущего контейнера (с 09:33): только внутри тиков (09:34–09:35 — 42 строки; 10:33 — 42 строки);
во время всех HTTP-проб (09:33:20–09:33:36 enable-проверки, 09:36 manual run, 09:39 recon, 09:5x capture) — 0. Stage 12 не импортирует
клиент Метрики (grep по dist/analytics/insights = 0 файлов).
Stage 06: outbox delivered 11 / skipped 43 до и после — без изменений; failed 0.
Stage 07/08: тики SUCCESS 12/12, снимки 8/8 на тик, дублей 0.
Stage 09/10: BEFORE 09:10 vs AFTER-deploy 09:31 — status diff 0; bissues7 diff 0 (44 листа); overview 7d/30d, behavior summary / funnels —
  расхождения только в полях живого дня (visits 81 → 85, users 50 → 52 …): между снимками прошёл тик 09:17 с новыми данными
  за 17.09 (пресеты last_7/30_days включают текущий день); код этапов 09/10 в кандидате не менялся (git diff), поэтому это данные,
  не регресс. FIX_01 этапа 10 на месте: skipped PARTIAL_BEHAVIOR_PERIOD ×3; not_measured шаги — visits null.
Stage 11: growth/status, growth/changes, A evaluations/latest — diff 0 (355 / 83 / 636 листьев); A остаётся v10 INCOMPARABLE
  (scheduled-версия появится в daily нового дня); хук роста в каждом тике «изменений 0, ошибок 0»; публичные loadWindow /
  overlappingChanges / lastDataDay поведения оценки не изменили (Stage 11 тесты 47 прежние).
CRM: health ok, ошибок Nest после enable 0; секретов в логе (Bearer / JWT_SECRET / password) 0.
```

## 17. PERFORMANCE (§ 24, production-контейнер)

```text
daily (хук boot-тика, полный контекст, 19 детекторов): 4282 мс ✓ (цель ≤ 5 с); manual (HTTP POST run): 3901 мс HTTP / 3694 мс run ✓;
контекст в B: 139 SQL, 3747 мс. hourly (тик 10:33): 35 мс (цель ≤ 2 с) ✓.
GET (in-container, ADMIN): status 15–459 мс (первый вызов с полной сводкой 459), feed active 26–273, feed all 27–254, quality 17–227,
one 11, versions 16 ✓ (цели 0,3–0,5 с); service feed 3 SQL, 22 мс.
pg_stat_database за один manual run: xact_commit +132 (≈ 157 SQL копии минус часть в транзакции), tup_returned +37 901 (десятки тысяч, не миллионы).
Stage 09 overview 30d: 2,04 с BEFORE → 2,46 с после deploy (в пределах шума первого вызова); growth/status 0,64 → 0,70 с.
Превышений целей нет; STOP-порогов нет.
```

## 18. PRIVACY (§ 23)

```text
Хранимые строки (title / fact / hypothesis / recommendation / evidence / limitations / quality / entityKey 8 карточек, 8 версий payload,
2 журнала suppressed / errors; 95 808 символов): телефоны 0, e-mail 0, @username 0, 19-значные ClientID 0, ссылки мессенджеров 0,
токены 0, query-string в entityKey 0; 12 контактов клиентов из OrderPhoto (не печатались) — вхождений 0.
entityKey: 222c1b8e-… (id изменения A), device:mobile, «Переходы по рекламе», PHOTO, photo. API JSON (feed / quality / status /
versions через домен, 508 КБ) — тот же regex 0; скриншоты — тексты карточек без имён клиентов. Логи backend — токенов / паролей 0;
JWT для проб подписывался внутри контейнера и не выводился.
```

## 19. UI (§ 26) — production-JSON (через домен, ADMIN) → сборка кандидата (frontend/dist), puppeteer; под учётной записью владельца исполнитель не входил

```text
OFF (09:31): карточка «Раздел «Инсайты» выключен»; запросов раздела кроме status 0; вкладки Обзор / Поведение / Рост рендерятся
  → prod-insights-disabled.png.
ON (09:5x, 1440 × 900): дисклеймер шапки и границы данных (13.08 / 12.09 / инцидент 14.09) — есть; карточек 8; блоки ФАКТ 8 /
  ЧТО ПРОВЕРИТЬ 8; подписи блока гипотезы: «Гипотеза — не факт» ×5, «Качество измерения — не поведение клиентов» ×3
  (eventNotMeasured, paidWithoutDate, clientIdCoverage) + чипы «качество данных, не поведение» ×3; текст «not_measured, не 0» виден;
  заголовок оценки этапа 11 — «окна несопоставимы», заголовков про заявки с процентом 0; блок «Правил без вывода» и «Молчание
  правила…» — есть; кнопок «Принять к сведению» 8; слов об ошибках 0; causal-regex 9 = дисклеймеры; scrollWidth 1440 = clientWidth
  → prod-insights-desktop.png, фильтр DATA_QUALITY → prod-insights-desktop-data-quality.png.
390 × 844: одна колонка, scrollWidth 390 = clientWidth (горизонтальной прокрутки нет) → prod-insights-mobile-390.png.
Регресс вкладок из production-JSON: Обзор (маркер «Визит»), Поведение («Требует внимания»), Рост («Деплой сайта 12.09») — рендер без
ошибок; «не измеряется … 0» — 0. Скриншоты — docs/analytics/screenshots/12_insights/prod-*.png.
```

## 20. OWNER SMOKE (§ 27)

```text
Не выполнялся исполнителем — gate владельца. Ожидаемая картина: 8 карточек (ATTENTION «На телефонах конверсия заметно ниже…» +
7 INFO), три карточки качества данных подписаны «Качество измерения — не поведение клиентов», карточка оценки 12.09 — «окна
несопоставимы», блок «Правил без вывода: 50». Владелец записывает результат сам («OWNER SMOKE STAGE 12 ПРОЙДЕН» / замечания).
```

## 21. NEW FACTS

```text
1. Окна 03–09.09 → 10–16.09 на production: визиты 229 → 116 (−49 %, Пуассон p 1,2e-9), доля «Переходов по рекламе» 75,1 % → 59,5 %
   (сдвиг структуры — SOURCE_MIX_SHIFT), принятых заказов категории PHOTO 38 → 19 (p 0,016; CRM включает офлайн-каналы), покрытие
   ClientID у принятых 15 % (26 принятых), 6 оплаченных без даты оплаты; DEVICE_GAP этапа 10 — ATTENTION (телефоны 4,3 % / компьютеры 9 %).
2. Заявки сайта в новом определении: 8 за 10–16.09 (6,9 % визитов), формы начаты 23, ошибок 1 — все под MEASUREMENT_DEFINITION_CHANGED
   до окон целиком после 12.09 (§ 10 календарь).
3. Не измеряемые шаги воронок на production: фото «Просмотр каталога / товара» (вход 31 → карточка), футболки «Выбрали крой / цвет»,
   «Отправили форму» (вход 13 → LOW_SAMPLE), холсты «Загрузили фото» (нет на сайте → NO_MATERIAL_CHANGE) — совпадает с копией.
4. Drift схемы вне этапа 12: prisma migrate diff (миграции → schema.prisma) показывает разницу default у SalaryPayment.updatedAt
   (миграция 20260613_salary_architecture); есть в production master, к Stage 12 не относится; исправлять — отдельным решением.
5. Проверка языковой политики по quality.notes срабатывает на самом дисклеймере («…а не установленная причина… не доказывает связь»);
   область проверки в § 16 плана стоит ограничить текстами карточек (title / fact / hypothesis / recommendation / detail) —
   уточнение документа, не кода.
6. auto-update запускает `docker compose up -d --force-recreate <svc>` без --no-deps: при обновлении frontend (09:21) backend,
   у которого изменился env (строка флага из § 6), был пересоздан со СТАРЫМ образом (boot-тик 09:23), а новым — только в 09:29,
   когда докачался его образ. Безвредно (дополнительный рестарт ~30 с, миграции не было), но окно «compose-правка → deploy»
   стоит делать после появления обоих образов или добавлять строку флага в compose заранее (до push).
7. Интервал часового тика после recreate backend сдвигается на минуту старта: после enable — :33 (было :17); daily нового дня — 00:33.
```

## 22. DEVIATIONS

```text
1. Rollout начат 16.09 22:44 (git/test gate, backup 22:52), сессия исполнителя прервалась в 23:1x до правки compose и push;
   production в этот промежуток не менялся (проверено 17.09 08:58: compose/.env без строки, master 5922175, 59 таблиц / 82 миграции).
   Продолжен 17.09 09:10 с повторным backup и BEFORE-снимком; первые backup-файлы 16.09 не использовались.
2. Backup БД — pg_dump | gzip в /opt/raspechatka/backups (процесс владельца, как на этапе 11), а не -Fc в каталог данных (текст § 4).
3. Проверка «schema = миграции» (§ 3) выполнена через пустую временную БД prisma_shadow_stage12 на серверном Postgres (создана,
   миграции применены, diff, удалена; production-БД crm не затронута) — локального Docker нет. Обнаружен drift вне этапа 12 (NEW FACT 4).
4. BEFORE/AFTER Stage 09/10 JSON (§ 9.7, § 25): снимки разделены тиком 09:17 → поля живого дня разошлись (данные, не код); фиксированные
   даты для сравнения в BEFORE не снимались. Компенсация: код этапов 09/10 не менялся (git diff), issues 7d и все JSON этапа 11 — diff 0.
5. Boot-тик старого backend 09:23 из-за пересоздания зависимостью при обновлении frontend (NEW FACT 6).
6. Часовой цикл после enable — 10:33, а не 10:17 (сдвиг интервала на минуту старта контейнера, NEW FACT 7); проверка § 21 сделана по нему.
7. Скрипт захвата API для UI перебирал все UUID из ленты (в т. ч. id запусков и изменения A) → пять ожидаемых 404 «Сигнал не найден»
   на несуществующие карточки; на replay не влияет.
8. ручных run на production — 1 (план допускал 2–3); acknowledge / resolve исполнителем не делались.
```

## 23. OPEN DECISIONS

```text
1. Owner smoke (§ 27) — владелец; DONE — Reviewer.
2. Наблюдение после rollout (§ 33): daily 18.09 00:33 — первые версии v2 и проверка неизменяемости v1 по sha256 из § 7;
   20.09 / 27.09 / 30.09 — смена кодов молчания по заявкам / инциденту / зрелости.
3. NEW FACT 4 (drift SalaryPayment) и NEW FACT 6 (auto-update без --no-deps) — отдельные решения вне Stage 12.
4. POST /insights/run остаётся ADMIN-only инструментом controlled rollout; назначение не расширялось.
```

## 24. PRODUCTION STATE

```text
master = 1f8b7b4; образы backend d8590e7c9e67 (пересоздан 09:32:51 с флагом), frontend 1485aa9b3150; compose: строка
ANALYTICS_INSIGHTS_ENABLED: ${ANALYTICS_INSIGHTS_ENABLED:-false}; .env: ANALYTICS_INSIGHTS_ENABLED=true (с 09:33:16);
YANDEX_METRIKA_* / ANALYTICS_DASHBOARD_ENABLED / ANALYTICS_GROWTH_ENABLED — не менялись. БД: 62 таблицы, 83 миграции;
AnalyticsInsight 8 (OPEN), AnalyticsInsightVersion 8, AnalyticsInsightRun 3 (daily 1, manual 1, hourly 1).
Пороги V1 не менялись. web-photo, event model, Logs API, CI сайта, feature/print-card-lead-form — не трогались.
После enable production не менялся и до решения Reviewer / владельца не меняется; отчёт остаётся в feature-ветке
(master после rollout не пушится, как на этапе 11).
```
