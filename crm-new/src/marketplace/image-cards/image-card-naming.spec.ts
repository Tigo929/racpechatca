import {
  cardFileName,
  cleanBaseName,
  sniffSourceType,
  sourceTypeByMime,
  uniqueBaseName,
} from './image-card-naming';

/**
 * Имя файла приходит от человека и уходит человеку. Между этими точками оно
 * должно стать предсказуемым: одинаковый вход — одинаковый выход, и ни один
 * символ не может ничего сломать ни в пути на диске, ни в имени для Ozon
 * (площадка не принимает «/» и «_» в именах фотографий).
 */
describe('чистое имя из имени файла', () => {
  it('пример из ТЗ', () => {
    expect(cleanBaseName('JDM Skyline.pdf')).toBe('jdm-skyline');
    expect(cleanBaseName('jdm-skyline-r34.png')).toBe('jdm-skyline-r34');
  });

  it('русские буквы транслитерируются, цифры остаются', () => {
    expect(cleanBaseName('Принт Кот 5.png')).toBe('print-kot-5');
    expect(cleanBaseName('Ёжик и Щука.pdf')).toBe('ezhik-i-schuka');
  });

  it('мягкий и твёрдый знак просто исчезают, а не превращаются в дефис', () => {
    expect(cleanBaseName('Медведь.png')).toBe('medved');
    expect(cleanBaseName('Подъезд.png')).toBe('podezd');
  });

  it('пробелы и запрещённые символы становятся одним дефисом', () => {
    expect(cleanBaseName('Кот   №5 (финал)!.pdf')).toBe('kot-5-final');
  });

  it('дефисы по краям снимаются', () => {
    expect(cleanBaseName('  --Skyline--  .pdf')).toBe('skyline');
  });

  it('снимается только последнее расширение', () => {
    expect(cleanBaseName('logo.v2.png')).toBe('logo-v2');
  });

  it('имя без единого пригодного символа не остаётся пустым', () => {
    expect(cleanBaseName('!!!.png')).toBe('design');
    expect(cleanBaseName('.png')).toBe('design');
  });

  it('точки и слеши из имени не переживают чистку — путь ими не подменить', () => {
    const name = cleanBaseName('../../etc/passwd.pdf');
    expect(name).not.toContain('/');
    expect(name).not.toContain('.');
    expect(name).toBe('etc-passwd');
  });

  it('очень длинное имя обрезается и не кончается дефисом', () => {
    const name = cleanBaseName(`${'а'.repeat(200)} конец.pdf`);
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.endsWith('-')).toBe(false);
  });
});

describe('имя итогового файла', () => {
  it('повторяет артикул: имя принта, дефис, цвет', () => {
    expect(cardFileName('jdm-skyline-r34', 'black')).toBe(
      'jdm-skyline-r34-black.jpg',
    );
    expect(cardFileName('jdm-skyline-r34', 'white')).toBe(
      'jdm-skyline-r34-white.jpg',
    );
  });

  it('разделитель только дефис — по нему ищут артикул', () => {
    // Подчёркивание и слово «image_card» в имени были помехой: артикул
    // пишется через дефис, и поиск по нему файл не находил.
    const name = cardFileName('cat-1-1', 'black');
    expect(name).toBe('cat-1-1-black.jpg');
    expect(name).not.toContain('_');
  });

  it('расширение задаётся отдельно — формат может смениться', () => {
    expect(cardFileName('kot', 'black', 'png')).toBe('kot-black.png');
  });
});

describe('совпадающие имена', () => {
  it('первое имя занимает себя, следующие получают номер', () => {
    const taken = new Set<string>();
    const first = uniqueBaseName('kot', taken);
    taken.add(first);
    const second = uniqueBaseName('kot', taken);
    taken.add(second);
    const third = uniqueBaseName('kot', taken);

    expect(first).toBe('kot');
    expect(second).toBe('kot-2');
    expect(third).toBe('kot-3');
  });

  it('«Кот.pdf» и «кот.PDF» не затирают друг друга', () => {
    const taken = new Set<string>();
    const a = uniqueBaseName(cleanBaseName('Кот.pdf'), taken);
    taken.add(a);
    const b = uniqueBaseName(cleanBaseName('кот.PDF'), taken);
    expect(a).not.toBe(b);
  });
});

describe('тип исходника', () => {
  it('определяется по MIME, а не по расширению', () => {
    expect(sourceTypeByMime('application/pdf')).toBe('pdf');
    expect(sourceTypeByMime('image/png')).toBe('png');
    expect(sourceTypeByMime('image/jpeg')).toBe('jpeg');
    expect(sourceTypeByMime('image/webp')).toBe('webp');
  });

  it('неизвестный тип не проходит', () => {
    expect(sourceTypeByMime('application/zip')).toBeNull();
    expect(sourceTypeByMime('image/svg+xml')).toBeNull();
  });
});

describe('тип по первым байтам', () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(8)]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8),
  ]);
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(8),
  ]);
  const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBP'),
    Buffer.alloc(4),
  ]);

  it('узнаёт разрешённые форматы', () => {
    expect(sniffSourceType(pdf)).toBe('pdf');
    expect(sniffSourceType(png)).toBe('png');
    expect(sniffSourceType(jpeg)).toBe('jpeg');
    expect(sniffSourceType(webp)).toBe('webp');
  });

  it('переименованный чужой файл не проходит, каким бы ни был MIME', () => {
    // ZIP-архив, названный «принт.png»: MIME браузер поставит по расширению.
    const zip = Buffer.concat([Buffer.from('PK'), Buffer.alloc(16)]);
    expect(sniffSourceType(zip)).toBeNull();
    // И встречный случай: SVG — это текст, сигнатуры у него нет.
    expect(sniffSourceType(Buffer.from('<svg xmlns="..."></svg>'))).toBeNull();
  });

  it('обрезок файла не считается форматом', () => {
    expect(sniffSourceType(Buffer.from('%PD'))).toBeNull();
    expect(sniffSourceType(Buffer.alloc(0))).toBeNull();
  });
});
