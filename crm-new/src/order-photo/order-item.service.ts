import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import calculatorTotalPrice from 'src/utils/caculator-total-price';
import DtoUpdateItemOrder from './dto/update-item.dto';
import DtoCreateItemOrder from './dto/create-item-order.dto';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';

@Injectable()
export class OrderItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
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
    await this.financialIntegrity.assertOrderFinanciallyEditable(item.orderId);
    await this.prisma.itemPhoto.update({
      where: { id: idItem },
      data: {
        formatPaper: dto.formatPaper ?? item.formatPaper,
        typePaper: dto.typePaper ?? item.typePaper,
        quantity: dto.quantity ?? item.quantity,
        price: dto.price ?? item.price,
        pricePosition:
          (dto.price ?? item.price) * (dto.quantity ?? item.quantity),
      },
    });
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: item.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return this.prisma.orderPhoto.update({
      where: { id: item.orderId },
      include: { items: true, tshirtItems: true },
      data: {
        totalOrder: calculatorTotalPrice(order.items, order.deliveryCost),
      },
    });
  }

  async deleteItemOrder(idItem: string) {
    const item = await this.getItemById(idItem);
    await this.financialIntegrity.assertOrderFinanciallyEditable(item.orderId);
    await this.prisma.itemPhoto.delete({ where: { id: idItem } });
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: item.orderId },
      include: { items: true, tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return this.prisma.orderPhoto.update({
      where: { id: item.orderId },
      include: { items: true, tshirtItems: true },
      data: {
        totalOrder: calculatorTotalPrice(order.items, order.deliveryCost),
      },
    });
  }

  async addItemToOrder(idOrder: string, dto: DtoCreateItemOrder) {
    const orderExists = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      select: { id: true },
    });
    if (!orderExists) throw new NotFoundException('Заказ не найден');

    await this.financialIntegrity.assertOrderFinanciallyEditable(idOrder);
    await this.prisma.itemPhoto.create({
      data: {
        formatPaper: dto.formatPaper,
        typePaper: dto.typePaper,
        quantity: dto.quantity,
        price: dto.price,
        pricePosition: dto.quantity * dto.price,
        orderId: idOrder,
      },
    });
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      include: { items: true, tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return this.prisma.orderPhoto.update({
      where: { id: idOrder },
      include: { items: true, tshirtItems: true },
      data: {
        totalOrder: calculatorTotalPrice(order.items, order.deliveryCost),
      },
    });
  }
}
