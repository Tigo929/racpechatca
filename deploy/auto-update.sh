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

# nginx резолвит имена контейнеров один раз — при загрузке конфигурации,
# а пересозданный контейнер получает в сети новый адрес. Без перечтения
# он продолжает стучаться по старому: панель и сайт отдают 502, причём
# молча — контейнеры при этом здоровы, и по логам всё в порядке.
#
# Именно из-за этого выкладку сайта делают через deploy/deploy.sh, где
# reload прописан отдельным шагом («проверено дорого»). Здесь его не было,
# то есть любое автообновление backend или photo-web роняло вход до тех
# пор, пока кто-нибудь не заметит.
#
# Reload дешёвый и безопасный: старые соединения дорабатывают, конфиг
# перечитывается без простоя. Делаем его после любого обновления.
if [ "$updated" -gt 0 ]; then
  if docker exec raspechatka-frontend-1 nginx -s reload >/dev/null 2>&1; then
    log "nginx перечитан"
  else
    log "ВНИМАНИЕ: не удалось перечитать nginx — проверьте панель и сайт"
    failed=$((failed + 1))
  fi
fi

# Прогрев раздела холста.
#
# Цены на холст приходят из CRM по сети. Когда обновляются оба контейнера
# сайта разом, web успевает собрать страницы раньше, чем поднимется api, —
# и раздел уходит в кэш с заглушкой «Цены временно недоступны», без цен и
# без кнопки заказа. Само это не чинится: страница уже в кэше и считается
# свежей, а посещений у редких размеров мало.
#
# Так и случилось 05.09.2026 после автообновления: хаб холста встал без
# конструктора. Выкладка через deploy/deploy.sh этот шаг делает, а
# автообновление — нет, хотя перезапускает те же контейнеры.
#
# Ждём, пока истечёт окно перегенерации (300 с), и запрашиваем страницы
# дважды: первый запрос запускает пересборку, второй забирает готовое.
if [ "$updated" -gt 0 ] && [ -d /opt/photo ]; then
  CANVAS="/interer/holst /interer/holst/30x40 /interer/holst/40x50
          /interer/holst/50x70 /interer/holst/60x90 /ceny"

  warm() {
    for path in $CANVAS; do
      (cd /opt/photo && docker compose -f docker-compose.prod.yml exec -T web         wget -qO- "http://127.0.0.1:3000${path}" >/dev/null 2>&1) || true
      sleep 2
    done
  }

  log "Жду окно перегенерации и прогреваю холст"
  sleep "${WARM_AFTER:-320}"
  warm
  sleep 15
  warm

  page=$( (cd /opt/photo && docker compose -f docker-compose.prod.yml exec -T web     wget -qO- http://127.0.0.1:3000/interer/holst 2>/dev/null) || true)
  case "$page" in
    *"Цены временно недоступны"*)
      log "ВНИМАНИЕ: холст остался без цен — проверьте, отвечает ли CRM"
      failed=$((failed + 1))
      ;;
    *)
      log "Холст прогрет, цены на месте"
      ;;
  esac
fi

# Мусор от старых версий — иначе диск заполнят слои прошлых сборок.
[ "$updated" -gt 0 ] && docker image prune -f >/dev/null 2>&1

[ "$updated" -gt 0 ] || [ "$failed" -gt 0 ] && log "Итог: обновлено $updated, ошибок $failed"
exit 0
