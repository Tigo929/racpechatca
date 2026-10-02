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

/** Лист A4 книжной ориентации при 200 dpi. */
const SHEET_W = 1654;
const SHEET_H = 2339;
const PADDING = 90;
const CONTENT_W = SHEET_W - PADDING * 2;

/** Полоса под мокапы — примерно половина листа, остальное под данные заказа. */
const MOCKUP_TOP = 300;
const MOCKUP_H = 1080;
const MOCKUP_GAP = 40;

const INFO_TOP = 1570;
const ROW_H = 66;
const LABEL_X = PADDING;
const VALUE_X = PADDING + 470;

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
const PRINT_PAGE_TOP = 320;
const PRINT_PAGE_BOX_H = 1480;
/** Серое поле под принтом: без него белый принт на листе не разглядеть. */
const PRINT_BACKDROP = '#eef1f5';
const PRINT_CAPTION_TOP = PRINT_PAGE_TOP + PRINT_PAGE_BOX_H + 120;

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
   * Готовый лист согласования: страница согласования плюс по странице на
   * каждый принт.
   *
   * Высота холста кратна листу A4: страницы идут одна под другой в одном
   * файле. Отдельными файлами было бы хуже — лист уходит в Telegram одним
   * изображением и скачивается одной кнопкой, и разделять его значит
   * заставить человека следить, что он взял оба.
   */
  async renderSheet(input: RenderSheetInput): Promise<Buffer> {
    const slots = layoutSlots(input.sides.length);
    const composites: sharp.OverlayOptions[] = [];
    const placed: Placement[] = [];
    const printPages = input.sides.filter((side) => side.state.printFile);
    /*
     * Страниц максимум три: согласование плюс перед и спина. Это не
     * случайное ограничение, а предел Telegram: лист уходит туда как фото,
     * а у фото сумма сторон не больше 10 000 точек. Три страницы дают
     * 1654 + 7017 = 8671 — проходит; четвёртая дала бы 11 010, и Telegram
     * молча откажется принимать файл. Если страниц когда-нибудь станет
     * больше (ещё стороны, рукава), лист придётся отправлять документом,
     * а не фото.
     */
    const sheetHeight = SHEET_H * (1 + printPages.length);

    for (const [index, side] of input.sides.entries()) {
      const slot = slots[index];
      if (!slot) break;
      const mockup = await this.composeMockup(side);
      const fitted = await sharp(mockup)
        .resize(slot.width, slot.height, {
          fit: 'inside',
          withoutEnlargement: false,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      // Внутри слота мокап центрируем: у переда и спины пропорции кадра
      // могут чуть отличаться, а стоять они должны ровно.
      const left = Math.round(slot.left + (slot.width - fitted.info.width) / 2);
      const top = Math.round(slot.top + (slot.height - fitted.info.height) / 2);
      composites.push({ input: fitted.data, left, top });
      placed.push({
        centerX: slot.left + slot.width / 2,
        bottom: top + fitted.info.height,
      });
    }

    // Страницы принта. Порядок слоёв важен: сначала серое поле, на него
    // принт, и только потом подписи — иначе поле закрыло бы и то, и другое.
    const pageLayers: sharp.OverlayOptions[] = [];
    for (const [index, side] of printPages.entries()) {
      const pageTop = SHEET_H * (index + 1);
      composites.push({
        input: Buffer.from(backdropLayer()),
        left: 0,
        top: pageTop,
      });

      const printBuf = await this.storage.readPrint(side.state.printFile!);
      const fitted = await sharp(printBuf)
        .resize(CONTENT_W, PRINT_PAGE_BOX_H, {
          fit: 'inside',
          withoutEnlargement: false,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      composites.push({
        input: fitted.data,
        left: Math.round(PADDING + (CONTENT_W - fitted.info.width) / 2),
        top: Math.round(
          PRINT_PAGE_TOP + (PRINT_PAGE_BOX_H - fitted.info.height) / 2,
        ) + pageTop,
      });

      pageLayers.push({
        input: Buffer.from(this.buildPrintPageLayer(input, side)),
        left: 0,
        top: pageTop,
      });
    }

    composites.push({
      input: Buffer.from(this.buildTextLayer(input, placed)),
      left: 0,
      top: 0,
    });
    composites.push(...pageLayers);

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
   * Подписи страницы принта: что печатаем, в каком размере и к какому заказу.
   *
   * Размер печати здесь — главное число страницы, поэтому он набран крупно
   * и стоит сразу под принтом. Рядом — плотность: по ней печатник видит,
   * хватает ли исходнику разрешения на этот размер, не открывая файл.
   * Стикер и артикул повторены с первой страницы: страницы печатают и
   * раскладывают по столу поодиночке, и вторая должна опознаваться сама.
   */
  private buildPrintPageLayer(
    input: RenderSheetInput,
    side: RenderSideInput,
  ): string {
    const parts: string[] = [];
    const sizeLabel = formatSizeCm(side.state.widthMm, side.state.heightMm);

    parts.push(
      text('ПРИНТ ДЛЯ ПЕЧАТИ', PADDING, 130, {
        size: 54,
        weight: 700,
        spacing: 2,
      }),
      text(
        `${SIDE_LABELS[side.side]} · заказ № ${input.numberOrder}`,
        PADDING,
        195,
        { size: 32, fill: MUTED },
      ),
      line(PADDING, 235, SHEET_W - PADDING, 235),
      // Рамка поля: показывает границы листа принта, но сам принт не трогает.
      `<rect x="${PADDING}" y="${PRINT_PAGE_TOP}" width="${CONTENT_W}" height="${PRINT_PAGE_BOX_H}" rx="12" fill="none" stroke="${LINE}" stroke-width="2"/>`,
      text(`Размер печати: ${sizeLabel}`, SHEET_W / 2, PRINT_CAPTION_TOP, {
        size: 56,
        weight: 700,
        anchor: 'middle',
      }),
    );

    const dpi = printDpi(side.state.printWidthPx, side.state.widthMm);
    const notes = [
      dpi ? `Плотность: ${dpi} dpi` : null,
      input.article ? `Артикул: ${input.article}` : null,
      side.state.printOriginalName,
    ].filter((v): v is string => Boolean(v));
    if (notes.length) {
      parts.push(
        text(notes.join('  ·  '), SHEET_W / 2, PRINT_CAPTION_TOP + 62, {
          size: 30,
          fill: MUTED,
          anchor: 'middle',
        }),
      );
    }

    if (input.sticker) {
      // Та же плашка, что на первой странице: по ней готовую вещь кладут
      // к нужной посылке, и искать её глазами должно быть одинаково легко.
      const boxLeft = Math.round((SHEET_W - STICKER_BOX_W) / 2);
      const boxTop = PRINT_CAPTION_TOP + 110;
      parts.push(
        rect(boxLeft, boxTop, STICKER_BOX_W, STICKER_BOX_H, STICKER_BG),
        text(`${STICKER_LABEL} …${input.sticker}`, SHEET_W / 2, boxTop + 40, {
          size: 36,
          weight: 700,
          anchor: 'middle',
        }),
      );
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">${parts.join('')}</svg>`;
  }

  /** Текстовый слой листа: заголовок, подписи мокапов и блок данных заказа. */
  private buildTextLayer(input: RenderSheetInput, placed: Placement[]): string {
    const parts: string[] = [];

    parts.push(
      text('СОГЛАСОВАНИЕ ПЕЧАТИ', PADDING, 130, {
        size: 54,
        weight: 700,
        spacing: 2,
      }),
      text(
        `Заказ № ${input.numberOrder} · версия ${input.version}`,
        PADDING,
        195,
        { size: 32, fill: MUTED },
      ),
      line(PADDING, 235, SHEET_W - PADDING, 235),
    );

    // Подписи под мокапами: сторона и её реальный размер печати. Отсчёт идёт
    // от фактического низа снимков, а не от границы слота: кадр редко
    // заполняет отведённое место целиком, и подпись иначе повисает в воздухе.
    // Строка у переда и спины общая, чтобы подписи стояли на одной линии.
    const captionTop =
      Math.max(...placed.map((p) => p.bottom), MOCKUP_TOP) + 54;
    for (const [index, side] of input.sides.entries()) {
      const place = placed[index];
      if (!place) break;
      parts.push(
        text(SIDE_LABELS[side.side], place.centerX, captionTop, {
          size: 34,
          weight: 600,
          anchor: 'middle',
        }),
        // Размер печати подписываем только там, где его согласуют.
        // На листе для печатника он лишний: размер виден на макете.
        ...(input.marketplace
          ? []
          : [
              text(
                formatSizeCm(side.state.widthMm, side.state.heightMm),
                place.centerX,
                captionTop + 46,
                { size: 30, fill: MUTED, anchor: 'middle' },
              ),
            ]),
      );
    }

    parts.push(line(PADDING, INFO_TOP - 62, SHEET_W - PADDING, INFO_TOP - 62));

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
      // Размер принта строкой не печатаем: он виден на самом макете, а место
      // в таблице дороже отдать артикулу — артикула на макете нет, и найти
      // по нему заказ в кабинете получится, а по «20 × 25 см» нет.
      if (input.article) rows.push(['Артикул', input.article]);
    } else {
      for (const side of input.sides) {
        rows.push([
          SIDE_LABELS[side.side],
          formatSizeCm(side.state.widthMm, side.state.heightMm),
        ]);
      }
    }
    // Кто собирал макет, в лист не выносим: клиенту это не нужно, а в
    // базе автор всё равно записан (PrintApproval.createdById).
    rows.push(['Дата', formatDate(input.date)]);

    rows.forEach(([label, value], index) => {
      const y = INFO_TOP + index * ROW_H;
      parts.push(text(label, LABEL_X, y, { size: 30, fill: MUTED }));
      if (label === STICKER_LABEL) {
        // Стикер — единственное, что ищут на листе глазами, не читая:
        // по нему готовую футболку кладут к нужной посылке. Плашка делает
        // его заметным через стол, а чёрный текст на синем остаётся
        // читаемым и на чёрно-белом принтере.
        parts.push(
          rect(VALUE_X - 16, y - 40, STICKER_BOX_W, STICKER_BOX_H, STICKER_BG),
          text(value, VALUE_X, y, { size: 40, weight: 700 }),
        );
        return;
      }
      parts.push(text(value, VALUE_X, y, { size: 32, weight: 600 }));
    });

    if (input.comment) {
      const commentTop = INFO_TOP + rows.length * ROW_H + 20;
      parts.push(
        text('Комментарий', LABEL_X, commentTop, { size: 30, fill: MUTED }),
      );
      wrap(input.comment, 62)
        .slice(0, 4)
        .forEach((chunk, index) => {
          parts.push(
            text(chunk, VALUE_X, commentTop + index * 42, { size: 28 }),
          );
        });
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">${parts.join('')}</svg>`;
  }
}

interface Slot {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Куда фактически лёг мокап — по этому месту выставляются подписи. */
interface Placement {
  centerX: number;
  bottom: number;
}

/**
 * Куда встают мокапы. Одна сторона занимает лист целиком по центру, две —
 * делят его пополам: перед слева, спина справа, как их и смотрит клиент.
 */
function layoutSlots(count: number): Slot[] {
  if (count <= 0) return [];
  if (count === 1) {
    const width = Math.round(CONTENT_W * 0.62);
    return [
      {
        left: Math.round((SHEET_W - width) / 2),
        top: MOCKUP_TOP,
        width,
        height: MOCKUP_H,
      },
    ];
  }
  const width = Math.round((CONTENT_W - MOCKUP_GAP) / 2);
  return [
    { left: PADDING, top: MOCKUP_TOP, width, height: MOCKUP_H },
    {
      left: PADDING + width + MOCKUP_GAP,
      top: MOCKUP_TOP,
      width,
      height: MOCKUP_H,
    },
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
function backdropLayer(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${SHEET_H}">` +
    `<rect x="${PADDING}" y="${PRINT_PAGE_TOP}" width="${CONTENT_W}" height="${PRINT_PAGE_BOX_H}" rx="12" fill="${PRINT_BACKDROP}"/>` +
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
