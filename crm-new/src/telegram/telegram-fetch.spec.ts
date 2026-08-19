import { fetch as undiciFetch } from 'undici';
import { resetTelegramProxyCache, telegramFetch } from './telegram-fetch';

/**
 * Прокси для Telegram — единственный способ достучаться до бота с боевого
 * сервера, поэтому важно, чтобы он включался и выключался предсказуемо:
 * забытая переменная не должна ронять отправку, а кривая — уводить в молчание.
 *
 * Отдельно проверяем, каким именно fetch уходит запрос. Это не придирка:
 * на проде агент из установленного undici, отданный встроенному в Node
 * fetch, ронял каждый запрос с «invalid onRequestStart method» — версии
 * библиотеки разошлись. Снаружи это выглядело как та же блокировка.
 */
jest.mock('undici', () => {
  const actual = jest.requireActual('undici');
  return { ...actual, fetch: jest.fn() };
});

describe('telegramFetch: прокси только когда он задан', () => {
  const realFetch = global.fetch;
  const mockedUndiciFetch = undiciFetch as unknown as jest.Mock;
  /** init, ушедший во встроенный fetch (путь без прокси). */
  let globalInit: (RequestInit & { dispatcher?: unknown }) | undefined;
  /** init, ушедший в undici-fetch (путь через прокси). */
  const proxyInit = () =>
    mockedUndiciFetch.mock.calls.at(-1)?.[1] as
      | (RequestInit & { dispatcher?: unknown })
      | undefined;

  beforeEach(() => {
    resetTelegramProxyCache();
    delete process.env.TELEGRAM_PROXY_URL;
    globalInit = undefined;
    mockedUndiciFetch.mockReset();
    mockedUndiciFetch.mockResolvedValue(new Response('{}'));
    global.fetch = jest.fn((_url: unknown, init?: RequestInit) => {
      globalInit = init;
      return Promise.resolve(new Response('{}'));
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
    delete process.env.TELEGRAM_PROXY_URL;
  });

  it('без переменной идёт тем же undici, но без агента', async () => {
    // Развилки «без прокси — встроенный fetch» больше нет: тело multipart
    // собирается заранее, и сборка undici должна быть та же, что повезёт
    // запрос. Иначе FormData чужой сборки молча превращается в строку и
    // файл теряется — см. комментарий в telegram-fetch.ts.
    await telegramFetch('https://api.telegram.org/botX/getMe', { method: 'POST' });

    expect(globalInit).toBeUndefined();
    expect(mockedUndiciFetch).toHaveBeenCalledTimes(1);
    expect(proxyInit()).not.toHaveProperty('dispatcher');
    expect(proxyInit()?.method).toBe('POST');
  });

  it('с прокси запрос уходит через undici — иначе агент несовместим', async () => {
    process.env.TELEGRAM_PROXY_URL = 'http://user:pass@proxy.example:3128';

    await telegramFetch('https://api.telegram.org/botX/getMe', { method: 'POST' });

    expect(mockedUndiciFetch).toHaveBeenCalledTimes(1);
    expect(globalInit).toBeUndefined();
    expect(proxyInit()).toHaveProperty('dispatcher');
    expect(proxyInit()?.method).toBe('POST');
  });

  it('кривой адрес не роняет отправку — идём без агента', async () => {
    process.env.TELEGRAM_PROXY_URL = 'это не адрес';

    await expect(
      telegramFetch('https://api.telegram.org/botX/getMe'),
    ).resolves.toBeDefined();
    expect(proxyInit()).not.toHaveProperty('dispatcher');
  });

  it('смена адреса подхватывается без перезапуска', async () => {
    process.env.TELEGRAM_PROXY_URL = 'http://first.example:3128';
    await telegramFetch('https://api.telegram.org/botX/getMe');
    const first = proxyInit()?.dispatcher;

    process.env.TELEGRAM_PROXY_URL = 'http://second.example:3128';
    await telegramFetch('https://api.telegram.org/botX/getMe');

    expect(proxyInit()?.dispatcher).toBeDefined();
    expect(proxyInit()?.dispatcher).not.toBe(first);
  });
});
