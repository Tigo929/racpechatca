import { ApprovalService } from './approval.service';

/**
 * Размер печати считается из раскладки, а не вводится руками.
 *
 * Размер называют клиенту до печати — «принт будет 20 × 25 см». Пока
 * сантиметры набирали в отдельном поле, они описывали не макет, а то, что
 * человек успел напечатать: разложил принт, забыл поправить число — и
 * клиенту ушёл один размер, а печатнику другой. Расходятся они молча.
 *
 * Проверяем обе двери, через которые размер попадает в базу: загрузку
 * принта и сохранение раскладки.
 */

/** Зона печати 720 × 900 px равна 40 × 50 см — та же калибровка, что в ТЗ. */
const TEMPLATE = {
  key: 'tshirt_black_front',
  imageFile: 'mockup.webp',
  printAreaX: 420,
  printAreaY: 380,
  printAreaWidth: 720,
  printAreaHeight: 900,
  printAreaWidthMm: 400,
  printAreaHeightMm: 500,
};

type Saved = Record<string, unknown>;

function build(stored: unknown) {
  const update = jest.fn().mockImplementation((args: { data: Saved }) => ({
    id: 'a1',
    version: 1,
    status: 'DRAFT',
    sides: args.data.sides ?? stored,
    shirtColor: 'Чёрный',
    shirtSize: 'M',
    updatedAt: new Date(),
    finalizedAt: null,
    order: { items: [], tshirtItems: [] },
  }));
  const prisma = {
    printApproval: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'a1',
        orderId: 'o1',
        itemId: null,
        status: 'DRAFT',
        shirtColor: 'Чёрный',
        sides: stored,
        updatedAt: new Date(),
        finalizedAt: null,
      }),
      update,
    },
  };
  const storage = {
    savePrint: jest.fn().mockResolvedValue({
      filename: 'print-new.webp',
      // Исходник 2:3 — пропорции принта берутся от него.
      sourceWidth: 1000,
      sourceHeight: 1500,
    }),
    removePrint: jest.fn(),
  };
  const service = new ApprovalService(
    prisma as never,
    storage as never,
    {} as never,
    { findByColorAndSide: jest.fn().mockResolvedValue(TEMPLATE) } as never,
  );
  return { service, update };
}

/** Сторона, как она легла в базу после вызова. */
function savedSide(update: jest.Mock, side = 'FRONT'): Record<string, number> {
  const call = (update.mock.calls[0] as { data: Saved }[])[0];
  return (call.data.sides as Record<string, Record<string, number>>)[side];
}

const placed = (viewWidth: number, viewHeight: number) => ({
  FRONT: {
    templateKey: TEMPLATE.key,
    printFile: 'print.webp',
    printOriginalName: 'logo.png',
    printWidthPx: 1000,
    printHeightPx: 1500,
    widthMm: 280,
    heightMm: 350,
    viewWidth,
    viewHeight,
    lockRatio: true,
    x: 0.5,
    y: 0.5,
    rotation: 0,
  },
});

describe('размер при загрузке принта', () => {
  it('считается от зоны печати, а не от умолчания в 28 см', async () => {
    const { service, update } = build({});

    await service.uploadPrint('a1', 'FRONT' as never, {
      originalname: 'logo.png',
    } as never);

    const side = savedSide(update);
    // Экранная доля, выставленная при загрузке, переведена в сантиметры зоны.
    expect(side.widthMm).toBe(Math.round(side.viewWidth * 400 * 10) / 10);
    expect(side.heightMm).toBe(Math.round(side.viewHeight * 500 * 10) / 10);
    expect(side.widthMm).not.toBe(280);
  });

  it('пропорции принта сохраняются — картинку не растягивает', async () => {
    const { service, update } = build({});

    await service.uploadPrint('a1', 'FRONT' as never, {
      originalname: 'logo.png',
    } as never);

    const side = savedSide(update);
    // Исходник 1000 × 1500: высота в полтора раза больше ширины.
    expect(side.heightMm / side.widthMm).toBeCloseTo(1.5, 2);
  });
});

describe('размер при сохранении раскладки', () => {
  it('идёт следом за картинкой', async () => {
    const { service, update } = build(placed(0.5, 0.4));

    // Принт растянули мышкой вдвое — сантиметры обязаны вырасти вместе с ним.
    await service.update('a1', { sides: placed(1, 0.8) } as never);

    expect(savedSide(update)).toMatchObject({ widthMm: 400, heightMm: 400 });
  });

  it('записанный размер не переопределяет раскладку', async () => {
    const { service, update } = build(placed(0.25, 0.2));

    // В присланном состоянии размер «из прошлого» — верить надо картинке.
    const sides = placed(0.25, 0.2);
    sides.FRONT.widthMm = 999;
    sides.FRONT.heightMm = 999;
    await service.update('a1', { sides } as never);

    expect(savedSide(update)).toMatchObject({ widthMm: 100, heightMm: 100 });
  });

  it('у согласования без раскладки размер остаётся прежним', async () => {
    // viewWidth = 0 — макет старше правки: пересчёт обнулил бы размер,
    // который клиент уже согласовал.
    const { service, update } = build(placed(0, 0));

    await service.update('a1', { sides: placed(0, 0) } as never);

    expect(savedSide(update)).toMatchObject({ widthMm: 280, heightMm: 350 });
  });
});
