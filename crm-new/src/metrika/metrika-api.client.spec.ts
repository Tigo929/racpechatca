import { MetrikaApiError, METRIKA_API, YandexMetrikaClient, type FetchLike } from './metrika-api.client';
import { isMetrikaConfigured, metrikaConfigFromEnv } from './metrika.config';

/**
 * Клиент API Метрики: заголовок, адреса, ошибки, повторы, секреты.
 * Транспорт подменён — в сеть тесты не ходят.
 */
const TOKEN = 'y0_test_token_never_printed_1234567890';
const CONFIG = { counterId: 111569944, token: TOKEN };

type Recorded = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Транспорт с очередью ответов: каждый вызов снимает следующий. */
function transport(responses: (Response | Error)[]) {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('нет ответа в очереди');
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetchImpl };
}

const noSleep = async () => {};

describe('конфигурация', () => {
  it('H: без переменных клиент не настроен, а CRM не падает', () => {
    const config = metrikaConfigFromEnv({});
    expect(isMetrikaConfigured(config)).toBe(false);
    const client = new YandexMetrikaClient(config);
    expect(client.isConfigured()).toBe(false);
  });

  it('H: явный вызов без конфигурации — контролируемая ошибка not_configured', async () => {
    const client = new YandexMetrikaClient(metrikaConfigFromEnv({}));
    await expect(client.getCounter()).rejects.toMatchObject({ kind: 'not_configured', status: 0 });
    await expect(
      client.getStats({ metrics: ['ym:s:visits'], date1: '2026-09-05', date2: '2026-09-11' }),
    ).rejects.toBeInstanceOf(MetrikaApiError);
  });

  it('читает номер счётчика и токен из окружения; мусор в номере — не настроено', () => {
    expect(
      metrikaConfigFromEnv({ YANDEX_METRIKA_COUNTER_ID: '111569944', YANDEX_METRIKA_OAUTH_TOKEN: ' t ' }),
    ).toEqual({ counterId: 111569944, token: 't' });
    expect(metrikaConfigFromEnv({ YANDEX_METRIKA_COUNTER_ID: 'abc', YANDEX_METRIKA_OAUTH_TOKEN: 't' }).counterId).toBeNull();
  });
});

describe('запросы', () => {
  it('A: заголовок авторизации — OAuth <token>, Accept: json', async () => {
    const t = transport([jsonResponse(200, { counter: { id: 111569944 } })]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    await client.getCounter();
    const headers = t.calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization.startsWith('OAuth ')).toBe(true);
    expect(headers.Authorization.length).toBe('OAuth '.length + TOKEN.length);
    expect(headers.Accept).toBe('application/json');
    expect(t.calls[0]!.init.method).toBe('GET');
  });

  it('B: счётчик — правильный адрес, с полями и без', async () => {
    const t = transport([
      jsonResponse(200, { counter: { id: 111569944, permission: 'own' } }),
      jsonResponse(200, { counter: { id: 111569944, goals: [] } }),
    ]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    const counter = await client.getCounter();
    expect(counter.permission).toBe('own');
    expect(t.calls[0]!.url).toBe(`${METRIKA_API}/management/v1/counter/111569944`);
    await client.getCounter(['goals']);
    expect(t.calls[1]!.url).toBe(`${METRIKA_API}/management/v1/counter/111569944?field=goals`);
  });

  it('цели — свой адрес, пустой список при отсутствии поля', async () => {
    const t = transport([jsonResponse(200, {})]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    expect(await client.getGoals()).toEqual([]);
    expect(t.calls[0]!.url).toBe(`${METRIKA_API}/management/v1/counter/111569944/goals`);
  });

  it('C: отчёт — ids, metrics, date1/date2 и необязательные параметры', async () => {
    const t = transport([
      jsonResponse(200, {
        query: { ids: [111569944], dimensions: [], metrics: ['ym:s:visits'], date1: '2026-09-05', date2: '2026-09-11' },
        data: [{ dimensions: [], metrics: [42] }],
        totals: [42],
        sampled: false,
        sample_share: 1,
      }),
    ]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    const stats = await client.getStats({
      metrics: ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews'],
      dimensions: ['ym:s:lastTrafficSource'],
      date1: '2026-09-05',
      date2: '2026-09-11',
      limit: 50,
    });
    const url = new URL(t.calls[0]!.url);
    expect(url.pathname).toBe('/stat/v1/data');
    expect(url.searchParams.get('ids')).toBe('111569944');
    expect(url.searchParams.get('metrics')).toBe('ym:s:visits,ym:s:users,ym:s:pageviews');
    expect(url.searchParams.get('dimensions')).toBe('ym:s:lastTrafficSource');
    expect(url.searchParams.get('date1')).toBe('2026-09-05');
    expect(url.searchParams.get('date2')).toBe('2026-09-11');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.has('accuracy')).toBe(false);
    expect(stats.totals).toEqual([42]);
    expect(stats.sampled).toBe(false);
  });
});

describe('ошибки', () => {
  it('D: 401 → unauthorized, без повторов', async () => {
    const t = transport([jsonResponse(401, { message: 'Invalid oauth_token' })]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    await expect(client.getCounter()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(t.calls.length).toBe(1);
  });

  it('E: 403 → forbidden, без повторов', async () => {
    const t = transport([jsonResponse(403, { message: 'Access denied' })]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    await expect(client.getGoals()).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
    expect(t.calls.length).toBe(1);
  });

  it('F: 429 — повтор по правилу, успех со второй попытки', async () => {
    const t = transport([
      jsonResponse(429, { message: 'Too many requests' }),
      jsonResponse(200, { counter: { id: 111569944 } }),
    ]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    const counter = await client.getCounter();
    expect(counter.id).toBe(111569944);
    expect(t.calls.length).toBe(2);
  });

  it('F: 5xx исчерпывает повторы — три попытки, потом ошибка server', async () => {
    const t = transport([
      jsonResponse(502, {}),
      jsonResponse(503, {}),
      jsonResponse(500, {}),
    ]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    await expect(client.getCounter()).rejects.toMatchObject({ kind: 'server', status: 500 });
    expect(t.calls.length).toBe(3);
  });

  it('G: таймаут → timeout, не зависает; сеть → network', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    const t = transport([timeout, timeout, timeout]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    await expect(client.getCounter()).rejects.toMatchObject({ kind: 'timeout', status: 0 });
    expect(t.calls.length).toBe(3);

    const t2 = transport([new TypeError('fetch failed'), jsonResponse(200, { counter: { id: 111569944 } })]);
    const client2 = new YandexMetrikaClient(CONFIG, t2.fetchImpl, noSleep);
    expect((await client2.getCounter()).id).toBe(111569944);
  });

  it('не JSON в успешном ответе — ошибка http, а не падение', async () => {
    const t = transport([new Response('<html>', { status: 200 })]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    await expect(client.getCounter()).rejects.toMatchObject({ kind: 'http', status: 200 });
  });

  it('I: токен не попадает ни в сообщение, ни в детали, ни в имя ошибки', async () => {
    const t = transport([
      jsonResponse(401, { message: 'Invalid oauth_token' }),
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
    ]);
    const client = new YandexMetrikaClient(CONFIG, t.fetchImpl, noSleep);
    for (const call of [() => client.getCounter(), () => client.getGoals()]) {
      let caught: unknown;
      try {
        await call();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(MetrikaApiError);
      const dump = JSON.stringify({
        message: (caught as Error).message,
        stack: (caught as Error).stack,
        details: (caught as MetrikaApiError).details,
        human: (caught as MetrikaApiError).humanMessage,
        own: { ...(caught as object) },
      });
      expect(dump.includes(TOKEN)).toBe(false);
      expect(dump.includes('OAuth ')).toBe(false);
    }
  });
});
