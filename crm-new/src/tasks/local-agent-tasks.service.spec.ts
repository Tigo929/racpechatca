import { BadRequestException, ConflictException } from '@nestjs/common';
import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';
import { LocalAgentTaskService } from './local-agent-task.service';

describe('LocalAgentTaskService', () => {
  const task = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const service = new LocalAgentTaskService({ task } as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not expose employee tasks through the agent queue', async () => {
    await expect(
      service.findQueue(EnumTaskAssigneeKind.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('claims an open agent task atomically', async () => {
    task.updateMany.mockResolvedValue({ count: 1 });
    task.findUnique.mockResolvedValue({ id: 'task-1' });

    await expect(
      service.claim('task-1', EnumTaskAssigneeKind.CODEX),
    ).resolves.toEqual({ id: 'task-1' });
    expect(task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'OPEN' }),
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });

  it('rejects a task already claimed by another process', async () => {
    task.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.claim('task-1', EnumTaskAssigneeKind.CODEX),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns stale in-progress tasks to the local queue', async () => {
    task.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.recoverStale(EnumTaskAssigneeKind.CODEX),
    ).resolves.toEqual({ recovered: 2 });
    expect(task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_PROGRESS' }),
        data: expect.objectContaining({ status: 'OPEN' }),
      }),
    );
  });

  it('sends the final agent report to the Telegram group on completion', async () => {
    const telegram = { sendToGroup: jest.fn().mockResolvedValue(true) };
    const serviceWithTelegram = new LocalAgentTaskService(
      { task } as never,
      telegram as never,
    );
    task.updateMany.mockResolvedValue({ count: 1 });
    task.findUnique.mockResolvedValue({
      id: 'task-1',
      title: 'Report task',
      assigneeKind: EnumTaskAssigneeKind.CODEX,
      order: null,
    });

    await expect(
      serviceWithTelegram.complete(
        'task-1',
        EnumTaskAssigneeKind.CODEX,
        'Готово',
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'task-1' }));
    expect(telegram.sendToGroup).toHaveBeenCalledWith(
      expect.stringContaining('Codex завершил задачу'),
    );
  });

  it('sends a problem report to the Telegram group when the agent fails', async () => {
    const telegram = { sendToGroup: jest.fn().mockResolvedValue(true) };
    const serviceWithTelegram = new LocalAgentTaskService(
      { task } as never,
      telegram as never,
    );
    task.updateMany.mockResolvedValue({ count: 1 });
    task.findUnique.mockResolvedValue({
      id: 'task-1',
      title: 'Broken task',
      assigneeKind: EnumTaskAssigneeKind.CODEX,
      order: null,
    });

    await serviceWithTelegram.fail(
      'task-1',
      EnumTaskAssigneeKind.CODEX,
      'Нужна проверка',
    );

    expect(task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
    expect(telegram.sendToGroup).toHaveBeenCalledWith(
      expect.stringContaining('сообщил о проблеме'),
    );
  });
});
