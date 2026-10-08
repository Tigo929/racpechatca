import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderPhotoService } from 'src/order-photo/order-photo.service';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumSourceOrder,
} from 'src/generated/prisma/enums';
import type { OzonCredentials } from './ozon/ozon-api.client';
import {
  OzonOrdersService,
  type OzonOrderView,
} from './ozon/ozon-orders.service';
import {
  buildMarketplaceOrderDraft,
  OzonArticleError,
  type MarketplaceOrderDraft,
} from './ozon/ozon-crm-order';

/**
 * «Завести отправление Ozon в CRM».
 *
 * Собирает заказ теми же методами, что и оформление руками
 * (OrderPhotoService.createOrder): номер заказа, история статусов,
 * уведомления — всё как у обычного заказа, второй ветки создания не
 * появилось. Отличается только источник данных: не человек, а отправление.
 *
 * Повторное нажатие не плодит заказы. Отправление связано с заказом
 * уникальной колонкой marketplacePostingNumber, и если заказ уже есть,
 * возвращается он же — оператор попадает в ту же карточку.
 */
@Injectable()
export class OzonCrmOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ozonOrders: OzonOrdersService,
    private readonly orders: OrderPhotoService,
  ) {}

  /** Уже заведённый заказ по номеру отправления; null — ещё нет. */
  async findByPosting(postingNumber: string) {
    return this.prisma.orderPhoto.findUnique({
      where: { marketplacePostingNumber: postingNumber },
      select: { id: true, numberOrder: true, marketplaceOrderNumber: true },
    });
  }

  /**
   * Заказы CRM по пачке номеров отправлений — для списка.
   *
   * В списке отправлений стоит статус площадки, и у всех собранных заказов
   * он один: «ждёт отгрузки». По нему не видно того, что нужно на самом
   * деле, — где заказ в нашем процессе: макет ещё не делали, лист ушёл
   * клиенту, согласован, передан в производство. Поэтому к каждому
   * отправлению добавляется его заказ CRM.
   *
   * Одним запросом, а не по заказу на строку: строк на экране до двухсот.
   *
   * Берём и последнюю версию листа согласования: «согласован» — это не
   * статус заказа, а ответ клиента по макету, и иначе этот шаг в списке
   * не показать.
   */
  async findByPostings(postingNumbers: readonly string[]) {
    const found = new Map<
      string,
      {
        id: string;
        numberOrder: string;
        status: string;
        approvalStatus: string | null;
      }
    >();
    if (postingNumbers.length === 0) return found;

    const rows = await this.prisma.orderPhoto.findMany({
      where: { marketplacePostingNumber: { in: [...postingNumbers] } },
      select: {
        id: true,
        numberOrder: true,
        status: true,
        marketplacePostingNumber: true,
        approvals: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    });
    for (const row of rows) {
      if (!row.marketplacePostingNumber) continue;
      found.set(row.marketplacePostingNumber, {
        id: row.id,
        numberOrder: row.numberOrder,
        status: row.status,
        approvalStatus: row.approvals[0]?.status ?? null,
      });
    }
    return found;
  }

  async createFromPosting(
    creds: OzonCredentials,
    accountId: string,
    postingNumber: string,
    adminId?: string,
    chatUrl?: string,
  ): Promise<{ orderId: string; created: boolean }> {
    const existing = await this.findByPosting(postingNumber);
    if (existing) return { orderId: existing.id, created: false };

    const posting = await this.ozonOrders.get(creds, postingNumber);
    if (!posting) {
      throw new NotFoundException('Отправление не найдено в кабинете Ozon');
    }

    const draft = this.draftOrRefuse(posting);

    const created = await this.orders.createOrder(
      {
        productCategory: EnumProductCategory.TSHIRT,
        sourceOrder: EnumSourceOrder.OZON,
        // Переписка идёт в кабинете площадки: своего Telegram у покупателя
        // для нас нет, и приветственные сообщения такому заказу не шлются.
        communicationPlatform: EnumCommunication.OZON,
        // Контакт: ссылка на переписку, если оператор её вставил, иначе
        // номер отправления. Чат с покупателем живёт в кабинете, и ссылки
        // на него у отправления нет — но по номеру заказ там находят.
        urlCommunication:
          (chatUrl ?? '').trim() || draft.marketplacePostingNumber,
        // Доставку ведёт площадка: в CRM ни способа, ни стоимости.
        deliveryMethod: EnumDeliveryMethod.PICKUP,
        deliveryCost: 0,
        isUrgent: false,
        urgencyFee: 0,
        isMarketplacePrint: true,
        marketplaceOrderNumber: draft.marketplaceOrderNumber,
        marketplacePostingNumber: draft.marketplacePostingNumber,
        marketplaceAccountId: accountId,
        note: draft.note,
        tshirtItems: draft.items.map((item) => ({
          color: item.color,
          size: item.size,
          printLocation: item.printLocation,
          quantity: item.quantity,
          price: item.price,
          marketplaceArticle: item.offerId,
        })),
      },
      adminId,
    );

    return { orderId: created.id, created: true };
  }
  /**
   * Черновик или понятный отказ.
   *
   * Артикул не по схеме — это не сбой сервера, а ситуация, в которой
   * заводить заказ нельзя: сказать человеку причину полезнее, чем
   * подставить выдуманный цвет.
   */
  private draftOrRefuse(posting: OzonOrderView): MarketplaceOrderDraft {
    try {
      return buildMarketplaceOrderDraft(posting);
    } catch (error) {
      if (error instanceof OzonArticleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
