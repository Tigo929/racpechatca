/* Dynamic Prisma test doubles intentionally return only the fields under test. */
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import 'reflect-metadata';
import sharp from 'sharp';
import { ApprovalDeliveryService } from './approval-delivery.service';
import {
  approvalCaption,
  approvalRecipient,
  deliverySelect,
} from './approval-delivery-state';
import { ApprovalController } from './approval.controller';
import { ApprovalDeliveryController } from './approval-delivery.controller';
import { SiteLeadTokenGuard } from '../order-photo/site-lead-token.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('Telegram approval delivery', () => {
  const date = new Date('2026-09-19T12:00:00Z');
  let row: any;
  let db: any;
  let storage: any;
  let service: ApprovalDeliveryService;

  beforeEach(async () => {
    row = {
      id: 'approval',
      orderId: 'order',
      status: 'READY',
      version: 1,
      previewFile: 'sheet.png',
      updatedAt: date,
      finalizedAt: date,
      telegramDelivery: null,
      order: {
        numberOrder: '20260919-1',
        communicationPlatform: 'TELEGRAM',
        urlCommunication: '@client_test',
      },
    };
    db = {
      printApproval: {
        findUnique: jest.fn(async () => row),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      orderPhoto: { findUnique: jest.fn(async () => ({ id: 'order', status: 'NEW', productCategory: 'TSHIRT' })), updateMany: jest.fn(async () => ({ count: 1 })) },
      statusHistory: { create: jest.fn() },
      approvalTelegramDelivery: {
        findUnique: jest.fn(async () => null),
        findFirst: jest.fn(),
        upsert: jest.fn(async (args) => args.create),
        update: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      $queryRaw: jest.fn(async () => [{ id: 'delivery' }]),
      $transaction: jest.fn(async (callback) => callback(db)),
    };
    storage = {
      readSheet: jest.fn(async () =>
        sharp({
          create: { width: 20, height: 20, channels: 3, background: 'white' },
        })
          .png()
          .toBuffer(),
      ),
    };
    service = new ApprovalDeliveryService(db, storage);
  });

  it.each([
    'https://t.me/client_test',
    '@client_test',
    'client_test',
    'telegram.me/client_test/',
  ])('accepts a private username: %s', (value) => {
    expect(approvalRecipient(value)).toBe('client_test');
  });
  it.each([
    'https://evil.test/client_test',
    'https://t.me/+invite',
    't.me/s/channel',
    't.me/client_test/123',
    '+79990001122',
    't.me/share',
    't.me/client_test?start=x',
  ])('rejects ambiguous contacts: %s', (value) => {
    expect(approvalRecipient(value)).toBeNull();
  });
  it('keeps the caption within Telegram limits and includes explicit approval instructions', () => {
    const caption = approvalCaption('20260919-1', 2);
    expect(caption.length).toBeLessThan(1024);
    expect(caption).toContain('версия 2');
    expect(caption).toContain('Макет согласован');
  });
  it('protects staff and worker routes separately', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ApprovalController)).toContain(
      JwtAuthGuard,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ApprovalDeliveryController),
    ).toEqual([SiteLeadTokenGuard]);
    expect(deliverySelect).not.toHaveProperty('image');
    expect(deliverySelect).not.toHaveProperty('claimToken');
  });
  it('captures the recipient and photo, never trusting browser-provided contact data', async () => {
    const result = await service.enqueue('approval', 'manager');
    expect(result.recipient).toBe('client_test');
    expect(result.requestedById).toBe('manager');
    expect(Buffer.from(result.image).subarray(0, 3)).toEqual(
      Buffer.from([255, 216, 255]),
    );
    expect(db.$queryRaw).toHaveBeenCalled();
  });
  it.each(['AVITO', 'MAX'])(
    'refuses non-Telegram orders (%s)',
    async (platform) => {
      row.order.communicationPlatform = platform;
      await expect(service.enqueue('approval', 'manager')).rejects.toThrow(
        'Telegram',
      );
      expect(storage.readSheet).not.toHaveBeenCalled();
    },
  );
  it.each(['PENDING', 'SENDING', 'SENT', 'UNKNOWN'])(
    'makes repeated clicks idempotent in %s',
    async (status) => {
      row.telegramDelivery = { id: 'existing', status };
      expect(await service.enqueue('approval', 'manager')).toBe(
        row.telegramDelivery,
      );
      expect(db.approvalTelegramDelivery.upsert).not.toHaveBeenCalled();
    },
  );
  it('rejects an outdated file', async () => {
    row.updatedAt = new Date(date.getTime() + 1);
    await expect(service.enqueue('approval', 'manager')).rejects.toThrow(
      'Готово',
    );
  });
  it('rejects edits concurrent with snapshot creation', async () => {
    db.printApproval.findUnique
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({
        ...row,
        updatedAt: new Date(date.getTime() + 1),
      });
    await expect(service.enqueue('approval', 'manager')).rejects.toThrow(
      'Данные изменились',
    );
  });
  it('returns the winner when two API instances enqueue simultaneously', async () => {
    db.approvalTelegramDelivery.findUnique.mockResolvedValue({
      id: 'winner',
      status: 'PENDING',
    });
    expect(await service.enqueue('approval', 'manager')).toEqual({
      id: 'winner',
      status: 'PENDING',
    });
    expect(db.approvalTelegramDelivery.upsert).not.toHaveBeenCalled();
  });
  it('allows explicit retry only after confirmed failure', async () => {
    row.telegramDelivery = { status: 'FAILED' };
    db.approvalTelegramDelivery.findUnique.mockResolvedValue({
      status: 'FAILED',
    });
    await service.enqueue('approval', 'manager');
    expect(
      db.approvalTelegramDelivery.upsert.mock.calls[0][0].update,
    ).toMatchObject({ status: 'PENDING', claimToken: null });
  });
  it('requires a Telegram message ID before marking sent', async () => {
    await expect(
      service.complete('id', { status: 'SENT', claimToken: 'token' }),
    ).rejects.toThrow('номер сообщения');
  });
  it('preserves the sheet revision and does not overwrite later edits on completion', async () => {
    db.approvalTelegramDelivery.findFirst.mockResolvedValue({
      status: 'SENDING',
      approvalId: 'approval',
      finalizedAt: date,
    });
    await service.complete('id', {
      status: 'SENT',
      claimToken: 'token',
      messageId: 123,
    });
    expect(db.printApproval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ updatedAt: date, finalizedAt: date }),
        data: { status: 'SENT', updatedAt: date },
      }),
    );
  });
  async function confirmSent() {
    db.approvalTelegramDelivery.findFirst.mockResolvedValue({
      status: 'SENDING', approvalId: 'approval', finalizedAt: date, requestedById: 'manager',
    });
    return service.complete('id', { status: 'SENT', claimToken: 'token', messageId: 123 });
  }
  it('advances the order and records the requesting employee only after delivery', async () => {
    await confirmSent();
    expect(db.orderPhoto.updateMany).toHaveBeenCalledWith({ where: { id: 'order', status: 'NEW' }, data: { status: 'APPROVAL_SENT' } });
    expect(db.statusHistory.create).toHaveBeenCalledWith({ data: { orderId: 'order', fromStatus: 'NEW', toStatus: 'APPROVAL_SENT', changedBy: 'manager' } });
  });
  it.each(['APPROVAL_SENT', 'SENT', 'IN_PROGRESS', 'READY', 'SHIPMENT_CREATED', 'PAID', 'COMPLETED', 'CANCELLED', 'PROBLEM'])('does not move %s backwards', async (status) => {
    db.orderPhoto.findUnique.mockResolvedValue({ id: 'order', status, productCategory: 'TSHIRT' });
    await confirmSent();
    expect(db.orderPhoto.updateMany).not.toHaveBeenCalled();
    expect(db.statusHistory.create).not.toHaveBeenCalled();
  });
  it('does not change the order when its status changes concurrently', async () => {
    db.orderPhoto.updateMany.mockResolvedValue({ count: 0 });
    await confirmSent();
    expect(db.statusHistory.create).not.toHaveBeenCalled();
  });
  it('does not advance an edited or already approved version', async () => {
    db.printApproval.updateMany.mockResolvedValue({ count: 0 });
    await confirmSent();
    expect(db.orderPhoto.updateMany).not.toHaveBeenCalled();
  });
  it.each(['FAILED', 'UNKNOWN'] as const)('does not advance after %s delivery', async (status) => {
    db.approvalTelegramDelivery.findFirst.mockResolvedValue({ status: 'SENDING' });
    await service.complete('id', { status, claimToken: 'token', errorCode: 'privacy' });
    expect(db.orderPhoto.updateMany).not.toHaveBeenCalled();
  });
  it('does not downgrade successful completion on a repeated callback', async () => {
    db.approvalTelegramDelivery.findFirst.mockResolvedValue({ status: 'SENT' });
    await service.complete('id', { status: 'UNKNOWN', claimToken: 'token' });
    expect(db.approvalTelegramDelivery.updateMany).not.toHaveBeenCalled();
  });
  it('expires lost claims to UNKNOWN without requeueing', async () => {
    await service.claim('token');
    expect(db.approvalTelegramDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'UNKNOWN', errorCode: 'uncertain' },
      }),
    );
    expect(db.approvalTelegramDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SENDING',
          claimToken: 'token',
        }),
      }),
    );
  });
  it('requires the active claim to download a photo', async () => {
    db.approvalTelegramDelivery.findFirst.mockResolvedValue(null);
    await expect(service.image('id', 'wrong-token')).rejects.toThrow(
      'не найдена',
    );
  });
});
