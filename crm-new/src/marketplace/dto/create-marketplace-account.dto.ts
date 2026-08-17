import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { EnumMarketplace } from 'src/generated/prisma/enums';

export class DtoCreateMarketplaceAccount {
  @IsEnum(EnumMarketplace, { message: 'Неизвестная площадка.' })
  marketplace!: EnumMarketplace;

  @IsString()
  @MinLength(2, { message: 'Название кабинета слишком короткое.' })
  @MaxLength(60, { message: 'Название кабинета не длиннее 60 символов.' })
  title!: string;

  /** Client-Id продавца в Ozon: числовая строка из кабинета. */
  @IsString()
  @MinLength(3, { message: 'Client-Id слишком короткий.' })
  @MaxLength(64)
  externalId!: string;

  @IsString()
  @MinLength(8, { message: 'Api-Key слишком короткий.' })
  @MaxLength(200)
  apiKey!: string;
}
