import { BadRequestException } from '@nestjs/common';
import {
  ClientDraftService,
  DRAFT_MAX_LENGTH,
  isDraftStatus,
} from './client-draft.service';

/**
 * Черновик сообщения клиенту.
 *
 * Тесты сторожат границы: класть можно только туда, где есть поле ввода
 * (Telegram) и разборчивый ник, а очередь не должна застревать на строках,
 * которые положить некуда.
 */
describe('черновик сообщения клиенту', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    communicationPlatform: 'TELEGRAM',
    urlCommunication: 'https://t.me/client_test',
    ...over,
  });

  function service(db: Record<string, unknown>) {
    return new ClientDraftService(db as never);
  }

  it('кладёт текст и сбрасывает прошлый итог: просьба перезаписывает просьбу', async () => {
    // Менеджер поправил заказ и нажал ещё раз — в поле ввода должен
    // оказаться новый текст, а не старый.
    const update = jest.fn().mockResolvedValue({});
    const db = {
      orderPhoto: { findUnique: jest.fn().mockResolvedValue(order()), update },
    };
    await service(db).request('o1', '  Ваш заказ подтверждён  ');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: {
        clientDraftRequestedAt: expect.any(Date) as unknown,
        clientDraftText: 'Ваш заказ подтверждён',
        clientDraftAt: null,
        clientDraftStatus: null,
      },
    });
  });

  it('не в Telegram класть некуда', async () => {
    const db = {
      orderPhoto: {
        findUnique: jest
          .fn()
          .mockResolvedValue(order({ communicationPlatform: 'MAX' })),
        update: jest.fn(),
      },
    };
    await expect(service(db).request('o1', 'текст')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.orderPhoto.update).not.toHaveBeenCalled();
  });

  it('без разборчивого ника — отказ, а не молчание', async () => {
    const db = {
      orderPhoto: {
        findUnique: jest
          .fn()
          .mockResolvedValue(order({ urlCommunication: 'телеграм у Пети' })),
        update: jest.fn(),
      },
    };
    await expect(service(db).request('o1', 'текст')).rejects.toThrow(/ник/i);
  });

  it('пустой и слишком длинный текст не принимаются', async () => {
    const db = { orderPhoto: { findUnique: jest.fn(), update: jest.fn() } };
    await expect(service(db).request('o1', '   ')).rejects.toThrow(/Пустой/);
    await expect(
      service(db).request('o1', 'x'.repeat(DRAFT_MAX_LENGTH + 1)),
    ).rejects.toThrow(String(DRAFT_MAX_LENGTH));
  });

  it('строку, которую некуда положить, очередь закрывает, а не копит', async () => {
    // Иначе она встанет колом на первом же заказе с кривым ником.
    const update = jest.fn().mockResolvedValue({});
    const db = {
      orderPhoto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'bad',
            numberOrder: '1',
            urlCommunication: 'ерунда',
            clientDraftText: 'т',
          },
          {
            id: 'good',
            numberOrder: '2',
            urlCommunication: '@client_test',
            clientDraftText: 'текст',
          },
        ]),
        update,
      },
    };
    const items = await service(db).pending(10);
    expect(items).toEqual([
      { id: 'good', numberOrder: '2', username: 'client_test', text: 'текст' },
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bad' },
      data: {
        clientDraftAt: expect.any(Date) as unknown,
        clientDraftStatus: 'not_found',
      },
    });
  });

  it('итоги — из закрытого списка', () => {
    for (const ok of ['saved', 'not_found', 'privacy', 'error']) {
      expect(isDraftStatus(ok)).toBe(true);
    }
    expect(isDraftStatus('sent')).toBe(false);
  });
});
