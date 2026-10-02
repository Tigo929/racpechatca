import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumProductCategory,
} from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import {
  MARKETPLACE_REVIEW_DELAY_MS,
  REVIEW_REMINDER_CATEGORIES,
  REVIEW_REMINDER_DELAY_MS,
  REVIEW_REMINDER_PICKUP_DELAY_MS,
  REVIEW_REMINDER_STATUSES,
} from './review-reminder-rules';

const REVIEW_REMINDER_SCAN_MS = 60 * 60 * 1000;
/** Пауза между сообщениями ручной пересылки: Telegram даёт ~20/мин в чат. */
const RESEND_DELAY_MS = 3500;
const REVIEW_REMINDER_LIMIT = 20;
const AVITO_REVIEW_URL =
  'https://www.avito.ru/user/review?fid=2_dJdTVNpmTbcI6Hkpz9w4CujowHx4ZBZ87DElF8B0nlyL6RdaaYzvyPSWRjp4ZyNE';

/**
 * Куда зовём клиента с сайта: карточка на Яндекс Картах.
 *
 * На Авито его звать некуда — он там не покупал, и отзыв от человека без
 * сделки площадка не примет. Яндекс Карты видит любой, кто ищет печать
 * фото рядом с собой, и отзыв там работает на тот же поиск, из которого
 * этот клиент и пришёл.
 *
 * Ссылка без координат и масштаба: они привязывают карту к чужому экрану
 * и на телефоне открывают не то.
 */
/**
 * Куда зовём покупателя с Ozon: список его заказов в кабинете.
 *
 * Отдельной страницы «оставить отзыв продавцу» у Ozon нет — отзыв
 * оставляют на товар из своего заказа. Поэтому ведём в список заказов,
 * откуда это делается в два нажатия.
 *
 * ВАЖНО про подарок: площадка запрещает вознаграждать за отзывы, и в
 * тексте для Ozon подарка нет. Обещать бесплатную доставку там нельзя
 * вдвойне — доставку считает сама площадка.
 */
const OZON_REVIEW_URL = 'https://www.ozon.ru/my/orderlist';

const YANDEX_REVIEW_URL =
  'https://yandex.ru/maps/org/raspechatka/169229058790/reviews/';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatRuDateTime(d: Date): string {
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryLabel(category: EnumProductCategory): string {
  if (category === EnumProductCategory.TSHIRT) return 'Футболка';
  if (category === EnumProductCategory.CANVAS) return 'Холст';
  return 'Фото';
}

/** Что человек заказывал — одной строкой, для первой фразы. */
function whatWasOrdered(category: EnumProductCategory): string {
  if (category === EnumProductCategory.TSHIRT) return 'футболку с принтом';
  if (category === EnumProductCategory.CANVAS) return 'печать на холсте';
  return 'печать фотографий';
}

/**
 * Куда звать за отзывом и что обещать — зависит от того, откуда заказ.
 *
 * На Авито зовём только тех, кто там покупал: отзыв от человека без сделки
 * площадка не примет. Клиента с сайта — на Яндекс Карты: его видит любой,
 * кто ищет печать фото рядом с собой, то есть отзыв работает на тот же
 * поиск, из которого клиент и пришёл. Покупателя с Ozon — в его список
 * заказов, отзыв там оставляют на товар.
 *
 * Подарок есть не везде. На Ozon его нет: площадка запрещает
 * вознаграждать за отзывы, и обещание бесплатной доставки там вдвойне
 * бессмысленно — доставку считает сама площадка.
 */
interface ReviewPlace {
  url: string;
  /** Чем заканчивается фраза «оставьте отзыв …». */
  where: string;
  /** Чем благодарим. Пусто — не обещаем ничего. */
  gift: string | null;
}

export function reviewPlace(
  sourceOrder?: string,
  /**
   * Ссылка из самого заказа — та, что владелец указывает как чат
   * с покупателем, заводя отправление в CRM. Для площадки она и есть
   * нужный адрес: общий список заказов ведёт человека «куда-то туда»,
   * а эта ссылка — в его собственный заказ. Пусто — остаётся общий список.
   */
  orderUrl?: string | null,
): ReviewPlace {
  if (sourceOrder === 'WEBSITE') {
    return {
      url: YANDEX_REVIEW_URL,
      where: 'на Яндекс Картах',
      gift: 'бесплатную доставку на следующий заказ 🎁',
    };
  }
  if (sourceOrder === 'OZON' || sourceOrder === 'WB') {
    const url = (orderUrl ?? '').trim();
    return {
      url: url.startsWith('http') ? url : OZON_REVIEW_URL,
      where: 'на Ozon',
      gift: null,
    };
  }
  return {
    url: AVITO_REVIEW_URL,
    where: 'на Авито',
    gift: 'бесплатную доставку на следующий заказ 🎁',
  };
}

/**
 * Просьба об отзыве.
 *
 * Текст один на все площадки, меняются только ссылка и подарок: три разных
 * письма расходились бы при первой же правке, и клиенты получали бы разное
 * в зависимости от того, где купили.
 *
 * Порядок фраз важен. Сначала «это поможет нам и другим покупателям», и
 * только потом подарок: если начать с подарка, отзыв читается как
 * купленный — человек либо не пишет вовсе, либо пишет дежурно. Подарок
 * здесь благодарность, а не условие.
 */
export function buildReviewRequestText(
  productCategory: EnumProductCategory = EnumProductCategory.PHOTO,
  sourceOrder?: string,
  orderUrl?: string | null,
): string {
  const place = reviewPlace(sourceOrder, orderUrl);
  return [
    'Здравствуйте! 😊',
    '',
    `Спасибо, что доверили нам ${whatWasOrdered(productCategory)}. Надеемся, всё получилось так, как хотелось.`,
    '',
    'Можно попросить вас оставить небольшой отзыв о заказе? Это очень поможет нам и позволит другим покупателям легче определиться с выбором.',
    ...(place.gift
      ? ['', `А в благодарность за отзыв мы подарим вам ${place.gift}`]
      : []),
    '',
    `Оставить отзыв можно по ссылке ${place.where}:`,
    place.url,
    '',
    'Заранее большое спасибо за вашу поддержку!',
  ].join('\n');
}
@Injectable()
export class ReviewReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewReminderService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Review reminder scan failed', err);
      });
    }, REVIEW_REMINDER_SCAN_MS);

    this.startupTimer = setTimeout(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Initial review reminder scan failed', err);
      });
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  /**
   * РАЗОВАЯ админская операция: переслать в чат напоминания по ВСЕМ заказам без
   * отметки отзыва — чтобы проверить вид сообщения и работу кнопки. Ничего в
   * заказах не меняет (в том числе reviewReminderNotifiedAt), поэтому обычная
   * ежечасная рассылка продолжает работать по своим правилам.
   *
   * Дублей «сама по себе» операция не создаёт: она запускается только вручную,
   * планировщик её не вызывает.
   *
   * Telegram не принимает больше ~20 сообщений в минуту в один чат, поэтому
   * шлём с паузой и в фоне: HTTP-ответ отдаём сразу, прогресс — в логах.
   */
  async resendAllWithoutReview(
    opts: {
      limit?: number;
      dryRun?: boolean;
    } = {},
  ): Promise<{ total: number; dryRun: boolean }> {
    const orders = await this.prisma.orderPhoto.findMany({
      where: { clientReviewLeft: false },
      orderBy: { createdAt: 'desc' },
      ...(opts.limit ? { take: opts.limit } : {}),
      select: {
        id: true,
        numberOrder: true,
        productCategory: true,
        sourceOrder: true,
        sentAt: true,
        communicationPlatform: true,
        urlCommunication: true,
      },
    });

    if (opts.dryRun) {
      return { total: orders.length, dryRun: true };
    }

    void (async () => {
      let sent = 0;
      for (const order of orders) {
        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '✅ Отправил — отметить отзыв',
                callback_data: `review:${order.id}:sent`,
              },
            ],
          ],
        };
        const ok = await this.telegram.sendReviewReminder(
          this.buildGroupNotification(order),
          replyMarkup,
        );
        if (ok) sent += 1;
        // Пауза между сообщениями — иначе Telegram начнёт отвечать 429.
        await new Promise((r) => setTimeout(r, RESEND_DELAY_MS));
      }
      this.logger.log(
        `Ручная пересылка напоминаний: отправлено ${sent} из ${orders.length}`,
      );
    })().catch((err: unknown) => {
      this.logger.error('Ручная пересылка напоминаний упала', err);
    });

    return { total: orders.length, dryRun: false };
  }

  async scanAndNotify() {
    if (this.running) return;
    this.running = true;
    try {
      // Самовывоз — напоминание на следующий день; доставка — через 3,5 дня.
      const cutoff = new Date(Date.now() - REVIEW_REMINDER_DELAY_MS);
      const pickupCutoff = new Date(
        Date.now() - REVIEW_REMINDER_PICKUP_DELAY_MS,
      );
      const marketplaceCutoff = new Date(
        Date.now() - MARKETPLACE_REVIEW_DELAY_MS,
      );
      const orders = await this.prisma.orderPhoto.findMany({
        where: {
          productCategory: { in: REVIEW_REMINDER_CATEGORIES },
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          OR: [
            // Свои заказы: отсчёт от отправки клиенту.
            {
              NOT: { productCategory: 'TSHIRT', isMarketplacePrint: true },
              status: { in: REVIEW_REMINDER_STATUSES },
              deliveryMethod: EnumDeliveryMethod.PICKUP,
              sentAt: { lte: pickupCutoff },
            },
            {
              NOT: { productCategory: 'TSHIRT', isMarketplacePrint: true },
              status: { in: REVIEW_REMINDER_STATUSES },
              deliveryMethod: { not: EnumDeliveryMethod.PICKUP },
              sentAt: { lte: cutoff },
            },
            /*
             * Заказ с площадки: пять дней от «Отгружен».
             *
             * Отдельная ветка, потому что у него SENT означает «передан
             * в производство». По общему правилу просьба уходила бы через
             * 3,5 дня после передачи в печать — человеку, который ещё
             * ничего не получил.
             */
            {
              productCategory: 'TSHIRT',
              isMarketplacePrint: true,
              status: 'COMPLETED',
              completedAt: { lte: marketplaceCutoff },
            },
          ],
        },
        orderBy: { sentAt: 'asc' },
        take: REVIEW_REMINDER_LIMIT,
        select: {
          id: true,
          numberOrder: true,
          productCategory: true,
          sourceOrder: true,
          sentAt: true,
          completedAt: true,
          isMarketplacePrint: true,
          communicationPlatform: true,
          urlCommunication: true,
        },
      });

      for (const order of orders) {
        // Кнопка: оператор нажимает после отправки запроса отзыва клиенту —
        // вебхук (telegram-webhook.controller) ставит отметку в CRM.
        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '✅ Отправил — отметить отзыв',
                callback_data: `review:${order.id}:sent`,
              },
            ],
          ],
        };
        const ok = await this.telegram.sendReviewReminder(
          this.buildGroupNotification(order),
          replyMarkup,
        );
        if (!ok) continue;

        await this.prisma.orderPhoto.update({
          where: { id: order.id },
          data: { reviewReminderNotifiedAt: new Date() },
        });
      }

      if (orders.length > 0) {
        this.logger.log(
          `Review reminder notifications processed: ${orders.length}`,
        );
      }
    } finally {
      this.running = false;
    }
  }

  private buildGroupNotification(order: {
    numberOrder: string;
    productCategory: EnumProductCategory;
    // Источник решает, куда звать за отзывом: сайт — на Яндекс Карты,
    // остальные — на Авито.
    sourceOrder: string;
    sentAt: Date | null;
    communicationPlatform: EnumCommunication;
    urlCommunication: string;
  }): string {
    const platform =
      order.communicationPlatform === EnumCommunication.AVITO
        ? 'Авито'
        : order.communicationPlatform;
    const sentAt = order.sentAt ? formatRuDateTime(order.sentAt) : 'не указано';
    const dialogUrl = escapeHtml(order.urlCommunication);
    const customerText = escapeHtml(
      buildReviewRequestText(
        order.productCategory,
        order.sourceOrder,
        order.urlCommunication,
      ),
    );

    return [
      '⭐ <b>Пора попросить отзыв</b>',
      '',
      `Заказ: <code>${escapeHtml(order.numberOrder)}</code>`,
      `Категория: <b>${escapeHtml(categoryLabel(order.productCategory))}</b>`,
      `Отправлен: ${escapeHtml(sentAt)}`,
      `Канал: ${escapeHtml(platform)}`,
      `Диалог: <a href="${dialogUrl}">открыть переписку</a>`,
      '',
      '<b>Сообщение клиенту для отправки:</b>',
      `<pre>${customerText}</pre>`,
    ].join('\n');
  }
}
