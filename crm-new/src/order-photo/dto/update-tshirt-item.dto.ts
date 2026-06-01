import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  EnumPrintLocation,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';

export class DtoUpdateTshirtItem {
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsEnum(EnumTshirtSize) size?: EnumTshirtSize;
  @IsOptional() @IsEnum(EnumPrintLocation) printLocation?: EnumPrintLocation;
  @IsOptional() @IsNumber() @Type(() => Number) @Min(1) quantity?: number;
  @IsOptional() @IsNumber() @Type(() => Number) @Min(0) price?: number;
  @IsOptional() @IsNumber() @Type(() => Number) @Min(0) designCost?: number;
  @IsOptional() @IsString() designUrl?: string;
  @IsOptional() @IsString() designNote?: string;
}
