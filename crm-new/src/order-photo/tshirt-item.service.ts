import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreateTshirtItem } from './dto/create-tshirt-item.dto';
import { DtoUpdateTshirtItem } from './dto/update-tshirt-item.dto';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { calcItemPricePosition, calcOrderTotal } from './order-pricing';

@Injectable()
export class TshirtItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
  ) {}

  async addTshirtItem(orderId: string, dto: DtoCreateTshirtItem) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderPhoto.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заказ не найден');
      await this.financialIntegrity.assertOrderFinanciallyEditable(orderId, tx);

      const designCost = dto.designCost ?? 0;
      await tx.itemTshirt.create({
        data: {
          orderId,
          color: dto.color,
          size: dto.size,
          printLocation: dto.printLocation,
          quantity: dto.quantity,
          price: dto.price,
          pricePosition: calcItemPricePosition(
            dto.price,
            dto.quantity,
            designCost,
          ),
          designCost,
          designUrl: dto.designUrl,
          designNote: dto.designNote,
          clientItem: dto.clientItem ?? false,
        },
      });

      return this.recalcAndReturn(tx, orderId);
    });
  }

  async updateTshirtItem(itemId: string, dto: DtoUpdateTshirtItem) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemTshirt.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Позиция не найдена');
      await this.financialIntegrity.assertOrderFinanciallyEditable(
        item.orderId,
        tx,
      );

      const quantity = dto.quantity ?? item.quantity;
      const price = dto.price ?? item.price;
      const designCost = dto.designCost ?? item.designCost;

      await tx.itemTshirt.update({
        where: { id: itemId },
        data: {
          ...dto,
          quantity,
          price,
          designCost,
          pricePosition: calcItemPricePosition(price, quantity, designCost),
        },
      });

      return this.recalcAndReturn(tx, item.orderId);
    });
  }

  async deleteTshirtItem(itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemTshirt.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundException('Позиция не найдена');
      await this.financialIntegrity.assertOrderFinanciallyEditable(
        item.orderId,
        tx,
      );

      await tx.itemTshirt.delete({ where: { id: itemId } });
      return this.recalcAndReturn(tx, item.orderId);
    });
  }

  async getTshirtItem(
    itemId: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const item = await this.prisma.itemTshirt.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
    if (currentUserRole === EnumRole.EXECUTOR) {
      const order = await this.prisma.orderPhoto.findUnique({
        where: { id: item.orderId },
        select: { executorId: true },
      });
      if (order?.executorId !== currentUserId) {
        throw new ForbiddenException('Нет доступа к чужому заказу.');
      }
    }
    return item;
  }

  /** Пересчитывает totalOrder заказа и возвращает его с позициями. */
  private async recalcAndReturn(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.orderPhoto.findUnique({
      where: { id: orderId },
      include: { items: true, tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const updated = await tx.orderPhoto.update({
      where: { id: orderId },
      include: { items: true, tshirtItems: true },
      data: { totalOrder: calcOrderTotal(order.tshirtItems, order.deliveryCost) },
    });
    // Невыплаченное начисление подгоняем под новую сумму заказа.
    await this.financialIntegrity.recalcPendingAccrual(
      orderId,
      updated.totalOrder,
      updated.deliveryCost,
      tx,
    );
    return updated;
  }
}
