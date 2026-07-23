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

export interface ManagerSalarySnapshot {
  /** База базовой ставки = чек − доставка − дизайн (без ухода в минус). */
  salaryBase: number;
  rateBasisPoints: number;
  /** База премии за дизайн = стоимость «разработка дизайна». */
  designBase: number;
  designRateBasisPoints: number;
  /** Базовая часть + премия за дизайн. */
  salaryAmount: number;
  status: EnumAccrualStatus;
}

/**
 * Зарплата менеджера по оформлению за заказ:
 *  - базовая часть: (чек − доставка − дизайн) × базовая ставка;
 *  - премия за дизайн: стоимость дизайна × ставка премии.
 *
 * Пример владельца: футболка 1500, дизайн 1000, ставка 10%, премия 40% →
 * база 1500 × 10% = 150, премия 1000 × 40% = 400, итого 550 (владельцу 600).
 *
 * Ставки необязательны: не заданная ставка даёт 0 по своей части (менеджеру
 * без базовой ставки, но с премией за дизайн всё равно начислится премия).
 */
export function calculateManagerSalarySnapshot(
  totalOrder: number,
  deliveryCost: number,
  designDevelopmentCost: number,
  rateBasisPoints: number | null,
  designRateBasisPoints: number | null,
): ManagerSalarySnapshot {
  const design = Math.max(0, designDevelopmentCost);
  const baseRate = rateBasisPoints ?? 0;
  const designRate = designRateBasisPoints ?? 0;

  // База базовой ставки — чек без доставки и без дизайна: дизайн оплачивается по
  // своей (обычно более высокой) ставке премии, поэтому из базы его вычитаем.
  const salaryBase = Math.max(0, totalOrder - deliveryCost - design);

  const basePart = Math.round((salaryBase * baseRate) / 10_000);
  const designPart = Math.round((design * designRate) / 10_000);
  const salaryAmount = basePart + designPart;

  return {
    salaryBase,
    rateBasisPoints: baseRate,
    designBase: design,
    designRateBasisPoints: designRate,
    salaryAmount,
    status: salaryAmount === 0 ? 'SETTLED' : 'PENDING',
  };
}
