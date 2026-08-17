import {
  buildImportItem,
  buildOfferId,
  chunk,
  generateUnionKey,
  OZON_ATTR,
  slugify,
  type CatalogTemplateForImport,
  type PrintForImport,
  type VariantForImport,
} from './ozon-attributes';

const template: CatalogTemplateForImport = {
  descriptionCategoryId: 200000933,
  typeId: 93244,
  vatRate: 'Не облагается',
  needsMarkingCode: false,
  brandDictionaryValueId: 126745801,
  countryDictionaryValueId: null,
  materialDictionaryValueId: 62174,
  materialComposition: '100% Хлопок',
  styleDictionaryValueId: 29802,
  seasonDictionaryValueId: 30937,
  careInstructions: null,
  sleeveDictionaryValueId: null,
  necklineDictionaryValueId: null,
  packageTypeDictionaryValueId: 44412,
  tnvedDictionaryValueId: 971398495,
  sizeDimensions: {
    M: { weightG: 157, widthMm: 259, heightMm: 27, lengthMm: 274 },
    XXL: { weightG: 199, widthMm: 268, heightMm: 26, lengthMm: 277 },
  },
};

const print: PrintForImport = {
  slug: 'labrov-nadpis',
  name: 'Футболка с принтом Лаврова',
  description: 'Стильная модель',
  hashtags: '#футболка_с_принтом',
  mainPhotoUrl: 'https://example.com/main.jpg',
  extraPhotoUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
  price: 3500,
  oldPrice: 6000,
  gender: 'UNISEX',
  patternTags: ['Надписи'],
  unionKey: 'abc123',
};

const variant: VariantForImport = {
  offerId: 'labrov-nadpis-M',
  colorLabel: 'черный',
  colorDictionaryValueId: 61574,
  size: 'M',
  priceOverride: null,
};

describe('ozon-attributes: сборка запроса на импорт', () => {
  it('собирает товар с ценой, габаритами и вложенными атрибутами', () => {
    const item = buildImportItem(template, print, variant);

    expect(item.offer_id).toBe('labrov-nadpis-M');
    // Отдельное поле type_id обязательно: без него Ozon отвечает 400, даже
    // когда тип продублирован атрибутом 8229 (проверено живой загрузкой).
    expect(item.type_id).toBe(93244);
    expect(item.description_category_id).toBe(200000933);
    expect(item.price).toBe('3500');
    expect(item.old_price).toBe('6000');
    expect(item.vat).toBe('0');
    expect(item.weight).toBe(157);
    expect(item.width).toBe(259);
    expect(item.primary_image).toBe(print.mainPhotoUrl);
    expect(item.images).toEqual(print.extraPhotoUrls);

    const byId = (id: number) => item.attributes.find((a) => a.id === id);
    expect(byId(OZON_ATTR.UNION_KEY)?.values[0]).toEqual({ value: 'abc123' });
    expect(byId(OZON_ATTR.COLOR)?.values[0]).toEqual({
      dictionary_value_id: 61574,
    });
    expect(byId(OZON_ATTR.SIZE)?.values[0]).toEqual({
      dictionary_value_id: 35430,
    });
    expect(byId(OZON_ATTR.COLOR_NAME)?.values[0]).toEqual({
      value: 'labrov-nadpis',
    });
    // UNISEX -> Мужской + Женский, двумя значениями одного атрибута.
    expect(byId(OZON_ATTR.GENDER)?.values).toEqual([
      { dictionary_value_id: 22880 },
      { dictionary_value_id: 22881 },
    ]);
  });

  it('override цены варианта важнее цены принта', () => {
    const item = buildImportItem(template, print, {
      ...variant,
      priceOverride: 2990,
    });
    expect(item.price).toBe('2990');
  });

  it('пропускает необязательные атрибуты, если их нет ни в шаблоне, ни в принте', () => {
    const bareTemplate: CatalogTemplateForImport = {
      ...template,
      countryDictionaryValueId: null,
      styleDictionaryValueId: null,
      seasonDictionaryValueId: null,
      careInstructions: null,
    };
    const barePrint: PrintForImport = {
      ...print,
      description: null,
      hashtags: null,
      patternTags: [],
    };

    const item = buildImportItem(bareTemplate, barePrint, variant);
    const ids = item.attributes.map((a) => a.id);

    expect(ids).not.toContain(OZON_ATTR.COUNTRY);
    expect(ids).not.toContain(OZON_ATTR.STYLE);
    expect(ids).not.toContain(OZON_ATTR.SEASON);
    expect(ids).not.toContain(OZON_ATTR.CARE);
    expect(ids).not.toContain(OZON_ATTR.PATTERN);
    expect(ids).not.toContain(OZON_ATTR.ANNOTATION);
    expect(ids).not.toContain(OZON_ATTR.HASHTAGS);
  });

  it('падает с понятной ошибкой, если для размера вообще нет габаритов в шаблоне', () => {
    const emptyTemplate: CatalogTemplateForImport = {
      ...template,
      sizeDimensions: {},
    };
    expect(() => buildImportItem(emptyTemplate, print, variant)).toThrow(
      /не заданы габариты/,
    );
  });

  it('берёт габариты соседнего размера, если для конкретного размера их нет', () => {
    const item = buildImportItem(template, print, {
      ...variant,
      size: 'S',
      offerId: 'labrov-nadpis-S',
    });
    // В шаблоне теста только M и XXL — S отсутствует, берём первый попавшийся (M).
    expect(item.weight).toBe(157);
  });
});

describe('ozon-attributes: слаг и артикул', () => {
  it('слаг убирает пробелы, регистр и запрещённые символы', () => {
    expect(slugify('Лавров Надпись!')).toBe('лавров-надпись');
    expect(slugify('  Pantera 1 (чёрная) ')).toBe('pantera-1-чёрная');
  });

  it('offer_id строится по схеме <принт>-<размер>', () => {
    expect(buildOfferId('pantera-1', 'XXL')).toBe('pantera-1-XXL');
  });
});

describe('ozon-attributes: служебное', () => {
  it('unionKey генерируется каждый раз разным и это hex-строка', () => {
    const a = generateUnionKey();
    const b = generateUnionKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it('chunk режет массив на пачки нужного размера, включая хвост', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
