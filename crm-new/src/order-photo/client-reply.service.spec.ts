import { ClientReplyService } from './client-reply.service';

/**
 * Что происходит, когда клиент ответил на приветствие.
 *
 * Здесь решаются деньги и статус заказа, поэтому проверки сосредоточены
 * на трёх вещах: согласие переводит заявку в заказ и ставит счёт в очередь,
 * любой другой ответ не меняет ничего, кроме отметки, а повторно принесённый
 * ответ не делает ничего вовсе — иначе клиент получит два счёта.
 */

const lead = {
  id: 'o1',
  numberOrder: '20261106-001',
  status: 'LEAD',
  clientReplyAt: null,
  clientConfirmedAt: null,
  urlCommunication: 'https://t.me/client_name',
  totalOrder: 1490,
};

function build(order: Record<string, unknown> | null = lead) {
  const findUnique = jest.fn().mockResolvedValue(order);
  const update = jest.fn().mockResolvedValue({});
  const createHistory = jest.fn().mockResolvedValue({ id: 'h1' });
  const sendToOwner = jest.fn().mockResolvedValue(true);
  const enqueueTransition = jest.fn().mockResolvedValue('IN_PROGRESS');
  const tx = {
    orderPhoto: { update },
    statusHistory: { create: createHistory },
  };
  const prisma = {
    orderPhoto: { findUnique, findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(
      async (fn: (t: typeof tx) => Promise<unknown>) => await fn(tx),
    ),
  };
  const service = new ClientReplyService(
    prisma as never,
    { sendToOwner } as never,
    { enqueueTransition } as never,
  );
  return { service, update, createHistory, sendToOwner, enqueueTransition };
}

/** Аргумент вызова мока с типом: без него линтер видит `any`. */
function argOf<T>(fn: jest.Mock, call = 0): T {
  return (fn.mock.calls[call] as unknown[])[0] as T;
}

type UpdateCall = { data: Record<string, unknown> };

describe('ответ клиента на приветствие', () => {
  it('чистое «да» делает заявку заказом и готовит счёт', async () => {
    const { service, update, createHistory, enqueueTransition } = build();

    const result = await service.accept('o1', 'Да, всё верно');

    expect(result).toEqual({ confirmed: true, duplicate: false });
    // Отметка о согласии — по ней очередь счетов и находит заказ.
    expect(argOf<UpdateCall>(update).data).toMatchObject({
      clientReplyText: 'Да, всё верно',
    });
    expect(argOf<UpdateCall>(update).data.clientConfirmedAt).toBeInstanceOf(
      Date,
    );
    // Статус двигаем с историей: без неё переход не виден ни в карточке,
    // ни в отчётах.
    expect(argOf<UpdateCall>(createHistory).data).toMatchObject({
      fromStatus: 'LEAD',
      toStatus: 'NEW',
      changedBy: 'auto:client-reply',
    });
    expect(argOf<UpdateCall>(update, 1).data).toMatchObject({ status: 'NEW' });
    // И в Метрику: «заявка стала заказом» — шаг воронки, который нельзя
    // потерять только потому, что статус поставил не человек.
    expect(enqueueTransition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fromStatus: 'LEAD', toStatus: 'NEW' }),
    );
  });

  it('ответ с уточнением не двигает ни статус, ни счёт — зовёт человека', async () => {
    const { service, update, createHistory, sendToOwner, enqueueTransition } =
      build();

    const result = await service.accept('o1', 'да, а можно 20 штук?');

    expect(result).toEqual({ confirmed: false, duplicate: false });
    expect(createHistory).not.toHaveBeenCalled();
    expect(enqueueTransition).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(argOf<UpdateCall>(update).data.clientConfirmedAt).toBeUndefined();
    // Владельцу уходит сам текст: отвечать на вопрос быстрее из уведомления,
    // чем искать заказ в CRM.
    const notice = argOf<string>(sendToOwner);
    expect(notice).toContain('да, а можно 20 штук?');
    expect(notice).toContain('20261106-001');
  });

  it('тот же ответ, принесённый дважды, не отправит второй счёт', async () => {
    // Воркер мог перезапуститься и прочитать диалог заново.
    const { service, update, sendToOwner } = build({
      ...lead,
      clientReplyAt: new Date('2026-11-06T10:00:00Z'),
      clientConfirmedAt: new Date('2026-11-06T10:00:00Z'),
    });

    const result = await service.accept('o1', 'да');

    expect(result).toEqual({ confirmed: true, duplicate: true });
    expect(update).not.toHaveBeenCalled();
    expect(sendToOwner).not.toHaveBeenCalled();
  });

  it('согласие без суммы в заявке зовёт человека: счёт отправить нечем', async () => {
    // Корпоративная заявка на футболки приходит без позиции — партию
    // считает менеджер. «Итого к оплате: 0 ₽» человеку, который только
    // что сказал «да», хуже, чем пауза.
    const { service, sendToOwner } = build({ ...lead, totalOrder: 0 });

    const result = await service.accept('o1', 'да');

    expect(result.confirmed).toBe(true);
    const notice = argOf<string>(sendToOwner);
    expect(notice).toContain('суммы в заявке нет');
  });

  it('согласие по заказу, который уже ведёт человек, статус не трогает', async () => {
    // Менеджер успел перевести заявку сам — переписывать его работу нельзя.
    const { service, createHistory, update } = build({
      ...lead,
      status: 'IN_PROGRESS',
    });

    const result = await service.accept('o1', 'да');

    expect(result.confirmed).toBe(true);
    expect(createHistory).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
