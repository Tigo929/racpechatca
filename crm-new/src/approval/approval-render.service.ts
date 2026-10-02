import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import sharp from 'sharp';
import type { EnumApprovalSide } from 'src/generated/prisma/enums';
import {
  formatSizeCm,
  printRect,
  rotatedBounds,
  type PrintAreaCalibration,
} from './approval-geometry';
import type { ApprovalSideState } from './approval-state';
import { ApprovalStorageService } from './approval-storage.service';

/**
 * Отрисовка листа согласования.
 *
 * Рендер серверный, а не браузерный, намеренно: итоговый файл уходит клиенту
 * и на производство, поэтому он не должен зависеть от того, какой у сотрудника
 * браузер, экран и масштаб системы. Браузер во время работы показывает
 * то же самое в уменьшенном виде — но файл собирается здесь и в полном
 * разрешении.
 */

/**
 * Лист A4 АЛЬБОМНОЙ ориентации при 200 dpi.
 *
 * Был книжный, стал альбомный — из-за принтов. Принт на футболке чаще
 * широкий и низкий («PAPA» — 28 × 10 см), и на книжной странице он
 * занимал узкую полосу посередине, а сверху и снизу оставалось пустое
 * место. Печатник смотрит именно на принт, и ему нужен размер на экране,
 * а не поля.
 */
const SHEET_W = 2339;
const SHEET_H = 1654;
const PADDING = 90;
const CONTENT_W = SHEET_W - PADDING * 2;

/**
 * Страница стороны: мокап слева, данные заказа справа.
 *
 * Фотография изделия вертикальная, и на альбомной странице она занимает
 * левую треть, оставляя место под подписи. На книжной они стояли друг под
 * другом, и половина данных уезжала под сгиб листа.
 */
const SIDE_MOCKUP_LEFT = PADDING;
const SIDE_MOCKUP_TOP = 250;
const SIDE_MOCKUP_W = 900;
const SIDE_MOCKUP_H = 1240;

const INFO_X = PADDING + SIDE_MOCKUP_W + 150;
const INFO_TOP = 330;
const ROW_H = 76;
const LABEL_X = INFO_X;
const VALUE_X = INFO_X + 430;

/**
 * Шрифт листа. DejaVu ставится в образ бэкенда (см. Dockerfile) — в alpine
 * своих шрифтов нет, и без него кириллица превратилась бы в пустые квадраты.
 * Дальше по списку — то, что найдётся на машине разработчика под Windows.
 */
const FONT = "'DejaVu Sans','Roboto','Segoe UI','Arial',sans-serif";

const INK = '#111827';
const MUTED = '#6b7280';
/** Плашка стикера: синий фон, чёрный текст — просили именно так. */
const STICKER_BG = '#bfdbfe';
const STICKER_BOX_W = 260;
const STICKER_BOX_H = 56;
const STICKER_LABEL = 'Стикер';
const LINE = '#d1d5db';

export interface RenderSideInput {
  side: EnumApprovalSide;
  state: ApprovalSideState;
  template: PrintAreaCalibration & {
    imageFile: string | null;
    imageWidth: number | null;
    imageHeight: number | null;
  };
}

export interface RenderSheetInput {
  /**
   * Номер, которым заказ назван на листе. У заказа с маркетплейса это номер
   * площадки: лист смотрит покупатель, и наш внутренний номер ему ничего
   * не говорит. Кто именно его выбирает — см. displayOrderNumber.
   */
  numberOrder: string;
  /**
   * Последние цифры стикера на посылке — только у заказов с площадки.
   *
   * Лист согласования у такого заказа читает не покупатель, а печатник:
   * он печатает футболку и кладёт её к нужной коробке. Полный номер
   * отправления на столе упаковки не сверяют, сверяют хвост — его видно
   * с расстояния вытянутой руки.
   */
  sticker?: string | null;
  /**
   * Артикул площадки у этой позиции: «JDM-1-1-black-S».
   *
   * Печатник сверяет его с карточкой Ozon — из цвета и размера артикул
   * обратно не собрать, в нём есть ещё код принта. Заменяет строку
   * с размером принта: размер виден на самом макете, а артикул больше
   * взять неоткуда.
   */
  article?: string | null;
  /**
   * Лист заказа с площадки. Его читает печатник, а не покупатель, и часть
   * подписей ему не нужна: размер принта он видит на самом макете, а
   * согласовывать с ним нечего.
   */
  marketplace?: boolean;
  version: number;
  shirtColor: string;
  shirtSizeLabel: string;
  /** Печать на изделии заказчика: своей футболки в заказе нет. */
  clientItem?: boolean;
  comment: string | null;
  date: Date;
  sides: RenderSideInput[];
}

/**
 * Страница принта — вторая страница листа.
 *
 * Зачем она нужна. На первой странице принт показан на фотографии футболки:
 * так его согласуют — видно, как вещь будет выглядеть. Но печатнику нужно
 * другое: что именно печатать. На мокапе принт занимает ладонь, лежит на
 * складках и под цветом ткани; мелкие надписи и тонкие линии на нём не
 * разобрать, а ошибиться в принте дороже, чем в цвете футболки.
 *
 * Поэтому принт повторяется отдельной страницей — один, крупно, на сером
 * поле (белый принт на белой бумаге иначе не виден) и с подписанным
 * реальным размером печати. Первая страница при этом не меняется.
 *
 * Страниц столько, сколько сторон с принтом: у заказа с печатью на спине
 * будет три страницы — согласование, перед, спина.
 */
// Поля принтов начинаются ниже линии заголовка: над каждым стоит подпись
// стороны, и ей нужно место, иначе она ложится прямо на линию.
const PRINTS_TOP = 320;
const PRINTS_BOX_H = 1030;
/** Серое поле под принтом: без него белый принт на листе не разглядеть. */
const PRINT_BACKDROP = '#eef1f5';
/** Отступ принта от края своего поля — чтобы он не упирался в рамку. */
const PRINT_INSET = 40;

const SIDE_LABELS: Record<EnumApprovalSide, string> = {
  FRONT: 'Лицевая сторона',
  BACK: 'Спина',
};

@Injectable()
export class ApprovalRenderService {
  private readonly logger = new Logger(ApprovalRenderService.name);

  constructor(private readonly storage: ApprovalStorageService) {}

  /**
   * Фотография мокапа с наложенным принтом, в полном разрешении фотографии.
   *
   * Наложение здесь простое — принт кладётся поверх ткани (уровень 1 по ТЗ).
   * Точка расширения для реалистичного режима — блок composite ниже: чтобы
   * принт лёг по складкам, туда добавится карта смещения и маска теней, а
   * геометрия и всё остальное останутся прежними.
   */
  async composeMockup(input: RenderSideInput): Promise<Buffer> {
    const { state, template } = input;
    if (!template.imageFile) {
      throw new InternalServerErrorException('У шаблона мокапа нет фотографии');
    }

    const mockupBuf = await this.storage.readMockup(template.imageFile);
    const meta = await sharp(mockupBuf).metadata();
    const mockupW = meta.width ?? 0;
    const mockupH = meta.height ?? 0;
    if (!mockupW || !mockupH) {
      throw new InternalServerErrorException('Фотография мокапа повреждена');
    }

    if (!state.printFile) return mockupBuf;

    const calibration = scaleCalibration(template, mockupW);
    const rect = printRect(state, calibration);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const printBuf = await this.storage.readPrint(state.printFile);

    // fit: 'fill' здесь безопасен: ширина и высота уже посчитаны из
    // физического размера, а пропорции принта держит сам редактор.
    let overlay = await sharp(printBuf)
      .resize(width, height, { fit: 'fill' })
      .png()
      .toBuffer();
    let overlayW = width;
    let overlayH = height;

    if (state.rotation) {
      const rotated = await sharp(overlay)
        .rotate(state.rotation, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      overlay = rotated.data;
      overlayW = rotated.info.width;
      overlayH = rotated.info.height;
    }

    const bounds = rotatedBounds(rect, state.rotation);
    const left = Math.round(bounds.left);
    const top = Math.round(bounds.top);

    // Принт может свисать за край фотографии — выход за зону мы разрешаем.
    // sharp такой композит не принимает, поэтому невидимую часть отрезаем
    // сами и кладём только то, что попадает в кадр.
    const srcLeft = Math.max(0, -left);
    const srcTop = Math.max(0, -top);
    const dstLeft = Math.max(0, left);
    const dstTop = Math.max(0, top);
    const visibleW = Math.min(overlayW - srcLeft, mockupW - dstLeft);
    const visibleH = Math.min(overlayH - srcTop, mockupH - dstTop);
    if (visibleW <= 0 || visibleH <= 0) return mockupBuf;

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

    return sharp(mockupBuf)
      .composite([{ input: overlay, left: dstLeft, top: dstTop }])
      .png()
      .toBuffer();
  }

  /**
   * Готовый лист согласования.
   *
   * Страниц столько, сколько смыслов: по странице на каждую сторону изделия
   * и одна на принты. Односторонняя печать — две страницы: изделие с
   * принтом и сам принт. Двусторонняя — три: лицевая, спина и оба принта
   * вместе, чтобы печатник видел их рядом и не перепутал местами.
   *
   * Складывать всё на один лист было бы короче, но на нём ничего не найти:
   * мокап, данные заказа и два принта в одной куче читаются хуже, чем три
   * страницы с одной мыслью на каждой.
   *
   * Все страницы — в одном файле: лист уходит в Telegram одним изображением
   * и скачивается одной кнопкой. Отдельные файлы заставили бы человека
   * следить, что он взял все.
   */
  async renderSheet(input: RenderSheetInput): Promise<Buffer> {
    const sides = input.sides;
    const printSides = sides.filter((side) => side.state.printFile);
    const pages = sides.length + (printSides.length > 0 ? 1 : 0);
    if (pages === 0) {
      throw new InternalServerErrorException(
        'Согласование пустое: нечего печатать',
      );
    }

    /*
     * Предел Telegram: лист уходит туда фотографией, а у неё сумма сторон
     * не больше 10 000 точек. Альбомные страницы — 2339 в ширину, значит
     * потолок примерно четыре страницы (2339 + 6616 = 8955). Сторон у
     * изделия сейчас две, то есть максимум три страницы, — запас есть.
     * Появятся рукава — лист придётся слать документом, а не фотографией.
     */
    const sheetHeight = SHEET_H * pages;
    const composites: sharp.OverlayOptions[] = [];
    const layers: sharp.OverlayOptions[] = [];

    // Страницы сторон: мокап слева, данные заказа справа.
    for (const [index, side] of sides.entries()) {
      const pageTop = SHEET_H * index;
      const mockup = await this.composeMockup(side);
      const fitted = await sharp(mockup)
        .resize(SIDE_MOCKUP_W, SIDE_MOCKUP_H, {
          fit: 'inside',
          withoutEnlargement: false,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      composites.push({
        input: fitted.data,
        left: Math.round(
          SIDE_MOCKUP_LEFT + (SIDE_MOCKUP_W - fitted.info.width) / 2,
        ),
        top:
          Math.round(
            SIDE_MOCKUP_TOP + (SIDE_MOCKUP_H - fitted.info.height) / 2,
          ) + pageTop,
      });
      layers.push({
        input: Buffer.from(this.buildSidePageLayer(input, side, index, pages)),
        left: 0,
        top: pageTop,
      });
    }

    // Последняя страница — принты. Порядок слоёв важен: сначала серое поле,
    // на него принт, и только потом подписи, иначе поле закрыло бы оба.
    if (printSides.length > 0) {
      const pageTop = SHEET_H * sides.length;
      const boxes = printBoxes(printSides.length);
      for (const [index, side] of printSides.entries()) {
        const box = boxes[index];
        if (!box) break;
        composites.push({
          input: Buffer.from(backdropLayer(box)),
          left: 0,
          top: pageTop,
        });
        const printBuf = await this.storage.readPrint(side.state.printFile!);
        const fitted = await sharp(printBuf)
          .resize(box.width - PRINT_INSET * 2, box.height - PRINT_INSET * 2, {
            fit: 'inside',
            withoutEnlargement: false,
          })
          .png()
          .toBuffer({ resolveWithObject: true });
        composites.push({
          input: fitted.data,
          left: Math.round(box.left + (box.width - fitted.info.width) / 2),
          top:
            Math.round(box.top + (box.height - fitted.info.height) / 2) +
            pageTop,
        });
      }
      layers.push({
        input: Buffer.from(
          this.buildPrintsPageLayer(input, printSides, boxes, pages),
        ),
        left: 0,
        top: pageTop,
      });
    }

    composites.push(...layers);

    try {
      return await sharp({
        create: {
          width: SHEET_W,
          height: sheetHeight,
          channels: 4,
          background: '#ffffff',
        },
      })
        .composite(composites)
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.error('Не удалось собрать лист согласования', error as Error);
      throw new InternalServerErrorException(
        'Не удалось сформировать файл согласования',
      );
    }
  }

  /**
   * Страница одной стороны изделия: как она будет выглядеть, и все данные
   * заказа рядом.
   *
   * Данные повторяются на каждой странице стороны намеренно. Страницы
   * печатают и раскладывают по столу поодиночке, и страница без номера
   * заказа и стикера становится бесполезной картинкой.
   */
  private buildSidePageLayer(
    input: RenderSheetInput,
    side: RenderSideInput,
    index: number,
    pages: number,
  ): string {
    const parts: string[] = [];

    parts.push(
      text('СОГЛАСОВАНИЕ ПЕЧАТИ', PADDING, 130, {
        size: 54,
        weight: 700,
        spacing: 2,
      }),
      text(
        `${SIDE_LABELS[side.side]} · заказ № ${input.numberOrder} · версия ${input.version} · страница ${index + 1} из ${pages}`,
        PADDING,
        192,
        { size: 30, fill: MUTED },
      ),
      line(PADDING, 228, SHEET_W - PADDING, 228),
      text(
        SIDE_LABELS[side.side],
        SIDE_MOCKUP_LEFT + SIDE_MOCKUP_W / 2,
        SIDE_MOCKUP_TOP + SIDE_MOCKUP_H + 70,
        { size: 36, weight: 600, anchor: 'middle' },
      ),
    );

    const rows: [string, string][] = input.clientItem
      ? [
          ['Заказ №', input.numberOrder],
          ...(input.sticker
            ? ([[STICKER_LABEL, `…${input.sticker}`]] as [string, string][])
            : []),
          // Изделие принёс клиент — цвет и размер футболки тут ни при чём,
          // на них печатник ориентироваться не должен.
          ['Изделие', 'Клиента'],
          ['Работа', 'Печать на изделии клиента'],
        ]
      : [
          ['Заказ №', input.numberOrder],
          ...(input.sticker
            ? ([[STICKER_LABEL, `…${input.sticker}`]] as [string, string][])
            : []),
          ['Цвет футболки', input.shirtColor],
          ['Размер футболки', input.shirtSizeLabel],
        ];
    if (input.marketplace) {
      // Размер печати подписан на странице принта, крупно. Здесь место
      // дороже отдать артикулу: его на макете нет, а найти по нему заказ
      // в кабинете площадки получится, по «20 × 25 см» — нет.
      if (input.article) rows.push(['Артикул', input.article]);
    } else {
      rows.push([
        'Размер печати',
        formatSizeCm(side.state.widthMm, side.state.heightMm),
      ]);
    }
    rows.push(['Дата', formatDate(input.date)]);

    rows.forEach(([label, value], rowIndex) => {
      const y = INFO_TOP + rowIndex * ROW_H;
      parts.push(text(label, LABEL_X, y, { size: 32, fill: MUTED }));
      if (label === STICKER_LABEL) {
        // Стикер — единственное, что ищут на листе глазами, не читая:
        // по нему готовую футболку кладут к нужной посылке. Плашка делает
        // его заметным через стол, а чёрный текст на синем остаётся
        // читаемым и на чёрно-белом принтере.
        parts.push(
          rect(VALUE_X - 16, y - 44, STICKER_BOX_W, STICKER_BOX_H, STICKER_BG),
          text(value, VALUE_X, y, { size: 42, weight: 700 }),
        );
        return;
      }
      parts.push(text(value, VALUE_X, y, { size: 34, weight: 600 }));
    });

    if (input.comment) {
      const commentTop = INFO_TOP + rows.length * ROW_H + 30;
      parts.push(
        text('Комментарий', LABEL_X, commentTop, { size: 32, fill: MUTED }),
      );
      wrap(input.comment, 46)
        .slice(0, 5)
        .forEach((chunk, chunkIndex) => {
          parts.push(
            text(chunk, VALUE_X, commentTop + chunkIndex * 46, { size: 30 }),
          );
        });
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">${parts.join('')}</svg>`;
  }

  /**
   * Последняя страница: сами принты.
   *
   * У двусторонней печати они стоят рядом, слева перед и справа спина —
   * в том же порядке, в каком идут страницы сторон. Рядом, а не на разных
   * страницах, потому что перепутать их местами проще всего именно здесь,
   * и видеть оба сразу — защита от этого.
   */
  private buildPrintsPageLayer(
    input: RenderSheetInput,
    sides: RenderSideInput[],
    boxes: Box[],
    pages: number,
  ): string {
    const parts: string[] = [];
    const title = sides.length > 1 ? 'ПРИНТЫ ДЛЯ ПЕЧАТИ' : 'ПРИНТ ДЛЯ ПЕЧАТИ';

    parts.push(
      text(title, PADDING, 130, { size: 54, weight: 700, spacing: 2 }),
      text(
        `Заказ № ${input.numberOrder} · версия ${input.version} · страница ${pages} из ${pages}`,
        PADDING,
        192,
        { size: 30, fill: MUTED },
      ),
      line(PADDING, 228, SHEET_W - PADDING, 228),
    );

    for (const [index, side] of sides.entries()) {
      const box = boxes[index];
      if (!box) break;
      const centerX = box.left + box.width / 2;
      const sizeLabel = formatSizeCm(side.state.widthMm, side.state.heightMm);
      const dpi = printDpi(side.state.printWidthPx, side.state.widthMm);
      const notes = [
        dpi ? `${dpi} dpi` : null,
        side.state.printOriginalName,
      ].filter((v): v is string => Boolean(v));

      parts.push(
        `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="12" fill="none" stroke="${LINE}" stroke-width="2"/>`,
        text(SIDE_LABELS[side.side], centerX, box.top - 26, {
          size: 34,
          weight: 600,
          anchor: 'middle',
          fill: MUTED,
        }),
        text(`Размер печати: ${sizeLabel}`, centerX, box.top + box.height + 80, {
          size: 50,
          weight: 700,
          anchor: 'middle',
        }),
      );
      if (notes.length) {
        parts.push(
          text(notes.join('  ·  '), centerX, box.top + box.height + 134, {
            size: 28,
            fill: MUTED,
            anchor: 'middle',
          }),
        );
      }
    }

    const footer = [
      input.article ? `Артикул: ${input.article}` : null,
      `Заказ № ${input.numberOrder}`,
    ].filter((v): v is string => Boolean(v));
    parts.push(
      text(footer.join('  ·  '), PADDING, SHEET_H - 72, {
        size: 30,
        fill: MUTED,
      }),
    );

    if (input.sticker) {
      // Та же плашка, что на страницах сторон: по ней готовую вещь кладут
      // к нужной посылке, и искать её глазами должно быть одинаково легко.
      const boxLeft = SHEET_W - PADDING - STICKER_BOX_W;
      const boxTop = SHEET_H - 112;
      parts.push(
        rect(boxLeft, boxTop, STICKER_BOX_W, STICKER_BOX_H, STICKER_BG),
        text(
          `${STICKER_LABEL} …${input.sticker}`,
          boxLeft + STICKER_BOX_W / 2,
          boxTop + 40,
          { size: 36, weight: 700, anchor: 'middle' },
        ),
      );
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">${parts.join('')}</svg>`;
  }
}

/** Прямоугольник на странице: куда ложится принт и где его рамка. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Куда встают принты на последней странице.
 *
 * Один занимает всю ширину листа — именно ради этого лист и стал альбомным.
 * Два делят её пополам: слева перед, справа спина, в том же порядке, что и
 * страницы сторон. Порядок важнее симметрии: перепутанные местами принты
 * означают футболку с чужим рисунком на спине.
 */
function printBoxes(count: number): Box[] {
  if (count <= 0) return [];
  if (count === 1) {
    return [
      { left: PADDING, top: PRINTS_TOP, width: CONTENT_W, height: PRINTS_BOX_H },
    ];
  }
  const gap = 60;
  const width = Math.round((CONTENT_W - gap) / 2);
  return [
    { left: PADDING, top: PRINTS_TOP, width, height: PRINTS_BOX_H },
    { left: PADDING + width + gap, top: PRINTS_TOP, width, height: PRINTS_BOX_H },
  ];
}

/**
 * Калибровка под фактический размер фотографии.
 *
 * Зона печати задавалась в пикселях того файла, который был на момент
 * калибровки. Если фотографию заменили на другую по размеру, координаты
 * пересчитываются пропорционально — иначе рамка уехала бы, и никто не понял
 * бы почему.
 */
function scaleCalibration(
  template: PrintAreaCalibration & { imageWidth: number | null },
  actualWidth: number,
): PrintAreaCalibration {
  const reference = template.imageWidth ?? actualWidth;
  if (!reference || reference === actualWidth) return template;
  const k = actualWidth / reference;
  return {
    printAreaX: template.printAreaX * k,
    printAreaY: template.printAreaY * k,
    printAreaWidth: template.printAreaWidth * k,
    printAreaHeight: template.printAreaHeight * k,
    printAreaWidthMm: template.printAreaWidthMm,
    printAreaHeightMm: template.printAreaHeightMm,
  };
}

/** Серое поле под принт: отдельным слоем, потому что ложится ПОД изображение. */
function backdropLayer(box: Box): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">` +
    `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="12" fill="${PRINT_BACKDROP}"/>` +
    `</svg>`
  );
}

/**
 * Фактическая плотность печати. Ноль — размер или разрешение неизвестны;
 * в этом случае строку не печатаем вовсе: «0 dpi» читается как поломка.
 */
function printDpi(pixels: number, widthMm: number): number {
  if (pixels <= 0 || widthMm <= 0) return 0;
  return Math.round(pixels / (widthMm / 25.4));
}

function text(
  value: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    weight?: number;
    fill?: string;
    anchor?: 'start' | 'middle' | 'end';
    spacing?: number;
  } = {},
): string {
  const anchor = opts.anchor ?? 'start';
  const spacing = opts.spacing ? ` letter-spacing="${opts.spacing}"` : '';
  return (
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${opts.size ?? 30}"` +
    ` font-weight="${opts.weight ?? 400}" fill="${opts.fill ?? INK}"` +
    ` text-anchor="${anchor}"${spacing}>${escapeXml(value)}</text>`
  );
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${fill}"/>`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="2"/>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Простой перенос по словам: у SVG-текста своего переноса нет. */
function wrap(value: string, limit: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > limit) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
