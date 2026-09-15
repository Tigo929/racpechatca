import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AUDIENCE_DIMENSIONS,
  CHANGE_STATUSES,
  CHANGE_TYPES,
  EXPECTED_DIRECTIONS,
  type AudienceDimension,
  type ChangeStatus,
  type ChangeType,
  type ExpectedDirection,
  type GrowthMetricKey,
} from '../growth-contract';
import { GROWTH_METRIC_KEYS } from '../growth-metrics';
import { EVALUATION_DAYS_OPTIONS } from '../growth-rules';

/**
 * DTO реестра изменений (этап 11, раздел 20). Глобальный ValidationPipe
 * (whitelist + forbidNonWhitelisted) отсекает лишние поля — PII сюда не
 * попадёт даже случайно; аудитория ограничена одобренными измерениями.
 */

export class AudienceDefinitionDto {
  @IsIn([...AUDIENCE_DIMENSIONS])
  dimension!: AudienceDimension;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  values!: string[];
}

export class CreateChangeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn([...CHANGE_STATUSES])
  status?: ChangeStatus;

  @IsIn([...CHANGE_TYPES])
  changeType!: ChangeType;

  @IsISO8601()
  startedAt!: string;

  @IsOptional()
  @IsISO8601()
  endedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deploymentRef?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  surface!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceDefinitionDto)
  audienceDefinition?: AudienceDefinitionDto | null;

  @IsIn(GROWTH_METRIC_KEYS)
  primaryMetric!: GrowthMetricKey;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(GROWTH_METRIC_KEYS, { each: true })
  secondaryMetrics?: GrowthMetricKey[];

  @IsIn([...EXPECTED_DIRECTIONS])
  expectedDirection!: ExpectedDirection;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  hypothesis?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  maturityDays?: number | null;

  @IsOptional()
  @IsIn([...EVALUATION_DAYS_OPTIONS])
  evaluationDays?: number | null;
}

export class UpdateChangeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn([...CHANGE_STATUSES])
  status?: ChangeStatus;

  @IsOptional()
  @IsIn([...CHANGE_TYPES])
  changeType?: ChangeType;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @IsOptional()
  @IsISO8601()
  endedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deploymentRef?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  surface?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceDefinitionDto)
  audienceDefinition?: AudienceDefinitionDto | null;

  @IsOptional()
  @IsIn(GROWTH_METRIC_KEYS)
  primaryMetric?: GrowthMetricKey;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(GROWTH_METRIC_KEYS, { each: true })
  secondaryMetrics?: GrowthMetricKey[];

  @IsOptional()
  @IsIn([...EXPECTED_DIRECTIONS])
  expectedDirection?: ExpectedDirection;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  hypothesis?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  maturityDays?: number | null;

  @IsOptional()
  @IsIn([...EVALUATION_DAYS_OPTIONS])
  evaluationDays?: number | null;
}
