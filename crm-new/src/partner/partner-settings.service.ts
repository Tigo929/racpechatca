import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { EnumExpenseCategory, EnumRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  OrderSettlement,
  SettlementPosition,
  settleOrder,
} from './partner-settlement';

const SETTINGS_ID = 'default';

export interface UpdatePartnerSettingsDto {
  thermalTransferCost?: number;
  blankTshirtCost?: number;
  partnerRateBasisPoints?: number;
  partnerName?: string;
}

type TshirtItemForSettlement = {
  pricePosition: number;
  designCost: number;
  quantity: number;
  thermalCost: number;
  blankCost: number;
  clientItem: boolean;
};

/** Клиент Prisma или транзакция — методы работают в обоих контекстах. */
type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PartnerSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Единственная строка настроек; создаётся лениво, если её вдруг нет. */
  async get(db: Db = this.prisma) {
    const existing = await db.partnerSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) return existing;
    return db.partnerSettings.create({ data: { id: SETTINGS_ID } });
  }

  async update(dto: UpdatePartnerSettingsDto) {
    await this.get(); // гарантируем существование строки
    return this.prisma.partnerSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        thermalTransferCost: dto.thermalTransferCost,
        blankTshirtCost: dto.blankTshirtCost,
        partnerRateBasisPoints: dto.partnerRateBasisPoints,
        partnerName: dto.partnerName?.trim() || undefined,
      },
    });
  }

  private toPositions(
    items: TshirtItemForSettlement[],
  ): SettlementPosition[] {
    return items.map((i) => ({
      pricePosition: i.pricePosition,
      designCost: i.designCost,
      quantity: i.quantity,
      thermalCost: i.thermalCost,
      blankCost: i.blankCost,
      clientItem: i.clientItem,
    }));
  }

  /** Расчёт с партнёром по позициям заказа при текущей ставке. */
  async settleForItems(
    items: TshirtItemForSettlement[],
    db: Db = this.prisma,
  ): Promise<OrderSettlement> {
    const settings = await this.get(db);
    return settleOrder(this.toPositions(items), settings.partnerRateBasisPoints);
  }

  /**
   * Синхронизирует авто-расход «Вознаграждение партнёру» с оплатой заказа.
   * Идемпотентно: на PAID создаёт один расход, при уходе из PAID — убирает.
   * Работает внутри транзакции смены статуса.
   */
  async syncRewardExpense(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      orderNumber: string;
      items: TshirtItemForSettlement[];
      isPaid: boolean;
      actingUserId: string;
    },
  ): Promise<void> {
    const existing = await tx.expenseOrder.findFirst({
      where: {
        orderId: params.orderId,
        category: EnumExpenseCategory.PARTNER_REWARD,
      },
    });

    if (!params.isPaid) {
      // Ушли из «Оплачен» — снимаем ранее созданный авто-расход, чтобы
      // отчёты не показывали выплату, которой по факту уже нет.
      if (existing) {
        await tx.expenseOrder.delete({ where: { id: existing.id } });
      }
      return;
    }

    const settings = await this.get(tx);
    const settlement = settleOrder(
      this.toPositions(params.items),
      settings.partnerRateBasisPoints,
    );

    // Нечего платить (нет футболочных позиций или маржа нулевая) — не плодим
    // пустые расходы.
    if (settlement.reward <= 0) {
      if (existing) await tx.expenseOrder.delete({ where: { id: existing.id } });
      return;
    }

    const note = `${settings.partnerName}: заказ ${params.orderNumber} (заработок партнёра ${settlement.partnerProfit} ₽)`;

    if (existing) {
      // Сумма могла измениться (правка позиций/ставки до оплаты) — обновляем.
      await tx.expenseOrder.update({
        where: { id: existing.id },
        data: { amount: settlement.reward, note },
      });
      return;
    }

    await tx.expenseOrder.create({
      data: {
        category: EnumExpenseCategory.PARTNER_REWARD,
        amount: settlement.reward,
        note,
        orderId: params.orderId,
        createdById: params.actingUserId ?? (await this.fallbackAuthor(tx)),
      },
    });
  }

  /** На случай, если авто-расход создаётся вне действия конкретного админа. */
  private async fallbackAuthor(tx: Prisma.TransactionClient): Promise<string> {
    const admin = await tx.user.findFirst({
      where: { role: EnumRole.ADMIN },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('Нет ни одного администратора для авторства расхода');
    return admin.id;
  }
}
