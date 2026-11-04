import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumProductCategory, EnumRole } from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { clampOrderDiscount, orderTotal } from './order-total';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { DtoCreateCanvasItem } from './dto/create-canvas-item.dto';
import { DtoUpdateCanvasItem } from './dto/update-canvas-item.dto';
import { resolveCanvasPosition } from 'src/canvas/canvas-production-price';
import { assertListedCanvasSize } from './canvas-size-guard';
import {
  canvasPositionMoney,
  normalizeAddons,
  type CanvasAddons,
} from './canvas-addons';

function canvasMoney(
  quantity: number,
  clientPrice: number,
  contractorPrice: number,
  addons: CanvasAddons,
) {
  return canvasPositionMoney({
    quantity,
    clientPrice,
    contractorPrice,
    addons,
  });
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

      assertListedCanvasSize(dto.sizeKey);

      /*
       * Цену производства считаем, а не принимаем от клиента запроса: она
       * берётся из оптовой колонки прайса. Пришедшее в теле значение
       * учитывается только для нестандартного размера, которого в прайсе нет.
       */
      const priced = resolveCanvasPosition(dto);
      // Допы считаются поверх цены полотна и за ту же штуку: два холста
      // в багете — два багета.
      const addons = normalizeAddons(dto);

      await tx.itemCanvas.create({
        data: {
          orderId,
          formatCanvas: priced.formatCanvas,
          sizeKey: priced.sizeKey,
          material: priced.material,
          quantity: dto.quantity,
          clientPrice: dto.clientPrice,
          contractorPrice: priced.contractorPrice,
          ...addons,
          ...canvasMoney(
            dto.quantity,
            dto.clientPrice,
            priced.contractorPrice,
            addons,
          ),
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

      /*
       * Позицию с размером из прайса нельзя превратить в «любой формат с
       * любой ценой» — именно так заказ и уезжал с ценой, которая ни с чем
       * не сходится. Старые позиции без ключа размера (заявки, заведённые
       * до прайса) правятся по-прежнему: отбивать правку задним числом
       * значило бы запереть заказ, который уже в работе.
       */
      if (item.sizeKey) {
        assertListedCanvasSize(
          dto.sizeKey === undefined ? item.sizeKey : dto.sizeKey,
        );
      }

      const quantity = dto.quantity ?? item.quantity;
      const clientPrice = dto.clientPrice ?? item.clientPrice;

      /*
       * Размер меняют — пересчитываем цену производства по прайсу. Не меняют —
       * оставляем ту, что уже записана: она снимок на момент оформления, и
       * пересчёт задним числом сдвинул бы долг по давно согласованному заказу.
       */
      const sizeChanged =
        dto.sizeKey !== undefined || dto.material !== undefined;
      let formatCanvas = dto.formatCanvas ?? item.formatCanvas;
      let sizeKey = item.sizeKey;
      let material = item.material;
      let contractorPrice = dto.contractorPrice ?? item.contractorPrice;

      if (sizeChanged) {
        const priced = resolveCanvasPosition({
          sizeKey: dto.sizeKey ?? item.sizeKey ?? undefined,
          material:
            dto.material ??
            (item.material as 'SYNTHETIC' | 'COTTON' | null) ??
            undefined,
          formatCanvas: dto.formatCanvas ?? item.formatCanvas,
          contractorPrice: dto.contractorPrice ?? item.contractorPrice,
        });
        formatCanvas = priced.formatCanvas;
        sizeKey = priced.sizeKey;
        material = priced.material;
        contractorPrice = priced.contractorPrice;
      }

      /*
       * Допы правятся по одному: пришло только поле лака — багет остаётся
       * прежним. Иначе правка цены лака молча снимала бы багет.
       */
      const addons = normalizeAddons({
        varnish: dto.varnish ?? item.varnish,
        varnishClientPrice: dto.varnishClientPrice ?? item.varnishClientPrice,
        varnishContractorPrice:
          dto.varnishContractorPrice ?? item.varnishContractorPrice,
        frame: dto.frame ?? item.frame,
        frameClientPrice: dto.frameClientPrice ?? item.frameClientPrice,
        frameContractorPrice:
          dto.frameContractorPrice ?? item.frameContractorPrice,
      });

      await tx.itemCanvas.update({
        where: { id: itemId },
        data: {
          formatCanvas,
          sizeKey,
          material,
          quantity,
          clientPrice,
          contractorPrice,
          ...addons,
          ...canvasMoney(quantity, clientPrice, contractorPrice, addons),
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
        // Итог и скидка — одной формулой на весь проект (order-total.ts).
        // Скидку обрезаем: позиции могли подешеветь, и прежняя скидка
        // оказалась бы больше того, на что её давали.
        totalOrder: orderTotal({
          positionsTotal: itemsTotal + tshirtTotal + canvasTotal,
          deliveryCost: order.deliveryCost,
          designDevelopmentCost: order.designDevelopmentCost,
          urgencyFee: order.urgencyFee,
          discountAmount: order.discountAmount,
        }),
        discountAmount: clampOrderDiscount(order.discountAmount, {
          positionsTotal: itemsTotal + tshirtTotal + canvasTotal,
          designDevelopmentCost: order.designDevelopmentCost,
        }),
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
