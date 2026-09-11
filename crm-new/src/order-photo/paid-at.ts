import { EnumStatus } from 'src/generated/prisma/enums';

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
 * Возвращает поле для `data` в `update`, либо пустой объект — так вызов
 * раскладывается спредом рядом с `sentAt`/`completedAt` в том же стиле.
 */
export function clientPaidAtPatch(input: {
  current: Date | null | undefined;
  next: EnumStatus;
  now?: Date;
}): { clientPaidAt: Date } | Record<string, never> {
  if (input.next !== EnumStatus.PAID) return {};
  if (input.current) return {};
  return { clientPaidAt: input.now ?? new Date() };
}
