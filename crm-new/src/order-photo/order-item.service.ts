import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import calculatorTotalPrice from 'src/utils/caculator-total-price';
import DtoUpdateItemOrder from './dto/update-item.dto';
import DtoCreateItemOrder from './dto/create-item-order.dto';

@Injectable()
export class OrderItemService {
  constructor(private prisma: PrismaService) {}

  async getItemById(idItem: string) {
    const item = await this.prisma.itemPhoto.findUnique({
      where: { id: idItem },
    });
    if (!item) throw new NotFoundException('Элемент заказа не найден');
    return item;
  }

  async updateItemOrder(idItem: string, dto: DtoUpdateItemOrder) {
    const item = await this.getItemById(idItem);
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
