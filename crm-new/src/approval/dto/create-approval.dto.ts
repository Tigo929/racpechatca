import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoCreateApproval {
  @IsUUID()
  orderId!: string;

  /**
   * Позиция заказа, для которой собирают макет.
   *
   * Не указана — систему просят выбрать сама: она берёт первую позицию,
   * у которой макета ещё нет (approval.service.ts, resolvePosition).
   */
  @IsOptional()
  @IsUUID()
  itemId?: string;

  /**
   * Цвет и размер футболки. Нужны только заказу без позиций футболок —
   * печати на изделии клиента. Когда позиция есть, они берутся из неё, а
   * присланное не используется: размер указывает, какой из заказанных
   * футболок этот макет, и выбирать его в браузере нельзя.
   */
  @IsOptional()
  @IsString()
  shirtColor?: string;

  @IsOptional()
  @IsEnum(EnumTshirtSize)
  shirtSize?: EnumTshirtSize;

  /**
   * Версия, с которой копируется размещение принтов. Так делается «v2 после
   * правок клиента»: сотрудник не собирает макет заново, а поправляет прошлый.
   * Файлы принтов при этом переиспользуются — копия ссылается на те же.
   */
  @IsOptional()
  @IsUUID()
  copyFromId?: string;
}
