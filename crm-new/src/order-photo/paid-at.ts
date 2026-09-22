import { BadRequestException } from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { MOSCOW_OFFSET_MINUTES } from 'src/analytics/metrics/analytics-period';
import {
  calendarDateIn,
  isIsoDate,
  isoToUtcDate,
} from 'src/metrika/analytics/metrika-dates';

/**
 * Дата первой оплаты заказа.
 *
 * `clientPaidAt` — момент, когда заказ впервые стал «Оплачен». Поле было
 * в схеме с июня 2026, но не заполнялось ни одним сервисом: отчёты читали
 * его, получали null и падали на `statusChangedAt`, который дёргается
 * каждой сменой статуса. Для аналитики нужна именно первая оплата:
 * по ней считается срок «от заявки до денег» и месяц признания выручки.
 *
 * Правило одно: ставим при переходе в PAID, если ещё не стояла, и больше
 * не трогаем. Вернули заказ в работу и оплатили снова — дата первой
 * оплаты остаётся: деньги в первый раз пришли тогда, а не сейчас.
 *
 * Работа D1 (22.09.2026). Аудит показал, что правило закрывало только один
 * из двух путей в PAID. Второй — автоперевод при выплате зарплаты
 * исполнителю (`SalaryService.createPaymentByAccruals`): 16.09 одна выплата
 * перевела 40 заказов в PAID за две секунды, а медиана отставания от
 * отгрузки — неделя. **Расчёт с исполнителем не является датой оплаты
 * клиентом**, поэтому там дата не ставится вовсе: пусто значит «неизвестно»,
 * и человек указывает её отдельным действием, когда знает.
 *
 * Возвращает поле для `data` в `update`, либо пустой объект — так вызов
 * раскладывается спредом рядом с `sentAt`/`completedAt` в том же стиле.
 */
export function clientPaidAtPatch(input: {
  current: Date | null | undefined;
  next: EnumStatus;
  /** Фактическая дата оплаты, если её указал сотрудник. */
  explicit?: Date | null;
  now?: Date;
}): { clientPaidAt: Date } | Record<string, never> {
  if (input.next !== EnumStatus.PAID) return {};
  if (input.current) return {};
  return { clientPaidAt: input.explicit ?? input.now ?? new Date() };
}

/**
 * Разбор фактической даты оплаты, введённой человеком.
 *
 * Принимаем два вида значения и оба приводим к одному смыслу — московскому
 * календарному дню, потому что именно по нему режут периоды отчёты
 * (`analytics-period.ts`, смещение +03:00 фиксированное):
 *
 *   «2026-09-21»                  — день без времени: берём момент начала
 *                                   этого московского дня (21:00 UTC 20-го),
 *                                   чтобы день не уехал в соседний;
 *   «2026-09-21T18:30:00.000Z»    — полный момент: сохраняем как есть.
 *
 * Границы: не в будущем и не раньше создания заказа. Обе ошибки —
 * 400 с человеческим текстом, менять чужую финансовую историю нельзя.
 */
export function parseClientPaidAt(
  value: string | Date,
  bounds: { createdAt: Date; now?: Date },
): Date {
  const now = bounds.now ?? new Date();
  let at: Date;

  if (value instanceof Date) {
    at = value;
  } else if (isIsoDate(value)) {
    // Начало московских суток: день, который ввёл человек, и есть день отчёта.
    at = new Date(
      isoToUtcDate(value).getTime() - MOSCOW_OFFSET_MINUTES * 60_000,
    );
  } else {
    at = new Date(value);
  }

  if (Number.isNaN(at.getTime())) {
    throw new BadRequestException('Дата оплаты не распознана');
  }
  if (at.getTime() > now.getTime()) {
    throw new BadRequestException('Дата оплаты не может быть в будущем');
  }
  if (at.getTime() < bounds.createdAt.getTime()) {
    throw new BadRequestException(
      `Дата оплаты не может быть раньше создания заказа (${calendarDateIn(bounds.createdAt)})`,
    );
  }
  return at;
}
