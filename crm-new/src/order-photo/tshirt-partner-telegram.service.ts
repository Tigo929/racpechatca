import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { TelegramService } from 'src/telegram/telegram.service';
import { StickerService } from './sticker.service';
import {
  EnumPartnerSyncStatus,
  EnumPrintLocation,
  EnumPrintType,
} from 'src/generated/prisma/enums';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
import { settleOrder, settlePosition } from 'src/partner/partner-settlement';

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
    private readonly stickerService: StickerService,
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
    if (!order.techSpecPhotoPath) {
      await this.markFailed(orderId, 'ТЗ-фото не прикреплено.');
      return;
    }

    try {
      const filename = path.basename(order.techSpecPhotoPath);
      const buffer = await fs.readFile(path.join(this.uploadDir, filename));
      const ext = filename.split('.').pop()?.toLowerCase() ?? '';
      const contentType = EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream';
      const caption = await this.buildMessage(order);
      const sticker = await this.stickerService.generateTshirtSticker(
        orderId,
        contentType.startsWith('image/')
          ? { buffer, contentType }
          : undefined,
      );

      const sent = await this.telegram.sendDocument(
        this.chatId,
        sticker.buffer,
        sticker.filename,
        'application/pdf',
        caption,
        this.threadId || undefined,
        this.buildStatusButtons(orderId),
      );
      if (!sent) {
        await this.markFailed(orderId, 'Telegram не принял PDF-стикер.');
        return;
      }

      await this.prisma.orderPhoto.update({
        where: { id: orderId },
        data: {
          partnerSyncStatus: EnumPartnerSyncStatus.SENT,
          partnerSyncAt: new Date(),
          partnerSyncError: null,
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

  private buildStatusButtons(orderId: string) {
    return {
      inline_keyboard: [
        [
          {
            text: 'В работе',
            callback_data: `tshirt:${orderId}:work`,
          },
          {
            text: 'Готово',
            callback_data: `tshirt:${orderId}:ready`,
          },
        ],
        [
          {
            text: 'Не готов',
            callback_data: `tshirt:${orderId}:not_ready`,
          },
        ],
      ],
    };
  }

  private async buildMessage(order: TshirtOrderWithItems): Promise<string> {
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
