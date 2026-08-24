import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';

/** Что можно сделать с отмеченными карточками разом. */
export const BULK_ACTIONS = [
  'APPROVE',
  'SKIP',
  'UNSKIP',
  'CENTER',
  'REGENERATE',
] as const;

export type BulkAction = (typeof BULK_ACTIONS)[number];

export class DtoBulkCards {
  @IsArray()
  @ArrayNotEmpty()
  // Потолок на запрос: пачка ограничена тремя сотнями исходников, то есть
  // шестью сотнями карточек. Одним запросом больше и не понадобится.
  @ArrayMaxSize(600)
  @IsUUID(undefined, { each: true })
  ids!: string[];

  @IsIn(BULK_ACTIONS)
  action!: BulkAction;
}
