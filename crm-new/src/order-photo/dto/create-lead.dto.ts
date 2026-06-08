import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EnumProductCategory } from 'src/generated/prisma/enums';

/**
 * Заявка с лендинга (публичная, без авторизации).
 * Превращается в заказ со статусом LEAD, который видит администратор в CRM.
 */
export class DtoCreateLead {
  @IsString()
  @MinLength(2, { message: 'Укажите имя' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(5, { message: 'Укажите телефон' })
  @MaxLength(40)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(EnumProductCategory)
  productCategory?: EnumProductCategory;
}
