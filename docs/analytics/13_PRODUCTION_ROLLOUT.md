# 13_PRODUCTION_ROLLOUT.md

## STATUS

```text
READY_FOR_REVIEW (план, 17.09.2026). Production НЕ менялся; rollout НЕ начат; Stage 14 не начат.
Implementation Stage 13 = READY_FOR_PRODUCTION_ROLLOUT (Reviewer APPROVED 17.09.2026).
Кандидаты: CRM — e0984f8 (код = 51f27ae; e0984f8 и этот план — docs-only потомки); сайт — web-photo 441d795.
Rollout начинается только после отдельной команды Reviewer «СТАРТ» (§ 13), по gate-ам A → B → C → D → E → F → G; H —
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
7. Также: миграция применяется, хотя её не ожидалось; backend не healthy 5 мин; `_prisma_migrations` ≠ 83; auto-update
   пишет ОШИБКА/ВНИМАНИЕ по любому сервису; удалена хоть одна строка при retention dry-run.

Пороги и семантика ради «зелёного» результата не меняются (спецификация § 29).

---

## 2. ПОРЯДОК И ОКНА

```text
A  CRM code           деплой сразу после SUCCESS часового тика (сейчас :33), ~20 мин, backend recreate 1 раз (auto-update)
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

## 3. GATE A — CRM reliability (кандидат e0984f8)

### PRECHECK

```text
git:   origin/master = 1f8b7b4 (owner-коммитов нет); e0984f8 ⊃ master (fast-forward); git log 1f8b7b4..e0984f8 =
       53d2d25, dabf3eb, 8f1707d (docs этапа 12), 3d45f4c (спецификация 13), 806e328 (код), 51f27ae (orderBy), e0984f8 (docs)
       + этот план (docs-only); git diff --stat 51f27ae..<tip> -- . ':!docs' = пусто;
       git diff --stat 1f8b7b4..<tip> -- crm-new/prisma = пусто (НОВЫХ МИГРАЦИЙ НЕТ — ожидание «No pending»);
       git diff --stat 1f8b7b4..<tip> -- frontend = пусто (образ панели пересоберётся из того же кода);
       изменённые области вне docs: .github/workflows, crm-new/Dockerfile.prebuilt, package.json, src/analytics/{ops,
       retention,insights,growth}, src/health.controller.ts, src/app.module.ts, spec-файлы, deploy/auto-update.sh (репо),
       docker-compose.prod.yml (шаблон в репо — на сервер попадает только в Gate B)
tests: CRM jest 1120 / 1120 (104 suites); панель vitest 42 / 42; nest build; prisma validate; eslint по новым файлам 0
server (read-only): backend d8590e7c9e67 / frontend 1485aa9b3150 healthy; MetrikaSyncRun RUNNING = 0; последний тик SUCCESS;
       _prisma_migrations 83, таблиц 62; compose/.env на сервере НЕ РЕДАКТИРУЮТСЯ до Gate B (иначе старый auto-update без
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
- migration gate: _prisma_migrations = 83, таблиц 62 (ничего не добавилось)
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
PRODUCTION_STATE  флаги, образы (id, revision, digest), compose-теги, auto-update sha, миграции 83 / таблиц 62
```

---

## 13. START COMMAND

Rollout начинается только после отдельной команды Reviewer:

`СТАРТ`

с указанием кандидатов (`e0984f8` или его docs-only потомок с этим планом; web-photo `441d795`) и подтверждением
порядка gate-ов (по умолчанию A → B → C → D → E → F → G; H — только решения). До команды production не менять; Stage 14
не начинать; этот документ — план, не отчёт.
