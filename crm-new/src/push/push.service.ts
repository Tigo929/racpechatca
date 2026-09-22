import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as webpush from 'web-push';
import { createHash, randomUUID, ECDH } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { SERVICE_WORKER_JS } from './push-worker';

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
const STAFF = ['ADMIN', 'ORDER_MANAGER'] as const;

export function validPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash)
      return false;
    return (
      [
        'fcm.googleapis.com',
        'fcm-reg.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
      ].includes(u.hostname) ||
      ['.push.apple.com', '.notify.windows.com', '.notify.live.net'].some(
        (suffix) => u.hostname.endsWith(suffix),
      )
    );
  } catch {
    return false;
  }
}

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private publicKey = '';
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureConfig();
    } catch {
      this.logger.warn('Web Push: конфигурация временно недоступна');
    }
    this.timer = setInterval(() => {
      void this.flush().catch(() =>
        this.logger.warn('Web Push: очередь временно недоступна'),
      );
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async ensureConfig() {
    const keys = webpush.generateVAPIDKeys();
    const cfg = await this.prisma.pushConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        vapidPublicKey: keys.publicKey,
        vapidPrivateKey: keys.privateKey,
      },
    });
    this.publicKey = cfg.vapidPublicKey;
    webpush.setVapidDetails(
      cfg.vapidSubject,
      cfg.vapidPublicKey,
      cfg.vapidPrivateKey,
    );
  }
  async getPublicKey() {
    if (!this.publicKey) await this.ensureConfig();
    return this.publicKey;
  }

  async saveSubscription(sub: BrowserSubscription, userId: string) {
    if (!validPushEndpoint(sub.endpoint))
      throw new BadRequestException(
        'Адрес push-службы этого браузера не поддерживается',
      );
    try {
      ECDH.convertKey(Buffer.from(sub.keys.p256dh, 'base64url'), 'prime256v1');
      if (Buffer.from(sub.keys.auth, 'base64url').length !== 16)
        throw new Error('auth');
    } catch {
      throw new BadRequestException(
        'Некорректная подписка браузера. Отключите и включите уведомления заново',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.pushSubscription.findUnique({
        where: { endpoint: sub.endpoint },
      });
      if (previous && previous.userId !== userId)
        await tx.leadPushDelivery.deleteMany({
          where: { subscriptionId: previous.id, status: 'PENDING' },
        });
      await tx.pushSubscription.upsert({
        where: { endpoint: sub.endpoint },
        create: {
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userId,
        },
        update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId },
      });
    });
  }
  async removeSubscription(endpoint: string, userId: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }

  /** Called inside the lead transaction; duplicate lead delivery never enqueues again. */
  async enqueueLead(
    tx: Prisma.TransactionClient,
    order: { id: string; numberOrder: string },
    productName?: string,
  ) {
    const users = await tx.user.findMany({
      where: { isActive: true, role: { in: [...STAFF] } },
      select: { id: true },
    });
    const subscriptions = await tx.pushSubscription.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { id: true },
    });
    if (!subscriptions.length) return;
    const body = `Заказ №${order.numberOrder}${productName ? ` · ${productName.slice(0, 120)}` : ''}. Откройте «Обращения», чтобы ответить клиенту.`;
    await tx.leadPushDelivery.createMany({
      data: subscriptions.map((s) => ({
        orderId: order.id,
        subscriptionId: s.id,
        body,
      })),
      skipDuplicates: true,
    });
  }

  private async send(
    sub: BrowserSubscription,
    payload: { title: string; body: string; tag: string; url: string },
  ) {
    if (!this.publicKey) await this.ensureConfig();
    if (!validPushEndpoint(sub.endpoint))
      throw new BadRequestException('Недопустимый адрес push-службы');
    return webpush.sendNotification(sub, JSON.stringify(payload), {
      TTL: 3600,
      urgency: 'high',
      timeout: 10000,
      topic: createHash('sha256')
        .update(payload.tag)
        .digest('base64url')
        .slice(0, 32),
    });
  }

  async testDevice(endpoint: string, userId: string) {
    const sub = await this.prisma.pushSubscription.findFirst({
      where: { endpoint, userId },
    });
    if (!sub)
      throw new NotFoundException(
        'Сначала включите уведомления на этом устройстве',
      );
    try {
      await this.send(
        { endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        {
          title: 'Уведомления CRM работают',
          body: 'Новые заявки с сайта будут приходить на это устройство.',
          tag: 'crm-push-test',
          url: '/crm/leads',
        },
      );
      return { ok: true };
    } catch (error: unknown) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await this.removeSubscription(endpoint, userId);
        throw new BadRequestException(
          'Подписка устарела. Отключите и включите уведомления заново',
        );
      }
      throw new ServiceUnavailableException(
        'Push-служба временно недоступна. Повторите проверку позже',
      );
    }
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      for (let i = 0; i < 10; i++) {
        const token = randomUUID();
        const job = await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "LeadPushDelivery" WHERE "status" = 'PENDING' AND "nextAttemptAt" <= NOW()
            AND ("claimedUntil" IS NULL OR "claimedUntil" < NOW()) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
          if (!rows.length) return null;
          return tx.leadPushDelivery.update({
            where: { id: rows[0].id },
            data: {
              claimToken: token,
              claimedUntil: new Date(Date.now() + 60000),
              attempts: { increment: 1 },
            },
            include: { subscription: true },
          });
        });
        if (!job) break;
        const finish = (data: Prisma.LeadPushDeliveryUpdateManyMutationInput) =>
          this.prisma.leadPushDelivery.updateMany({
            where: { id: job.id, claimToken: token },
            data: { claimedUntil: null, ...data },
          });
        const user =
          job.subscription.userId &&
          (await this.prisma.user.findFirst({
            where: {
              id: job.subscription.userId,
              isActive: true,
              role: { in: [...STAFF] },
            },
            select: { id: true },
          }));
        if (!user || Date.now() - job.createdAt.getTime() > 86400000) {
          await finish({ status: 'CANCELLED' });
          continue;
        }
        try {
          await this.send(
            {
              endpoint: job.subscription.endpoint,
              keys: {
                p256dh: job.subscription.p256dh,
                auth: job.subscription.auth,
              },
            },
            {
              title: 'Новая заявка с сайта',
              body: job.body,
              tag: `site-lead-${job.orderId}`,
              url: '/crm/leads',
            },
          );
          await finish({ status: 'SENT', sentAt: new Date(), errorCode: null });
        } catch (error: unknown) {
          const code = (error as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await this.prisma.pushSubscription.deleteMany({
              where: { id: job.subscriptionId },
            });
          } else {
            const transient = !code || code === 429 || code >= 500;
            await finish({
              status: transient && job.attempts < 8 ? 'PENDING' : 'FAILED',
              errorCode: String(code ?? 'network'),
              nextAttemptAt: new Date(
                Date.now() + Math.min(900000, 15000 * 2 ** job.attempts),
              ),
            });
            this.logger.warn(
              `Web Push: попытка ${job.attempts}, код ${code ?? 'network'}`,
            );
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }
  serviceWorkerJs() {
    return SERVICE_WORKER_JS;
  }
}
