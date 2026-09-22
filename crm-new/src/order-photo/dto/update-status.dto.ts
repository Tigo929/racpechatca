import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EnumStatus } from 'src/generated/prisma/enums';

export default class UpdateStatus {
  @IsEnum(EnumStatus)
  status!: EnumStatus;

  /**
   * Фактическая дата оплаты — только вместе со статусом PAID и только если
   * дата ещё не зафиксирована (работа D1). Принимается московский календарный
   * день «2026-09-21» или полный момент ISO; разбор и границы — в paid-at.ts.
   * Не передали — для ручного перевода действует прежнее поведение: момент
   * подтверждения.
   */
  @IsOptional()
  @IsString()
  clientPaidAt?: string;
}
