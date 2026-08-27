import {
  resolveDefaultWarehouses,
  type WarehouseState,
} from './ozon-default-warehouses';

/** Настоящие идентификаторы кабинета — те же, что в остальных тестах складов. */
const PERVOMAY = 1020005000060325;
const AMIR = 1020005027898150;
const CLOSED = 1020005099999999;

const warehouse = (
  warehouseId: number,
  patch: Partial<WarehouseState> = {},
): WarehouseState => ({
  warehouseId,
  name: `Склад ${warehouseId}`,
  isEditable: true,
  disabledReason: null,
  archived: false,
  ...patch,
});

describe('склады по умолчанию для нового товара', () => {
  it('остаток уходит на все выбранные склады, а не на первый', () => {
    const choice = resolveDefaultWarehouses(
      [PERVOMAY, AMIR],
      [warehouse(PERVOMAY), warehouse(AMIR)],
    );

    expect(choice.targets).toEqual([PERVOMAY, AMIR]);
    expect(choice.warnings).toEqual([]);
    expect(choice.usedFallback).toBe(false);
  });

  it('пустой выбор сохраняет прежнее поведение — первый рабочий склад', () => {
    // Считать пустоту за «все склады» нельзя: у продавца, который настройку
    // не открывал, остаток внезапно уехал бы на все точки сразу.
    const choice = resolveDefaultWarehouses(
      [],
      [warehouse(PERVOMAY), warehouse(AMIR)],
    );

    expect(choice.targets).toEqual([PERVOMAY]);
    expect(choice.usedFallback).toBe(true);
  });

  it('пустой выбор пропускает нерабочий склад, а не берёт его первым', () => {
    const choice = resolveDefaultWarehouses(
      [],
      [warehouse(CLOSED, { isEditable: false }), warehouse(AMIR)],
    );

    expect(choice.targets).toEqual([AMIR]);
  });

  it('удалённый в кабинете склад не используется, но о нём говорят', () => {
    const choice = resolveDefaultWarehouses(
      [PERVOMAY, CLOSED],
      [warehouse(PERVOMAY), warehouse(CLOSED, { archived: true })],
    );

    expect(choice.targets).toEqual([PERVOMAY]);
    expect(choice.warnings).toHaveLength(1);
    expect(choice.warnings[0]).toContain('удалён в кабинете');
  });

  it('закрытый склад объясняется причиной площадки', () => {
    const choice = resolveDefaultWarehouses(
      [CLOSED],
      [
        warehouse(CLOSED, {
          name: 'Казань',
          isEditable: false,
          disabledReason: 'склад заблокирован',
        }),
      ],
    );

    expect(choice.targets).toEqual([]);
    expect(choice.warnings[0]).toContain('Казань');
    expect(choice.warnings[0]).toContain('склад заблокирован');
  });

  it('исчезнувший из кабинета склад не роняет расчёт', () => {
    const choice = resolveDefaultWarehouses([CLOSED], [warehouse(PERVOMAY)]);

    expect(choice.targets).toEqual([]);
    expect(choice.warnings.some((w) => w.includes('больше не виден'))).toBe(true);
  });

  it('когда не осталось ни одного склада, это сказано прямо', () => {
    const choice = resolveDefaultWarehouses(
      [CLOSED],
      [warehouse(CLOSED, { archived: true })],
    );

    expect(choice.targets).toEqual([]);
    expect(choice.warnings.at(-1)).toContain('остаток не проставлен');
  });

  it('склад, отмеченный дважды, остаётся одним', () => {
    // Повтор означал бы две записи остатка подряд: вторая перебила бы первую.
    const choice = resolveDefaultWarehouses(
      [PERVOMAY, PERVOMAY],
      [warehouse(PERVOMAY)],
    );

    expect(choice.targets).toEqual([PERVOMAY]);
  });

  it('в кабинете нет складов вовсе — говорим об этом, а не молчим', () => {
    const choice = resolveDefaultWarehouses([], []);

    expect(choice.targets).toEqual([]);
    expect(choice.warnings[0]).toContain('ни одного склада');
  });
});
