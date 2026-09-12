import {
  isMetrikaConfigured,
  metrikaAnalyticsSyncEnabledFromEnv,
  metrikaConfigFromEnv,
  metrikaOrdersSyncEnabledFromEnv,
} from './metrika.config';

/** Рубильники этапов 06 и 07: включены только явным «true/1/yes/on», по умолчанию — выключены. */
describe('рубильники Метрики', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'on', ' on '])(
    '%p включает оба рубильника',
    (v) => {
      expect(
        metrikaOrdersSyncEnabledFromEnv({
          YANDEX_METRIKA_ORDERS_SYNC_ENABLED: v,
        }),
      ).toBe(true);
      expect(
        metrikaAnalyticsSyncEnabledFromEnv({
          YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: v,
        }),
      ).toBe(true);
    },
  );

  it.each(['', 'false', '0', 'no', 'off', 'enabled', undefined])(
    '%p — выключено',
    (v) => {
      expect(
        metrikaOrdersSyncEnabledFromEnv({
          YANDEX_METRIKA_ORDERS_SYNC_ENABLED: v,
        }),
      ).toBe(false);
      expect(
        metrikaAnalyticsSyncEnabledFromEnv({
          YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: v,
        }),
      ).toBe(false);
    },
  );

  it('рубильники независимы друг от друга и от настроенности клиента', () => {
    const env = {
      YANDEX_METRIKA_ORDERS_SYNC_ENABLED: 'true',
      YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: 'false',
    };
    expect(metrikaOrdersSyncEnabledFromEnv(env)).toBe(true);
    expect(metrikaAnalyticsSyncEnabledFromEnv(env)).toBe(false);
    expect(isMetrikaConfigured(metrikaConfigFromEnv(env))).toBe(false);
  });
});
