import { TelegramPollingService } from './telegram-polling.service';
import { telegramFetch } from './telegram-fetch';

jest.mock('./telegram-fetch', () => ({
  telegramFetch: jest.fn(),
}));

const fetchMock = telegramFetch as jest.MockedFunction<typeof telegramFetch>;

/**
 * Опрос Telegram не должен ронять CRM.
 *
 * 14.11.2026 перестал отвечать прокси, через который сервер ходит в Telegram.
 * Запрос `deleteWebhook` стоял перед циклом опроса и без защиты: обещание
 * падало, ловить его было некому, и Node убивал процесс. Контейнер
 * перезапускался по кругу — заказы, деньги и отчёты оказались недоступны
 * из-за молчания мессенджера, от которого они никак не зависят.
 */
function service(): TelegramPollingService {
  const config = {
    get: (key: string) =>
      key === 'TELEGRAM_BOT_TOKEN' ? 'test-token' : undefined,
  };
  const updates = { handleUpdate: jest.fn() };
  return new TelegramPollingService(config as never, updates as never);
}

/** Ответ Telegram в том виде, в каком его читает сервис. */
function answer(result: unknown): Promise<Response> {
  return Promise.resolve({
    json: () => Promise.resolve({ ok: true, result }),
  } as unknown as Response);
}

describe('опрос Telegram при недоступном канале', () => {
  beforeEach(() => fetchMock.mockReset());

  it('первый же отказ не роняет процесс — опрос просто повторяет', async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error('fetch failed')),
    );
    const svc = service();
    const loop = svc.start();
    // Останавливаем сразу: цикл обязан завершиться сам и без исключения.
    svc.onModuleDestroy();
    await expect(loop).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('вебхук снимается, когда канал отвечает, а не только при старте', async () => {
    // Раньше попытка была одна и до цикла: если Telegram молчал в эту
    // секунду, вебхук оставался висеть, и getUpdates не работал бы и после
    // восстановления связи.
    const calls: string[] = [];
    const svc = service();
    fetchMock.mockImplementation((url: string) => {
      const method = url.split('/').pop() ?? '';
      calls.push(method);
      if (calls.length === 1) {
        return Promise.reject(new Error('fetch failed'));
      }
      if (calls.length >= 3) svc.onModuleDestroy();
      return answer(method === 'getUpdates' ? [] : true);
    });
    await svc.start();
    expect(calls[0]).toBe('deleteWebhook');
    expect(calls[1]).toBe('deleteWebhook');
    expect(calls[2]).toBe('getUpdates');
  });
});
