import { LeadAlertService } from './lead-alert.service';
import { ALERT_LIFETIME_MS } from './lead-alert';

/**
 * Доставка уведомлений о заявках, когда Telegram недоступен.
 *
 * Поломка 13.11.2026: посредник, через которого сервер ходит в Telegram,
 * перестал отвечать, бот молчал сутки с лишним. Уведомления отправлялись
 * «на удачу», и о четырёх заявках владелец не узнал ни тогда, ни после.
 * Здесь проверяется, что теперь они ждут в очереди и уходят сами.
 */

interface Row {
  id: string;
  orderId: string;
  numberOrder: string;
  body: string;
  createdAt: Date;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  claimedUntil: Date | null;
  claimToken: string | null;
  sentAt: Date | null;
  lastError: string | null;
}

function row(over: Partial<Row> = {}): Row {
  return {
    id: 'alert-1',
    orderId: 'ord-1',
    numberOrder: '20261114-105',
    body: 'Новая заявка №20261114-105',
    createdAt: new Date(),
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - 1000),
    claimedUntil: null,
    claimToken: null,
    sentAt: null,
    lastError: null,
    ...over,
  };
}

/**
 * Очередь в памяти: та же выборка «первая подходящая строка», тот же захват
 * по токену. Писать настоящий Postgres ради этих правил незачем — проверяем
 * решения сервиса, а не SQL.
 */
function harness(
  rows: Row[],
  send: () => Promise<boolean>,
  liveOrders = ['ord-1', 'ord-2'],
) {
  // Текст запоминаем сами: из mock.calls он приходит нетипизированным.
  const sent: string[] = [];
  const sendLeadAlert = jest.fn((text: string) => {
    sent.push(text);
    return send();
  });
  const tx = {
    $queryRaw: () => {
      const now = Date.now();
      const found = rows.find(
        (r) =>
          r.status === 'PENDING' &&
          r.nextAttemptAt.getTime() <= now &&
          (!r.claimedUntil || r.claimedUntil.getTime() < now),
      );
      return Promise.resolve(found ? [{ id: found.id }] : []);
    },
    leadTelegramDelivery: {
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const target = rows.find((r) => r.id === where.id)!;
        target.claimToken = data.claimToken as string;
        target.claimedUntil = data.claimedUntil as Date;
        target.attempts += 1;
        return Promise.resolve({ ...target });
      },
    },
  };
  const prisma = {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    leadTelegramDelivery: {
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; claimToken: string };
        data: Record<string, unknown>;
      }) => {
        const target = rows.find(
          (r) => r.id === where.id && r.claimToken === where.claimToken,
        );
        if (target) Object.assign(target, data);
        return Promise.resolve({ count: target ? 1 : 0 });
      },
      count: () =>
        Promise.resolve(rows.filter((r) => r.status === 'PENDING').length),
    },
    orderPhoto: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          liveOrders.includes(where.id) ? { id: where.id } : null,
        ),
    },
  };
  const service = new LeadAlertService(
    prisma as never,
    {
      sendLeadAlert,
    } as never,
  );
  return { service, sendLeadAlert, sent, rows };
}

describe('очередь уведомлений о заявках', () => {
  it('Telegram молчит — уведомление остаётся в очереди, а не теряется', async () => {
    const { service, rows } = harness([row()], () => Promise.resolve(false));
    await service.flush();
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(rows[0].lastError).toBeTruthy();
  });

  it('канал ответил — уведомление ушло и помечено отправленным', async () => {
    const { service, rows, sendLeadAlert } = harness([row()], () =>
      Promise.resolve(true),
    );
    await service.flush();
    expect(sendLeadAlert).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe('SENT');
    expect(rows[0].sentAt).toBeInstanceOf(Date);
  });

  it('догоняющее уведомление уходит с пометкой о задержке', async () => {
    // Канал ожил через сутки: в чат падает заявка позавчерашнего дня, и
    // выглядеть свежей она не должна.
    const old = row({
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    });
    const { service, sent } = harness([old], () => Promise.resolve(true));
    await service.flush();
    expect(sent[0]).toContain('Уведомление запоздало');
    expect(sent[0]).toContain('Новая заявка №20261114-105');
  });

  it('заказ удалили — уведомление отменяем, а не шлём', async () => {
    // Дубль или спам владелец убирает в первые минуты; уведомление о нём,
    // пришедшее через сутки, отправило бы искать заказ, которого нет.
    const { service, rows, sendLeadAlert } = harness(
      [row({ orderId: 'ord-gone' })],
      () => Promise.resolve(true),
      ['ord-1'],
    );
    await service.flush();
    expect(sendLeadAlert).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('CANCELLED');
  });

  it('неделю не доставили — сдаёмся и пишем об этом', async () => {
    const stale = row({
      createdAt: new Date(Date.now() - ALERT_LIFETIME_MS - 60_000),
    });
    const { service, rows, sendLeadAlert } = harness([stale], () =>
      Promise.resolve(true),
    );
    await service.flush();
    expect(sendLeadAlert).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('FAILED');
  });

  it('первая осечка обрывает проход, а не долбит в закрытую дверь', async () => {
    // Канал падает целиком: двадцать строк — это двадцать таймаутов сети
    // подряд и двадцать одинаковых ошибок в логе.
    const { service, sendLeadAlert } = harness(
      [row(), row({ id: 'alert-2', orderId: 'ord-2' })],
      () => Promise.resolve(false),
    );
    await service.flush();
    expect(sendLeadAlert).toHaveBeenCalledTimes(1);
  });

  it('два прохода одновременно не отправляют одно и то же дважды', async () => {
    // Воркер тикает по таймеру, а приём заявки подталкивает очередь сразу:
    // два прохода запросто сходятся на одной строке.
    const { service, sendLeadAlert } = harness(
      [row()],
      () =>
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10)),
    );
    await Promise.all([service.flush(), service.flush()]);
    expect(sendLeadAlert).toHaveBeenCalledTimes(1);
  });
});

describe('постановка в очередь', () => {
  it('кладёт готовый текст с номером заказа и тегом ответственного', async () => {
    interface CreateManyArgs {
      data: { orderId: string; numberOrder: string; body: string }[];
      skipDuplicates?: boolean;
    }
    const queued: CreateManyArgs[] = [];
    const createMany = jest.fn((args: CreateManyArgs) => {
      queued.push(args);
      return Promise.resolve({ count: 1 });
    });
    const tx = {
      user: {
        findMany: () =>
          Promise.resolve([
            {
              username: 'admin',
              telegramUsername: 'vdpgulian',
              role: 'ADMIN',
              isActive: true,
            },
          ]),
      },
      partnerSettings: {
        findUnique: () => Promise.resolve({ leadMentionUsernames: '' }),
      },
      leadTelegramDelivery: { createMany },
    };
    const service = new LeadAlertService({} as never, {} as never);
    await service.enqueue(
      tx as never,
      { id: 'ord-7', numberOrder: '20261114-105' },
      {
        name: 'Клиент',
        productName: 'Фотопечать 10x15',
        quantity: 20,
        total: 400,
      },
    );
    const data = queued[0].data[0];
    expect(data.orderId).toBe('ord-7');
    expect(data.numberOrder).toBe('20261114-105');
    expect(data.body).toContain('20261114-105');
    expect(data.body).toContain('@vdpgulian');
    // Повторная доставка заявки не должна давать второе уведомление.
    expect(queued[0].skipDuplicates).toBe(true);
  });
});
