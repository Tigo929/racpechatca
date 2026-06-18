import { IsBoolean } from 'class-validator';

export class DtoSetReview {
  @IsBoolean()
  reviewLeft!: boolean;
}
