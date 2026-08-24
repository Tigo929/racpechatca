import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  placementRect,
  rotatedBounds,
  type CardTransform,
  type Rect,
} from './image-card-placement';

/**
 * Сборка карточки: шаблон плюс принт в отмеченной области.
 *
 * Рендер серверный. Итоговая картинка уходит на Ozon и не должна зависеть от
 * того, какой у сотрудника браузер и масштаб экрана; браузерный скриншот как
 * основной способ рендера ТЗ запрещает прямо.
 *
 * Превью и финал считаются одним и тем же кодом, отличаются только размером:
 * иначе на сетке было бы одно, а в скачанном файле другое.
 */

/** Длинная сторона превью для сетки. Больше не нужно — карточек сотня. */
export const PREVIEW_LONG_SIDE = 600;

/**
 * Порог «почти белого» при удалении фона. 242 выбран так, чтобы уйти сканерный
 * серый и артефакты JPEG, но остались светлые детали рисунка.
 */
const WHITE_THRESHOLD = 242;

export interface CardTemplateSnapshot {
  canvasWidth: number;
  canvasHeight: number;
  placementArea: Rect;
}

@Injectable()
export class ImageCardRenderService {
  /**
   * Убирает белый фон, делая почти белые пиксели прозрачными.
   *
   * Только детерминированная чистка по порогу, без всякого ИИ: у макета с
   * белыми деталями рисунка она их тоже съест, поэтому по умолчанию выключена
   * и включается осознанно.
   */
  async removeWhiteBackground(input: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    for (let i = 0; i < data.length; i += channels) {
      if (
        data[i] >= WHITE_THRESHOLD &&
        data[i + 1] >= WHITE_THRESHOLD &&
        data[i + 2] >= WHITE_THRESHOLD
      ) {
        data[i + 3] = 0;
      }
    }

    return sharp(data, {
      raw: { width: info.width, height: info.height, channels },
    })
      .png()
      .toBuffer();
  }

  /**
   * Кладёт принт на шаблон.
   *
   * Принт может свисать за край холста — размещение за область мы разрешаем,
   * это предупреждение, а не запрет. sharp такой композит не принимает,
   * поэтому невидимую часть отрезаем сами и кладём только то, что попадает
   * в кадр.
   */
  async composeCard(options: {
    template: Buffer;
    design: Buffer;
    designWidth: number;
    designHeight: number;
    snapshot: CardTemplateSnapshot;
    transform: CardTransform;
    removeWhite?: boolean;
    /** Длинная сторона результата. Пусто — полный размер холста. */
    longSide?: number;
  }): Promise<Buffer> {
    const { snapshot, transform } = options;
    const canvasW = snapshot.canvasWidth;
    const canvasH = snapshot.canvasHeight;

    const design = options.removeWhite
      ? await this.removeWhiteBackground(options.design)
      : options.design;

    const rect = placementRect(
      { width: options.designWidth, height: options.designHeight },
      snapshot.placementArea,
      transform,
    );
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    // fit: 'fill' безопасен: ширина и высота уже посчитаны с сохранением
    // пропорций, растянуть по одной оси эта пара не может.
    let overlay = await sharp(design)
      .resize(width, height, { fit: 'fill' })
      .png()
      .toBuffer();
    let overlayW = width;
    let overlayH = height;

    if (transform.rotation) {
      const rotated = await sharp(overlay)
        .rotate(transform.rotation, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      overlay = rotated.data;
      overlayW = rotated.info.width;
      overlayH = rotated.info.height;
    }

    const bounds = rotatedBounds(rect, transform.rotation);
    const left = Math.round(bounds.x);
    const top = Math.round(bounds.y);

    const srcLeft = Math.max(0, -left);
    const srcTop = Math.max(0, -top);
    const dstLeft = Math.max(0, left);
    const dstTop = Math.max(0, top);
    const visibleW = Math.min(overlayW - srcLeft, canvasW - dstLeft);
    const visibleH = Math.min(overlayH - srcTop, canvasH - dstTop);

    let composed = sharp(options.template);
    if (visibleW > 0 && visibleH > 0) {
      if (
        srcLeft > 0 ||
        srcTop > 0 ||
        visibleW !== overlayW ||
        visibleH !== overlayH
      ) {
        overlay = await sharp(overlay)
          .extract({
            left: srcLeft,
            top: srcTop,
            width: visibleW,
            height: visibleH,
          })
          .png()
          .toBuffer();
      }
      composed = composed.composite([
        { input: overlay, left: dstLeft, top: dstTop },
      ]);
    }

    let result = composed.png({ compressionLevel: 9 });
    if (options.longSide) {
      result = sharp(await result.toBuffer())
        .resize({
          width: options.longSide,
          height: options.longSide,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 });
    }
    return result.toBuffer();
  }
}
