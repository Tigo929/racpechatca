# 09_PRODUCTION_ROLLOUT.md

# Этап 09 — Production rollout Dashboard V1

## Статус

```text
PREPARED (14.09.2026) — план подготовлен исполнителем и принят Reviewer (14.09.2026: «выглядит корректно
и соответствует gate-процессу»); ждёт отдельной команды владельца «СТАРТ». Rollout идёт строго по этому
документу. Production не тронут. DONE этапу 09 ставит Reviewer после полного отчёта.
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
