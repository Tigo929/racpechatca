import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushKeysDto {
  @Matches(/^[A-Za-z0-9_-]{87}=?$/)
  p256dh: string;

  @Matches(/^[A-Za-z0-9_-]{22}(?:==)?$/)
  auth: string;
}

export class PushEndpointDto {
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_tld: true,
    disallow_auth: true,
  })
  @MaxLength(2048)
  endpoint: string;
}

export class PushSubscribeDto extends PushEndpointDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;
}
