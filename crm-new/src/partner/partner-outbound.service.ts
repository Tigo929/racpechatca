import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EnumPartnerSyncStatus,
  EnumProductCategory,
} from 'src/generated/prisma/enums';
import { buildPartnerOrderPayload } from './partner-payload';
import { PartnerSettingsService } from './partner-settings.service';

/**
 * Исходящая отправка заказа исполнителю-партнёру (мы инициируем push).
 *
 * По кнопке шлём POST на PARTNER_WEBHOOK_URL с нашим чистым контрактом
 * (данные заказа + ссылки на ТЗ-фото и стикер, которые партнёр качает с
 * нашего API по X-Partner-Token). Ошибки не бросаем наружу как 500, а
 * фиксируем в partnerSync-полях заказа, чтобы их было видно и можно было
 * повторить.
 */
@Injectable()
export class PartnerOutboundService {
  private readonly logger = new Logger(PartnerOutboundService.name);
  private readonly webhookUrl: string;
  private readonly webhookToken: string;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PartnerSettingsService,
    config: ConfigService,
  ) {
    this.webhookUrl = config.get<string>('PARTNER_WEBHOOK_URL') || '';
    this.webhookToken = config.get<string>('PARTNER_WEBHOOK_TOKEN') || '';
    this.publicBaseUrl = config.get<string>('PUBLIC_BASE_URL') || '';
  }

  async sendOrder(orderId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new BadRequestException(
        'Партнёру отправляются только заказы с футболками',
      );
    }
    if (order.tshirtItems.length === 0) {
      throw new BadRequestException('В заказе нет позиций-футболок');
    }
    if (!order.techSpecPhotoPath) {
      throw new BadRequestException(
        'Сначала прикрепите ТЗ-фото (согласованный макет), затем отправляйте',
      );
    }

    const externalRequestId = order.externalRequestId ?? randomUUID();
    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        externalRequestId,
        partnerSyncStatus: EnumPartnerSyncStatus.PENDING,
        partnerSyncError: null,
      },
    });

    if (!this.webhookUrl) {
      return this.markFailed(
        orderId,
        'PARTNER_WEBHOOK_URL не задан — некуда отправлять. Настройте вебхук партнёра.',
      );
    }

    const { partnerRateBasisPoints } = await this.settings.get();
    const payload = {
      event: 'tshirt_order.ready',
      external_request_id: externalRequestId,
      order: buildPartnerOrderPayload(
        order,
        this.publicBaseUrl,
        partnerRateBasisPoints,
      ),
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.webhookToken
            ? { 'X-Partner-Token': this.webhookToken }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const body = await res.text();
      if (!res.ok) {
        this.logger.error(
          `Partner: заказ ${order.numberOrder} отклонён [${res.status}]: ${body.slice(0, 300)}`,
        );
        return this.markFailed(
          orderId,
          `Партнёр ответил HTTP ${res.status}: ${body.slice(0, 300) || 'без тела'}`,
        );
      }

      this.logger.log(`Partner: заказ ${order.numberOrder} отправлен`);
      return this.prisma.orderPhoto.update({
        where: { id: orderId },
        data: {
          partnerSyncStatus: EnumPartnerSyncStatus.SENT,
          partnerSyncAt: new Date(),
          partnerSyncError: null,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TimeoutError'
          ? 'Партнёр не ответил за 15 секунд'
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.error(
        `Partner: сетевая ошибка при отправке заказа ${order.numberOrder}: ${message}`,
      );
      return this.markFailed(orderId, message);
    }
  }

  private markFailed(orderId: string, error: string) {
    return this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.FAILED,
        partnerSyncError: error,
      },
    });
  }
}
