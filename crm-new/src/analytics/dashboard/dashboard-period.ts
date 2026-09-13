import { BadRequestException } from '@nestjs/common';
import { isIsoDate } from '../../metrika/analytics/metrika-dates';
import {
  customPeriod,
  isPeriodPreset,
  periodFromPreset,
  type AnalyticsPeriod,
} from '../metrics/analytics-period';

/**
 * Период из query дашборда (этап 09, раздел 5): либо пресет, либо
 * произвольные даты `from`/`to` (YYYY-MM-DD, Europe/Moscow). Произвольный
 * период ограничен, чтобы одна ссылка не вычитывала годы истории.
 */
export const MAX_CUSTOM_DAYS = 366;

export interface PeriodQuery {
  preset?: string;
  from?: string;
  to?: string;
}

export function periodFromQuery(
  q: PeriodQuery,
  now: Date = new Date(),
): AnalyticsPeriod {
  if (q.preset) {
    if (!isPeriodPreset(q.preset)) {
      throw new BadRequestException(`Неизвестный период: ${q.preset}`);
    }
    return periodFromPreset(q.preset, now);
  }
  if (q.from && q.to) {
    if (!isIsoDate(q.from) || !isIsoDate(q.to) || q.from > q.to) {
      throw new BadRequestException(
        'Даты периода должны быть в формате YYYY-MM-DD, начало не позже конца',
      );
    }
    const period = customPeriod(q.from, q.to);
    const days =
      (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) /
        86_400_000 +
      1;
    if (days > MAX_CUSTOM_DAYS) {
      throw new BadRequestException(`Период не больше ${MAX_CUSTOM_DAYS} дней`);
    }
    return period;
  }
  return periodFromPreset('last_7_days', now);
}
