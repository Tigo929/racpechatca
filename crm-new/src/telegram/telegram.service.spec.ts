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
    ['Алексей Сменов', '10815'],
    ['alexey', '10815'],
    ['Максим Кузьмин', '10813'],
    ['samogov', '10813'],
  ])(
    'uses the configured topic for %s when the user topic is empty',
    async (name, topic) => {
      const service = createService({
        TELEGRAM_EXECUTOR_CHAT_ID: '-1003723576278',
        TELEGRAM_EXECUTOR_ALEXEY_THREAD_ID: '10815',
        TELEGRAM_EXECUTOR_MAXIM_THREAD_ID: '10813',
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
      TELEGRAM_EXECUTOR_ALEXEY_THREAD_ID: '10815',
    });
    jest.spyOn(service, 'sendMessage').mockResolvedValue(true);

    await service.sendToExecutor('Заказ', '777', 'Лёха');

    expect(service.sendMessage).toHaveBeenCalledWith(
      '-1003723576278',
      'Заказ',
      '10815',
    );
  });

  it('recognizes the executor by Telegram username too', async () => {
    const service = createService({
      TELEGRAM_EXECUTOR_CHAT_ID: '-1003723576278',
      TELEGRAM_EXECUTOR_ALEXEY_THREAD_ID: '10815',
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
      '10815',
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
