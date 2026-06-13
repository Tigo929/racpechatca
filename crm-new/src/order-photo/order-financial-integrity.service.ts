import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

type FinancialClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class OrderFinancialIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOrderFinanciallyEditable(
    orderId: string,
    client: FinancialClient = this.prisma,
  ): Promise<void> {
    const activeAccrual = await client.salaryAccrual.findFirst({
      where: {
        orderId,
        status: { not: 'REVERSED' },
      },
      select: { id: true },
    });

    if (activeAccrual) {
      throw new ConflictException(
        'По заказу уже создано начисление зарплаты.\n' +
          'Сначала сторнируйте начисление с указанием причины.',
      );
    }
  }
}
