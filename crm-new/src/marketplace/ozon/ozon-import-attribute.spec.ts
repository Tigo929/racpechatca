import { toImportAttribute } from './ozon-product-catalog.service';

/**
 * Перекладка атрибута из ответа Ozon в тело импорта.
 *
 * Проверяется здесь, а не «на живом кабинете», потому что ошибка была немой:
 * чтение отдаёт номер атрибута в поле `attribute_id`, импорт ждёт его в поле
 * `id`. Прочитанные атрибуты уходили обратно как есть — без номера, — Ozon
 * заводил задачу, отвечал номером, интерфейс показывал «отправлено», а
 * карточка не менялась. Никакой ошибки при этом никто не видел.
 */
describe('toImportAttribute', () => {
  it('переносит номер атрибута из attribute_id в id', () => {
    expect(
      toImportAttribute({
        attribute_id: 8292,
        complex_id: 0,
        values: [{ value: 'JDM-1-2' }],
      }),
    ).toEqual({ id: 8292, complex_id: 0, values: [{ value: 'JDM-1-2' }] });
  });

  it('у словарного значения оставляет только dictionary_value_id', () => {
    // Чтение отдаёт и номер, и подпись. Отправлять обратно оба — способ
    // получить отказ, если подпись разошлась со словарём хоть на букву.
    expect(
      toImportAttribute({
        attribute_id: 10096,
        values: [{ dictionary_value_id: 61576, value: 'черный' }],
      }),
    ).toEqual({ id: 10096, complex_id: 0, values: [{ dictionary_value_id: 61576 }] });
  });

  it('выбрасывает нулевой dictionary_value_id, оставляя текст', () => {
    // В ответе чтения ноль означает «значение не из словаря», а в импорте —
    // несуществующий пункт словаря, на котором Ozon отбивает запрос целиком.
    expect(
      toImportAttribute({
        attribute_id: 4191,
        values: [{ dictionary_value_id: 0, value: 'Описание товара' }],
      }),
    ).toEqual({ id: 4191, complex_id: 0, values: [{ value: 'Описание товара' }] });
  });

  it('пропускает атрибут без номера и атрибут без значений', () => {
    expect(toImportAttribute({ values: [{ value: 'что-то' }] })).toBeNull();
    expect(toImportAttribute({ attribute_id: 31, values: [] })).toBeNull();
    expect(toImportAttribute({ attribute_id: 31, values: [{}] })).toBeNull();
  });

  it('сохраняет complex_id — по нему Ozon группирует связанные атрибуты', () => {
    expect(
      toImportAttribute({
        attribute_id: 4191,
        complex_id: 100001,
        values: [{ value: 'x' }],
      })?.complex_id,
    ).toBe(100001);
  });
});
