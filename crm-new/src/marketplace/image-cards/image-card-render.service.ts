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
    const { transform } = options;

    /*
     * Превью собираем сразу в его размере, а не строим полный холст, чтобы
     * потом его уменьшить. Разница большая: карточка 1200 × 1600 — это почти два
     * миллиона точек, превью 450 × 600 — двести семьдесят тысяч. Раньше
     * каждое превью считалось по полному холсту, и на сотне карточек это
     * была основная трата времени.
     *
     * Все координаты пропорциональны, поэтому достаточно уменьшить холст
     * вместе с областью размещения — картинка получится та же, только мельче.
     */
    const k = options.longSide
      ? Math.min(
          1,
          options.longSide /
            Math.max(
              options.snapshot.canvasWidth,
              options.snapshot.canvasHeight,
            ),
        )
      : 1;
    const snapshot: CardTemplateSnapshot =
      k < 1
        ? {
            canvasWidth: Math.max(
              1,
              Math.round(options.snapshot.canvasWidth * k),
            ),
            canvasHeight: Math.max(
              1,
              Math.round(options.snapshot.canvasHeight * k),
            ),
            placementArea: {
              x: options.snapshot.placementArea.x * k,
              y: options.snapshot.placementArea.y * k,
              width: options.snapshot.placementArea.width * k,
              height: options.snapshot.placementArea.height * k,
            },
          }
        : options.snapshot;

    const canvasW = snapshot.canvasWidth;
    const canvasH = snapshot.canvasHeight;

    const template =
      k < 1
        ? await sharp(options.template)
            .resize(canvasW, canvasH, { fit: 'fill' })
            .png({ compressionLevel: 3 })
            .toBuffer()
        : options.template;

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

    let composed = sharp(template);
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

    // Превью показывается на экране и живёт до следующей правки — жать его
    // до последнего байта незачем. Финал уходит наружу, там уровень полный.
    return composed
      .png({ compressionLevel: options.longSide ? 3 : 9 })
      .toBuffer();
  }
}
