/**
 * Конфигурация доступа к API Яндекс Метрики.
 *
 * Три переменные окружения:
 *
 *   YANDEX_METRIKA_COUNTER_ID           — номер счётчика (111569944)
 *   YANDEX_METRIKA_OAUTH_TOKEN          — OAuth-токен аккаунта с доступом к счётчику
 *   YANDEX_METRIKA_ORDERS_SYNC_ENABLED  — отправлять ли заказы из очереди
 *                                         (этап 06); по умолчанию выключено
 *   YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED — забирать ли отчёты Метрики в
 *                                         локальные таблицы по расписанию
 *                                         (этап 07); по умолчанию выключено
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

/**
 * Рубильник отправки заказов (этап 06). Очередь наполняется всегда, а
 * уходит наружу только при явном «true/1/yes/on»: первый заказ в Метрику
 * должен уйти по команде владельца, а не в момент выкладки.
 */
export function metrikaOrdersSyncEnabledFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return flagOn(env.YANDEX_METRIKA_ORDERS_SYNC_ENABLED);
}

/**
 * Рубильник расписания синхронизации отчётов (этап 07). Ручной запуск из
 * CLI работает всегда; по расписанию — только при явном «true/1/yes/on».
 * На первой выкладке он выключен: сначала контрольная семидневная
 * синхронизация и сверка с API руками, потом расписание.
 */
export function metrikaAnalyticsSyncEnabledFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return flagOn(env.YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED);
}

function flagOn(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}
