import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Web Push: уведомления о новой заявке, когда вкладка CRM закрыта.
 *
 * VAPID-ключи бэкенд генерирует сам при первом обращении и хранит в БД —
 * настройка на сервере (env) не нужна. Подписки браузеров лежат в
 * PushSubscription; мёртвые (404/410 от push-сервиса) чистим на лету.
 *
 * Service worker отдаётся этим же модулем (см. push.controller), а не статикой:
 * на домене сайта статику CRM отдаёт не CRM, а префикс order-photo-push уходит
 * на бэкенд на обоих доменах.
 */
export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey = '';

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureConfig();
    } catch (err) {
      this.logger.warn(`Не удалось инициализировать Web Push: ${String(err)}`);
    }
  }

  private async ensureConfig() {
    let cfg = await this.prisma.pushConfig.findUnique({
      where: { id: 'default' },
    });
    if (!cfg) {
      const keys = webpush.generateVAPIDKeys();
      cfg = await this.prisma.pushConfig.create({
        data: {
          id: 'default',
          vapidPublicKey: keys.publicKey,
          vapidPrivateKey: keys.privateKey,
        },
      });
      this.logger.log('Сгенерированы VAPID-ключи для Web Push');
    }
    this.publicKey = cfg.vapidPublicKey;
    webpush.setVapidDetails(
      cfg.vapidSubject,
      cfg.vapidPublicKey,
      cfg.vapidPrivateKey,
    );
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) await this.ensureConfig();
    return this.publicKey;
  }

  async saveSubscription(sub: BrowserSubscription, userId: string | null) {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userId,
      },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId },
    });
  }

  async removeSubscription(endpoint: string) {
    if (!endpoint) return;
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /** Разослать уведомление во все подписанные браузеры. Ошибки не бросаем. */
  async sendToAll(payload: { title: string; body: string; url?: string }) {
    try {
      if (!this.publicKey) await this.ensureConfig();
      const subs = await this.prisma.pushSubscription.findMany();
      // Логируем число подписок: по нему видно, подписался ли кто-то вообще
      // (0 = никто не нажал «включить уведомления» в браузере).
      this.logger.log(`Web Push: рассылка в ${subs.length} подписк(и/у)`);
      if (subs.length === 0) return;
      const data = JSON.stringify(payload);
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              data,
            );
          } catch (err: unknown) {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) {
              // Подписка мертва (браузер отписался/сбросил) — удаляем.
              await this.prisma.pushSubscription.deleteMany({
                where: { endpoint: s.endpoint },
              });
            } else {
              this.logger.warn(`Push не доставлен: ${status ?? String(err)}`);
            }
          }
        }),
      );
    } catch (err) {
      this.logger.warn(`Ошибка рассылки Web Push: ${String(err)}`);
    }
  }

  /** JS service worker'а. Отдаётся контроллером как файл. */
  serviceWorkerJs(): string {
    return SERVICE_WORKER_JS;
  }
}

const SERVICE_WORKER_JS = `// CRM Web Push service worker (отдаётся бэкендом).
self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || 'Новая заявка с сайта';
  var body = data.body || 'Пришла заявка — её нужно обработать';
  var url = data.url || '/crm/leads';
  event.waitUntil(self.registration.showNotification(title, {
    body: body,
    tag: 'new-site-lead',
    requireInteraction: true,
    data: { url: url }
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/crm/leads';
  event.waitUntil((async function () {
    var all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if ('focus' in c) {
        try { await c.focus(); if (c.navigate) await c.navigate(url); } catch (e) {}
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
`;
