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
#
# Этап 13 (надёжность выкладки):
#   - образы берутся по метке `production`, которую публикует только сборка
#     с production-ветки; плавающий `latest` больше не источник правды
#     (14.09.2026 устаревшая ветка сайта пересобрала `latest` и подменила бой);
#   - пересоздаётся ТОЛЬКО целевой сервис (`--no-deps`): без этого
#     `up -d --force-recreate frontend` пересоздавал и backend, у которого
#     изменился env, — старым образом, до того как докачался новый (17.09);
#   - после обновления сверяется идентификатор сборки: метка образа
#     `org.opencontainers.image.revision` должна совпасть с `build` из /health
#     контейнера — иначе работает не та сборка, которую скачали.
#
# Этап 13, FIX_01 (22.09.2026, по итогам Gate C):
#   - сверка сборки ждёт готовности контейнера: у photo-web нет healthcheck,
#     скрипт считал его готовым по факту запуска и спрашивал /api/health через
#     пару секунд — приложение ещё не слушало порт, ответ был пустой, и выкладка
#     получала ложное «работает не та сборка» при полностью верной сборке;
#   - ожидание ограничено (попытки × интервал): пустой или неразборчивый ответ
#     — это повтор, непустой чужой build — немедленный провал без ожидания,
#     исчерпание попыток — провал;
#   - единый замок: ручной запуск и запуск по таймеру больше не идут парой
#     (22.09 в 14:44 они наложились и продублировали прогрев и итог).
#     Второй запуск не ждёт, а сразу выходит — к следующему тику ждать нечего.

set -uo pipefail

LOG="${AUTO_UPDATE_LOG:-/var/log/auto-update.log}"

# Замок на весь проход: и ручной запуск, и таймер зовут один и тот же файл.
LOCK_FILE="${AUTO_UPDATE_LOCK:-/var/lock/auto-update.lock}"
LOCK_HELD=""

log() { echo "[$(date '+%F %T')] $*"; }

# Метка production-образов. Переопределяется только для аварийного отката
# на конкретный хеш: IMAGE_TAG=<sha> /opt/deploy/auto-update.sh — и только
# если тот же тег стоит в compose-файле, иначе compose поднимет не то.
IMAGE_TAG="${IMAGE_TAG:-production}"

# Сколько ждать, пока обновлённый контейнер начнёт отвечать на /health:
# 12 попыток × 5 с = минута. Дольше ждать нечего — за минуту поднимается
# и Next.js сайта, и NestJS панели, а таймер придёт снова через пять минут.
VERIFY_BUILD_ATTEMPTS="${VERIFY_BUILD_ATTEMPTS:-12}"
VERIFY_BUILD_INTERVAL="${VERIFY_BUILD_INTERVAL:-5}"

# проект | compose-файл | сервис | контейнер | образ | адрес /health с полем build (пусто — сборка не сверяется)
# Порядок фиксирован: сначала API/бэкенд, потом web/панель — чтобы новая
# панель не работала со старым API дольше, чем нужно на один проход.
TARGETS=(
  "/opt/photo|docker-compose.prod.yml|api|photo-api-1|ghcr.io/tigo929/web-photo-api:$IMAGE_TAG|"
  "/opt/photo|docker-compose.prod.yml|web|photo-web-1|ghcr.io/tigo929/web-photo-web:$IMAGE_TAG|http://127.0.0.1:3000/api/health"
  "/opt/raspechatka|docker-compose.prod.yml|backend|raspechatka-backend-1|ghcr.io/tigo929/racpechatca-backend:$IMAGE_TAG|http://127.0.0.1:3000/health"
  "/opt/raspechatka|docker-compose.prod.yml|frontend|raspechatka-frontend-1|ghcr.io/tigo929/racpechatca-frontend:$IMAGE_TAG|"
)

# Обращения наружу вынесены в отдельные функции: тесты подменяют их фальшивками
# и проверяют саму логику ожидания, не поднимая docker.
sleep_seconds() { sleep "$1"; }

image_revision() {
  docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$1" 2>/dev/null || echo ""
}

# Из ответа /health берём только поле build. Мусор, обрезанный ответ, страница
# ошибки — всё это даёт пустую строку, то есть «ещё не готов», а не «чужая сборка».
parse_build() { sed -n 's/.*"build":"\([0-9a-fA-F]*\)".*/\1/p' | head -n 1; }

container_build() {
  docker exec "$1" wget -qO- "$2" 2>/dev/null | parse_build
}

# Сверка сборки: метка revision у образа против поля build в ответе /health
# внутри контейнера. Метки нет (образ собран до этапа 13) — сверять нечего,
# это не ошибка.
#
# Три исхода, и различать их обязательно:
#   build совпал                → успех;
#   build непустой и другой     → сразу ВНИМАНИЕ (ждать нечего: приложение
#                                 уже отвечает, просто не той сборкой);
#   build пустой/неразборчивый  → контейнер ещё поднимается, повтор до
#                                 исчерпания попыток, дальше ВНИМАНИЕ.
verify_build() {
  local container="$1" image="$2" health_url="$3"
  [ -n "$health_url" ] || return 0
  local expected actual attempt
  expected=$(image_revision "$image")
  [ -n "$expected" ] && [ "$expected" != "unknown" ] || return 0

  attempt=1
  while :; do
    actual=$(container_build "$container" "$health_url")
    if [ -n "$actual" ]; then
      if [ "$actual" = "$expected" ]; then
        log "Сборка подтверждена: $container build=${actual:0:12} (попытка $attempt)"
        return 0
      fi
      log "ВНИМАНИЕ: $container отвечает build=${actual:0:12}, а образ помечен ${expected:0:12} — работает не та сборка"
      return 1
    fi
    [ "$attempt" -lt "$VERIFY_BUILD_ATTEMPTS" ] || break
    attempt=$((attempt + 1))
    sleep_seconds "$VERIFY_BUILD_INTERVAL"
  done

  log "ВНИМАНИЕ: $container не отдал build за $VERIFY_BUILD_ATTEMPTS попыток ($((VERIFY_BUILD_ATTEMPTS * VERIFY_BUILD_INTERVAL)) с) — сборка ${expected:0:12} не подтверждена"
  return 1
}

# Единый замок на проход. Ручной запуск во время работы таймера (или наоборот)
# пересоздавал те же контейнеры второй раз и дублировал прогрев холста.
# Второй запуск именно выходит, а не встаёт в очередь: ждать полчаса прогрева
# бессмысленно, обновление уже делается.
#
# flock — на сервере; mkdir — резерв там, где flock нет (он атомарен везде).
acquire_lock() {
  local mode="${AUTO_UPDATE_LOCK_MODE:-auto}"
  if [ "$mode" = "auto" ]; then
    if command -v flock >/dev/null 2>&1; then mode="flock"; else mode="mkdir"; fi
  fi

  if [ "$mode" = "flock" ]; then
    exec 9>"$LOCK_FILE" || return 1
    flock -n 9 || return 1
    LOCK_HELD="flock"
    return 0
  fi

  local dir="$LOCK_FILE.d" owner
  if mkdir "$dir" 2>/dev/null; then
    echo $$ >"$dir/pid"
    LOCK_HELD="mkdir"
    return 0
  fi
  # Замок мог остаться от убитого процесса — снимаем, только если его точно нет.
  owner=$(cat "$dir/pid" 2>/dev/null || echo "")
  if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
    log "Снимаю замок от процесса $owner — его уже нет"
    rm -rf "$dir"
    if mkdir "$dir" 2>/dev/null; then
      echo $$ >"$dir/pid"
      LOCK_HELD="mkdir"
      return 0
    fi
  fi
  return 1
}

release_lock() {
  case "$LOCK_HELD" in
    flock) flock -u 9 2>/dev/null; exec 9>&- ;;
    mkdir) rm -rf "$LOCK_FILE.d" ;;
  esac
  LOCK_HELD=""
}

main() {
  exec >>"$LOG" 2>&1

  if ! acquire_lock; then
    log "Пропуск: обновление уже идёт (замок $LOCK_FILE)"
    exit 0
  fi
  trap release_lock EXIT

  local updated=0 failed=0
  local target dir compose svc container image health_url fresh running ok state

  for target in "${TARGETS[@]}"; do
    IFS='|' read -r dir compose svc container image health_url <<<"$target"

    [ -d "$dir" ] || continue
    # Сервис может быть ещё не переведён на образы (или compose всё ещё
    # смотрит на другой тег) — тогда пропускаем молча: compose поднял бы не
    # тот образ, что мы скачали.
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
    # --no-deps: пересоздаём только этот сервис. Без флага compose тянет за
    # собой зависимости (frontend → backend) и пересоздаёт их текущим образом,
    # если у них изменился env — так 17.09 backend перезапустился старой
    # сборкой за семь минут до прихода новой.
    if ! (cd "$dir" && docker compose -f "$compose" up -d --force-recreate --no-deps "$svc" >/dev/null 2>&1); then
      log "ОШИБКА: не удалось перезапустить $svc"
      failed=$((failed + 1))
      continue
    fi

    # Ждём, пока контейнер станет здоровым. Сервисы без healthcheck считаем
    # успешными по факту запуска — за их готовность отвечает ожидание в
    # verify_build, оно спрашивает само приложение.
    ok=0
    state="unknown:none"
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
      verify_build "$container" "$image" "$health_url" || failed=$((failed + 1))
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
}

# Тесты берут отсюда функции (AUTO_UPDATE_SOURCE_ONLY=1) и подменяют обращения
# к docker — сам проход при этом не запускается.
if [ "${AUTO_UPDATE_SOURCE_ONLY:-0}" != "1" ]; then
  main "$@"
fi
