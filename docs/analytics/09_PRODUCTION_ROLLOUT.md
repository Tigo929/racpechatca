# 09_PRODUCTION_ROLLOUT.md

# Этап 09 — Production rollout Dashboard V1

## Статус

```text
REVIEW — rollout выполнен 14.09.2026 18:44–20:17 MSK по команде владельца «СТАРТ» (план принят Reviewer
14.09): master = be591d3, оба образа выложены, флаг включён 19:16:39 MSK, API/reconciliation/P&L/perf/scheduler
проверены на боевых данных — § 18. Ожидает owner smoke § 11 и verdict Reviewer (DONE этапу 09).
```

> Reviewer 14.09.2026: `00–08 = DONE`, `09_DASHBOARD_V1 = READY_FOR_PRODUCTION_ROLLOUT`.
> Реализация принята (`09_DASHBOARD_V1.md` § 64). Отклонение с дневной суммой прибыли
> допустимо: подписано, headline P&L не меняет.

---

# 1. Что уже принято

Подтверждено на `feature/analytics-foundation` и копии production DB `crm_stage09_test`:

```text
read-only API /analytics/dashboard/* поверх AnalyticsMetricsService (без своих формул)
JwtAuthGuard + RolesGuard(ADMIN): 401 / 403 / 400 / 404 проверены
feature flag ANALYTICS_DASHBOARD_ENABLED (default false → 404, кроме /status)
frontend /crm/analytics (AdminRoute), состояния loading/empty/error/disabled/partial/stale
dashboard = metrics service = metrics:report — diff 0 (10 метрик × 3 периода, все листья JSON)
CRM tests 912, панель 21, build green
production not touched
```

Контракт — `DASHBOARD_CONTRACT.md`.

---

# 2. Чем этот rollout отличается от Stage 07/08

```text
миграций НЕТ            — prisma migrate status должен остаться «77 migrations, up to date»
scheduler НЕ выключаем  — дашборд только читает; таблицы этапов 07/08 не меняются
данные не пишутся       — ни одной мутации; откат = флаг false или revert master
выкатываются ОБА образа — backend (API) и frontend (маршрут, пункт меню, nginx /analytics)
флаг на бою не задан    — после деплоя раздел выключен, пока владелец не включит его отдельным шагом
```

Единственное ручное изменение инфраструктуры: строка флага в серверном
`/opt/raspechatka/docker-compose.prod.yml` (он редактируется руками и не синхронизируется из git).

Что НЕ делать:

```text
prisma migrate dev / migrate resolve / правки _prisma_migrations
выключать YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED / YANDEX_METRIKA_ORDERS_SYNC_ENABLED
создавать пользователей, заказы, оплаты, отмены на бою
выводить токены, пароли, содержимое .env в лог/отчёт/чат
```

---

# 3. Pre-deploy (локально, без production)

```text
feature/analytics-foundation clean
origin/master влит в feature (сейчас: master 4349ae2 ⊂ feature 00e6f3f → ff-merge возможен)
crm-new: npm test green, npm run build green, npx prisma validate green
frontend: npm test green, npm run build green
```

Если master снова ушёл вперёд:

```text
merge master → feature
повторить проверки
```

Зафиксировать `HEAD` feature-ветки перед merge.

---

# 4. Compose: флаг до деплоя

На сервере, до push в master:

```bash
cp /opt/raspechatka/docker-compose.prod.yml /opt/raspechatka/docker-compose.prod.yml.bak-stage09-$(date +%Y%m%d-%H%M)
```

Добавить в `environment` сервиса `backend` (рядом с `YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED`, строка ~65):

```yaml
      ANALYTICS_DASHBOARD_ENABLED: ${ANALYTICS_DASHBOARD_ENABLED:-false}
```

`docker compose -f docker-compose.prod.yml config` — валиден. В `/opt/raspechatka/.env`
переменную пока НЕ добавлять: раздел выкатывается выключенным.

---

# 5. Merge / deploy

После команды владельца «СТАРТ»:

```text
git checkout master
git merge --ff-only feature/analytics-foundation      (если ff невозможен — обычный merge, без squash)
git push origin master
```

Дождаться (GitHub Actions «Сборка образов» ≈ 3–4 мин + auto-update ≤ 1 мин):

```text
CI: тесты бэкенда, сборка панели, тесты панели — success
auto-update: «Обновляю backend … Готово: backend обновлён и здоров»
auto-update: «Обновляю frontend … Готово … nginx перечитан … Холст прогрет»
docker ps: backend healthy, frontend healthy
```

Зафиксировать: merge commit, время push, id образов, время деплоя, `image.revision`.

Окно: деплой перезапускает backend и сбивает часовой таймер расписания — лучше сразу после
очередного тика (наблюдаются в ~:17 MSK). Данные не теряются: следующий тик перечитает 3 дня.

---

# 6. Migration status

```bash
docker exec raspechatka-backend-1 npx prisma migrate status
```

Ожидается: `77 migrations found`, `Database schema is up to date!` — новых миграций у этапа нет.
Любое расхождение — STOP.

---

# 7. Disabled-state verification (флаг ещё выключен)

Снаружи (через nginx панели):

```text
GET https://<crm>/analytics/dashboard/status    → 401 JSON (не HTML SPA — значит /analytics проксируется)
GET https://<crm>/analytics/dashboard/overview  → 401 JSON
```

Из контейнера (`docker exec raspechatka-backend-1 node …`): скрипт подписывает временный JWT
(ADMIN, `expiresIn: 5m`) через `jsonwebtoken` и `process.env.JWT_SECRET` **внутри процесса**,
токен наружу не печатается:

```text
ADMIN  /status   → 200 {"enabled": false, presets…}
ADMIN  /overview → 404 «Раздел аналитики выключен»
```

Владелец: вход в панель → пункт «Аналитика» виден → карточка «Раздел выключен».
Остальные разделы CRM работают как прежде (заказы, отчёты).

---

# 8. Enable flag

Только после § 5–7 и подтверждения владельца:

```bash
cp /opt/raspechatka/.env /opt/raspechatka/.env.bak-stage09-$(date +%Y%m%d-%H%M)
echo 'ANALYTICS_DASHBOARD_ENABLED=true' >> /opt/raspechatka/.env
cd /opt/raspechatka && docker compose -f docker-compose.prod.yml up -d --force-recreate backend
docker exec raspechatka-frontend-1 nginx -s reload
```

Дождаться `backend healthy`. Зафиксировать время включения.

---

# 9. API verification (флаг включён)

Из контейнера тем же способом (временный токен в памяти процесса):

```text
без токена       → 401
EXECUTOR         → 403 (sub — реальный пользователь роли EXECUTOR из базы, только чтение id)
ADMIN /status    → 200 enabled: true
ADMIN /overview?preset=today | last_7_days | last_30_days → 200
ADMIN /trend, /sources, /utm, /landings, /devices, /products, /sales-channels → 200
ADMIN ?preset=bogus → 400; ?from=2025-01-01&to=<сегодня> → 400 (>366 дней)
повторный /overview → из кэша (быстрее, тот же JSON)
```

---

# 10. Reconciliation dashboard ↔ metrics service (боевые данные)

В контейнере, для `today`, `last_7_days`, `last_30_days`:

```text
A = GET /analytics/dashboard/* (HTTP, временный ADMIN-токен)
B = AnalyticsMetricsService напрямую (та же сборка)
C = node dist/src/analytics/metrics-report.js overview --preset <p> --json
```

Ожидается: все листья JSON A = B = C, кроме `dataQuality.freshness.metrikaDataAgeSeconds`
и `metadata.generatedAt` (время вызова). Минимум 10 метрик в отчёте:

```text
traffic.visits, traffic.periodUsers, siteFunnel.siteLeads, crmFunnel.events.crmLeads,
crmFunnel.events.acceptedOrders, crmFunnel.events.paidOrders,
financials.realized.realizedRevenue, financials.realized.cogs, financials.realized.netProfit,
orders.paidAov                                                     → diff 0
```

Плюс инварианты `/trend`: Σvisits, Σaccepted, Σpaid, ΣrealizedRevenue = Overview;
ΣnetProfit отличается не больше чем на число дней периода (округление `buildPnl` по дням).

P&L: `financials.realized.{realizedRevenue, cogs, netProfit}` за `previous_month` =
`GET /reports/monthly` за тот же месяц (как в этапе 08, ожидается 0).

---

# 11. Owner smoke (UI, боевые данные)

Владелец под своим ADMIN в панели:

```text
/crm/analytics открывается, подзаголовок «Актуально: данные обновлены N минут назад»
пресеты: Сегодня, 7 дней, 30 дней — KPI-ряды, воронки, график, «Деньги подробно»
вкладки: Источники, Товары, Страницы, Качество данных
предупреждения legacy / coverage видны и понятны; «Требует внимания» без причин-гипотез
мобильный экран (телефон): по 2 карточки в ряд, горизонтального скролла нет
```

Сверка глазами: 10 чисел из § 10 (KPI на экране) = `metrics:report overview` из контейнера.
Скриншоты владельца (desktop + телефон) — в `docs/analytics/screenshots/09_production/`
или точное текстовое описание, если скриншоты неудобны.

Исполнитель не входит в панель под учётной записью владельца и не создаёт пользователей на бою.

---

# 12. Performance (боевой контейнер)

```text
node dist/src/analytics/metrics-report.js perf --preset last_30_days   → 29 / 17 SQL-запросов, время
HTTP /overview холодный и повторный (кэш) — из контейнера, curl -w %{time_total}
цель: overview ≤ 3 с холодный; кэш — сотни мс
```

---

# 13. Scheduler / Stage 06–08 regression

```text
первый тик после деплоя: MetrikaSyncRun SUCCESS, «снимки периодов обновлены — 8/8»
второй тик через час: SUCCESS, дублей снимков нет (ключ — диапазон)
outbox этапа 06: воркер включён, ошибок нет
дашборд после тика: freshness FRESH, lastMetrikaSyncAt = finishedAt последнего SUCCESS
```

---

# 14. Rollback

```text
скрыть раздел:   ANALYTICS_DASHBOARD_ENABLED=false в .env → recreate backend → nginx reload
                 (пункт меню остаётся, страница показывает «Раздел выключен»; API 404)
откатить код:    git revert merge-коммита в master → push → auto-update; compose-строка флага безвредна
данные:          откатывать нечего — этап ничего не пишет
```

---

# 15. Docs / Git

После успешного rollout:

```text
09_DASHBOARD_V1.md          → статус по решению Reviewer (DONE)
09_PRODUCTION_ROLLOUT.md    → § 17 EXECUTOR_REPORT_PRODUCTION_ROLLOUT, статус REVIEW
00_MASTER_PLAN.md, 01_CURRENT_STATE.md → статусы и факты production
```

Документы — commit/push в `feature/analytics-foundation` (document-only push в master
перезапускает production).

---

# 16. EXECUTOR_REPORT_PRODUCTION_ROLLOUT (шаблон)

```text
1.  RESULT              DONE_PENDING_REVIEW | PARTIAL | BLOCKED
2.  GIT / DEPLOY        merge commit, push time, CI run, images (backend/frontend), deploy time, healthy
3.  COMPOSE / FLAG      backup files, строка флага, время включения, backend recreate, nginx reload
4.  MIGRATION STATUS    77 / up to date
5.  DISABLED STATE      401 снаружи, 200 status enabled:false, 404 overview, карточка «Раздел выключен»
6.  API VERIFICATION    401 / 403 / 400 / 200 по маршрутам, кэш
7.  RECONCILIATION      таблица ≥10 метрик × 3 периода, diff; инварианты trend; P&L vs /reports/monthly
8.  OWNER SMOKE         что проверил владелец, скриншоты/описание, замечания
9.  PERFORMANCE         SQL count, время холодный/кэш
10. SCHEDULER / STAGE 06 первый и второй тик, снимки 8/8, outbox
11. SECURITY            токены не выводились; секреты не менялись; security debt без изменений
12. NEW FACTS
13. DEVIATIONS
14. OPEN ISSUES
```

---

# 17. Decision Gate

Stage 09 становится `DONE`, если:

- master = feature (ff-merge или merge без потерь), CI green, оба образа выложены, healthy;
- миграций не появилось, `migrate status` up to date;
- в выключенном состоянии API отвечает 404 (кроме `/status`), панель показывает «Раздел выключен»;
- флаг включён отдельным шагом с backup `.env`, backend recreate, nginx reload;
- auth защищает все маршруты (401 / 403) на бою;
- dashboard ↔ metrics service ↔ CLI: diff 0 по ≥10 метрикам для today / 7 / 30 дней;
- headline P&L дашборда = `/reports/monthly` за прошлый месяц;
- владелец открыл `/analytics` на боевых данных, воронки сайта и CRM раздельны, coverage-предупреждение видно;
- responsive подтверждён владельцем на телефоне;
- первый и второй тики расписания после деплоя SUCCESS, снимки 8/8, Stage 06 не сломан;
- секреты не выводились, production не получил искусственных данных.

После этого:

```text
09_DASHBOARD_V1 = DONE
→ 10_BEHAVIOR_AND_FUNNELS.md
```

---

# 18. EXECUTOR_REPORT_PRODUCTION_ROLLOUT — 14.09.2026

## 1. RESULT

```text
DONE_PENDING_REVIEW
```

Rollout выполнен 14.09.2026 18:44–20:17 MSK строго по § 3–13 этого документа (команда «СТАРТ» 18:4x,
подтверждение § 7 владельцем 19:1x, второй тик расписания дождались в 20:16). STOP-условий не возникло.
Owner smoke (§ 11) — чек-лист для владельца в § 8 ниже; исполнитель под учётной записью владельца не входил.

## 2. GIT / DEPLOY

```text
pre-deploy:      feature/analytics-foundation = be591d3 clean; origin/master 4349ae2 ⊂ feature;
                 prisma validate OK; CRM 912 tests; панель 21 tests (14.09 18:42–18:44 MSK)
merge:           master 4349ae2 → be591d3, fast-forward (7 коммитов: 2079210, f21c636, b8f7278, a789b63,
                 00e6f3f, caa2be0, be591d3); ничего не переписано
push master:     14.09.2026 19:01:15 MSK — сразу после тика расписания 18:59:51 (SUCCESS, снимки 8/8)
CI:              GitHub Actions «Сборка образов» — оба образа собраны (frontend image created 19:03:01,
                 backend image created 19:03:48 MSK); тесты бэкенда + сборка и тесты панели в том же workflow
auto-update:     19:03:22 «Обновляю frontend 43963ec4066e → 2b96a48cf33c» → 19:04:23 «Готово: frontend
                 обновлён и здоров», nginx перечитан; 19:10:38 «Обновляю backend a765aab3016a → 4d8cdf1c82bf»
                 → 19:11:11 «Готово: backend обновлён и здоров», nginx перечитан; «ошибок 0»
images:          backend  ghcr.io/tigo929/racpechatca-backend:latest  = sha256:4d8cdf1c82bf… (created 2026-09-14T16:03:48Z)
                 frontend ghcr.io/tigo929/racpechatca-frontend:latest = sha256:2b96a48cf33c… (created 2026-09-14T16:03:01Z)
                 (label image.revision в образах не проставляется — идентификация по времени сборки и push)
healthy:         backend healthy 19:11:11 (после включения флага — 19:16:39), frontend healthy 19:04:23;
                 /health {"status":"ok","database":"ok"}
побочный эффект: при пересоздании frontend в 19:03 compose пересоздал и backend (зависимость + изменившийся
                 env после § 4) — ещё на старом образе a765aab3; в 19:10 auto-update пересоздал его на новом.
                 Данные не трогались, миграций нет; два лишних рестарта backend ≈ 30 с каждый.
frontend bundle: /crm/analytics → 200 SPA; в index-CcjPg1ic.js есть маршрут crm/analytics и чанк AnalyticsPage-B7EqZQDM.js
```

## 3. COMPOSE / FLAG

```text
compose backup:  /opt/raspechatka/docker-compose.prod.yml.bak-stage09-20260914-1844
compose change:  + ANALYTICS_DASHBOARD_ENABLED: ${ANALYTICS_DASHBOARD_ENABLED:-false} (после
                 YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED); docker compose config — валиден, резолв "false"
.env backup:     /opt/raspechatka/.env.bak-stage09-20260914-1916 (48 строк)
.env change:     19:16:07 MSK + ANALYTICS_DASHBOARD_ENABLED=true (50 строк с пустой); compose config → "true"
recreate:        19:16:08 docker compose up -d --force-recreate backend → healthy 19:16:39
nginx reload:    19:16:39 (raspechatka-frontend-1: signal process started)
env в контейнере: orders_sync=true analytics_sync=true dashboard=true
```

## 4. MIGRATION STATUS

```text
boot log (19:11 и 19:16): «77 migrations found in prisma/migrations», «No pending migrations to apply.»
npx prisma migrate status (контейнер): «77 migrations found», «Database schema is up to date!»
_prisma_migrations не трогались; миграций этап 09 не добавлял
```

## 5. DISABLED STATE (19:12–19:14 MSK, флаг false)

```text
снаружи через nginx (Host 195-2-75-249.sslip.io):
  GET /analytics/dashboard/status    → 401 application/json {"message":"Unauthorized"}   (проксируется, не HTML)
  GET /analytics/dashboard/overview  → 401 application/json
  GET /crm/analytics                 → 200 text/html (SPA)
  GET /order-photo (регрессия)       → 401 как прежде
из контейнера (временный JWT в памяти процесса, 5 мин):
  без токена /status, /overview      → 401;  битый токен → 401
  EXECUTOR   /status, /overview      → 403 «Недостаточно прав»
  ADMIN      /status                 → 200 {"enabled":false,"presets":[…]}
  ADMIN      /overview|trend|sources|utm|landings|devices|products|sales-channels → 404 «Раздел аналитики выключен»
  ADMIN      ?preset=bogus, >366 дней → 404 (флаг проверяется до разбора периода)
владелец (§ 7):  подтвердил 19:1x MSK — пункт «Аналитика» виден, карточка «Раздел выключен», CRM работает
```

## 6. API VERIFICATION (19:17 MSK, флаг true)

```text
без токена /status, /overview   → 401;  битый токен → 401
EXECUTOR   /status, /overview   → 403
ADMIN      /status              → 200 enabled:true
ADMIN      /overview  today 200 2415 мс (холодный, первый вызов после старта) · last_7_days 200 1375 мс · last_30_days 200 968 мс
ADMIN      /trend 451 мс · /sources 27 · /utm 17 · /landings 28 · /devices 25 · /products 368 · /sales-channels 310 — все 200
ADMIN      ?preset=bogus → 400 «Неизвестный период: bogus»; from=2025-01-01&to=2026-09-14 → 400 «Период не больше 366 дней»
кэш:       /overview last_30_days повторно: 9 мс → 13 мс, JSON идентичен
снаружи:   /status и /overview без токена → 401 JSON
```

## 7. RECONCILIATION (19:18 MSK, боевые данные; A = HTTP, B = AnalyticsMetricsService, C = metrics:report --json)

```text
metric                              | dashboard (A) | service (B) | CLI (C) | diff   — today 2026-09-14
traffic.visits                      |            12 |          12 |      12 | 0
traffic.periodUsers (снимок)        |             9 |           9 |       9 | 0
siteFunnel.siteLeads                |             0 |           0 |       0 | 0
crmFunnel.events.crmLeads           |             0 |           0 |       0 | 0
crmFunnel.events.acceptedOrders     |             5 |           5 |       5 | 0
crmFunnel.events.paidOrders         |             7 |           7 |       7 | 0
financials.realized.realizedRevenue |         16975 |       16975 |   16975 | 0
financials.realized.cogs            |          7593 |        7593 |    7593 | 0
financials.realized.netProfit       |          8819 |        8819 |    8819 | 0
orders.paidAov                      | 2345.7142857… | 2345.7142…  | 2345.7… | 0

metric                              | dashboard (A) | service (B) | CLI (C) | diff   — last_7_days 2026-09-08..14
traffic.visits                      |           144 |         144 |     144 | 0
traffic.periodUsers (снимок)        |            93 |          93 |      93 | 0
siteFunnel.siteLeads                |             4 |           4 |       4 | 0
crmFunnel.events.crmLeads           |             6 |           6 |       6 | 0
crmFunnel.events.acceptedOrders     |            33 |          33 |      33 | 0
crmFunnel.events.paidOrders         |            10 |          10 |      10 | 0
financials.realized.realizedRevenue |         66455 |       66455 |   66455 | 0
financials.realized.cogs            |         12779 |       12779 |   12779 | 0
financials.realized.netProfit       |         44015 |       44015 |   44015 | 0
orders.paidAov                      |          3512 |        3512 |    3512 | 0

metric                              | dashboard (A) | service (B) | CLI (C) | diff   — last_30_days 2026-08-16..09-14
traffic.visits                      |           588 |         588 |     588 | 0
traffic.periodUsers (снимок)        |           326 |         326 |     326 | 0
siteFunnel.siteLeads                |             4 |           4 |       4 | 0
crmFunnel.events.crmLeads           |            27 |          27 |      27 | 0
crmFunnel.events.acceptedOrders     |           127 |         127 |     127 | 0
crmFunnel.events.paidOrders         |            70 |          70 |      70 | 0
financials.realized.realizedRevenue |        229231 |      229231 |  229231 | 0
financials.realized.cogs            |         60927 |       60927 |   60927 | 0
financials.realized.netProfit       |        132573 |      132573 |  132573 | 0
orders.paidAov                      | 2265.2714285… | 2265.2714…  | 2265.2… | 0

все листья JSON (A vs B, все 8 маршрутов): today 494, last_7_days 764, last_30_days 1244 — diffs 0
A.overview vs C: 214 / 216 / 216 листьев — diffs 0 (исключены только generatedAt и metrikaDataAgeSeconds)
инварианты /trend: Σvisits, Σaccepted, Σpaid, ΣrealizedRevenue = Overview для всех трёх периодов;
  ΣnetProfit: today Δ 0 ₽; 7 дней 44 014 vs 44 015 (Δ 1 ₽ ≤ 7); 30 дней 132 566 vs 132 573 (Δ 7 ₽ ≤ 30) — округление buildPnl по дням
periodUsers = снимки: today 9, last_7_days 93, last_30_days 326 (MetrikaPeriodSnapshot, fetchedAt 19:18:10)

P&L, previous_month = август 2026 (dashboard vs GET /reports/monthly?year=2026, месяц 8):
  realizedRevenue 189 405 = totalRevenue 189 405 · cogs 56 935 = 56 935 · netProfit 115 065 = 115 065 · orders 79 = 79 → diff 0
  metrics:report reconcile-pnl --year 2026 --month 8: 12 строк (orders, realizedRevenue, realizedGoodsRevenue, cogs,
  grossContribution, salaryAccrued, operatingExpenses, deliveryProfit, netProfit, photo/tshirt/canvasProfit)
  service = monthly = weekly → «расхождений: 0»
```

## 8. OWNER SMOKE

```text
§ 7 (флаг false):  подтверждено владельцем — пункт «Аналитика», карточка «Раздел выключен», CRM работает.
§ 11 (флаг true):  чек-лист владельцу (под своим ADMIN):
  [ ] /crm/analytics открывается; подзаголовок «Актуально: данные обновлены N минут назад»
  [ ] Сегодня / 7 дней / 30 дней — KPI: визиты 12 / 144 / 588, посетители 9 / 93 / 326, принятые 5 / 33 / 127,
      оплаты 7 / 10 / 70, выручка 16 975 / 66 455 / 229 231 ₽, прибыль 8 819 / 44 015 / 132 573 ₽
      (числа на момент 19:18 MSK; после новых заказов/оплат они меняются — сверять с metrics:report того же момента)
  [ ] воронка сайта и воронка CRM — отдельные карточки; в воронке сайта «Недостаточно сопоставленных заказов»
      (eligibleAccepted 0) и предупреждение о неполной связи (ClientID у 6,06 % / 7,09 % принятых)
  [ ] «Требует внимания» — только правила (покрытие ClientID), без причин
  [ ] вкладки Источники / Товары / Страницы / Качество данных открываются, «Качество данных»: Актуально
  [ ] телефон: KPI по 2 в ряд, горизонтального скролла нет
  скриншоты владельца (по желанию) → docs/analytics/screenshots/09_production/
```

## 9. PERFORMANCE (боевой контейнер, 19:19 MSK)

```text
metrics:report perf --preset last_30_days: заказов 330, принято 127;
  getOverview (с сравнением) — 29 SQL-запросов, 2568 мс (отдельный node-процесс, с прогревом Prisma);
  шесть срезов параллельно — 17 SQL, 1001 мс; N+1 нет
HTTP (внутри контейнера, работающий backend):
  overview холодный (некэшированный период 15.08–13.09) 1965 мс → повторно 45 мс (кэш 45 с)
  trend холодный 936 мс · overview previous_30_days холодный 503 мс · products холодный 387 мс
  первый вызов после старта процесса: overview today 2415 мс (прогрев)
цель ≤ 3 с холодный — выполнена; кэш — десятки мс
```

## 10. SCHEDULER / STAGE 06

```text
до деплоя:        тик 18:59:51 SUCCESS, снимки 8/8 — деплой начат сразу после него (19:01:15)
после старта 19:11 (новый образ): 19:12:38 scheduler:daily 25.08–14.09 SUCCESS (7 наборов), снимки 8/8
после старта 19:16 (флаг):        19:18:07 scheduler:daily SUCCESS (7 наборов: traffic 21, goals 441, sources 81,
                                  utm 27, landings 100, devices 45, pages 340 строк), 19:18:10 снимки 8/8
второй тик (часовой):             20:16:33–20:16:37 MSK scheduler:hourly 12.09–14.09 SUCCESS (traffic 3, goals 63, sources 14, utm 3,
                                  landings 11, devices 7, pages 34 строк), снимки 8/8 (fetchedAt 20:16:37); FAILED за 24 ч — 0;
                                  дашборд после тика: FRESH, age 61 с, lastMetrikaSyncAt = finishedAt последнего SUCCESS (17:16:36Z) — OK
MetrikaSyncRun за 20 ч:           scheduler:daily 28 SUCCESS, scheduler:hourly 133 SUCCESS, FAILED 0
снимки:                           18 строк, дублей (periodStart, periodEnd, metricScope) — 0;
                                  fetchedAt 19:18:10: today 9, yesterday 13, last_7_days 93, previous_7_days 191,
                                  last_30_days 326, previous_30_days 16, current_month 273, previous_month 69
дашборд после тика:               freshness FRESH (age ≈ 260 с в 19:22), lastMetrikaSyncAt = finishedAt последнего SUCCESS
Stage 06:                         воркер запущен 19:16:33; MetrikaOrderOutbox 8 строк, все skipped/no_client_id
                                  (естественные переходы заказов без ClientID с 13.09) — ошибок нет
```

## 11. SECURITY

```text
токены:    временные JWT (ADMIN / EXECUTOR, 5 мин) подписывались внутри контейнера и не покидали процесс;
           в логах, отчёте и чате токенов, паролей и содержимого .env нет
секреты:   не менялись; .env дополнен одной строкой флага (backup .env.bak-stage09-20260914-1916)
пользователи/данные: на бою не создавались; запись — только чтение id существующих пользователей для sub
security debt: без изменений — ROTATE_YANDEX_OAUTH_TOKEN, ROTATE_YANDEX_CLIENT_SECRET (решение владельца)
```

## 12. NEW FACTS

- Production 14.09 19:18 MSK: last_7_days (08–14.09) — визиты 144, посетители 93, заявки сайта 4, CRM-заявки 6,
  принято 33, оплат 10, выручка 66 455 ₽, себестоимость 12 779 ₽, прибыль 44 015 ₽, средний чек 3 512 ₽;
  ClientID у принятых 6,06 %, eligibleAccepted 0. last_30_days: визиты 588, посетители 326, принято 127, оплат 70,
  выручка 229 231 ₽, прибыль 132 573 ₽, средний чек 2 265,27 ₽; заказов в базе 330.
- Август 2026 по P&L: выручка 189 405 ₽, себестоимость 56 935 ₽, зарплата 14 551 ₽, доставка +6 130 ₽,
  прибыль 115 065 ₽ (фото 33 564 / футболки 77 050 / холсты 4 437), 79 заказов.
- Заявки сайта за 7 дней — 4 (на копии 13.09 было 2): новые естественные lead_submitted после cutover.
- Scheduler этапа 07 после каждого старта backend выполняет суточную синхронизацию (21 день) через ~90 с и
  обновляет снимки — поэтому каждый рестарт даёт «первый тик» без ожидания часа; часовой интервал отсчитывается от старта.
- Compose `up -d --force-recreate frontend` пересоздаёт и backend, если у него изменился env (depends_on) —
  учитывать при будущих правках серверного compose: делать их непосредственно перед деплоем backend.
- MetrikaOrderOutbox: 8 skipped/no_client_id — заказы без ClientID в очередь попадают и помечаются skipped (этап 06 by design).
- Outbox воркер и расписание переживают рестарты без ручных действий; FAILED за 20 ч — 0.

## 13. DEVIATIONS

```text
1. § 5 «CI success» подтверждён косвенно (образы собраны и выложены auto-update без ошибок); статус workflow
   через GitHub API с рабочей станции получить не удалось (API отдал HTML) — не влияет на результат.
2. Backend перезапускался трижды (19:03 старый образ из-за compose-зависимости, 19:10 новый образ, 19:16 флаг)
   вместо двух по плану; данные и миграции не затронуты, каждый старт — healthy и тик SUCCESS.
3. Label org.opencontainers.image.revision в образах пуст — версии зафиксированы по image id и времени сборки.
4. § 11 owner smoke на включённом разделе — ожидает владельца (чек-лист в § 8); § 7 owner-часть подтверждена.
```

## 14. OPEN ISSUES

```text
1. Owner smoke § 11 (UI на боевых данных, телефон) — подтверждение владельца → после него Reviewer решает DONE.
2. Скриншоты production — по желанию владельца (docs/analytics/screenshots/09_production/).
3. Наблюдение: eligibleAccepted 0 на бою — сопоставленная воронка остаётся «—» до заявок с cookie-согласием;
   PHASE K/L (LEAD→NEW/PAID через очередь с ClientID) — not observed yet.
4. Security debt без изменений (ротация токена/секрета Яндекса).
```
