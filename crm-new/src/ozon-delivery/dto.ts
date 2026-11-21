import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DtoParcel {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(35000)
  weightG?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  lengthMm?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  widthMm?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  heightMm?: number;
}

export class DtoCreateShipment {
  @IsOptional() @ValidateNested() @Type(() => DtoParcel) parcel?: DtoParcel;
}

export class DtoSetDelivery {
  /** Номер пункта Ozon: id («5627») или «56-27». Пустая строка — убрать. */
  @IsOptional() @IsString() @MaxLength(40) pickupPoint?: string;
  @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(40) recipientPhone?: string;
}

export class DtoBulkLabels {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];
}
