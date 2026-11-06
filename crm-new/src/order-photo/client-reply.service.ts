import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EnumCommunication, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { MetrikaOrderOutboxService } from 'src/metrika/orders/metrika-order-outbox.service';
import { telegramUsernameFromUrl } from './client-greeting';
import { SITE_LEAD_PREFIX } from './client-greeting.service';
import { isAffirmativeReply } from './client-reply';

/**
 * Ответ клиента на приветствие: кто ещё молчит и что делать с ответом.
 *
 * Цепочка до этой очереди: заявка с сайта → живой аккаунт здоровается сам →
 * клиент отвечает. Дальше раньше начинался человек: прочитать, отправить
 * подтверждение с суммой, перевести заявку в заказ. Теперь на чистое «да»
 * это делает система — счёт уходит сразу, пока человек не остыл.
 *
 * Читает диалог тот же живой аккаунт (контейнер greeter): у CRM доступа
 * к личному Telegram нет и быть не должно. Сюда он приносит только текст
 * ответа, а решение — согласие это или разговор — принимает CRM, в одном
 * месте и по одному правилу (client-reply.ts).
 *
 * Что здесь НЕ происходит: переписка не хранится. Записываем один ответ —
 * тот, которым клиент откликнулся на приветствие. Он нужен владельцу, когда
 * автомат не признал ответ согласием: в уведомлении должно быть видно, что
 * человек написал, иначе за ответом придётся идти в Telegram.
 */

/** Сколько ждём ответа, прежде чем перестать читать диалог. */
const REPLY_WATCH_MS = 14 * 24 * 60 * 60 * 1000;

export interface PendingReply {
  id: string;
  numberOrder: string;
  /** Голый никнейм — воркеру нужен он, а не «@name» и не ссылка. */
  username: string;
  /** Когда поздоровались: ответы раньше этого к заявке не относятся. */
  greetedAt: string;
}

@Injectable()
export class ClientReplyService {
  private readonly logger = new Logger(ClientReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly metrikaOutbox: MetrikaOrderOutboxService,
  ) {}

  /**
   * Заявки, которым поздоровались и ждут ответа.
   *
   * Отбор узкий намеренно: только заявки с сайта в Telegram, только те, где
   * приветствие действительно ушло, и только пока заявка остаётся заявкой.
   * Заказ, который менеджер уже взял в работу руками, читать незачем — там
   * разговор ведёт человек.
   */
  async pending(limit: number): Promise<PendingReply[]> {
    const since = new Date(Date.now() - REPLY_WATCH_MS);
    const rows = await this.prisma.orderPhoto.findMany({
      where: {
        status: EnumStatus.LEAD,
        communicationPlatform: EnumCommunication.TELEGRAM,
        externalRequestId: { startsWith: SITE_LEAD_PREFIX },
        clientGreetStatus: 'sent',
        clientGreetedAt: { not: null, gte: since },
        clientReplyAt: null,
      },
      orderBy: { clientGreetedAt: 'asc' },
      take: Math.max(1, Math.min(limit, 20)),
      select: {
        id: true,
        numberOrder: true,
        urlCommunication: true,
        clientGreetedAt: true,
      },
    });

    const items: PendingReply[] = [];
    for (const order of rows) {
      const username = telegramUsernameFromUrl(order.urlCommunication);
      // Ника нет — читать нечего. Такую заявку приветствие и не нашло бы,
      // но очередь не должна падать из-за одной испорченной строки.
      if (!username || !order.clientGreetedAt) continue;
      items.push({
        id: order.id,
        numberOrder: order.numberOrder,
        username,
        greetedAt: order.clientGreetedAt.toISOString(),
      });
    }
    return items;
  }

  /**
   * Клиент ответил.
   *
   * Чистое «да» переводит заявку в заказ и ставит счёт в очередь отправки.
   * Любой другой ответ не меняет ничего, кроме отметки «ответил»: его читает
   * владелец и отвечает сам.
   *
   * Повторный вызов по тому же заказу ничего не делает: воркер может
   * принести один и тот же ответ дважды (перезапуск, повторный опрос), и
   * клиент не должен получить два счёта.
   */
  async accept(
    id: string,
    text: string,
  ): Promise<{ confirmed: boolean; duplicate: boolean }> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id },
      select: {
        id: true,
        numberOrder: true,
        status: true,
        clientReplyAt: true,
        clientConfirmedAt: true,
        urlCommunication: true,
        totalOrder: true,
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    if (order.clientReplyAt) {
      return { confirmed: Boolean(order.clientConfirmedAt), duplicate: true };
    }

    const clean = (text ?? '').trim().slice(0, 1000);
    const confirmed = isAffirmativeReply(clean);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.orderPhoto.update({
        where: { id },
        data: {
          clientReplyText: clean,
          clientReplyAt: now,
          ...(confirmed ? { clientConfirmedAt: now } : {}),
        },
      });

      if (!confirmed || order.status !== EnumStatus.LEAD) return;

      /*
       * Заявка становится заказом.
       *
       * Статус двигаем здесь, а не общим updateStatusOrder: у перехода нет
       * пользователя, а тот метод проверяет права и роль того, кто нажал.
       * Всё, что для этого перехода важно, делается тут же и в одной
       * транзакции — история и очередь в Метрику, иначе воронка потеряет
       * шаг «заявка стала заказом».
       */
      const history = await tx.statusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: EnumStatus.NEW,
          // Не имя оператора: по этой отметке видно, что статус поставил
          // ответ клиента, а не человек.
          changedBy: 'auto:client-reply',
        },
      });
      await tx.orderPhoto.update({
        where: { id },
        data: { status: EnumStatus.NEW, statusChangedAt: now },
      });
      await this.metrikaOutbox.enqueueTransition(tx, {
        orderId: id,
        fromStatus: order.status,
        toStatus: EnumStatus.NEW,
        statusHistoryId: history.id,
      });
    });

    if (confirmed) {
      this.logger.log(
        `Заказ ${order.numberOrder}: клиент подтвердил («${clean}») — заявка стала заказом`,
      );
      if (order.totalOrder <= 0) {
        /*
         * Сумма не посчитана — счёт автоматом не уйдёт (см.
         * ClientInvoiceService). Молчать здесь нельзя: человек согласился
         * и ждёт реквизиты, а узнать, что их никто не отправил, он
         * не должен от самого себя.
         */
        await this.notifyOwner(
          order.numberOrder,
          clean,
          order.urlCommunication,
          'Клиент согласился, но суммы в заявке нет — счёт автоматом не уйдёт. Посчитайте и отправьте подтверждение из карточки.',
        );
      }
    } else {
      this.logger.log(
        `Заказ ${order.numberOrder}: клиент ответил не согласием — отдаём человеку`,
      );
      await this.notifyOwner(order.numberOrder, clean, order.urlCommunication);
    }

    return { confirmed, duplicate: false };
  }

  /**
   * Ответ, который автомат не взял на себя.
   *
   * Владельцу уходит сам текст: чаще всего это вопрос про срок или правка
   * тиража, и ответить на него быстрее прямо из уведомления, чем искать
   * заказ в CRM.
   */
  private async notifyOwner(
    numberOrder: string,
    text: string,
    chatUrl: string | null,
    what = 'Это не простое «да», поэтому счёт автоматом не ушёл — ответьте сами.',
  ): Promise<void> {
    const message = [
      '💬 <b>Клиент ответил на приветствие</b>',
      '',
      `Заказ: <code>${numberOrder}</code>`,
      ...(chatUrl ? [`Чат: ${chatUrl}`] : []),
      '',
      `Ответ: «${text}»`,
      '',
      what,
    ].join('\n');
    try {
      await this.telegram.sendToOwner(message);
    } catch (error) {
      // Уведомление не повод терять отметку об ответе: иначе воркер
      // принесёт тот же текст ещё раз и сообщение задвоится.
      this.logger.warn(
        `Не удалось сообщить об ответе по заказу ${numberOrder}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
