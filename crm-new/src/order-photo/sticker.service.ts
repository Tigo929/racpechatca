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
const SOCIAL_LINKS: { url: string; label: string }[] = [
  { url: 'https://t.me/photo_avito', label: 'Связь' },
  { url: 'https://t.me/raspichatka', label: 'Наш канал' },
  { url: 'https://instagram.com/raspe4atka', label: 'Instagram' },
];

// Роботовский woff лежит в node_modules (roboto-fontface — прод-зависимость).
// Резолвим через package.json пакета, чтобы путь работал и в dev, и в Docker.
const req = createRequire(__filename);
const FONT_DIR = path.join(
  path.dirname(req.resolve('roboto-fontface/package.json')),
  'fonts',
  'roboto',
);

// Термоэтикетка 58×40 мм. PDFKit работает в пунктах: 1 мм = 72/25.4 pt.
const MM = 72 / 25.4;
const PAGE_W = 58 * MM; // ≈ 164.4 pt
const PAGE_H = 40 * MM; // ≈ 113.4 pt
const MARGIN = 5;

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
    const M = 4;
    const contentW = PAGE_W - M * 2;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      // Нижний отступ 0: координаты на этикетке задаём вручную, а любой
      // автоматический перенос строки превратил бы стикер в несколько страниц.
      const doc = new PDFDocument({
        size: [PAGE_W, PAGE_H],
        margins: { top: M, bottom: 0, left: M, right: M },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', fonts.regular);
      doc.registerFont('medium', fonts.medium);

      doc.font('medium').fontSize(8.5).text(`№ ${order.numberOrder}`, M, 3, {
        width: contentW,
        align: 'center',
        lineBreak: false,
      });
      doc.font('regular').fontSize(6).text('Спасибо за обращение!', M, 13, {
        width: contentW,
        align: 'center',
        lineBreak: false,
      });

      doc
        .moveTo(M, 22)
        .lineTo(PAGE_W - M, 22)
        .lineWidth(0.6)
        .stroke();

      // Состав: две позиции, остальное сворачиваем — место под QR важнее.
      const lines = buildPhotoItemLines(order);
      const shown = lines.slice(0, 2);
      let y = 25;
      doc.font('regular').fontSize(6);
      for (const line of shown) {
        doc.text(line, M, y, {
          width: contentW,
          lineBreak: false,
          ellipsis: true,
        });
        y += 6.5;
      }
      if (lines.length > shown.length) {
        doc.text(`+ ещё ${lines.length - shown.length} поз.`, M, y, {
          width: contentW,
          lineBreak: false,
        });
      }

      // Самовывоз — сумма к доплате. Доставка — пустая линия, номер вписывают
      // от руки, пока не подключён API службы доставки.
      if (isPickup) {
        doc
          .font('medium')
          .fontSize(8)
          .text(`К оплате: ${formatRub(rest)}`, M, 44, {
            width: contentW,
            lineBreak: false,
          });
      } else {
        doc
          .font('regular')
          .fontSize(6.5)
          .text('Доставка №', M, 45, { lineBreak: false });
        doc
          .moveTo(M + 40, 52)
          .lineTo(PAGE_W - M, 52)
          .lineWidth(0.6)
          .stroke();
      }

      const qrSize = 44;
      const qrY = 58;
      qrCodes.forEach((png, i) => {
        const centerX = M + (contentW * (2 * i + 1)) / 6;
        const x = centerX - qrSize / 2;
        doc.image(png, x, qrY, { width: qrSize, height: qrSize });
        doc
          .font('regular')
          .fontSize(5.5)
          .text(SOCIAL_LINKS[i].label, x, qrY + qrSize + 0.5, {
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
