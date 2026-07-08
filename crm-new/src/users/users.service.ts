import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreateUser } from './dto/create-user.dto';
import { DtoUpdateUser } from './dto/update-user.dto';

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
    return users.map(({ password: _, ...u }) => u);
  }

  async updateUser(id: string, dto: DtoUpdateUser, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const data: {
      isActive?: boolean;
      rateBasisPoints?: number;
      telegramUsername?: string | null;
    } = {};

    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.rateBasisPoints !== undefined)
      data.rateBasisPoints = dto.rateBasisPoints;
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
