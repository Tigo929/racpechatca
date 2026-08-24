import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoCreateApproval {
  @IsUUID()
  orderId!: string;

  /** Цвет футболки строкой, как в позициях заказа: «Чёрный», «Белый». */
  @IsString()
  shirtColor!: string;

  @IsEnum(EnumTshirtSize)
  shirtSize!: EnumTshirtSize;

  /**
   * Версия, с которой копируется размещение принтов. Так делается «v2 после
   * правок клиента»: сотрудник не собирает макет заново, а поправляет прошлый.
   * Файлы принтов при этом переиспользуются — копия ссылается на те же.
   */
  @IsOptional()
  @IsUUID()
  copyFromId?: string;
}
