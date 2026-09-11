import { MetrikaApiError, YandexMetrikaClient } from '../metrika/metrika-api.client';
import { metrikaConfigFromEnv } from '../metrika/metrika.config';

/**
 * Проверка связи с API Яндекс Метрики — только чтение.
 *
 *   npm run metrika:smoke
 *
 * Три запроса: счётчик с целями, отдельно цели, отчёт за последние
 * семь календарных дней (визиты, посетители, просмотры). Печатает
 * только итоги: номер счётчика, права, число целей, цифры отчёта,
 * признак семплирования. Токен, заголовки и логин владельца не печатает
 * никогда — ни в успехе, ни в ошибке.
 *
 * Запускается из собранного dist, как и само приложение:
 * `node dist/src/analytics/metrika-smoke.js`. Базу не трогает,
 * приложение не поднимает — только клиент и окружение.
 *
 * Код выхода: 0 — всё прочиталось; 2 — не настроено; 1 — ошибка API.
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const config = metrikaConfigFromEnv();
  const client = new YandexMetrikaClient(config);

  if (!client.isConfigured()) {
    console.log('Yandex Metrika connectivity: NOT CONFIGURED');
    console.log(
      `  counter id: ${config.counterId ?? 'нет'}, token: ${config.token ? 'задан' : 'нет'}`,
    );
    console.log('  Нужны переменные YANDEX_METRIKA_COUNTER_ID и YANDEX_METRIKA_OAUTH_TOKEN.');
    process.exit(2);
  }

  const startedAt = Date.now();
  const counter = await client.getCounter(['goals']);
  const goals = await client.getGoals();

  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(today.getUTCDate() - 6);
  const stats = await client.getStats({
    metrics: ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews'],
    date1: isoDate(from),
    date2: isoDate(today),
  });
  const [visits, users, pageviews] = stats.totals ?? stats.data[0]?.metrics ?? [];

  console.log('Yandex Metrika connectivity: OK');
  console.log(`Counter: ${counter.id}`);
  console.log(`Counter access: OK (permission: ${counter.permission ?? '—'}, status: ${counter.code_status ?? counter.status ?? '—'})`);
  console.log(`Site: ${counter.site ?? counter.site2?.site ?? '—'}`);
  console.log(`Goals loaded: ${goals.length}`);
  for (const g of goals) {
    const event = g.conditions?.map((c) => c.url).filter(Boolean).join(', ');
    console.log(`  - [${g.id}] ${g.name} (${g.type}${event ? `: ${event}` : ''})`);
  }
  console.log('Reports API: OK');
  console.log(`Period: ${isoDate(from)}..${isoDate(today)}`);
  console.log(`Visits: ${visits ?? '—'}`);
  console.log(`Users: ${users ?? '—'}`);
  console.log(`Pageviews: ${pageviews ?? '—'}`);
  console.log(
    `Sampling: sampled=${String(stats.sampled ?? false)} sample_share=${stats.sample_share ?? 1} data_lag=${stats.data_lag ?? '—'}s`,
  );
  console.log(`Duration: ${Date.now() - startedAt} ms`);
}

main().catch((error: unknown) => {
  if (error instanceof MetrikaApiError) {
    console.error(`Yandex Metrika connectivity: FAIL (${error.kind}, HTTP ${error.status})`);
    console.error(`  ${error.humanMessage}`);
  } else {
    console.error('Yandex Metrika connectivity: FAIL');
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
});
