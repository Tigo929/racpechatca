import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRole, EnumTaskStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreateTask } from './dto/create-task.dto';
import { DtoUpdateTask } from './dto/update-task.dto';
import { DtoQueryTasks } from './dto/query-tasks.dto';
import { OPEN_TASK_STATUSES } from './task-reminder-rules';

const TASK_INCLUDE = {
  assignee: {
    select: { id: true, username: true, telegramUsername: true },
  },
  createdBy: { select: { id: true, username: true } },
  order: { select: { id: true, numberOrder: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAssigneeExists(assigneeId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, isActive: true },
    });
    if (!user) throw new BadRequestException('Ответственный не найден.');
    if (!user.isActive) {
      throw new BadRequestException(
        'Нельзя назначить задачу отключённому сотруднику.',
      );
    }
  }

  async create(dto: DtoCreateTask, authorId: string) {
    await this.assertAssigneeExists(dto.assigneeId);
    return this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        assigneeId: dto.assigneeId,
        createdById: authorId,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        orderId: dto.orderId ?? null,
      },
      include: TASK_INCLUDE,
    });
  }

  async findAll(
    query: DtoQueryTasks,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const isExecutor = currentUserRole === EnumRole.EXECUTOR;
    return this.prisma.task.findMany({
      where: {
        status: query.status,
        // Исполнитель видит только свои задачи. Фильтр по ответственному из
        // запроса для него игнорируется — иначе можно было бы посмотреть чужие.
        assigneeId: isExecutor ? currentUserId : query.assigneeId,
      },
      include: TASK_INCLUDE,
      orderBy: [
        // Незакрытые сверху, внутри — по сроку. Задачи без срока в конце:
        // в Postgres NULL по возрастанию идёт последним, что здесь и нужно.
        { status: 'asc' },
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, currentUserId: string, currentUserRole: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Задача не найдена.');
    if (
      currentUserRole === EnumRole.EXECUTOR &&
      task.assigneeId !== currentUserId
    ) {
      throw new ForbiddenException('Нет доступа к чужой задаче.');
    }
    return task;
  }

  /** Полное редактирование — только администратор. */
  async update(id: string, dto: DtoUpdateTask) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Задача не найдена.');
    if (dto.assigneeId) await this.assertAssigneeExists(dto.assigneeId);

    const statusChanged = dto.status && dto.status !== task.status;
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description.trim() || null,
        assigneeId: dto.assigneeId,
        deadline:
          dto.deadline === undefined ? undefined : new Date(dto.deadline),
        orderId: dto.orderId,
        status: dto.status,
        ...(statusChanged ? this.statusSideEffects(dto.status!) : {}),
      },
      include: TASK_INCLUDE,
    });
  }

  /**
   * Смена статуса. Исполнителю доступна только для своих задач — это
   * единственное, что он может менять.
   */
  async updateStatus(
    id: string,
    status: EnumTaskStatus,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, status: true },
    });
    if (!task) throw new NotFoundException('Задача не найдена.');
    if (currentUserRole === EnumRole.EXECUTOR) {
      if (task.assigneeId !== currentUserId) {
        throw new ForbiddenException('Нет доступа к чужой задаче.');
      }
      if (status === EnumTaskStatus.CANCELLED) {
        throw new ForbiddenException('Отменить задачу может администратор.');
      }
    }
    return this.prisma.task.update({
      where: { id },
      data: { status, ...this.statusSideEffects(status) },
      include: TASK_INCLUDE,
    });
  }

  /**
   * Дата закрытия и сброс отметки о напоминании. Сброс важен: если задачу
   * переоткрыли в тот же день, дайджест должен снова её подхватить.
   */
  private statusSideEffects(status: EnumTaskStatus) {
    const isClosed = !OPEN_TASK_STATUSES.includes(status);
    return {
      completedAt: isClosed ? new Date() : null,
      lastRemindedOn: isClosed ? undefined : null,
    };
  }

  async remove(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Задача не найдена.');
    await this.prisma.task.delete({ where: { id } });
    return { success: true };
  }

  /** Счётчик для бейджа в меню: сколько незакрытых задач у пользователя. */
  async countOpen(currentUserId: string, currentUserRole: string) {
    const isExecutor = currentUserRole === EnumRole.EXECUTOR;
    const where = {
      status: { in: OPEN_TASK_STATUSES },
      ...(isExecutor ? { assigneeId: currentUserId } : {}),
    };
    const [open, overdue] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.count({
        where: { ...where, deadline: { lt: new Date() } },
      }),
    ]);
    return { open, overdue };
  }
}
