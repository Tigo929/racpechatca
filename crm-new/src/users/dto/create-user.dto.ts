import { IsEnum, IsString, MinLength } from 'class-validator';
import { EnumRole } from 'src/generated/prisma/enums';

export class DtoCreateUser {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsEnum(EnumRole)
  role!: EnumRole;
}
