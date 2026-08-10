import { BadRequestException } from '@nestjs/common';
import type { EnumAccrualStatus } from 'src/generated/prisma/enums';

export interface SalarySnapshot {
  salaryBase: number;
  rateBasisPoints: number;
  salaryAmount: number;
  status: EnumAccrualStatus;
}

/**
 * Зарплата исполнителя за заказ: процент от чека без доставки и без платы
 * за срочность. Срочность — плата клиента за скорость, а не за продукцию,
 * поэтому в базу зарплаты она не входит (решение владельца).
 */
export function calculateSalarySnapshot(
  totalOrder: number,
  deliveryCost: number,
  rateBasisPoints: number | null,
  urgencyFee = 0,
): SalarySnapshot {
  const urgency = Math.max(0, urgencyFee);
  const salaryBase = totalOrder - deliveryCost - urgency;
  if (salaryBase < 0) {
    throw new BadRequestException(
      'Доставка и срочность не могут превышать общий чек заказа',
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
  /** База базовой ставки = чек − доставка − дизайн − срочность (не в минус). */
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
  urgencyFee = 0,
): ManagerSalarySnapshot {
  const design = Math.max(0, designDevelopmentCost);
  const urgency = Math.max(0, urgencyFee);
  const baseRate = rateBasisPoints ?? 0;
  const designRate = designRateBasisPoints ?? 0;

  // База базовой ставки — чек без доставки, дизайна и срочности: дизайн
  // оплачивается по своей (обычно более высокой) ставке премии, а срочность —
  // плата за скорость, она целиком остаётся владельцу.
  const salaryBase = Math.max(0, totalOrder - deliveryCost - design - urgency);

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
