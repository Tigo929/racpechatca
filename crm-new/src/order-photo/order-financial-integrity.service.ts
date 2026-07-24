import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { calculateManagerSalarySnapshot } from 'src/salary/salary-calculation';

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
   * Синхронизирует невыплаченные (PENDING/SETTLED) начисления с новой суммой
   * заказа после редактирования позиций/доставки/дизайна. Ставки сохраняются
   * из снимка — пересчитываются база и сумма. Обрабатывает и исполнителя
   * (kind=EXECUTOR), и менеджера по оформлению (kind=MANAGER, с премией дизайна).
   */
  async recalcPendingAccrual(
    orderId: string,
    totalOrder: number,
    deliveryCost: number,
    client: FinancialClient = this.prisma,
  ): Promise<void> {
    const accruals = await client.salaryAccrual.findMany({
      where: { orderId, status: { in: ['PENDING', 'SETTLED'] } },
    });
    if (accruals.length === 0) return;

    // Стоимость дизайна нужна для базы/премии менеджера — берём из заказа.
    const order = await client.orderPhoto.findUnique({
      where: { id: orderId },
      select: { designDevelopmentCost: true },
    });
    const designDevelopmentCost = order?.designDevelopmentCost ?? 0;

    for (const accrual of accruals) {
      // Считаем «неломающимся» способом: база не уходит в минус, ошибок не
      // бросаем — пересчёт не должен блокировать редактирование заказа.
      if (accrual.kind === 'MANAGER') {
        const snap = calculateManagerSalarySnapshot(
          totalOrder,
          deliveryCost,
          designDevelopmentCost,
          accrual.rateBasisPoints,
          accrual.designRateBasisPoints,
        );
        await client.salaryAccrual.update({
          where: { id: accrual.id },
          data: {
            salaryBase: snap.salaryBase,
            designBase: snap.designBase,
            salaryAmount: snap.salaryAmount,
            status: snap.status,
          },
        });
      } else {
        const salaryBase = Math.max(0, totalOrder - deliveryCost);
        const salaryAmount = Math.round(
          (salaryBase * accrual.rateBasisPoints) / 10_000,
        );
        await client.salaryAccrual.update({
          where: { id: accrual.id },
          data: {
            salaryBase,
            salaryAmount,
            status: salaryAmount === 0 ? 'SETTLED' : 'PENDING',
          },
        });
      }
    }
  }
}
