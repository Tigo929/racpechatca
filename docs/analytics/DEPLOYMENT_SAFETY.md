# DEPLOYMENT_SAFETY — CI/CD, образы, auto-update, идентификатор сборки (этап 13, разделы 18–20; R2, R4)

## Статус

```text
Реализовано 17.09.2026 в ветках feature/analytics-foundation (racpechatca) и feature/ci-safety (web-photo); production
не менялся (server auto-update.sh sha 1219cba1… = прежний, compose на сервере — :latest, workflow production-ветки сайта
— прежний). Применение — 13_PRODUCTION_ROLLOUT.md. Инварианты закреплены тестами: crm-new/src/deploy-safety.spec.ts (11),
web-photo/scripts/ci-safety-check.mjs (шаг workflow до сборки).
```

## 1. Инциденты, из которых выросли правила

| Дата | Что случилось | Причина |
|---|---|---|
| 14.09.2026 18:17 → 15.09 20:32 | сайт ~26 ч работал на августовской сборке; цели заявок за период неполные (confounder этапа 11) | пуш устаревшей ветки `feature/print-card-lead-form`: GitHub выполняет workflow **из пушнутой ветки**, её копия `build-images.yml` перечисляла её саму → образ опубликован в `:latest` → auto-update подхватил |
| 17.09.2026 09:21–09:29 | backend пересоздан старым образом за 7 мин до прихода нового; boot-тик 09:23 лишний | `docker compose up -d --force-recreate frontend` без `--no-deps` пересоздал зависимость `backend`, у которого изменился env (строка флага этапа 12) |
| 09.2026 (этап 09) | изменившийся env пересоздал backend старым образом при следующем `up` | тот же механизм |

## 2. Acceptance и как он выполняется

**Only explicitly approved production source can publish/deploy production image.**

| Требование | Реализация | Проверка |
|---|---|---|
| production-образ публикует только одобренный источник | метки `:production` и `:latest` выдаются шагом «Метки образа» **только если `github.ref` равен production-ветке** (`refs/heads/master` CRM, `refs/heads/feature/cms-admin` сайт); условие смотрит на фактическую ветку запуска, не на содержимое файла — копия workflow в чужой ветке даёт только `:<sha>` | `deploy-safety.spec` («модель угрозы»), `ci-safety-check.mjs` (симуляция пуша `feature/print-card-lead-form` → только `:<sha>`; старый workflow сайта проверкой **не проходит**: 9 нарушений) |
| immutable-артефакт | всегда `:<sha>` (был и раньше) + `LABEL org.opencontainers.image.revision=<sha>` + `BUILD_SHA` внутрь образа | spec: build-args и labels обязательны |
| `latest` — не единственный источник правды | сервер потребляет `:production`: `deploy/auto-update.sh` (`IMAGE_TAG=production`), `docker-compose.prod.yml` (`racpechatca-*:production`); `latest` публикуется параллельно на переходный период | spec: TARGETS без `:latest`, compose без `:latest` |
| stale branch не может подменить production | триггер сайта — только `feature/cms-admin`; даже если чужая ветка со старым файлом опубликует `:latest`, сервер его не потребляет | статический тест + модель угрозы; **пуш устаревшей ветки для проверки не выполнялся** (запрещено спецификацией) |
| deterministic deployment order | TARGETS: api → web (сайт), backend → frontend (CRM) — API раньше UI | spec «порядок обновления фиксирован» |
| targeted update не пересоздаёт соседей | `up -d --force-recreate --no-deps <svc>` | spec: каждая исполняемая строка `up -d` содержит `--no-deps` |
| analytics env edit не запускает старый образ | следствие `--no-deps` + правило: правку compose/.env делать **до** push (тогда первый `up` — уже с новым образом) либо явно `--force-recreate --no-deps backend` | DEPLOYMENT_SAFETY § 4 |
| health подтверждает фактический build | `/health` CRM → `build` (BUILD_SHA); `/api/health` сайта → `build` (было); auto-update после обновления сверяет `org.opencontainers.image.revision` образа с `build` из health контейнера → «Сборка подтверждена» или «ВНИМАНИЕ … работает не та сборка» (failed++) | spec «после обновления сверяется сборка» |

## 3. Что публикует CI после этапа 13

```text
racpechatca (master):            racpechatca-backend|frontend :<sha>, :production, :latest   (не master → только :<sha>)
web-photo (feature/cms-admin):   web-photo-api|web            :<sha>, :production, :latest   (не production-ветка → только :<sha>)
```

Шаг `node scripts/ci-safety-check.mjs` в workflow сайта стоит **до** сборки образов и валит сборку при нарушении
инвариантов (список веток ≠ [feature/cms-admin], безусловные метки, отсутствие BUILD_SHA/revision, проверка после build).

## 4. Правила выкладки (оператору)

1. Compose/.env на сервере править **до** `git push master` (или до появления образа) — тогда auto-update поднимет новый
   образ сразу с новым env. Если правка нужна после — `docker compose up -d --force-recreate --no-deps <svc>` вручную.
2. Деплой — сразу после SUCCESS тика (`MetrikaSyncRun.RUNNING` = 0).
3. После обновления смотреть `/var/log/auto-update.log`: «Готово», «Сборка подтверждена: … build=<sha>», «nginx перечитан».
   «ВНИМАНИЕ … работает не та сборка» — STOP и разбор (образ ≠ код).
4. Откат: `IMAGE_TAG=<sha> /opt/deploy/auto-update.sh` только вместе с тем же тегом в compose (иначе compose поднимет не то) —
   штатный откат: revert в master → новый `:production`.
5. Никогда не публиковать production-метки вручную (`docker push … :production`) — только CI с production-ветки.

## 5. Настройки GitHub (рекомендации владельцу; не код)

1. **web-photo**: удалить устаревшие ветки, чей workflow перечисляет их самих (`feature/print-card-lead-form`; при
   подтверждении — `feature/yandex-yml-feed`, `feature/canvas-section`); `main` синхронизировать или перестать считать
   production. Удаление — гигиена, **не** механизм защиты (защита — § 2).
2. Branch protection на `master` (CRM) и `feature/cms-admin` (сайт): запрет force push и удаления; изменения только PR
   (владелец) — стоп для «пуш по ошибке».
3. Environment `production` с deployment-branch policy (только production-ветка) и `required reviewers` — для шага
   публикации production-меток: даже отредактированный чужой workflow не получит доступ к environment. Требует перенести
   шаг публикации меток в job с `environment: production` — предложение для этапа 14 / отдельного FIX.
4. GHCR: у пакетов `web-photo-*`, `racpechatca-*` оставить доступ Actions только с этих репозиториев (по умолчанию так).

## 6. Rollout этапа 13 для этой части (план — 13_PRODUCTION_ROLLOUT.md)

Порядок важен: сначала должен появиться образ `:production` в реестре, потом сервер переключается на него.

```text
1. push master (CRM) с кодом этапа 13 → CI публикует :<sha>, :production, :latest (первый раз)
2. auto-update по ещё старому скрипту подхватит :latest (штатно; backend с новым /health build, --no-deps ещё нет)
3. backup compose/.env; скопировать deploy/auto-update.sh на сервер (sha сверить); в серверном compose заменить :latest → :production
4. следующий тик таймера: pull :production (= тот же образ), id совпадает → ничего не пересоздаётся
5. web-photo: merge feature/ci-safety → feature/cms-admin (это production-деплой сайта! — отдельное окно, сразу после
   SUCCESS тика CRM не требуется, но сайт пересоберётся) → CI публикует :production для api/web → /opt/photo compose
   переключить на :production → verify /api/health build = <sha>
6. проверить лог auto-update: «Сборка подтверждена» для backend и web
```
