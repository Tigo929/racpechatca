import type { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaApiError, type YandexMetrikaClient } from '../metrika-api.client';
import type { MetrikaUploading } from '../metrika.types';
import {
  MetrikaOrderOutboxProcessorService,
  type ClaimedRow,
} from './metrika-order-outbox-processor.service';

/**
 * Воркер очереди (этап 06, разделы 33–36, 60–62).
 *
 * База и клиент Метрики подменены: строки очереди живут в памяти, «захват»
 * отдаёт pending-строки со сроком, клиент отвечает по сценарию теста.
 */

type Row = ClaimedRow & {
  status: string;
  nextAttemptAt: Date;
  lastError?: string | null;
  skipReason?: string | null;
  remoteUploadingId?: string | null;
  apiValidationStatus?: string | null;
  elementsCount?: number | null;
  sentMetrikaStatus?: string | null;
  processedAt?: Date | null;
  responseCode?: number | null;
};

const ORDER = {
  id: 'order-1',
  createdAt: new Date('2026-09-11T15:30:00Z'),
  status: 'PAID',
  yandexClientId: '17263548291736450123',
  totalOrder: 1500,
  productCategory: 'PHOTO',
  items: [
    { formatPaper: '10x15', quantity: 50, pricePosition: 1200, printOnClientItem: false, thermalCost: 0 },
  ],
  tshirtItems: [],
  canvasItems: [],
  statusHistory: [
    { fromStatus: 'LEAD', toStatus: 'NEW' },
    { fromStatus: 'NEW', toStatus: 'PAID' },
  ],
};

function harness(opts: { order?: Record<string, unknown> | null; rows?: Partial<Row>[] } = {}) {
  const rows: Row[] = (opts.rows ?? [{ id: 'r1' }]).map((r) => ({
    id: 'r?',
    orderId: 'order-1',
    targetMetrikaStatus: 'PAID',
    attemptCount: 0,
    status: 'pending',
    nextAttemptAt: new Date(0),
    ...r,
  }));
  const order = opts.order === undefined ? ORDER : opts.order;

  const claim = (filter: (r: Row) => boolean, limit: number): ClaimedRow[] => {
    const picked = rows.filter((r) => r.status === 'pending' && filter(r)).slice(0, limit);
    for (const r of picked) r.status = 'processing';
    return picked.map(({ id, orderId, targetMetrikaStatus, attemptCount }) => ({
      id,
      orderId,
      targetMetrikaStatus,
      attemptCount,
    }));
  };

  const prisma = {
    // Захват: разбираем шаблон по наличию "id" = $1 (processById) или LIMIT.
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('WHERE "id" = ?')) {
        return claim((r) => r.id === values[0], 1);
      }
      return claim((r) => r.nextAttemptAt.getTime() <= Date.now(), Number(values[0]));
    }),
    orderPhoto: { findUnique: jest.fn(async () => order) },
    partnerSettings: { findUnique: jest.fn(async () => null) },
    metrikaOrderOutbox: {
      count: jest.fn(async ({ where }: { where: { orderId: string; status: string } }) =>
        rows.filter((r) => r.orderId === where.orderId && r.status === where.status).length,
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
  };

  const uploads: { csv: string; mergeMode: string }[] = [];
  const client = {
    isConfigured: () => true,
    getCounter: jest.fn(async () => ({ id: 111569944, time_zone_name: 'Europe/Moscow' })),
    uploadSimpleOrders: jest.fn(async (csv: string, mergeMode: string): Promise<MetrikaUploading> => {
      uploads.push({ csv, mergeMode });
      return { uploading_id: 'up-1', api_validation_status: 'PASSED', elements_count: 1 };
    }),
  };

  const processor = new MetrikaOrderOutboxProcessorService(
    prisma as unknown as PrismaService,
    client as unknown as YandexMetrikaClient,
    { syncEnabled: true },
  );
  return { rows, prisma, client, uploads, processor };
}

const apiError = (kind: MetrikaApiError['kind'], status: number) =>
  new MetrikaApiError(kind, status, `ошибка ${kind}`);

describe('успешная отправка', () => {
  it('один заказ — один файл: id заказа, дата в поясе счётчика, SAVE; строка delivered с uploading_id', async () => {
    const h = harness();
    const outcomes = await h.processor.processOnce();
    expect(outcomes).toEqual([
      { result: 'delivered', status: 'PAID', uploadingId: 'up-1', elementsCount: 1, durationMs: expect.any(Number) },
    ]);
    expect(h.uploads).toHaveLength(1);
    expect(h.uploads[0].mergeMode).toBe('SAVE');
    const [header, line] = h.uploads[0].csv.trim().split('\n');
    expect(header).toBe(
      'id,create_date_time,client_uniq_id,client_ids,emails,phones,order_status,revenue,cost,goals,currency',
    );
    expect(line).toBe('order-1,2026-09-11 18:30:00,,17263548291736450123,,,PAID,1500,80,,RUB');
    expect(h.rows[0]).toMatchObject({
      status: 'delivered',
      attemptCount: 1,
      remoteUploadingId: 'up-1',
      apiValidationStatus: 'PASSED',
      elementsCount: 1,
      sentMetrikaStatus: 'PAID',
      responseCode: 200,
      lastError: null,
    });
    expect(h.rows[0].processedAt).toBeInstanceOf(Date);
  });

  it('часовой пояс читается из счётчика один раз на процесс', async () => {
    const h = harness({ rows: [{ id: 'r1' }, { id: 'r2' }] });
    await h.processor.processOnce();
    expect(h.client.getCounter).toHaveBeenCalledTimes(1);
    expect(h.uploads).toHaveLength(2);
  });

  it('отправляется текущее состояние заказа, а не то, ради чего строка появилась', async () => {
    // Строка появилась на переходе в NEW (IN_PROGRESS), но заказ уже оплачен.
    const h = harness({ rows: [{ id: 'r1', targetMetrikaStatus: 'IN_PROGRESS' }] });
    await h.processor.processOnce();
    expect(h.uploads[0].csv).toContain(',PAID,');
    expect(h.rows[0].sentMetrikaStatus).toBe('PAID');
  });

  it('идемпотентность: та же строка второй раз не берётся (уже не pending), заказ уходит с тем же id', async () => {
    const h = harness();
    await h.processor.processOnce();
    expect(await h.processor.processById('r1')).toBeNull();
    // Повторная отправка того же заказа (новая строка) — тот же OrderPhoto.id в файле.
    h.rows.push({
      id: 'r2',
      orderId: 'order-1',
      targetMetrikaStatus: 'PAID',
      attemptCount: 0,
      status: 'pending',
      nextAttemptAt: new Date(0),
    });
    await h.processor.processOnce();
    expect(h.uploads).toHaveLength(2);
    expect(h.uploads[1].csv.split('\n')[1].startsWith('order-1,')).toBe(true);
    expect(h.uploads[1].csv).toBe(h.uploads[0].csv);
  });
});

describe('пропуски', () => {
  it('без ClientID — skipped/no_client_id, в Метрику ничего не уходит', async () => {
    const h = harness({ order: { ...ORDER, yandexClientId: null } });
    const outcomes = await h.processor.processOnce();
    expect(outcomes).toEqual([{ result: 'skipped', reason: 'no_client_id' }]);
    expect(h.uploads).toHaveLength(0);
    expect(h.rows[0]).toMatchObject({ status: 'skipped', skipReason: 'no_client_id' });
  });

  it('отклонённая заявка LEAD → CANCELLED — skipped/not_eligible_rejected_lead', async () => {
    const h = harness({
      order: {
        ...ORDER,
        status: 'CANCELLED',
        statusHistory: [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }],
      },
      rows: [{ id: 'r1', targetMetrikaStatus: 'CANCELLED' }],
    });
    await h.processor.processOnce();
    expect(h.rows[0]).toMatchObject({ status: 'skipped', skipReason: 'not_eligible_rejected_lead' });
    expect(h.uploads).toHaveLength(0);
  });

  it('правило C: отменённый заказ без истории, но уже доставленный раньше, — отправляется', async () => {
    const h = harness({
      order: { ...ORDER, status: 'CANCELLED', statusHistory: [] },
      rows: [
        { id: 'r0', status: 'delivered' },
        { id: 'r1', targetMetrikaStatus: 'CANCELLED' },
      ],
    });
    await h.processor.processOnce();
    expect(h.uploads).toHaveLength(1);
    expect(h.uploads[0].csv).toContain(',CANCELLED,');
  });

  it('заказ удалён — failed окончательно', async () => {
    const h = harness({ order: null });
    const [o] = await h.processor.processOnce();
    expect(o).toMatchObject({ result: 'failed', permanent: true });
    expect(h.rows[0].status).toBe('failed');
  });
});

describe('ошибки и повторы', () => {
  it.each([
    ['rate_limited', 429],
    ['server', 500],
    ['timeout', 0],
    ['network', 0],
  ] as const)('%s (HTTP %s) — строка возвращается в pending с паузой, попытка учтена', async (kind, status) => {
    const h = harness();
    h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError(kind, status));
    const before = Date.now();
    const [o] = await h.processor.processOnce();
    expect(o.result).toBe('retry');
    expect(h.rows[0]).toMatchObject({ status: 'pending', attemptCount: 1 });
    expect(h.rows[0].nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(h.rows[0].lastError).toContain(kind);
  });

  it('паузы растут: минута, пять, пятнадцать, час, шесть часов', async () => {
    const h = harness();
    const expected = [60, 300, 900, 3600, 21600, 21600];
    for (const sec of expected) {
      h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError('server', 503));
      h.rows[0].nextAttemptAt = new Date(0);
      const before = Date.now();
      await h.processor.processOnce();
      const delay = h.rows[0].nextAttemptAt.getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(sec * 1000);
      expect(delay).toBeLessThan(sec * 1000 + 5000);
    }
  });

  it('после двадцатой попытки — failed, строка остаётся', async () => {
    const h = harness({ rows: [{ id: 'r1', attemptCount: 19 }] });
    h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError('server', 502));
    const [o] = await h.processor.processOnce();
    expect(o).toMatchObject({ result: 'failed', permanent: false });
    expect(h.rows[0]).toMatchObject({ status: 'failed', attemptCount: 20 });
  });

  it.each([
    ['http', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
  ] as const)('%s (HTTP %s) — сразу failed, без повторов, строка хранит ошибку и код', async (kind, status) => {
    const h = harness();
    h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError(kind, status));
    const [o] = await h.processor.processOnce();
    expect(o).toMatchObject({ result: 'failed', permanent: true });
    expect(h.rows[0]).toMatchObject({ status: 'failed', attemptCount: 1, responseCode: status });
    expect(h.rows[0].lastError).toContain(kind);
  });

  it('api_validation_status=FAILED — failed без повторов, uploading_id сохранён', async () => {
    const h = harness();
    h.client.uploadSimpleOrders.mockResolvedValueOnce({
      uploading_id: 'up-bad',
      api_validation_status: 'FAILED',
      elements_count: 0,
    });
    const [o] = await h.processor.processOnce();
    expect(o).toMatchObject({ result: 'failed', permanent: true, error: 'api_validation_status=FAILED' });
    expect(h.rows[0]).toMatchObject({
      status: 'failed',
      remoteUploadingId: 'up-bad',
      apiValidationStatus: 'FAILED',
    });
  });

  it('не настроено (нет токена) — строка откладывается на час, попытка не тратится', async () => {
    const h = harness();
    h.client.getCounter.mockRejectedValueOnce(apiError('not_configured', 0));
    const before = Date.now();
    const [o] = await h.processor.processOnce();
    expect(o.result).toBe('retry');
    expect(h.rows[0]).toMatchObject({ status: 'pending', attemptCount: 0 });
    expect(h.rows[0].nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before + 3600_000);
  });

  it('счётчик без пригодного часового пояса — отправка не идёт, повтор позже (Москву не предполагаем)', async () => {
    const h = harness();
    h.client.getCounter.mockResolvedValueOnce({ id: 111569944, time_zone_name: 'Nowhere/Town' });
    const [o] = await h.processor.processOnce();
    expect(o.result).toBe('retry');
    expect(h.uploads).toHaveLength(0);
    expect(h.rows[0].lastError).toContain('часовой пояс');
  });
});

describe('изоляция сбоев', () => {
  it('падение одной строки не мешает следующей', async () => {
    const h = harness({ rows: [{ id: 'r1' }, { id: 'r2' }] });
    h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError('server', 500));
    const outcomes = await h.processor.processOnce();
    expect(outcomes.map((o) => o.result)).toEqual(['retry', 'delivered']);
  });

  it('воркер не запускается, если отправка выключена рубильником', () => {
    const h = harness();
    const quiet = new MetrikaOrderOutboxProcessorService(
      h.prisma as unknown as PrismaService,
      h.client as unknown as YandexMetrikaClient,
      { syncEnabled: false },
    );
    const spy = jest.spyOn(global, 'setInterval');
    quiet.onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
