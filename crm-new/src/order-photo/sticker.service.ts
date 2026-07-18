import {
  BadRequestException,
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
  EnumTshirtSize,
} from 'src/generated/prisma/enums';

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
}
