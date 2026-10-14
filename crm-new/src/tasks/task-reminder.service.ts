import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';
import {
  DigestGroup,
  OPEN_TASK_STATUSES,
  buildPersonalDigestMessage,
  isTaskDueForReminder,
  isWithinDigestWindow,
  moscowDateKey,
} from './task-reminder-rules';

/** Дайджест одного человека вместе с задачами, которые он закрывает. */
interface PersonalDigest {
  group: DigestGroup;
  /** id задач из этого письма: отметку о дне ставим только доставленным. */
  taskIds: string[];
}

const SCAN_INTERVAL_MS = 60 * 60 * 1000;
const SCAN_LIMIT = 200;

/**
 * Раз в день напоминает каждому исполнителю о его задачах со сроком — в личку.
 *
 * Общий чат для этого не годится: письмо на всех там читают по диагонали,
 * а тема исполнителя хоть и адресная, но в неё надо зайти. Личное сообщение
 * видно сразу. Лички нет — остаётся прежний путь: тема, затем общий чат;
 * молчание хуже лишнего адресата.
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
      if (!isWithinDigestWindow(now)) return;
      const todayKey = moscowDateKey(now);

      const candidates = await this.prisma.task.findMany({
        where: {
          assigneeKind: EnumTaskAssigneeKind.USER,
          assigneeId: { not: null },
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
          assignee: {
            select: {
              username: true,
              telegramUsername: true,
              telegramTopicId: true,
              telegramChatId: true,
            },
          },
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

      const byAssignee = new Map<string, PersonalDigest>();
      for (const task of due) {
        if (!task.assigneeId || !task.assignee) continue;
        let digest = byAssignee.get(task.assigneeId);
        if (!digest) {
          digest = {
            group: { assignee: task.assignee, tasks: [] },
            taskIds: [],
          };
          byAssignee.set(task.assigneeId, digest);
        }
        digest.taskIds.push(task.id);
        digest.group.tasks.push({
          title: task.title,
          // Отфильтровано выше: у задач в дайджесте срок всегда есть.
          deadline: task.deadline!,
          orderNumber: task.order?.numberOrder ?? null,
        });
      }

      // Отметку ставим только тем задачам, чьё письмо дошло: если у одного
      // человека отправка сорвалась, остальным повторять не нужно, а ему —
      // нужно, и проверка через час попробует снова только его.
      const delivered: string[] = [];
      for (const { group, taskIds } of byAssignee.values()) {
        const { assignee } = group;
        const ok = await this.telegram.sendToExecutor(
          buildPersonalDigestMessage(group, now),
          assignee.telegramTopicId != null
            ? String(assignee.telegramTopicId)
            : undefined,
          assignee.username,
          assignee.telegramUsername ?? undefined,
          assignee.telegramChatId,
        );
        if (ok) delivered.push(...taskIds);
        else
          this.logger.warn(
            `Task digest not delivered to ${assignee.username}, will retry next scan`,
          );
      }

      if (delivered.length === 0) return;

      await this.prisma.task.updateMany({
        where: { id: { in: delivered } },
        data: { lastRemindedOn: todayKey },
      });
      this.logger.log(
        `Task digest sent: ${delivered.length} task(s), ${byAssignee.size} assignee(s)`,
      );
    } finally {
      this.running = false;
    }
  }
}
