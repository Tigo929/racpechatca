import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

function createService(values: Record<string, string>) {
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new TelegramService(config);
}

describe('TelegramService routing', () => {
  it('routes executor messages to their topic in the executor chat', async () => {
    const service = createService({
      TELEGRAM_GROUP_CHAT_ID: '-1001',
      TELEGRAM_EXECUTOR_CHAT_ID: '-1003723576278',
    });
    jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

    await service.sendToExecutor('Заказ', '10813');

    expect(service.sendMessage).toHaveBeenCalledWith(
      '-1003723576278',
      'Заказ',
      '10813',
    );
  });

  it('routes the daily plan to its dedicated topic', async () => {
    const service = createService({
      TELEGRAM_GROUP_CHAT_ID: '-1001',
      TELEGRAM_DAILY_PLAN_CHAT_ID: '-1003723576278',
      TELEGRAM_DAILY_PLAN_THREAD_ID: '10870',
    });
    jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

    await service.sendDailyPlan('План дня');

    expect(service.sendMessage).toHaveBeenCalledWith(
      '-1003723576278',
      'План дня',
      '10870',
    );
  });

  it.each([
    ['Лёха', '10813'],
    ['alexey', '10813'],
    ['Максим Кузьмин', '10815'],
    ['samogov', '10815'],
  ])(
    'uses the configured topic for %s when the user topic is empty',
    async (name, topic) => {
      const service = createService({
        TELEGRAM_EXECUTOR_CHAT_ID: '-1003723576278',
        TELEGRAM_EXECUTOR_LEKHA_THREAD_ID: '10813',
        TELEGRAM_EXECUTOR_MAXIM_THREAD_ID: '10815',
      });
      jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

      await service.sendToExecutor('Заказ', undefined, name);

      expect(service.sendMessage).toHaveBeenCalledWith(
        '-1003723576278',
        'Заказ',
        topic,
      );
    },
  );

  it('keeps the known executor route ahead of a stale user topic', async () => {
    const service = createService({
      TELEGRAM_EXECUTOR_CHAT_ID: '-1003723576278',
      TELEGRAM_EXECUTOR_LEKHA_THREAD_ID: '10813',
    });
    jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

    await service.sendToExecutor('Заказ', '777', 'Лёха');

    expect(service.sendMessage).toHaveBeenCalledWith(
      '-1003723576278',
      'Заказ',
      '10813',
    );
  });

  it('recognizes the executor by Telegram username too', async () => {
    const service = createService({
      TELEGRAM_EXECUTOR_CHAT_ID: '-1003723576278',
      TELEGRAM_EXECUTOR_LEKHA_THREAD_ID: '10813',
    });
    jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

    await service.sendToExecutor(
      'Заказ',
      undefined,
      'worker-1',
      '@lyosha_print',
    );

    expect(service.sendMessage).toHaveBeenCalledWith(
      '-1003723576278',
      'Заказ',
      '10813',
    );
  });

  it('keeps the old group fallback when dedicated routes are not configured', async () => {
    const service = createService({ TELEGRAM_GROUP_CHAT_ID: '-1001' });
    jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

    await service.sendToExecutor('Заказ', '10815');
    await service.sendDailyPlan('План дня');

    expect(service.sendMessage).toHaveBeenNthCalledWith(
      1,
      '-1001',
      'Заказ',
      '10815',
    );
    expect(service.sendMessage).toHaveBeenNthCalledWith(
      2,
      '-1001',
      'План дня',
      undefined,
    );
  });
});
