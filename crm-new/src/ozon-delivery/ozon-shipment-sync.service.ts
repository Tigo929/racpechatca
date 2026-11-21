import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { OrderPhotoService } from 'src/order-photo/order-photo.service';
import { OzonDeliveryClient } from './ozon-delivery.client';
import {
  OzonShipmentService,
  PICKUP_REMIND_AFTER_DAYS,
} from './ozon-shipment.service';
import { ACTIVE_STATUSES } from './ozon-shipment';

/**
 * Статусы отправлений Ozon — сами, без отметок руками.
 *
 * Раз в 20 минут спрашиваем Ozon про все отправления в пути. Что из этого
 * следует для заказа:
 *  • Ozon принял посылку (едет) → фотозаказ становится «Отправлен»: ровно
 *    то, что раньше ставили руками, с начислением зарплаты по обычным
 *    правилам;
 *  • посылка лежит в пункте дольше PICKUP_REMIND_AFTER_DAYS дней →
 *    напоминание владельцу: Ozon хранит её ограниченный срок;
 *  • возврат → сообщение владельцу сразу.
 */
const INTERVAL_MS = 20 * 60 * 1000;
const STARTUP_DELAY_MS = 2 * 60 * 1000;

@Injectable()
export class OzonShipmentSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OzonShipmentSyncService.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: OzonDeliveryClient,
    private readonly shipments: OzonShipmentService,
    private readonly orders: OrderPhotoService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || !this.client.configured) return;
    this.timers.push(
      setTimeout(() => void this.run(), STARTUP_DELAY_MS),
      setInterval(() => void this.run(), INTERVAL_MS),
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
  }

  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const active = await this.prisma.ozonShipment.findMany({
        where: {
          status: { in: [...ACTIVE_STATUSES] },
          postingNumber: { not: null },
        },
        select: { orderId: true },
      });
      for (const { orderId } of active) {
        try {
          const change = await this.shipments.sync(orderId);
          if (change) await this.onChange(orderId, change.to);
        } catch (e) {
          this.logger.warn(
            `Ozon: статус ${orderId} не обновлён: ${(e as Error).message}`,
          );
        }
      }
      await this.remindUncollected();
    } catch (e) {
      this.logger.error('Ozon: проход по статусам не удался', e as Error);
    } finally {
      this.running = false;
    }
  }

  private async onChange(orderId: string, to: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        numberOrder: true,
        productCategory: true,
        status: true,
        ozonShipment: { select: { createdById: true } },
      },
    });
    if (!order) return;

    // Фото: «Отгрузка создана» → «Отправлен», когда Ozon принял посылку.
    // У футболок SENT означает «передан в производство» — их не трогаем.
    if (
      ['IN_TRANSIT', 'AT_PICKUP_POINT', 'DELIVERED'].includes(to) &&
      order.productCategory === 'PHOTO' &&
      order.status === EnumStatus.SHIPMENT_CREATED &&
      order.ozonShipment?.createdById
    ) {
      try {
        await this.orders.updateStatusOrder(
          orderId,
          { status: EnumStatus.SENT },
          order.ozonShipment.createdById,
          'ADMIN',
          { automatic: true },
        );
      } catch (e) {
        await this.telegram.sendToOwner(
          `⚠️ Заказ ${order.numberOrder}: Ozon принял посылку, но отметить «Отправлен» не вышло — ${(e as Error).message}. Поставьте статус руками.`,
        );
      }
    }

    if (to === 'RETURNING' || to === 'RETURNED') {
      await this.telegram.sendToOwner(
        to === 'RETURNED'
          ? `↩️ Заказ ${order.numberOrder}: посылка Ozon вернулась в пункт отгрузки. Заберите её.`
          : `↩️ Заказ ${order.numberOrder}: посылка Ozon возвращается — клиент не забрал или отказался.`,
      );
    }
  }

  /** Посылка ждёт в пункте слишком долго — напомнить один раз. */
  private async remindUncollected() {
    const border = new Date(
      Date.now() - PICKUP_REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );
    const stale = await this.prisma.ozonShipment.findMany({
      where: {
        status: 'AT_PICKUP_POINT',
        arrivedAt: { lt: border },
        ownerRemindedAt: null,
      },
      include: {
        order: {
          select: {
            numberOrder: true,
            recipientName: true,
            recipientPhone: true,
          },
        },
      },
    });
    for (const s of stale) {
      const ok = await this.telegram.sendToOwner(
        `📦 Заказ ${s.order.numberOrder}: посылка ждёт в пункте Ozon с ${s.arrivedAt?.toLocaleDateString('ru-RU')} — клиент не забирает.` +
          ` Напомните ${s.order.recipientName ?? 'клиенту'}${s.order.recipientPhone ? ` (${s.order.recipientPhone})` : ''}, иначе Ozon вернёт её.`,
      );
      if (ok) {
        await this.prisma.ozonShipment.update({
          where: { id: s.id },
          data: { ownerRemindedAt: new Date() },
        });
      }
    }
  }
}
