import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import DtoUpdateItemOrder from './dto/update-item.dto';
import DtoCreateItemOrder from './dto/create-item-order.dto';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { calcItemPricePosition } from './order-pricing';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';

@Injectable()
export class OrderItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
    private readonly partnerSettings: PartnerSettingsService,
  ) {}

  async getItemById(
    idItem: string,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    const item = await this.prisma.itemPhoto.findUnique({
      where: { id: idItem },
    });
    if (!item) throw new NotFoundException('Элемент заказа не найден');
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

  async updateItemOrder(idItem: string, dto: DtoUpdateItemOrder) {
    const item = await this.getItemById(idItem);

    return this.prisma.$transaction(async (tx) => {
      await this.financialIntegrity.assertOrderFinanciallyEditable(
        item.orderId,
        tx,
      );

      const order = await tx.orderPhoto.findUnique({
        where: { id: item.orderId },
        select: { isFreePrice: true },
      });
      // Свободная цена, если так помечен заказ ИЛИ сама позиция.
      const itemFreePrice = dto.isFreePrice ?? item.isFreePrice;
      const freePrice = (order?.isFreePrice ?? false) || itemFreePrice;
      const quantity = dto.quantity ?? item.quantity;
      const price = dto.price ?? item.price;

      // Признак печати на изделии заказчика меняет состав расчёта с партнёром,
      // поэтому вместе с ним пересматриваем и снимок себестоимости плёнки:
      // включили — берём текущую из настроек, выключили — обнуляем.
      const printOnClientItem = dto.printOnClientItem ?? item.printOnClientItem;
      let thermalCost = item.thermalCost;
      if (printOnClientItem !== item.printOnClientItem) {
        thermalCost = printOnClientItem
          ? (await this.partnerSettings.get(tx)).thermalTransferCost
          : 0;
      }

      await tx.itemPhoto.update({
        where: { id: idItem },
        data: {
          formatPaper: dto.formatPaper ?? item.formatPaper,
          typePaper: dto.typePaper ?? item.typePaper,
          quantity,
          price,
          isFreePrice: itemFreePrice,
          printOnClientItem,
          thermalCost,
          pricePosition: calcItemPricePosition(price, quantity, 0, freePrice),
        },
      });

      return this.recalcAndReturn(tx, item.orderId);
    });
  }

  async deleteItemOrder(idItem: string) {
    const item = await this.getItemById(idItem);

    return this.prisma.$transaction(async (tx) => {
      await this.financialIntegrity.assertOrderFinanciallyEditable(
        item.orderId,
        tx,
      );
      await tx.itemPhoto.delete({ where: { id: idItem } });
      return this.recalcAndReturn(tx, item.orderId);
    });
  }

  async addItemToOrder(idOrder: string, dto: DtoCreateItemOrder) {
    return this.prisma.$transaction(async (tx) => {
      const orderExists = await tx.orderPhoto.findUnique({
        where: { id: idOrder },
        select: { id: true, isFreePrice: true },
      });
      if (!orderExists) throw new NotFoundException('Заказ не найден');

      await this.financialIntegrity.assertOrderFinanciallyEditable(idOrder, tx);

      // Позиция свободна по цене, если так помечен заказ ИЛИ сама позиция.
      const itemFreePrice = dto.isFreePrice ?? false;
      const effectiveFreePrice = orderExists.isFreePrice || itemFreePrice;

      // Печать на изделии заказчика: заготовку не покупаем, но термоперенос
      // и доля партнёра остаются. Себестоимость снимаем сейчас — тем же
      // правилом, что при создании заказа.
      const printOnClientItem = dto.printOnClientItem ?? false;
      const thermalCost = printOnClientItem
        ? (await this.partnerSettings.get(tx)).thermalTransferCost
        : 0;

      await tx.itemPhoto.create({
        data: {
          formatPaper: dto.formatPaper,
          typePaper: dto.typePaper,
          quantity: dto.quantity,
          price: dto.price,
          isFreePrice: itemFreePrice,
          printOnClientItem,
          thermalCost,
          pricePosition: calcItemPricePosition(
            dto.price,
            dto.quantity,
            0,
            effectiveFreePrice,
          ),
          orderId: idOrder,
        },
      });

      return this.recalcAndReturn(tx, idOrder);
    });
  }

  /** Пересчитывает totalOrder заказа и возвращает его с позициями. */
  private async recalcAndReturn(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.orderPhoto.findUnique({
      where: { id: orderId },
      include: { items: true, tshirtItems: true, canvasItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    // Сумма заказа = pricePosition (фото + футболки + холсты) + доставка + дизайн +
    // срочность. pricePosition уже посчитан с учётом свободной цены позиции.
    // Дизайн и срочность живут на заказе — без них правка позиции обнуляла бы
    // эти суммы в чеке.
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
