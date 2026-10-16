import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EnumTaskAssigneeKind,
  EnumTaskStatus,
} from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { buildLocalAgentReportMessage } from './local-agent-report';
import { assigneeKindLabel } from './task-assignee-kind';

const LOCAL_AGENT_TASK_INCLUDE = {
  assignee: {
    select: { id: true, username: true, telegramUsername: true },
  },
  createdBy: { select: { id: true, username: true } },
  order: { select: { id: true, numberOrder: true } },
} as const;

@Injectable()
export class LocalAgentTaskService {
  private readonly logger = new Logger(LocalAgentTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram?: TelegramService,
  ) {}

  private assertAgentKind(kind: EnumTaskAssigneeKind) {
    if (kind === EnumTaskAssigneeKind.USER) {
      throw new BadRequestException(
        'Для сотрудника локальный агент недоступен.',
      );
    }
  }

  private async findTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: LOCAL_AGENT_TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Задача не найдена.');
    return task;
  }

  async findQueue(kind: EnumTaskAssigneeKind) {
    this.assertAgentKind(kind);
    return this.prisma.task.findMany({
      where: { assigneeKind: kind, status: EnumTaskStatus.OPEN },
      include: LOCAL_AGENT_TASK_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  }

  async recoverStale(kind: EnumTaskAssigneeKind) {
    this.assertAgentKind(kind);
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const recovered = await this.prisma.task.updateMany({
      where: {
        assigneeKind: kind,
        status: EnumTaskStatus.IN_PROGRESS,
        OR: [
          { agentLastHeartbeatAt: null },
          { agentLastHeartbeatAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: EnumTaskStatus.OPEN,
        completedAt: null,
        agentLastHeartbeatAt: null,
        agentSummary:
          'Предыдущий запуск агента прервался. Задача возвращена в очередь.',
      },
    });
    return { recovered: recovered.count };
  }

  async claim(id: string, kind: EnumTaskAssigneeKind) {
    this.assertAgentKind(kind);
    const claimed = await this.prisma.task.updateMany({
      where: { id, assigneeKind: kind, status: EnumTaskStatus.OPEN },
      data: {
        status: EnumTaskStatus.IN_PROGRESS,
        completedAt: null,
        lastRemindedOn: null,
        agentLastHeartbeatAt: new Date(),
        agentSummary: `${assigneeKindLabel(kind)} получил задачу и начал работу.`,
      },
    });
    if (!claimed.count) {
      throw new ConflictException('Задача уже забрана или недоступна агенту.');
    }
    return this.findTask(id);
  }

  async note(id: string, kind: EnumTaskAssigneeKind, summary: string) {
    this.assertAgentKind(kind);
    const updated = await this.prisma.task.updateMany({
      where: {
        id,
        assigneeKind: kind,
        status: { in: [EnumTaskStatus.OPEN, EnumTaskStatus.IN_PROGRESS] },
      },
      data: { agentSummary: summary.trim() },
    });
    if (!updated.count) {
      throw new NotFoundException('Задача агента не найдена.');
    }
    return this.findTask(id);
  }

  async heartbeat(id: string, kind: EnumTaskAssigneeKind, summary: string) {
    this.assertAgentKind(kind);
    const updated = await this.prisma.task.updateMany({
      where: { id, assigneeKind: kind, status: EnumTaskStatus.IN_PROGRESS },
      data: { agentSummary: summary.trim(), agentLastHeartbeatAt: new Date() },
    });
    if (!updated.count) {
      throw new NotFoundException('Активная задача агента не найдена.');
    }
    return this.findTask(id);
  }

  async complete(id: string, kind: EnumTaskAssigneeKind, summary: string) {
    this.assertAgentKind(kind);
    const updated = await this.prisma.task.updateMany({
      where: { id, assigneeKind: kind, status: EnumTaskStatus.IN_PROGRESS },
      data: {
        status: EnumTaskStatus.DONE,
        completedAt: new Date(),
        agentSummary: summary.trim(),
        agentLastHeartbeatAt: new Date(),
      },
    });
    if (!updated.count) {
      throw new NotFoundException('Активная задача агента не найдена.');
    }
    const task = await this.findTask(id);
    await this.notifyReport(task, summary, 'done');
    return task;
  }

  async fail(id: string, kind: EnumTaskAssigneeKind, summary: string) {
    this.assertAgentKind(kind);
    const updated = await this.prisma.task.updateMany({
      where: { id, assigneeKind: kind, status: EnumTaskStatus.IN_PROGRESS },
      data: {
        status: EnumTaskStatus.CANCELLED,
        completedAt: new Date(),
        agentSummary: summary.trim(),
        agentLastHeartbeatAt: new Date(),
      },
    });
    if (!updated.count) {
      throw new NotFoundException('Активная задача агента не найдена.');
    }
    const task = await this.findTask(id);
    await this.notifyReport(task, summary, 'failed');
    return task;
  }

  private async notifyReport(
    task: Awaited<ReturnType<LocalAgentTaskService['findTask']>>,
    summary: string,
    status: 'done' | 'failed',
  ) {
    if (!this.telegram) return;
    const sent = await this.telegram.sendToGroup(
      buildLocalAgentReportMessage(task, summary, status),
    );
    if (!sent) {
      this.logger.warn(
        `Local agent report was not delivered to Telegram: ${task.id}`,
      );
    }
  }
}
