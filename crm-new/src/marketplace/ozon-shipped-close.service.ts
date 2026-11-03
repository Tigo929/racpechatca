import { Injectable, Logger } from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaOrderOutboxService } from 'src/metrika/orders/metrika-order-outbox.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import {
  OzonOrdersService,
  type OzonOrderView,
} from './ozon/ozon-orders.service';
import { OzonAutoshipService } from './ozon-autoship.service';
import { shouldShipToAssembly } from './ozon/ozon-autoship';
import {
  isMarketplaceDelivered,
  shouldCloseAsShipped,
} from './ozon/ozon-shipped-close';

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
 * Заодно делает ещё две вещи — обе на тех же, уже полученных состояниях
 * отправлений, без лишних запросов к площадке.
 *
 * Отправляет на сборку. «Передан в производство» в CRM и «Собрать» в
 * кабинете — одно решение, которое принималось дважды; второй раз
 * забывалось, и отправление висело в «ждёт отгрузки» до сгоревшего срока.
 * Выключено по умолчанию: сборку в Ozon не отменить (OzonAutoshipService).
 *
 * Отмечает выкуп. Заказ закрывается уже на «везут», а забирают
 * посылку днями позже — и только это значит, что товар у человека в руках.
 * Дату выкупа ждёт просьба об отзыве: до неё спрашивать «как вам футболка»
 * не о чем. Спрашиваем здесь, а не вторым опросом, потому что состояния
 * отправлений уже получены — второй опрос расходовал бы лимит площадки
 * ради тех же самых чисел.
 *
 * Чего НЕ делает. Не отменяет заказы вслед за площадкой и не возвращает
 * закрытые обратно: отмена — решение с последствиями (склад, зарплата,
 * деньги), и принимать его молча автоматика не должна. Не снимает отметку
 * выкупа: Ozon меняет статус доставленного отправления при возврате, а
 * «отзыв попросили» — уже случившийся факт.
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
  // Совпадает с экраном заказов: тогда фоновая сверка и интерфейс делят один
  // ответ Ozon через кэш OzonOrdersService, а не расходуют лимит дважды.
  private static readonly LOOKBACK_DAYS = 90;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly orders: OzonOrdersService,
    private readonly metrikaOutbox: MetrikaOrderOutboxService,
    private readonly autoship: OzonAutoshipService,
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
          status: { not: EnumStatus.CANCELLED },
          /*
           * Заказ попадает в сверку, пока от площадки нужен хотя бы один
           * ответ: закрыть его или отметить выкуп. Второе случается позже
           * первого — закрытые заказы поэтому тоже спрашиваем, иначе выкуп
           * не узнать никогда.
           */
          OR: [{ closedAt: null }, { marketplaceDeliveredAt: null }],
          /*
           * Глубже площадка и не ответит: список отправлений мы просим за
           * LOOKBACK_DAYS. Без этой границы двадцать древних заказов,
           * которых Ozon уже не отдаёт, занимали бы весь пакет — и до
           * свежих сверка не доходила бы вовсе.
           */
          createdAt: {
            gte: new Date(
              Date.now() -
                OzonShippedCloseService.LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
            ),
          },
        },
        select: {
          id: true,
          numberOrder: true,
          status: true,
          closedAt: true,
          marketplaceDeliveredAt: true,
          marketplaceShipRequestedAt: true,
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
      let delivered = 0;
      let shipped = 0;
      for (const [accountId, ordersOfAccount] of byAccount) {
        const postings = await this.postingsFor(accountId);
        if (!postings) continue;
        for (const order of ordersOfAccount) {
          const posting = postings.get(order.marketplacePostingNumber!);
          const group = posting?.group;

          /*
           * Сборка — первым делом и только если включена.
           *
           * Раньше закрытия и выкупа потому, что это единственное
           * действие, меняющее что-то на стороне площадки: остальные две
           * отметки живут у нас и подождут следующего тика.
           */
          if (
            this.autoship.enabled &&
            shouldShipToAssembly({
              status: order.status,
              marketplaceShipRequestedAt: order.marketplaceShipRequestedAt,
              marketplaceGroup: group,
              items: posting?.items,
            })
          ) {
            const result = await this.autoship.ship({
              id: order.id,
              numberOrder: order.numberOrder,
              marketplacePostingNumber: order.marketplacePostingNumber!,
              marketplaceAccountId: order.marketplaceAccountId!,
              posting: posting!,
            });
            if (result === 'shipped') shipped += 1;
            // Состояние отправления только что изменилось: закрывать и
            // отмечать выкуп по устаревшему ответу нельзя.
            continue;
          }

          // Выкуп отмечаем раньше закрытия: если следом что-то упадёт,
          // потеряется закрытие заказа (его поправит следующий тик), а не
          // единственный момент, когда площадка сказала «забрали».
          if (!order.marketplaceDeliveredAt && isMarketplaceDelivered(group)) {
            await this.markDelivered(order.id);
            delivered += 1;
            this.logger.log(
              `Заказ ${order.numberOrder}: покупатель выкупил отправление ${order.marketplacePostingNumber}`,
            );
          }

          if (
            order.closedAt ||
            !shouldCloseAsShipped({
              status: order.status,
              marketplaceGroup: group,
            })
          ) {
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
      if (delivered > 0) {
        this.logger.log(`Отмечено выкупов: ${delivered}`);
      }
      if (shipped > 0) {
        this.logger.log(`Отправлено на сборку: ${shipped}`);
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Отправления кабинета: номер → отправление.
   *
   * Кабинет может не ответить — ключ отозвали, площадка прилегла. Это не
   * повод валить тик: вернём пусто, и заказы просто закроются в следующий
   * раз. Молчать об этом тоже нельзя, поэтому пишем в журнал.
   */
  private async postingsFor(
    accountId: string,
  ): Promise<Map<string, OzonOrderView> | null> {
    try {
      const creds = await this.accounts.credentials(accountId);
      const page = await this.orders.list(creds, {
        sinceDays: OzonShippedCloseService.LOOKBACK_DAYS,
        // Та же максимальная страница, что на экране маркетплейса. Так
        // активный заказ не теряется за отправлениями других линеек, а
        // экран и фоновая сверка продолжают делить один кешированный ответ.
        limit: 1000,
      });
      return new Map(page.orders.map((o) => [o.postingNumber, o]));
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
   * Отметка выкупа.
   *
   * Только дата, без истории статусов и без Метрики: статус заказа от
   * выкупа не меняется — он уже закрыт как отгруженный. Это факт о
   * покупателе, а не о нашей работе, и нужен он одному: просьбе об отзыве.
   */
  private async markDelivered(orderId: string): Promise<void> {
    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: { marketplaceDeliveredAt: new Date() },
    });
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
