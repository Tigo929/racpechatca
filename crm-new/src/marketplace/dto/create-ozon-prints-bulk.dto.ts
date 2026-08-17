import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { DtoCreateOzonPrint } from './create-ozon-print.dto';

export class DtoCreateOzonPrintsBulk {
  @IsArray()
  @ArrayNotEmpty({ message: 'Добавьте хотя бы один принт.' })
  @ArrayMinSize(1)
  @ArrayMaxSize(200, {
    message: 'За один раз можно создать не больше 200 принтов.',
  })
  @Type(() => DtoCreateOzonPrint)
  @ValidateNested({ each: true })
  prints!: DtoCreateOzonPrint[];
}
