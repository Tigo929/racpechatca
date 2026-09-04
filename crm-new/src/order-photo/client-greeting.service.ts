import { Injectable, Logger } from '@nestjs/common';
import { EnumCommunication } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  clientNameFromNote,
  telegramUsernameFromUrl,
  type GreetingStatus,
} from './client-greeting';

/**
 * Очередь первых сообщений клиентам с сайта.
 *
 * Зачем отдельный механизм. Бот Telegram написать первым не может: площадка
 * разрешает ему отвечать только тем, кто сам начал диалог. У заявки с сайта
 * такого диалога нет — есть только никнейм, введённый руками. Поэтому первое
 * сообщение отправляет воркер от лица рабочего аккаунта, а CRM отдаёт ему
 * очередь и запоминает итог.
 *
 * CRM сама ничего не отправляет намеренно: здесь нет и не должно быть
 * доступа к личному аккаунту.
 */

/**
 * Насколько старую заявку ещё уместно приветствовать.
 *
 * Воркер может простоять сутки — упал контейнер, перевыпускали сессию.
 * Написать «здравствуйте, вы оставляли заявку» через неделю хуже, чем
 * не написать вовсе: человек уже либо заказал, либо забыл.
 */
const MAX_AGE_HOURS = 12;

/** Заявки сайта помечены этим префиксом в externalRequestId. */
const SITE_LEAD_PREFIX = 'web-photo';

export interface PendingGreeting {
  id: string;
  numberOrder: string;
  username: string;
  name: string | null;
  /** Направление заказа: под него выбирается текст сообщения. */
  category: string;
  /** Все позиции заказа — их человек и должен узнать в сообщении. */
  items: { title: string; quantity: number }[];
  /** Стоимость доставки, ₽. Ноль — самовывоз. */
  deliveryCost: number;
  /** Способ получения: под него подбирается строка в сообщении. */
  deliveryMethod: string;
  /** Итог заказа вместе с доставкой, ₽ — ровно то, что заплатит клиент. */
  total: number;
  createdAt: Date;
}

@Injectable()
export class ClientGreetingService {
  private readonly logger = new Logger(ClientGreetingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Кому ещё не писали.
   *
   * Отбор нарочно узкий: только заявки с сайта (у заказов с Авито переписка
   * уже идёт на площадке), только телеграм, только свежие и только те, где
   * никнейм разобрался. Заказ с нечитаемым никнеймом сразу помечается
   * `not_found`, иначе он вечно висел бы в очереди и его пытались бы
   * разобрать при каждом опросе.
   */
  async pending(limit: number): Promise<PendingGreeting[]> {
    const since = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

    const rows = await this.prisma.orderPhoto.findMany({
      where: {
        clientGreetedAt: null,
        communicationPlatform: EnumCommunication.TELEGRAM,
        externalRequestId: { startsWith: SITE_LEAD_PREFIX },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        numberOrder: true,
        urlCommunication: true,
        note: true,
        createdAt: true,
        productCategory: true,
        totalOrder: true,
        deliveryCost: true,
        deliveryMethod: true,
        // Позиция нужна ради названия товара и тиража: письмо «ваш заказ
        // 10 фото в стиле Polaroid» человек читает как ответ на своё
        // действие, а «вы оставили заявку» — как рассылку.
        // Все позиции, а не первая: в заказе может быть несколько форматов,
        // и человек должен узнать в сообщении именно то, что заказывал.
        items: { select: { formatPaper: true, quantity: true } },
        tshirtItems: { select: { color: true, size: true, quantity: true } },
        canvasItems: { select: { formatCanvas: true, quantity: true } },
      },
    });

    const ready: PendingGreeting[] = [];
    for (const row of rows) {
      const username = telegramUsernameFromUrl(row.urlCommunication);
      if (!username) {
        // Разобрать нечего — закрываем сразу, а не отдаём воркеру.
        await this.mark(row.id, 'not_found');
        this.logger.warn(
          `Заказ ${row.numberOrder}: никнейм не разобрался из «${row.urlCommunication}»`,
        );
        continue;
      }
      const items = [
        ...row.items.map((i) => ({
          title: i.formatPaper.trim(),
          quantity: i.quantity,
        })),
        ...row.canvasItems.map((i) => ({
          title: i.formatCanvas.trim(),
          quantity: i.quantity,
        })),
        ...row.tshirtItems.map((i) => ({
          title: `Футболка ${i.color}, размер ${i.size}`,
          quantity: i.quantity,
        })),
      ].filter((i) => i.title);

      ready.push({
        id: row.id,
        numberOrder: row.numberOrder,
        username,
        name: clientNameFromNote(row.note),
        category: row.productCategory,
        items,
        deliveryCost: row.deliveryCost ?? 0,
        deliveryMethod: row.deliveryMethod,
        total: row.totalOrder ?? 0,
        createdAt: row.createdAt,
      });
    }
    return ready;
  }

  /**
   * Итог попытки.
   *
   * Отметка ставится в любом случае, даже при отказе: заказ, которому нельзя
   * написать, должен уйти из очереди, а не собирать попытки до бесконечности.
   * Разница между «написали» и «не смогли» видна в `clientGreetStatus`.
   */
  async mark(id: string, status: GreetingStatus): Promise<void> {
    await this.prisma.orderPhoto.update({
      where: { id },
      data: { clientGreetedAt: new Date(), clientGreetStatus: status },
    });
  }
}
