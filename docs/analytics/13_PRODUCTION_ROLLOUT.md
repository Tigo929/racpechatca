# 13_PRODUCTION_ROLLOUT.md

## STATUS

```text
STOPPED_AT_GATE_C (исполнение 22.09.2026 по команде Reviewer «СТАРТ»; отчёт — § 14). Gates 0, A, B пройдены;
Gate C: деплой сайта корректен (441d795 = revision = /api/health.build), но сработало глобальное STOP-условие § 1.2 —
auto-update записал «работает не та сборка» (ложное срабатывание сверки на контейнере без healthcheck). Gates D–G
не запускались, H — только фиксация. Production не откатывался (состояние корректно), Stage 14 не начинался.
Ранее: READY_FOR_REVIEW (план 17.09.2026, обновлён 22.09.2026 после слияния master). Implementation Stage 13 = READY_FOR_PRODUCTION_ROLLOUT (Reviewer APPROVED 17.09.2026).
Кандидаты: CRM — 44ca8c9 (= e0984f8 + слияние origin/master 9810d0b: коммиты владельца acf4d73, 0d7d7b2, fc5657b и план дня
9810d0b; код этапа 13 = 51f27ae без изменений; тесты на слитой ветке CRM 1196 / 1196, панель 78 / 78); сайт — web-photo 441d795.
НОВОЕ ПРЕДУСЛОВИЕ (Gate 0, § 2a): production сейчас отстаёт от master — образ 0d7d7b2 (20.09), auto-update.timer остановлен
21.09 16:01 MSK, не выложены fc5657b (с data-repair миграцией 20260921010000_fix_pickup_fulfillment) и 9810d0b. Выравнивание
production с master — деплой владельца вне Stage 13; Gate A начинается только после него.
Rollout начинается только после отдельной команды Reviewer «СТАРТ» (§ 13), по gate-ам 0 → A → B → C → D → E → F → G; H —
решения Reviewer, автоматически не выполняется.
```

## STAGE

**13 — Reliability & Security / Production Rollout**

## PURPOSE

Вывести в production результаты этапа 13 так, чтобы каждый шаг был отдельно проверяем и отдельно откатываем:

- **A** — код CRM (диагностика, замки, retention-инструмент, build identity) без новых миграций;
- **B** — безопасная выкладка на сервере (`auto-update.sh` с `--no-deps`, порядком и сверкой сборки; compose на `:production`);
- **C** — CI сайта: production-метки только с production-ветки, сервер потребляет `:production`;
- **D** — операционная валидация (health/build, состояния, планировщик, очередь, утечки, производительность, ≥ 2 цикла);
- **E** — бэкапы (валидность свежего, evidence уже пройденного restore drill);
- **F** — retention: только dry-run;
- **G** — секреты: только проверка отсутствия утечек, ротации нет;
- **H** — инфраструктурные долги: рекомендации Reviewer, без автоматического применения.

Общие правила (все gate-ы): секреты не выводятся; `prisma migrate dev/reset/resolve` запрещены; production-данные не
правятся и не удаляются; failure injection на production не выполняется; stale-ветки не пушатся; production меняется
только внутри объявленного gate-а и только после «СТАРТ». Временные JWT для проб подписываются внутри контейнера.

---

## 1. ГЛОБАЛЬНЫЕ STOP-УСЛОВИЯ (действуют во всех gate-ах)

Немедленно STOP, ничего дальше не менять, откат по инструкции gate-а, отчёт Reviewer:

1. **Неожиданный recreate** backend или frontend CRM, api или web сайта (контейнер, который gate не объявлял целью,
   получил новый `StartedAt`) — в т. ч. при обновлении соседнего сервиса.
2. **Build SHA mismatch**: `/health.build` (CRM) или `/api/health.build` (сайт) ≠ ожидаемому sha master / feature/cms-admin,
   или ≠ метке `org.opencontainers.image.revision` запущенного образа, или auto-update пишет «работает не та сборка».
3. **Non-production ref способен опубликовать `:production`**: `ci-safety-check.mjs` не проходит на кандидате, в
   workflow есть безусловная метка `:production`/`:latest`, или в GHCR появился `:production`, чей revision ≠ sha
   production-ветки.
4. **Изменение чисел или семантики этапов 06–12**: BEFORE ≠ AFTER по закрытым окнам Stage 09/10/11/12, новые версии
   карточек без новых данных, изменения статусов outbox, тик FAILED/дубли, хук роста/сигналов даёт другой результат.
5. **Утечка секрета или PII**: значение токена/пароля/URL БД/ClientID/телефона в логе, ответе API, отчёте, файле плана.
6. **False HEALTHY**: `/analytics/ops/status` показывает HEALTHY при известной проблеме (например, sync FAILED в журнале,
   RUNNING > 60 мин, миграции не совпадают) — дефект диагностики, а не повод менять пороги.
7. Также: миграция применяется, хотя её не ожидалось (в т. ч. чужая `20260921010000_fix_pickup_fulfillment`, если Gate 0
   не выполнен); backend не healthy 5 мин; `_prisma_migrations` ≠ 86; `auto-update.timer` не active перед деплоем; auto-update
   пишет ОШИБКА/ВНИМАНИЕ по любому сервису; удалена хоть одна строка при retention dry-run.

Пороги и семантика ради «зелёного» результата не меняются (спецификация § 29).

---

## 2. ПОРЯДОК И ОКНА

```text
0  production=master  деплой владельца (fc5657b с data-repair миграцией + 9810d0b), запуск auto-update.timer — до Stage 13
A  CRM code           деплой сразу после SUCCESS часового тика, ~20 мин, backend recreate 1 раз (auto-update)
D1 после A            /health.build, ops status, auth, Stage 06–12 AFTER, первый тик (boot, daily) — ~15 мин
B  server hardening   вне тика; recreate НЕ ожидается (тот же image id под :production); dry-run compose — ~15 мин
C  web-photo CI       merge ff → CI ~4 мин → compose сайта на :production → auto-update recreate api, web (по очереди);
                      окно низкой посещаемости; CRM-контейнеры не трогаются — ~25 мин
D2 полная валидация   ≥ 2 автоцикла планировщика после A (boot daily + hourly), лог auto-update, verify_build сайта
E, F, G               read-only проверки, dry-run
H                     рекомендации — в отчёте, действий нет
```

Gate-ы независимы по откату: откат B не требует отката A; откат C не трогает CRM. Между A и B можно сделать паузу
(auto-update старым скриптом продолжает работать с `:latest`, который новый CI тоже публикует).

---

## 2a. GATE 0 — предусловие: production = master (деплой владельца, НЕ часть Stage 13)

Факты на 22.09.2026 13:15 MSK (read-only): backend `2969889e3192` = образ `0d7d7b2` (создан 20.09 17:25, контейнер 20.09 17:26),
frontend `a98ee3269eb2`; `_prisma_migrations` 85 (последняя `20260920010000_site_lead_push_delivery`); `auto-update.timer`
**inactive** (остановлен 21.09 16:01:20 — ровно перед приходом образа fc5657b; последний прогон сервиса 21.09 16:00:47–59);
в GHCR уже лежат `:latest` = 9810d0b (CI 22.09 13:03–13:07) и `:fc5657b…`, `:9810d0b…`. Не выложены:
`fc5657b` «reconcile order pickup, delivery and financial closure» — содержит миграцию `20260921010000_fix_pickup_fulfillment`
(**правит данные**: `UPDATE "OrderPhoto"` PICKUP + SHIPMENT_CREATED → READY, сброс `shipmentRemindersSent`, строки в
`StatusHistory` от `system:pickup-fulfillment-fix`; таблиц не создаёт) и `9810d0b` «план дня без блока отгрузок» (код бота).
Оба — не аналитика и не Stage 13; решение об их выкладке и о data-repair миграции — владельца.

```text
PRECHECK  владелец подтвердил выкладку fc5657b (с data-repair миграцией) и 9810d0b; backup БД перед ней
          (premigration_<ts>.sql.gz) — обязателен, т.к. миграция меняет статусы заказов
ACTION    (владелец / по его команде) systemctl start auto-update.timer — либо ручной docker compose pull + up backend, frontend;
          Stage 13 здесь ничего не меняет
VERIFY    backend образ = :9810d0b… (docker image inspect RepoDigests), /health ok; boot-лог «Applying migration
          20260921010000_fix_pickup_fulfillment» → _prisma_migrations 86; число исправленных заказов = число строк StatusHistory
          с changedBy 'system:pickup-fulfillment-fix' (записать в отчёт); auto-update.timer active; тик расписания SUCCESS;
          план дня dry-run (POST /order-photo/daily-plan/run?dry=true, ADMIN) без блока «ОТГРУЗКИ»
STOP      миграция упала / backend не healthy / timer не стартует → это инцидент владельца, Stage 13 не начинается
ROLLBACK  по процедуре владельца (образ :0d7d7b2…; данные миграции — из backup)
```

После Gate 0 базовые числа для Gate A: `_prisma_migrations` **86**, таблиц **64** (ApprovalTelegramDelivery,
LeadPushDelivery добавлены 19–20.09), образ backend = 9810d0b, timer active.

---

## 3. GATE A — CRM reliability (кандидат 44ca8c9)

### PRECHECK

```text
gate0: Gate 0 выполнен: production = master 9810d0b, _prisma_migrations 86, timer active (иначе STOP: деплой Stage 13
       применил бы чужую data-repair миграцию — § 1.7)
git:   origin/master = 9810d0b (иначе — повторить слияние и тесты, новый кандидат); 44ca8c9 ⊃ master (fast-forward);
       git log 9810d0b..44ca8c9 = 53d2d25, dabf3eb, 8f1707d (docs этапа 12), 3d45f4c (спецификация 13), 806e328 (код),
       51f27ae (orderBy), e0984f8 (docs), 85f9c0f (план), 44ca8c9 (merge) + этот план (docs-only);
       git diff --stat 51f27ae..<tip> -- . ':!docs' ':!graphify-out' = только файлы, пришедшие из master (владелец) —
       Stage 13 после 51f27ae код не менял: проверять `git diff 9810d0b..<tip> -- . ':!docs'` = ровно набор файлов этапа 13
       (.github/workflows/build-images.yml, crm-new/Dockerfile.prebuilt, crm-new/package.json, src/analytics/{ops,retention,
       insights,growth}, src/health.controller.ts, src/app.module.ts, src/deploy-safety.spec.ts, analytics-route-matrix.spec.ts,
       deploy/auto-update.sh, docker-compose.prod.yml);
       git diff --stat 9810d0b..<tip> -- crm-new/prisma = пусто (НОВЫХ МИГРАЦИЙ У ЭТАПА 13 НЕТ — ожидание «No pending»);
       git diff --stat 9810d0b..<tip> -- frontend = пусто (образ панели пересоберётся из того же кода)
tests: на слитой ветке 22.09: CRM jest 1196 / 1196 (109 suites); панель vitest 78 / 78; nest build; prisma validate;
       eslint по файлам этапа 13 — 0
server (read-only): backend = образ 9810d0b healthy; MetrikaSyncRun RUNNING = 0; последний тик SUCCESS; _prisma_migrations 86,
       таблиц 64; auto-update.timer active; compose/.env на сервере НЕ РЕДАКТИРУЮТСЯ до Gate B (иначе старый auto-update без
       --no-deps пересоздаст backend старым образом — повтор 17.09); ANALYTICS_* флаги как есть
BEFORE (JSON, ADMIN в контейнере, ЗАКРЫТЫЕ окна from/to = 10.09–16.09 и 03.09–09.09, не пресеты):
       Stage 09 overview/sources/landings; Stage 10 summary/funnels/issues; Stage 11 growth/changes + A latest (v, verdict);
       Stage 12 insights feed?status=all (8 карточек: id, fingerprint, latestVersion, payloadHash через БД), quality;
       Stage 06 outbox по статусам; /health; ops status ещё нет (404)
backup: cp docker-compose.prod.yml → .bak-stage13A-<ts>; cp .env → .bak-stage13A-<ts>; pg_dump | gzip →
       backups/premigration_stage13_<ts>.sql.gz (размер > 100 КБ, заголовок читается, запись в backup.log)
```

### ACTION

```text
1. git checkout master && git merge --ff-only <tip> && git push origin master            (один push, без force)
2. GitHub Actions «Сборка образов» (master): job test → build; метки :<sha>, :production, :latest (первый :production)
3. /opt/deploy/auto-update.sh (старый, каждые 5 мин) тянет :latest: backend → recreate; frontend → recreate (образ
   пересобран, id новый); backend НЕ пересоздаётся второй раз (compose/env не менялись) — контролировать § 1.1
4. ждать healthy обоих; nginx reload (скрипт делает сам); прогрев холста (штатно, ~6 мин)
```

### VERIFY

```text
- boot-лог backend: «83 migrations found … No pending migrations to apply»; модули: GrowthModule/InsightsModule «включён»;
  Nest started; ошибок 0
- /health → {status ok, database ok, build: <sha master tip>, uptimeSeconds, timestamp}; docker image inspect
  ghcr.io/tigo929/racpechatca-backend:latest → Labels.org.opencontainers.image.revision = тот же sha; RepoDigests записать
- GET /analytics/ops/status: без токена 401; EXECUTOR 403; ADMIN 200: build = sha; flags {dashboard, growth, insights,
  analyticsSync, ordersSync: true; metrikaConfigured: true}; database {reachable, appliedMigrations 83, pendingMigrations [],
  unknownMigrations [], rolledBackMigrations 0, lastMigration 20260916120000_analytics_insights}; subsystems все HEALTHY
  (metrikaAnalyticsSync после boot-тика; до него допустимо STALE=false, т.к. lastSuccess < 2 ч); conditions [] ;
  JSON не содержит token/secret/password/DATABASE_URL/ClientID/телефонов (grep)
- auth/privacy: матрица на production-JWT: без токена 401 на status/feed/ops; EXECUTOR 403; ADMIN OFF-маршруты не
  трогаем (флаги ON); DTO: POST insights/:id/resolve {} → 400, с customerPhone → 400 «should not exist»;
  GET insights/feed?severity=WRONG → 400; несуществующий id → 404 «Сигнал не найден»
- Stage 06–12 AFTER = BEFORE (те же закрытые окна): diff 0 по всем листьям; insights: 8 карточек, те же fingerprint и
  payloadHash, latestVersion не изменились; outbox статусы те же; MetrikaSyncRun: тики после деплоя SUCCESS 12/12
- migration gate: _prisma_migrations = 86, таблиц 64 (ничего не добавилось относительно Gate 0)
- контейнеры: StartedAt backend/frontend обновились ровно по одному разу; postgres/greeter/photo-* не тронуты
```

### STOP

Любое из § 1; дополнительно: «Applying migration» в boot-логе; `/health.build` = null у образа с меткой; ops status 500;
BEFORE ≠ AFTER; второй recreate backend.

### ROLLBACK

```text
уровень 1 — откат образа: git revert коммитов 806e328/51f27ae в master → push → CI → auto-update (старый скрипт) → :latest
            = предыдущий код; таблицы не менялись — ничего откатывать в БД; (быстрее: IMAGE_TAG не применим до Gate B —
            старый скрипт тянет только :latest)
уровень 2 — только диагностика: раздел /analytics/ops не имеет флага; при проблеме — уровень 1
compose/.env восстанавливать не нужно (в Gate A не редактируются); backup остаётся
```

---

## 4. GATE B — deployment / compose hardening (сервер)

### PRECHECK

```text
- Gate A выполнен: в GHCR есть ghcr.io/tigo929/racpechatca-backend:production и racpechatca-frontend:production
  (docker manifest inspect / docker pull на сервере), и их image id = id запущенных контейнеров (иначе переключение тега
  вызовет recreate — тогда сначала дождаться, пока auto-update по :latest выровняет)
- сервер: sha256(/opt/deploy/auto-update.sh) = 1219cba15ca1d9f2… (текущий = deploy/auto-update.sh до этапа 13);
  новый файл deploy/auto-update.sh из кандидата: sha256 698459f509499af4…; bash -n проходит; содержит --no-deps,
  IMAGE_TAG=production, verify_build, TARGETS api→web→backend→frontend
- Docker Compose v5.1.4 (поддерживает --dry-run); systemd auto-update.timer активен; сейчас не идёт запуск auto-update
  (systemctl is-active auto-update.service = inactive) и не идёт тик синхронизации
- backups: cp /opt/deploy/auto-update.sh → /opt/deploy/auto-update.sh.bak-stage13-<ts>;
           cp /opt/raspechatka/docker-compose.prod.yml → .bak-stage13B-<ts>; cp /opt/photo/docker-compose.prod.yml → .bak-stage13B-<ts>
```

### ACTION

```text
1. systemctl stop auto-update.timer                      (пауза таймера на время правок; сервис oneshot)
2. cp deploy/auto-update.sh → /opt/deploy/auto-update.sh; chmod как у старого; sha256 сверить = 698459f5…; bash -n
3. /opt/raspechatka/docker-compose.prod.yml: image racpechatca-backend:latest → :production; frontend:latest → :production
   (только строки image; docker compose config → образы :production; diff с backup = 2 строки)
4. /opt/photo/docker-compose.prod.yml: пока НЕ трогать (образов :production для сайта ещё нет — Gate C)
5. доказательство targeted update (без реального пересоздания):
   cd /opt/raspechatka && docker compose -f docker-compose.prod.yml --dry-run up -d --force-recreate --no-deps frontend
     → в выводе план только для frontend (Recreate), backend/postgres/greeter отсутствуют
   docker compose -f docker-compose.prod.yml --dry-run up -d --force-recreate frontend   (без --no-deps, для сравнения)
     → показывает зависимости (backend) в плане — иллюстрация исходной причины; ничего не выполняется
6. ручной прогон нового скрипта: /opt/deploy/auto-update.sh → в логе для backend/frontend pull :production, id совпал →
   «Обновляю» НЕ печатается, recreate нет; сайт: строка compose с :production отсутствует → пропуск молча
7. systemctl start auto-update.timer; следующий запуск по таймеру — без изменений
```

### VERIFY

```text
- StartedAt всех контейнеров не изменился с Gate A; /health.build прежний; nginx не перечитывался лишний раз
- /var/log/auto-update.log: ни «Обновляю», ни ОШИБКА/ВНИМАНИЕ после замены скрипта; при отсутствии обновлений скрипт
  пишет только «Итог» при updated/failed > 0 → лог пуст — это норма
- docker compose config: два образа :production; compose валиден
- dry-run вывод сохранён в отчёт (какие сервисы пересоздавались бы с --no-deps и без)
- verify_build проверяется вживую при первом реальном обновлении (Gate C — сайт; следующий CRM-деплой)
```

### STOP

Recreate любого контейнера в Gate B; `bash -n` ошибка; sha нового скрипта ≠ репозиторному; compose config невалиден;
pull `:production` даёт другой id, чем запущенный (тогда сначала выровнять через `:latest`, затем повторить B).

### ROLLBACK (мгновенный)

```text
systemctl stop auto-update.timer
cp /opt/deploy/auto-update.sh.bak-stage13-<ts> /opt/deploy/auto-update.sh
cp /opt/raspechatka/docker-compose.prod.yml.bak-stage13B-<ts> /opt/raspechatka/docker-compose.prod.yml
systemctl start auto-update.timer
→ сервер снова потребляет :latest (который CI по-прежнему публикует); контейнеры не трогаются
```

---

## 5. GATE C — web-photo CI safety (кандидат 441d795)

### PRECHECK

```text
- точный diff feature/cms-admin (812f9cb) → feature/ci-safety (441d795): 2 файла, +122/−8:
    .github/workflows/build-images.yml  (+45/−8):
      - branches: [main, feature/yandex-yml-feed, feature/canvas-section, feature/cms-admin]  →  + branches: [feature/cms-admin]
      + шаг «Проверка инвариантов CI»: node scripts/ci-safety-check.mjs (до сборки)
      + шаг «Метки образа» (id: tags): tags="$IMAGE:${{ github.sha }}"; if github.ref == refs/heads/feature/cms-admin →
        + ",$IMAGE:production,$IMAGE:latest"
      - tags: | …:latest / …:${{ github.sha }}   →   + tags: ${{ steps.tags.outputs.value }}
      + labels: org.opencontainers.image.revision=${{ github.sha }}, org.opencontainers.image.source=…
      (BUILD_SHA=${{ github.sha }} в build-args — было; код сайта, event model, nginx-domain.conf — не менялись)
    scripts/ci-safety-check.mjs (+85): инварианты + модель угрозы
- какие refs что публикуют (по кандидату):
    refs/heads/feature/cms-admin  → :<sha>, :production, :latest      (единственный триггер push; workflow_dispatch с этой же ветки)
    любой другой ref с ЭТИМ файлом → сборка не запускается (branches); при ручном workflow_dispatch с другой ветки →
                                     только :<sha> (условие по github.ref)
    устаревшая ветка со СТАРЫМ файлом (например feature/print-card-lead-form) → её workflow может опубликовать :latest и
                                     :<sha> — :production НИКОГДА (метки production нет в старом файле); сервер после
                                     Gate B потребляет :production → подмена невозможна
- node scripts/ci-safety-check.mjs на 441d795 → «CI safety OK»; на 812f9cb (текущий production workflow) → 9 нарушений
  (evidence уже получено 17.09; повторить перед merge)
- Actions API: последний запуск сайта — 15.09 18:29 (feature/cms-admin); запусков от feature/ci-safety нет
- сайт сейчас: /api/health build = 812f9cb2ab8df6f2a5190712a3b6e15ee52b2a34; api/web healthy; CRM-контейнеры StartedAt записать
- stale-ветки НЕ пушить и НЕ запускать для проверки (спецификация § 18)
```

### ACTION

```text
1. git checkout feature/cms-admin && git merge --ff-only feature/ci-safety && git push origin feature/cms-admin
   (tip = 441d795 → BUILD_SHA = 441d795…; это production-деплой сайта: образы пересоберутся из того же кода 812f9cb)
2. Actions (feature/cms-admin): шаг «Проверка инвариантов CI» → OK; «Метки образа» печатает :441d795…,:production,:latest
   для api и web; build-push успешен; проверить, что в GHCR появились web-photo-api:production и web-photo-web:production
   с revision = 441d795…
3. /opt/photo/docker-compose.prod.yml: api:latest → :production; web:latest → :production (backup сделан в Gate B)
4. следующий запуск auto-update (новый скрипт): api → pull :production → «Обновляю api» → recreate --no-deps → healthy;
   web → «Обновляю web» → recreate --no-deps → healthy → verify_build (web: LABEL revision ↔ /api/health build) →
   «Сборка подтверждена: photo-web-1 build=441d795…»; nginx reload; прогрев холста; «Итог: обновлено 2, ошибок 0»
```

### VERIFY

```text
- https://raspechatkaa.ru/api/health → build = 441d795… (полный sha merge-коммита), catalog/migrations как прежде
- docker image inspect web-photo-web:production → Labels.revision = 441d795…, RepoDigests записать; то же для api
- targeted update доказан вживую: пересозданы ТОЛЬКО photo-api-1 и photo-web-1 (в этом порядке); raspechatka-backend-1 /
  frontend-1 / postgres-1 / greeter-1 — StartedAt без изменений (§ 1.1)
- страницы сайта: главная, /interer/holst (цены на месте — лог «Холст прогрет, цены на месте»), форма заявки открывается;
  заявок тестовых не создавать
- Actions: запусков от других refs нет; список workflow-запусков за rollout — только feature/cms-admin
- стало невозможно: production-метка из не-production ref — подтверждено статически (ci-safety-check в самом workflow) и
  тем, что сервер читает только :production
```

### STOP

`ci-safety-check` красный на кандидате; в GHCR `:production` с revision ≠ 441d795…; `/api/health.build` ≠ 441d795…;
auto-update «ВНИМАНИЕ … не та сборка»; пересоздан любой CRM-контейнер; сайт не healthy 5 мин; «Цены временно недоступны»
после прогрева.

### ROLLBACK

```text
образ:   в /opt/photo/docker-compose.prod.yml поставить image …web-photo-api:812f9cb2ab8df6f2a5190712a3b6e15ee52b2a34 и
         …web-photo-web:812f9cb2ab8df6f2a5190712a3b6e15ee52b2a34 (метка :<sha> прежнего production, есть в GHCR) и
         IMAGE_TAG=812f9cb2ab8df6f2a5190712a3b6e15ee52b2a34 /opt/deploy/auto-update.sh → recreate api, web на прежний код;
         затем вернуть compose на :production после исправления
workflow: git revert 441d795 в feature/cms-admin → push → CI (по старому файлу) → :latest/:<sha>; сервер на :production
          этот образ не подхватит — потому откат кода сайта делается через тег :<sha> выше, а не через latest
```

---

## 6. GATE D — operational validation

### D1 (сразу после Gate A) и D2 (после B, C и ≥ 2 автоциклов)

```text
PRECHECK  A выполнен; для D2 — B и C выполнены, прошло ≥ 2 тика планировщика после recreate backend (boot daily + hourly)
ACTION    только чтение: HTTP (JWT в контейнере), SQL, docker inspect, логи
VERIFY
  build identity:  /health.build = sha master tip; LABEL revision образа backend = тот же; RepoDigests записаны;
                   сайт: /api/health.build = 441d795… = LABEL web:production
  ops states:      все 10 подсистем HEALTHY (analyticsDashboard/growth/insights ENABLED → HEALTHY); conditions [];
                   sync.dataAgeSeconds < 7200; insights.lastRunStatus SUCCESS; outbox pending 0 / failed 0;
                   database pending/unknown [] ; thresholds отданы; ответ ≤ 0,5 с
  scheduler:       boot-тик после Gate A — daily (sync 21 день) SUCCESS 12/12 → снимки 8/8 → «Рост: автооценка» →
                   «Сигналы: запуск daily — … версий N …» (N = 0, если числа окна не изменились; числа менялись, если
                   cutoff сдвинулся — фиксировать); следующий тик через час — hourly, «Сигналы: запуск hourly» 2 детектора;
                   RUNNING сейчас 0; LOCKED 0; FAILED 0; порядок хуков в логе sync → snapshots → growth → insights
  stuck detection: на production не инжектируется; проверить, что диагностика отдаёт oldestRunningAgeSeconds = null и
                   пороги syncStuckSeconds 3600 / insightsStuckSeconds 600 / outboxStuckProcessingSeconds 600; закрытие
                   зависших RUNNING — «Сигналы: N зависших запусков закрыты» в логе отсутствует (нечего закрывать) —
                   тесты F4 являются evidence
  outbox:          сводка в ops = SQL по статусам; oldestPendingAgeSeconds null; lastDeliveredAt прежний
  no leakage:      grep по ops JSON, /health, логам backend/frontend/photo-* с момента Gate A: y0_/OAuth/Bearer/JWT/
                   password/JWT_SECRET/postgresql://…:…@/ClientID19/телефоны = 0
  performance:     in-container: /health ≤ 0,1 с; ops/status ≤ 0,5 с; insights feed ≤ 0,5 с; Stage 09 overview 30d
                   как BEFORE ±10 %; daily run (по журналу durationMs) ≤ 5 с; hourly ≤ 2 с; xact_commit за час не растёт
                   аномально (≈ прежние ~160 SQL на daily)
  ≥ 2 cycles:      MetrikaSyncRun за окно: ≥ 2 тика SUCCESS после recreate; AnalyticsInsightRun: daily + hourly SUCCESS
  auto-update log: после Gate C — «Готово: api», «Готово: web», «Сборка подтверждена: photo-web-1 build=…», «nginx перечитан»,
                   «Итог: обновлено 2, ошибок 0»; ни одной строки про backend/frontend CRM
STOP      § 1 (false HEALTHY при известной проблеме; mismatch build; неожиданный recreate); FAILED тик; RUNNING > порогов
ROLLBACK  не применяется (только чтение); при находке — откат соответствующего gate-а
```

---

## 7. GATE E — backup / restore

```text
PRECHECK  restore drill уже пройден 17.09.2026 (BACKUP_RESTORE_RUNBOOK.md § 2: restore 6 с, ERROR 0, 83/62/172/45,
          счётчики равны, сверка этапов 09–12 diff 0; временные БД удалены) — повторный destructive drill НЕ требуется
ACTION    только чтение
VERIFY    свежий ночной бэкап: /opt/raspechatka/backups/crm_<сегодня>_030001.sql.gz существует, размер ≥ 700 КБ (17.09: 800 208 B),
          zcat | head → «PostgreSQL database dump», CREATE TABLE ≥ 96; backup.log за сегодня: «OK облако db/…» и
          «OK облако techspec/»; premigration_stage13_<ts> из Gate A на месте; локальных копий ≤ 14 + premigration;
          evidence drill процитирован в отчёте
STOP      бэкап отсутствует/пустой/без строки OK облако → STOP до начала Gate A (бэкап — предусловие деплоя)
ROLLBACK  —
```

---

## 8. GATE F — retention: только dry-run

```text
PRECHECK  Gate A выполнен (в образе есть dist/src/analytics/retention-cli.js); ANALYTICS_RETENTION_APPLY отсутствует в
          окружении контейнера (docker exec … printenv | grep -c RETENTION = 0)
ACTION    docker exec raspechatka-backend-1 node dist/src/analytics/retention-cli.js        (без --apply)
VERIFY    JSON-план: dryRun true; 5 правил с cutoff и rows; на 17.09 ожидание rows = 0 по всем правилам (старейшие строки
          MetrikaSyncRun — 12.09, AnalyticsInsightRun — 17.09, outbox delivered — 09.2026); never — 5 позиций; stderr
          «dry-run: … удаление только с --apply и ANALYTICS_RETENTION_APPLY=1»; счётчики таблиц до/после равны
          (MetrikaSyncRun, AnalyticsInsightRun, MetrikaOrderOutbox); в журнале нет DELETE (pg_stat_user_tables.n_tup_del
          по этим таблицам не изменился)
STOP      любое изменение счётчиков / n_tup_del; команда потребовала подтверждение и получила его — недопустимо
ROLLBACK  — (ничего не пишется). --apply в этом rollout ЗАПРЕЩЁН; расписание — отдельное решение Reviewer
```

---

## 9. GATE G — secrets

```text
PRECHECK  SECRET_ROTATION_RUNBOOK.md на месте; SECRET_FOUND=no (скан 17.09)
ACTION    ротация НЕ выполняется (ни OAuth, ни client secret, ни JWT, ни DB); значения не выводятся
VERIFY    после Gate A/C: grep логов backend/frontend/photo-api/photo-web с начала rollout — 0 совпадений по шаблонам
          секретов; ops JSON и /health — без значений переменных (только флаги true/false и build); файлы .env не
          изменились по sha256 (сравнение хэшей, не содержимого) кроме… — в этом rollout .env не редактируется вовсе
STOP      любое совпадение шаблона секрета в логах/ответах → STOP + «rotation_required=yes» в отчёте (без значения)
ROLLBACK  —
```

---

## 10. GATE H — infrastructure debts: решения для Reviewer (в rollout НЕ выполняются)

| # | Долг | Рекомендация исполнителя | Когда / кто | Риск, если не делать |
|---|---|---|---|---|
| H1 | Drift `SalaryPayment.updatedAt` (DEFAULT CURRENT_TIMESTAMP при `@updatedAt`) | отдельная миграция `ALTER TABLE "SalaryPayment" ALTER COLUMN "updatedAt" DROP DEFAULT;` (метаданные, обратима `SET DEFAULT CURRENT_TIMESTAMP`); применить обычным деплоем в следующем CRM-релизе; до этого diff считать известным отклонением | отдельный FIX, Reviewer + владелец | функционального риска нет; любой drift-check в этапе 14 будет «красным» |
| H2 | nginx access log сайта хранит `yclid=<19–20 цифр>` и IP | в server-блоке сайта (`/opt/photo`/nginx-domain.conf в web-photo и `frontend/nginx-photo.conf`) задать `log_format site '$remote_addr - [$time_local] "$request_method $uri" $status $body_bytes_sent "$http_user_agent"'` (без query-string) или `map $args` с маскированием `yclid`; применить через деплой образа frontend + правку серверного conf | rollout сайта/frontend, владелец решает про IP | yclid — рекламный идентификатор, не PII в строгом смысле, но спецификация относит его к скану; IP — стандарт nginx |
| H3 | Docker json-file без ротации | `/etc/docker/daemon.json`: `{"log-driver":"json-file","log-opts":{"max-size":"50m","max-file":"5"}}` — требует `systemctl restart docker` (перезапуск ВСЕХ контейнеров → окно простоя 1–2 мин, тик расписания пересинхронизирует) либо per-service `logging:` в compose (recreate по одному, с `--no-deps`) | отдельное окно, владелец | сейчас логи малы (1,5 МБ/7 д); риск роста при аварийном спаме |
| H4 | `sshd PasswordAuthentication yes` при ключевом входе | `PasswordAuthentication no` + `KbdInteractiveAuthentication no` в sshd_config, `sshd -t`, `systemctl reload sshd`; ПЕРЕД этим убедиться, что ключ владельца в authorized_keys и вход по ключу работает из второй сессии | владелец, вне аналитики | брутфорс по паролю root |
| H5 | GitHub: branch protection / environment | защитить `master` (racpechatca) и `feature/cms-admin` (web-photo): запрет force-push и удаления; environment `production` с deployment-branch policy — потребует перенести шаг публикации production-меток в job с `environment: production` (следующий FIX workflow); удалить устаревшие ветки сайта, чей старый workflow перечисляет их самих | владелец (настройки GitHub), Reviewer | без этого защита держится на метках по ref + потреблении :production (достаточно), protection — второй слой |
| H6 | Окончательное удаление `:latest` | после ≥ 7 дней стабильной работы обоих серверов на `:production`: убрать `,$IMAGE:latest` из обоих workflow (тесты/скрипт обновить), проверить, что ни один compose/скрипт не ссылается на `:latest` | Reviewer, следующий релиз | `latest` продолжают публиковать и устаревшие ветки — пока сервер его не читает, риска нет |
| H7 | Скан секретов в CI | шаг `gitleaks/gitleaks-action` (или grep по шаблонам SECRET_ROTATION_RUNBOOK.md § 1) в job `test` обоих репозиториев, блокирующий сборку | Reviewer, следующий релиз | утечка секрета попадёт в реестр до обнаружения |
| H8 | `lastDailyDate` планировщика в памяти | хранить в БД/таблице настроек → рестарт не вызывает лишний суточный тик (23 запроса) | по желанию, этап 14 | лишняя нагрузка на API Метрики при частых рестартах |

Ни один пункт H не применяется автоматически в этом rollout; решения Reviewer — в отчёт OPEN_DECISIONS.

---

## 11. ACCEPTANCE GATE

Rollout выполнен со стороны исполнителя, когда:

1. Gate A: master = кандидат; образы новые; «No pending migrations»; `/health.build` = sha = LABEL; ops status ADMIN 200 без
   секретов; auth-матрица; Stage 06–12 BEFORE = AFTER по закрытым окнам; ровно один recreate backend/frontend;
2. Gate B: новый auto-update.sh (sha 698459f5…) и compose `:production` на сервере; dry-run доказал targeted update;
   recreate 0; rollback-файлы на месте;
3. Gate C: feature/cms-admin = 441d795; CI по новой схеме; `:production` для api/web с revision 441d795…; сайт build =
   441d795…; пересозданы только api и web; «Сборка подтверждена»;
4. Gate D: все состояния/условия ожидаемые; ≥ 2 автоцикла; утечек 0; perf в цели;
5. Gate E: свежий бэкап валиден; evidence drill процитирован;
6. Gate F: dry-run без удалений; Gate G: ротаций нет, утечек нет;
7. Gate H: таблица решений в отчёте;
8. § 12 отчёт записан в `13_RELIABILITY_SECURITY.md` / этот файл; production после rollout больше не меняется; DONE ставит Reviewer.

---

## 12. EXECUTOR_REPORT_STAGE13_PRODUCTION_ROLLOUT — формат

```text
RESULT (DONE_PENDING_REVIEW | BLOCKED | ROLLED_BACK) + какие gate-ы выполнены
GATE A   git/tests/backup/migration gate («No pending»)/deploy/build/health/ops/auth-privacy/Stage 06–12 BEFORE=AFTER
GATE B   backup скрипта и compose, sha, dry-run вывод, recreate 0, rollback-путь
GATE C   точный diff, таблица refs → метки, ci-safety-check результаты, Actions run, GHCR revision, /api/health.build,
         пересозданные контейнеры, verify_build строка
GATE D   build identity, ops states/conditions, scheduler циклы и порядок хуков, stuck detection (evidence), outbox,
         утечки 0, perf
GATE E   бэкап сегодня + drill evidence
GATE F   dry-run JSON, счётчики до/после
GATE G   ротаций нет, утечек нет
GATE H   таблица решений для Reviewer
NEW_FACTS / DEVIATIONS / OPEN_DECISIONS
PRODUCTION_STATE  флаги, образы (id, revision, digest), compose-теги, auto-update sha, миграции 86 / таблиц 64
```

---

## 13. START COMMAND

Rollout начинается только после отдельной команды Reviewer:

`СТАРТ`

с указанием кандидатов (`44ca8c9` или его docs-only потомок с этим планом; web-photo `441d795`), подтверждением, что
Gate 0 (production = master, деплой владельца) выполнен, и порядка gate-ов (по умолчанию A → B → C → D → E → F → G; H —
только решения). До команды production не менять; Stage 14
не начинать; этот документ — план, не отчёт.

---

# 14. EXECUTOR_REPORT_STAGE13_PRODUCTION_ROLLOUT — 22.09.2026

## RESULT

```text
STOPPED_AT_GATE_C (глобальное STOP-условие § 1.2 сработало по букве правила: auto-update записал
«ВНИМАНИЕ: photo-web-1 отвечает build=<пусто>, а образ помечен 441d7955251d — работает не та сборка»).
Выполнены и приняты: Gate 0, Gate A, Gate B. Gate C: деплой сайта фактически корректен и доказан тремя
независимыми способами (метка образа = /api/health = digest = approved SHA 441d795), но встроенная сверка
сборки в новом auto-update дала ЛОЖНОЕ срабатывание — она опрашивает контейнер без healthcheck через ~2 с
после старта, когда Next.js ещё не слушает порт. Gates D, E, F, G не запускались (правило «не продолжать,
чтобы закончить rollout»). Gate H — только фиксация долгов, изменений нет.
Production НЕ откатывался: и CRM, и сайт работают на одобренных сборках, все проверки данных зелёные;
откат вернул бы известный P0 (auto-update без --no-deps) и старую сборку сайта. Команды отката — § ROLLBACK STATUS.
Дальнейшие шаги — решение Reviewer (FIX_01 / FIX_02, затем Gates D–G).
```

## GATE 0 — production = master (деплой владельца) — ПРОЙДЕН

```text
PRECHECK 14:10:43 MSK: backend 2969889e3192 (= образ 0d7d7b2 от 20.09) healthy, frontend a98ee3269eb2;
  миграций 85 (последняя 20260920010000_site_lead_push_delivery); таблиц 64; auto-update.timer inactive
  (остановлен 21.09 16:01); compose :latest; sync RUNNING 0; заказов 377
  (PAID 283, SENT 64, NEW 8, READY 7, LEAD 6, FOLDER_STRUCTURE_CREATED 5, IN_PROGRESS 2, SHIPMENT_CREATED 2);
  PICKUP + SHIPMENT_CREATED = 0 (кандидатов на data-repair нет); StatusHistory system:pickup-fulfillment-fix = 0
BACKUP: /opt/raspechatka/backups/premigration_gate0_stage13_20260922_141045.sql.gz — 2 320 726 B,
  CREATE TABLE 101, заголовок «PostgreSQL database dump» читается, запись в backup.log;
  docker-compose.prod.yml.bak-gate0-20260922-1410, .env.bak-gate0-20260922-1410
ACTION: systemctl start auto-update.timer (+ ручной запуск сервиса) — деплой владельца до master 9810d0b
MIGRATION: boot-лог «86 migrations found … Applying migration 20260921010000_fix_pickup_fulfillment …
  The following migration(s) have been applied»; _prisma_migrations: finished 14:14:14, rolled_back null,
  applied_steps_count 1; итог 86 миграций, 64 таблицы
DATA-REPAIR (сверка планом, ручных правок НЕ делалось): PICKUP+SHIPMENT_CREATED после = 0;
  StatusHistory changedBy='system:pickup-fulfillment-fix' = 0 → миграция подошла к 0 строк, потому что
  кандидатов не было уже до неё (см. PRECHECK). Оставшиеся 2 заказа в SHIPMENT_CREATED — 20260917-140 и
  20260921-168, оба YANDEX_PVZ (не самовывоз) → корректно не тронуты. PICKUP-заказы по статусам:
  PAID 164, SENT 14, NEW 5, READY 5, LEAD 3, FOLDER_STRUCTURE_CREATED 2 — SHIPMENT_CREATED нет
VERIFY: backend 08ab8d2d4d1b == образ сборки 9810d0b (pull :9810d0b0b1d2… → тот же id; frontend 46271700a695
  тоже MATCH); миграций 86 ✓; таблиц 64 ✓; auto-update.timer active ✓; /health ok ✓; Nest started, ERROR 0;
  тик расписания после деплоя: daily SUCCESS 14:16 (снимки 8/8, хук сигналов hourly SUCCESS 14:16:09)
DRY-RUN ПЛАНА ДНЯ (ничего не отправлено): POST /order-photo/daily-plan/run?dry=true → 201,
  empty=false, sent=false, orderCount 12, 1086 символов; «ОТГРУЗКИ» false, «старший дня» false, 🚚 false;
  исполнителей 2, блоков «В работе» 2, «Готовы к выдаче» 1, «Без исполнителя» есть
```

## GATE A — CRM reliability (кандидат 44ca8c9 → docs-tip 40efd48) — ПРОЙДЕН

```text
PRECHECK git: origin/master = 9810d0b; 40efd48 ⊃ master (ff); изменённые файлы вне docs — ровно 26 файлов
  этапа 13 (.github/workflows/build-images.yml, crm-new/Dockerfile.prebuilt, package.json, src/analytics/{ops,
  retention,insights,growth}, health.controller.ts, app.module.ts, deploy-safety.spec.ts,
  analytics-route-matrix.spec.ts, deploy/auto-update.sh, docker-compose.prod.yml);
  git diff -- crm-new/prisma = ПУСТО (новых миграций нет), git diff -- frontend = ПУСТО;
  запрещённых областей (web-photo, .env, nginx, greeter) — 0
PRECHECK tests: prisma validate OK; CRM jest 1196 / 1196 (109 suites); nest build OK; eslint 0;
  панель vitest 78 / 78
BACKUP: premigration_stage13A_20260922_142311.sql.gz — 2 591 066 B, CREATE TABLE 101, заголовок ок;
  compose/.env .bak-stage13A-20260922-1423
BEFORE (ADMIN, закрытые окна 10–16.09 и 03–09.09): 15 JSON + карточки этапа 12 из БД (9 строк) + outbox
  (delivered 15, skipped 59); /analytics/ops/status → 404 (маршрута ещё нет)
ACTION: git merge --ff-only 40efd48 → push origin master 14:25:49 (один push, без force);
  CI «Сборка образов» 14:26–14:30 SUCCESS (метки :<sha>, :production, :latest — первый :production);
  старый auto-update: backend 08ab8d2d4d1b → f19ce82f4842 (14:29:37–14:30:10), frontend 46271700a695 →
  c5f385f3e3cd (14:30:17–14:30:51), nginx перечитан
MIGRATION GATE: boot-лог «86 migrations found in prisma/migrations» → «No pending migrations to apply» ✓
  (STOP-условие «Stage 13 применяет миграцию» НЕ сработало); _prisma_migrations 86, таблиц 64
BUILD IDENTITY: /health → build 40efd48c48005ea0f32d1f670611aa18924adc92 = LABEL
  org.opencontainers.image.revision образа = sha master ✓
RECREATE: backend 1 раз (11:29:49), frontend 1 раз (11:30:20); postgres, greeter, photo-api, photo-web —
  StartedAt без изменений ✓
OPS STATUS: без токена 401 ✓, EXECUTOR 403 ✓, ADMIN 200 (609 мс, далее 376–513 мс), ответ 2 756 байт:
  build 40efd48…, timezone Europe/Moscow, flags все true + metrikaConfigured true,
  database {reachable, applied 86, pending [], unknown [], rolledBack 0, last 20260921010000_fix_pickup_fulfillment},
  sync {SUCCESS, dataAge 9 с, lastDataDay 2026-09-22, running 0, failed24h 0},
  outbox {pending 0, processing 0, failed 0, delivered 15, skipped 59},
  snapshots 64, insights {hourly SUCCESS, openCards 6}, thresholds 10 ключей;
  подсистемы: database/crmBusiness/metrikaApi/metrikaAnalyticsSync/metrikaOrdersOutbox/periodSnapshots/
  analyticsDashboard/behaviorAnalytics/automatedInsights — HEALTHY; growthEvaluations — DEGRADED;
  conditions: [GROWTH_RUN_FAILED WARNING] — ЛОЖНОЕ (см. NEW FACT 1);
  утечек по шаблонам (y0_/Bearer/postgres URL/JWT/телефон/19 цифр) — 0
AUTH/PRIVACY (production JWT в контейнере): feed без токена 401, EXECUTOR 403, POST run EXECUTOR 403;
  resolve {} → 400 (reason 3–300), resolve с customerPhone → 400 «property customerPhone should not exist»,
  feed?severity=WRONG → 400, несуществующий id → 404 «Сигнал не найден»
STAGE 06–12 RECONCILIATION (BEFORE vs AFTER, те же закрытые окна, 15 JSON, 3 506 листьев):
  значимых расхождений 0; волатильных (generatedAt / freshness / lastRun журнала) 92;
  единственное текстовое отличие — «возраст 5 с» → «возраст 7 с» в тексте причины молчания quality.stale
  (возраст данных внутри строки, не метрика);
  карточки этапа 12 в БД идентичны (9 строк: detectorId|entityKey|версия|статус|payloadHash);
  outbox delivered 15 / skipped 59 без изменений; nginx без токена → 401 JSON
```

## GATE B — deployment / compose hardening — ПРОЙДЕН

```text
PRECHECK: старый /opt/deploy/auto-update.sh sha256 1219cba15ca1d9f2 = довыкладочному; новый (git-версия, LF)
  698459f509499af4 = плану; bash -n ок; маркеры --no-deps 3, IMAGE_TAG 6, verify_build 2;
  :production в GHCR = запущенным образам: backend f19ce82f4842 MATCH, frontend c5f385f3e3cd MATCH,
  revision обоих = 40efd48c… → переключение тега не вызовет пересоздания
BACKUP: /opt/deploy/auto-update.sh.bak-stage13-20260922-1435 (7 670 B),
  /opt/raspechatka/docker-compose.prod.yml.bak-stage13B-20260922-1435 (9 632 B),
  /opt/photo/docker-compose.prod.yml.bak-stage13B-20260922-1435 (5 663 B)
ACTION: timer stop → install -m 755 нового скрипта (sha после установки 698459f509499af4) →
  compose CRM :latest → :production (ровно 2 строки, diff с backup = 2) → compose config валиден → timer start
ДОКАЗАТЕЛЬСТВО targeted update (docker compose --dry-run, ничего не выполнялось):
  с --no-deps:      Container raspechatka-frontend-1 Recreate / Recreated / Starting / Started — и всё
  без --no-deps:    Container raspechatka-backend-1 Recreate / Recreated … + frontend — то есть ровно тот
                    сценарий 17.09, из-за которого backend поднимался старым образом
Ручной прогон нового скрипта: ни одной строки «Обновляю» (id совпадают) → обновлений нет
VERIFY: StartedAt всех контейнеров без изменений (backend 11:29:49, frontend 11:30:20, postgres 13.09,
  greeter 19.09, photo-api/web 15.09); health ok, build 40efd48…; timer active
```

## GATE C — web-photo CI safety (кандидат 441d795) — ДЕПЛОЙ КОРРЕКТЕН, НО СРАБОТАЛО STOP-УСЛОВИЕ § 1.2

```text
PRECHECK diff feature/cms-admin (812f9cb) → feature/ci-safety (441d795): 2 файла, +122/−8:
  - branches: [main, feature/yandex-yml-feed, feature/canvas-section, feature/cms-admin]
  + branches: [feature/cms-admin]
  + шаг «Проверка инвариантов CI»: node scripts/ci-safety-check.mjs (до сборки)
  + шаг «Метки образа» (id: tags): tags="$IMAGE:${{ github.sha }}";
    if [ "${{ github.ref }}" = "refs/heads/feature/cms-admin" ] → tags="$tags,$IMAGE:production,$IMAGE:latest"
  - tags: | …:latest / …:${{ github.sha }}   →   + tags: ${{ steps.tags.outputs.value }}
  + labels: org.opencontainers.image.revision / image.source
  + scripts/ci-safety-check.mjs (85 строк)
КАКИЕ REF ЧТО ПУБЛИКУЮТ (по кандидату):
  refs/heads/feature/cms-admin      → :<sha>, :production, :latest
  любой другой ref с ЭТИМ файлом    → push-сборка не запускается (branches); workflow_dispatch с другой ветки → только :<sha>
  устаревшая ветка со СТАРЫМ файлом → :latest и :<sha>, но НИКОГДА :production (метки production в старом файле нет),
                                      а сервер после Gate B/C потребляет только :production
  Проверка инвариантов: на кандидате «CI safety OK»; на действующем production-workflow 812f9cb — 9 нарушений
  (branches, отсутствие шага меток, безусловный tags:, нет revision, проверка после сборки и т. д.).
  Устаревшая ветка для проверки НЕ пушилась (запрет спецификации).
ACTION: git merge --ff-only origin/feature/ci-safety → push origin feature/cms-admin 14:37:09 (tip 441d795);
  Actions run 35722459652 (feature/cms-admin, 441d795) — success 14:43:23; в GHCR появились
  web-photo-api:production (id 5d060578b045) и web-photo-web:production (id 9d2ac8d814df),
  revision обоих = 441d7955251dd6b95721b497976b73301f3e1486 = approved SHA ✓
  /opt/photo compose :latest → :production (backup из Gate B), config валиден;
  прогон нового auto-update: api 61d1b165141a → 5d060578b045 (14:44:42–14:45:00), web 5db2ad485db3 →
  9d2ac8d814df (14:45:01–14:45:04), nginx перечитан, холст прогрет («цены на месте»)
VERIFY (деплой корректен):
  цепочка approved SHA → image revision → /api/health.build: 441d7955251d = 441d7955251d = 441d7955251d ✓
  (через nginx и внутри контейнера; digest api sha256:5d060578b045…, web sha256:9d2ac8d814df…)
  пересозданы ТОЛЬКО photo-api-1 (11:44:55) и photo-web-1 (11:45:03); raspechatka-backend-1 (11:29:49),
  frontend (11:30:20), postgres, greeter — без изменений ✓
  страницы: / 200, /interer/holst 200, /ceny 200; «Цены временно недоступны» — 0 ✓
STOP § 1.2 (по букве правила): в /var/log/auto-update.log 14:45:05 —
  «ВНИМАНИЕ: photo-web-1 отвечает build=<пусто>, а образ помечен 441d7955251d — работает не та сборка»,
  итог одного из прогонов «обновлено 1, ошибок 1».
ДИАГНОСТИКА (14:52): ложное срабатывание сверки, а не подмена сборки —
  1) тёплый опрос того же контейнера тем же выражением sed даёт build 441d7955251dd6b95721b497976b73301f3e1486;
  2) у photo-web-1 НЕТ healthcheck → скрипт считает контейнер «поднявшимся» сразу (running:none) и опрашивает
     /api/health через ~2 с после старта, когда Next.js ещё не слушает порт (api и backend CRM имеют healthcheck —
     у них сверка проходит: контроль на backend — build 40efd48… = revision 40efd48…);
  3) в то же окно работали ДВА прогона: ручной /opt/deploy/auto-update.sh из gate-скрипта и запуск по таймеру
     (systemd 14:44:54) — отсюда два «nginx перечитан», два «Холст прогрет» и два «Итог» (…ошибок 0 / …ошибок 1).
     Взаимного исключения между ручным вызовом скрипта и таймером нет (systemd защищает только запуск сервиса).
```

## GATES D, E, F, G — НЕ ЗАПУСКАЛИСЬ

```text
По правилу Reviewer «при любом глобальном STOP-условии остановить дальнейшие gates и не продолжать, чтобы
закончить rollout». Ничего из D (валидация), E (бэкапы), F (retention dry-run), G (секреты) не выполнялось;
retention --apply и ротация секретов не выполнялись и не планировались. Значения секретов нигде не выводились.
Частичные данные, уже полученные в Gate A/B/C и пригодные для D: /health.build = LABEL = sha; ops-состояния и
conditions (см. Gate A); порядок хуков sync → snapshots → growth → insights в тиках 14:16 и 14:31;
два автоматических цикла после деплоя Gate A (14:31 hourly, следующий — 15:31) — формальный пункт «≥ 2 цикла»
Gate D остаётся незакрытым, потому что gate не запускался.
```

## GATE H — infrastructure debts (только фиксация, изменений нет)

```text
H1 drift SalaryPayment.updatedAt — отдельная миграция ALTER COLUMN … DROP DEFAULT; не применялась
H2 nginx access log сайта хранит yclid и IP — предложен log_format без query-string; не менялось
H3 docker json-file без ротации — предложен daemon.json max-size 50m/max-file 5 (перезапуск docker) или
   per-service logging в compose; не менялось
H4 sshd PasswordAuthentication yes — предложено no после проверки ключевого входа; не менялось
H5 GitHub branch protection / environment production — настройки владельца; не менялось
H6 окончательное удаление :latest — после ≥ 7 дней на :production (сейчас оба сервера уже на :production);
   не менялось
H7 secret scan в CI (gitleaks / grep-шаг) — не добавлялся
H8 lastDailyDate планировщика в памяти (лишний суточный тик при рестарте) — не менялось
```

## NEW FACTS

```text
1. ЛОЖНЫЙ GROWTH_RUN_FAILED в диагностике этапа 13: OpsStatusService ищет оценки роста с trigger 'scheduled',
   а этап 11 пишет 'scheduler' → lastScheduledEvaluationAt всегда null → при наличии ACTIVE-изменения условие
   срабатывает всегда. Факт на бою: триггеры в AnalyticsChangeEvaluation — manual 8, scheduler 7; последняя
   scheduler-оценка 22.09 00:27 (в пределах порога 26 ч) → корректное состояние — HEALTHY без условий.
   Это ложное ПРЕДУПРЕЖДЕНИЕ (не false HEALTHY), но диагностика обязана быть точной → FIX_02.
2. ЛОЖНОЕ «работает не та сборка» в verify_build: сверка опрашивает /health сразу после старта контейнера,
   у которого нет healthcheck (photo-web-1) → пустой build. Нужен повтор с ожиданием (например, 5 попыток
   по 3 с) перед выводом предупреждения → FIX_01.
3. Нет взаимного исключения между ручным запуском /opt/deploy/auto-update.sh и запуском по таймеру: два
   прогона обновляли сайт одновременно. Рекомендация: запускать только через systemctl start
   auto-update.service либо добавить flock в скрипт.
4. Gate 0: data-repair миграция 20260921010000_fix_pickup_fulfillment на production не изменила ни одной
   строки (кандидатов PICKUP+SHIPMENT_CREATED не было уже до неё) — расхождение статусов, ради которого она
   писалась, к 22.09 отсутствовало.
5. Метка build в /health CRM и LABEL revision работают как задумано: 40efd48c… совпало у образа, контейнера
   и ответа; та же цепочка на сайте (441d7955…).
6. Первый :production для CRM и сайта выпущен именно с production-ветки; старый production-workflow сайта не
   проходит проверку инвариантов (9 нарушений) — защита работает на уровне и CI, и потребления образов.
```

## DEVIATIONS

```text
1. Gate 0 выполнен исполнителем по команде Reviewer (в плане он значился как деплой владельца); порядок шагов
   и backup соблюдены.
2. Кандидат CRM — docs-tip 40efd48 (= 44ca8c9 + план rollout), runtime-код идентичен 51f27ae/44ca8c9.
3. В Gate C новый auto-update запускался вручную из gate-скрипта, из-за чего совпал с прогоном по таймеру
   (NEW FACT 3). Правильный способ — systemctl start auto-update.service.
4. Файл auto-update.sh брался из git-блоба (LF), а не из рабочего дерева Windows (CRLF) — иначе на сервере
   получился бы скрипт с \r.
```

## OPEN DECISIONS (для Reviewer)

```text
1. FIX_01 (verify_build): ожидание готовности контейнера перед сверкой сборки — 5 попыток по 3 с, и только
   потом «ВНИМАНИЕ». Плюс рекомендация запускать обновление через systemd, а не напрямую (или flock).
2. FIX_02 (диагностика): trigger 'scheduled' → 'scheduler' в OpsStatusService + тест на фактическое значение
   этапа 11, чтобы ложное GROWTH_RUN_FAILED не повторилось.
3. После FIX_01/FIX_02 — повторный мини-деплой CRM (без миграций) и возобновление rollout с Gate D
   (ops states, ≥ 2 цикла, stuck detection, outbox, утечки, perf), затем E, F (только dry-run), G, H.
4. Оставить ли параллельную публикацию :latest (H6) — сейчас оба сервера уже потребляют :production.
```

## PRODUCTION STATE (22.09.2026 14:52 MSK)

```text
CRM:    master 40efd48; backend f19ce82f4842 (revision 40efd48c48005ea0f32d1f670611aa18924adc92,
        /health.build тот же), frontend c5f385f3e3cd; compose :production; миграций 86, таблиц 64;
        флаги dashboard/growth/insights/sync/orders = true; тики SUCCESS (14:16 daily, 14:31 hourly),
        RUNNING 0, outbox delivered 15 / skipped 59 / failed 0
Сайт:   feature/cms-admin 441d795; photo-api-1 5d060578b045, photo-web-1 9d2ac8d814df
        (revision 441d7955251d…, /api/health.build тот же); compose :production; страницы 200, цены на месте
Сервер: /opt/deploy/auto-update.sh = новый (sha 698459f509499af4, --no-deps, порядок api→web→backend→frontend,
        verify_build); auto-update.timer active; backup-файлы:
        auto-update.sh.bak-stage13-20260922-1435, docker-compose.prod.yml.bak-stage13B-20260922-1435 (CRM и photo),
        premigration_gate0_stage13_20260922_141045.sql.gz, premigration_stage13A_20260922_142311.sql.gz
Данные: заказы не правились (кроме data-repair миграции владельца, изменившей 0 строк); retention не запускался;
        секреты не ротировались и не выводились; Stage 14 не начинался
```

## ROLLBACK STATUS

```text
Откат НЕ выполнялся — ни одно STOP-условие не указывает на неверное состояние production:
сборки совпадают с одобренными SHA, данные этапов 06–12 не изменились, утечек нет, все сервисы здоровы.
Откат ухудшил бы состояние (вернул бы auto-update без --no-deps и прежнюю сборку сайта).
Готовые команды, если Reviewer решит откатывать:
  Gate B:  systemctl stop auto-update.timer
           cp /opt/deploy/auto-update.sh.bak-stage13-20260922-1435 /opt/deploy/auto-update.sh
           cp /opt/raspechatka/docker-compose.prod.yml.bak-stage13B-20260922-1435 /opt/raspechatka/docker-compose.prod.yml
           systemctl start auto-update.timer                 (сервер снова потребляет :latest)
  Gate C:  cp /opt/photo/docker-compose.prod.yml.bak-stage13B-20260922-1435 /opt/photo/docker-compose.prod.yml
           IMAGE_TAG=812f9cb2ab8df6f2a5190712a3b6e15ee52b2a34 /opt/deploy/auto-update.sh   (сайт на прежний код)
           git revert 441d795 в feature/cms-admin — только вместе с откатом compose
  Gate A:  git revert 806e328 51f27ae в master → push → CI → auto-update (миграций нет, БД не трогается)
  Gate 0:  откат образа CRM на :0d7d7b2…; данные миграции — из premigration_gate0_stage13_20260922_141045.sql.gz
```

---

## § 15. FIX STAGE 13 (22.09.2026) — два подтверждённых дефекта Gate C

Исправляются только дефекты самого инструмента выкладки и диагностики. Логика этапов 06–12,
семантика оценки роста (этап 11), пороги и контракт состояний не менялись.

### FIX_01 — сверка сборки и гонка двух запусков (`deploy/auto-update.sh`)

Симптом Gate C: «ВНИМАНИЕ: photo-web-1 отвечает build=<пусто>, а образ помечен 441d795…» при
полностью верной сборке; плюс задвоенные строки «nginx перечитан» / «Холст прогрет» / «Итог».

Причина: у `photo-web-1` нет healthcheck, скрипт считал контейнер готовым по факту запуска
(`running:none`) и спрашивал `/api/health` через ~2 с — приложение ещё не слушало порт;
одновременно ручной запуск наложился на тик таймера в 14:44:54.

Сделано:

```text
verify_build  — ограниченное ожидание готовности: VERIFY_BUILD_ATTEMPTS (12) × VERIFY_BUILD_INTERVAL (5 с) = 60 с
                build совпал                → PASS (в журнале номер попытки)
                build непустой и другой     → немедленный FAIL, без повторов
                пусто / мусор / 502 / HTML  → повтор до исчерпания попыток, затем FAIL
                метки revision нет          → сверять нечего, PASS (как и раньше)
acquire_lock  — единый неблокирующий замок на весь проход: flock -n (сервер), mkdir — резерв,
                замок от несуществующего процесса снимается. Второй запуск пишет
                «Пропуск: обновление уже идёт» и выходит с кодом 0, НЕ вставая в очередь.
main()        — весь проход обёрнут в функцию; при AUTO_UPDATE_SOURCE_ONLY=1 файл только
                отдаёт функции (для тестов), сам ничего не выполняет.
```

Тесты — `crm-new/src/deploy-auto-update.spec.ts` (12 случаев, скрипт подключается и исполняется
настоящим bash, docker подменён): мгновенное совпадение → PASS без ожидания; медленный старт
(пустые ответы → верный) → PASS; настоящее расхождение build → FAIL сразу; расхождение после
медленного старта → FAIL; контейнер не ответил ни разу → FAIL после N попыток; мусор вместо JSON
→ ограниченные повторы → FAIL; мусор, а следом верный ответ → PASS; образ без метки → PASS;
замок занят → второй процесс выходит за <5 с с кодом 3, после release берёт замок; протухший
замок снимается; полный проход при занятом замке пишет «Пропуск» и не трогает docker.
Статические инварианты добавлены в `crm-new/src/deploy-safety.spec.ts` (границы ожидания,
`flock` только с `-n`/`-u`, `trap release_lock EXIT`).

### FIX_02 — ложное `GROWTH_RUN_FAILED` (`crm-new/src/analytics/ops/ops-status.service.ts`)

Диагностика спрашивала `trigger: 'scheduled'`, а этап 11 пишет `'manual' | 'scheduler'`
(в production: manual 8, scheduler 7, последняя автооценка 22.09 00:27) — ответ всегда пустой,
подсистема `growthEvaluations` постоянно висела в DEGRADED с WARNING `GROWTH_RUN_FAILED`.

Сделано: значение берётся из типа контракта этапа 11 (`GrowthEvaluation['trigger']`), опечатка
больше не соберётся. Семантика оценки не менялась: провалившийся автопрогон строки не пишет,
поэтому «свежего провала» в журнале нет — он виден как отставание свежести, это прежний контракт.

Тесты — `crm-new/src/analytics/ops/ops-status.service.spec.ts` (7 случаев через фальшивую базу,
которая фильтрует строки ровно по переданному `where`): запрос идёт с `trigger: 'scheduler'`;
свежая автооценка → HEALTHY и без условия; автооценка старше 26 ч → `GROWTH_RUN_FAILED`;
свежая ручная оценка не подменяет свежесть автооценки; автооценок нет вовсе → `GROWTH_RUN_FAILED`;
активных изменений нет → HEALTHY; раздел выключен → DISABLED.

### Прогон тестов (локально, production не затронут)

```text
crm-new: jest — 111 suites / 1217 tests PASS (в т.ч. 12 новых shell-кейсов и 7 ops-кейсов)
crm-new: nest build — OK; eslint по изменённым файлам — чисто
web-photo: node scripts/ci-safety-check.mjs — OK (production-метки только с feature/cms-admin)
```

### § 15.1 Мини-rollout FIX (выполнять только после APPROVE Reviewer)

Без миграций, без изменения данных, без ротации секретов. Gate 0/A/B/C не повторяются.

```text
PRECHECK  git log master --oneline -1 (кандидат FIX смержен, CI зелёный, образ :production собран)
          docker image inspect ... :production → revision == одобренный SHA
          systemctl is-active auto-update.timer; снимок /analytics/ops/status (ожидаем прежнее
          ложное GROWTH_RUN_FAILED — он и должен исчезнуть)
ACTION    cp /opt/deploy/auto-update.sh /opt/deploy/auto-update.sh.bak-fix13-<ts>
          install -m 755 <новый скрипт> /opt/deploy/auto-update.sh   (bash -n перед установкой)
          обновление backend делает сам таймер (образ :production уже новый)
VERIFY    1) build identity: revision образа == /health.build == одобренный SHA;
          2) журнал: «Сборка подтверждена: … (попытка N)», ни одного «работает не та сборка»;
          3) замок: ручной запуск во время работы таймера пишет «Пропуск …» и выходит 0;
          4) /analytics/ops/status: growthEvaluations = HEALTHY, GROWTH_RUN_FAILED отсутствует,
             lastScheduledEvaluationAt — реальная дата автооценки;
          5) миграций по-прежнему 86, таблиц 64, пересоздан только backend
STOP      настоящее расхождение build; применение миграции; пересоздание лишних контейнеров;
          регресс этапов 06–12; утечка секретов/PII; ложный HEALTHY
ROLLBACK  cp /opt/deploy/auto-update.sh.bak-fix13-<ts> /opt/deploy/auto-update.sh
          IMAGE_TAG=<предыдущий sha> /opt/deploy/auto-update.sh (только вместе с compose-тегом)
```

После успешного мини-rollout rollout возобновляется с **Gate D** (≥ 2 автоматических цикла
планировщика) → E → F (только dry-run) → G (без ротаций) → H (только фиксация). Stage 14 не начинается.

---

## § 16. EXECUTOR_REPORT — MINI-ROLLOUT FIX + GATES D–H (22.09.2026, 20:34–21:48 MSK)

```text
STATUS: MINI_ROLLOUT_FIX = PASS; GATE D = PASS; GATE E = PASS; GATE F = PASS (dry-run);
        GATE G = PASS (ротаций нет); GATE H = зафиксировано. Stage 14 не начинался.
КАНДИДАТ: master fe88cfe2f8fd36d33211ac29135daa8d5b27c6f2 (fast-forward 40efd48 -> fe88cfe)
```

### Мини-rollout FIX — 10 пунктов команды

```text
1. merge    master не уходил вперёд (0 коммитов), кандидат основан на актуальном master ->
            fast-forward 40efd48 -> fe88cfe; ветка и master запушены; тесты/сборка прогонялись
            на том же дереве (111 suites / 1217 тестов, nest build, eslint, ci-safety-check сайта)
2. CI       образы :production опубликованы в 20:45; revision backend и frontend = fe88cfe2f8fd...
            (тесты в workflow идут до сборки — публикация :production и есть зелёный CI)
3. PRECHECK backup /opt/deploy/auto-update.sh.bak-fix13-20260922-2034 (11 382 Б, sha 698459f5...);
            backend build 40efd48..., migrations 86, tables 64, флаги все true, тик 20:30 SUCCESS;
            таймер остановлен на время выкладки; снят Stage 06–12 BEFORE (16 срезов) и ops-базлайн
            (growthEvaluations DEGRADED + ложное GROWTH_RUN_FAILED)
4. FIX_01   sha256 кандидата e07f4dca073068db... совпал с deploy/auto-update.sh на master; bash -n ok;
            установлено 17 650 Б, права 755; маркеры: --no-deps, IMAGE_TAG:-production, verify_build, acquire_lock
5. backend  проход 20:46:00–20:54:19: «Обновляю backend» -> «Готово: backend обновлён и здоров» ->
            «Сборка подтверждена: raspechatka-backend-1 build=fe88cfe2f8fd (попытка 1)» -> frontend ->
            «nginx перечитан» -> «Холст прогрет, цены на месте» -> «Итог: обновлено 2, ошибок 0».
            Миграции: «86 migrations found ... No pending migrations to apply» — НИ ОДНОЙ Applying migration;
            migrations 86, tables 64, применённых за час 0, rolled back 0
6. цепочка  master fe88cfe2f8fd... = revision образа backend = /health.build = revision образа frontend;
            digest backend sha256:1b65a8d21e94..., frontend sha256:392b32cbb337...; сайт остался на 441d795...
7. ops      growthEvaluations: DEGRADED -> HEALTHY, conditions: [GROWTH_RUN_FAILED] -> [];
            growth.lastScheduledEvaluationAt: null -> 2026-09-21T21:27:25.602Z (реальная автооценка 22.09 00:27,
            возраст 20,5 ч при пороге 26 ч). Оценок в базе было 15, осталось 15 — искусственных не создавали,
            manual-оценки (8) свежесть не подменяют. Доступ: без токена 401, EXECUTOR 403, ADMIN 200
8. verify   на УСТАНОВЛЕННОМ файле, живой backend:
            A настоящий путь, сборка совпала           -> PASS, попытка 1, 1 с
            B образ помечен чужой сборкой              -> FAIL сразу, 0 с, «работает не та сборка»
            C ответ с закрытого порта                  -> FAIL после 3 попыток за 4 с, «не отдал build»
            D сценарий Gate C (2 пустых, потом верный) -> PASS на 3-й попытке за 4 с
9. lock     при занятом замке (flock, /var/lock/auto-update.lock) второй полноценный запуск:
            «Пропуск: обновление уже идёт», код 0, 0 с; новых «Обновляю»/«Итог» — 0; StartedAt backend и
            frontend не изменились; набор образов на хосте тот же (md5 списка совпал)
10. baseline Stage 06–12: 15 срезов — 0 значимых расхождений (leaves 14...1007, различия только волатильные).
            Единственный срез с изменениями — ops: 14 расхождений, все ожидаемые (build SHA, исчезновение
            GROWTH_RUN_FAILED, growthEvaluations HEALTHY, часы снимков). Карточки этапа 12 идентичны (9),
            outbox delivered 16 / skipped 61 без изменений. Пересозданы только backend и frontend CRM
            (их образы пересобраны CI); postgres, greeter, photo-api, photo-web — прежние StartedAt
```

### GATE D — operational validation (PASS)

```text
build identity   master fe88cfe2f8fd... = LABEL revision backend = /health.build; frontend revision тот же;
                 RepoDigests записаны; сайт 441d7955251d... = LABEL web:production = /api/health.build;
                 compose обоих проектов — только :production
ops states       10/10 подсистем HEALTHY, conditions []; database pending [] / unknown [] / rolledBack 0 / applied 86;
                 sync dataAgeSeconds 28 после часового тика при пороге 7200; insights lastRunStatus SUCCESS;
                 outbox pending 0 / failed 0; thresholds отданы полностью (growthLagSeconds 93600 и др.)
>= 2 автоцикла   цикл 1 — scheduler:daily 20:48:01–20:48:13, 12 запусков, SUCCESS 12, FAILED 0 (окно 21 день);
                 цикл 2 — scheduler:hourly 21:46:31–21:46:40, 12 запусков, SUCCESS 12, FAILED 0 (окно 3 дня);
                 снимки периодов обновлены (64, последний 21:46); сигналы: hourly SUCCESS 154 мс и 68 мс;
                 порядок хуков в журнале: синхронизация -> снимки -> сигналы. Хук «Рост: автооценка» в окне не
                 логировался штатно — он идёт раз в новый день, сегодняшний прошёл в 00:27 (ops: возраст 21,3 ч)
stuck detection  RUNNING синхронизаций 0, RUNNING запусков сигналов 0, processing в очереди 0;
                 oldestRunningAgeSeconds = null во всех трёх подсистемах; строк «зависших запусков закрыто» нет —
                 закрывать нечего; пороги: syncStuck 3600, insightsStuck 600, outboxStuckProcessing 600
outbox           ops-сводка = SQL: delivered 16, skipped 61, pending 0, processing 0, failed 0;
                 oldestPendingAgeSeconds null; lastDeliveredAt 22.09 16:44 — прежний
no leakage       шаблоны y0_ / Bearer / eyJ... / JWT_SECRET / postgresql://...:...@ / client_secret / PASSWORD=
                 в логах backend, frontend, photo-api, photo-web, greeter за всё окно rollout — 0 совпадений;
                 в ops JSON и /health — 0; телефонов в ops JSON — 0
performance      прогретый контейнер: /health 0 мс (10 замеров), ops/status 327–691 мс (медиана ~390),
                 insights feed 246–498 мс, overview 7 дней 242–258 мс, overview 30 дней 218–254 мс.
                 Холодный первый запрос после пересоздания — 2,0–4,5 с (JIT и кэш), далее в норме.
                 До мини-rollout те же срезы: ops 660 мс, feed 281 мс, overview 7 дней 3104 мс — регресса нет
```

### GATE E — backup / restore (PASS, только чтение)

```text
ночной бэкап    /opt/raspechatka/backups/crm_20260922_030001.sql.gz — 2 306 849 Б, заголовок «PostgreSQL database dump»,
                CREATE TABLE 101; backup.log: «OK дамп ...», «OK облако db/...», «OK облако techspec/ (583 файлов)»
premigration    gate0_stage13_20260922_141045 (2 320 726 Б) и stage13A_20260922_142311 (2 591 066 Б) на месте
хранение        локальных копий crm_*.sql.gz — 14 (норма <= 14); свободно 28 ГБ из 50 ГБ
drill           повторный destructive drill не выполнялся: пройден 17.09.2026 (BACKUP_RESTORE_RUNBOOK.md § 2)
```

### GATE F — retention: ТОЛЬКО dry-run (PASS, DELETE = 0)

```text
PRECHECK  ANALYTICS_RETENTION_* в окружении контейнера — 0 переменных; dist/src/analytics/retention-cli.js в образе
ACTION    docker exec raspechatka-backend-1 node dist/src/analytics/retention-cli.js   (без --apply)
ПЛАН      dryRun true, totalRows 0; 5 правил, во всех rows 0:
          MetrikaSyncRun SUCCESS 90 д (cutoff 24.06); MetrikaSyncRun FAILED/PARTIAL 365 д (22.09.2025);
          AnalyticsInsightRun SUCCESS/SKIPPED/LOCKED 90 д; AnalyticsInsightRun FAILED 365 д;
          MetrikaOrderOutbox delivered/skipped 180 д (26.03); never — 5 позиций (агрегаты, снимки,
          реестр изменений и версии оценок, карточки и версии сигналов, незакрытые переходы очереди)
stderr    «dry-run: под правила подпадает строк — 0; удаление только с --apply и ANALYTICS_RETENTION_APPLY=1»
VERIFY    счётчики до/после равны: MetrikaSyncRun 2899, AnalyticsInsightRun 136, MetrikaOrderOutbox 77;
          суммарный n_tup_del по пяти таблицам 1 -> 1 (не изменился). --apply не запускался
```

### GATE G — secrets (PASS, ротаций нет)

```text
ротации   не выполнялись: ни OAuth, ни client secret, ни JWT, ни доступ к БД; значения переменных не читались
          и нигде не выводились
.env      CRM .env sha256 совпал с копией Gate A (файл не редактировался, mtime 17.09 09:32);
          .env сайта — только хэш, mtime 24.08; содержимое не выводится
логи      0 совпадений по шаблонам секретов за всё окно rollout во всех пяти контейнерах
SECRET_FOUND = no; rotation_required = no
```

### GATE H — infrastructure debts (только фиксация, ничего не исправлялось)

```text
H1–H8 из § 10 без изменений — решения за Reviewer и владельцем.
Уточнение к H2 по факту этого gate: yclid и IP пишет не только access-лог сайта, но и access-лог nginx панели
(raspechatka-frontend-1): за час — 4 строки вида «GET /?yclid=<19–20 цифр>» от робота Яндекс.Метрики.
Это не секрет и не PII в строгом смысле (рекламный идентификатор), автоматически НЕ исправлялось;
при работе по H2 log_format нужно править в обеих nginx-конфигурациях, а не только в конфигурации сайта.
```

### NEW FACTS (этот заход)

```text
1. Часовой тик планировщика привязан к старту контейнера, а не к :30 — после пересоздания backend в 20:46
   следующий автоматический цикл пришёл в 21:46, а не в 21:30. Для планирования окон это важно:
   «минимум два автоцикла» = boot-тик плюс час.
2. В 20:01 (до мини-rollout, старым скриптом по таймеру) в журнале есть «ОШИБКА: не скачался
   ghcr.io/tigo929/racpechatca-frontend:production» — разовый сбой скачивания до публикации новых образов;
   повторов после мини-rollout нет, следующий проход скачал оба образа штатно.
3. Первый запрос к дашборду после пересоздания контейнера стоит 2–4,5 с (прогрев), дальше 0,2–0,5 с.
   Для owner-smoke сразу после выкладки это ожидаемо и не является деградацией.
```

### PRODUCTION STATE (22.09.2026 21:48 MSK)

```text
CRM:    master fe88cfe; backend 1b65a8d21e94 (revision и /health.build fe88cfe2f8fd...),
        frontend 392b32cbb337 (revision fe88cfe2f8fd...); compose :production; миграций 86, таблиц 64;
        флаги dashboard/growth/insights/sync/orders = true; тики 20:48 daily и 21:46 hourly — SUCCESS 12/12;
        RUNNING 0, FAILED за 24 ч 0; outbox delivered 16 / skipped 61 / pending 0 / failed 0; карточек открыто 6
Сайт:   feature/cms-admin 441d795; photo-api-1 5d060578b045, photo-web-1 9d2ac8d814df (revision и
        /api/health.build 441d7955251d...); compose :production; страницы 200, цены на холсте на месте
Сервер: /opt/deploy/auto-update.sh = FIX_01 (sha256 e07f4dca073068db), auto-update.timer active,
        замок /var/lock/auto-update.lock (flock); backup прежнего скрипта auto-update.sh.bak-fix13-20260922-2034
Данные: миграций не применялось, заказы и аналитика не правились, retention только dry-run (DELETE 0),
        оценки роста не создавались, секреты не ротировались и не выводились; Stage 14 не начинался
```

### ROLLBACK STATUS

```text
Откат не выполнялся и не требуется: ни одно STOP-условие не сработало.
Команды на случай решения Reviewer:
  FIX_01:  cp /opt/deploy/auto-update.sh.bak-fix13-20260922-2034 /opt/deploy/auto-update.sh
  FIX_02:  git revert fe88cfe в master -> CI -> auto-update (миграций нет, данные не затрагиваются)
           либо срочно: IMAGE_TAG=40efd48c48005ea0f32d1f670611aa18924adc92 /opt/deploy/auto-update.sh
           (только вместе с тем же тегом в /opt/raspechatka/docker-compose.prod.yml)
  Бэкапы:  premigration_gate0_stage13_20260922_141045.sql.gz, premigration_stage13A_20260922_142311.sql.gz,
           ночной crm_20260922_030001.sql.gz
```
