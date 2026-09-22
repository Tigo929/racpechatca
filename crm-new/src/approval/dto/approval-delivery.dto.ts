import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class ClaimApprovalDeliveryDto {
  @IsUUID()
  claimToken: string;
}

export class CompleteApprovalDeliveryDto extends ClaimApprovalDeliveryDto {
  @IsIn(['SENT', 'FAILED', 'UNKNOWN'])
  status: 'SENT' | 'FAILED' | 'UNKNOWN';

  @IsOptional()
  @IsInt()
  @Min(1)
  messageId?: number;

  @IsOptional()
  @IsIn([
    'not_found',
    'not_user',
    'privacy',
    'blocked',
    'flood',
    'file',
    'unavailable',
    'uncertain',
  ])
  errorCode?: string;
}
