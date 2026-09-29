import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumCommunication } from 'src/generated/prisma/enums';
import { telegramUsernameFromUrl } from './client-greeting';

/**
 * Черновик сообщения клиенту в Telegram.
 *
 * Зачем. Приветствие клиенту уходит само — живым аккаунтом, потому что бот
 * первым написать не может. Дальше менеджер ждёт ответа, а когда клиент
 * откликнулся, копирует из карточки подтверждение заказа, переключается
 * в Telegram, вставляет и отправляет. Три действия ради текста, который
 * система уже собрала.
 *
 * Теперь текст можно положить прямо в поле ввода нужного чата. Именно
 * положить, а не отправить: решение «пора» остаётся за человеком — клиент
 * может ещё не ответить, а сумма в заказе поменяться. Менеджер открывает
 * Telegram, видит готовый текст в строке ввода и нажимает «Отправить»
 * сам.
 *
 * Почему текст приходит из карточки, а не собирается здесь: его собирает
 * фронт (utils/client-message.ts) и показывает менеджеру. Вторая сборка
 * того же текста на сервере разошлась бы с первой при ближайшей правке,
 * и в чат легло бы не то, что человек видел на экране.
 */

/** Потолок сообщения Telegram. Длиннее площадка не примет. */
export const DRAFT_MAX_LENGTH = 4096;

export type DraftStatus = 'saved' | 'not_found' | 'privacy' | 'error';

const DRAFT_STATUSES: readonly string[] = [
  'saved',
  'not_found',
  'privacy',
  'error',
];

export function isDraftStatus(value: string): value is DraftStatus {
  return DRAFT_STATUSES.includes(value);
}

export interface PendingDraft {
  id: string;
  numberOrder: string;
  username: string;
  text: string;
}

@Injectable()
export class ClientDraftService {
  private readonly logger = new Logger(ClientDraftService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Попросить положить текст в чат клиента.
   *
   * Просьба перезаписывает предыдущую: менеджер поправил заказ, нажал ещё
   * раз — в поле ввода должен оказаться новый текст, а не старый.
   */
  async request(orderId: string, text: string): Promise<void> {
    const clean = (text ?? '').trim();
    if (!clean) throw new BadRequestException('Пустой текст.');
    if (clean.length > DRAFT_MAX_LENGTH) {
      throw new BadRequestException(
        `Текст длиннее ${DRAFT_MAX_LENGTH} знаков — Telegram столько не примет.`,
      );
    }

    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: { communicationPlatform: true, urlCommunication: true },
    });
    if (!order) throw new BadRequestException('Заказ не найден.');
    if (order.communicationPlatform !== EnumCommunication.TELEGRAM) {
      throw new BadRequestException(
        'Черновик кладётся только в Telegram: у других каналов поля ввода у нас нет.',
      );
    }
    if (!telegramUsernameFromUrl(order.urlCommunication)) {
      throw new BadRequestException(
        'В заказе нет разборчивого ника Telegram — некуда класть.',
      );
    }

    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        clientDraftRequestedAt: new Date(),
        clientDraftText: clean,
        clientDraftAt: null,
        clientDraftStatus: null,
      },
    });
  }

  /** Очередь для воркера: просили, но ещё не положили. */
  async pending(limit: number): Promise<PendingDraft[]> {
    const rows = await this.prisma.orderPhoto.findMany({
      where: {
        clientDraftRequestedAt: { not: null },
        clientDraftAt: null,
        communicationPlatform: EnumCommunication.TELEGRAM,
      },
      orderBy: { clientDraftRequestedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 20),
      select: {
        id: true,
        numberOrder: true,
        urlCommunication: true,
        clientDraftText: true,
      },
    });

    const ready: PendingDraft[] = [];
    for (const row of rows) {
      const username = telegramUsernameFromUrl(row.urlCommunication);
      const text = (row.clientDraftText ?? '').trim();
      if (!username || !text) {
        // Разбирать нечего — закрываем, иначе строка висит в очереди вечно.
        await this.mark(row.id, 'not_found');
        this.logger.warn(
          `Заказ ${row.numberOrder}: черновик некуда положить (ник или текст пусты)`,
        );
        continue;
      }
      ready.push({
        id: row.id,
        numberOrder: row.numberOrder,
        username,
        text,
      });
    }
    return ready;
  }

  /** Итог попытки. Ставится в любом случае, даже при отказе. */
  async mark(id: string, status: DraftStatus): Promise<void> {
    await this.prisma.orderPhoto.update({
      where: { id },
      data: { clientDraftAt: new Date(), clientDraftStatus: status },
    });
  }
}
