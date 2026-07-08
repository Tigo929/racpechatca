import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EnumPrintLocation, EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoUpdateTshirtItem {
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsEnum(EnumTshirtSize) size?: EnumTshirtSize;
  @IsOptional() @IsEnum(EnumPrintLocation) printLocation?: EnumPrintLocation;
  @IsOptional() @IsInt() @Type(() => Number) @Min(1) quantity?: number;
  @IsOptional() @IsInt() @Type(() => Number) @Min(0) price?: number;
  @IsOptional() @IsInt() @Type(() => Number) @Min(0) designCost?: number;
  @IsOptional() @IsString() designUrl?: string;
  @IsOptional() @IsString() designNote?: string;
  @IsOptional() @IsBoolean() clientItem?: boolean;
}
