import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

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

    // Считаем «неломающимся» способом: база не уходит в минус, ошибок не бросаем —
    // пересчёт не должен блокировать редактирование заказа.
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
