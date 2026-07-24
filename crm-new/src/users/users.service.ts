import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumStatus } from 'src/generated/prisma/enums';
import { DtoCreateUser } from './dto/create-user.dto';
import { DtoUpdateUser } from './dto/update-user.dto';

/**
 * Статусы, в которых заказ реально висит на исполнителе.
 *
 * Считаем загрузку ТОЛЬКО до «Готов»: как только работа сдана, исполнитель
 * свободен, даже если заказ ещё не отправлен и не оплачен — дальше это забота
 * администратора, а не производства. Список положительный (что считаем), а не
 * отрицательный: новый статус в enum не начнёт молча раздувать счётчик.
 */
const IN_WORK_STATUSES: EnumStatus[] = [
  EnumStatus.NEW,
  EnumStatus.FOLDER_STRUCTURE_CREATED,
  EnumStatus.IN_PROGRESS,
  EnumStatus.PRINTED,
];

/**
 * Работа исполнителем сдана, но заказ ещё не ушёл клиенту. Загрузку не создаёт,
 * зато показывает «хвост»: сколько готовых заказов ждут выдачи или отправки.
 */
const READY_STATUSES: EnumStatus[] = [
  EnumStatus.READY,
  EnumStatus.DONE,
  EnumStatus.READY_FOR_REVIEW,
];

/** Сколько дней заказ может стоять в одном статусе, прежде чем считается зависшим. */
export const STALLED_AFTER_DAYS = 3;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(dto: DtoCreateUser) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('Пользователь уже существует');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { username: dto.username, password: hashed, role: dto.role },
    });
    const { password: _, ...safe } = user;
    return safe;
  }

  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Три группировки вместо обхода заказов в цикле — без N+1 обращений к БД.
    const stalledSince = new Date(
      Date.now() - STALLED_AFTER_DAYS * 24 * 60 * 60 * 1000,
    );

    const [activeCounts, readyCounts, stalledCounts] = await Promise.all([
      this.prisma.orderPhoto.groupBy({
        by: ['executorId'],
        where: { executorId: { not: null }, status: { in: IN_WORK_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.orderPhoto.groupBy({
        by: ['executorId'],
        where: { executorId: { not: null }, status: { in: READY_STATUSES } },
        _count: { _all: true },
      }),
      // Зависшие — только среди тех, что в работе: готовый заказ «висит» уже
      // не на исполнителе, и штрафовать его за это неправильно.
      this.prisma.orderPhoto.groupBy({
        by: ['executorId'],
        where: {
          executorId: { not: null },
          status: { in: IN_WORK_STATUSES },
          statusChangedAt: { lt: stalledSince },
        },
        _count: { _all: true },
      }),
    ]);

    const toMap = (
      rows: { executorId: string | null; _count: { _all: number } }[],
    ) => new Map(rows.map((row) => [row.executorId, row._count._all]));
    const active = toMap(activeCounts);
    const ready = toMap(readyCounts);
    const stalled = toMap(stalledCounts);

    return users.map(({ password: _, ...u }) => ({
      ...u,
      activeOrdersCount: active.get(u.id) ?? 0,
      readyOrdersCount: ready.get(u.id) ?? 0,
      stalledOrdersCount: stalled.get(u.id) ?? 0,
    }));
  }

  async updateUser(id: string, dto: DtoUpdateUser, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const data: {
      isActive?: boolean;
      rateBasisPoints?: number;
      designRateBasisPoints?: number;
      telegramUsername?: string | null;
    } = {};

    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.rateBasisPoints !== undefined)
      data.rateBasisPoints = dto.rateBasisPoints;
    if (dto.designRateBasisPoints !== undefined)
      data.designRateBasisPoints = dto.designRateBasisPoints;
    if ('telegramUsername' in dto)
      data.telegramUsername =
        dto.telegramUsername?.replace(/^@/, '').trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.rateBasisPoints !== undefined) {
        await tx.userRateHistory.create({
          data: {
            userId: id,
            oldRateBasisPoints: user.rateBasisPoints,
            newRateBasisPoints: dto.rateBasisPoints,
            changedBy: adminId,
          },
        });
      }
      return tx.user.update({ where: { id }, data });
    });

    const { password: _, ...safe } = updated;
    return safe;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const activeAccruals = await this.prisma.salaryAccrual.count({
      where: {
        executorId: id,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
    });
    if (activeAccruals > 0) {
      throw new BadRequestException(
        `Нельзя удалить пользователя: есть ${activeAccruals} незакрытых начислений. Сначала выплатите зарплату.`,
      );
    }

    const activeOrders = await this.prisma.orderPhoto.count({
      where: {
        executorId: id,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'PAID'] },
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException(
        `Нельзя удалить пользователя: он назначен на ${activeOrders} активных заказов.`,
      );
    }

    await this.prisma.user.delete({ where: { id } });
  }
}
