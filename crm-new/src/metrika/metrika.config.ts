/**
 * Конфигурация доступа к API Яндекс Метрики.
 *
 * Две переменные окружения:
 *
 *   YANDEX_METRIKA_COUNTER_ID   — номер счётчика (111569944)
 *   YANDEX_METRIKA_OAUTH_TOKEN  — OAuth-токен аккаунта с доступом к счётчику
 *
 * Токен — секрет: он живёт только в окружении контейнера backend
 * (`/opt/raspechatka/.env` → docker compose), в базу не пишется, в браузер
 * не уходит, в логи и ошибки не попадает. Client ID и Client Secret
 * OAuth-приложения для запросов не нужны: токен выпускается вручную,
 * серверного обновления нет.
 *
 * Отсутствие конфигурации — штатное состояние, а не ошибка запуска:
 * CRM поднимается и работает, интеграция считается выключенной, а явный
 * вызов клиента возвращает понятную ошибку `not_configured`.
 */

export interface MetrikaConfig {
  counterId: number | null;
  token: string | null;
}

export function metrikaConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): MetrikaConfig {
  const rawId = (env.YANDEX_METRIKA_COUNTER_ID ?? '').trim();
  const counterId = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const token = (env.YANDEX_METRIKA_OAUTH_TOKEN ?? '').trim() || null;
  return { counterId, token };
}

export function isMetrikaConfigured(config: MetrikaConfig): boolean {
  return config.counterId !== null && config.token !== null;
}
