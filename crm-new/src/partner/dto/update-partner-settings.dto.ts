import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DtoUpdatePartnerSettings {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  thermalTransferCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  blankTshirtCost?: number;

  // Ставка партнёра в сотых процента: 3000 = 30%. Ограничиваем 0–100%.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  partnerRateBasisPoints?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  partnerName?: string;
}
