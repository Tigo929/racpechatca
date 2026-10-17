#!/usr/bin/env bash
# Ежедневный бэкап CRM. Ставится в cron (0 3 * * *).
#
# Делает три вещи:
#   1. дамп БД в локальную папку (последние 14 копий),
#   2. выгрузку дампа в Object Storage,
#   3. выгрузку ТЗ-фото (том uploads) туда же.
#
# Локальная копия лежит рядом с базой, поэтому от потери сервера защищает
# только облако. Ошибка облачной копии возвращает ненулевой код, чтобы cron
# или systemd могли отправить оповещение, при этом локальный дамп сохраняется.
set -Eeuo pipefail

DIR=/opt/raspechatka/backups
UPLOADS=/var/lib/docker/volumes/raspechatka_uploads/_data
S3_BUCKET=raspechatka-backups1
S3_ENDPOINT=https://storage.yandexcloud.net
S3_PROFILE=yandex
LOG="$DIR/backup.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

mkdir -p "$DIR"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$DIR/crm_$TS.sql.gz"
TEMP_FILE="$FILE.part"
trap 'rm -f "$TEMP_FILE"' EXIT

# ── 1. Дамп базы ────────────────────────────────────────────────────────────
# Пайп скрывает код возврата pg_dump: gzip отработает даже на пустом входе,
# и молча появится «бэкап» в пару десятков байт. Поэтому проверяем размер.
docker exec raspechatka-postgres-1 pg_dump -U crm_user -d crm | gzip > "$TEMP_FILE"
gzip -t "$TEMP_FILE"
mv "$TEMP_FILE" "$FILE"

BYTES=$(stat -c %s "$FILE" 2>/dev/null || echo 0)
if [ "$BYTES" -lt 1000 ]; then
  log "FAIL дамп получился пустым ($BYTES байт) — база не отдалась"
  rm -f "$FILE"
  exit 1
fi

# ротация: оставляем 14 свежих локальных копий
ls -1t "$DIR"/crm_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

SIZE=$(du -h "$FILE" | cut -f1)
log "OK дамп $FILE ($SIZE)"

# ── 2. Выгрузка в облако ────────────────────────────────────────────────────
# Роль ключа — storage.uploader: загружать можно, удалять нельзя. Чистка
# старого делается правилом жизненного цикла на стороне бакета.
if ! command -v aws >/dev/null 2>&1; then
  log "FAIL облако: aws-cli не установлен"
  exit 1
fi

S3="aws --profile $S3_PROFILE --endpoint-url $S3_ENDPOINT"

FAILED=0
if $S3 s3 cp "$FILE" "s3://$S3_BUCKET/db/$(basename "$FILE")" >/dev/null 2>&1; then
  log "OK облако db/$(basename "$FILE")"
else
  log "FAIL облако: дамп не выгрузился"
  FAILED=1
fi

# ── 3. ТЗ-фото ──────────────────────────────────────────────────────────────
# sync без --delete: ключ не имеет прав на удаление, да и терять макеты
# из-за случайной чистки на сервере не хочется.
if [ -d "$UPLOADS" ]; then
  if $S3 s3 sync "$UPLOADS" "s3://$S3_BUCKET/techspec/" >/dev/null 2>&1; then
    COUNT=$(find "$UPLOADS" -type f | wc -l)
    log "OK облако techspec/ ($COUNT файлов)"
  else
    log "FAIL облако: ТЗ-фото не выгрузились"
    FAILED=1
  fi
else
  log "FAIL ТЗ-фото: каталог $UPLOADS не найден"
  FAILED=1
fi

exit "$FAILED"
