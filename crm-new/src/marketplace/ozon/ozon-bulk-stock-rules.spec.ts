import {
  buildPairs,
  BulkStockValidationError,
  checkQuantity,
  chunkPairs,
  MIN_PAIR_INTERVAL_MS,
  needsStrongConfirm,
  normalizeOfferIds,
  normalizeWarehouses,
  OZON_STOCK_CHUNK,
  waitBeforeRetryMs,
  zeroingCount,
} from './ozon-bulk-stock-rules';

/** Настоящие склады кабинета — из шаблона обновления остатков, 25.08.2026. */
const PERVOMAY = 1020005000060325;
const AMIR = 1020005027898150;
const EXPRESS = 1020005028012630;
const ALLOWED = new Set([PERVOMAY, AMIR, EXPRESS]);

describe('количество', () => {
  it('ноль разрешён — это штатный способ снять товар с продажи', () => {
    expect(() => checkQuantity(0)).not.toThrow();
  });

  it('дробное и отрицательное не принимаются', () => {
    expect(() => checkQuantity(1.5)).toThrow(BulkStockValidationError);
    expect(() => checkQuantity(-1)).toThrow(BulkStockValidationError);
  });

  it('неправдоподобно большое отбивается как опечатка', () => {
    expect(() => checkQuantity(1_000_000)).toThrow(/опечатку/);
  });
});

describe('артикулы', () => {
  it('пустые и повторы убираются', () => {
    expect(normalizeOfferIds([' JDM-1-1-black-S ', 'JDM-1-1-black-S', '', '  '])).toEqual([
      'JDM-1-1-black-S',
    ]);
  });

  it('регистр не трогается', () => {
    // offer_id у Ozon регистрозависим: «JDM-1» и «jdm-1» — разные товары,
    // и приведение к нижнему регистру отправило бы остаток не туда.
    expect(normalizeOfferIds(['JDM-1', 'jdm-1'])).toEqual(['JDM-1', 'jdm-1']);
  });

  it('пустой выбор — ошибка', () => {
    expect(() => normalizeOfferIds([])).toThrow(/ни один товар/);
  });
});

describe('склады', () => {
  it('чужой или выключенный склад не принимается', () => {
    // Выбор приходит из браузера, верить ему нельзя.
    expect(() =>
      normalizeWarehouses([{ warehouseId: 1, quantity: 5 }], ALLOWED),
    ).toThrow(/недоступен/);
  });

  it('повтор склада схлопывается', () => {
    const list = normalizeWarehouses(
      [
        { warehouseId: PERVOMAY, quantity: 25 },
        { warehouseId: PERVOMAY, quantity: 40 },
      ],
      ALLOWED,
    );
    expect(list).toEqual([{ warehouseId: PERVOMAY, quantity: 25 }]);
  });

  it('количество проверяется у каждого склада', () => {
    expect(() =>
      normalizeWarehouses(
        [
          { warehouseId: PERVOMAY, quantity: 25 },
          { warehouseId: AMIR, quantity: -3 },
        ],
        ALLOWED,
      ),
    ).toThrow(BulkStockValidationError);
  });

  it('пустой выбор — ошибка', () => {
    expect(() => normalizeWarehouses([], ALLOWED)).toThrow(/ни один склад/);
  });
});

describe('пары товар × склад', () => {
  it('перемножает выбор и берёт количество у склада', () => {
    const pairs = buildPairs(
      ['GTR-BLACK-XL', 'SAMURAI-WHITE-L'],
      [
        { warehouseId: PERVOMAY, quantity: 30 },
        { warehouseId: AMIR, quantity: 20 },
      ],
    );

    expect(pairs).toHaveLength(4);
    // Порядок — товар за товаром: частичный отказ читается как «этот
    // товар не прошёл», а не россыпью по всему списку.
    expect(pairs.map((p) => `${p.offerId}@${p.warehouseId}=${p.quantity}`)).toEqual([
      `GTR-BLACK-XL@${PERVOMAY}=30`,
      `GTR-BLACK-XL@${AMIR}=20`,
      `SAMURAI-WHITE-L@${PERVOMAY}=30`,
      `SAMURAI-WHITE-L@${AMIR}=20`,
    ]);
  });

  it('одно число для всех — это одинаковое количество у складов', () => {
    const pairs = buildPairs(
      ['A'],
      [PERVOMAY, AMIR, EXPRESS].map((warehouseId) => ({ warehouseId, quantity: 25 })),
    );
    expect(pairs.every((p) => p.quantity === 25)).toBe(true);
    expect(pairs).toHaveLength(3);
  });
});

describe('разбиение по лимиту площадки', () => {
  it('ровно сто пар — один запрос', () => {
    const pairs = buildPairs(
      Array.from({ length: 100 }, (_, i) => `A-${i}`),
      [{ warehouseId: PERVOMAY, quantity: 1 }],
    );
    expect(chunkPairs(pairs)).toHaveLength(1);
  });

  it('сто одна пара — уже два', () => {
    const pairs = buildPairs(
      Array.from({ length: 101 }, (_, i) => `A-${i}`),
      [{ warehouseId: PERVOMAY, quantity: 1 }],
    );
    const chunks = chunkPairs(pairs);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(OZON_STOCK_CHUNK);
    expect(chunks[1]).toHaveLength(1);
  });

  it('склады умножают работу, а не делят', () => {
    // 50 товаров × 3 склада = 150 пар = два запроса. Считаются пары,
    // а не товары: у Ozon один товар на трёх складах — три позиции.
    const pairs = buildPairs(
      Array.from({ length: 50 }, (_, i) => `A-${i}`),
      [PERVOMAY, AMIR, EXPRESS].map((warehouseId) => ({ warehouseId, quantity: 25 })),
    );
    expect(pairs).toHaveLength(150);
    expect(chunkPairs(pairs)).toHaveLength(2);
  });

  it('пустой список — ни одного запроса', () => {
    expect(chunkPairs([])).toEqual([]);
  });
});

describe('защита от массовой ошибки', () => {
  it('порог срабатывает начиная с указанного числа', () => {
    expect(needsStrongConfirm(499)).toBe(false);
    expect(needsStrongConfirm(500)).toBe(true);
  });

  it('порог настраивается', () => {
    expect(needsStrongConfirm(10, 10)).toBe(true);
  });

  it('обнуление считается отдельно', () => {
    const pairs = buildPairs(
      ['A', 'B'],
      [
        { warehouseId: PERVOMAY, quantity: 0 },
        { warehouseId: AMIR, quantity: 5 },
      ],
    );
    expect(zeroingCount(pairs)).toBe(2);
  });
});

describe('пауза между отправками одной пары', () => {
  const now = new Date('2026-08-25T12:00:00Z');

  it('пару, которую ещё не трогали, можно слать сразу', () => {
    expect(waitBeforeRetryMs(null, now)).toBe(0);
  });

  it('сразу после отправки ждём почти всё окно', () => {
    const justNow = new Date(now.getTime() - 1000);
    expect(waitBeforeRetryMs(justNow, now)).toBe(MIN_PAIR_INTERVAL_MS - 1000);
  });

  it('после истечения окна ждать не нужно', () => {
    const long = new Date(now.getTime() - MIN_PAIR_INTERVAL_MS);
    expect(waitBeforeRetryMs(long, now)).toBe(0);
  });
});
