import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { TelegramService } from 'src/telegram/telegram.service';
import {
  EnumDeliveryMethod,
  EnumPartnerSyncStatus,
  EnumPrintLocation,
  EnumPrintType,
} from 'src/generated/prisma/enums';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
import { settleOrder, settlePosition } from 'src/partner/partner-settlement';
import { StickerService } from './sticker.service';

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

const DELIVERY_LABELS: Record<EnumDeliveryMethod, string> = {
  YANDEX_PVZ: 'Яндекс ПВЗ',
  OZON_PVZ: 'Ozon ПВЗ',
  PICKUP: 'Самовывоз',
  OZON_SELLER: 'Ozon Seller',
  WB_SELLER: 'WB Seller',
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
    private readonly sticker: StickerService,
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
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'В работе', callback_data: `tshirt:${order.id}:work` },
            { text: 'Готов', callback_data: `tshirt:${order.id}:ready` },
          ],
          [{ text: 'Не готов', callback_data: `tshirt:${order.id}:not_ready` }],
        ],
      };
      const fileSent =
        contentType === 'application/pdf'
          ? await this.telegram.sendDocument(
              this.chatId,
              buffer,
              filename,
              contentType,
              caption,
              this.threadId || undefined,
              keyboard,
            )
          : await this.telegram.sendPhoto(
              this.chatId,
              buffer,
              filename,
              contentType,
              caption,
              this.threadId || undefined,
              keyboard,
            );

      if (!fileSent) {
        await this.markFailed(orderId, 'Telegram не принял ТЗ-файл.');
        return;
      }

      const sticker = await this.sticker.generateTshirtSticker(orderId);
      const stickerSent = await this.telegram.sendDocument(
        this.chatId,
        sticker.buffer,
        sticker.filename,
        'application/pdf',
        `🏷 Стикер со штрихкодом: <b>${escapeHtml(order.numberOrder)}</b>`,
        this.threadId || undefined,
      );
      if (!stickerSent) {
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
        '',
        `<b>Позиция ${index + 1}</b>`,
        `Цвет: ${escapeHtml(item.color)}`,
        `Размер: ${escapeHtml(item.size)}`,
        `Количество: ${item.quantity}`,
        `Место печати: ${escapeHtml(PRINT_LOCATION_LABELS[item.printLocation] ?? item.printLocation)}`,
        `Тип печати: ${escapeHtml(PRINT_TYPE_LABELS[item.printType] ?? item.printType)}`,
        `Футболка клиента: ${item.clientItem ? 'да' : 'нет'}`,
        `Сумма без дизайна: <b>${money(productionPrice)}</b>`,
        `Футболка: ${item.clientItem ? '0 ₽ (вещь клиента)' : money(item.blankCost * item.quantity)}`,
        `Печать/термо: ${money(item.thermalCost * item.quantity)}`,
        `Материалы позиции: ${money(positionSettlement.materials)}`,
        `Доля исполнителя по позиции: ${money(positionSettlement.partnerProfit)}`,
        ...(item.designUrl
          ? [`Макет/ссылка: ${escapeHtml(item.designUrl)}`]
          : []),
        ...(item.designNote
          ? [`Комментарий к макету: ${escapeHtml(item.designNote)}`]
          : []),
      ];
    });

    return [
      `🧾 <b>Заказ на футболку</b>`,
      `Заказ: <b>${escapeHtml(order.numberOrder)}</b>`,
      ...(order.tshirtModel
        ? [`Модель: ${escapeHtml(order.tshirtModel)}`]
        : []),
      `Доставка: ${escapeHtml(DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod)}`,
      ...(order.note
        ? ['', '<b>Описание/примечание:</b>', escapeHtml(order.note)]
        : []),
      '',
      '<b>Что печатать:</b>',
      ...items,
      '',
      '<b>Расчёт для исполнителя</b>',
      `Сумма футболок без разработки дизайна: <b>${money(
        settlement.tshirtRevenue -
          order.tshirtItems.reduce((s, i) => s + i.designCost, 0),
      )}</b>`,
      `Материалы: ${money(settlement.materials)}`,
      `Делимая маржа: ${money(settlement.margin)}`,
      `Доля исполнителя (${settings.partnerRateBasisPoints / 100}%): <b>${money(
        settlement.partnerProfit,
      )}</b>`,
      `Итого к выплате исполнителю: <b>${money(settlement.reward)}</b>`,
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
