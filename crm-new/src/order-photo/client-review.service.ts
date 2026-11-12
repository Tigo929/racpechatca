import { Injectable, Logger } from '@nestjs/common';
import {
  EnumDeliveryMethod,
  EnumProductCategory,
} from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { telegramUsernameFromUrl, type GreetingStatus } from './client-greeting';
import {
  isReviewReminderEligible,
  REVIEW_REMINDER_CATEGORIES,
} from './review-reminder-rules';
import { buildReviewRequestText } from './review-reminder.service';
import { skipAlreadyAsked } from './client-identity';
import { ReviewAudienceService } from './review-audience.service';

/**
 * Очередь просьб об отзыве, которые уходят клиенту сами.
 *
 * Раньше просьбу всегда отправлял человек: CRM присылала владельцу текст
 * и ссылку на диалог, он копировал и отправлял. Для заказов с площадки это
 * и была вся автоматизация — в чат кабинета из фона не напишешь.
 *
 * Но если покупатель написал нам в Telegram (а мы об этом просим в
 * разговоре), диалог уже начат, и ответить в него можно без человека.
 * Отправляет тот же живой аккаунт, что рассылает приветствия: у CRM нет
 * и не должно быть доступа к личному аккаунту, она только отдаёт очередь
 * и запоминает итог.
 *
 * Чего здесь нет намеренно: отправки в чат площадки. Переписка там
 * модерируется, а рассылка из фона — путь к блокировке продавца. Нет
 * Telegram — просьбу по-прежнему отправляет человек.
 */

export interface PendingReviewRequest {
  id: string;
  numberOrder: string;
  /** Голый никнейм — воркеру нужен он, а не «@name» и не ссылка. */
  username: string;
  /**
   * Готовый текст. Собирает CRM: тот же текст уходит владельцу, когда
   * отправлять приходится руками. Две сборки одного текста разошлись бы
   * при первой правке, и клиенты получали бы разные сообщения.
   */
  text: string;
}

/** Сколько ждать между попытками по заказу, которому Telegram сказал «часто». */
const FLOOD_RETRY_MS = 60 * 60 * 1000;

@Injectable()
export class ClientReviewService {
  private readonly logger = new Logger(ClientReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly audience: ReviewAudienceService,
  ) {}

  /**
   * Кому пора написать про отзыв.
   *
   * Отбор узкий: только заказы с записанным Telegram покупателя, только
   * те, где просьба ещё не уходила, и только когда просить уже есть о чём
   * (выкуп на площадке или наша отправка плюс выдержка). Остальное —
   * работа обычного напоминания владельцу.
   */
  async pending(limit: number): Promise<PendingReviewRequest[]> {
    const rows = await this.prisma.orderPhoto.findMany({
      where: {
        productCategory: { in: REVIEW_REMINDER_CATEGORIES },
        clientReviewLeft: false,
        reviewRequestSentAt: null,
        reviewReminderNotifiedAt: null,
        clientTelegram: { not: null },
        /*
         * Ещё не пробовали — или Telegram попросил подождать. Остальные
         * отказы (нет такого ника, закрыт личными настройками, заблокировал)
         * повторять бессмысленно: там нужен человек, и заказ уходит в
         * обычное напоминание владельцу.
         */
        OR: [
          { reviewRequestStatus: null },
          {
            reviewRequestStatus: 'flood',
            updatedAt: { lte: new Date(Date.now() - FLOOD_RETRY_MS) },
          },
        ],
      },
      orderBy: { marketplaceDeliveredAt: 'asc' },
      take: Math.max(1, Math.min(limit, 20)),
      select: {
        id: true,
        numberOrder: true,
        productCategory: true,
        status: true,
        deliveryMethod: true,
        sourceOrder: true,
        sentAt: true,
        clientReviewLeft: true,
        reviewReminderNotifiedAt: true,
        isMarketplacePrint: true,
        marketplaceDeliveredAt: true,
        clientTelegram: true,
        urlCommunication: true,
      },
    });

    /*
     * Тому, кому про отзыв уже писали, не пишем снова.
     *
     * Отметка стоит на прошлом заказе, а человек тот же — узнаём его по
     * нику в Telegram. Для постоянного заказчика это разница между
     * «спросили один раз» и рассылкой после каждой покупки.
     */
    const asked = await this.audience.askedIdentities();

    const items: PendingReviewRequest[] = [];
    for (const order of skipAlreadyAsked(rows, asked)) {
      /*
       * Срок проверяем в коде, а не запросом: правило «когда уместно
       * просить» одно на весь проект (review-reminder-rules), и повторять
       * его вторым, слегка другим SQL — это две разные правды о том, когда
       * мы пишем клиенту.
       */
      if (
        !isReviewReminderEligible({
          productCategory: order.productCategory,
          status: order.status,
          deliveryMethod: order.deliveryMethod as EnumDeliveryMethod,
          clientReviewLeft: order.clientReviewLeft,
          reviewReminderNotifiedAt: order.reviewReminderNotifiedAt,
          sentAt: order.sentAt,
          isMarketplacePrint: order.isMarketplacePrint,
          marketplaceDeliveredAt: order.marketplaceDeliveredAt,
        })
      ) {
        continue;
      }

      const username = telegramUsernameFromUrl(order.clientTelegram);
      if (!username) {
        // Записано что-то, из чего ника не выходит. Пробовать нечего:
        // помечаем и отдаём заказ человеку.
        await this.mark(order.id, 'not_found');
        continue;
      }

      items.push({
        id: order.id,
        numberOrder: order.numberOrder,
        username,
        text: buildReviewRequestText(
          order.productCategory,
          order.sourceOrder,
          order.urlCommunication,
        ),
      });
    }
    return items;
  }

  /**
   * Итог попытки.
   *
   * Удача закрывает вопрос: просьба отправлена, владельцу об этом говорим
   * отдельным сообщением — не для действия, а чтобы он знал, что клиенту
   * написали, и не написал второй раз.
   *
   * Отказ не закрывает ничего: отметка о напоминании не ставится, и
   * заказ попадает в обычное напоминание владельцу вместе с причиной,
   * по которой автоматика не справилась.
   */
  async mark(id: string, status: GreetingStatus): Promise<void> {
    const sent = status === 'sent';
    const order = await this.prisma.orderPhoto.update({
      where: { id },
      data: {
        reviewRequestStatus: status,
        ...(sent
          ? {
              reviewRequestSentAt: new Date(),
              // «auto» вместо имени оператора: по этому полю потом видно,
              // кто просил — человек или система.
              reviewRequestSentBy: 'auto',
              // Владельцу напоминать больше не нужно — уже отправлено.
              reviewReminderNotifiedAt: new Date(),
            }
          : {}),
      },
      select: {
        numberOrder: true,
        clientTelegram: true,
        productCategory: true,
      },
    });

    if (!sent) {
      this.logger.warn(
        `Заказ ${order.numberOrder}: просьба об отзыве не ушла в Telegram (${status}) — отдаём человеку`,
      );
      return;
    }

    this.logger.log(
      `Заказ ${order.numberOrder}: просьба об отзыве отправлена клиенту ${order.clientTelegram ?? ''}`,
    );
    await this.notifyOwner(order.numberOrder, order.clientTelegram, order.productCategory);
  }

  private async notifyOwner(
    numberOrder: string,
    clientTelegram: string | null,
    category: EnumProductCategory,
  ): Promise<void> {
    const what =
      category === EnumProductCategory.TSHIRT
        ? 'футболке'
        : category === EnumProductCategory.CANVAS
          ? 'холсте'
          : 'фотографиях';
    const text = [
      '✉️ <b>Просьба об отзыве отправлена клиенту</b>',
      '',
      `Заказ: <code>${numberOrder}</code>`,
      ...(clientTelegram ? [`Telegram: ${clientTelegram}`] : []),
      '',
      `Клиенту написали сами — спросили о ${what} и попросили отзыв.`,
      'Отправлять второй раз не нужно: если ответит, разговор уже в Telegram.',
    ].join('\n');
    try {
      await this.telegram.sendToOwner(text);
    } catch (error) {
      // Сообщение владельцу — не то, из-за чего стоит терять отметку:
      // просьба клиенту уже ушла, и это главное.
      this.logger.warn(
        `Не удалось сообщить об отправке просьбы по заказу ${numberOrder}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
