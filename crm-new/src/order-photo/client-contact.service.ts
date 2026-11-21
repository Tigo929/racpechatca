import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  canSendPromo,
  contactStats,
  extractContact,
  type ContactSourceOrder,
} from './client-contact';

/**
 * Контакты клиентов: сбор из заказов, список, согласие на рассылку.
 *
 * Сбор устроен так, чтобы контакт не терялся ни при каком раскладе:
 *  • при удалении заказа контакт пишется в той же транзакции, до удаления
 *    (см. OrderArchiveService.capture);
 *  • каждые 15 минут подхватываются заказы, изменённые за последний час;
 *  • при старте и раз в сутки — полный проход по заказам и корзине.
 * Всё идемпотентно: заказ привязан к контакту по своему id.
 */

type Db = Prisma.TransactionClient | PrismaService;

export interface ContactOrderSource extends ContactSourceOrder {
  id: string;
  numberOrder: string;
  status: string;
  sourceOrder: string;
  productCategory: string;
  totalOrder?: number | null;
  createdAt: Date | string;
}

export const CONTACT_ORDER_SELECT = {
  id: true,
  numberOrder: true,
  status: true,
  sourceOrder: true,
  productCategory: true,
  totalOrder: true,
  createdAt: true,
  communicationPlatform: true,
  urlCommunication: true,
  clientTelegram: true,
  note: true,
} as const;

/**
 * Записать (или освежить) контакт по заказу. Отдельной функцией, а не
 * методом: её зовёт корзина изнутри своей транзакции.
 */
export async function saveClientContact(
  db: Db,
  order: ContactOrderSource,
  opts: { deleted?: boolean } = {},
): Promise<string | null> {
  const found = extractContact(order);
  if (!found) return null;
  const orderAt = new Date(order.createdAt);

  const existing = await db.clientContact.findUnique({
    where: { identityKey: found.identityKey },
  });
  const newer = !existing?.lastOrderAt || orderAt >= existing.lastOrderAt;
  // Пустое не затирает известное: в одной заявке телефон есть, в другой нет.
  const pick = <T>(value: T | null, old: T | null | undefined): T | null =>
    value ?? old ?? null;

  const data = {
    name: newer
      ? pick(found.name, existing?.name)
      : pick(existing?.name ?? null, found.name),
    phone: pick(found.phone, existing?.phone),
    telegram: pick(found.telegram, existing?.telegram),
    maxContact: pick(found.maxContact, existing?.maxContact),
    email: pick(found.email, existing?.email),
    contactUrl: newer
      ? pick(found.contactUrl, existing?.contactUrl)
      : pick(existing?.contactUrl ?? null, found.contactUrl),
    channel: newer
      ? pick(found.channel, existing?.channel)
      : (existing?.channel ?? null),
    lastSource: newer ? order.sourceOrder : (existing?.lastSource ?? null),
    firstOrderAt:
      existing?.firstOrderAt && existing.firstOrderAt < orderAt
        ? existing.firstOrderAt
        : orderAt,
    lastOrderAt: newer ? orderAt : (existing?.lastOrderAt ?? orderAt),
  };

  const contact = await db.clientContact.upsert({
    where: { identityKey: found.identityKey },
    create: { identityKey: found.identityKey, ...data },
    update: data,
    select: { id: true },
  });

  const row = {
    contactId: contact.id,
    numberOrder: order.numberOrder,
    status: order.status,
    sourceOrder: order.sourceOrder,
    productCategory: order.productCategory,
    totalOrder: order.totalOrder ?? 0,
    orderCreatedAt: orderAt,
    deleted: opts.deleted ?? false,
  };
  await db.clientContactOrder.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, ...row },
    update: row,
  });
  return contact.id;
}

const RECENT_INTERVAL_MS = 15 * 60 * 1000;
const RECENT_WINDOW_MS = 60 * 60 * 1000;
const FULL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 90_000;
const BATCH = 200;

export interface ContactListQuery {
  search?: string;
  /** Только те, кому можно слать акции. */
  promoOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface ContactPatch {
  marketingConsent?: boolean;
  marketingConsentSource?: string | null;
  unsubscribed?: boolean;
  ownerNote?: string | null;
  name?: string | null;
}

@Injectable()
export class ClientContactService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientContactService.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timers.push(
      setTimeout(() => void this.guard(() => this.syncAll()), STARTUP_DELAY_MS),
      setInterval(
        () =>
          void this.guard(() =>
            this.syncSince(new Date(Date.now() - RECENT_WINDOW_MS)),
          ),
        RECENT_INTERVAL_MS,
      ),
      setInterval(
        () => void this.guard(() => this.syncAll()),
        FULL_INTERVAL_MS,
      ),
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
  }

  private async guard(job: () => Promise<unknown>) {
    if (this.running) return;
    this.running = true;
    try {
      await job();
    } catch (error) {
      // Неудачный проход не страшен: следующий подхватит то же самое.
      this.logger.error('Сбор контактов клиентов не удался', error);
    } finally {
      this.running = false;
    }
  }

  /** Заказы, изменённые с момента `since`. */
  async syncSince(since: Date): Promise<number> {
    return this.syncOrders({ updatedAt: { gte: since } });
  }

  /** Все заказы и всё, что лежит в корзине. */
  async syncAll(): Promise<{ orders: number; deleted: number }> {
    const orders = await this.syncOrders({});
    const deleted = await this.syncArchive();
    this.logger.log(
      `Контакты клиентов: заказов ${orders}, из корзины ${deleted}`,
    );
    return { orders, deleted };
  }

  private async syncOrders(
    where: Prisma.OrderPhotoWhereInput,
  ): Promise<number> {
    let cursor: string | undefined;
    let saved = 0;
    for (;;) {
      const page = await this.prisma.orderPhoto.findMany({
        where,
        select: CONTACT_ORDER_SELECT,
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      for (const order of page) {
        if (await saveClientContact(this.prisma, order)) saved++;
      }
      if (page.length < BATCH) return saved;
      cursor = page[page.length - 1].id;
    }
  }

  /** Удалённые заказы, чей снимок ещё лежит в корзине. */
  private async syncArchive(): Promise<number> {
    const rows = await this.prisma.orderDeletion.findMany({
      where: { restoredAt: null, NOT: { snapshot: { equals: Prisma.DbNull } } },
      select: { orderId: true, snapshot: true },
    });
    let saved = 0;
    for (const row of rows) {
      const order = (row.snapshot as { order?: Record<string, unknown> } | null)
        ?.order;
      if (!order?.numberOrder) continue;
      // Заказ могли вернуть и снова удалить — живая строка главнее.
      const alive = await this.prisma.orderPhoto.findUnique({
        where: { id: row.orderId },
        select: { id: true },
      });
      if (alive) continue;
      const source = {
        ...order,
        id: row.orderId,
      } as unknown as ContactOrderSource;
      if (await saveClientContact(this.prisma, source, { deleted: true }))
        saved++;
    }
    return saved;
  }

  async list(query: ContactListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, Math.max(1, query.limit ?? 50));
    const where = this.where(query);
    const [total, rows] = await Promise.all([
      this.prisma.clientContact.count({ where }),
      this.prisma.clientContact.findMany({
        where,
        include: { orders: { orderBy: { orderCreatedAt: 'desc' } } },
        orderBy: [{ lastOrderAt: { sort: 'desc', nulls: 'last' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const promoCount = await this.prisma.clientContact.count({
      where: { marketingConsent: true, unsubscribedAt: null },
    });
    return {
      total,
      page,
      limit,
      promoCount,
      items: rows.map((c) => this.view(c)),
    };
  }

  async update(id: string, patch: ContactPatch) {
    const existing = await this.prisma.clientContact.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Контакт не найден');
    const data: Prisma.ClientContactUpdateInput = {};
    if (patch.marketingConsent !== undefined) {
      data.marketingConsent = patch.marketingConsent;
      data.marketingConsentAt = patch.marketingConsent ? new Date() : null;
      data.marketingConsentSource = patch.marketingConsent
        ? patch.marketingConsentSource?.trim() || 'отмечено вручную в CRM'
        : null;
      if (patch.marketingConsent) data.unsubscribedAt = null;
    }
    if (patch.unsubscribed !== undefined) {
      data.unsubscribedAt = patch.unsubscribed ? new Date() : null;
    }
    if (patch.ownerNote !== undefined)
      data.ownerNote = patch.ownerNote?.trim() || null;
    if (patch.name !== undefined) data.name = patch.name?.trim() || null;
    const saved = await this.prisma.clientContact.update({
      where: { id },
      data,
      include: { orders: { orderBy: { orderCreatedAt: 'desc' } } },
    });
    return this.view(saved);
  }

  /** CSV для рассылки. По умолчанию — только согласившиеся. */
  async exportCsv(promoOnly: boolean): Promise<string> {
    const rows = await this.prisma.clientContact.findMany({
      where: this.where({ promoOnly }),
      include: { orders: true },
      orderBy: [{ lastOrderAt: { sort: 'desc', nulls: 'last' } }],
    });
    const head = [
      'Имя',
      'Телефон',
      'Telegram',
      'MAX',
      'Email',
      'Переписка',
      'Канал',
      'Заказов',
      'Покупок',
      'Сумма покупок',
      'Что брал',
      'Первый заказ',
      'Последний заказ',
      'Согласие на рассылку',
      'Отписался',
      'Пометка',
    ];
    const cell = (v: string | number | Date | null | undefined) => {
      const s =
        v == null
          ? ''
          : v instanceof Date
            ? v.toISOString().slice(0, 10)
            : String(v);
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((c) => {
      const v = this.view(c);
      return [
        v.name,
        v.phone,
        v.telegram ? `@${v.telegram}` : '',
        v.maxContact,
        v.email,
        v.contactUrl,
        v.channel,
        v.stats.ordersCount,
        v.stats.purchasesCount,
        v.stats.purchasedTotal,
        v.stats.categories.join(', '),
        v.firstOrderAt,
        v.lastOrderAt,
        v.marketingConsent ? 'да' : 'нет',
        v.unsubscribedAt,
        v.ownerNote,
      ]
        .map(cell)
        .join(';');
    });
    // BOM — чтобы Excel открыл кириллицу без танцев с кодировкой.
    return '﻿' + [head.join(';'), ...lines].join('\r\n');
  }

  private where(query: ContactListQuery): Prisma.ClientContactWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.promoOnly
        ? { marketingConsent: true, unsubscribedAt: null }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search.replace(/[^\d+]/g, '') || search } },
              {
                telegram: {
                  contains: search.replace(/^@/, ''),
                  mode: 'insensitive',
                },
              },
              { email: { contains: search, mode: 'insensitive' } },
              { maxContact: { contains: search, mode: 'insensitive' } },
              { orders: { some: { numberOrder: { contains: search } } } },
            ],
          }
        : {}),
    };
  }

  private view(
    c: Prisma.ClientContactGetPayload<{ include: { orders: true } }>,
  ) {
    const { orders, identityKey: _key, ...rest } = c;
    return {
      ...rest,
      canSendPromo: canSendPromo(c),
      stats: contactStats(orders),
      orders: orders.map((o) => ({
        orderId: o.orderId,
        numberOrder: o.numberOrder,
        status: o.status,
        productCategory: o.productCategory,
        totalOrder: o.totalOrder,
        orderCreatedAt: o.orderCreatedAt,
        deleted: o.deleted,
      })),
    };
  }
}
