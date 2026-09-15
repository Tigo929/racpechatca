# 10_PRODUCTION_ROLLOUT.md

## STATUS

```text
REVIEW — technical rollout выполнен 15.09.2026 00:13–00:42 MSK по команде владельца «СТАРТ» (§ 2–3 — 14.09
23:53–23:55; маршрут /analytics на домене исправлен по NEEDS_FIX 15.09 00:01): master = 80921d9, миграция
20260914200000 применена на старте контейнера, initial sync 13.08–15.09, сверки HTTP = service = SQL diff 0,
правила / privacy / perf / auth проверены на боевых данных, расписание включено 00:31 — 10 тиков SUCCESS
(daily 00:33 + hourly 01:31–09:31, контроль до 10:23), дублей 0, overlap 0.
Отчёт — § 21. Owner smoke § 15 ПРОЙДЕН владельцем 15.09.2026 (~10:34 MSK, «OWNER SMOKE STAGE 10 ПРОЙДЕН») —
§ 21.16. Все пункты Acceptance Gate (§ 18) закрыты со стороны исполнителя; DONE ставит Reviewer.
```

## STAGE

**10 — Behavior & Funnels / Production Rollout**

## PURPOSE

Безопасно вывести Stage 10 в production после принятой implementation-review.

Production rollout включает:

- backend behavior API/service;
- frontend вкладку «Поведение»;
- migration `20260914200000`;
- новые локальные behavior aggregates/snapshots;
- расширение scheduler Stage 07;
- initial controlled sync;
- production reconciliation;
- owner smoke.

Production event model сайта на этом rollout **не меняется**. G1–G8 остаются отдельными data gaps; Stage 10 обязан показывать `not_measured / insufficient_data`, а не скрывать их.

---

## 1. REVIEWER VERDICT BEFORE START

Implementation status:

`READY_FOR_PRODUCTION_ROLLOUT`

Разрешение на production даётся только отдельной командой владельца:

`СТАРТ`

До команды `СТАРТ` production не менять.

---

## 2. EXPECTED GIT STATE

CRM:

- implementation branch: `feature/analytics-foundation`
- reviewed implementation HEAD: `6f6f644` или его docs-only descendant;
- production master before rollout: `be591d3`.

Перед rollout:

1. fetch remote refs;
2. подтвердить clean worktree;
3. подтвердить, что current production `master` является ancestor implementation branch;
4. fast-forward должен быть возможен;
5. если в `master` появились новые owner commits — STOP, сначала merge/review;
6. никаких force push.

Web:

Production web event model на Stage 10 rollout не меняется.

---

## 3. PRE-DEPLOY GATE

Обязательно до push:

- `prisma validate`;
- full CRM tests;
- behavior backend tests;
- dashboard frontend tests;
- frontend/backend build;
- lint/prettier;
- проверить migration SQL вручную;
- проверить, что migration затрагивает только новые behavior tables/indexes;
- проверить отсутствие destructive SQL;
- проверить текущий scheduler Stage 07/08 healthy;
- проверить Stage 06 outbox/worker.

Зафиксировать:

- latest successful analytics sync;
- snapshot count;
- duplicate count;
- failed/running sync runs;
- Stage 06 outbox pending/failed.

При любом неожиданном отклонении — STOP.

---

## 4. BACKUPS

Перед deploy:

- backup server `docker-compose.prod.yml`;
- backup `.env`;
- DB backup по принятому production-процессу перед migration.

Не выводить секреты в отчёт.

---

## 5. ANALYTICS SCHEDULER MAINTENANCE GATE

Поскольку Stage 10 добавляет новые datasets/snapshots и scheduler requests:

1. дождаться успешного hourly/daily tick;
2. временно установить `YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false`;
3. recreate только необходимого backend service;
4. подтвердить backend healthy, Stage 06 orders sync остаётся включён, analytics scheduler действительно OFF.

Не менять `YANDEX_METRIKA_ORDERS_SYNC_ENABLED`.

---

## 6. MERGE / DEPLOY CODE

Fast-forward reviewed feature → master.

После push дождаться auto-update.

Проверить:

- backend new image;
- frontend new image;
- health;
- nginx;
- application boot logs;
- ошибок deployment = 0.

Если auto-update пересоздаёт дополнительные services из-за compose dependency — зафиксировать факт, проверить health, но не считать ошибкой само по себе.

---

## 7. MIGRATION

После нового backend image, при выключенном analytics scheduler:

Проверить до deploy:

`prisma migrate status`

Применить только:

`prisma migrate deploy`

Ожидание:

- новая migration `20260914200000`;
- предыдущие migrations без drift;
- никаких `migrate dev`;
- никаких ручных правок `_prisma_migrations`.

После deploy:

- status up to date;
- проверить наличие всех 6 новых behavior tables;
- indexes/constraints;
- old analytics tables unchanged.

Любой drift / unexpected migration → STOP.

---

## 8. INITIAL BEHAVIOR SYNC

Scheduler всё ещё OFF.

Выполнить controlled manual sync:

1. минимальное окно 7 дней;
2. verify/reconciliation;
3. затем полный предусмотренный Stage 10 initial window, если 7d чистый;
4. затем snapshots для поддерживаемых presets.

Проверить:

- sync SUCCESS;
- API errors = 0;
- duplicates = 0;
- idempotent repeat не создаёт дублей;
- новые datasets заполнены только допустимыми данными;
- PII отсутствует.

Особенно проверить whitelist `filters`.

---

## 9. PRODUCTION RECONCILIATION BEFORE SCHEDULER ON

Минимум для today / last 7 days / last 30 days.

Проверить:

A. Behavior API = B. Behavior service = C. local aggregate SQL / source datasets.

Для выбранных показателей:

- global funnel steps;
- photo funnel;
- tshirt funnel;
- canvas funnel;
- contact funnel;
- form errors;
- devices;
- pages;
- issue rules.

Требование: `diff = 0` там, где равенство математически ожидаемо.

Отдельно подтвердить:

- `not_measured` остаётся `not_measured`;
- `insufficient_data` не превращается в `0`;
- low sample suppresses false issue;
- event counts не подписаны как users;
- period goal users используют snapshot, если заявлено;
- daily-summed users явно подписаны как сумма дневных, если используются.

---

## 10. ISSUE RULES PRODUCTION CHECK

Проверить каждое активное issue.

Для каждого:

- FACT подтверждён цифрами;
- HYPOTHESIS сформулирована как гипотеза;
- RECOMMENDATION не выдаёт причинность за факт;
- `causality = NOT_ESTABLISHED`;
- threshold/sample выполнен;
- severity соответствует rule config.

Отдельно проверить текущие кандидаты `DEVICE_GAP` и `FUNNEL_DROPOFF`. Если production данные изменились и правило больше не срабатывает — это нормально. Нельзя подгонять правило под ожидаемый результат.

---

## 11. PRIVACY CHECK

Production storage spot-check.

Не должно быть:

- phone;
- email;
- name;
- free text;
- Telegram/MAX id;
- uploaded file content;
- Yandex ClientID в behavior storage.

Разрешены только contract fields.

Если обнаружено PII → STOP + rollback/containment decision Reviewer.

---

## 12. PERFORMANCE

Production-like / production authenticated checks:

- behavior summary cold <= 3s;
- cached target <= 200ms;
- no N+1;
- slices reasonable;
- dashboard request не вызывает live Metrika API.

Зафиксировать SQL query count.

---

## 13. ENABLE ANALYTICS SCHEDULER

После успешных §§ 7–12:

`YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true`

Recreate backend.

Проверить backend healthy, orders worker ON, analytics scheduler ON.

Дождаться первого автоматического tick и следующего регулярного tick по расписанию.

Оба должны быть SUCCESS, новые behavior datasets и snapshots updated, errors 0, duplicates 0, overlap 0.

---

## 14. API / AUTH SMOKE

Проверить behavior routes:

- no token → 401;
- invalid token → 401;
- EXECUTOR → 403;
- ADMIN → 200;
- bad preset → 400;
- dashboard flag off semantics не регрессировали;
- existing Stage 09 routes работают.

Не печатать JWT в отчёте.

---

## 15. OWNER SMOKE

Владелец под своим ADMIN открывает `/crm/analytics` → `Поведение`.

Проверить:

- вкладка открывается;
- статус данных;
- global funnel;
- direction funnels;
- `not_measured` виден там, где событий нет;
- ошибки форм;
- devices;
- pages;
- paths;
- «Требует внимания»;
- FACT / HYPOTHESIS / RECOMMENDATION;
- today / 7d / 30d;
- mobile layout;
- нет горизонтального скролла;
- существующие разделы Stage 09 не сломаны.

Owner smoke фиксирует только владелец.

---

## 16. ROLLBACK

Если проблема только UI/API behavior — revert Stage 10 code и redeploy.

Если проблема scheduler — `YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false`, recreate backend, сохранить данные для диагностики.

Migration откатывать физическим DROP без отдельного Reviewer decision нельзя.

Новые behavior tables не влияют на Stage 06–09 canonical business data, поэтому предпочтительный rollback — code/flag/scheduler, а не destructive DB rollback.

---

## 17. STOP CONDITIONS

Немедленно STOP если:

- migration drift;
- destructive/unexpected migration;
- production health red;
- Stage 06 worker сломан;
- scheduler failures;
- duplicate aggregates;
- reconciliation mismatch без объяснения;
- PII в behavior storage;
- API auth regression;
- Stage 09 metrics изменились неожиданно;
- live Metrika API вызывается при dashboard request;
- false causal wording;
- `not_measured`/`insufficient_data` превращаются в 0.

---

## 18. ACCEPTANCE GATE

Stage 10 production rollout принимается только если:

- migration clean;
- initial sync clean;
- API = service = local aggregates;
- issue rules verified;
- privacy clean;
- performance accepted;
- scheduler два последовательных успешных цикла;
- Stage 06 healthy;
- Stage 09 regression absent;
- owner smoke passed.

Только Reviewer переводит `10_BEHAVIOR_AND_FUNNELS = DONE` и `10_PRODUCTION_ROLLOUT = DONE`.

---

## 19. EXECUTOR_REPORT_PRODUCTION_ROLLOUT

Вернуть разделы:

RESULT; GIT / DEPLOY; BACKUPS; SCHEDULER MAINTENANCE; MIGRATION; INITIAL SYNC; RECONCILIATION; FUNNELS; ERRORS / DEVICES / PAGES / PATHS; ISSUE RULES; PRIVACY; API / AUTH; PERFORMANCE; SCHEDULER AFTER ENABLE; STAGE 06 / STAGE 09 REGRESSION; OWNER SMOKE; NEW FACTS; DEVIATIONS; OPEN ISSUES.

---

## 20. START COMMAND

> **СТАРТ. Выполняй production rollout Stage 10 строго по `docs/analytics/10_PRODUCTION_ROLLOUT.md`. Соблюдай все STOP-условия. Production event model сайта на этом rollout не меняй. При любом необъяснимом migration/reconciliation/privacy/auth отклонении остановись. После технических проверок остановись на owner-smoke gate, если документ требует подтверждения владельца. Верни полный EXECUTOR_REPORT_PRODUCTION_ROLLOUT.**

---

# 21. EXECUTOR_REPORT_PRODUCTION_ROLLOUT — 15.09.2026

## 1. RESULT

```text
TECHNICAL_ROLLOUT_DONE — остановлен на owner-smoke gate (§ 15)
```

Rollout выполнен 15.09.2026 00:13–00:42 MSK строго по § 4–14; расписание после включения контролировалось
до 10:23 MSK (10 тиков SUCCESS). § 2–3 выполнены 14.09 23:53–23:55, production state с тех пор не менялся;
между ними по команде NEEDS_FIX исправлен маршрут `/analytics` на домене raspechatkaa.ru (§ 18.14 отчёта
этапа 09). STOP-условий не возникло. Owner smoke § 15 фиксирует владелец.

## 2. GIT / DEPLOY

```text
pre-rollout:   origin/master be591d3 (production), feature/analytics-foundation 80921d9 (reviewed 6f6f644 + docs
               c90267e план rollout + 80921d9 документация фикса маршрута и комментарий в frontend/nginx.conf —
               поведение кода не менялось; nginx-routes.spec зелёный); master ⊂ feature, owner-коммитов 0
merge:         fast-forward master be591d3 → 80921d9, push 15.09 00:18:31 MSK; force push нет
CI:            образы собраны — backend created 00:20:37 MSK, frontend 00:20:23 MSK (по времени образов)
auto-update:   00:21:33 «Обновляю backend 4d8cdf1c82bf → d8c9dd7313da» → 00:22:06 здоров; 00:22:11 «Обновляю
               frontend 2b96a48cf33c → 844bb9f8704a» → 00:22:44 здоров, nginx перечитан; ошибок 0
health:        backend healthy 00:22:06 / frontend healthy 00:22:44; /health ok; boot log без ошибок;
               BehaviorDashboardController {/analytics/dashboard/behavior} — 8 маршрутов mapped
deploy extras: доп. сервисы compose не пересоздавал; frontend пересоздан auto-update (новый образ) —
               bind-mount photo.conf с исправленным маршрутом /analytics подхвачен (проверено grep в контейнере)
web-photo:     production event model не менялся (branch cms-admin 8a9b33c); deploy/nginx-domain.conf обновлён
               в analytics-ветке (53d2e8f) без сборки образа
```

## 3. BACKUPS

```text
compose: /opt/raspechatka/docker-compose.prod.yml.bak-stage10-20260915-0013
.env:    /opt/raspechatka/.env.bak-stage10-20260915-0013 (50 строк; секреты не выводились)
DB:      /opt/raspechatka/backups/premigration_stage10_behavior_20260915_001341.sql.gz — 611 955 байт (600K),
         87 CREATE TABLE в дампе, запись в backups/backup.log (по процессу backup-db.sh: pg_dump | gzip + проверка размера)
```

## 4. SCHEDULER MAINTENANCE

```text
00:16:36–38 MSK  дождались успешного hourly тика (SUCCESS, снимки 8/8) при старом коде
00:17:05         .env: YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=false (orders_sync и dashboard не тронуты)
00:17:36         docker compose up -d --force-recreate --no-deps backend → healthy; nginx reload
                 env в контейнере: orders_sync=true analytics_sync=false dashboard=true;
                 лог: «воркер отправки заказов запущен», «синхронизация отчётов по расписанию выключена»
```

## 5. MIGRATION

```text
до deploy:  prisma migrate status (локально против production, read-only): 78 found, pending ровно одна —
            20260914200000_metrika_behavior_tables; drift нет
SQL ревью:  136 строк — 6 CREATE TABLE + 6 CREATE UNIQUE INDEX + 8 CREATE INDEX; DROP/ALTER/UPDATE/DELETE/TRUNCATE — 0
применение: entrypoint нового образа при старте 00:21:51 MSK: «Applying migration 20260914200000_metrika_behavior_tables …
            All migrations have been successfully applied» (только prisma migrate deploy; migrate dev / правок
            _prisma_migrations не было)
после:      migrate status «Database schema is up to date!»; _prisma_migrations: 78 applied, failed/rolled back 0;
            6 новых таблиц с уникальными ключами (date+deviceRaw+goalId; date+landingPath+goalId; date+deviceRaw+
            paramKey+paramValue; date+kind+pagePath; date+deviceRaw; periodStart+periodEnd+goalId) и индексами (3/4/4/3/3/3);
            старые таблицы без изменений: traffic 33, goals 693, sources 108, utm 39, landings 123, devices 71, pages 449,
            orders 330, outbox 8 — как в baseline 23:55; колонки MetrikaDailyDevice те же; снимков 18 → 23
            (новые диапазоны нового дня от тика 00:16, не миграция)
```

## 6. INITIAL SYNC (scheduler OFF, из контейнера)

```text
verify (live, read-only):  12/12 наборов OK, sampled=false (00:24:55)
8.1  7 дней 08–14.09:       SUCCESS — behaviorDevices 51→238 строк (3 запроса), behaviorLandings 111→518 (3),
                            behaviorParams 122 (1), behaviorPaths 122 (4), behaviorEngagement 17 (1); 13 запросов, 7,2 с
8.2  быстрая сверка:        Σ goalVisits по устройствам = MetrikaDailyGoal для 7 целей (form_started 13, attempt 4,
                            lead 4, form_error 1, view_custom_tshirt 11, choose_size 2, add_tshirt_lead 1) — diff 0
8.3  полное окно 13.08–15.09: SUCCESS — 994 / 1722 / 348 / 390 / 71 строк, 13 запросов, 7,4 с
8.4  snapshots:             8/8 пресетов, «целей 14» у каждого, 16 запросов; MetrikaPeriodGoalSnapshot 112 строк
8.5  idempotent repeat 7d:  SUCCESS, строки заменены, итоги без изменений; дублей по логическим ключам 0 во всех
                            6 таблицах; MetrikaSyncRun по behavior-наборам: 15 SUCCESS, FAILED 0
8.6  whitelist filters:     distinct paramKey = channel, field, form, format, intent, kind, location, product,
                            productSlug, size, value (все из белого списка; topic не встречался); goalIdentifier —
                            14 поведенческих; kind путей — 4 вида; путей с query-параметрами 0
```

## 7. RECONCILIATION (production, 00:28 MSK; A = HTTP /behavior/*, B = BehaviorMetricsService, C = SQL по таблицам-источникам)

```text
period          A vs B (все листья JSON 7 маршрутов)   A vs C (метрики)   Σ по устройствам = итог
today           702 листьев, diffs 0                    9 / 9 = 0          визиты 0 = 0 (данных за 15.09 у Метрики ещё нет)
last_7_days     1015 листьев, diffs 0                   31 / 31 = 0        визиты 116 = 116; form_started 13 = 13
last_30_days    1332 листьев, diffs 0                   31 / 31 = 0        визиты 579 = 579; form_started 13 = 13

7 дней (09–15.09): visits 116; form_started 13 визитов / 25 событий / 3 посетителя (снимок); attempt 4; lead 4 (1 посетитель);
form_error 1 визит / 3 события (поля contactValue 3, name 1); компьютер 62 визита / 13 начали / 4 заявки; телефон 51 / 0 / 0;
планшет 3; `/` 83 визита / 12 начали; отказы компьютер 1,61 %, телефон 5,88 %; выход без заявки `/` 58, `/interer/holst` 11.
30 дней (17.08–15.09): visits 579; телефон 280 / 0 / 0; компьютер 293 / 13 / 4; `/` 459 визитов; выход без заявки `/` 332.
```

## 8. FUNNELS (production, 7 дней / 30 дней)

```text
global   116 визитов (76 посетителей) → form_started 13v/25e/3u → attempt 4v/4e/1u → lead 4v/4e/1u        [OK]
photo    catalog=not_measured → форма фото (param productSlug) 25v/43e/—u → lead_submitted_photo 2v/2e/1u  [LOW_SAMPLE]
tshirt   view_custom_tshirt 11v/21e/9u → крой/цвет=not_measured → choose_size 2v → add_tshirt_lead 1v →
         попытка=not_measured → lead_submitted_tshirt 0v                                                   [LOW_SAMPLE]
canvas   взаимодействие (param product=canvas) 9v/57e → загрузка=not_measured → lead_submitted_canvas 0v   [LOW_SAMPLE]
contact  form=contact 0v → product=contact 0v                                                              [INSUFFICIENT_DATA]
not_measured остаются not_measured (5 шагов), insufficient_data не превращается в 0 (today: BEHAVIOR_NOT_SYNCED,
воронка unavailable), события подписаны отдельно от визитов и посетителей, посетители шагов — только из снимка
(периоды-пресеты), сумма дневных посетителей на страницах/устройствах подписана как «сумма по дням».
```

## 9. ERRORS / DEVICES / PAGES / PATHS

```text
errors:  7д — 1 визит с ошибкой (3 события), доля от начавших 7,69 %, ошибок на попытки 42,86 %; поля: contactValue 3
         (75 %), name 1; только компьютер; серверная ошибка футболок 1
devices: компьютер 62 визита, начали 13 (20,97 %), заявки 4 (6,45 %), отказы 1,61 %; телефон 51, 0, 0, отказы 5,88 %;
         планшет 3 (LOW_SAMPLE); gap: leadConversion mobile 0 % / desktop 6,45 %, ratio 0, COMPARABLE
pages:   `/` 83 визита, 12 начали, 4 заявки (4,82 %, +1,37 п.п. к сайту 3,45 %); остальные LOW_SAMPLE — не ранжируются
paths:   вход визитов с заявкой — `/`; просмотры в визитах с заявкой — `/`, `/catalog/foto-10x15-*`, `/futbolki/svoy-print`;
         выход без заявки — `/` 58, `/interer/holst` 11; текст data gap отдаётся в ответе
```

## 10. ISSUE RULES (production)

```text
7 дней:  [CRITICAL] DEVICE_GAP — FACT «конверсия визитов в заявку: телефоны 0 % (51 визитов), компьютеры 6,5 % (62 визитов);
         отношение 0.00»; гипотеза «Возможны трудности с формой… либо разный состав трафика — данные это не различают»;
         рекомендация «Проверить форму… 360–430 px…»; evidence sample 51 ≥ 30, ratio 0 ≤ 0,25 → CRITICAL по конфигу ✓
         [ATTENTION] FUNNEL_DROPOFF photo — «Начали форму фотопечати» → «Заявка на фото принята»: 25 → 2, конверсия 8 %,
         отвал 92 % (≥ 90 %, вход 25 ≥ 20) ✓; causality NOT_ESTABLISHED у всех
         пропущено 7 правил с причинами (входы < 20, ошибок < 5, нет страниц с ожидаемыми ≥ 3 заявками, нет сопоставимого периода)
30 дней: DEVICE_GAP CRITICAL (280 / 293 визитов, 0 % vs 1,4 %), FUNNEL_DROPOFF photo (117 → 2, отвал 98,3 %),
         FUNNEL_DROPOFF canvas (20 → 0, отвал 100 %, вход ровно 20)
Проверено: FACT — только числа периода; HYPOTHESIS — сослагательно; RECOMMENDATION — действия проверки; severity = пороги.
См. DEVIATIONS 1 — на частичных периодах карточки photo/canvas структурно смещены (шаг по параметрам измеряется с 13.08,
цель направления — с 12.09).
```

## 11. PRIVACY (production storage spot-check)

```text
ключи параметров: channel, field, form, format, intent, kind, location, product, productSlug, size, value — белый список
значения: слаги товаров (foto-10x15-bez-polej, polaroid, instax…), размеры холста (30x40 … 100x200), опции (S/M/L/XL/XXL,
          male/female/unisex/kids, white/black, front/back), форматы (album/portrait/square/panorama), поля ошибок
          (contactValue, name), места клика (header, footer, hero, delivery-page, canvas-zakaz-*), каналы (Telegram, MAX —
          названия мессенджеров, не идентификаторы), form=contact, kind=merch, product=canvas/photo
regex-проверка (≥ 6 цифр | @ | ^+?7): 2 совпадения — size=70x80 и size=70x70 (ложные срабатывания на «7»); пути входа/выхода
с query-параметрами — 0; колонки новых таблиц: только поля контракта (дата, устройство, путь, цель, ключ/значение, счётчики);
телефонов, e-mail, имён, текстов, файлов, Telegram/MAX id, ClientID — нет
```

## 12. API / AUTH

```text
внутри контейнера: без токена 401, EXECUTOR 403 (summary и status), ADMIN 200; bad preset 400; > 366 дней 400
через домен raspechatkaa.ru (временный ADMIN-токен в памяти): behavior/status 200 20 мс, summary 200 249 мс (холодный),
funnels 109, errors 112, pages 45, devices 88, paths 66, issues 83 мс, summary today/30d 200; без токена → 401;
хост sslip.io: behavior/status без токена → 401
Stage 09 маршруты через домен: status/overview/trend/sources/utm/landings/devices/products/sales-channels — 200;
/auth/me, /order-photo, /reports/monthly — 200; flag-off семантика не менялась (тот же DASHBOARD_OPTIONS/404-путь, тесты)
```

## 13. PERFORMANCE (production container)

```text
SQL: getSummary — 25 запросов (13 на период × 2 для сравнения, минус кэш Prisma), getIssues 25, getPages 13; N+1 нет
service: getSummary last_30_days 1617 мс в холодном процессе (с прогревом Prisma), затем 120 мс; getIssues 190/106 мс
HTTP: summary первый вызов после старта 879 мс, далее 61–225 мс; кэш 9–20 мс; через домен summary 249 мс
цели ≤ 3 с холодный / ≤ 200 мс кэш — выполнены; live Metrika API из запросов дашборда не вызывается (лог клиента
Метрики во время сверок — только тики расписания)
```

## 14. SCHEDULER AFTER ENABLE

```text
00:31:17  .env: YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED=true; recreate --no-deps backend → healthy 00:31:48; nginx reload;
          env: orders_sync=true analytics_sync=true dashboard=true; лог: воркер заказов запущен, расписание запущено
first tick 00:33:11–25 (scheduler:daily 26.08–15.09): 12 наборов SUCCESS — traffic 20, goals 420, sources 80, utm 26,
          landings 98, devices 43, pages 331, behaviorDevices 602, behaviorLandings 1372, behaviorParams 303,
          behaviorPaths 308, behaviorEngagement 43 строк (итого 3646); 22 запроса наборов + список целей = 23 по логу,
          10 с; снимки 8/8 (16 запросов); строки поведения без роста (замена периода): 994/1722/348/390/71;
          дублей 0; goal snapshots 112, дублей 0
regular ticks 01:31:41, 02:31:41 … 09:31:41 (scheduler:hourly 13.09–15.09, каждые 60 мин от старта) — 9 тиков,
          каждый: 12 наборов SUCCESS (behavior 5/5 — 10/10 по каждому набору с учётом daily), 22 запроса + список
          целей (23 по логу), строк 393 → 413 → 421 (растут с данными за 15.09), 6–9 с; снимки 8/8 (16 запросов)
          и снимки целей 112 обновлены в каждом тике (fetchedAt 09:31:51); лог: 1 daily + 9 hourly summaries,
          non-SUCCESS 0, WARN/ERROR по Метрике с момента старта 0; auto-update после 00:28 — деплоев не было
state 10:23: behavior rows dev 1022 / land 1736 / params 351 / paths 399 / eng 73 (13.08–15.09); дублей 0 во всех
          6 новых и 4 старых таблицах; ключи параметров — прежние 11 из белого списка; сегодня 15.09: 3 визита,
          form_started 1 визит; RUNNING 0
overlap: 0 (advisory lock 700701, RUNNING параллельно нет); FAILED с 00:31 и за 24 ч: 0
```

## 15. STAGE 06 / STAGE 09 REGRESSION

```text
Stage 06: воркер отправки заказов запущен после каждого recreate (00:17:36, 00:31:41); MetrikaOrderOutbox 8 строк
          (skipped/no_client_id) без изменений на 10:23; YANDEX_METRIKA_ORDERS_SYNC_ENABLED не трогался
Stage 09: probes 401/403/200/400 без изменений; HTTP = service = metrics:report --json: today 377 / 7d 754 / 30d 1244
          листьев diffs 0; trend-инварианты OK (ΣnetProfit Δ 1 ₽ / 6 ₽ в допуске); P&L август = /reports/monthly
          189 405 / 56 935 / 115 065 ₽, 79 заказов — те же значения, что 14.09; freshness FRESH
```

## 16. OWNER SMOKE

```text
§ 15 — ПРОЙДЕН: подтверждение владельца 15.09.2026 (~10:34 MSK), дословно: «OWNER SMOKE STAGE 10 ПРОЙДЕН».
Проверялось владельцем под своим ADMIN: https://raspechatkaa.ru/crm/analytics → «Поведение» (чек-лист § 15).
Подтверждение текстовое, без детализации по пунктам и без скриншотов (по § 15 допустимо); исполнитель под
учётной записью владельца не входил, production после 00:31 не менял.
Ориентиры для чтения (сверка 00:28, 7 дней 09–15.09): 116 визитов → 13 начали форму (25 событий, 3 посетителя) →
4 отправили → 4 заявки; телефон 51 визит / 0 форм; ошибок формы 1 визит (поле «Контакт»); «Требует внимания» —
Критично (устройства) и Внимание (отвал фото). Живые данные: к 10:23 снимок за 7 дней уже давал form_started 4
посетителя и lead_submitted 2 — расхождение с ориентирами при проверке владельца ожидаемо.
Чек-лист § 15 (пункты закрыты общим подтверждением владельца):
  [x] вкладка открывается; статус данных
  [x] общая воронка; направления с «шаг не измеряется»
  [x] ошибки форм, устройства, страницы входа, пути
  [x] «Требует внимания»: Факт / Гипотеза / Что проверить
  [x] today / 7d / 30d; разделы этапа 09 не сломаны
  [~] телефон / горизонтальный скролл — отдельно владельцем не отмечено (responsive подтверждён на копии
      production скриншотами 390 px, 10_BEHAVIOR_AND_FUNNELS.md § 32 RESPONSIVE)
```

## 17. NEW FACTS

- Production 15.09 00:2x: за 09–15.09 форму начали в 13 визитах (3 посетителя), 4 заявки — все на компьютерах;
  на телефонах 51 визит и ни одного начала формы; за 30 дней — 280 мобильных визитов, 0 заявок.
- Часовой тик с наборами этапа 10 — 23 запроса + 16 снимков (было 11 + 8), 6–9 с; суточный тик при старте контейнера
  обработал 21 день (3646 строк) за 10 с без семплирования.
- Параметр `topic` (форма контактов) в счётчике за 13.08–15.09 не встречался; `form=contact` — 1 визит за 30 дней.
- Первый день без данных Метрики (today до первого тика) честно даёт `BEHAVIOR_NOT_SYNCED` + `LOW_SAMPLE`, а не нули.
- Bind-mount конфигов nginx: правка файла через `sed -i` невидима контейнеру (новый inode) — только запись в тот же
  inode или recreate контейнера (учтено в комментариях обоих nginx-конфигов).

## 18. DEVIATIONS

```text
1. Правило 11.1 на частичных периодах для воронок photo/canvas: шаг «по параметрам визита» измеряется с начала счётчика
   (13.08), а цель направления — с 12.09 → за 30 дней «117 → 2, отвал 98,3 %» структурно завышен (большинство из 117
   визитов — до появления цели). Карточка честна по числам и периоду, воронка помечена PARTIAL_BEHAVIOR_PERIOD, но
   сама карточка об этом не говорит. Правило не подгонялось (§ 10). Предложение FIX_01 (решение Reviewer): для
   направлений считать param-шаги только с даты доступности цели направления и/или не создавать FUNNEL_DROPOFF при
   PARTIAL_BEHAVIOR_PERIOD. Смещение исчезает само: для 7 дней — с 19.09, для 30 дней — с 12.10.
2. HEAD выкатки 80921d9 — reviewed 6f6f644 + docs + комментарий в frontend/nginx.conf (без изменения поведения).
3. Frontend пересоздан auto-update (новый образ) — плановое; дополнительных сервисов compose не трогал.
4. § 7 «до deploy prisma migrate status» выполнен с рабочей станции через туннель к production (read-only) — новая
   миграция известна только новому коду.
```

## 19. OPEN ISSUES

```text
1. Verdict Reviewer (10_BEHAVIOR_AND_FUNNELS / 10_PRODUCTION_ROLLOUT → DONE) — owner smoke § 15 пройден 15.09.
2. FIX_01 к правилу 11.1 на частичных периодах (DEVIATIONS 1) — по решению Reviewer, отдельным gate.
3. Data gaps G2/G3/G4/G5 (цели submit_tshirt_order / view_product / canvas_size_select, событие серверной ошибки,
   дедупликация, Logs API) — решения владельца/Reviewer, production event model не менялся.
4. Наблюдение по данным (не вывод): 0 начатых форм на телефонах при 51 (7д) / 280 (30д) визитах — нужна ручная проверка
   формы на 360–430 px и доли согласия на cookie по устройствам.
5. Security debt без изменений (ротация токена/секрета Яндекса).
```
