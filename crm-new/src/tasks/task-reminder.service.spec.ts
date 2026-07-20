import { EnumTaskStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { TaskReminderService } from './task-reminder.service';

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

interface Stub {
  task: { findMany: AsyncMock; updateMany: AsyncMock };
}

function createStub(): Stub {
  return {
    task: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      updateMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue({}),
    },
  };
}

function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task-1',
    title: 'Переделать макет',
    status: EnumTaskStatus.OPEN,
    deadline: new Date('2026-07-19T09:00:00Z'),
    assigneeId: 'user-1',
    assignee: { username: 'Иван', telegramUsername: 'ivan' },
    order: null,
    ...overrides,
  };
}

function setup(sendResult = true) {
  const stub = createStub();
  const telegram = {
    sendToGroup: jest.fn<Promise<boolean>, unknown[]>().mockResolvedValue(sendResult),
  };
  const service = new TaskReminderService(
    stub as unknown as PrismaService,
    telegram as unknown as TelegramService,
  );
  return { stub, telegram, service };
}

// 10:00 по Москве.
const AT_TEN = new Date('2026-07-20T07:00:00Z');
// 08:00 по Москве — до времени рассылки.
const BEFORE_TEN = new Date('2026-07-20T05:00:00Z');
// 23:00 по Москве — окно уже закрыто.
const LATE_NIGHT = new Date('2026-07-20T20:00:00Z');

describe('ежедневный дайджест задач', () => {
  it('молчит до времени рассылки и не трогает базу', async () => {
    const { stub, telegram, service } = setup();

    await service.scanAndNotify(BEFORE_TEN);

    expect(stub.task.findMany).not.toHaveBeenCalled();
    expect(telegram.sendToGroup).not.toHaveBeenCalled();
  });

  it('молчит ночью, даже если задача просрочена', async () => {
    const { stub, telegram, service } = setup();
    stub.task.findMany.mockResolvedValue([makeTask()]);

    await service.scanAndNotify(LATE_NIGHT);

    // Ежечасная проверка догоняет пропущенное, но будить чат в 23:00 нельзя.
    expect(telegram.sendToGroup).not.toHaveBeenCalled();
  });

  it('шлёт одно сообщение на всех и отмечает день отправки', async () => {
    const { stub, telegram, service } = setup();
    stub.task.findMany.mockResolvedValue([
      makeTask(),
      makeTask({ id: 'task-2', title: 'Закупить плёнку', assigneeId: 'user-2' }),
    ]);

    await service.scanAndNotify(AT_TEN);

    // Именно одно сообщение, а не по одному на задачу — иначе чат утонет.
    expect(telegram.sendToGroup).toHaveBeenCalledTimes(1);
    const text = telegram.sendToGroup.mock.calls[0]?.[0] as string;
    expect(text).toContain('Переделать макет');
    expect(text).toContain('Закупить плёнку');

    const update = stub.task.updateMany.mock.calls[0]?.[0] as {
      where: { id: { in: string[] } };
      data: { lastRemindedOn: string };
    };
    expect(update.where.id.in).toEqual(['task-1', 'task-2']);
    expect(update.data.lastRemindedOn).toBe('2026-07-20');
  });

  it('не отмечает день, если Telegram не принял сообщение', async () => {
    const { stub, service } = setup(false);
    stub.task.findMany.mockResolvedValue([makeTask()]);

    await service.scanAndNotify(AT_TEN);

    // Отметки нет — значит следующая проверка через час повторит попытку.
    expect(stub.task.updateMany).not.toHaveBeenCalled();
  });

  it('исключает уже отправленные сегодня прямо в запросе', async () => {
    const { stub, service } = setup();

    await service.scanAndNotify(AT_TEN);

    const where = (
      stub.task.findMany.mock.calls[0]?.[0] as {
        where: { NOT: { lastRemindedOn: string } };
      }
    ).where;
    expect(where.NOT.lastRemindedOn).toBe('2026-07-20');
  });

  it('не шлёт пустой дайджест, когда до сроков ещё далеко', async () => {
    const { telegram, stub, service } = setup();
    stub.task.findMany.mockResolvedValue([
      makeTask({ deadline: new Date('2026-08-30T09:00:00Z') }),
    ]);

    await service.scanAndNotify(AT_TEN);

    expect(telegram.sendToGroup).not.toHaveBeenCalled();
  });
});
