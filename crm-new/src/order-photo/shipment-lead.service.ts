import { BadRequestException, Injectable } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

const STATE_ID = 'default';

/** Роли, которым можно поручить отгрузки: админ или менеджер по оформлению. */
const ELIGIBLE_ROLES: EnumRole[] = [EnumRole.ADMIN, EnumRole.ORDER_MANAGER];

export interface ShipmentLeadView {
  userId: string | null;
  user: {
    id: string;
    username: string;
    role: EnumRole;
    telegramUsername: string | null;
  } | null;
}

/**
 * «Старший дня» по отгрузкам — один на систему. Кого админ назначил, того план
 * дня тегает в блоке отгрузок: оформить поставки по готовым фотозаказам и
 * проконтролировать отгрузку. Флаг живёт в singleton-строке AppState.
 */
@Injectable()
export class ShipmentLeadService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ShipmentLeadView> {
    const state = await this.prisma.appState.findUnique({
      where: { id: STATE_ID },
      include: {
        shipmentLead: {
          select: {
            id: true,
            username: true,
            role: true,
            telegramUsername: true,
          },
        },
      },
    });
    return {
      userId: state?.shipmentLeadUserId ?? null,
      user: state?.shipmentLead ?? null,
    };
  }

  /** Назначить старшего (или снять — userId=null). Проверяем роль и активность. */
  async set(userId: string | null): Promise<ShipmentLeadView> {
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });
      if (!user) {
        throw new BadRequestException('Пользователь не найден');
      }
      if (!user.isActive) {
        throw new BadRequestException(
          'Нельзя назначить неактивного сотрудника старшим дня',
        );
      }
      if (!ELIGIBLE_ROLES.includes(user.role)) {
        throw new BadRequestException(
          'Старшим дня по отгрузкам может быть только администратор или менеджер по оформлению',
        );
      }
    }

    await this.prisma.appState.upsert({
      where: { id: STATE_ID },
      update: { shipmentLeadUserId: userId },
      create: { id: STATE_ID, shipmentLeadUserId: userId },
    });

    return this.get();
  }
}
