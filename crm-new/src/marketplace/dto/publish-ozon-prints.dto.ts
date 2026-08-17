import { ArrayMinSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class DtoPublishOzonPrints {
  @IsArray()
  @ArrayNotEmpty({ message: 'Выберите хотя бы один принт для публикации.' })
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  printIds!: string[];
}
