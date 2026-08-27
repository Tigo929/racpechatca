import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
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

  it('печать по изделию заказчика: футболок в заказе нет, работа — свободной позицией', async () => {
    /*
     * Заказ без единой позиции-футболки. Раньше он вообще не доходил до
     * отправки: система отвечала «В заказе нет позиций-футболок», хотя
     * работа есть — клиент принёс своё изделие, мы наносим принт.
     *
     * Проверяем и то, что состав попал в отчёт: без этого исполнитель
     * получал заказ с пустым списком и шёл переспрашивать.
     */
    const orderId = 'order-tolko-nanesenie';
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    await fs.writeFile(path.join(uploadDir, 'tz.jpg'), jpeg);

    const order = {
      id: orderId,
      numberOrder: '20260827-001',
      tshirtModel: null,
      techSpecPhotoPath: 'tz.jpg',
      techSpecPhotoPaths: ['tz.jpg'],
      tshirtItems: [],
      items: [
        {
          formatPaper: 'Нанесение принта на изделие заказчика',
          typePaper: 'MATTE',
          quantity: 3,
          price: 900,
          // Свободная цена: количество в сумму не умножается — 900, не 2700.
          pricePosition: 900,
          isFreePrice: true,
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
      sendPhoto: jest.fn().mockResolvedValue({ messageId: 11 }),
      sendDocument: jest.fn().mockResolvedValue({ messageId: 11 }),
    };
    const partnerSettings = {
      get: jest.fn().mockResolvedValue({ partnerRateBasisPoints: 3000 }),
    };
    const stickerLinks = {
      buildStickerUrl: jest.fn().mockReturnValue('https://crm.example.test/s.pdf'),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TSHIRT_PARTNER_TELEGRAM_CHAT_ID: '-1001',
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

    expect(telegram.sendPhoto).toHaveBeenCalledTimes(1);
    const caption = telegram.sendPhoto.mock.calls[0][4] as string;

    // Заголовок обязан сказать, что заготовку искать не надо.
    expect(caption).toContain('Заказ на нанесение принта');
    // Состав работы — в отчёте, а не «спросите у менеджера».
    expect(caption).toContain('Нанесение принта на изделие заказчика');
    // Цена договорная и на количество не множится: 900, а не 2700.
    expect(caption).toContain('900 ₽');
    expect(caption).not.toContain('2 700 ₽');

    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partnerSyncStatus: EnumPartnerSyncStatus.SENT,
        }),
      }),
    );
  });

  it('заказ на нанесение принта: заготовку исполнителю не считаем и говорим об этом словами', async () => {
    /*
     * Давальческая позиция — «только нанесение»: футболку привозит клиент.
     *
     * Проверяется именно текст, а не только цифры. Раньше в сообщение уходило
     * «футболка: 0 ₽», и исполнитель читал это как «заготовка бесплатная» —
     * то есть брал её со склада. Цена ошибки — лишняя футболка на каждую
     * такую позицию.
     */
    const orderId = 'order-nanesenie';
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    await fs.writeFile(path.join(uploadDir, 'tz.jpg'), jpeg);

    const order = {
      id: orderId,
      numberOrder: '20260819-010',
      tshirtModel: null,
      techSpecPhotoPath: 'tz.jpg',
      techSpecPhotoPaths: ['tz.jpg'],
      tshirtItems: [
        {
          color: 'Своя',
          size: EnumTshirtSize.M,
          quantity: 2,
          printLocation: EnumPrintLocation.BACK,
          printType: EnumPrintType.DTF,
          pricePosition: 1200,
          designCost: 0,
          thermalCost: 70,
          blankCost: 400,
          clientItem: true,
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
      sendPhoto: jest.fn().mockResolvedValue({ messageId: 7 }),
      sendDocument: jest.fn().mockResolvedValue({ messageId: 7 }),
    };
    const partnerSettings = {
      get: jest.fn().mockResolvedValue({ partnerRateBasisPoints: 3000 }),
    };
    const stickerLinks = {
      buildStickerUrl: jest.fn().mockReturnValue('https://crm.example.test/s.pdf'),
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          TSHIRT_PARTNER_TELEGRAM_CHAT_ID: '-1001',
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

    // Один файл — уходит фотографией, подпись пятым аргументом.
    expect(telegram.sendPhoto).toHaveBeenCalledTimes(1);
    const caption = telegram.sendPhoto.mock.calls[0][4] as string;

    // Видно с первой строки, что футболки заводить не надо.
    expect(caption).toContain('Заказ на нанесение принта');
    expect(caption).toContain('только нанесение');
    expect(caption).toContain('заготовку не берём');
    // Ноль в рублях больше не пишем — именно его читали как «бесплатно».
    expect(caption).not.toContain('футболка: 0 ₽');

    /*
     * Деньги: заготовка в материалы не входит, делится только печать.
     * Материалы = термоперенос 70 × 2 = 140. Маржа = 1200 − 140 = 1060.
     * Доля партнёра 30% = 318, к выплате 318 + 140 = 458.
     */
    expect(caption).toContain('Материалы: 140 ₽');
    expect(caption).toContain('К выплате: <b>458 ₽</b>');

    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partnerSyncStatus: EnumPartnerSyncStatus.SENT,
        }),
      }),
    );
  });

  it('sends multiple tech spec files as one PDF message with buttons before marking SENT', async () => {
    const orderId = 'order-1';
    const jpeg = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: '#fff',
      },
    })
      .jpeg()
      .toBuffer();
    const techSpecBuffer = jpeg;
    const extraTechSpecBuffer = jpeg;
    await fs.writeFile(path.join(uploadDir, 'techspec-1.jpg'), techSpecBuffer);
    await fs.writeFile(
      path.join(uploadDir, 'techspec-2.jpg'),
      extraTechSpecBuffer,
    );

    const order = {
      id: orderId,
      numberOrder: '20260726-001',
      tshirtModel: 'Classic',
      techSpecPhotoPath: 'techspec-1.jpg',
      techSpecPhotoPaths: ['techspec-1.jpg', 'techspec-2.jpg'],
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
      sendPhoto: jest.fn().mockResolvedValue({ messageId: 4242 }),
      sendDocument: jest.fn().mockResolvedValue({ messageId: 4242 }),
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
    expect(telegram.sendPhoto).not.toHaveBeenCalled();
    expect(telegram.sendDocument).toHaveBeenCalledTimes(1);
    expect(telegram.sendDocument).toHaveBeenCalledWith(
      '-1004309818132',
      expect.any(Buffer),
      'techspec-20260726-001.pdf',
      'application/pdf',
      expect.stringContaining('2 файлов в одном PDF'),
      '8',
      {
        inline_keyboard: [
          [
            { text: '🔄 В работе', callback_data: `tshirt:${orderId}:work` },
            { text: '🖨️ Напечатано', callback_data: `tshirt:${orderId}:printed` },
          ],
          [
            { text: '✅ Готово', callback_data: `tshirt:${orderId}:ready` },
            { text: '❌ Не готово', callback_data: `tshirt:${orderId}:not_ready` },
          ],
          [
            {
              text: '🏷️ Распечатать стикер',
              url: 'https://crm.example.test/telegram/tshirt-orders/order-1/sticker.pdf?token=signed',
            },
          ],
        ],
      },
    );
    const pdfBuffer = telegram.sendDocument.mock.calls[0][1] as Buffer;
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(prisma.orderPhoto.update).toHaveBeenLastCalledWith({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.SENT,
        partnerSyncAt: expect.any(Date),
        partnerSyncError: null,
        // Координаты сообщения у партнёра — по ним потом редактируем подпись
        // под кнопками; отметка отправки и ревизия уходят в очередь gulian.
        partnerTgChatId: '-1004309818132',
        // Номер сообщения сохраняется — по нему потом правится подпись под
        // кнопками. Раньше здесь стоял null: мок отвечал `true`, а не номером,
        // и проверка закрепляла не поведение, а недостаток мока.
        partnerTgMessageId: 4242,
        executorSentAt: expect.any(Date),
        sourceRevision: { increment: 1 },
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
      techSpecPhotoPaths: ['techspec.png'],
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
      sendPhoto: jest.fn().mockResolvedValue({ messageId: 4242 }),
      sendDocument: jest.fn().mockResolvedValue({ messageId: 4242 }),
    };
    const service = new TshirtPartnerTelegramService(
      prisma as never,
      telegram as never,
      {
        get: jest.fn().mockResolvedValue({ partnerRateBasisPoints: 3000 }),
      } as never,
      {
        buildStickerUrl: jest.fn().mockReturnValue(null),
      } as never,
      {
        get: jest.fn(
          (key: string) =>
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
