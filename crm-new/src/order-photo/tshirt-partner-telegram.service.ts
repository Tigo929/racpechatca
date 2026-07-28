import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { TelegramService } from 'src/telegram/telegram.service';
import { TelegramStickerLinkService } from 'src/telegram/telegram-sticker-link.service';
import {
  EnumPartnerSyncStatus,
  EnumPrintLocation,
  EnumPrintType,
} from 'src/generated/prisma/enums';
import { buildPartnerCaption, buildPartnerButtons } from 'src/order-photo/partner-telegram-format';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
import { settleOrder, settlePosition } from 'src/partner/partner-settlement';
import { getTechSpecPaths } from 'src/partner/tech-spec-paths';

const PRINT_LOCATION_LABELS: Record<EnumPrintLocation, string> = {
  FRONT: 'Грудь',
  BACK: 'Спина',
  FRONT_BACK: 'Грудь + спина',
  SLEEVE_LEFT: 'Левый рукав',
  SLEEVE_RIGHT: 'Правый рукав',
  FULL: 'Полная запечатка',
  BY_TZ: 'По ТЗ',
};

const PRINT_TYPE_LABELS: Record<EnumPrintType, string> = {
  DTF: 'DTF',
  DTG: 'DTG',
  SILK: 'Шелкография',
  SUBLIMATION: 'Сублимация',
};

const EXT_CONTENT_TYPE: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

type TshirtOrderWithItems = Prisma.OrderPhotoGetPayload<{
  include: { tshirtItems: true };
}>;

interface TechSpecAttachment {
  filename: string;
  buffer: Buffer;
  contentType: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

@Injectable()
export class TshirtPartnerTelegramService {
  private readonly logger = new Logger(TshirtPartnerTelegramService.name);
  private readonly chatId: string;
  private readonly threadId: string;
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly partnerSettings: PartnerSettingsService,
    private readonly stickerLinks: TelegramStickerLinkService,
    config: ConfigService,
  ) {
    this.chatId = (
      config.get<string>('TSHIRT_PARTNER_TELEGRAM_CHAT_ID') ?? ''
    ).trim();
    this.threadId = (
      config.get<string>('TSHIRT_PARTNER_TELEGRAM_THREAD_ID') ?? ''
    ).trim();
    this.uploadDir =
      config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
  }

  async sendOrder(orderId: string): Promise<void> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { tshirtItems: true },
    });
    if (!order) return;

    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.PENDING,
        partnerSyncError: null,
      },
    });

    if (!this.chatId) {
      await this.markFailed(
        orderId,
        'TSHIRT_PARTNER_TELEGRAM_CHAT_ID не задан — некуда отправлять ТЗ.',
      );
      return;
    }
    const filenames = getTechSpecPaths(order).map((filename) =>
      path.basename(filename),
    );
    if (filenames.length === 0) {
      await this.markFailed(orderId, 'ТЗ-фото не прикреплено.');
      return;
    }

    try {
      const caption = await this.buildMessage(order, filenames.length);
      const stickerUrl = this.stickerLinks.buildStickerUrl(orderId);
      if (!stickerUrl) {
        await this.markFailed(
          orderId,
          'PUBLIC_BASE_URL или секрет для ссылки на стикер не задан.',
        );
        return;
      }
      const replyMarkup = this.buildStatusButtons(orderId, stickerUrl);
      const attachments = await Promise.all(
        filenames.map((filename) => this.readTechSpecFile(filename)),
      );

      const sentTechSpec =
        attachments.length === 1
          ? await this.sendTechSpecFile(attachments[0], caption, replyMarkup)
          : await this.sendTechSpecBundle(
              order,
              attachments,
              caption,
              replyMarkup,
            );
      if (sentTechSpec === false) {
        await this.markFailed(orderId, 'Telegram не принял ТЗ-файл.');
        return;
      }

      await this.prisma.orderPhoto.update({
        where: { id: orderId },
        data: {
          partnerSyncStatus: EnumPartnerSyncStatus.SENT,
          partnerSyncAt: new Date(),
          partnerSyncError: null,
          partnerTgChatId: this.chatId,
          partnerTgMessageId: typeof sentTechSpec === 'number' ? sentTechSpec : null,
          executorSentAt: new Date(),
          sourceRevision: { increment: 1 },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Не удалось отправить ТЗ заказа ${order.numberOrder} в Telegram: ${message}`,
      );
      await this.markFailed(orderId, message);
    }
  }

  private buildStatusButtons(orderId: string, stickerUrl: string) {
    return buildPartnerButtons(orderId, stickerUrl);
  }

  private async readTechSpecFile(
    filename: string,
  ): Promise<TechSpecAttachment> {
    const buffer = await fs.readFile(path.join(this.uploadDir, filename));
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return {
      filename,
      buffer,
      contentType: EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream',
    };
  }

  private async sendTechSpecFile(
    file: TechSpecAttachment,
    caption: string,
    replyMarkup?: unknown,
  ): Promise<boolean> {
    return file.contentType === 'application/pdf'
      ? this.telegram.sendDocument(
          this.chatId,
          file.buffer,
          file.filename,
          file.contentType,
          caption,
          this.threadId || undefined,
          replyMarkup,
        )
      : this.telegram.sendPhoto(
          this.chatId,
          file.buffer,
          file.filename,
          file.contentType,
          caption,
          this.threadId || undefined,
          replyMarkup,
        );
  }

  private async sendTechSpecBundle(
    order: TshirtOrderWithItems,
    attachments: TechSpecAttachment[],
    caption: string,
    replyMarkup: unknown,
  ): Promise<boolean> {
    const bundle = await this.buildTechSpecBundle(order, attachments);
    return this.telegram.sendDocument(
      this.chatId,
      bundle.buffer,
      bundle.filename,
      bundle.contentType,
      caption,
      this.threadId || undefined,
      replyMarkup,
    );
  }

  private async buildTechSpecBundle(
    order: TshirtOrderWithItems,
    attachments: TechSpecAttachment[],
  ): Promise<TechSpecAttachment> {
    const pdf = await PDFDocument.create();

    for (const attachment of attachments) {
      if (attachment.contentType === 'application/pdf') {
        const source = await PDFDocument.load(attachment.buffer);
        const pages = await pdf.copyPages(source, source.getPageIndices());
        pages.forEach((page) => pdf.addPage(page));
        continue;
      }

      const image = await sharp(attachment.buffer)
        .rotate()
        .jpeg({ quality: 92 })
        .toBuffer();
      const embedded = await pdf.embedJpg(image);
      const [pageWidth, pageHeight] =
        embedded.width >= embedded.height ? [841.89, 595.28] : [595.28, 841.89];
      const margin = 28;
      const scale = Math.min(
        (pageWidth - margin * 2) / embedded.width,
        (pageHeight - margin * 2) / embedded.height,
      );
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
      });
    }

    const bytes = await pdf.save();
    return {
      filename: `techspec-${order.numberOrder}.pdf`,
      buffer: Buffer.from(bytes),
      contentType: 'application/pdf',
    };
  }

  private async buildMessage(
    order: TshirtOrderWithItems,
    attachmentCount: number,
  ): Promise<string> {
    const settings = await this.partnerSettings.get();
    const settlement = settleOrder(
      order.tshirtItems.map((i) => ({
        pricePosition: i.pricePosition,
        designCost: i.designCost,
        quantity: i.quantity,
        thermalCost: i.thermalCost,
        blankCost: i.blankCost,
        clientItem: i.clientItem,
      })),
      settings.partnerRateBasisPoints,
    );

    const items = order.tshirtItems.flatMap((item, index) => {
      const productionPrice = item.pricePosition - item.designCost;
      const positionSettlement = settlePosition(
        {
          pricePosition: item.pricePosition,
          designCost: item.designCost,
          quantity: item.quantity,
          thermalCost: item.thermalCost,
          blankCost: item.blankCost,
          clientItem: item.clientItem,
        },
        settings.partnerRateBasisPoints,
      );
      return [
        `${index + 1}) ${escapeHtml(item.color)} ${escapeHtml(item.size)} ×${item.quantity}, ${escapeHtml(PRINT_LOCATION_LABELS[item.printLocation] ?? item.printLocation)}, ${escapeHtml(PRINT_TYPE_LABELS[item.printType] ?? item.printType)}`,
        `   Без дизайна: <b>${money(productionPrice)}</b>; футболка: ${item.clientItem ? '0 ₽' : money(item.blankCost * item.quantity)}; печать: ${money(item.thermalCost * item.quantity)}; доля: ${money(positionSettlement.partnerProfit)}`,
      ];
    });

    return [
      `🧾 <b>Заказ на футболку</b>`,
      `Заказ: <b>${escapeHtml(order.numberOrder)}</b>`,
      ...(order.tshirtModel
        ? [`Модель: ${escapeHtml(order.tshirtModel)}`]
        : []),
      ...(attachmentCount > 1
        ? [`ТЗ: <b>${attachmentCount} файлов в одном PDF</b>`]
        : []),
      '',
      ...items,
      '',
      '<b>Расчёт для исполнителя</b>',
      `Без дизайна: <b>${money(
        settlement.tshirtRevenue -
          order.tshirtItems.reduce((s, i) => s + i.designCost, 0),
      )}</b>`,
      `Материалы: ${money(settlement.materials)}`,
      `Доля (${settings.partnerRateBasisPoints / 100}%): <b>${money(settlement.partnerProfit)}</b>`,
      `К выплате: <b>${money(settlement.reward)}</b>`,
    ].join('\n');
  }

  private async markFailed(orderId: string, error: string): Promise<void> {
    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.FAILED,
        partnerSyncError: error,
      },
    });
  }
}
