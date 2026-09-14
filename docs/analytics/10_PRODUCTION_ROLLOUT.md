# 10_PRODUCTION_ROLLOUT.md

## STATUS

`PREPARED`

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
