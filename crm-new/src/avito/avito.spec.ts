import { ConfigService } from '@nestjs/config';
import { AvitoService, AvitoNotConfiguredError } from './avito.service';

/**
 * Проверяем поведение токена: он живёт 24 часа, и если просить новый на каждый
 * запрос — упрёмся в лимиты Авито. Поэтому тесты следят именно за числом
 * походов за токеном.
 */

type FetchCall = { url: string; init?: RequestInit };

function makeService(env: Record<string, string> = {}) {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new AvitoService(config);
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const ENV = {
  AVITO_CLIENT_ID: 'test-id',
  AVITO_CLIENT_SECRET: 'test-secret',
};

describe('AvitoService', () => {
  let calls: FetchCall[];
  const originalFetch = global.fetch;

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /** Отдаёт токен на любой /token/, остальное — по карте ответов. */
  function mockFetch(routes: Record<string, Response | (() => Response)>) {
    global.fetch = jest.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, init });
      if (href.endsWith('/token/')) {
        return Promise.resolve(
          jsonResponse({ access_token: 'tok-' + calls.length, expires_in: 86400 }),
        );
      }
      for (const [path, res] of Object.entries(routes)) {
        if (href.includes(path)) {
          return Promise.resolve(typeof res === 'function' ? res() : res);
        }
      }
      return Promise.resolve(jsonResponse({ message: 'not found' }, 404));
    }) as unknown as typeof fetch;
  }

  const tokenCalls = () => calls.filter((c) => c.url.endsWith('/token/')).length;

  it('без ключей не ходит в сеть, а честно падает', async () => {
    mockFetch({});
    const avito = makeService();
    expect(avito.isConfigured).toBe(false);
    await expect(avito.getAccount()).rejects.toBeInstanceOf(AvitoNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  it('переиспользует токен между запросами', async () => {
    mockFetch({ '/core/v1/accounts/self': () => jsonResponse({ id: 1, name: 'Распечатка' }) });
    const avito = makeService(ENV);

    await avito.getAccount();
    await avito.getAccount();
    await avito.getAccount();

    expect(tokenCalls()).toBe(1);
  });

  it('параллельные запросы берут токен один раз', async () => {
    mockFetch({ '/core/v1/accounts/self': () => jsonResponse({ id: 1, name: 'Распечатка' }) });
    const avito = makeService(ENV);

    await Promise.all([avito.getAccount(), avito.getAccount(), avito.getAccount()]);

    expect(tokenCalls()).toBe(1);
  });

  it('на 403 обновляет токен и повторяет запрос один раз', async () => {
    let attempt = 0;
    mockFetch({
      '/core/v1/accounts/self': () => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ message: 'forbidden' }, 403)
          : jsonResponse({ id: 1, name: 'Распечатка' });
      },
    });
    const avito = makeService(ENV);

    const account = await avito.getAccount();

    expect(account.name).toBe('Распечатка');
    expect(tokenCalls()).toBe(2);
    expect(attempt).toBe(2);
  });

  it('на постоянный 403 не уходит в бесконечный повтор', async () => {
    mockFetch({ '/core/v1/accounts/self': () => jsonResponse({ message: 'forbidden' }, 403) });
    const avito = makeService(ENV);

    await expect(avito.getAccount()).rejects.toThrow(/403/);
    expect(tokenCalls()).toBe(2);
  });

  it('запоминает id аккаунта, чтобы не дёргать профиль ради него', async () => {
    mockFetch({ '/core/v1/accounts/self': () => jsonResponse({ id: 174365060, name: 'Распечатка' }) });
    const avito = makeService(ENV);

    expect(await avito.getUserId()).toBe(174365060);
    expect(await avito.getUserId()).toBe(174365060);

    const selfCalls = calls.filter((c) => c.url.includes('/accounts/self')).length;
    expect(selfCalls).toBe(1);
  });

  it('ограничивает limit отзывов и передаёт offset', async () => {
    mockFetch({ '/ratings/v1/reviews': () => jsonResponse({ total: 221, reviews: [] }) });
    const avito = makeService(ENV);

    await avito.getReviews(5, 10);

    const url = calls.find((c) => c.url.includes('/ratings/v1/reviews'))!.url;
    expect(url).toContain('limit=5');
    expect(url).toContain('offset=10');
  });
});
