import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderEventsService } from 'src/events/order-events.service';
import { OzonAutoshipService } from './ozon-autoship.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonOrdersService } from './ozon/ozon-orders.service';
import { shouldShipToAssembly } from './ozon/ozon-autoship';
import { groupForStatus } from './ozon/ozon-order-status';

/**
 * «Передан в производство» → «Собрать» в кабинете Ozon, сразу.
 *
 * Сборкой занималась только сверка раз в 15 минут. Для владельца это
 * выглядело как несработавшая автоматика: он нажимал кнопку в CRM, шёл
 * в кабинет и видел отправление всё ещё в «ждёт отгрузки». Теперь то же
 * действие выполняется по событию смены статуса, а сверка остаётся
 * страховкой — на случай, когда процесс перезапустился или площадка
 * в эту минуту не ответила.
 *
 * Отправление запрашиваем поштучно (`/v3/posting/fbs/get`): сборке нужны
 * sku и количество из самой площадки, а не наши позиции. Один запрос на
 * одну передачу в производство — это дешевле, чем ждать общей сверки.
 *
 * Двух сборок одного отправления быть не может: и здесь, и в сверке
 * решение принимает `shouldShipToAssembly`, а первая же попытка ставит
 * в заказе `marketplaceShipRequestedAt`.
 */
@Injectable()
export class OzonAutoshipTriggerService implements OnModuleInit {
  private readonly logger = new Logger(OzonAutoshipTriggerService.name);

  constructor(
    private readonly events: OrderEventsService,
    private readonly prisma: PrismaService,
    private readonly autoship: OzonAutoshipService,
    private readonly accounts: MarketplaceAccountService,
    private readonly orders: OzonOrdersService,
  ) {}

  onModuleInit(): void {
    this.events.onSentToProduction(async (event) => {
      if (!this.autoship.enabled) return;
      await this.ship(event.orderId);
    });
  }

  private async ship(orderId: string): Promise<void> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        numberOrder: true,
        status: true,
        marketplacePostingNumber: true,
        marketplaceAccountId: true,
        marketplaceShipRequestedAt: true,
      },
    });
    if (
      !order?.marketplacePostingNumber ||
      !order.marketplaceAccountId ||
      order.marketplaceShipRequestedAt
    ) {
      return;
    }

    const creds = await this.accounts.credentials(order.marketplaceAccountId);
    const posting = await this.orders.get(creds, order.marketplacePostingNumber);
    if (!posting) {
      /*
       * Площадка не отдала отправление: оно могло быть отменено или
       * заведено в другом кабинете. Решать это автоматике нечем —
       * отметку не ставим, и сверка попробует позже.
       */
      this.logger.warn(
        `Заказ ${order.numberOrder}: отправление ${order.marketplacePostingNumber} не найдено в кабинете — сборку отдаём сверке`,
      );
      return;
    }

    if (
      !shouldShipToAssembly({
        status: order.status,
        marketplaceShipRequestedAt: order.marketplaceShipRequestedAt,
        marketplaceGroup: groupForStatus(posting.status),
        items: posting.items,
      })
    ) {
      return;
    }

    await this.autoship.ship({
      id: order.id,
      numberOrder: order.numberOrder,
      marketplacePostingNumber: order.marketplacePostingNumber,
      marketplaceAccountId: order.marketplaceAccountId,
      posting,
    });
  }
}
