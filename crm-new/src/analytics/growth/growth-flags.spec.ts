import type { MetrikaAnalyticsSchedulerService } from '../../metrika/analytics/metrika-analytics-scheduler.service';
import type { AnalyticsGrowthService } from './analytics-growth.service';
import { growthEnabledFromEnv, growthOptionsFromEnv } from './growth-flags';
import { GrowthModule } from './growth.module';

/**
 * Stage 11 выкатывается выключенным: свой флаг поверх флага дашборда, и без
 * него ни API (кроме status), ни хук расписания не работают.
 */
describe('growth flags', () => {
  it('ANALYTICS_GROWTH_ENABLED: true/1/yes/on → включён, остальное и пусто → выключен', () => {
    for (const v of ['true', '1', 'yes', 'on', ' TRUE '])
      expect(growthEnabledFromEnv({ ANALYTICS_GROWTH_ENABLED: v })).toBe(true);
    for (const v of ['false', '0', 'no', 'off', '', undefined])
      expect(growthEnabledFromEnv({ ANALYTICS_GROWTH_ENABLED: v })).toBe(false);
    expect(growthEnabledFromEnv({})).toBe(false);
  });

  it('раздел включён только при обоих флагах', () => {
    expect(growthOptionsFromEnv({})).toEqual({ enabled: false });
    expect(
      growthOptionsFromEnv({ ANALYTICS_DASHBOARD_ENABLED: 'true' }),
    ).toEqual({ enabled: false });
    expect(growthOptionsFromEnv({ ANALYTICS_GROWTH_ENABLED: 'true' })).toEqual({
      enabled: false,
    });
    expect(
      growthOptionsFromEnv({
        ANALYTICS_DASHBOARD_ENABLED: 'true',
        ANALYTICS_GROWTH_ENABLED: 'true',
      }),
    ).toEqual({ enabled: true });
  });

  it('хук расписания регистрируется только при включённом разделе', () => {
    const registered: string[] = [];
    const scheduler = {
      registerAfterSync: (name: string) => {
        registered.push(name);
      },
    } as unknown as MetrikaAnalyticsSchedulerService;
    const growth = {
      afterSync: () =>
        Promise.resolve({ evaluated: 0, snapshotRequests: 0, errors: 0 }),
    } as unknown as AnalyticsGrowthService;

    new GrowthModule(scheduler, growth, { enabled: false }).onModuleInit();
    expect(registered).toEqual([]);

    new GrowthModule(scheduler, growth, { enabled: true }).onModuleInit();
    expect(registered).toEqual(['growth:evaluate']);
  });
});
