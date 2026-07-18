#!/bin/sh
# Ежедневный бэкап БД CRM. Ставится в cron (см. AUDIT_REPORT_V2).
# Хранит последние 14 копий. ВАЖНО: это локальные копии на том же сервере —
# для защиты от потери сервера настройте выгрузку DIR в облако (S3/Я.Облако).
set -e
DIR=/opt/raspechatka/backups
mkdir -p "$DIR"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$DIR/crm_$TS.sql.gz"

docker exec raspechatka-postgres-1 pg_dump -U crm_user -d crm | gzip > "$FILE"

# ротация: оставляем 14 свежих
ls -1t "$DIR"/crm_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

SIZE=$(du -h "$FILE" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') OK $FILE ($SIZE)" >> "$DIR/backup.log"
