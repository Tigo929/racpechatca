import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { assertListedCanvasSize } from './canvas-size-guard';
import { CANVAS_SIZE_KEYS } from 'src/canvas/canvas-production-price';

/**
 * Размер холста в заказе — только из прайса.
 *
 * Пока размер можно было вписать словами, с ним вписывалась и цена:
 * у такой позиции нет ни розницы, ни опта, сверить её не с чем, и
 * «заработал я на этом или нет» считалось от произвольного числа.
 * Отсюда и жалоба владельца: «могу написать любой формат, и цена
 * остаётся та же».
 *
 * Проверка сторожит и правило, и то, что его применяют на всех путях
 * создания позиции: интерфейс можно обойти запросом, а новый путь
 * заведения заказа легко написать, забыв про проверку.
 */

const SRC = join(__dirname, '..');

describe('размер холста только из прайса', () => {
  it('размер из прайса проходит', () => {
    for (const key of ['20x30', '40x60', CANVAS_SIZE_KEYS[0]]) {
      expect(() => assertListedCanvasSize(key)).not.toThrow();
    }
  });

  it('пустой, чужой и выдуманный размер — отказ', () => {
    for (const key of [undefined, null, '', '  ', '33x33', 'большой']) {
      expect(() => assertListedCanvasSize(key)).toThrow(BadRequestException);
    }
  });

  it('в отказе сказано, где взять размер и куда девать нестандарт', () => {
    // Отказ без подсказки заставляет гадать: человек в этот момент
    // разговаривает с клиентом, а не читает документацию.
    try {
      assertListedCanvasSize('33x33');
      throw new Error('должен был отказать');
    } catch (err) {
      const message = (err as BadRequestException).message;
      expect(message).toContain('прайса');
      expect(message).toContain('свободной позицией');
    }
  });

  it('проверку применяют оба пути создания позиции', () => {
    /*
      Позицию холста заводят двумя путями: вместе с заказом
      (order-photo.service) и отдельной кнопкой в карточке
      (canvas-item.service). Пропустить проверку в одном из них —
      значит снова получить заказ с ценой, которую не с чем сверить.
    */
    for (const file of [
      'order-photo/order-photo.service.ts',
      'order-photo/canvas-item.service.ts',
    ]) {
      const source = readFileSync(join(SRC, file), 'utf8');
      expect(source).toContain('assertListedCanvasSize(');
    }
  });
});
