import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EnumApprovalStatus, EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoUpdateApproval {
  @IsOptional()
  @IsString()
  shirtColor?: string;

  @IsOptional()
  @IsEnum(EnumTshirtSize)
  shirtSize?: EnumTshirtSize;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  /**
   * Размещение принтов по сторонам. Приходит объектом целиком и разбирается
   * функцией parseSides: она отбрасывает всё, чего не знает, и удерживает
   * значения в разумных пределах. Разбор вручную, а не вложенным DTO, потому
   * что состояние редактора должно уметь пережить смену своей формы — старое
   * согласование обязано открыться и после доработок модуля.
   */
  @IsOptional()
  @IsObject()
  sides?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(EnumApprovalStatus)
  status?: EnumApprovalStatus;
}
