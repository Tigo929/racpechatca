import {
  type DashboardOptions,
  dashboardEnabledFromEnv,
} from '../dashboard/analytics-dashboard.controller';

/**
 * Флаг раздела «Рост / Изменения» (этап 11).
 *
 * Раздел живёт под двумя флагами: общим флагом дашборда (этап 09) и своим.
 * Так Stage 11 выкатывается выключенным, не гася уже работающие вкладки
 * руководителя: без ANALYTICS_GROWTH_ENABLED API роста отвечает 404 на всё,
 * кроме /status, вкладка показывает «раздел выключен», хук расписания не
 * регистрируется — в production ничего не оценивается и не запрашивается.
 */
export const GROWTH_ENABLED_ENV = 'ANALYTICS_GROWTH_ENABLED';

function truthy(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/** true/1/yes/on → включён; иначе выключен (default false). */
export function growthEnabledFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return truthy(env[GROWTH_ENABLED_ENV]);
}

/** Оба флага обязаны быть включены — общий дашборда и свой. */
export function growthOptionsFromEnv(
  env: Record<string, string | undefined> = process.env,
): DashboardOptions {
  return { enabled: dashboardEnabledFromEnv(env) && growthEnabledFromEnv(env) };
}
