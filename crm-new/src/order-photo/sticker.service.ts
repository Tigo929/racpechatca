import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { toBuffer as barcodeToBuffer } from 'bwip-js';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EnumDeliveryMethod,
  EnumPrintLocation,
  EnumProductCategory,
  EnumRole,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';

/**
 * Соцсети на клиентском стикере. Меняются здесь — попадут на все новые стикеры.
 * Ссылки короткие намеренно: чем меньше символов, тем крупнее модули QR, а на
 * термопринтере это решает, прочитается код или нет.
 */
const SOCIAL_LINKS: {
  url: string;
  label: string;
  icon: 'telegram' | 'instagram';
}[] = [
  { url: 'https://t.me/photo_avito', label: 'Связь', icon: 'telegram' },
  // Внимание: у канала в Telegram ник с двумя «a» на конце, у Instagram —
  // с одной. Их легко перепутать при правке.
  { url: 'https://t.me/raspe4atkaa', label: 'Наш канал', icon: 'telegram' },
  {
    url: 'https://instagram.com/raspe4atka',
    label: 'Instagram',
    icon: 'instagram',
  },
];

/**
 * Акция на клиентском стикере. Порядок строк выбран под конверсию: сначала
 * выгода, затем кого отметить, затем срок. Тексты меняются здесь — блок
 * считает свою высоту сам, поэтому длину можно править свободно.
 */
const PROMO_MAIN =
  'Репост в сторис — 20 фото Polaroid бесплатно к следующему заказу + бесплатная доставка';
const PROMO_TAGS = 'Instagram: @raspe4atka · Telegram: @raspe4atkaa';
const PROMO_NOTE = 'Успейте в течение 7 дней · условия у менеджера';

// Роботовский woff лежит в node_modules (roboto-fontface — прод-зависимость).
// Резолвим через package.json пакета, чтобы путь работал и в dev, и в Docker.
const req = createRequire(__filename);
const FONT_DIR = path.join(
  path.dirname(req.resolve('roboto-fontface/package.json')),
  'fonts',
  'roboto',
);

// Термоэтикетка 58×40 мм для производственного стикера футболок.
// PDFKit работает в пунктах: 1 мм = 72/25.4 pt.
const MM = 72 / 25.4;
const PAGE_W = 58 * MM; // ≈ 164.4 pt
const PAGE_H = 40 * MM; // ≈ 113.4 pt
const MARGIN = 5;

// Клиентский стикер печатается на 100×150 мм (XP-420B тянет до 108 мм).
// Такой ширины хватает, чтобы три QR встали в ряд по ~27 мм — при 203 dpi это
// ~4.4 точки на модуль, то есть коды уверенно считываются.
const CLIENT_PAGE_W = 100 * MM; // ≈ 283.5 pt
const CLIENT_PAGE_H = 150 * MM; // ≈ 425.2 pt

const SIZE_LABELS: Record<EnumTshirtSize, string> = {
  XS: 'XS',
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
  XXL: 'XXL',
  XXXL: '3XL',
};

const PRINT_LOCATION_LABELS: Record<EnumPrintLocation, string> = {
  FRONT: 'Грудь',
  BACK: 'Спина',
  FRONT_BACK: 'Двусторонняя',
  SLEEVE_LEFT: 'Левый рукав',
  SLEEVE_RIGHT: 'Правый рукав',
  FULL: 'Полная запечатка',
  BY_TZ: 'По ТЗ',
};

/** «1 500 ₽» — группировка тысяч неразрывным пробелом, без зависимости от ICU. */
function formatRub(n: number): string {
  const grouped = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} ₽`;
}

@Injectable()
export class StickerService {
  constructor(private readonly prisma: PrismaService) {}

  // Шрифты читаем один раз и кэшируем в памяти процесса.
  private fontCache: { regular: Buffer; medium: Buffer } | null = null;

  private loadFonts(): { regular: Buffer; medium: Buffer } {
    if (!this.fontCache) {
      this.fontCache = {
        regular: fs.readFileSync(path.join(FONT_DIR, 'Roboto-Regular.woff')),
        medium: fs.readFileSync(path.join(FONT_DIR, 'Roboto-Medium.woff')),
      };
    }
    return this.fontCache;
  }

  /**
   * Стикер заказа-футболки: № заказа + штрихкод, состав (только позиции-
   * футболки, без свободных), итог и — для самовывоза — предоплата 50% и
   * остаток к оплате при получении.
   */
  async generateTshirtSticker(
    orderId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new BadRequestException('Стикер формируется только для футболок');
    }
    if (order.tshirtItems.length === 0) {
      throw new BadRequestException(
        'В заказе нет позиций-футболок для стикера',
      );
    }

    const isPickup = order.deliveryMethod === EnumDeliveryMethod.PICKUP;
    const total = order.totalOrder ?? 0;
    // Предоплата 50% (как в тексте подтверждения клиенту); остаток при получении.
    const prepay = Math.ceil(total * 0.5);
    const rest = total - prepay;

    const barcodePng = await barcodeToBuffer({
      bcid: 'code128',
      text: order.numberOrder,
      scale: 3,
      height: 7,
      includetext: false,
    });

    const fonts = this.loadFonts();

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', fonts.regular);
      doc.registerFont('medium', fonts.medium);

      const contentW = PAGE_W - MARGIN * 2;

      // № заказа
      doc
        .font('medium')
        .fontSize(9)
        .text(`№ ${order.numberOrder}`, MARGIN, MARGIN, {
          width: contentW,
          align: 'center',
          lineGap: 0,
        });

      // Штрихкод — вписываем по ширине этикетки.
      doc.image(barcodePng, MARGIN, doc.y + 1, {
        fit: [contentW, 20],
        align: 'center',
      });
      doc.y += 22;

      // Позиции-футболки (свободные позиции сюда не попадают).
      doc.font('regular').fontSize(7);
      for (const item of order.tshirtItems) {
        const size = SIZE_LABELS[item.size] ?? item.size;
        const place = PRINT_LOCATION_LABELS[item.printLocation] ?? '';
        doc.text(
          `${item.color} · ${size} · ${place} × ${item.quantity}`,
          MARGIN,
          doc.y,
          { width: contentW, lineGap: 0.5 },
        );
      }

      // Разделитель
      doc.moveDown(0.2);
      const lineY = doc.y;
      doc
        .moveTo(MARGIN, lineY)
        .lineTo(PAGE_W - MARGIN, lineY)
        .lineWidth(0.5)
        .stroke();
      doc.y = lineY + 2;

      // Итог + оплата (предоплата/остаток — только для самовывоза)
      doc.font('medium').fontSize(8);
      doc.text(`Итого: ${formatRub(total)}`, MARGIN, doc.y, {
        width: contentW,
      });
      if (isPickup) {
        doc
          .font('regular')
          .fontSize(7)
          .text(`Предоплата: ${formatRub(prepay)}`, MARGIN, doc.y, {
            width: contentW,
          });
        doc
          .font('medium')
          .fontSize(8)
          .text(`При получении: ${formatRub(rest)}`, MARGIN, doc.y, {
            width: contentW,
          });
      }

      doc.end();
    });

    return { buffer, filename: `sticker-${order.numberOrder}.pdf` };
  }

  /**
   * Клиентский стикер на пакет: номер, благодарность, состав, остаток оплаты
   * (самовывоз) либо пустое поле под номер доставки, и три QR — связь, канал,
   * Instagram. Печатают исполнители на термопринтере, поэтому всё строго
   * чёрно-белое, без полутонов и тонких серых линий.
   */
  async generateClientSticker(
    orderId: string,
    userId: string,
    userRole: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    // Исполнитель печатает стикер только по своему заказу.
    if (userRole === EnumRole.EXECUTOR && order.executorId !== userId) {
      throw new ForbiddenException('Нет доступа к чужому заказу');
    }

    const isPickup = order.deliveryMethod === EnumDeliveryMethod.PICKUP;
    const total = order.totalOrder ?? 0;
    const rest = total - Math.ceil(total * 0.5); // остаток после предоплаты 50%

    // Уровень коррекции L — намеренно самый низкий. На этикетке 58 мм три кода
    // помещаются только мелкими, и крупные модули важнее избыточности: голова
    // термопринтера (203 dpi) просто не пропечатает модуль тоньше ~0.4 мм.
    // eclevel нет в типах bwip-js (там только общие опции), отсюда каст.
    const qrOptions = SOCIAL_LINKS.map(
      (s) =>
        ({
          bcid: 'qrcode',
          text: s.url,
          scale: 5,
          eclevel: 'L',
        }) as Parameters<typeof barcodeToBuffer>[0],
    );
    const qrCodes = await Promise.all(qrOptions.map((o) => barcodeToBuffer(o)));

    const fonts = this.loadFonts();
    const M = 14;
    const contentW = CLIENT_PAGE_W - M * 2;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      // Нижний отступ 0: координаты на этикетке задаём вручную, а любой
      // автоматический перенос строки превратил бы стикер в несколько страниц.
      const doc = new PDFDocument({
        size: [CLIENT_PAGE_W, CLIENT_PAGE_H],
        margins: { top: M, bottom: 0, left: M, right: M },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', fonts.regular);
      doc.registerFont('medium', fonts.medium);

      const centered = { width: contentW, align: 'center' as const };

      // Геометрия нижнего блока соцсетей — считаем заранее, она фиксированная.
      const captionH = 14;
      const iconH = 20;
      const gap = 10;
      const qrSize = (contentW - gap * 2) / 3;
      const qrY = CLIENT_PAGE_H - M - captionH - qrSize;
      const iconY = qrY - iconH - 4;

      // Высоту рамки с акцией измеряем ДО отрисовки состава: от неё зависит,
      // сколько строк позиций поместится. Иначе длинный заказ выдавливает
      // акцию наверх, в текст.
      const promoPad = 9;
      const promoTextW = contentW - promoPad * 2;
      const measure = (
        text: string,
        font: 'regular' | 'medium',
        size: number,
      ): number => {
        doc.font(font).fontSize(size);
        return doc.heightOfString(text, { width: promoTextW, align: 'center' });
      };
      const mainH = measure(PROMO_MAIN, 'medium', 11);
      const tagsH = measure(PROMO_TAGS, 'medium', 9.5);
      const noteH = measure(PROMO_NOTE, 'regular', 8.5);
      const promoH = promoPad * 2 + mainH + 5 + tagsH + 3 + noteH;

      let y = M + 4;

      doc
        .font('medium')
        .fontSize(22)
        .text(`№ ${order.numberOrder}`, M, y, {
          ...centered,
          lineBreak: false,
        });
      y += 28;
      doc
        .font('regular')
        .fontSize(11)
        .text('Спасибо за обращение!', M, y, { ...centered, lineBreak: false });
      y += 20;

      doc
        .moveTo(M, y)
        .lineTo(CLIENT_PAGE_W - M, y)
        .lineWidth(1)
        .stroke();
      y += 10;

      // Сколько строк состава реально влезет: остаток высоты за вычетом
      // разделителя, строки оплаты, рамки акции и зазора до QR.
      const RESERVED_BELOW_ITEMS = 20 + 30 + promoH + 12;
      const MAX_ITEM_LINES = Math.max(
        1,
        Math.min(8, Math.floor((iconY - y - RESERVED_BELOW_ITEMS) / 14)),
      );
      const lines = buildPhotoItemLines(order);
      const overflow = lines.length > MAX_ITEM_LINES;
      const shown = overflow ? lines.slice(0, MAX_ITEM_LINES - 1) : lines;
      doc.font('regular').fontSize(11);
      for (const line of shown) {
        doc.text(line, M, y, {
          width: contentW,
          lineBreak: false,
          ellipsis: true,
        });
        y += 14;
      }
      if (overflow) {
        doc.text(`+ ещё ${lines.length - shown.length} поз.`, M, y, {
          width: contentW,
          lineBreak: false,
        });
        y += 14;
      }

      y += 6;
      doc
        .moveTo(M, y)
        .lineTo(CLIENT_PAGE_W - M, y)
        .lineWidth(1)
        .stroke();
      y += 14;

      // Самовывоз — сумма к доплате. Доставка — линия под номер, который
      // вписывают от руки, пока не подключён API службы доставки.
      if (isPickup) {
        doc
          .font('medium')
          .fontSize(16)
          .text(`К оплате: ${formatRub(rest)}`, M, y, {
            width: contentW,
            lineBreak: false,
          });
        y += 26;
      } else {
        doc
          .font('regular')
          .fontSize(12)
          .text('Доставка №', M, y, { lineBreak: false });
        doc
          .moveTo(M + 72, y + 15)
          .lineTo(CLIENT_PAGE_W - M, y + 15)
          .lineWidth(1)
          .stroke();
        y += 30;
      }

      // Акция в рамке — на неё должен падать взгляд. Высота посчитана выше по
      // фактическому тексту, поэтому формулировки можно менять свободно.
      const promoY = y;
      doc.lineWidth(1.2).rect(M, promoY, contentW, promoH).stroke();

      let py = promoY + promoPad;
      doc
        .font('medium')
        .fontSize(11)
        .text(PROMO_MAIN, M + promoPad, py, {
          width: promoTextW,
          align: 'center',
        });
      py += mainH + 5;
      doc
        .font('medium')
        .fontSize(9.5)
        .text(PROMO_TAGS, M + promoPad, py, {
          width: promoTextW,
          align: 'center',
        });
      py += tagsH + 3;
      doc
        .font('regular')
        .fontSize(8.5)
        .text(PROMO_NOTE, M + promoPad, py, {
          width: promoTextW,
          align: 'center',
        });

      qrCodes.forEach((png, i) => {
        const x = M + i * (qrSize + gap);
        const cx = x + qrSize / 2;
        // Иконки рисуем векторно: на термопечати чистые линии выходят
        // резче любой растровой картинки.
        if (SOCIAL_LINKS[i].icon === 'instagram') {
          drawInstagramIcon(doc, cx - iconH / 2, iconY, iconH);
        } else {
          drawTelegramIcon(doc, cx - iconH / 2, iconY, iconH);
        }
        doc.image(png, x, qrY, { width: qrSize, height: qrSize });
        doc
          .font('regular')
          .fontSize(9)
          .text(SOCIAL_LINKS[i].label, x, qrY + qrSize + 3, {
            width: qrSize,
            align: 'center',
            lineBreak: false,
          });
      });

      doc.end();
    });

    return { buffer, filename: `client-${order.numberOrder}.pdf` };
  }
}

/**
 * Иконки соцсетей рисуем векторно, а не картинкой: термоголова печатает
 * только чистый чёрный, и ровные линии выходят резче любого растра.
 */
function drawTelegramIcon(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  s: number,
): void {
  doc.save();
  doc.lineWidth(s * 0.07);
  doc.circle(x + s / 2, y + s / 2, s / 2 - s * 0.035).stroke();
  // Бумажный самолётик
  doc
    .moveTo(x + s * 0.2, y + s * 0.5)
    .lineTo(x + s * 0.81, y + s * 0.27)
    .lineTo(x + s * 0.66, y + s * 0.76)
    .lineTo(x + s * 0.5, y + s * 0.6)
    .lineTo(x + s * 0.37, y + s * 0.72)
    .lineTo(x + s * 0.37, y + s * 0.56)
    .fill();
  doc.restore();
}

function drawInstagramIcon(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  s: number,
): void {
  const lw = s * 0.08;
  doc.save();
  doc.lineWidth(lw);
  doc.roundedRect(x + lw, y + lw, s - lw * 2, s - lw * 2, s * 0.26).stroke();
  doc.circle(x + s / 2, y + s / 2, s * 0.19).stroke();
  doc.circle(x + s * 0.73, y + s * 0.27, s * 0.05).fill();
  doc.restore();
}

const TYPE_PAPER_LABELS: Record<string, string> = {
  GLOSS: 'Глянец',
  MATTE: 'Матт',
};

/** Строки состава для фото-заказа: «10×15 Глянец × 20 шт». */
function buildPhotoItemLines(order: {
  isFreePrice: boolean | null;
  items: {
    formatPaper: string;
    typePaper: string;
    quantity: number;
    isFreePrice: boolean | null;
  }[];
}): string[] {
  return order.items.map((i) => {
    // У свободных позиций тип бумаги не печатаем — там произвольное название.
    const isFree = order.isFreePrice || i.isFreePrice;
    const type = isFree
      ? ''
      : ` ${TYPE_PAPER_LABELS[i.typePaper] ?? i.typePaper}`;
    return `${i.formatPaper}${type} × ${i.quantity} шт`;
  });
}
