import { PrismaService } from 'src/prisma/prisma.service';
import { OzonApiClient, OzonApiError } from './ozon-api.client';
import { OzonWarehouseService } from './ozon-warehouse.service';
import { WAREHOUSE_CACHE_TTL_MS } from './ozon-warehouse-rules';

/**
 * Склады кабинета: когда идём к площадке, когда обходимся снимком и что
 * делаем с отказом. Числа складов настоящие — из шаблона обновления
 * остатков, выгруженного из кабинета 25.08.2026.
 */

const PERVOMAY = 1020005000060325;
const AMIR = 1020005027898150;
const EXPRESS = 1020005028012630;

const CREDS = { clientId: '1', apiKey: 'k' };
const NOW = new Date('2026-08-25T12:00:00Z');

type AnyMock = jest.Mock<Promise<unknown>, unknown[]>;

function createPrisma(rows: { warehouseId: number; name: string; syncedAt: Date }[]) {
  const stored = rows.map((row) => ({
    warehouseId: BigInt(row.warehouseId),
    name: row.name,
    status: 'created',
    isEditable: true,
    disabledReason: null,
    syncedAt: row.syncedAt,
  }));

  const prisma = {
    ozonWarehouse: {
      findFirst: jest.fn() as AnyMock,
      findMany: jest.fn() as AnyMock,
      count: jest.fn() as AnyMock,
      upsert: jest.fn() as AnyMock,
      updateMany: jest.fn() as AnyMock,
    },
    $transaction: jest.fn() as AnyMock,
  };

  prisma.ozonWarehouse.findFirst.mockResolvedValue(stored[0] ?? null);
  prisma.ozonWarehouse.findMany.mockResolvedValue(stored);
  prisma.ozonWarehouse.count.mockResolvedValue(stored.length);
  prisma.ozonWarehouse.upsert.mockResolvedValue({});
  prisma.ozonWarehouse.updateMany.mockResolvedValue({ count: 0 });
  prisma.$transaction.mockResolvedValue([]);
  return prisma;
}

function createApi(result: unknown | Error) {
  const api = { post: jest.fn() as AnyMock };
  if (result instanceof Error) api.post.mockRejectedValue(result);
  else api.post.mockResolvedValue(result);
  return api;
}

function build(prisma: ReturnType<typeof createPrisma>, api: { post: AnyMock }) {
  return new OzonWarehouseService(
    prisma as unknown as PrismaService,
    api as unknown as OzonApiClient,
  );
}

describe('список складов', () => {
  it('свежий снимок отдаётся без обращения к площадке', async () => {
    // Окно выбора склада открывают десятки раз в день, список меняется
    // раз в месяцы — ходить за ним каждый раз незачем.
    const prisma = createPrisma([
      { warehouseId: PERVOMAY, name: 'первомай', syncedAt: new Date(NOW.getTime() - 60_000) },
    ]);
    const api = createApi({ warehouses: [] });

    const view = await build(prisma, api).list('acc-1', CREDS, NOW);

    expect(api.post).not.toHaveBeenCalled();
    expect(view.warehouses.map((w) => w.name)).toEqual(['первомай']);
    expect(view.syncError).toBeNull();
  });

  it('устаревший снимок обновляется молча', async () => {
    const prisma = createPrisma([
      {
        warehouseId: PERVOMAY,
        name: 'первомай',
        syncedAt: new Date(NOW.getTime() - WAREHOUSE_CACHE_TTL_MS - 1),
      },
    ]);
    const api = createApi({
      warehouses: [
        { warehouse_id: PERVOMAY, name: 'первомай', status: 'created' },
        { warehouse_id: AMIR, name: 'амир', status: 'created' },
        { warehouse_id: EXPRESS, name: 'экспресс-первомай', status: 'created' },
      ],
    });

    const view = await build(prisma, api).list('acc-1', CREDS, NOW);

    expect(api.post).toHaveBeenCalledWith(CREDS, '/v2/warehouse/list');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(view.syncError).toBeNull();
  });

  it('идентификаторы складов не теряют точность', async () => {
    // У Ozon они шестнадцатизначные: 1 020 005 000 060 325. В базе BigInt,
    // наружу отдаём числом — проверяем, что по дороге ничего не округлилось.
    const prisma = createPrisma([
      { warehouseId: PERVOMAY, name: 'первомай', syncedAt: new Date(NOW.getTime() - 1000) },
    ]);
    const view = await build(prisma, createApi({ warehouses: [] })).list(
      'acc-1',
      CREDS,
      NOW,
    );

    expect(view.warehouses[0]?.id).toBe(PERVOMAY);
  });
});

describe('отказ площадки', () => {
  it('прежний снимок остаётся, ошибка показывается', async () => {
    const prisma = createPrisma([
      { warehouseId: PERVOMAY, name: 'первомай', syncedAt: new Date(2026, 0, 1) },
    ]);
    const api = createApi(new OzonApiError(429, 'Ozon ограничил частоту запросов.'));

    const view = await build(prisma, api).list('acc-1', CREDS, NOW);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(view.warehouses).toHaveLength(1);
    expect(view.syncError).toContain('частоту');
  });

  it('пустой ответ не стирает известные склады', async () => {
    // Чаще это временный отказ площадки, чем реальное отсутствие складов,
    // а без складов массовое изменение остатков перестаёт работать целиком.
    const prisma = createPrisma([
      { warehouseId: PERVOMAY, name: 'первомай', syncedAt: new Date(2026, 0, 1) },
    ]);
    const api = createApi({ warehouses: [] });

    const view = await build(prisma, api).sync('acc-1', CREDS, NOW);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(view.warehouses).toHaveLength(1);
    expect(view.syncError).toContain('пустой список');
  });

  it('у кабинета без складов пустой ответ — не ошибка', async () => {
    const prisma = createPrisma([]);
    const api = createApi({ warehouses: [] });

    const view = await build(prisma, api).sync('acc-1', CREDS, NOW);

    expect(view.warehouses).toEqual([]);
    expect(view.syncError).toBeNull();
  });
});

describe('разрешённые склады', () => {
  it('отдаёт только те, на которые можно писать', async () => {
    const prisma = createPrisma([]);
    prisma.ozonWarehouse.findMany.mockResolvedValue([
      { warehouseId: BigInt(PERVOMAY) },
      { warehouseId: BigInt(AMIR) },
    ]);

    const ids = await build(prisma, createApi({})).editableIds('acc-1');

    expect(ids.has(PERVOMAY)).toBe(true);
    expect(ids.has(AMIR)).toBe(true);
    expect(ids.has(EXPRESS)).toBe(false);
  });
});
