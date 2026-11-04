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
  waitsForAutoReview,
} from './review-reminder-rules';
import { customerChat } from './customer-chat-url';
import { telegramUsernameFromUrl } from './client-greeting';

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

/**
 * Почему просьба не ушла клиенту сама — словами для человека.
 *
 * Коды воркера («privacy», «not_found») владельцу ничего не говорят, а
 * знать нужно одно: писать придётся руками и почему. Удачной отправки
 * в этом списке нет — о ней напоминание вообще не приходит.
 */
const AUTO_FAILURE_REASONS: Record<string, string | undefined> = {
  not_found: 'такого ника в Telegram нет — проверьте запись в заказе',
  privacy: 'клиент не принимает сообщения от незнакомых',
  blocked: 'клиент заблокировал наш аккаунт',
  flood: 'Telegram ограничил частоту — пробуем ещё, но можно и руками',
  error: 'Telegram отказал',
};

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

/**
 * О чём спрашиваем: «как вам футболка?».
 *
 * Названная вещь — разница между письмом и рассылкой. «Как вам ваш заказ»
 * человек читает как шаблон, «как вам футболка» — как вопрос о том, что он
 * держит в руках.
 *
 * Называет вещь только этот вопрос. Раньше её называла и первая фраза
 * («доверили нам футболку с принтом»), и получалось «футболку… как вам
 * футболка» в двух строках подряд.
 */
function howIsIt(category: EnumProductCategory): string {
  if (category === EnumProductCategory.TSHIRT) return 'футболка';
  if (category === EnumProductCategory.CANVAS) return 'холст';
  return 'фотографии';
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
 * Подарок обещаем везде (решение владельца 03.11.2026), но разный и
 * нарочно не за отзыв. У своих клиентов доставку считаем мы — её и дарим.
 * На площадке её считает сама площадка, дарить нечего, поэтому там подарок
 * к следующему заказу.
 *
 * Формулировка важнее самого подарка. Ozon запрещает вознаграждать ЗА ОТЗЫВ,
 * поэтому подарок обещан за следующий заказ и стоит отдельной фразой после
 * просьбы, а не условием при ней. «Оставьте отзыв и получите» нельзя писать
 * ни на одной площадке — это и есть покупка отзыва.
 */
interface ReviewPlace {
  url: string;
  /** Чем заканчивается фраза «оставьте отзыв …». */
  where: string;
  /** Готовая благодарность последней фразой. Пусто — не обещаем ничего. */
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
      gift: 'А на следующий заказ подарим вам бесплатную доставку 🎁',
    };
  }
  if (sourceOrder === 'OZON' || sourceOrder === 'WB') {
    const url = (orderUrl ?? '').trim();
    return {
      url: url.startsWith('http') ? url : OZON_REVIEW_URL,
      where: 'на Ozon',
      gift: 'А к следующему заказу приготовим для вас подарок 🎁',
    };
  }
  return {
    url: AVITO_REVIEW_URL,
    where: 'на Авито',
    gift: 'А на следующий заказ подарим вам бесплатную доставку 🎁',
  };
}

/**
 * Просьба об отзыве.
 *
 * Текст один на все площадки, меняются только ссылка и подарок: три разных
 * письма расходились бы при первой же правке, и клиенты получали бы разное
 * в зависимости от того, где купили.
 *
 * Начинается вопросом, а не просьбой. «Как вам футболка, всё понравилось?» —
 * вопрос, на который человек отвечает; «оставьте отзыв» первой строкой —
 * просьба, которую пролистывают. Следом приглашение написать, если что-то не
 * так: недовольный покупатель напишет всё равно — лучше нам, пока это можно
 * исправить, чем сразу в отзыв.
 *
 * Порядок фраз важен. Сначала «это поможет нам и другим покупателям», и
 * только потом подарок: если начать с подарка, отзыв читается как
 * купленный — человек либо не пишет вовсе, либо пишет дежурно. Подарок
 * здесь благодарность за следующий заказ, а не плата за отзыв.
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
    `Спасибо за заказ! Как вам ${howIsIt(productCategory)} — всё понравилось?`,
    '',
    'Если что-то не так, напишите нам, пожалуйста: разберёмся и исправим.',
    '',
    'А если всё хорошо — можно попросить вас оставить небольшой отзыв? Отзывы помогают нам становиться лучше и позволяют другим покупателям легче определиться с выбором.',
    '',
    `Оставить отзыв можно по ссылке ${place.where}:`,
    place.url,
    ...(place.gift ? ['', place.gift] : []),
    '',
    'Спасибо, что выбрали нас!',
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
        marketplaceDeliveredAt: true,
        marketplacePostingNumber: true,
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
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          // Клиенту уже написали (сами или руками) — звать человека не о чем.
          reviewRequestSentAt: null,
          OR: [
            // Свои заказы: отсчёт от отправки клиенту.
            {
              isMarketplacePrint: false,
              status: { in: REVIEW_REMINDER_STATUSES },
              deliveryMethod: EnumDeliveryMethod.PICKUP,
              sentAt: { lte: pickupCutoff },
            },
            {
              isMarketplacePrint: false,
              status: { in: REVIEW_REMINDER_STATUSES },
              deliveryMethod: { not: EnumDeliveryMethod.PICKUP },
              sentAt: { lte: cutoff },
            },
            /*
             * Заказ с площадки: как только она сказала «Доставлен».
             *
             * Отдельная ветка, потому что у него SENT означает «передан
             * в производство». По общему правилу просьба уходила бы через
             * 3,5 дня после передачи в печать — человеку, который ещё
             * ничего не получил.
             *
             * Срока ожидания здесь нет намеренно: ждать уже нечего, товар
             * у человека в руках. Дату выкупа ставит сверка с Ozon, и она
             * же ограничивает поток — отметка появляется раз.
             */
            { isMarketplacePrint: true, marketplaceDeliveredAt: { not: null } },
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
          marketplaceDeliveredAt: true,
          marketplacePostingNumber: true,
          isMarketplacePrint: true,
          communicationPlatform: true,
          urlCommunication: true,
          clientTelegram: true,
          reviewRequestStatus: true,
        },
      });

      for (const order of orders) {
        /*
         * Просьба уйдёт клиенту сама — владельца пока не трогаем.
         *
         * Иначе он получит напоминание, отправит текст руками, а через
         * минуту то же сообщение отправит автоматика: клиент прочитает
         * просьбу об отзыве дважды. Если автоматика не справилась или
         * молчит дольше выдержки, заказ попадёт сюда следующим проходом
         * вместе с причиной.
         */
        if (waitsForAutoReview(order)) continue;
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

  /**
   * Сообщение владельцу: что случилось, с кем говорить и что сказать.
   *
   * Отправляет просьбу человек, а не CRM. Писать покупателю из фона мы не
   * можем и не должны: в Telegram первым пишет только живой аккаунт, а на
   * площадке переписка модерируется, и автоматическая рассылка там — путь
   * к блокировке. Поэтому владелец получает готовое: ссылку на диалог и
   * текст одним куском, который копируется нажатием.
   */
  private buildGroupNotification(order: {
    numberOrder: string;
    productCategory: EnumProductCategory;
    // Источник решает, куда звать за отзывом: сайт — на Яндекс Карты,
    // площадка — к себе, остальные — на Авито.
    sourceOrder: string;
    sentAt: Date | null;
    marketplaceDeliveredAt?: Date | null;
    marketplacePostingNumber?: string | null;
    communicationPlatform: EnumCommunication;
    urlCommunication: string;
    /** Telegram покупателя, если он нам писал: второй канал рядом с площадкой. */
    clientTelegram?: string | null;
    /** Почему просьба не ушла клиенту сама. Пусто — не пробовали. */
    reviewRequestStatus?: string | null;
  }): string {
    const platform =
      order.communicationPlatform === EnumCommunication.AVITO
        ? 'Авито'
        : order.communicationPlatform;
    const chat = customerChat(order);
    const customerText = escapeHtml(
      buildReviewRequestText(
        order.productCategory,
        order.sourceOrder,
        order.urlCommunication,
      ),
    );

    /*
     * Главная строка — дата события, по которому пришла просьба.
     *
     * У заказа с площадки это выкуп: покупатель забрал посылку, и именно
     * поэтому мы спрашиваем «как вам футболка». У своего — наша отправка.
     * Путать их нельзя: по дате владелец понимает, насколько свежо
     * впечатление и о чём вообще речь.
     */
    const when = order.marketplaceDeliveredAt
      ? `Выкуплен: ${formatRuDateTime(order.marketplaceDeliveredAt)}`
      : `Отправлен: ${order.sentAt ? formatRuDateTime(order.sentAt) : 'не указано'}`;

    /*
     * Ссылка на диалог — либо настоящая, либо её нет.
     *
     * У заказа с Ozon в поле связи лежит то ссылка на чат, то просто номер
     * отправления. Раньше номер подставлялся адресом в <a href>: Telegram
     * рисовал ссылку, нажатие не вело никуда. Теперь либо ссылка, либо
     * подсказка, что искать в кабинете.
     */
    const dialog = chat.href
      ? `<a href="${escapeHtml(chat.href)}">открыть переписку</a>${
          chat.hint ? ` — ${escapeHtml(chat.hint)}` : ''
        }`
      : `не записана${chat.hint ? ` (в заказе: ${escapeHtml(chat.hint)})` : ''}`;

    const username = telegramUsernameFromUrl(order.clientTelegram ?? null);
    const telegramLink = username
      ? { href: `https://t.me/${username}`, label: `@${escapeHtml(username)}` }
      : null;
    const autoFailure = AUTO_FAILURE_REASONS[order.reviewRequestStatus ?? ''];

    return [
      '⭐ <b>Пора попросить отзыв</b>',
      '',
      `Заказ: <code>${escapeHtml(order.numberOrder)}</code>`,
      `Категория: <b>${escapeHtml(categoryLabel(order.productCategory))}</b>`,
      escapeHtml(when),
      `Канал: ${escapeHtml(platform)}`,
      ...(order.marketplacePostingNumber
        ? [`Отправление: <code>${escapeHtml(order.marketplacePostingNumber)}</code>`]
        : []),
      `Диалог: ${dialog}`,
      /*
       * Telegram покупателя — отдельной строкой со ссылкой.
       *
       * У заказа с площадки это второй канал: чат кабинета остаётся, но
       * писать удобнее здесь, и именно сюда уходит автоматическая просьба.
       */
      ...(telegramLink
        ? [`Telegram клиента: <a href="${telegramLink.href}">${telegramLink.label}</a>`]
        : []),
      // Автоматика пробовала и не смогла — говорим, почему: иначе
      // непонятно, отчего понадобился человек.
      ...(autoFailure ? [`⚠️ Сама не ушла: ${escapeHtml(autoFailure)}`] : []),
      '',
      '<b>Сообщение клиенту для отправки:</b>',
      `<pre>${customerText}</pre>`,
    ].join('\n');
  }
}
