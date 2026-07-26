import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TshirtPartnerTelegramService } from './tshirt-partner-telegram.service';
import {
  EnumPartnerSyncStatus,
  EnumPrintLocation,
  EnumPrintType,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';

describe('TshirtPartnerTelegramService', () => {
  let uploadDir: string;

  beforeEach(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tshirt-tg-'));
  });

  afterEach(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  it('sends the tech spec and then attaches the PDF sticker before marking SENT', async () => {
    const orderId = 'order-1';
    const techSpecBuffer = Buffer.from('fake-png');
    await fs.writeFile(path.join(uploadDir, 'techspec.png'), techSpecBuffer);

    const order = {
      id: orderId,
      numberOrder: '20260726-001',
      tshirtModel: 'Classic',
      techSpecPhotoPath: 'techspec.png',
      tshirtItems: [
        {
          color: 'Белая',
          size: EnumTshirtSize.L,
          quantity: 1,
          printLocation: EnumPrintLocation.FRONT,
          printType: EnumPrintType.DTF,
          pricePosition: 1500,
          designCost: 200,
          thermalCost: 300,
          blankCost: 400,
          clientItem: false,
        },
      ],
    };

    const prisma = {
      orderPhoto: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue(order),
      },
    };
    const telegram = {
      sendPhoto: jest.fn().mockResolvedValue(true),
      sendDocument: jest.fn().mockResolvedValue(true),
    };
    const partnerSettings = {
      get: jest.fn().mockResolvedValue({ partnerRateBasisPoints: 3000 }),
    };
    const stickerService = {
      generateTshirtSticker: jest.fn().mockResolvedValue({
        buffer: Buffer.from('%PDF sticker'),
        filename: 'sticker-20260726-001.pdf',
      }),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TSHIRT_PARTNER_TELEGRAM_CHAT_ID: '-1004309818132',
          TSHIRT_PARTNER_TELEGRAM_THREAD_ID: '8',
          UPLOAD_DIR: uploadDir,
        };
        return values[key];
      }),
    };

    const service = new TshirtPartnerTelegramService(
      prisma as never,
      telegram as never,
      partnerSettings as never,
      stickerService as never,
      config as never,
    );

    await service.sendOrder(orderId);

    expect(stickerService.generateTshirtSticker).toHaveBeenCalledWith(orderId);
    expect(telegram.sendPhoto).toHaveBeenCalledTimes(1);
    expect(telegram.sendPhoto).toHaveBeenCalledWith(
      '-1004309818132',
      techSpecBuffer,
      'techspec.png',
      'image/png',
      expect.stringContaining('20260726-001'),
      '8',
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
    expect(telegram.sendDocument).toHaveBeenCalledTimes(1);
    expect(telegram.sendDocument).toHaveBeenCalledWith(
      '-1004309818132',
      Buffer.from('%PDF sticker'),
      'sticker-20260726-001.pdf',
      'application/pdf',
      expect.stringContaining('Стикер для печати'),
      '8',
    );
    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.SENT,
        partnerSyncAt: expect.any(Date),
        partnerSyncError: null,
      },
    });
  });

  it('does not mark SENT when the sticker document is rejected by Telegram', async () => {
    const orderId = 'order-2';
    await fs.writeFile(path.join(uploadDir, 'techspec.png'), 'fake-png');

    const order = {
      id: orderId,
      numberOrder: '20260726-002',
      tshirtModel: null,
      techSpecPhotoPath: 'techspec.png',
      tshirtItems: [
        {
          color: 'Черная',
          size: EnumTshirtSize.M,
          quantity: 1,
          printLocation: EnumPrintLocation.BACK,
          printType: EnumPrintType.DTF,
          pricePosition: 1000,
          designCost: 0,
          thermalCost: 200,
          blankCost: 300,
          clientItem: false,
        },
      ],
    };

    const prisma = {
      orderPhoto: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue(order),
      },
    };
    const telegram = {
      sendPhoto: jest.fn().mockResolvedValue(true),
      sendDocument: jest.fn().mockResolvedValue(false),
    };
    const service = new TshirtPartnerTelegramService(
      prisma as never,
      telegram as never,
      { get: jest.fn().mockResolvedValue({ partnerRateBasisPoints: 3000 }) } as never,
      {
        generateTshirtSticker: jest.fn().mockResolvedValue({
          buffer: Buffer.from('%PDF sticker'),
          filename: 'sticker-20260726-002.pdf',
        }),
      } as never,
      {
        get: jest.fn((key: string) =>
          ({
            TSHIRT_PARTNER_TELEGRAM_CHAT_ID: '-1004309818132',
            TSHIRT_PARTNER_TELEGRAM_THREAD_ID: '8',
            UPLOAD_DIR: uploadDir,
          })[key],
        ),
      } as never,
    );

    await service.sendOrder(orderId);

    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.FAILED,
        partnerSyncError: 'Telegram не принял PDF-стикер.',
      },
    });
  });
});
