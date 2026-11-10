import { realPrintSize, DEFAULT_WIDTH_MM } from './approval-print-size';
import { parsePageSizeMm } from '../marketplace/image-cards/pdf-raster.service';

/**
 * Настоящий размер макета.
 *
 * Размер приходит из файла, с которым макет уйдёт в печать, и дальше не
 * меняется. Принт на фотографии футболки двигают и масштабируют на глаз —
 * это раскладка, а не размер отпечатка, и сантиметры от неё зависеть не
 * должны. Раньше они просто стояли умолчанием в 28 см, и их правили руками
 * после каждой загрузки.
 */

describe('откуда берётся размер макета', () => {
  it('браузер разобрал PDF — верим ему', () => {
    // Сервер в этом случае получает уже картинку: размер страницы после
    // растеризации восстановить не из чего.
    expect(
      realPrintSize(
        { widthMm: 200, heightMm: 250 },
        { sourceWidthMm: 999, sourceHeightMm: 999 },
        { widthMm: 300, heightMm: 300 },
        1,
      ),
    ).toEqual({ widthMm: 200, heightMm: 250 });
  });

  it('браузер промолчал — берём то, что сказал файл на сервере', () => {
    expect(
      realPrintSize(undefined, { sourceWidthMm: 210, sourceHeightMm: 297 }, undefined, 1),
    ).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it('файл о размере молчит — остаётся прежний размер стороны', () => {
    // Перезаливают обычно исправленный макет того же размера.
    expect(realPrintSize(undefined, {}, { widthMm: 180, heightMm: 240 }, 1.5)).toEqual({
      widthMm: 180,
      heightMm: 240,
    });
  });

  it('не сказал никто — умолчание в пропорциях исходника', () => {
    expect(realPrintSize(undefined, {}, undefined, 1.5)).toEqual({
      widthMm: DEFAULT_WIDTH_MM,
      heightMm: DEFAULT_WIDTH_MM * 1.5,
    });
  });

  it('нулям и мусору не верим', () => {
    // Пустое поле формы приезжает нулём: это «не знаю», а не «ноль сантиметров».
    expect(
      realPrintSize({ widthMm: 0, heightMm: 0 }, {}, { widthMm: 150, heightMm: 150 }, 1),
    ).toEqual({ widthMm: 150, heightMm: 150 });
    expect(
      realPrintSize(
        { widthMm: Number.NaN, heightMm: 100 },
        {},
        { widthMm: 150, heightMm: 150 },
        1,
      ),
    ).toEqual({ widthMm: 150, heightMm: 150 });
  });

  it('размер держится в тех же пределах, что и ручной ввод', () => {
    // Макет на три метра — это ошибка в файле, а не задание печатнику.
    expect(
      realPrintSize({ widthMm: 5000, heightMm: 1 }, {}, undefined, 1),
    ).toEqual({ widthMm: 2000, heightMm: 10 });
  });
});

describe('размер страницы PDF из вывода pdfinfo', () => {
  const output = [
    'Title:          layout',
    'Pages:          1',
    'Page size:      841.89 x 595.276 pts (A4)',
    'File size:      120345 bytes',
  ].join('\n');

  it('переводит точки в миллиметры', () => {
    // A4 на боку: 297 × 210 мм.
    expect(parsePageSizeMm(output)).toEqual({ widthMm: 297, heightMm: 210 });
  });

  it('квадратная страница макета читается как есть', () => {
    expect(parsePageSizeMm('Page size:      566.93 x 566.93 pts')).toEqual({
      widthMm: 200,
      heightMm: 200,
    });
  });

  it('читает вывод с номером страницы — именно так отвечает наш вызов', () => {
    /*
     * Настоящий ответ pdfinfo 25.12 на «-f 1 -l 1», снятый с прод-сервера.
     * Форма строки там другая: «Page    1 size:» вместо «Page size:».
     * Разбор, написанный по второй форме, молча возвращал бы «размер
     * неизвестен» для каждого PDF.
     */
    const real = [
      'Pages:           1',
      'Encrypted:       no',
      'Page    1 size:  566.93 x 566.93 pts',
      'Page    1 rot:   0',
      'File size:       352 bytes',
    ].join('\n');
    expect(parsePageSizeMm(real)).toEqual({ widthMm: 200, heightMm: 200 });
  });

  it('не нашлось строки — не выдумываем размер', () => {
    expect(parsePageSizeMm('Pages: 1')).toBeNull();
    expect(parsePageSizeMm('')).toBeNull();
    expect(parsePageSizeMm('Page size:      0 x 0 pts')).toBeNull();
  });
});
