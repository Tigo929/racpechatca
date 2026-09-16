import {
  type DashboardOptions,
  dashboardEnabledFromEnv,
} from '../dashboard/analytics-dashboard.controller';

/**
 * Флаг раздела «Инсайты» (этап 12). Отдельный от флага дашборда: раздел
 * включается только при обоих (ANALYTICS_DASHBOARD_ENABLED и свой). Выключен —
 * маршруты данных отвечают 404 ещё в guard (до валидации тела), status
 * возвращает enabled: false, хук расписания не регистрируется.
 */
export const INSIGHTS_ENABLED_ENV = 'ANALYTICS_INSIGHTS_ENABLED';

function truthy(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export function insightsEnabledFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return truthy(env[INSIGHTS_ENABLED_ENV]);
}

export function insightsOptionsFromEnv(
  env: Record<string, string | undefined> = process.env,
): DashboardOptions {
  return {
    enabled: dashboardEnabledFromEnv(env) && insightsEnabledFromEnv(env),
  };
}
