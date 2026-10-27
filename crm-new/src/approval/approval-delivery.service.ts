import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApprovalStorageService } from './approval-storage.service';
import {
  ApprovalOzonChatService,
  OzonChatError,
} from './approval-ozon-chat.service';
import {
  approvalCaption,
  approvalRecipient,
  deliverySelect,
} from './approval-delivery-state';
import { CompleteApprovalDeliveryDto } from './dto/approval-delivery.dto';
import { displayOrderNumber } from '../order-photo/order-number';

/**
 * Каналы, которыми уходит лист согласования.
 *
 * Telegram пишет userbot: он забирает задание из этой же таблицы. Чат Ozon
 * CRM ведёт сама — ключи от кабинета у неё, и отправка происходит прямо в
 * запросе, которым нажали кнопку. Очередь при этом одна на оба канала:
 * «отправить ровно один раз» — правило общее, и раздваивать его нельзя.
 */
const CHANNEL_BY_PLATFORM = {
  TELEGRAM: 'TELEGRAM',
  OZON: 'OZON',
} as const;

type DeliveryChannel = (typeof CHANNEL_BY_PLATFORM)[keyof typeof CHANNEL_BY_PLATFORM];

@Injectable()
export class ApprovalDeliveryService {
  private readonly logger = new Logger(ApprovalDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ApprovalStorageService,
    private readonly ozonChat: ApprovalOzonChatService,
  ) {}

  async enqueue(approvalId: string, requestedById: string) {
    const approval = await this.prisma.printApproval.findUnique({
      where: { id: approvalId },
      include: {
        order: {
          select: {
            numberOrder: true,
            marketplaceOrderNumber: true,
            marketplacePostingNumber: true,
            marketplaceAccountId: true,
            communicationPlatform: true,
            urlCommunication: true,
          },
        },
        telegramDelivery: { select: deliverySelect },
      },
    });
    if (!approval) throw new NotFoundException('Согласование не найдено');
    const channel: DeliveryChannel | undefined =
      CHANNEL_BY_PLATFORM[
        approval.order.communicationPlatform as keyof typeof CHANNEL_BY_PLATFORM
      ];
    if (!channel)
      throw new BadRequestException(
        'Макет отправляется в Telegram или в чат Ozon — выберите в заказе один из этих способов связи',
      );
    if (
      approval.telegramDelivery &&
      approval.telegramDelivery.status !== 'FAILED'
    )
      return approval.telegramDelivery;
    const recipient = await this.resolveRecipient(channel, approval.order);
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
      throw new BadRequestException(
        'Изображение слишком большое для отправки клиенту',
      );

    // Пропуск на отправку. Для Ozon он наш собственный: отправляем мы, и
    // завершить строку сможет только этот запрос, а не случайный повтор.
    const claimToken = randomUUID();

    const queued = await this.prisma.$transaction(async (tx) => {
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
        current.order.communicationPlatform !==
          approval.order.communicationPlatform ||
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
        channel,
        recipient,
        // Сообщение читает покупатель: заказ с площадки называем её номером.
        caption: approvalCaption(
          displayOrderNumber(approval.order),
          approval.version,
          channel,
        ),
        image: new Uint8Array(image),
        requestedById,
        finalizedAt: approval.finalizedAt!,
        // Telegram ждёт userbot — строка ложится в очередь. Ozon отправляем
        // мы сами, прямо сейчас, поэтому строка сразу занята: второй щелчок
        // по кнопке увидит «отправляется» и не пошлёт макет дважды.
        status: (channel === 'OZON' ? 'SENDING' : 'PENDING') as
          | 'SENDING'
          | 'PENDING',
        createdAt: new Date(),
        claimToken: channel === 'OZON' ? claimToken : null,
        claimedAt: channel === 'OZON' ? new Date() : null,
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

    // Telegram отсюда уходит сам: задание в очереди, его заберёт userbot.
    if (queued.channel !== 'OZON' || queued.status !== 'SENDING') return queued;

    // Чат Ozon ведём сами. Отказ площадки не бросаем исключением: строка
    // уже создана, и карточке важнее показать её состояние с причиной, чем
    // получить ошибку и остаться с устаревшим экраном.
    try {
      await this.ozonChat.send({
        marketplaceAccountId: approval.order.marketplaceAccountId,
        chatId: recipient,
        text: approvalCaption(
          displayOrderNumber(approval.order),
          approval.version,
          'OZON',
        ),
        image,
        orderNumber: displayOrderNumber(approval.order),
        version: approval.version,
      });
      return this.finish(queued.id, claimToken, { status: 'SENT' });
    } catch (error) {
      const chatError =
        error instanceof OzonChatError
          ? error
          : new OzonChatError(
              'ozon_unavailable',
              error instanceof Error ? error.message : String(error),
            );
      this.logger.warn(
        `Макет ${approval.id} в чат Ozon не ушёл: ${chatError.code} — ${chatError.message}`,
      );
      return this.finish(queued.id, claimToken, {
        status: 'FAILED',
        errorCode: chatError.code,
      });
    }
  }

  /**
   * Кому отправлять: ник в Telegram или чат на Ozon.
   *
   * Оба адреса берутся из одного и того же поля заказа — «связь с
   * клиентом». Менеджер заполняет его в любом случае, и отдельного места
   * под адрес заводить незачем.
   */
  private async resolveRecipient(
    channel: DeliveryChannel,
    order: {
      urlCommunication: string | null;
      marketplacePostingNumber: string | null;
      marketplaceAccountId: string | null;
    },
  ): Promise<string> {
    if (channel === 'TELEGRAM') {
      const recipient = approvalRecipient(order.urlCommunication);
      if (!recipient)
        throw new BadRequestException(
          'Укажите в заказе Telegram клиента: @username или https://t.me/username',
        );
      return recipient;
    }
    try {
      return await this.ozonChat.resolveChatId(order);
    } catch (error) {
      // До площадки ещё не дошло: отправлять нечего, строку не заводим.
      throw new BadRequestException(
        error instanceof OzonChatError
          ? error.message
          : 'Не удалось определить чат с покупателем на Ozon',
      );
    }
  }

  async claim(claimToken: string) {
    // A lost worker response is ambiguous. Never automatically repeat its send.
    //
    // Канал здесь не важен: зависший Ozon (упал процесс посреди отправки)
    // так же нуждается в честном «не знаем», как и зависший Telegram.
    await this.prisma.approvalTelegramDelivery.updateMany({
      where: {
        status: 'SENDING',
        claimedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
      data: { status: 'UNKNOWN', errorCode: 'uncertain' },
    });
    return this.prisma.$transaction(async (tx) => {
      // Только телеграмные: макет для Ozon CRM отправляет сама, и отдать
      // его userbot'у значило бы послать покупателю второй экземпляр.
      const ids = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "ApprovalTelegramDelivery"
        WHERE "status" = 'PENDING' AND "channel" = 'TELEGRAM'
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

  /**
   * Ответ userbot'а: Telegram-отправка завершилась так-то.
   *
   * Номер сообщения требуется именно здесь: его знает только Telegram, и
   * без него «отправлено» ничем не подтверждено. У Ozon такого номера нет,
   * поэтому его отправка идёт в finish напрямую, минуя этот разбор.
   */
  async complete(id: string, dto: CompleteApprovalDeliveryDto) {
    if (dto.status === 'SENT' && !dto.messageId)
      throw new BadRequestException('Не указан номер сообщения Telegram');
    if (
      dto.status === 'FAILED' &&
      (!dto.errorCode || dto.errorCode === 'uncertain')
    )
      throw new BadRequestException('Не указан подтверждённый отказ');
    await this.finish(id, dto.claimToken, {
      status: dto.status,
      messageId: dto.messageId,
      errorCode: dto.errorCode,
    });
    // Воркер ждёт подтверждения приёма, а не состояния строки.
    return { ok: true };
  }

  /**
   * Закрыть строку отправки и, если макет ушёл, двинуть заказ.
   *
   * Общее для обоих каналов: правила «не отмечать дважды», «не тянуть
   * назад заказ, который уже печатают» и «не подменять согласие клиента»
   * не зависят от того, куда именно ушло сообщение.
   */
  private async finish(
    id: string,
    claimToken: string,
    outcome: {
      // UNKNOWN приходит от userbot'а: он не дождался ответа Telegram и
      // честно говорит, что результат неизвестен.
      status: 'SENT' | 'FAILED' | 'UNKNOWN';
      messageId?: number | null;
      errorCode?: string | null;
    },
  ) {
    const dto = {
      claimToken,
      status: outcome.status,
      messageId: outcome.messageId,
      errorCode: outcome.errorCode,
    };
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.approvalTelegramDelivery.findFirst({
        where: { id, claimToken: dto.claimToken },
      });
      if (!row) throw new NotFoundException('Отправка не найдена');
      // Уже закрыта — отвечаем тем, что есть: повторный ответ воркера и
      // повторный щелчок по кнопке не должны ничего менять.
      if (['SENT', 'FAILED'].includes(row.status))
        return tx.approvalTelegramDelivery.findUniqueOrThrow({
          where: { id },
          select: deliverySelect,
        });
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
      return tx.approvalTelegramDelivery.findUniqueOrThrow({
        where: { id },
        select: deliverySelect,
      });
    });
  }
}
