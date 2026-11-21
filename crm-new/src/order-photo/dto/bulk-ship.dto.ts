import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { BULK_SHIP_LIMIT } from '../bulk-ship';

export class DtoBulkShip {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_SHIP_LIMIT)
  @IsUUID('all', { each: true })
  ids!: string[];
}
