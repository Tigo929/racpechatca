import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import {
  DIGEST_HOUR,
  DigestGroup,
  OPEN_TASK_STATUSES,
  buildDigestMessage,
  isTaskDueForReminder,
  moscowDateKey,
  moscowHour,
} from './task-reminder-rules';

const SCAN_INTERVAL_MS = 60 * 60 * 1000;
const SCAN_LIMIT = 200;

/**
 * Раз в день напоминает в рабочий чат о задачах со сроком.
 *
 * Проверка идёт ежечасно, а не «строго в 10:00» по расписанию: если сервер
 * в этот час перезагружался, крон пропустил бы день молча, а проверка
 * догонит на следующем часе. Отметка о дне отправки лежит в самой задаче,
 * поэтому перезапуск контейнера не приводит к повторной рассылке.
 */
@Injectable()
export class TaskReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskReminderService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Task digest scan failed', err);
      });
    }, SCAN_INTERVAL_MS);

    this.startupTimer = setTimeout(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Initial task digest scan failed', err);
      });
    }, 45_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  async scanAndNotify(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      if (moscowHour(now) < DIGEST_HOUR) return;
      const todayKey = moscowDateKey(now);

      const candidates = await this.prisma.task.findMany({
        where: {
          status: { in: OPEN_TASK_STATUSES },
          deadline: { not: null },
          NOT: { lastRemindedOn: todayKey },
        },
        take: SCAN_LIMIT,
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          assigneeId: true,
          assignee: { select: { username: true, telegramUsername: true } },
          order: { select: { numberOrder: true } },
        },
      });

      // Порог «за 3 дня до срока» держим в одном месте — в правилах.
      const due = candidates.filter((task) =>
        isTaskDueForReminder(
          { status: task.status, deadline: task.deadline },
          now,
        ),
      );
      if (due.length === 0) return;

      const byAssignee = new Map<string, DigestGroup>();
      for (const task of due) {
        let group = byAssignee.get(task.assigneeId);
        if (!group) {
          group = { assignee: task.assignee, tasks: [] };
          byAssignee.set(task.assigneeId, group);
        }
        group.tasks.push({
          title: task.title,
          // Отфильтровано выше: у задач в дайджесте срок всегда есть.
          deadline: task.deadline!,
          orderNumber: task.order?.numberOrder ?? null,
        });
      }

      const sent = await this.telegram.sendToGroup(
        buildDigestMessage([...byAssignee.values()], now),
      );
      if (!sent) {
        // Отметку не ставим — повторим на следующем часе.
        this.logger.warn('Task digest not delivered, will retry next scan');
        return;
      }

      await this.prisma.task.updateMany({
        where: { id: { in: due.map((t) => t.id) } },
        data: { lastRemindedOn: todayKey },
      });
      this.logger.log(
        `Task digest sent: ${due.length} task(s), ${byAssignee.size} assignee(s)`,
      );
    } finally {
      this.running = false;
    }
  }
}
