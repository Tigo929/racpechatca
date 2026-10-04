import { DirectSpendSync, directSpendConfig } from './direct-spend-sync';
import { InMemoryLock } from '../../metrika/analytics/metrika-sync-lock';
import type { PrismaService } from '../../prisma/prisma.service';

const range = { from: '2026-09-01', to: '2026-09-25' };
const config = { login: 'account', campaignIds: ['123'] };
const data = [
  {
    dimensions: [{ name: '2026-09-24' }, { id: '123', name: 'Photos' }],
    metrics: [1234.5678, 42],
  },
];
function setup(result: object) {
  const tx = { adSpend: { deleteMany: jest.fn(), createMany: jest.fn() } };
  const prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
  const client = {
    getStats: jest.fn().mockResolvedValue({ data, total_rows: 1, ...result }),
  };
  const service = new DirectSpendSync(
    prisma as unknown as PrismaService,
    client,
    new InMemoryLock(),
    config,
  );
  return { service, prisma, tx, client };
}
describe('Direct spend sync', () => {
  it('requires an explicit login and numeric campaign allowlist', () => {
    expect(directSpendConfig({})).toBeNull();
    expect(
      directSpendConfig({
        YANDEX_DIRECT_ANALYTICS_LOGIN: 'a',
        YANDEX_DIRECT_ANALYTICS_CAMPAIGNS: "1' OR 1",
      }),
    ).toBeNull();
  });
  it('preserves fractional rubles, marks VAT and unavailable impressions; replaces overlap atomically', async () => {
    const { service, tx, client } = setup({});
    await service.sync(range);
    await service.sync(range);
    expect(tx.adSpend.createMany.mock.calls[0][0].data[0]).toMatchObject({
      spend: 1234.5678,
      vatBasis: 'EXCLUDED',
      impressions: null,
    });
    expect(tx.adSpend.deleteMany).toHaveBeenCalledTimes(2);
    expect(client.getStats.mock.calls[0][0]).toMatchObject({
      direct_client_logins: ['account'],
      filters: "ym:ad:directOrder=='123'",
    });
  });
  it.each([
    { sampled: true },
    { total_rows: 2 },
    { data: [{ ...data[0], metrics: [-1, 42] }] },
    {
      data: [
        { ...data[0], dimensions: [{ name: '2026-09-24' }, { id: '999' }] },
      ],
    },
  ])('keeps existing data if the response is unsafe: %j', async (result) => {
    const { service, prisma } = setup(result);
    await expect(service.sync(range)).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
