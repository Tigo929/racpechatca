import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Где на Яндекс.Диске лежат фотографии заказа.
 *
 * Номера заказа здесь нет: сайт его не знает, он спрашивает его у нас по
 * номеру папки загрузки.
 */
export class DtoPhotosFolder {
  @IsUUID()
  uploadId: string;

  /** Путь на Диске: /1Распечатка/…/20261024-301. */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  folder: string;
}

/** Запрос «как называется заказ этой папки». */
export class DtoPhotosOrderNumber {
  @IsUUID()
  uploadId: string;
}
