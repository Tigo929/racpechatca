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

      // Префикс номера по сегодняшней дате: YYYYMMDD
      const now = new Date();
      const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      // Берём максимальный порядковый номер среди заказов за сегодня и +1.
      // Это устойчиво к удалениям (глобальный count давал дубликаты).
      const lastToday = await tx.orderPhoto.findFirst({
        where: { numberOrder: { startsWith: `${datePrefix}-` } },
        orderBy: { numberOrder: 'desc' },
        select: { numberOrder: true },
      });
      const lastSeq = lastToday
        ? parseInt(lastToday.numberOrder.split('-')[1] ?? '0', 10)
        : 0;
      const lengthOrder = String(lastSeq + 1).padStart(3, '0');

      const isTshirt = dto.productCategory === 'TSHIRT';
      const itemsForTotal = isTshirt ? (dto.tshirtItems ?? []) : (dto.items ?? []);

      return tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          totalOrder: calculatorTotalPrice(itemsForTotal, dto.deliveryCost),
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(dto.status ? { status: dto.status as any } : {}),
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
        where: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: (query.status ?? { notIn: ['SENT', 'LEAD'] }) as any,
          sourceOrder: query.sourceOrder,
          productCategory: query.productCategory,
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: "asc" },
        include: { items: true, tshirtItems: true },
      }),
      this.prisma.orderPhoto.count({
        where: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: (query.status ?? { notIn: ['SENT', 'LEAD'] }) as any,
          sourceOrder: query.sourceOrder,
          productCategory: query.productCategory,
        },
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
  // Доля сотрудника от чистой суммы заказа (30%)
  private static readonly EMPLOYEE_RATE = 0.3;

  /**
   * Расчёт зарплаты по фото-заказам.
   *
   * Чистая сумма = totalOrder − deliveryCost (доставка не делится).
   * Сотрудник получает 30%, владелец — 70%.
   *
   * Статус SENT  → зарплата ещё не выплачена (в долге, «к выплате»).
   * Статус PAID  → зарплата уже выплачена сотруднику (история).
   */
  async getSalarySummary() {
    const rate = OrderPhotoService.EMPLOYEE_RATE;

    const orders = await this.prisma.orderPhoto.findMany({
      where: {
        productCategory: 'PHOTO',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: { in: ['SENT', 'PAID'] } as any,
      },
      orderBy: { updatedAt: 'desc' },
      include: { items: true },
    });

    const mapOrder = (o: (typeof orders)[number]) => {
      const cleanTotal = (o.totalOrder ?? 0) - (o.deliveryCost ?? 0);
      const employeeShare = Math.round(cleanTotal * rate);
      const ownerShare = cleanTotal - employeeShare;
      return {
        id: o.id,
        numberOrder: o.numberOrder,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        status: o.status,
        totalOrder: o.totalOrder ?? 0,
        deliveryCost: o.deliveryCost ?? 0,
        cleanTotal,
        employeeShare,
        ownerShare,
      };
    };

    const toPay = orders.filter((o) => o.status === 'SENT').map(mapOrder);
    const paid = orders.filter((o) => o.status === 'PAID').map(mapOrder);

    const sum = (arr: ReturnType<typeof mapOrder>[], key: 'cleanTotal' | 'employeeShare' | 'ownerShare') =>
      arr.reduce((acc, o) => acc + o[key], 0);

    return {
      ratePercent: Math.round(rate * 100),
      toPay,
      paid,
      summary: {
        // К выплате (статус SENT)
        toPayCount: toPay.length,
        toPayClean: sum(toPay, 'cleanTotal'),
        toPayEmployee: sum(toPay, 'employeeShare'),
        toPayOwner: sum(toPay, 'ownerShare'),
        // Уже выплачено (статус PAID)
        paidCount: paid.length,
        paidClean: sum(paid, 'cleanTotal'),
        paidEmployee: sum(paid, 'employeeShare'),
        paidOwner: sum(paid, 'ownerShare'),
      },
    };
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
          order.productCategory === 'TSHIRT' ? order.tshirtItems : order.items,
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

    // ItemPhoto и ItemTshirt удалятся каскадно (onDelete: Cascade)
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
