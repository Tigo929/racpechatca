import {
  editability,
  isStale,
  sortForPicker,
  toWarehouseStates,
  WAREHOUSE_CACHE_TTL_MS,
} from './ozon-warehouse-rules';

describe('доступность склада по статусу', () => {
  it('рабочий склад редактируется', () => {
    expect(editability('created')).toEqual({
      isEditable: true,
      disabledReason: null,
    });
  });

  it('выключенный и заблокированный — нет, и с объяснением', () => {
    for (const status of ['disabled', 'blocked', 'disabled_due_to_limit', 'error']) {
      const result = editability(status);
      expect(result.isEditable).toBe(false);
      expect(result.disabledReason).toBeTruthy();
    }
  });

  it('регистр и пробелы площадки роли не играют', () => {
    expect(editability('  DISABLED ').isEditable).toBe(false);
  });

  it('незнакомый статус считается рабочим', () => {
    // Ozon добавляет статусы молча. Белый список означал бы, что однажды
    // утром недоступны стали все склады разом — и остатки не проставить.
    expect(editability('какой-то_новый_статус').isEditable).toBe(true);
    expect(editability(null).isEditable).toBe(true);
    expect(editability(undefined).isEditable).toBe(true);
  });
});

describe('разбор ответа площадки', () => {
  it('склад без идентификатора пропускается', () => {
    // Писать на него нечем, а в списке он выглядел бы рабочим.
    const list = toWarehouseStates([
      { name: 'Без номера' },
      { warehouse_id: 1020000123456789, name: 'Москва', status: 'created' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.warehouseId).toBe(1020000123456789);
  });

  it('повтор в ответе не даёт двух строк', () => {
    // Уникальный ключ в базе упал бы на дубле, а вместе с ним вся синхронизация.
    const list = toWarehouseStates([
      { warehouse_id: 1, name: 'Москва' },
      { warehouse_id: 1, name: 'Москва' },
    ]);
    expect(list).toHaveLength(1);
  });

  it('безымянный склад называется по номеру', () => {
    const list = toWarehouseStates([{ warehouse_id: 42, name: '   ' }]);
    expect(list[0]?.name).toBe('Склад 42');
  });

  it('доступность считается сразу при разборе', () => {
    const list = toWarehouseStates([
      { warehouse_id: 1, name: 'Москва', status: 'created' },
      { warehouse_id: 2, name: 'СПб', status: 'disabled' },
    ]);
    expect(list[0]?.isEditable).toBe(true);
    expect(list[1]?.isEditable).toBe(false);
    expect(list[1]?.disabledReason).toContain('выключен');
  });
});

describe('срок жизни снимка', () => {
  const now = new Date('2026-08-25T12:00:00Z');

  it('без синхронизации — обновляем', () => {
    expect(isStale(null, now)).toBe(true);
  });

  it('свежий снимок не трогаем', () => {
    const fresh = new Date(now.getTime() - 60_000);
    expect(isStale(fresh, now)).toBe(false);
  });

  it('на границе срока обновляем', () => {
    const edge = new Date(now.getTime() - WAREHOUSE_CACHE_TTL_MS);
    expect(isStale(edge, now)).toBe(true);
  });
});

describe('порядок в списке выбора', () => {
  it('доступные сверху, внутри — по имени', () => {
    const sorted = sortForPicker([
      { isEditable: false, name: 'Астрахань' },
      { isEditable: true, name: 'Санкт-Петербург' },
      { isEditable: true, name: 'Москва' },
    ]);
    expect(sorted.map((w) => w.name)).toEqual([
      'Москва',
      'Санкт-Петербург',
      'Астрахань',
    ]);
  });

  it('исходный массив не меняется', () => {
    const input = [
      { isEditable: false, name: 'Б' },
      { isEditable: true, name: 'А' },
    ];
    sortForPicker(input);
    expect(input[0]?.name).toBe('Б');
  });
});
