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
 * Просьба об отзыве для клиента с сайта.
 *
 * Отдельный текст, а не правка общего: у клиента с сайта другая площадка
 * (Яндекс Карты вместо Авито) и другой подарок.
 *
 * Порядок фраз важен. Сначала «нам поможет ваше мнение», и только потом
 * подарок: если начать с подарка, отзыв читается как купленный — человек
 * либо не пишет вовсе, либо пишет дежурно. Подарок здесь благодарность,
 * а не условие.
 */
export function buildSiteReviewRequestText(
  productCategory: EnumProductCategory = EnumProductCategory.PHOTO,
): string {
  return [
    'Здравствуйте! 😊',
    '',
    `Спасибо, что доверили нам ${whatWasOrdered(productCategory)}. Надеемся, всё получилось так, как хотелось.`,
    '',
    'Нам очень поможет ваше мнение. Если найдётся пара минут, оставьте, пожалуйста, отзыв на Яндекс Картах: по отзывам нас находят новые люди, а мы понимаем, что сделали хорошо.',
    '',
    `⭐ Оставить отзыв: ${YANDEX_REVIEW_URL}`,
    '',
    'Пяти звёзд и пары слов о том, что понравилось, будет достаточно — это правда занимает минуту.',
    '',
    'А в благодарность за отзыв к следующему заказу подарим на выбор:',
    '🚚 бесплатную доставку',
    '📸 10–15 фотографий в стиле Polaroid',
    '',
    'Спасибо, что выбрали нас! Будем рады помочь снова 🙌',
  ].join('\n');
}

export function buildReviewRequestText(
  productCategory: EnumProductCategory = EnumProductCategory.PHOTO,
  sourceOrder?: string,
): string {
  // Заявка с сайта — своя площадка и свой подарок.
  if (sourceOrder === 'WEBSITE') {
    return buildSiteReviewRequestText(productCategory);
  }

  if (productCategory === EnumProductCategory.TSHIRT) {
    return [
      'Добрый день! 😊',
      '',
      'Спасибо, что выбрали нас для печати футболки. Надеемся, вещь получилась именно такой, как хотелось, и уже радует вас!',
      '',
      'Если всё понравилось и у вас найдётся буквально 1–2 минуты, оставьте, пожалуйста, отзыв на Авито. Для нас это очень помогает: по отзывам нас находят новые клиенты, а мы понимаем, что всё сделали хорошо.',
      '',
      `Оставить отзыв можно здесь: ${AVITO_REVIEW_URL}`,
      '',
      'В благодарность за отзыв при следующем заказе мы подарим:',
      '🎨 любой макет/дизайн — бесплатно',
      '🚚 доставку следующего заказа — бесплатно',
      '',
      'Спасибо, что выбираете нас! Будем рады снова помочь с печатью 🙌',
    ].join('\n');
  }

  if (productCategory === EnumProductCategory.CANVAS) {
    return [
      'Добрый день! 😊',
      '',
      'Спасибо, что выбрали нас для печати на холсте. Надеемся, работа получилась тёплой, яркой и уже нашла своё место!',
      '',
      'Если всё понравилось и у вас найдётся буквально 1–2 минуты, оставьте, пожалуйста, отзыв на Авито. Для нас это очень помогает: по отзывам нас находят новые клиенты, а мы понимаем, что всё сделали хорошо.',
      '',
      `Оставить отзыв можно здесь: ${AVITO_REVIEW_URL}`,
      '',
      'В благодарность за отзыв при следующем заказе мы подарим:',
      '🎨 подготовку макета — бесплатно',
      '🚚 доставку следующего заказа — бесплатно',
      '',
      'Спасибо, что выбираете нас! Будем рады снова помочь с печатью 🙌',
    ].join('\n');
  }

  return [
    'Добрый день! 😊',
    '',
    'Спасибо, что выбрали нас для печати фотографий. Надеемся, результат уже радует вас!',
    '',
    'Если всё понравилось и у вас найдётся буквально 1–2 минуты, оставьте, пожалуйста, отзыв на Авито. Для нас это очень помогает: по отзывам нас находят новые клиенты, а мы понимаем, что всё сделали хорошо.',
    '',
    `Оставить отзыв можно здесь: ${AVITO_REVIEW_URL}`,
    '',
    'В благодарность за отзыв мы подготовили подарок к следующему заказу:',
    '✨ 20 фотографий в стиле Polaroid — бесплатно',
    '🚚 доставка следующего заказа — бесплатно',
    '',
    'Спасибо, что выбираете нас! Будем рады снова помочь с печатью 🙌',
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
      const orders = await this.prisma.orderPhoto.findMany({
        where: {
          productCategory: { in: REVIEW_REMINDER_CATEGORIES },
          status: { in: REVIEW_REMINDER_STATUSES },
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          OR: [
            {
              deliveryMethod: EnumDeliveryMethod.PICKUP,
              sentAt: { lte: pickupCutoff },
            },
            {
              deliveryMethod: { not: EnumDeliveryMethod.PICKUP },
              sentAt: { lte: cutoff },
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
      buildReviewRequestText(order.productCategory, order.sourceOrder),
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
