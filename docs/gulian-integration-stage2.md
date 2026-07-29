# Интеграция CRM «Распечатка» → Gulian CRM

## Поведение

В карточке заказа футболок доступны независимые действия:

- **Отправить в Telegram** — отправляет ТЗ/файлы исполнителю и сохраняет `telegram_chat_id`/`telegram_message_id`.
- **Отправить в CRM исполнителя** — создаёт transactional-outbox событие и передаёт заказ в Gulian в фоне. Telegram для этого действия не требуется.

Оба действия повторно валидируют заказ. Количество изделий считается только по производственным позициям футболок; деньги передаются целыми копейками. Статусы `sent`, `in_progress`, `ready`, `problem`, `cancelled` передаются с актуальным `source_revision`.

## API и HMAC

Базовый URL на production: `https://coolabc.ru/crm`.

`POST /api/integrations/raspechatka/v1/orders/upsert`

Подпись строится по точным raw bytes тела:

`timestamp + "\\n" + request_id + "\\n" + raw_request_body`

HMAC-SHA256, lowercase hex. Заголовки: `X-Integration-Timestamp`, `X-Integration-Request-ID`, `X-Integration-Signature`.

## Конфигурация

Секрет задаётся только в `.env`/systemd environment и не хранится в Git:

```dotenv
GULIAN_INTEGRATION_ENABLED=true
GULIAN_INTEGRATION_BASE_URL=https://coolabc.ru/crm
GULIAN_INTEGRATION_SECRET=<same-secret-as-receiver>
GULIAN_INTEGRATION_TIMEOUT_SECONDS=15
GULIAN_INTEGRATION_MAX_ATTEMPTS=20
GULIAN_INTEGRATION_BULK_SIZE=100
```

## Outbox

События имеют статусы `pending`, `processing`, `delivered`, `failed`; worker использует повторы 1m/5m/15m/1h/6h. `created`, `updated`, `duplicate`, `unchanged`, `stale` считаются завершёнными. `ignored` с причиной `settlement_already_paid` фиксируется без бесконечных повторов.

## Проверка production

Перед изменениями сохранены резервные копии Raspechatka в `/opt/raspechatka-backups/` и Gulian в `/opt/crm-backups/`. Последняя проверенная заявка `20260625-067` доставлена в Gulian как расчётный заказ `RAS-00001`, позиция: 2 шт., 681 ₽/шт., 1 362 ₽.

## Rollback

Остановить только сервис Raspechatka, восстановить код/дамп из соответствующего каталога backup, вернуть предыдущий `.env`, выполнить `docker compose up -d`. Базу Gulian не откатывать поверх production без отдельного согласования; receiver миграция обратно совместима с сохранёнными данными.