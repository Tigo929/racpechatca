import { IsEnum } from 'class-validator';
import { EnumStatus } from 'src/generated/prisma/enums';

export default class UpdateStatus {
  @IsEnum(EnumStatus)
  status!: EnumStatus;
}
