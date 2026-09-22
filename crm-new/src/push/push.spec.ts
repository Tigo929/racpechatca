/* Prisma test doubles intentionally expose only the fields used by the scenario. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { createECDH, randomBytes } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as webpush from 'web-push';
import { PushService, validPushEndpoint } from './push.service';
import { SERVICE_WORKER_JS, CRM_MANIFEST } from './push-worker';
import { PushSubscribeDto } from './push.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

jest.mock('web-push', () => ({
  generateVAPIDKeys: jest.fn(() => ({
    publicKey: 'public',
    privateKey: 'private',
  })),
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('site lead push delivery', () => {
  let db: any;
  let service: PushService;
  let job: any;
  const sub = {
    endpoint: 'https://web.push.apple.com/test',
    keys: {
      p256dh: createECDH('prime256v1').generateKeys().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    job = {
      id: 'j1',
      orderId: 'o1',
      subscriptionId: 's1',
      body: 'Order',
      createdAt: new Date(),
      attempts: 1,
      subscription: {
        id: 's1',
        userId: 'u1',
        endpoint: sub.endpoint,
        ...sub.keys,
      },
    };
    db = {
      pushConfig: {
        upsert: jest.fn().mockResolvedValue({
          vapidPublicKey: 'public',
          vapidPrivateKey: 'private',
          vapidSubject: 'mailto:admin@test.local',
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      pushSubscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(job.subscription),
        findMany: jest.fn().mockResolvedValue([{ id: 's1' }]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      leadPushDelivery: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn().mockImplementation(() => Promise.resolve(job)),
        updateMany: jest.fn(),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'j1' }])
        .mockResolvedValue([]),
      $transaction: jest.fn(async (fn) => fn(db)),
    };
    service = new PushService(db);
    jest
      .mocked(webpush.sendNotification)
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  });

  it.each([
    'https://web.push.apple.com/id',
    'https://fcm.googleapis.com/fcm/send/id',
    'https://updates.push.services.mozilla.com/wpush/id',
    'https://wns.notify.windows.com/id',
  ])('accepts browser provider %s', (value) =>
    expect(validPushEndpoint(value)).toBe(true),
  );
  it.each([
    'http://web.push.apple.com/x',
    'https://127.0.0.1/x',
    'https://web.push.apple.com.evil.test/x',
    'https://user:pass@web.push.apple.com/x',
    'https://web.push.apple.com:8443/x',
  ])('rejects untrusted endpoint %s', (value) =>
    expect(validPushEndpoint(value)).toBe(false),
  );
  it('accepts the native subscription JSON with expirationTime', async () => {
    expect(
      await validate(
        plainToInstance(PushSubscribeDto, { ...sub, expirationTime: null }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toHaveLength(0);
    await service.saveSubscription(sub, 'u1');
    expect(db.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: 'u1' }),
      }),
    );
  });
  it('rejects absent keys and prevents bogus public keys', async () => {
    expect(
      (
        await validate(
          plainToInstance(PushSubscribeDto, { endpoint: sub.endpoint }),
        )
      ).length,
    ).toBeGreaterThan(0);
    await expect(
      service.saveSubscription(
        { ...sub, keys: { ...sub.keys, p256dh: 'A'.repeat(87) } },
        'u1',
      ),
    ).rejects.toThrow('подписка');
  });
  it('keeps existing VAPID keys when multiple servers initialize', async () => {
    await service.getPublicKey();
    expect(db.pushConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
  it('queues only active administrators and order managers in the supplied transaction', async () => {
    await service.enqueueLead(db, { id: 'o1', numberOrder: '42' }, 'Футболка');
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, role: { in: ['ADMIN', 'ORDER_MANAGER'] } },
      }),
    );
    expect(db.leadPushDelivery.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId: 'o1',
          subscriptionId: 's1',
          body: expect.stringContaining('42'),
        },
      ],
      skipDuplicates: true,
    });
  });
  it('sends one job with its own notification tag and finite network timeout', async () => {
    await service.flush();
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      sub,
      expect.stringContaining('site-lead-o1'),
      expect.objectContaining({ timeout: 10000, TTL: 3600 }),
    );
    expect(db.leadPushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });
  it('retries a temporary provider failure without blocking lead creation', async () => {
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValue({ statusCode: 503 });
    await service.flush();
    expect(db.leadPushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          errorCode: '503',
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });
  it('stops retrying after the attempt limit', async () => {
    job.attempts = 8;
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValue({ statusCode: 503 });
    await service.flush();
    expect(db.leadPushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
  it('removes expired subscriptions on HTTP 410', async () => {
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValue({ statusCode: 410 });
    await service.flush();
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
  });
  it('does not notify a deactivated user or a revoked role', async () => {
    db.user.findFirst.mockResolvedValue(null);
    await service.flush();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(db.leadPushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });
  it('test and unsubscribe cannot address another user’s device', async () => {
    db.pushSubscription.findFirst.mockResolvedValue(null);
    await expect(service.testDevice(sub.endpoint, 'another')).rejects.toThrow(
      'Сначала',
    );
    await service.removeSubscription(sub.endpoint, 'another');
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: sub.endpoint, userId: 'another' },
    });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});

describe('CRM service worker', () => {
  function worker(windows: any[] = []) {
    const handlers: Record<string, (event: any) => void> = {};
    const self = {
      location: { origin: 'https://crm.test' },
      addEventListener: (type: string, handler: (event: any) => void) => {
        handlers[type] = handler;
      },
      skipWaiting: jest.fn(),
      registration: {
        showNotification: jest.fn().mockResolvedValue(undefined),
      },
      clients: {
        claim: jest.fn(),
        matchAll: jest.fn().mockResolvedValue(windows),
        openWindow: jest.fn().mockResolvedValue(undefined),
      },
    };
    runInNewContext(SERVICE_WORKER_JS, { self, URL });
    return { self, handlers };
  }
  it('shows a visible notification even for malformed payloads (Safari)', async () => {
    const { self, handlers } = worker();
    let promise: Promise<unknown>;
    handlers.push({
      data: {
        json: () => {
          throw new Error('bad json');
        },
      },
      waitUntil: (p) => {
        promise = p;
      },
    });
    await promise!;
    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Новая заявка с сайта',
      expect.objectContaining({ data: { url: 'https://crm.test/crm/leads' } }),
    );
  });
  it('opens CRM and leaves the storefront window untouched', async () => {
    const storefront = {
      url: 'https://crm.test/catalog',
      focus: jest.fn(),
      navigate: jest.fn(),
    };
    const { self, handlers } = worker([storefront]);
    let promise: Promise<unknown>;
    handlers.notificationclick({
      notification: { close: jest.fn(), data: { url: 'https://evil.test' } },
      waitUntil: (p) => {
        promise = p;
      },
    });
    await promise!;
    expect(storefront.navigate).not.toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith(
      'https://crm.test/crm/leads',
    );
  });
  it('focuses the existing CRM window instead of opening a duplicate', async () => {
    const focus = jest.fn();
    const crm = {
      url: 'https://crm.test/crm/orders',
      navigate: jest.fn().mockResolvedValue({ focus }),
    };
    const { self, handlers } = worker([crm]);
    let promise: Promise<unknown>;
    handlers.notificationclick({
      notification: { close: jest.fn(), data: {} },
      waitUntil: (p) => {
        promise = p;
      },
    });
    await promise!;
    expect(focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
    expect(CRM_MANIFEST.scope).toBe('/crm/');
  });
});
