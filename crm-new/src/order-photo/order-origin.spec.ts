import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { OrderPhotoService } from './order-photo.service';
import DtoCreateOrder from './dto/create-order.dto';
import { DtoCreateLead } from './dto/create-lead.dto';
import {
  classifyHistoricalOrigin,
  MANUAL_DEFAULT_ORIGIN,
  originOf,
} from './order-origin';
import {
  planOriginBackfill,
  snapshotOf,
} from '../analytics/backfill/order-origin-backfill';

/**
 * Происхождение заказа (этап 17).
 *
 * Аудит 24.09.2026: заказ создаётся ровно в двух местах — заявка сайта
 * (`createLead`) и ручное создание в CRM (`createOrder`). Эти тесты стерегут
 * границу между ними: сайт не может назваться Avito, ручной заказ не может
 * притвориться сайтом, а старый заказ без доказательств остаётся UNKNOWN.
 */

type CreatedData = Record<string, unknown>;

function serviceWithTx() {
  const create = jest.fn(({ data }: { data: CreatedData }) => ({
    ...data,
    id: 'ord-new',
    numberOrder: '20260924-001',
    items: [],
    tshirtItems: [],
    canvasItems: [],
    executor: null,
  }));
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([{ max: 0 }]),
    orderPhoto: { create, findUnique: jest.fn().mockResolvedValue(null) },
    orderAssignment: { create: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const prisma = {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    orderPhoto: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    partnerSettings: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const push = { enqueueLead: jest.fn().mockResolvedValue(undefined) };
  const telegram = { sendToGroup: jest.fn().mockResolvedValue(undefined) };
  const partnerSettings = {
    get: jest.fn().mockResolvedValue({
      thermalTransferCost: 70,
      canvasDiscountBasisPoints: 0,
      maxLinkTemplate: 'https://max.ru/{phone}',
      leadMentionUsernames: '',
    }),
  };
  const service = new OrderPhotoService(
    prisma as never,
    {} as never,
    telegram as never,
    partnerSettings as never,
    {} as never,
    {} as never,
    push as never,
    {} as never,
  );
  return { service, create };
}

const lead = (over: Partial<DtoCreateLead> = {}) =>
  ({
    leadId: 'web-photo-0123456789abcdef0123456789abcdef',
    name: 'Клиент',
    phone: '+79990000000',
    productName: 'Фотопечать 10x15',
    quantity: 20,
    unitPrice: 20,
    total: 400,
    ...over,
  }) as DtoCreateLead;

const manual = (over: Partial<DtoCreateOrder> = {}): DtoCreateOrder =>
  ({
    communicationPlatform: 'AVITO',
    urlCommunication: 'https://www.avito.ru/chat/1',
    deliveryMethod: 'PICKUP',
    deliveryCost: 0,
    note: '',
    items: [
      {
        formatPaper: 'SIZE_10X15',
        typePaper: 'GLOSS',
        quantity: 10,
        price: 20,
      },
    ],
    ...over,
  }) as unknown as DtoCreateOrder;

describe('новые заказы: происхождение ставит сервер', () => {
  it('1. заявка с сайта → WEBSITE', async () => {
    const { service, create } = serviceWithTx();
    await service.createLead(lead());
    const data = create.mock.calls[0][0].data;
    expect(data.sourceOrder).toBe('WEBSITE');
  });

  it('2. заявка с сайта без рекламных меток — всё равно WEBSITE', async () => {
    const { service, create } = serviceWithTx();
    await service.createLead(
      lead({
        yclid: undefined,
        yandexClientId: undefined,
        pageUrl: undefined,
      }),
    );
    const data = create.mock.calls[0][0].data;
    expect(data.sourceOrder).toBe('WEBSITE');
    expect(data.yandexClientId ?? null).toBeNull();
  });

  it('3. заявка сайта не может назваться Avito', async () => {
    const { service, create } = serviceWithTx();
    await service.createLead({
      ...lead(),
      sourceOrder: 'AVITO',
    } as unknown as DtoCreateLead);
    expect(create.mock.calls[0][0].data.sourceOrder).toBe('WEBSITE');
    // поля источника у заявки нет в контракте вовсе — валидация его отбросит
    expect(Object.keys(new DtoCreateLead())).not.toContain('sourceOrder');
  });

  it('4. ручной заказ без выбранного источника → канал по умолчанию', async () => {
    const { service, create } = serviceWithTx();
    await service.createOrder(manual());
    expect(create.mock.calls[0][0].data.sourceOrder).toBe(
      MANUAL_DEFAULT_ORIGIN,
    );
    expect(MANUAL_DEFAULT_ORIGIN).toBe('AVITO');
  });

  it('5-6. выбранный источник сохраняется как есть', async () => {
    for (const source of ['AVITO', 'OZON', 'WB', 'LOCAL'] as const) {
      const { service, create } = serviceWithTx();
      await service.createOrder(manual({ sourceOrder: source }));
      expect(create.mock.calls[0][0].data.sourceOrder).toBe(source);
    }
  });

  it('7. произвольная строка источника не проходит валидацию (400)', async () => {
    const bad = plainToInstance(DtoCreateOrder, {
      ...manual(),
      sourceOrder: 'TIKTOK',
    });
    const errors = await validate(bad, { whitelist: true });
    expect(errors.map((e) => e.property)).toContain('sourceOrder');

    const ok = plainToInstance(DtoCreateOrder, manual({ sourceOrder: 'WB' }));
    expect(
      (await validate(ok, { whitelist: true })).map((e) => e.property),
    ).not.toContain('sourceOrder');
  });

  it('8. остальные поля создания не изменились', async () => {
    const { service, create } = serviceWithTx();
    await service.createLead(lead());
    const data = create.mock.calls[0][0].data;
    expect(data.status).toBe('LEAD');
    expect(data.externalRequestId).toBe(lead().leadId);
    expect(data.numberOrder).toEqual(expect.any(String));
  });
});

describe('историческая классификация', () => {
  const row = (
    sourceOrder: string | null,
    externalRequestId: string | null = null,
  ) => ({
    id: `id-${String(sourceOrder)}-${String(externalRequestId)}`,
    numberOrder: '20260801-001',
    sourceOrder,
    externalRequestId,
  });

  it('9. доказанная заявка сайта → WEBSITE', () => {
    const v = classifyHistoricalOrigin(
      row('LOCAL', 'web-photo-0123456789abcdef0123456789abcdef'),
    );
    expect(v.origin).toBe('WEBSITE');
    expect(v.proof).toBe('SITE_LEAD_ID');
    expect(v.changed).toBe(true);
  });

  it('10. сохранённый ручной канал остаётся собой', () => {
    for (const stored of ['AVITO', 'OZON', 'WB'] as const) {
      const v = classifyHistoricalOrigin(row(stored));
      expect(v.origin).toBe(stored);
      expect(v.proof).toBe('STORED_ORIGIN');
      expect(v.changed).toBe(false);
    }
  });

  it('11. неоднозначный заказ → UNKNOWN, а не «наверное Avito»', () => {
    const v = classifyHistoricalOrigin(row('LOCAL'));
    expect(v.origin).toBe('UNKNOWN');
    expect(v.proof).toBe('NOT_PROVEN');
    expect(v.reason).toMatch(/доказательства нет/);
  });

  it('11b. отсутствие рекламных меток ничего не доказывает', () => {
    expect(classifyHistoricalOrigin(row(null, 'web-photo-abc')).origin).toBe(
      'WEBSITE',
    );
    expect(classifyHistoricalOrigin(row(null)).origin).toBe('UNKNOWN');
  });

  it('12. конфликт не перетирается молча', () => {
    const v = classifyHistoricalOrigin(row('AVITO', 'web-photo-abc'));
    expect(v.proof).toBe('CONFLICT');
    expect(v.origin).toBe('AVITO');
    expect(v.changed).toBe(false);

    const plan = planOriginBackfill([row('AVITO', 'web-photo-abc')]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.changes).toHaveLength(0);
  });

  it('13-14. план ничего не пишет, повторное применение не меняет ничего', () => {
    const rows = [
      row('LOCAL', 'web-photo-1'),
      row('LOCAL', 'web-photo-2'),
      row('AVITO'),
      row('LOCAL'),
      row('OZON'),
    ];
    const plan = planOriginBackfill(rows);
    expect(plan.total).toBe(5);
    expect(plan.changes).toHaveLength(3);
    expect(plan.proposed.WEBSITE).toBe(2);
    expect(plan.proposed.AVITO).toBe(1);
    expect(plan.proposed.UNKNOWN).toBe(1);
    expect(plan.ambiguous).toBe(1);
    expect(rows.map((r) => r.sourceOrder)).toEqual([
      'LOCAL',
      'LOCAL',
      'AVITO',
      'LOCAL',
      'OZON',
    ]);

    const applied = rows.map((r) => {
      const change = plan.changes.find((c) => c.id === r.id);
      return change ? { ...r, sourceOrder: change.to } : r;
    });
    expect(planOriginBackfill(applied).changes).toHaveLength(0);
  });

  it('снимок хранит прежние значения ровно изменённых заказов', () => {
    const plan = planOriginBackfill([
      row('LOCAL', 'web-photo-1'),
      row('AVITO'),
    ]);
    expect(snapshotOf(plan)).toEqual([
      expect.objectContaining({ sourceOrder: 'LOCAL' }),
    ]);
  });

  it('неизвестное значение из базы честно становится UNKNOWN', () => {
    expect(originOf('TIKTOK')).toBe('UNKNOWN');
    expect(originOf(null)).toBe('UNKNOWN');
    expect(originOf('WEBSITE')).toBe('WEBSITE');
  });
});

/**
 * Скидка клиенту в рублях (24.09.2026).
 *
 * Проверяем не формулу — она своя в order-total.spec.ts, — а то, что заказ
 * сохраняется с ней: цена клиенту падает ровно на скидку, и сама скидка
 * ложится в заказ, иначе в карточке её никто не увидит.
 */
describe('скидка клиенту при создании заказа', () => {
  it('уменьшает сумму заказа и сохраняется в нём', async () => {
    const { service, create } = serviceWithTx();
    await service.createOrder(manual({ discountAmount: 50 }));
    const data = create.mock.calls[0][0].data;
    // Позиция: 10 шт × 20 ₽ = 200 ₽, самовывоз — доставки нет.
    expect(data.totalOrder).toBe(150);
    expect(data.discountAmount).toBe(50);
  });

  it('без скидки заказ считается как раньше', async () => {
    const { service, create } = serviceWithTx();
    await service.createOrder(manual());
    expect(create.mock.calls[0][0].data.totalOrder).toBe(200);
    expect(create.mock.calls[0][0].data.discountAmount).toBe(0);
  });

  it('скидка больше суммы товара обрезается, а не уводит чек в минус', async () => {
    const { service, create } = serviceWithTx();
    await service.createOrder(manual({ discountAmount: 10_000 }));
    expect(create.mock.calls[0][0].data.totalOrder).toBe(0);
    expect(create.mock.calls[0][0].data.discountAmount).toBe(200);
  });
});
