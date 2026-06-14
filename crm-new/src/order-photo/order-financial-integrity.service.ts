import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { calculateSalarySnapshot } from 'src/salary/salary-calculation';

type FinancialClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OrderFinancialIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Запрещает менять финансы заказа ТОЛЬКО если зарплата по нему уже выплачена
   * (полностью или частично) — деньги ушли, пересчёт недопустим.
   * Невыплаченные (PENDING/SETTLED) начисления редактировать можно: они потом
   * пересчитываются под новую сумму (см. recalcPendingAccrual).
   */
  async assertOrderFinanciallyEditable(
    orderId: string,
    client: FinancialClient = this.prisma,
  ): Promise<void> {
    const paidAccrual = await client.salaryAccrual.findFirst({
      where: {
        orderId,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      select: { id: true },
    });

    if (paidAccrual) {
      throw new ConflictException(
        'Нельзя изменить заказ: по нему уже выплачена зарплата исполнителю.',
      );
    }
  }

  /**
   * Синхронизирует невыплаченное (PENDING/SETTLED) начисление с новой суммой
   * заказа после редактирования позиций/доставки. Ставка (rateBasisPoints)
   * сохраняется из снимка — пересчитываются только база и сумма.
   */
  async recalcPendingAccrual(
    orderId: string,
    totalOrder: number,
    deliveryCost: number,
    client: FinancialClient = this.prisma,
  ): Promise<void> {
    const accrual = await client.salaryAccrual.findFirst({
      where: { orderId, status: { in: ['PENDING', 'SETTLED'] } },
    });
    if (!accrual) return;

    const snapshot = calculateSalarySnapshot(
      totalOrder,
      deliveryCost,
      accrual.rateBasisPoints,
    );
    await client.salaryAccrual.update({
      where: { id: accrual.id },
      data: {
        salaryBase: snapshot.salaryBase,
        salaryAmount: snapshot.salaryAmount,
        status: snapshot.status,
      },
    });
  }
}
