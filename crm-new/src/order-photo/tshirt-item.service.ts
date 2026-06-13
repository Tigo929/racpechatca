import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreateTshirtItem } from './dto/create-tshirt-item.dto';
import { DtoUpdateTshirtItem } from './dto/update-tshirt-item.dto';

@Injectable()
export class TshirtItemService {
  constructor(private prisma: PrismaService) {}

  private async recalcTotal(orderId: string, tx = this.prisma) {
    const order = await tx.orderPhoto.findUnique({
      where: { id: orderId },
      include: { tshirtItems: true },
    });
    if (!order) return;
    const total =
      order.tshirtItems.reduce((s, i) => s + i.pricePosition, 0) +
      order.deliveryCost;
    await tx.orderPhoto.update({
      where: { id: orderId },
      data: { totalOrder: total },
    });
  }

  async addTshirtItem(orderId: string, dto: DtoCreateTshirtItem) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const designCost = dto.designCost ?? 0;
    await this.prisma.itemTshirt.create({
      data: {
        orderId,
        color: dto.color,
        size: dto.size,
        printLocation: dto.printLocation,
        quantity: dto.quantity,
        price: dto.price,
        pricePosition: dto.price * dto.quantity + designCost,
        designCost,
        designUrl: dto.designUrl,
        designNote: dto.designNote,
      },
    });

    await this.recalcTotal(orderId);

    return this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { items: true, tshirtItems: true },
    });
  }

  async updateTshirtItem(itemId: string, dto: DtoUpdateTshirtItem) {
    const item = await this.prisma.itemTshirt.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');

    const quantity = dto.quantity ?? item.quantity;
    const price = dto.price ?? item.price;
    const designCost = dto.designCost ?? item.designCost;

    await this.prisma.itemTshirt.update({
      where: { id: itemId },
      data: {
        ...dto,
        quantity,
        price,
        designCost,
        pricePosition: price * quantity + designCost,
      },
    });

    await this.recalcTotal(item.orderId);

    return this.prisma.orderPhoto.findUnique({
      where: { id: item.orderId },
      include: { items: true, tshirtItems: true },
    });
  }

  async deleteTshirtItem(itemId: string) {
    const item = await this.prisma.itemTshirt.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');

    await this.prisma.itemTshirt.delete({ where: { id: itemId } });
    await this.recalcTotal(item.orderId);

    return this.prisma.orderPhoto.findUnique({
      where: { id: item.orderId },
      include: { items: true, tshirtItems: true },
    });
  }

  async getTshirtItem(itemId: string) {
    const item = await this.prisma.itemTshirt.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Позиция не найдена');
    return item;
  }
}
