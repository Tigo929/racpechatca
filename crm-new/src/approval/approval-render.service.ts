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
  numberOrder: string;
  version: number;
  shirtColor: string;
  shirtSizeLabel: string;
  comment: string | null;
  author: string | null;
  date: Date;
  sides: RenderSideInput[];
}

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

  /** Готовый лист согласования: мокапы плюс вся техническая информация. */
  async renderSheet(input: RenderSheetInput): Promise<Buffer> {
    const slots = layoutSlots(input.sides.length);
    const composites: sharp.OverlayOptions[] = [];
    const placed: Placement[] = [];

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

    composites.push({
      input: Buffer.from(this.buildTextLayer(input, placed)),
      left: 0,
      top: 0,
    });

    try {
      return await sharp({
        create: {
          width: SHEET_W,
          height: SHEET_H,
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
        text(
          formatSizeCm(side.state.widthMm, side.state.heightMm),
          place.centerX,
          captionTop + 46,
          { size: 30, fill: MUTED, anchor: 'middle' },
        ),
      );
    }

    parts.push(line(PADDING, INFO_TOP - 62, SHEET_W - PADDING, INFO_TOP - 62));

    const rows: [string, string][] = [
      ['Заказ №', input.numberOrder],
      ['Цвет футболки', input.shirtColor],
      ['Размер футболки', input.shirtSizeLabel],
    ];
    for (const side of input.sides) {
      rows.push([
        SIDE_LABELS[side.side],
        formatSizeCm(side.state.widthMm, side.state.heightMm),
      ]);
    }
    rows.push(['Дата', formatDate(input.date)]);
    if (input.author) rows.push(['Исполнитель', input.author]);

    rows.forEach(([label, value], index) => {
      const y = INFO_TOP + index * ROW_H;
      parts.push(
        text(label, LABEL_X, y, { size: 30, fill: MUTED }),
        text(value, VALUE_X, y, { size: 32, weight: 600 }),
      );
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
