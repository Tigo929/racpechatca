import { describe, expect, it } from 'vitest';
import {
  isPdfFile,
  pickUploadFormat,
  PDF_RASTER_LONG_SIDE,
  PNG_LIMIT_PIXELS,
  rasterScale,
  rasterizedName,
} from './pdf-to-image';

/**
 * Подготовка PDF к отправке.
 *
 * Весь смысл — не гнать по сети сотни мегабайт слоёв ради картинки,
 * которая всё равно будет растром. Если эти правила поедут, вернётся
 * или долгое ожидание, или мыло в печати.
 */

const pdf = (name: string, type = 'application/pdf') =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

describe('что считаем PDF', () => {
  it('по типу файла', () => {
    expect(isPdfFile(pdf('макет.pdf'))).toBe(true);
  });

  it('по расширению, если тип не проставлен', () => {
    // Windows и часть браузеров отдают пустой type — по нему одному судить
    // нельзя, иначе PDF молча уедет на сервер целиком.
    expect(isPdfFile(pdf('макет.PDF', ''))).toBe(true);
  });

  it('картинку за PDF не принимаем', () => {
    expect(isPdfFile(new File([], 'print.png', { type: 'image/png' }))).toBe(
      false,
    );
  });
});

describe('во сколько раз увеличить страницу', () => {
  it('длинная сторона выходит ровно по потолку', () => {
    // Страница A4 в точках: 595 × 842.
    const scale = rasterScale(595, 842);
    expect(Math.round(842 * scale)).toBe(PDF_RASTER_LONG_SIDE);
  });

  it('горизонтальная страница считается по ширине', () => {
    const scale = rasterScale(842, 595);
    expect(Math.round(842 * scale)).toBe(PDF_RASTER_LONG_SIDE);
  });

  it('обычная страница увеличивается: вектор от этого не теряет ничего', () => {
    // A4 — 842 точки по длинной стороне, а нам нужно 4000 пикселей.
    expect(rasterScale(595, 842)).toBeGreaterThan(1);
  });

  it('огромная страница уменьшается, а не раздувает память вкладки', () => {
    // Длинная сторона больше потолка в точках — это холст метра полтора.
    expect(rasterScale(3000, 5000)).toBeLessThan(1);
  });

  it('битые размеры не ломают расчёт', () => {
    expect(rasterScale(0, 0)).toBe(1);
    expect(rasterScale(Number.NaN, 100)).toBe(1);
  });
});

describe('имя готовой картинки', () => {
  it('расширение pdf заменяется, имя остаётся', () => {
    expect(rasterizedName('макет клиента.pdf', 'png')).toBe(
      'макет клиента.png',
    );
    expect(rasterizedName('МАКЕТ.PDF', 'webp')).toBe('МАКЕТ.webp');
  });

  it('без имени файл всё равно получает своё', () => {
    expect(rasterizedName('', 'png')).toBe('print.png');
  });
});

describe('в каком формате отправлять', () => {
  it('небольшая страница уходит без потерь', () => {
    expect(pickUploadFormat(1200 * 1600)).toBe('png');
  });

  it('крупная — сжатой: PNG такого холста кодируется секундами', () => {
    expect(pickUploadFormat(PNG_LIMIT_PIXELS + 1)).toBe('webp');
  });

  it('ровно на границе остаёмся без потерь', () => {
    expect(pickUploadFormat(PNG_LIMIT_PIXELS)).toBe('png');
  });

  it('решение принимается по пикселям, а не по готовому файлу', () => {
    // Иначе PNG пришлось бы закодировать только ради того, чтобы узнать
    // его вес и выбросить — это и был самый долгий шаг подготовки.
    expect(pickUploadFormat(4000 * 5657)).toBe('webp');
  });
});
