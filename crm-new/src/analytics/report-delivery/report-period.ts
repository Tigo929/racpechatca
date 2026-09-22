import { BadRequestException } from '@nestjs/common';
import {
  addDays,
  calendarDateIn,
  isIsoDate,
} from '../../metrika/analytics/metrika-dates';

/**
 * Период отчёта, заказанного из панели (этап 16).
 *
 * Правила те же, что у генератора этапа 15, просто теперь их задаёт человек
 * в форме, а значит их нужно проверять: текущий неполный московский день в
 * период не входит никогда, конец не бывает в будущем, а произвольный отрезок
 * ограничен годом — иначе один клик закажет отчёт на всю историю.
 */

export const MAX_CUSTOM_DAYS = 366;
export type PeriodType = 'preset7d' | 'preset30d' | 'custom';

export interface ResolvedPeriod {
  periodType: PeriodType;
  from: string;
  to: string;
  days: number;
}

export interface PeriodRequest {
  preset?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Последний полностью завершённый московский день. */
export function lastCompleteDay(now: Date = new Date()): string {
  return addDays(calendarDateIn(now), -1);
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function resolvePeriod(
  request: PeriodRequest,
  now: Date = new Date(),
): ResolvedPeriod {
  const last = lastCompleteDay(now);

  if (request.preset) {
    const days =
      request.preset === '7d' ? 7 : request.preset === '30d' ? 30 : 0;
    if (!days) {
      throw new BadRequestException(
        'Неизвестный период. Доступны 7d, 30d или свои даты.',
      );
    }
    return {
      periodType: days === 7 ? 'preset7d' : 'preset30d',
      from: addDays(last, -(days - 1)),
      to: last,
      days,
    };
  }

  const { dateFrom, dateTo } = request;
  if (!dateFrom || !dateTo) {
    throw new BadRequestException(
      'Укажите период: 7d, 30d или обе даты в формате ГГГГ-ММ-ДД.',
    );
  }
  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    throw new BadRequestException('Даты должны быть в формате ГГГГ-ММ-ДД.');
  }
  if (dateFrom > dateTo) {
    throw new BadRequestException('Начало периода позже его конца.');
  }
  if (dateTo > last) {
    throw new BadRequestException(
      `Период не может заканчиваться позже ${last}: текущий день ещё не закончился.`,
    );
  }
  const days = daysBetweenInclusive(dateFrom, dateTo);
  if (days > MAX_CUSTOM_DAYS) {
    throw new BadRequestException(
      `Период не длиннее ${MAX_CUSTOM_DAYS} дней; запрошено ${days}.`,
    );
  }
  return { periodType: 'custom', from: dateFrom, to: dateTo, days };
}

/** Человеческая подпись периода для интерфейса и имени файла. */
export function describe(period: { from: string; to: string }): string {
  const d = (iso: string) => iso.split('-').reverse().join('.');
  return `${d(period.from)}–${d(period.to)}`;
}
