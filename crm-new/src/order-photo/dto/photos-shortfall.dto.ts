import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

/**
 * Сообщение сайта: фотографии заказа доехали не все.
 *
 * Номера заказа здесь нет намеренно — его присваивает CRM, и сайт его не
 * знает. Зато он знает номер папки, по ссылке на которую заказ и
 * находится.
 */
export class DtoPhotosShortfall {
  @IsUUID()
  uploadId: string;

  /** Сколько фотографий обещал заказ. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  expected: number;

  /** Сколько доехало на самом деле. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  arrived: number;
}
