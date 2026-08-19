import {
  buildExtraImages,
  buildImportItem,
  buildOfferId,
  chunk,
  colorCodeFor,
  generateUnionKey,
  normalizeSlug,
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
  sharedPhotoUrls: [
    'https://example.com/shared-1.jpg',
    'https://example.com/shared-2.jpg',
  ],
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
    // Свои фото принта идут первыми, следом — общие из шаблона.
    expect(item.images).toEqual([
      ...print.extraPhotoUrls,
      ...template.sharedPhotoUrls,
    ]);

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

  it('не отправляет «цену до скидки», если она не выше цены', () => {
    /*
     * Ozon отбивает товар целиком, если зачёркнутая цена ниже актуальной.
     * На создании это выглядело как «карточка просто не появилась»: ошибка
     * приходила на весь вариант, а причина — в поле, которое человек считал
     * необязательным. Тот же порядок уже стоял в обновлении цен, а на
     * импорте его не было.
     */
    expect(buildImportItem(template, { ...print, oldPrice: 2000 }, variant).old_price)
      .toBe('0');
    expect(buildImportItem(template, { ...print, oldPrice: 3500 }, variant).old_price)
      .toBe('0');
    expect(buildImportItem(template, { ...print, oldPrice: null }, variant).old_price)
      .toBe('0');
    // А выше цены — уходит как есть.
    expect(buildImportItem(template, { ...print, oldPrice: 6000 }, variant).old_price)
      .toBe('6000');
  });

  it('сравнивает «цену до скидки» с ценой варианта, а не принта', () => {
    // У варианта своя цена — от неё и считается, выше ли зачёркнутая.
    const item = buildImportItem(
      template,
      { ...print, oldPrice: 4000 },
      { ...variant, priceOverride: 5000 },
    );
    expect(item.price).toBe('5000');
    expect(item.old_price).toBe('0');
  });

  it('главное фото берётся у цвета, а не у принта', () => {
    /*
     * Один принт — разные футболки. Белый вариант с фотографией чёрного
     * покупатель видит как чужой товар, а Ozon считает несоответствием
     * карточки. До этого фото было одно на весь принт, и все цвета уходили
     * со снимком первого.
     */
    const item = buildImportItem(template, print, {
      ...variant,
      mainPhotoUrl: 'https://example.com/white.jpg',
    });
    expect(item.primary_image).toBe('https://example.com/white.jpg');
    // Фото принта в дополнительные не подмешивается: это снимок другого цвета.
    expect(item.images).not.toContain(print.mainPhotoUrl);
  });

  it('без своего фото цвет берёт фото принта', () => {
    // Так продолжают работать карточки, заведённые до того, как фото стало
    // частью цвета, и цвета, у которых снимок ещё не готов.
    expect(buildImportItem(template, print, variant).primary_image).toBe(
      print.mainPhotoUrl,
    );
    expect(
      buildImportItem(template, print, { ...variant, mainPhotoUrl: '   ' })
        .primary_image,
    ).toBe(print.mainPhotoUrl);
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

describe('ozon-attributes: фотографии карточки', () => {
  it('общие фото шаблона подставляются в каждый принт', () => {
    const bare = { ...print, extraPhotoUrls: [] };
    expect(buildExtraImages(template, bare)).toEqual(template.sharedPhotoUrls);
  });

  it('не дублирует главное фото в дополнительных', () => {
    const withMainDuplicated = {
      ...print,
      extraPhotoUrls: [print.mainPhotoUrl, 'https://example.com/other.jpg'],
    };
    const images = buildExtraImages(template, withMainDuplicated);
    expect(images).not.toContain(print.mainPhotoUrl);
    expect(images).toContain('https://example.com/other.jpg');
  });

  it('не повторяет одну и ту же ссылку дважды', () => {
    const overlapping = {
      ...print,
      extraPhotoUrls: ['https://example.com/shared-1.jpg'],
    };
    const images = buildExtraImages(template, overlapping);
    expect(
      images.filter((u) => u === 'https://example.com/shared-1.jpg'),
    ).toHaveLength(1);
  });

  it('обрезает список до 14 фото — потолок Ozon', () => {
    const many = {
      ...template,
      sharedPhotoUrls: Array.from(
        { length: 20 },
        (_, i) => `https://example.com/${i}.jpg`,
      ),
    };
    expect(
      buildExtraImages(many, { ...print, extraPhotoUrls: [] }),
    ).toHaveLength(14);
  });
});

describe('ozon-attributes: слаг и артикул', () => {
  it('слаг из названия убирает пробелы, регистр и запрещённые символы', () => {
    expect(slugify('Лавров Надпись!')).toBe('лавров-надпись');
    expect(slugify('  Pantera 1 (чёрная) ')).toBe('pantera-1-чёрная');
  });

  it('слаг, введённый вручную, сохраняет регистр — «JDM-1-1», а не «jdm-1-1»', () => {
    expect(normalizeSlug('JDM-1-1')).toBe('JDM-1-1');
    expect(normalizeSlug('  JDM-2-3 ')).toBe('JDM-2-3');
  });

  it('offer_id строится по схеме <принт>-<цвет>-<размер>', () => {
    expect(buildOfferId('JDM-1-1', 'black', 'S')).toBe('JDM-1-1-black-S');
    expect(buildOfferId('JDM-1-1', 'white', 'XXL')).toBe('JDM-1-1-white-XXL');
  });

  it('код цвета переводит русскую подпись словаря Ozon в латиницу', () => {
    expect(colorCodeFor('черный')).toBe('black');
    expect(colorCodeFor('Белый')).toBe('white');
    expect(colorCodeFor('чёрный')).toBe('black');
  });

  it('незнакомый цвет транслитерируется, а не теряется', () => {
    expect(colorCodeFor('лазурный')).toBe('lazurnyy');
  });

  it('два цвета одного принта не сталкиваются на одном размере', () => {
    const black = buildOfferId('JDM-1-1', colorCodeFor('черный'), 'S');
    const white = buildOfferId('JDM-1-1', colorCodeFor('белый'), 'S');
    expect(black).not.toBe(white);
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
