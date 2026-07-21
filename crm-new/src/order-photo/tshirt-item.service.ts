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
import { calcItemPricePosition } from './order-pricing';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';

@Injectable()
export class TshirtItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
    private readonly partnerSettings: PartnerSettingsService,
  ) {}

  async addTshirtItem(orderId: string, dto: DtoCreateTshirtItem) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orderPhoto.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заказ не найден');
      await this.financialIntegrity.assertOrderFinanciallyEditable(orderId, tx);

      // Дизайн — внутри цены (carve-out), поэтому не больше суммы позиции.
      const designCost = Math.min(dto.designCost ?? 0, dto.price * dto.quantity);
      const settings = await this.partnerSettings.get(tx);
      await tx.itemTshirt.create({
        data: {
          orderId,
          color: dto.color,
          size: dto.size,
          printLocation: dto.printLocation,
          quantity: dto.quantity,
          price: dto.price,
          pricePosition: calcItemPricePosition(dto.price, dto.quantity),
          designCost,
          // 0/пусто → умолчание из настроек (см. createOrder).
          thermalCost: dto.thermalCost || settings.thermalTransferCost,
          blankCost: dto.blankCost || settings.blankTshirtCost,
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
      // Дизайн — внутри цены (carve-out), не больше суммы позиции.
      const designCost = Math.min(
        dto.designCost ?? item.designCost,
        price * quantity,
      );

      await tx.itemTshirt.update({
        where: { id: itemId },
        data: {
          ...dto,
          quantity,
          price,
          designCost,
          pricePosition: calcItemPricePosition(price, quantity),
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
    // Сумма заказа = все сохранённые pricePosition (футболки + фото) + доставка.
    const tshirtTotal = order.tshirtItems.reduce(
      (s, i) => s + (i.pricePosition ?? 0),
      0,
    );
    const itemsTotal = order.items.reduce(
      (s, i) => s + (i.pricePosition ?? 0),
      0,
    );
    const updated = await tx.orderPhoto.update({
      where: { id: orderId },
      include: { items: true, tshirtItems: true },
      data: { totalOrder: tshirtTotal + itemsTotal + order.deliveryCost },
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
