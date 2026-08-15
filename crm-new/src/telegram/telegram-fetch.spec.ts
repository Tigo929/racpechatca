import { resetTelegramProxyCache, telegramFetch } from './telegram-fetch';

/**
 * Прокси для Telegram — единственный способ достучаться до бота с боевого
 * сервера, поэтому важно, чтобы он включался и выключался предсказуемо:
 * забытая переменная не должна ронять отправку, а кривая — уводить в молчание.
 */
describe('telegramFetch: прокси только когда он задан', () => {
  const realFetch = global.fetch;
  let lastInit: (RequestInit & { dispatcher?: unknown }) | undefined;

  beforeEach(() => {
    resetTelegramProxyCache();
    delete process.env.TELEGRAM_PROXY_URL;
    lastInit = undefined;
    global.fetch = jest.fn((_url: unknown, init?: RequestInit) => {
      lastInit = init;
      return Promise.resolve(new Response('{}'));
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
    delete process.env.TELEGRAM_PROXY_URL;
  });

  it('без переменной идёт напрямую — ничего лишнего в запросе', async () => {
    await telegramFetch('https://api.telegram.org/botX/getMe', { method: 'POST' });

    expect(lastInit).toEqual({ method: 'POST' });
    expect(lastInit).not.toHaveProperty('dispatcher');
  });

  it('с переменной подставляет dispatcher, не трогая остальной запрос', async () => {
    process.env.TELEGRAM_PROXY_URL = 'http://user:pass@proxy.example:3128';

    await telegramFetch('https://api.telegram.org/botX/getMe', { method: 'POST' });

    expect(lastInit).toHaveProperty('dispatcher');
    expect(lastInit?.method).toBe('POST');
  });

  it('кривой адрес не роняет отправку — идём напрямую', async () => {
    process.env.TELEGRAM_PROXY_URL = 'это не адрес';

    await expect(
      telegramFetch('https://api.telegram.org/botX/getMe'),
    ).resolves.toBeDefined();
    expect(lastInit).not.toHaveProperty('dispatcher');
  });

  it('смена адреса подхватывается без перезапуска', async () => {
    process.env.TELEGRAM_PROXY_URL = 'http://first.example:3128';
    await telegramFetch('https://api.telegram.org/botX/getMe');
    const first = lastInit?.dispatcher;

    process.env.TELEGRAM_PROXY_URL = 'http://second.example:3128';
    await telegramFetch('https://api.telegram.org/botX/getMe');

    expect(lastInit?.dispatcher).toBeDefined();
    expect(lastInit?.dispatcher).not.toBe(first);
  });
});
