import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  buildClientMessage,
  type ClientMessageKind,
  type ClientMessageOrder,
} from './client-message';

/**
 * Текст сообщения клиенту по заказу из базы.
 *
 * Одна точка сборки на два способа отправки: менеджер копирует текст
 * из карточки, а счёт после ответа «да» уходит сам — и это должен быть
 * один и тот же текст. Пока сборка жила в браузере, автоматическая
 * отправка была невозможна в принципе: некому открыть карточку.
 */
@Injectable()
export class ClientMessageService {
  constructor(private readonly prisma: PrismaService) {}

  /** Текст для заказа. null — заказа нет. */
  async textFor(
    orderId: string,
    kind: ClientMessageKind,
  ): Promise<string | null> {
    const order = await this.load(orderId);
    return order ? buildClientMessage(order, kind) : null;
  }

  /**
   * Заказ в том виде, в каком его читает сборка текста.
   *
   * Выбираем ровно нужные поля: так видно, от чего зависит сообщение
   * клиенту, и лишние колонки не попадают туда, где им не место.
   */
  async load(orderId: string): Promise<ClientMessageOrder | null> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        numberOrder: true,
        marketplaceOrderNumber: true,
        communicationPlatform: true,
        productCategory: true,
        status: true,
        deliveryMethod: true,
        deliveryCost: true,
        discountAmount: true,
        designDevelopmentCost: true,
        urgencyFee: true,
        totalOrder: true,
        prepaidAmount: true,
        isUrgent: true,
        isFreePrice: true,
        createdAt: true,
        executor: { select: { username: true } },
        items: {
          select: {
            formatPaper: true,
            typePaper: true,
            quantity: true,
            price: true,
            pricePosition: true,
            isFreePrice: true,
          },
        },
        tshirtItems: {
          select: {
            color: true,
            size: true,
            quantity: true,
            pricePosition: true,
          },
        },
        canvasItems: {
          select: {
            formatCanvas: true,
            quantity: true,
            pricePosition: true,
          },
        },
      },
    });
    return order;
  }
}
