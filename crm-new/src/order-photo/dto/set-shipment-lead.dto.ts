import { IsOptional, IsString, ValidateIf } from 'class-validator';

/** Назначение «старшего дня» по отгрузкам. userId=null — снять назначение. */
export class DtoSetShipmentLead {
  // null допустим (снять старшего). ValidateIf пропускает null мимо IsString.
  @ValidateIf((o: DtoSetShipmentLead) => o.userId !== null)
  @IsString()
  @IsOptional()
  userId!: string | null;
}
