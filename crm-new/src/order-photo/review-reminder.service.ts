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
const REVIEW_REMINDER_LIMIT = 20;
const AVITO_REVIEW_URL =
  'https://www.avito.ru/user/review?fid=2_dJdTVNpmTbcI6Hkpz9w4CujowHx4ZBZ87DElF8B0nlyL6RdaaYzvyPSWRjp4ZyNE';

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
  return category === EnumProductCategory.TSHIRT ? 'Футболка' : 'Фото';
}

export function buildReviewRequestText(
  productCategory: EnumProductCategory = EnumProductCategory.PHOTO,
): string {
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

  async scanAndNotify() {
    if (this.running) return;
    this.running = true;
    try {
      // Самовывоз — напоминание на следующий день; доставка — через 3,5 дня.
      const cutoff = new Date(Date.now() - REVIEW_REMINDER_DELAY_MS);
      const pickupCutoff = new Date(Date.now() - REVIEW_REMINDER_PICKUP_DELAY_MS);
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
          sentAt: true,
          communicationPlatform: true,
          urlCommunication: true,
        },
      });

      for (const order of orders) {
        const ok = await this.telegram.sendToGroup(
          this.buildGroupNotification(order),
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
      buildReviewRequestText(order.productCategory),
    );

    return [
      '⭐ <b>Пора попросить отзыв</b>',
      '',
      `Заказ: <b>${escapeHtml(order.numberOrder)}</b>`,
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
