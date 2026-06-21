import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { EnumPrintLocation, EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoCreateTshirtItem {
  @IsString()
  color!: string;

  @IsEnum(EnumTshirtSize)
  size!: EnumTshirtSize;

  @IsEnum(EnumPrintLocation)
  printLocation!: EnumPrintLocation;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  designCost?: number;

  @IsOptional()
  @IsString()
  designUrl?: string;

  @IsOptional()
  @IsString()
  designNote?: string;

  @IsOptional()
  @IsBoolean()
  clientItem?: boolean;
}
