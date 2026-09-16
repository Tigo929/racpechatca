# 12_PRODUCTION_ROLLOUT.md

## STATUS

```text
READY_FOR_REVIEW (план, 16.09.2026). Production НЕ менялся; rollout НЕ начат.
Implementation + FIX_01 приняты Reviewer: 12_AUTOMATED_INSIGHTS = READY_FOR_PRODUCTION_ROLLOUT, кандидат 1f8b7b4.
Rollout начинается только после отдельной команды Reviewer «СТАРТ» (§ 34).
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
