import { IsString, MaxLength } from 'class-validator';

export class DtoDetectProduct {
  /** Название объявления Авито + текст обращения — по ним и определяем продукт. */
  @IsString()
  @MaxLength(4000)
  text!: string;
}
