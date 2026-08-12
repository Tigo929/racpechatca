#!/usr/bin/env bash
#
# Автообновление: сервер сам подтягивает свежие образы из реестра.
#
# Цепочка целиком: git push → GitHub прогоняет тесты и собирает образы →
# этот скрипт по таймеру видит новый образ и перезапускает контейнер.
# Ни доступа к git на сервере, ни входящих подключений извне не требуется —
# только исходящий запрос в реестр, что важно для этого IP.
#
# Почему не «docker compose up -d» на всё подряд: он сравнивает образ по
# своей записи и однажды уже пропустил обновление photo-web — прод молча
# отстал от репозитория на несколько сборок. Поэтому сверяем идентификатор
# запущенного контейнера с идентификатором свежескачанного образа.
#
# Ставится вместе с systemd-таймером, см. deploy/auto-update.timer.

set -uo pipefail

LOG=/var/log/auto-update.log
exec >>"$LOG" 2>&1

log() { echo "[$(date '+%F %T')] $*"; }

# проект | compose-файл | сервис | контейнер | образ
TARGETS=(
  "/opt/photo|docker-compose.prod.yml|api|photo-api-1|ghcr.io/tigo929/web-photo-api:latest"
  "/opt/photo|docker-compose.prod.yml|web|photo-web-1|ghcr.io/tigo929/web-photo-web:latest"
  "/opt/raspechatka|docker-compose.prod.yml|backend|raspechatka-backend-1|ghcr.io/tigo929/racpechatca-backend:latest"
  "/opt/raspechatka|docker-compose.prod.yml|frontend|raspechatka-frontend-1|ghcr.io/tigo929/racpechatca-frontend:latest"
)

updated=0
failed=0

for target in "${TARGETS[@]}"; do
  IFS='|' read -r dir compose svc container image <<<"$target"

  [ -d "$dir" ] || continue
  # Сервис может быть ещё не переведён на образы — тогда пропускаем молча.
  grep -q "$image" "$dir/$compose" 2>/dev/null || continue

  if ! docker pull -q "$image" >/dev/null 2>&1; then
    log "ОШИБКА: не скачался $image"
    failed=$((failed + 1))
    continue
  fi

  fresh=$(docker image inspect -f '{{.Id}}' "$image" 2>/dev/null || echo none)
  running=$(docker inspect -f '{{.Image}}' "$container" 2>/dev/null || echo none)

  [ "$fresh" = "$running" ] && continue

  log "Обновляю $svc: $running → $fresh"
  if ! (cd "$dir" && docker compose -f "$compose" up -d --force-recreate "$svc" >/dev/null 2>&1); then
    log "ОШИБКА: не удалось перезапустить $svc"
    failed=$((failed + 1))
    continue
  fi

  # Ждём, пока контейнер станет здоровым. Сервисы без healthcheck считаем
  # успешными по факту запуска.
  ok=0
  for _ in $(seq 1 30); do
    state=$(docker inspect -f '{{.State.Status}}:{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "missing:none")
    case "$state" in
      running:healthy|running:none) ok=1; break ;;
      restarting:*|exited:*) break ;;
    esac
    sleep 5
  done

  if [ "$ok" = 1 ]; then
    log "Готово: $svc обновлён и здоров"
    updated=$((updated + 1))
  else
    log "ВНИМАНИЕ: $svc не поднялся здоровым после обновления (состояние $state)"
    failed=$((failed + 1))
  fi
done

# Мусор от старых версий — иначе диск заполнят слои прошлых сборок.
[ "$updated" -gt 0 ] && docker image prune -f >/dev/null 2>&1

[ "$updated" -gt 0 ] || [ "$failed" -gt 0 ] && log "Итог: обновлено $updated, ошибок $failed"
exit 0
