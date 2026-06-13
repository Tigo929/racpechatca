import { BadRequestException } from '@nestjs/common';
import type { EnumAccrualStatus } from 'src/generated/prisma/enums';

export interface SalarySnapshot {
  salaryBase: number;
  rateBasisPoints: number;
  salaryAmount: number;
  status: EnumAccrualStatus;
}

export function calculateSalarySnapshot(
  totalOrder: number,
  deliveryCost: number,
  rateBasisPoints: number | null,
): SalarySnapshot {
  const salaryBase = totalOrder - deliveryCost;
  if (salaryBase < 0) {
    throw new BadRequestException(
      'Стоимость доставки не может превышать общий чек заказа',
    );
  }

  if (rateBasisPoints === null) {
    throw new BadRequestException('Для исполнителя не указана ставка зарплаты');
  }

  const salaryAmount = Math.round((salaryBase * rateBasisPoints) / 10_000);

  return {
    salaryBase,
    rateBasisPoints,
    salaryAmount,
    status: salaryAmount === 0 ? 'SETTLED' : 'PENDING',
  };
}
