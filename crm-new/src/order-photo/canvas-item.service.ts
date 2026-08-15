import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumProductCategory, EnumRole } from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { DtoCreateCanvasItem } from './dto/create-canvas-item.dto';
import { DtoUpdateCanvasItem } from './dto/update-canvas-item.dto';

function canvasMoney(quantity: number, clientPrice: number, contractorPrice: number) {
  const pricePosition = clientPrice * quantity;
  const contractorCostPosition = contractorPrice * quantity;
  return {
    pricePosition,
    contractorCostPosition,
    profitPosition: pricePosition - contractorCostPosition,
  };
}

@Injectable()
export class CanvasItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
  ) {}

  async addCanvasItem(orderId: string, dto: DtoCreateCanvasItem) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderPhoto.findUnique({
        where: { id: orderId },
        select: { id: true, productCategory: true },
      });
      if (!order) throw new NotFoundException('Заказ не найден');
      if (order.productCategory !== EnumProductCategory.CANVAS) {
        throw new BadRequestException(
          'Позиции холста можно добавлять только в заказы «Печать на холсте».',
        );
      }

      await this.financialIntegrity.assertOrderFinanciallyEditable(orderId, tx);

      await tx.itemCanvas.create({
        data: {
          orderId,
          formatCanvas: dto.formatCanvas,
          quantity: dto.quantity,
          clientPrice: dto.clientPrice,
          contractorPrice: dto.contractorPrice,
          ...canvasMoney(dto.quantity, dto.clientPrice, dto.contractorPrice),
        },
      });

      return this.recalcAndReturn(tx, orderId);
    });
  }

  async updateCanvasItem(itemId: string, dto: DtoUpdateCanvasItem) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemCanvas.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Позиция не найдена');

      await this.financialIntegrity.assertOrderFinanciallyEditable(
        item.orderId,
        tx,
      );

      const quantity = dto.quantity ?? item.quantity;
      const clientPrice = dto.clientPrice ?? item.clientPrice;
      const contractorPrice = dto.contractorPrice ?? item.contractorPrice;

      await tx.itemCanvas.update({
        where: { id: itemId },
        data: {
          formatCanvas: dto.formatCanvas ?? item.formatCanvas,
          quantity,
          clientPrice,
          contractorPrice,
          ...canvasMoney(quantity, clientPrice, contractorPrice),
        },
      });

      return this.recalcAndReturn(tx, item.orderId);
    });
  }

  async deleteCanvasItem(itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemCanvas.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Позиция не найдена');

      await this.financialIntegrity.assertOrderFinanciallyEditable(
        item.orderId,
        tx,
      );

      await tx.itemCanvas.delete({ where: { id: itemId } });
      return this.recalcAndReturn(tx, item.orderId);
    });
  }

  async getCanvasItem(
    itemId: string,
    _currentUserId?: string,
    currentUserRole?: string,
  ) {
    const item = await this.prisma.itemCanvas.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
    if (currentUserRole === EnumRole.EXECUTOR) {
      throw new ForbiddenException('Печать на холсте ведёт администратор.');
    }
    return item;
  }

  /** Пересчитывает totalOrder заказа и возвращает его с позициями. */
  private async recalcAndReturn(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.orderPhoto.findUnique({
      where: { id: orderId },
      include: { items: true, tshirtItems: true, canvasItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const itemsTotal = order.items.reduce(
      (s, i) => s + (i.pricePosition ?? 0),
      0,
    );
    const tshirtTotal = order.tshirtItems.reduce(
      (s, i) => s + (i.pricePosition ?? 0),
      0,
    );
    const canvasTotal = order.canvasItems.reduce(
      (s, i) => s + (i.pricePosition ?? 0),
      0,
    );

    const updated = await tx.orderPhoto.update({
      where: { id: orderId },
      include: { items: true, tshirtItems: true, canvasItems: true },
      data: {
        totalOrder:
          itemsTotal +
          tshirtTotal +
          canvasTotal +
          order.deliveryCost +
          order.designDevelopmentCost +
          order.urgencyFee,
      },
    });

    await this.financialIntegrity.recalcPendingAccrual(
      orderId,
      updated.totalOrder,
      updated.deliveryCost,
      tx,
    );

    return updated;
  }
}
