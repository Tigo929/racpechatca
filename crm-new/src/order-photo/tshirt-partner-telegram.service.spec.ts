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

  it('sends the tech spec with status buttons and a sticker download button before marking SENT', async () => {
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
    const stickerLinks = {
      buildStickerUrl: jest
        .fn()
        .mockReturnValue(
          'https://crm.example.test/telegram/tshirt-orders/order-1/sticker.pdf?token=signed',
        ),
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
      stickerLinks as never,
      config as never,
    );

    await service.sendOrder(orderId);

    expect(stickerLinks.buildStickerUrl).toHaveBeenCalledWith(orderId);
    expect(telegram.sendPhoto).toHaveBeenCalledTimes(1);
    expect(telegram.sendPhoto).toHaveBeenCalledWith(
      '-1004309818132',
      techSpecBuffer,
      'techspec.png',
      'image/png',
      expect.stringContaining('20260726-001'),
      '8',
      {
        inline_keyboard: [
          [
            { text: 'В работе', callback_data: `tshirt:${orderId}:work` },
            { text: 'Готово', callback_data: `tshirt:${orderId}:ready` },
          ],
          [{ text: 'Не готов', callback_data: `tshirt:${orderId}:not_ready` }],
          [
            {
              text: 'Распечатать стикер',
              url: 'https://crm.example.test/telegram/tshirt-orders/order-1/sticker.pdf?token=signed',
            },
          ],
        ],
      },
    );
    expect(telegram.sendDocument).not.toHaveBeenCalled();
    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.SENT,
        partnerSyncAt: expect.any(Date),
        partnerSyncError: null,
      },
    });
  });

  it('does not send or mark SENT when the sticker URL cannot be built', async () => {
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
      sendDocument: jest.fn().mockResolvedValue(true),
    };
    const service = new TshirtPartnerTelegramService(
      prisma as never,
      telegram as never,
      { get: jest.fn().mockResolvedValue({ partnerRateBasisPoints: 3000 }) } as never,
      {
        buildStickerUrl: jest.fn().mockReturnValue(null),
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

    expect(telegram.sendPhoto).not.toHaveBeenCalled();
    expect(telegram.sendDocument).not.toHaveBeenCalled();
    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.FAILED,
        partnerSyncError:
          'PUBLIC_BASE_URL или секрет для ссылки на стикер не задан.',
      },
    });
  });
});
