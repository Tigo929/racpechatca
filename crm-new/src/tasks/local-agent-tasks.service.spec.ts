import { BadRequestException, ConflictException } from '@nestjs/common';
import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';
import { TasksService } from './tasks.service';

describe('TasksService local agent queue', () => {
  const task = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const service = new TasksService({ task } as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not expose employee tasks through the agent queue', async () => {
    await expect(
      service.findLocalAgentQueue(EnumTaskAssigneeKind.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('claims an open agent task atomically', async () => {
    task.updateMany.mockResolvedValue({ count: 1 });
    task.findUnique.mockResolvedValue({ id: 'task-1' });

    await expect(
      service.claimLocalAgentTask('task-1', EnumTaskAssigneeKind.CODEX),
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
      service.claimLocalAgentTask('task-1', EnumTaskAssigneeKind.CODEX),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
