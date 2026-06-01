import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import DtoCreateOrder from './dto/create-order.dto';
import calculatorTotalPrice from 'src/utils/caculator-total-price';
import fullDate from 'src/utils/full-date';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import { EnumCommunication } from 'src/generated/prisma/enums';

function buildCommunicationUrl(platform: EnumCommunication, raw: string): string {
  if (platform === EnumCommunication.TELEGRAM) {
    return `https://t.me/${raw.slice(1)}`;
  }
  return raw;
}

@Injectable()
export class OrderPhotoService {
  constructor(private prisma: PrismaService) {}
  async createOrder(dto: DtoCreateOrder) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;
      const count = await tx.orderPhoto.count();
      const lengthOrder = String(count + 1).padStart(3, '0');

      const isTshirt = dto.productCategory === 'TSHIRT';
      const itemsForTotal = isTshirt ? (dto.tshirtItems ?? []) : (dto.items ?? []);

      return tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          totalOrder: calculatorTotalPrice(itemsForTotal, dto.deliveryCost),
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          sourceOrder: dto.sourceOrder,
          communicationPlatform: dto.communicationPlatform,
          urlCommunication: buildCommunicationUrl(dto.communicationPlatform, dto.urlCommunication),
          deliveryMethod: dto.deliveryMethod,
          deliveryCost: dto.deliveryCost,
          note: dto.note,
          productCategory: dto.productCategory ?? 'PHOTO',
          items: isTshirt ? undefined : {
            create: (dto.items ?? []).map((e) => ({
              formatPaper: e.formatPaper,
              typePaper: e.typePaper,
              quantity: e.quantity,
              price: e.price,
              pricePosition: e.price * e.quantity,
            })),
          },
          tshirtItems: isTshirt ? {
            create: (dto.tshirtItems ?? []).map((e) => ({
              color: e.color,
              size: e.size,
              printLocation: e.printLocation,
              quantity: e.quantity,
              price: e.price,
              pricePosition: e.price * e.quantity,
              designCost: e.designCost ?? 0,
              designUrl: e.designUrl,
              designNote: e.designNote,
            })),
          } : undefined,
        },
        include: { items: true, tshirtItems: true },
      });
    });
  }
  async getAllOrders(query: DtoAllOrdersforQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [orders, count] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where: { status: query.status, sourceOrder: query.sourceOrder },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: "asc" },
        include: { items: true, tshirtItems: true },
      }),
      this.prisma.orderPhoto.count({
        where: { status: query.status, sourceOrder: query.sourceOrder },
      }),
    ]);
    const data = {
      data: orders,
      meta: {
        page,
        limit,
        quantityElements: count,
        totalPages: Math.ceil(count / limit),
      },
    };
    return data;
  }
  async getOrderById(idOrder: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      include: { items: true, tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    return order;
  }
  async updateStatusOrder(id: string, dto: UpdateStatus) {
    await this.getOrderById(id);
    const updateStatus = await this.prisma.orderPhoto.update({
      where: { id: id },
      data: { status: dto.status },
      include: { items: true, tshirtItems: true },
    });
    return updateStatus;
  }
  async updateOrder(idOrder: string, dto: DtoUpdateOrder) {
    const order = await this.getOrderById(idOrder);
    const updateOrder = this.prisma.orderPhoto.update({
      where: { id: idOrder },
      include: { items: true, tshirtItems: true },
      data: {
        sourceOrder: dto.sourceOrder ?? order.sourceOrder,
        communicationPlatform:
          dto.communicationPlatform ?? order.communicationPlatform,
        urlCommunication: dto.urlCommunication
          ? buildCommunicationUrl(
              dto.communicationPlatform ?? order.communicationPlatform,
              dto.urlCommunication,
            )
          : order.urlCommunication,
        deliveryMethod: dto.deliveryMethod ?? order.deliveryMethod,
        deliveryCost: dto.deliveryCost ?? order.deliveryCost,
        status: dto.status ?? order.status,
        totalOrder: calculatorTotalPrice(
          order.items,
          dto.deliveryCost ?? order.deliveryCost,
        ),
        note: dto.note ?? order.note,
        isUrgent: dto.isUrgent !== undefined ? dto.isUrgent : order.isUrgent,
      },
    });
    return updateOrder;
  }
  async deleteOrder(idOrder: string) {
    await this.getOrderById(idOrder);

    await this.prisma.itemPhoto.deleteMany({
      where: { orderId: idOrder },
    });

    const deleteOrder = await this.prisma.orderPhoto.delete({
      where: { id: idOrder },
      include: { items: true, tshirtItems: true },
    });

    return {
      message: 'Заказ удалён успешно',
      data: deleteOrder,
    };
  }
}
