import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';

/**
 * Что можно менять у карточки из сетки проверки.
 *
 * FINALIZED здесь нет намеренно: этот статус ставит только финальный рендер,
 * когда файл действительно собран и прошёл проверку требований Ozon.
 * Разрешить его руками значило бы получить «готовые» карточки без файлов.
 */
export const CARD_MANUAL_STATUSES = [
  'GENERATED',
  'REVIEW_REQUIRED',
  'APPROVED',
  'SKIPPED',
] as const;

export type CardManualStatus = (typeof CARD_MANUAL_STATUSES)[number];

export class DtoUpdateImageCard {
  @IsOptional()
  @IsIn(CARD_MANUAL_STATUSES)
  status?: CardManualStatus;

  /** Положение принта: { x, y, scale, rotation } в долях области. */
  @IsOptional()
  @IsObject()
  transform?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  removeWhiteBackground?: boolean;
}
