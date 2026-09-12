import type { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaApiError, type YandexMetrikaClient } from '../metrika-api.client';
import type { MetrikaUploading } from '../metrika.types';
import {
  MetrikaOrderOutboxProcessorService,
  type ClaimedRow,
} from './metrika-order-outbox-processor.service';

/**
 * Воркер очереди (этап 06, разделы 33–36, 60–62; FIX_01, разделы 1–7).
 *
 * База и клиент Метрики подменены: строки очереди живут в памяти, «захват»
 * воспроизводит правило выборки из SQL — pending, срок наступил и у заказа
 * нет более ранней незакрытой строки (pending/processing/failed). Клиент
 * отвечает по сценарию теста и запоминает, что ушло.
 */

type Row = ClaimedRow & {
  status: string;
  createdAt: Date;
  nextAttemptAt: Date;
  lastError?: string | null;
  skipReason?: string | null;
  remoteUploadingId?: string | null;
  apiValidationStatus?: string | null;
  elementsCount?: number | null;
  sentMetrikaStatus?: string | null;
  processedAt?: Date | null;
  responseCode?: number | null;
  lockedAt?: Date | null;
};

type HistoryRow = { id: string; fromStatus: string | null; toStatus: string; createdAt: Date };

const T0 = new Date('2026-09-11T15:30:00Z');
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);

const ORDER = {
  id: 'order-1',
  createdAt: T0,
  yandexClientId: '17263548291736450123',
  totalOrder: 1500,
  productCategory: 'PHOTO',
  items: [
    { formatPaper: '10x15', quantity: 50, pricePosition: 1200, printOnClientItem: false, thermalCost: 0 },
  ],
  tshirtItems: [],
  canvasItems: [],
};

const UNRESOLVED = new Set(['pending', 'processing', 'failed']);
const earlier = (a: Row, b: Row) =>
  a.createdAt.getTime() < b.createdAt.getTime() ||
  (a.createdAt.getTime() === b.createdAt.getTime() && a.id < b.id);

interface HarnessOptions {
  order?: Record<string, unknown> | null;
  /** Строки очереди; createdAt по порядку массива, если не задан. */
  rows?: Partial<Row>[];
  history?: HistoryRow[];
}

function harness(opts: HarnessOptions = {}) {
  const history: HistoryRow[] = opts.history ?? [
    { id: 'h1', fromStatus: 'LEAD', toStatus: 'NEW', createdAt: at(10) },
    { id: 'h2', fromStatus: 'NEW', toStatus: 'PAID', createdAt: at(20) },
  ];
  const rows: Row[] = (opts.rows ?? [{ id: 'r1' }]).map((r, i) => ({
    id: 'r?',
    orderId: 'order-1',
    targetMetrikaStatus: 'PAID',
    sourceStatusHistoryId: null,
    attemptCount: 0,
    status: 'pending',
    createdAt: at(100 + i),
    nextAttemptAt: new Date(0),
    ...r,
  }));
  const order = opts.order === undefined ? ORDER : opts.order;

  const claimable = (r: Row) =>
    r.status === 'pending' &&
    r.nextAttemptAt.getTime() <= Date.now() &&
    !rows.some((e) => e.orderId === r.orderId && e.id !== r.id && UNRESOLVED.has(e.status) && earlier(e, r));

  const claim = (filter: (r: Row) => boolean, limit: number): ClaimedRow[] => {
    const picked = rows
      .filter((r) => claimable(r) && filter(r))
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime() || (earlier(a, b) ? -1 : 1))
      .slice(0, limit);
    for (const r of picked) {
      r.status = 'processing';
      r.lockedAt = new Date();
    }
    return picked.map(({ id, orderId, targetMetrikaStatus, sourceStatusHistoryId, attemptCount }) => ({
      id,
      orderId,
      targetMetrikaStatus,
      sourceStatusHistoryId,
      attemptCount,
    }));
  };

  const prisma = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('o."id" = ?')) return claim((r) => r.id === values[0], 1);
      return claim(() => true, Number(values[0]));
    }),
    orderPhoto: {
      // id заказа — из запроса: в тестах с двумя заказами файлы должны различаться.
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        order ? { ...order, id: where.id, statusHistory: history } : null,
      ),
    },
    partnerSettings: { findUnique: jest.fn(async () => null) },
    statusHistory: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const h = history.find((x) => x.id === where.id);
        return h ? { createdAt: h.createdAt } : null;
      }),
    },
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

  const uploads: { csv: string; status: string; mergeMode: string }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let uploadDelayMs = 0;
  const client = {
    isConfigured: () => true,
    getCounter: jest.fn(async () => ({ id: 111569944, time_zone_name: 'Europe/Moscow' })),
    uploadSimpleOrders: jest.fn(async (csv: string, mergeMode: string): Promise<MetrikaUploading> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (uploadDelayMs) await new Promise((r) => setTimeout(r, uploadDelayMs));
      inFlight -= 1;
      uploads.push({ csv, status: csv.trim().split('\n')[1].split(',')[6], mergeMode });
      return { uploading_id: `up-${uploads.length}`, api_validation_status: 'PASSED', elements_count: 1 };
    }),
  };

  const makeProcessor = () =>
    new MetrikaOrderOutboxProcessorService(
      prisma as unknown as PrismaService,
      client as unknown as YandexMetrikaClient,
      { syncEnabled: true },
    );

  return {
    rows,
    prisma,
    client,
    uploads,
    processor: makeProcessor(),
    makeProcessor,
    sentStatuses: () => uploads.map((u) => u.status),
    setUploadDelay: (ms: number) => {
      uploadDelayMs = ms;
    },
    maxInFlight: () => maxInFlight,
    /** Прогоняем воркер, пока очередь заказа не опустеет (или не встанет). */
    drain: async (p = makeProcessor(), ticks = 10) => {
      for (let i = 0; i < ticks; i += 1) {
        for (const r of rows) if (r.status === 'pending') r.nextAttemptAt = new Date(0);
        const out = await p.processOnce();
        if (out.length === 0) break;
      }
    },
  };
}

const apiError = (kind: MetrikaApiError['kind'], status: number) =>
  new MetrikaApiError(kind, status, `ошибка ${kind}`);

const row = (id: string, target: string, extra: Partial<Row> = {}): Partial<Row> => ({
  id,
  targetMetrikaStatus: target,
  ...extra,
});

describe('успешная отправка', () => {
  it('один заказ — один файл: id заказа, дата в поясе счётчика, статус перехода, SAVE; строка delivered с uploading_id', async () => {
    const h = harness({ rows: [row('r1', 'PAID', { sourceStatusHistoryId: 'h2' })] });
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
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { orderId: 'order-1' }), row('r2', 'IN_PROGRESS', { orderId: 'order-2' })],
    });
    await h.processor.processOnce();
    expect(h.client.getCounter).toHaveBeenCalledTimes(1);
    expect(h.uploads).toHaveLength(2);
  });

  it('отправляется статус ПЕРЕХОДА, а не текущее состояние заказа (FIX_01 § 1–2)', async () => {
    // Заказ уже PAID, но строка появилась на переходе LEAD → NEW.
    const h = harness({ rows: [row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' })] });
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS']);
    expect(h.rows[0].sentMetrikaStatus).toBe('IN_PROGRESS');
  });

  it('идемпотентность: та же строка второй раз не берётся; повтор заказа — тот же id в файле', async () => {
    const h = harness({ rows: [row('r1', 'PAID')] });
    await h.processor.processOnce();
    expect(await h.processor.processById('r1')).toBeNull();
    h.rows.push({
      id: 'r2',
      orderId: 'order-1',
      targetMetrikaStatus: 'PAID',
      sourceStatusHistoryId: null,
      attemptCount: 0,
      status: 'pending',
      createdAt: at(200),
      nextAttemptAt: new Date(0),
    });
    await h.processor.processOnce();
    expect(h.uploads).toHaveLength(2);
    expect(h.uploads[1].csv).toBe(h.uploads[0].csv);
  });
});

describe('порядок переходов одного заказа (FIX_01 § 4–7)', () => {
  it('A: LEAD→NEW и NEW→PAID до первого тика — уходят IN_PROGRESS, затем PAID', async () => {
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' }), row('r2', 'PAID', { sourceStatusHistoryId: 'h2' })],
    });
    const first = await h.processor.processOnce();
    expect(first).toHaveLength(1); // вторая ждёт, пока первая не закрыта
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS']);
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS', 'PAID']);
  });

  it('B: NEW→CANCELLED до тика — IN_PROGRESS, затем CANCELLED', async () => {
    const h = harness({
      history: [
        { id: 'h1', fromStatus: 'LEAD', toStatus: 'NEW', createdAt: at(10) },
        { id: 'h3', fromStatus: 'NEW', toStatus: 'CANCELLED', createdAt: at(30) },
      ],
      rows: [row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' }), row('r2', 'CANCELLED', { sourceStatusHistoryId: 'h3' })],
    });
    await h.drain();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS', 'CANCELLED']);
  });

  it('C: NEW→PAID→CANCELLED — три статуса строго по порядку, ни один не заменён текущим', async () => {
    const h = harness({
      history: [
        { id: 'h1', fromStatus: 'LEAD', toStatus: 'NEW', createdAt: at(10) },
        { id: 'h2', fromStatus: 'NEW', toStatus: 'PAID', createdAt: at(20) },
        { id: 'h3', fromStatus: 'PAID', toStatus: 'CANCELLED', createdAt: at(30) },
      ],
      rows: [
        row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' }),
        row('r2', 'PAID', { sourceStatusHistoryId: 'h2' }),
        row('r3', 'CANCELLED', { sourceStatusHistoryId: 'h3' }),
      ],
    });
    await h.drain();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS', 'PAID', 'CANCELLED']);
    expect(h.rows.map((r) => r.status)).toEqual(['delivered', 'delivered', 'delivered']);
  });

  it('D: CANCELLED→NEW (reopen) — новый IN_PROGRESS на том же OrderPhoto.id', async () => {
    const h = harness({
      history: [
        { id: 'h1', fromStatus: 'LEAD', toStatus: 'NEW', createdAt: at(10) },
        { id: 'h3', fromStatus: 'NEW', toStatus: 'CANCELLED', createdAt: at(30) },
        { id: 'h4', fromStatus: 'CANCELLED', toStatus: 'NEW', createdAt: at(40) },
      ],
      rows: [
        row('r1', 'IN_PROGRESS', { status: 'delivered', sourceStatusHistoryId: 'h1' }),
        row('r2', 'CANCELLED', { status: 'delivered', sourceStatusHistoryId: 'h3' }),
        row('r3', 'IN_PROGRESS', { sourceStatusHistoryId: 'h4' }),
      ],
    });
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS']);
    expect(h.uploads[0].csv.split('\n')[1].startsWith('order-1,')).toBe(true);
  });

  it('E: первый переход временно падает (503) — PAID ждёт; после успешного повтора порядок IN_PROGRESS → PAID', async () => {
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' }), row('r2', 'PAID', { sourceStatusHistoryId: 'h2' })],
    });
    h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError('server', 503));
    let out = await h.processor.processOnce();
    expect(out.map((o) => o.result)).toEqual(['retry']);
    expect(h.sentStatuses()).toEqual([]);
    // Пока r1 pending с паузой — r2 не берётся вовсе.
    out = await h.processor.processOnce();
    expect(out).toEqual([]);
    // Пауза прошла — повтор r1, затем r2.
    await h.drain();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS', 'PAID']);
  });

  it('F: первый переход failed навсегда (валидация) — PAID заблокирован до действия оператора', async () => {
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' }), row('r2', 'PAID', { sourceStatusHistoryId: 'h2' })],
    });
    h.client.uploadSimpleOrders.mockResolvedValueOnce({
      uploading_id: 'up-bad',
      api_validation_status: 'FAILED',
      elements_count: 0,
    });
    await h.drain();
    expect(h.rows[0].status).toBe('failed');
    expect(h.rows[1].status).toBe('pending');
    expect(h.sentStatuses()).toEqual([]);
    expect(await h.processor.processById('r2')).toBeNull(); // и вручную порядок не обойти
    // Оператор: requeue первой строки — очередь оживает и идёт по порядку.
    h.rows[0].status = 'pending';
    await h.drain();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS', 'PAID']);
  });

  it('F2: оператор снимает failed-строку (skipped) — следующая уходит', async () => {
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { status: 'failed' }), row('r2', 'PAID', { sourceStatusHistoryId: 'h2' })],
    });
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual([]);
    h.rows[0].status = 'skipped';
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual(['PAID']);
  });

  it('G: два воркера одновременно — у одного заказа никогда нет двух статусов в полёте', async () => {
    const h = harness({
      rows: [
        row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1' }),
        row('r2', 'PAID', { sourceStatusHistoryId: 'h2' }),
        row('r3', 'IN_PROGRESS', { orderId: 'order-2' }),
      ],
    });
    h.setUploadDelay(20);
    const a = h.makeProcessor();
    const b = h.makeProcessor();
    await Promise.all([a.processOnce(), b.processOnce()]);
    // Два заказа могли лететь параллельно, но r2 (тот же заказ, что r1) — нет.
    expect(h.maxInFlight()).toBeLessThanOrEqual(2);
    expect(h.sentStatuses().filter((s) => s === 'PAID')).toEqual([]);
    expect(h.rows.find((r) => r.id === 'r2')!.status).toBe('pending');
    await Promise.all([a.processOnce(), b.processOnce()]);
    const order1 = h.uploads.filter((u) => u.csv.includes('order-1,')).map((u) => u.status);
    expect(order1).toEqual(['IN_PROGRESS', 'PAID']);
  });

  it('старый повтор не откатывает новый статус: пока ранняя строка не закрыта, поздняя не отправляется вовсе', async () => {
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { sourceStatusHistoryId: 'h1', nextAttemptAt: at(10_000_000) }), row('r2', 'PAID')],
    });
    const out = await h.processor.processOnce();
    expect(out).toEqual([]);
    expect(h.sentStatuses()).toEqual([]);
  });

  it('разные заказы друг друга не ждут', async () => {
    const h = harness({
      rows: [row('r1', 'IN_PROGRESS', { status: 'failed' }), row('r2', 'IN_PROGRESS', { orderId: 'order-2' })],
    });
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS']);
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
      history: [{ id: 'h9', fromStatus: 'LEAD', toStatus: 'CANCELLED', createdAt: at(10) }],
      rows: [row('r1', 'CANCELLED', { sourceStatusHistoryId: 'h9' })],
    });
    await h.processor.processOnce();
    expect(h.rows[0]).toMatchObject({ status: 'skipped', skipReason: 'not_eligible_rejected_lead' });
    expect(h.uploads).toHaveLength(0);
  });

  it('право решает история ДО перехода: отклонённая заявка, позже возвращённая в работу — отмена всё равно пропускается, а IN_PROGRESS уходит', async () => {
    const h = harness({
      history: [
        { id: 'h9', fromStatus: 'LEAD', toStatus: 'CANCELLED', createdAt: at(10) },
        { id: 'h10', fromStatus: 'CANCELLED', toStatus: 'NEW', createdAt: at(20) },
      ],
      rows: [row('r1', 'CANCELLED', { sourceStatusHistoryId: 'h9' }), row('r2', 'IN_PROGRESS', { sourceStatusHistoryId: 'h10' })],
    });
    await h.drain();
    expect(h.rows[0]).toMatchObject({ status: 'skipped', skipReason: 'not_eligible_rejected_lead' });
    expect(h.sentStatuses()).toEqual(['IN_PROGRESS']);
  });

  it('правило C: отмена без истории, но заказ уже доставлялся раньше — отправляется', async () => {
    const h = harness({
      history: [],
      rows: [row('r0', 'IN_PROGRESS', { status: 'delivered' }), row('r1', 'CANCELLED')],
    });
    await h.processor.processOnce();
    expect(h.sentStatuses()).toEqual(['CANCELLED']);
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
    const h = harness({ rows: [row('r1', 'PAID', { attemptCount: 19 })] });
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
  it('падение строки одного заказа не мешает другому заказу', async () => {
    const h = harness({ rows: [row('r1', 'PAID'), row('r2', 'PAID', { orderId: 'order-2' })] });
    h.client.uploadSimpleOrders.mockRejectedValueOnce(apiError('server', 500));
    const outcomes = await h.processor.processOnce();
    expect(outcomes.map((o) => o.result)).toEqual(['retry', 'delivered']);
  });

  it('перед захватом зависшие processing возвращаются в очередь', async () => {
    const h = harness();
    await h.processor.processOnce();
    expect(h.prisma.$executeRaw).toHaveBeenCalledTimes(1);
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
