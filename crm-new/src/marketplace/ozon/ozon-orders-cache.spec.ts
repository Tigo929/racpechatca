import type { OzonApiClient } from './ozon-api.client';
import { OzonApiError } from './ozon-api.client';
import { OzonOrdersService } from './ozon-orders.service';
import type { PrismaService } from 'src/prisma/prisma.service';

const CREDS = { clientId: 'client-1', apiKey: 'secret' };
// Конверт v4: отправления в корне ответа, без обёртки `result`.
const RESPONSE = {
  postings: [
    {
      posting_number: '111-0001',
      order_number: '111',
      status: 'awaiting_packaging',
      products: [
        {
          offer_id: 'papa-black-S',
          name: 'Футболка',
          quantity: 1,
          price: '1000',
        },
      ],
    },
  ],
  has_next: false,
};

function makeService(post: jest.Mock) {
  return new OzonOrdersService({ post } as unknown as OzonApiClient);
}

describe('OzonOrdersService cache', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('делит один ответ между экраном и повторным запросом', async () => {
    const post = jest.fn().mockResolvedValue(RESPONSE);
    const service = makeService(post);

    const first = await service.list(CREDS, { sinceDays: 90, limit: 1000 });
    const second = await service.list(CREDS, {
      sinceDays: 90,
      limit: 1000,
      articlePrefixes: ['papa-'],
    });

    expect(first.orders).toHaveLength(1);
    expect(second.orders).toHaveLength(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      CREDS,
      // Третью версию метода Ozon выключил; сотня — потолок четвёртой.
      '/v4/posting/fbs/list',
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('объединяет одновременные запросы к одной странице', async () => {
    let resolve!: (value: typeof RESPONSE) => void;
    const pending = new Promise<typeof RESPONSE>((done) => {
      resolve = done;
    });
    const post = jest.fn().mockReturnValue(pending);
    const service = makeService(post);

    const first = service.list(CREDS, { sinceDays: 90, limit: 1000 });
    const second = service.list(CREDS, { sinceDays: 90, limit: 1000 });
    resolve(RESPONSE);

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('при 429 показывает последний успешный снимок', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    const post = jest
      .fn()
      .mockResolvedValueOnce(RESPONSE)
      .mockRejectedValueOnce(
        new OzonApiError(429, 'Ozon ограничил частоту запросов.'),
      );
    const service = makeService(post);

    const fresh = await service.list(CREDS, { sinceDays: 90, limit: 1000 });
    jest.setSystemTime(new Date('2026-10-20T10:07:00Z'));
    const stale = await service.list(CREDS, { sinceDays: 90, limit: 1000 });

    expect(fresh.stale).toBe(false);
    expect(stale.stale).toBe(true);
    expect(stale.orders).toHaveLength(1);
    expect(stale.refreshedAt).toBe(fresh.refreshedAt);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('после перезапуска берёт снимок из базы при 429', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    const post = jest
      .fn()
      .mockRejectedValue(new OzonApiError(429, 'Слишком много запросов'));
    const findUnique = jest.fn().mockResolvedValue({
      cacheKey: '["client-1",90,1000,0]',
      clientId: 'client-1',
      response: RESPONSE,
      refreshedAt: new Date('2026-10-20T09:00:00Z'),
      staleUntil: new Date('2026-10-27T09:00:00Z'),
    });
    const prisma = {
      ozonOrderSnapshot: {
        findUnique,
        upsert: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new OzonOrdersService(
      { post } as unknown as OzonApiClient,
      prisma,
    );

    const result = await service.list(CREDS, {
      sinceDays: 90,
      limit: 1000,
      articlePrefixes: ['papa-'],
    });

    expect(result.stale).toBe(true);
    expect(result.orders).toHaveLength(1);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
