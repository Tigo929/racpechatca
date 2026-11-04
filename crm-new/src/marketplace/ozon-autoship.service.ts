import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonApiClient, OzonApiError } from './ozon/ozon-api.client';
import { packageProducts } from './ozon/ozon-autoship';
import type { OzonOrderView } from './ozon/ozon-orders.service';

/**
 * Отправка отправления на сборку в кабинет Ozon.
 *
 * Владелец переводил заказ в «Передан в производство» в CRM, а потом шёл в
 * Seller и нажимал «Собрать» руками. Одно и то же решение дважды: второй
 * раз забывается, и отправление висит в «ждёт отгрузки», пока не сгорит
 * срок — а это уже снижение рейтинга продавца и деньги.
 *
 * Включено по умолчанию (решение владельца 04.11.2026): «Передан в
 * производство» и есть решение собрать посылку, и подтверждать его второй
 * раз в кабинете незачем. Сборку в Ozon не отменить — площадка считает
 * посылку готовой, печатает ярлык и ждёт её у перевозчика, — поэтому
 * выключатель остался: OZON_AUTOSHIP_ENABLED=false останавливает
 * автоматику без выкатки.
 *
 * Повторов нет. Отказ площадки почти всегда требует человека: не заполнены
 * данные об экземплярах, не тот склад, истёк срок. Попытка каждые 15 минут
 * дала бы поток одинаковых сообщений и ни одной собранной посылки.
 * Поэтому отказ записывается в заказ, уходит владельцу одним сообщением —
 * и автоматика к этому отправлению больше не возвращается.
 */
@Injectable()
export class OzonAutoshipService {
  private readonly logger = new Logger(OzonAutoshipService.name);
  readonly enabled: boolean;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly api: OzonApiClient,
    private readonly telegram: TelegramService,
  ) {
    // Пусто — работаем: отсутствие переменной не должно означать
    // «молча ничего не делать». Остановка — только явным false.
    this.enabled = config.get<string>('OZON_AUTOSHIP_ENABLED') !== 'false';
  }

  /**
   * Собрать отправление и записать итог.
   *
   * Исключений наружу не бросает: вызывается из фоновой сверки, и отказ по
   * одному заказу не должен останавливать остальные. Всё, что случилось,
   * остаётся в заказе и в журнале.
   */
  async ship(order: {
    id: string;
    numberOrder: string;
    marketplacePostingNumber: string;
    marketplaceAccountId: string;
    posting: OzonOrderView;
  }): Promise<'shipped' | 'failed'> {
    const products = packageProducts(order.posting.items);

    try {
      const creds = await this.accounts.credentials(order.marketplaceAccountId);
      /*
       * Одна упаковка на всё отправление: заказ мы и правда кладём в одну
       * коробку. Делить на несколько посылок — решение склада, и принимать
       * его автоматика не должна.
       */
      await this.api.post(creds, '/v4/posting/fbs/ship', {
        posting_number: order.marketplacePostingNumber,
        packages: [{ products }],
      });
    } catch (error) {
      const reason = this.reason(error);
      await this.mark(order.id, reason);
      this.logger.error(
        `Заказ ${order.numberOrder}: отправление ${order.marketplacePostingNumber} не ушло на сборку — ${reason}`,
      );
      await this.alert(order, reason);
      return 'failed';
    }

    await this.mark(order.id, null);
    this.logger.log(
      `Заказ ${order.numberOrder}: отправление ${order.marketplacePostingNumber} отправлено на сборку`,
    );
    return 'shipped';
  }

  /** Попытка была — повторять не будем. Текст отказа тут же, рядом. */
  private async mark(orderId: string, error: string | null): Promise<void> {
    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        marketplaceShipRequestedAt: new Date(),
        marketplaceShipError: error,
      },
    });
  }

  /**
   * Ответ площадки — одной строкой для человека.
   *
   * Смысл сообщения не в том, что именно сказал Ozon, а в том, что посылку
   * придётся собрать руками. Поэтому текст площадки идёт как есть: он
   * подсказывает, чего не хватает.
   */
  private reason(error: unknown): string {
    if (error instanceof OzonApiError) return error.humanMessage;
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Сообщение владельцу — только при отказе.
   *
   * Удачная сборка видна на экране заказов сама: отправление уходит из
   * «ждёт отгрузки». А вот неудачная не видна ничем, кроме того же
   * «ждёт отгрузки», — и именно её легко не заметить до последнего дня.
   */
  private async alert(
    order: { numberOrder: string; marketplacePostingNumber: string },
    reason: string,
  ): Promise<void> {
    const text = [
      '⚠️ <b>Отправление не ушло на сборку</b>',
      '',
      `Заказ: <code>${order.numberOrder}</code>`,
      `Отправление: <code>${order.marketplacePostingNumber}</code>`,
      '',
      `Площадка ответила: ${reason}`,
      '',
      'Соберите отправление в кабинете Ozon руками — автоматика к нему больше не вернётся.',
    ].join('\n');
    try {
      await this.telegram.sendToOwner(text);
    } catch (error) {
      // Молчать нельзя, но и падать из-за недоставленного сообщения тоже:
      // отметка в заказе уже стоит, и это главное.
      this.logger.warn(
        `Не удалось предупредить об отказе сборки: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
