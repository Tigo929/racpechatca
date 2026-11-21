import { HttpException, Injectable, Logger } from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderPhotoService } from './order-photo.service';
import {
  bulkShipBlocker,
  summarizeBulkShip,
  type BulkShipItemResult,
  type BulkShipResult,
} from './bulk-ship';

/**
 * Пачка «Отправлен» для фотозаказов — правила и почему в bulk-ship.ts.
 */
@Injectable()
export class BulkShipService {
  private readonly logger = new Logger(BulkShipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderPhotoService,
  ) {}

  async ship(
    ids: string[],
    userId: string,
    userRole: string,
  ): Promise<BulkShipResult> {
    const unique = [...new Set(ids)];
    const found = await this.prisma.orderPhoto.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        numberOrder: true,
        productCategory: true,
        status: true,
        executorId: true,
      },
    });
    const byId = new Map(found.map((o) => [o.id, o]));

    /*
     * По одному, а не параллельно. Каждый перевод держит блокировку строки
     * и начисляет зарплату в своей транзакции; сто параллельных транзакций
     * на сервере с 1.6 ГБ памяти — лишний риск ради пары секунд.
     *
     * И каждая отдельно: ошибка в одном заказе не должна откатывать
     * остальные девять — посылки-то уже в пункте выдачи.
     */
    const results: BulkShipItemResult[] = [];
    for (const id of unique) {
      const order = byId.get(id);
      if (!order) {
        results.push({
          id,
          numberOrder: null,
          ok: false,
          error: 'Заказ не найден.',
        });
        continue;
      }
      const blocker = bulkShipBlocker(order);
      if (blocker) {
        results.push({
          id,
          numberOrder: order.numberOrder,
          ok: false,
          error: blocker,
        });
        continue;
      }
      try {
        await this.orders.updateStatusOrder(
          id,
          { status: EnumStatus.SENT },
          userId,
          userRole,
        );
        results.push({ id, numberOrder: order.numberOrder, ok: true });
      } catch (e) {
        // Отказ проверки (нет прав, статус поменялся) показываем как есть:
        // это те же слова, что увидел бы человек в карточке.
        const error =
          e instanceof HttpException
            ? e.message
            : 'Не удалось отметить — попробуйте из карточки заказа.';
        if (!(e instanceof HttpException)) {
          this.logger.error(`Пачка «Отправлен»: заказ ${order.numberOrder}`, e);
        }
        results.push({ id, numberOrder: order.numberOrder, ok: false, error });
      }
    }
    return summarizeBulkShip(results);
  }
}
