import { IsString } from 'class-validator';

export class DtoPartnerStatus {
  // Код статуса из словаря партнёра: in_progress | ready.
  @IsString()
  status!: string;
}
