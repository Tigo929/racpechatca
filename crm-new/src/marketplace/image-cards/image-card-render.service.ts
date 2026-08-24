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
 * Потолок длинной стороны готовой карточки.
 *
 * Не ограничение ради ограничения, а два факта. Первый: у Ozon лимит на
 * файл — 10 МБ, а карточка с шаблона 4000 px весит около 17 МБ, то есть
 * площадка её просто не примет. Второй: сборка такой карточки занимает три
 * секунды против четверти секунды у двухтысячной — на сотне карточек это
 * разница между пятью минутами и сорока секундами.
 *
 * 2000 по длинной стороне — это 1500 × 2000 при пропорции 3:4, вдвое выше
 * минимума Ozon для одежды (900 × 1200). Меняется здесь одним числом.
 */
export const FINAL_LONG_SIDE = 2000;

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

/**
 * Сколько разобранных шаблонов держать в памяти.
 *
 * За один заход их ровно четыре: два цвета в двух размерах, превью и финал.
 * Шесть — с запасом. Самый крупный весит около девяти мегабайт, так что
 * весь кэш укладывается в пару десятков даже при полке в 1.6 ГБ у сервера.
 */
const TEMPLATE_CACHE_SIZE = 6;

/**
 * Сколько разобранных дизайнов держать в памяти.
 *
 * Двух хватает: карточки идут подряд по исходнику — чёрная, потом белая, —
 * и обе берут один дизайн. Сырой дизайн весит около шестнадцати мегабайт,
 * так что больше держать и не стоит.
 */
const DESIGN_CACHE_SIZE = 2;

interface RawImage {
  data: Buffer;
  // Тип каналов у sharp свой (1..4), обычное число он не принимает.
  info: { width: number; height: number; channels: 1 | 2 | 3 | 4 };
}

@Injectable()
export class ImageCardRenderService {
  /**
   * Разобранные шаблоны в сырых пикселях.
   *
   * Без кэша один и тот же PNG разбирался заново на каждую карточку: сотня
   * карточек — сотня декодов файла в семнадцать мегабайт. Замерено на
   * шаблоне 4000 x 5333: композит с декодом занимает 429 мс, из готовых
   * пикселей — 188 мс.
   */
  private readonly templates = new Map<string, RawImage>();

  /**
   * Разобранные дизайны в сырых пикселях.
   *
   * Тот же приём, что и с шаблонами: декод PNG дизайна стоит 132 мс, а из
   * готовых пикселей тот же кадр берётся за 27 мс. Один дизайн идёт в две
   * карточки, у каждой превью и финал.
   */
  private readonly designs = new Map<string, RawImage>();

  /**
   * Забыть разобранный дизайн исходника.
   *
   * Нужно после повторной обработки файла: растр переписан, а в памяти
   * осталась картинка от прошлого раза. Ключ начинается с идентификатора
   * исходника, поэтому чистим по началу ключа — вариантов у него два, с
   * убранным белым фоном и без.
   */
  forgetDesign(sourceId: string): void {
    for (const key of this.designs.keys()) {
      if (key.startsWith(`${sourceId}:`)) this.designs.delete(key);
    }
  }

  /** Кладёт в кэш, вытесняя самое старое: записей единицы, LRU тут лишний. */
  private remember(
    cache: Map<string, RawImage>,
    key: string,
    value: RawImage,
    limit: number,
  ): void {
    if (cache.size >= limit) {
      // Первый ключ итератора Map — самый давний из добавленных.
      const [oldest] = cache.keys();
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, value);
  }

  /** Дизайн в сырых пикселях, как он пришёл, без изменения размера. */
  private async designRaw(design: Buffer, key?: string): Promise<RawImage> {
    if (key) {
      const hit = this.designs.get(key);
      if (hit) return hit;
    }
    const prepared = await sharp(design)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image: RawImage = {
      data: prepared.data,
      info: {
        width: prepared.info.width,
        height: prepared.info.height,
        channels: prepared.info.channels,
      },
    };
    if (key) this.remember(this.designs, key, image, DESIGN_CACHE_SIZE);
    return image;
  }

  /**
   * Шаблон в сырых пикселях нужного размера. Файл читается только при
   * промахе кэша — иначе мы бы ещё и с диска тянули его на каждую карточку.
   */
  private async templateRaw(
    source: Buffer | (() => Promise<Buffer>),
    width: number,
    height: number,
    key?: string,
  ): Promise<RawImage> {
    const cacheKey = key ? `${key}:${width}x${height}` : null;
    if (cacheKey) {
      const hit = this.templates.get(cacheKey);
      if (hit) return hit;
    }

    const buffer = typeof source === 'function' ? await source() : source;
    const prepared = await sharp(buffer)
      .resize(width, height, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image: RawImage = {
      data: prepared.data,
      info: {
        width: prepared.info.width,
        height: prepared.info.height,
        channels: prepared.info.channels,
      },
    };

    if (cacheKey) {
      this.remember(this.templates, cacheKey, image, TEMPLATE_CACHE_SIZE);
    }
    return image;
  }

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

    // Промежуточный файл, который тут же читают обратно: жать его сильно
    // незачем, а быстрый уровень экономит заметную долю времени на пачке.
    return sharp(data, {
      raw: { width: info.width, height: info.height, channels },
    })
      .png({ compressionLevel: 3 })
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
    /** Готовый буфер либо ленивое чтение: при попадании в кэш файл не читаем. */
    template: Buffer | (() => Promise<Buffer>);
    /** Ключ шаблона для кэша. Пусто — считаем без кэша (так удобно тестам). */
    templateKey?: string;
    /** Ключ дизайна для кэша. Пусто — тоже без кэша. */
    designKey?: string;
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

    const template = await this.templateRaw(
      options.template,
      canvasW,
      canvasH,
      options.templateKey,
    );

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

    /*
     * Принт готовим в сырых пикселях, а не в PNG.
     *
     * Раньше между изменением размера, поворотом и обрезкой он трижды
     * кодировался в PNG и трижды разбирался обратно — только чтобы передать
     * его дальше по конвейеру. На сложной картинке кодирование PNG стоит
     * дороже самого наложения, а результат этих промежуточных файлов никто
     * никогда не видел.
     */
    // fit: 'fill' безопасен: ширина и высота уже посчитаны с сохранением
    // пропорций, растянуть по одной оси эта пара не может.
    const designRaw = await this.designRaw(design, options.designKey);
    let pipeline = sharp(designRaw.data, { raw: designRaw.info }).resize(
      width,
      height,
      { fit: 'fill' },
    );
    if (transform.rotation) {
      pipeline = pipeline.rotate(transform.rotation, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }
    const prepared = await pipeline.raw().toBuffer({ resolveWithObject: true });

    let overlay = prepared.data;
    let overlayW = prepared.info.width;
    let overlayH = prepared.info.height;
    const overlayChannels = prepared.info.channels;

    const bounds = rotatedBounds(rect, transform.rotation);
    const left = Math.round(bounds.x);
    const top = Math.round(bounds.y);

    const srcLeft = Math.max(0, -left);
    const srcTop = Math.max(0, -top);
    const dstLeft = Math.max(0, left);
    const dstTop = Math.max(0, top);
    const visibleW = Math.min(overlayW - srcLeft, canvasW - dstLeft);
    const visibleH = Math.min(overlayH - srcTop, canvasH - dstTop);

    let composed = sharp(template.data, { raw: template.info });
    if (visibleW > 0 && visibleH > 0) {
      if (
        srcLeft > 0 ||
        srcTop > 0 ||
        visibleW !== overlayW ||
        visibleH !== overlayH
      ) {
        overlay = await sharp(overlay, {
          raw: {
            width: overlayW,
            height: overlayH,
            channels: overlayChannels,
          },
        })
          .extract({
            left: srcLeft,
            top: srcTop,
            width: visibleW,
            height: visibleH,
          })
          .raw()
          .toBuffer();
        overlayW = visibleW;
        overlayH = visibleH;
      }
      composed = composed.composite([
        {
          input: overlay,
          raw: {
            width: overlayW,
            height: overlayH,
            channels: overlayChannels,
          },
          left: dstLeft,
          top: dstTop,
        },
      ]);
    }

    /*
     * Уровень сжатия 6, а не 9.
     *
     * PNG сжимает без потерь на любом уровне — разница только в весе файла и
     * во времени. Замерено на шаблоне 4000 × 5333: уровень 9 занимает 2283 мс
     * и даёт 17,5 МБ, уровень 6 — 914 мс и 17,9 МБ. Два процента веса за
     * две с половиной кратную скорость.
     */
    return composed
      .png({ compressionLevel: options.longSide === PREVIEW_LONG_SIDE ? 3 : 6 })
      .toBuffer();
  }
}
