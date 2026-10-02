import { Injectable, Logger } from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaOrderOutboxService } from 'src/metrika/orders/metrika-order-outbox.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonOrdersService } from './ozon/ozon-orders.service';
import { shouldCloseAsShipped } from './ozon/ozon-shipped-close';

/**
 * Закрытие заказов, которые площадка уже отгрузила.
 *
 * Зачем. Заказ с Ozon живёт в двух местах: производство ведём мы, а
 * отгрузку отмечает площадка. Владелец закрывал такие заказы руками,
 * сверяясь с кабинетом, — работа механическая и легко забываемая:
 * забытый заказ висит в активных и мешает видеть настоящую очередь.
 *
 * Что делает. Раз в несколько минут спрашивает у площадки состояние
 * отправлений по открытым заказам и переводит в «Отгружен» те, которые
 * Ozon уже везёт или доставил.
 *
 * Чего НЕ делает. Не отменяет заказы вслед за площадкой и не возвращает
 * закрытые обратно: отмена — решение с последствиями (склад, зарплата,
 * деньги), и принимать его молча автоматика не должна.
 */
@Injectable()
export class OzonShippedCloseService {
  private readonly logger = new Logger(OzonShippedCloseService.name);
  private running = false;

  /**
   * Сколько заказов берём за раз. Ограничение не по скорости, а по цене
   * ошибки: если правило окажется неверным, за один тик пострадает двадцать
   * заказов, а не весь список.
   */
  private static readonly BATCH = 20;

  /** За сколько дней спрашиваем отправления: заказ закрывают и через месяц. */
  private static readonly LOOKBACK_DAYS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly orders: OzonOrdersService,
    private readonly metrikaOutbox: MetrikaOrderOutboxService,
  ) {}

  async pollOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const open = await this.prisma.orderPhoto.findMany({
        where: {
          isMarketplacePrint: true,
          marketplacePostingNumber: { not: null },
          marketplaceAccountId: { not: null },
          closedAt: null,
          status: { not: EnumStatus.CANCELLED },
        },
        select: {
          id: true,
          numberOrder: true,
          status: true,
          marketplacePostingNumber: true,
          marketplaceAccountId: true,
        },
        orderBy: { createdAt: 'asc' },
        take: OzonShippedCloseService.BATCH,
      });
      if (open.length === 0) return;

      // Группируем по кабинету: список отправлений отдаётся одним запросом
      // на кабинет, а не по запросу на заказ — лимиты площадки не резиновые.
      const byAccount = new Map<string, typeof open>();
      for (const order of open) {
        const key = order.marketplaceAccountId!;
        const list = byAccount.get(key) ?? [];
        list.push(order);
        byAccount.set(key, list);
      }

      let closed = 0;
      for (const [accountId, ordersOfAccount] of byAccount) {
        const groups = await this.groupsFor(accountId);
        if (!groups) continue;
        for (const order of ordersOfAccount) {
          const group = groups.get(order.marketplacePostingNumber!);
          if (!shouldCloseAsShipped({ status: order.status, marketplaceGroup: group })) {
            continue;
          }
          await this.close(order.id, order.status);
          closed += 1;
          this.logger.log(
            `Заказ ${order.numberOrder} закрыт: площадка отгрузила отправление ${order.marketplacePostingNumber}`,
          );
        }
      }
      if (closed > 0) {
        this.logger.log(`Закрыто по отгрузке площадки: ${closed}`);
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Состояния отправлений кабинета: номер → группа.
   *
   * Кабинет может не ответить — ключ отозвали, площадка прилегла. Это не
   * повод валить тик: вернём пусто, и заказы просто закроются в следующий
   * раз. Молчать об этом тоже нельзя, поэтому пишем в журнал.
   */
  private async groupsFor(
    accountId: string,
  ): Promise<Map<string, string> | null> {
    try {
      const creds = await this.accounts.credentials(accountId);
      const page = await this.orders.list(creds, {
        sinceDays: OzonShippedCloseService.LOOKBACK_DAYS,
        limit: 200,
      });
      return new Map(page.orders.map((o) => [o.postingNumber, o.group]));
    } catch (error) {
      this.logger.warn(
        `Кабинет ${accountId}: не удалось получить отправления — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Перевод в «Отгружен» тем же способом, каким это делает человек.
   *
   * История статусов, дата завершения, дата закрытия и очередь в Метрику —
   * всё, что ставит обычный переход. Обойти их значило бы оставить заказ
   * в состоянии, которого не бывает: закрыт, а в истории пусто и аналитика
   * считает его незавершённым.
   */
  private async close(orderId: string, fromStatus: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const history = await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus: EnumStatus.COMPLETED,
          // Видно, что заказ закрыл не человек, а синхронизация с площадкой.
          changedBy: 'ozon-sync',
        },
      });
      await tx.orderPhoto.update({
        where: { id: orderId },
        data: {
          status: EnumStatus.COMPLETED,
          statusChangedAt: now,
          completedAt: now,
          closedAt: now,
        },
      });
      await this.metrikaOutbox.enqueueTransition(tx, {
        orderId,
        fromStatus,
        toStatus: EnumStatus.COMPLETED,
        statusHistoryId: history.id,
      });
    });
  }
}
