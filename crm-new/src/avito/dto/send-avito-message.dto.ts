import { IsString, MaxLength, MinLength } from 'class-validator';

export class DtoSendAvitoMessage {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;
}
