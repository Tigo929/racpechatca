import { Injectable, Logger } from '@nestjs/common';
import { EnumCommunication } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { ClientMessageService } from 'src/client-message/client-message.service';
import {
  telegramUsernameFromUrl,
  type GreetingStatus,
} from './client-greeting';

/**
 * Счёт клиенту, который уходит сам.
 *
 * Клиент ответил «да» — и дальше всё решают минуты: человек готов платить
 * сейчас, а не когда менеджер дойдёт до карточки. Поэтому подтверждение
 * заказа с суммой и реквизитами отправляется автоматически, тем же живым
 * аккаунтом, что здоровался.
 *
 * Текст собирает CRM (client-message) — ровно тот же, что менеджер копирует
 * из карточки кнопкой «Подтверждение». Один текст на оба способа отправки:
 * две сборки одного письма разошлись бы при первой правке, и клиент получал
 * бы разные суммы из разных мест.
 *
 * Неудача ничего не ломает: заказ уже стал «Новым», счёт просто не ушёл,
 * и владелец получает об этом сообщение — отправит руками кнопкой в карточке.
 */

/** Сколько ждать между попытками по заказу, которому Telegram сказал «часто». */
const FLOOD_RETRY_MS = 60 * 60 * 1000;

export interface PendingInvoice {
  id: string;
  numberOrder: string;
  /** Голый никнейм — воркеру нужен он, а не «@name» и не ссылка. */
  username: string;
  /** Готовый текст подтверждения заказа. */
  text: string;
}

@Injectable()
export class ClientInvoiceService {
  private readonly logger = new Logger(ClientInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly message: ClientMessageService,
  ) {}

  /** Кому пора отправить счёт. */
  async pending(limit: number): Promise<PendingInvoice[]> {
    const rows = await this.prisma.orderPhoto.findMany({
      where: {
        clientConfirmedAt: { not: null },
        invoiceSentAt: null,
        communicationPlatform: EnumCommunication.TELEGRAM,
        /*
         * Счёт без суммы — не счёт. У корпоративной заявки на футболки
         * позиции нет вовсе: партию считает менеджер, и до его расчёта
         * «Итого к оплате: 0 ₽» было бы худшим, что можно прислать
         * человеку, который только что согласился.
         */
        totalOrder: { gt: 0 },
        /*
         * Ещё не пробовали — или Telegram попросил подождать. Остальные
         * отказы (нет ника, закрыт приватностью, заблокировал) повторять
         * бессмысленно: там нужен человек, и он уже получил сообщение.
         */
        OR: [
          { invoiceStatus: null },
          {
            invoiceStatus: 'flood',
            updatedAt: { lte: new Date(Date.now() - FLOOD_RETRY_MS) },
          },
        ],
      },
      orderBy: { clientConfirmedAt: 'asc' },
      take: Math.max(1, Math.min(limit, 10)),
      select: { id: true, numberOrder: true, urlCommunication: true },
    });

    const items: PendingInvoice[] = [];
    for (const order of rows) {
      const username = telegramUsernameFromUrl(order.urlCommunication);
      if (!username) {
        // Ника нет — отправлять некуда. Отдаём человеку сразу, а не после
        // попытки: воркеру всё равно нечего было бы сделать.
        await this.mark(order.id, 'not_found');
        continue;
      }
      const text = await this.message.textFor(order.id, 'CONFIRMATION');
      if (!text) continue;
      items.push({
        id: order.id,
        numberOrder: order.numberOrder,
        username,
        text,
      });
    }
    return items;
  }

  /**
   * Итог отправки.
   *
   * Удача закрывает вопрос и сообщает владельцу: счёт у клиента, второй раз
   * отправлять не нужно. Отказ оставляет заказ без счёта и зовёт человека —
   * с причиной, по которой автомат не справился.
   */
  async mark(id: string, status: GreetingStatus): Promise<void> {
    const sent = status === 'sent';
    const order = await this.prisma.orderPhoto.update({
      where: { id },
      data: {
        invoiceStatus: status,
        ...(sent ? { invoiceSentAt: new Date() } : {}),
      },
      select: {
        numberOrder: true,
        totalOrder: true,
        urlCommunication: true,
      },
    });

    if (sent) {
      this.logger.log(
        `Заказ ${order.numberOrder}: счёт отправлен клиенту автоматически`,
      );
      await this.notifyOwner(
        [
          '🧾 <b>Счёт отправлен клиенту</b>',
          '',
          `Заказ: <code>${order.numberOrder}</code>`,
          `Сумма: ${order.totalOrder} ₽`,
          ...(order.urlCommunication ? [`Чат: ${order.urlCommunication}`] : []),
          '',
          'Клиент ответил «да» — заявка переведена в «Новый», подтверждение',
          'с суммой и реквизитами уже у него. Ждём чек.',
        ].join('\n'),
        order.numberOrder,
      );
      return;
    }

    this.logger.warn(
      `Заказ ${order.numberOrder}: счёт не ушёл в Telegram (${status}) — отдаём человеку`,
    );
    await this.notifyOwner(
      [
        '⚠️ <b>Счёт клиенту не ушёл</b>',
        '',
        `Заказ: <code>${order.numberOrder}</code>`,
        `Сумма: ${order.totalOrder} ₽`,
        ...(order.urlCommunication ? [`Чат: ${order.urlCommunication}`] : []),
        '',
        `Причина: ${INVOICE_FAILURE_REASONS[status] ?? status}.`,
        'Клиент согласился, заявка уже «Новая» — отправьте подтверждение',
        'из карточки кнопкой «Подтверждение».',
      ].join('\n'),
      order.numberOrder,
    );
  }

  private async notifyOwner(text: string, numberOrder: string): Promise<void> {
    try {
      await this.telegram.sendToOwner(text);
    } catch (error) {
      // Сообщение владельцу — не то, из-за чего стоит терять отметку:
      // счёт клиенту уже ушёл (или уже не уйдёт), и это главное.
      this.logger.warn(
        `Не удалось сообщить о счёте по заказу ${numberOrder}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

/** Почему счёт не ушёл — словами, которые понятны без документации. */
const INVOICE_FAILURE_REASONS: Record<string, string> = {
  not_found: 'в заказе нет разборчивого ника Telegram',
  privacy: 'аккаунт не принимает сообщения от незнакомых',
  blocked: 'клиент заблокировал отправителя',
  flood: 'Telegram ограничил частоту — попробуем позже сами',
  error: 'Telegram отказал',
};
