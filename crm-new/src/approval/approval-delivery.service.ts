import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApprovalStorageService } from './approval-storage.service';
import {
  approvalCaption,
  approvalRecipient,
  deliverySelect,
} from './approval-delivery-state';
import { CompleteApprovalDeliveryDto } from './dto/approval-delivery.dto';
import { displayOrderNumber } from '../order-photo/order-number';

@Injectable()
export class ApprovalDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ApprovalStorageService,
  ) {}

  async enqueue(approvalId: string, requestedById: string) {
    const approval = await this.prisma.printApproval.findUnique({
      where: { id: approvalId },
      include: {
        order: {
          select: {
            numberOrder: true,
            marketplaceOrderNumber: true,
            communicationPlatform: true,
            urlCommunication: true,
          },
        },
        telegramDelivery: { select: deliverySelect },
      },
    });
    if (!approval) throw new NotFoundException('Согласование не найдено');
    if (approval.order.communicationPlatform !== 'TELEGRAM')
      throw new BadRequestException(
        'В заказе должен быть выбран способ связи Telegram',
      );
    if (
      approval.telegramDelivery &&
      approval.telegramDelivery.status !== 'FAILED'
    )
      return approval.telegramDelivery;
    const recipient = approvalRecipient(approval.order.urlCommunication);
    if (!recipient)
      throw new BadRequestException(
        'Укажите в заказе Telegram клиента: @username или https://t.me/username',
      );
    if (
      !approval.previewFile ||
      !approval.finalizedAt ||
      approval.updatedAt > approval.finalizedAt
    ) {
      throw new BadRequestException(
        'Сначала сформируйте актуальный макет кнопкой «Готово»',
      );
    }
    if (!['READY', 'CHANGES_REQUESTED'].includes(approval.status))
      throw new BadRequestException(
        'Этот макет уже отправлен или согласован. Создайте новую версию',
      );
    const image = await sharp(
      await this.storage.readSheet(approval.previewFile),
    )
      .flatten({ background: '#ffffff' })
      .resize({
        width: 2560,
        height: 2560,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 95 })
      .toBuffer();
    if (image.length > 10 * 1024 * 1024)
      throw new BadRequestException('Изображение слишком большое для Telegram');

    return this.prisma.$transaction(async (tx) => {
      // Serializes simultaneous clicks across API instances. Recheck the revision
      // after reading the file so a concurrent edit cannot enqueue an old sheet.
      await tx.$queryRaw`SELECT "id" FROM "PrintApproval" WHERE "id" = ${approvalId} FOR UPDATE`;
      const current = await tx.printApproval.findUnique({
        where: { id: approvalId },
        include: { order: true },
      });
      if (
        !current ||
        current.updatedAt.getTime() !== approval.updatedAt.getTime() ||
        current.order.communicationPlatform !== 'TELEGRAM' ||
        current.order.urlCommunication !== approval.order.urlCommunication
      ) {
        throw new ConflictException(
          'Данные изменились. Обновите карточку и повторите отправку',
        );
      }
      const existing = await tx.approvalTelegramDelivery.findUnique({
        where: { approvalId },
        select: deliverySelect,
      });
      if (existing && existing.status !== 'FAILED') return existing;
      const data = {
        recipient,
        // Сообщение читает покупатель: заказ с площадки называем её номером.
        caption: approvalCaption(
          displayOrderNumber(approval.order),
          approval.version,
        ),
        image: new Uint8Array(image),
        requestedById,
        finalizedAt: approval.finalizedAt!,
        status: 'PENDING' as const,
        createdAt: new Date(),
        claimToken: null,
        claimedAt: null,
        sentAt: null,
        messageId: null,
        errorCode: null,
      };
      return tx.approvalTelegramDelivery.upsert({
        where: { approvalId },
        create: { approvalId, ...data },
        update: data,
        select: deliverySelect,
      });
    });
  }

  async claim(claimToken: string) {
    // A lost worker response is ambiguous. Never automatically repeat its send.
    await this.prisma.approvalTelegramDelivery.updateMany({
      where: {
        status: 'SENDING',
        claimedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
      data: { status: 'UNKNOWN', errorCode: 'uncertain' },
    });
    return this.prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "ApprovalTelegramDelivery" WHERE "status" = 'PENDING'
        ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!ids.length) return null;
      return tx.approvalTelegramDelivery.update({
        where: { id: ids[0].id },
        data: { status: 'SENDING', claimToken, claimedAt: new Date() },
        select: { id: true, recipient: true, caption: true },
      });
    });
  }

  async image(id: string, claimToken: string) {
    const row = await this.prisma.approvalTelegramDelivery.findFirst({
      where: { id, claimToken, status: 'SENDING' },
      select: { image: true },
    });
    if (!row) throw new NotFoundException('Отправка не найдена или завершена');
    return Buffer.from(row.image);
  }

  async complete(id: string, dto: CompleteApprovalDeliveryDto) {
    if (dto.status === 'SENT' && !dto.messageId)
      throw new BadRequestException('Не указан номер сообщения Telegram');
    if (
      dto.status === 'FAILED' &&
      (!dto.errorCode || dto.errorCode === 'uncertain')
    )
      throw new BadRequestException('Не указан подтверждённый отказ');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.approvalTelegramDelivery.findFirst({
        where: { id, claimToken: dto.claimToken },
      });
      if (!row) throw new NotFoundException('Отправка не найдена');
      if (['SENT', 'FAILED'].includes(row.status)) return { ok: true };
      const updated = await tx.approvalTelegramDelivery.updateMany({
        where: {
          id,
          claimToken: dto.claimToken,
          status: { in: ['SENDING', 'UNKNOWN'] },
        },
        data: {
          status: dto.status,
          messageId: dto.messageId ?? null,
          sentAt: dto.status === 'SENT' ? new Date() : null,
          errorCode:
            dto.status === 'SENT' ? null : (dto.errorCode ?? 'uncertain'),
        },
      });
      if (updated.count && dto.status === 'SENT') {
        // Delivery metadata must not make an unchanged image appear outdated,
        // nor overwrite a later customer approval or manager edit.
        const approvalUpdated = await tx.printApproval.updateMany({
          where: {
            id: row.approvalId,
            finalizedAt: row.finalizedAt,
            updatedAt: row.finalizedAt,
            status: { in: ['READY', 'CHANGES_REQUESTED'] },
          },
          data: { status: 'SENT', updatedAt: row.finalizedAt },
        });
        if (approvalUpdated.count) {
          const approval = await tx.printApproval.findUnique({
            where: { id: row.approvalId },
            select: { orderId: true },
          });
          const order = approval && await tx.orderPhoto.findUnique({
            where: { id: approval.orderId },
            select: { id: true, status: true, productCategory: true },
          });
          // A delayed Telegram callback must never move production or closed
          // orders backwards. Only the pre-production stages can advance.
          if (order?.productCategory === 'TSHIRT' &&
            ['LEAD', 'NEW', 'FOLDER_STRUCTURE_CREATED', 'PRINTED'].includes(order.status)) {
            const changed = await tx.orderPhoto.updateMany({
              where: { id: order.id, status: order.status },
              data: { status: 'APPROVAL_SENT' },
            });
            if (changed.count) await tx.statusHistory.create({
              data: {
                orderId: order.id,
                fromStatus: order.status,
                toStatus: 'APPROVAL_SENT',
                changedBy: row.requestedById,
              },
            });
          }
        }
      }
      return { ok: true };
    });
  }
}
