import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Заказ отчёта из панели (этап 16): либо пресет, либо свои даты.
 * Проверка сочетаний и границ периода — в report-period.ts, чтобы правила
 * лежали в одном месте и для API, и для командной строки.
 */
export default class CreateReportDto {
  @IsOptional()
  @IsIn(['7d', '30d'], { message: 'Доступны периоды 7d и 30d или свои даты.' })
  preset?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
