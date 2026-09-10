import { Injectable, Logger } from '@nestjs/common';
import { EnumCommunication } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  clientNameFromNote,
  clientPhoneFromNote,
  telegramUsernameFromUrl,
  type GreetingStatus,
} from './client-greeting';
import { renderGreeting } from './greeting-message';

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
  /** Никнейм в Telegram, если клиент его оставил. */
  username: string | null;
  /**
   * Телефон в международном виде — для тех, кто мессенджер не оставил.
   *
   * Telegram умеет находить человека по номеру, и для клиента с одним лишь
   * телефоном это единственный способ получить ответ сразу, а не через
   * полчаса, когда до него дойдёт менеджер. Работает не всегда: номер может
   * быть не зарегистрирован, а настройки приватности — запрещать поиск.
   * Тогда воркер честно вернёт `not_found`.
   */
  phone: string | null;
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
  /**
   * Готовый текст сообщения.
   *
   * Собирает его CRM, а не воркер: тот же текст нужен менеджеру в панели,
   * когда клиент оставил не телеграм и написать автоматически нельзя. Две
   * сборки одного текста разошлись бы при первой правке.
   */
  text: string;
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
      /*
        Площадку больше не фильтруем.

        Раньше брали только заявки с телеграмом: писать было некуда, если
        клиент оставил один телефон. Теперь пишем и по номеру — значит, в
        очередь входит всё, где есть хоть один способ достучаться, а
        отсеиваем ниже, разобрав контакты.
      */
      where: {
        clientGreetedAt: null,
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
      const phone = clientPhoneFromNote(row.note);
      if (!username && !phone) {
        // Ни никнейма, ни номера — писать физически некуда. Закрываем сразу,
        // иначе заказ висел бы в очереди вечно и разбирался при каждом опросе.
        await this.mark(row.id, 'not_found');
        this.logger.warn(
          `Заказ ${row.numberOrder}: ни никнейма, ни телефона — писать некуда`,
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

      const data = {
        name: clientNameFromNote(row.note),
        numberOrder: row.numberOrder,
        category: row.productCategory,
        items,
        deliveryCost: row.deliveryCost ?? 0,
        deliveryMethod: row.deliveryMethod,
        total: row.totalOrder ?? 0,
      };

      ready.push({
        id: row.id,
        username,
        phone,
        createdAt: row.createdAt,
        text: renderGreeting(data),
        ...data,
      });
    }
    return ready;
  }

  /**
   * Текст сообщения для конкретного заказа — для панели.
   *
   * Автоматически пишем только в телеграм: MAX, почта и голый телефон
   * так не открываются. Раньше менеджер сочинял такому клиенту сообщение
   * сам, и оно отличалось от того, что получают остальные. Здесь он
   * копирует ровно тот же текст, который отправил бы воркер.
   */
  async textFor(id: string): Promise<string | null> {
    const row = await this.prisma.orderPhoto.findUnique({
      where: { id },
      select: {
        numberOrder: true,
        note: true,
        productCategory: true,
        totalOrder: true,
        deliveryCost: true,
        deliveryMethod: true,
        items: { select: { formatPaper: true, quantity: true } },
        tshirtItems: { select: { color: true, size: true, quantity: true } },
        canvasItems: { select: { formatCanvas: true, quantity: true } },
      },
    });
    if (!row) return null;

    const items = [
      ...row.items.map((i) => ({ title: i.formatPaper.trim(), quantity: i.quantity })),
      ...row.canvasItems.map((i) => ({
        title: i.formatCanvas.trim(),
        quantity: i.quantity,
      })),
      ...row.tshirtItems.map((i) => ({
        title: `Футболка ${i.color}, размер ${i.size}`,
        quantity: i.quantity,
      })),
    ].filter((i) => i.title);

    return renderGreeting({
      name: clientNameFromNote(row.note),
      numberOrder: row.numberOrder,
      category: row.productCategory,
      items,
      deliveryCost: row.deliveryCost ?? 0,
      deliveryMethod: row.deliveryMethod,
      total: row.totalOrder ?? 0,
    });
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
