import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  INSIGHT_CATEGORIES,
  INSIGHT_SEVERITIES,
  INSIGHT_STATUSES,
  type InsightCategory,
  type InsightSeverity,
  type InsightStatus,
} from '../insights-contract';

/** Ручное закрытие сигнала — только с причиной (попадает в resolvedReason). */
export class ResolveInsightDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

/** Фильтры ленты — все необязательные, только из словарей контракта. */
export class FeedQueryDto {
  @IsOptional()
  @IsIn(['active', 'all', ...INSIGHT_STATUSES])
  status?: 'active' | 'all' | InsightStatus;

  @IsOptional()
  @IsIn([...INSIGHT_SEVERITIES])
  severity?: InsightSeverity;

  @IsOptional()
  @IsIn([...INSIGHT_CATEGORIES])
  category?: InsightCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
