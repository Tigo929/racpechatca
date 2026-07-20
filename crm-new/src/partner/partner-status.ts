import { EnumStatus } from 'src/generated/prisma/enums';

/**
 * Статусы футболочного заказа — общий словарь для нас и партнёра.
 * Внутри используем существующий EnumStatus, наружу отдаём короткие коды.
 *
 *   новый     → NEW
 *   отправлен → SENT        (мы передали заказ партнёру)
 *   в работе  → IN_PROGRESS (партнёр печатает)
 *   готов     → READY       (партнёр закончил)
 *   оплачен   → PAID        (мы рассчитались с партнёром)
 */
export const TSHIRT_STATUSES: EnumStatus[] = [
  EnumStatus.NEW,
  EnumStatus.SENT,
  EnumStatus.IN_PROGRESS,
  EnumStatus.READY,
  EnumStatus.PAID,
];

const TO_PARTNER: Partial<Record<EnumStatus, string>> = {
  [EnumStatus.NEW]: 'new',
  [EnumStatus.SENT]: 'sent',
  [EnumStatus.IN_PROGRESS]: 'in_progress',
  [EnumStatus.READY]: 'ready',
  [EnumStatus.PAID]: 'paid',
};

const FROM_PARTNER: Record<string, EnumStatus> = {
  new: EnumStatus.NEW,
  sent: EnumStatus.SENT,
  in_progress: EnumStatus.IN_PROGRESS,
  ready: EnumStatus.READY,
  paid: EnumStatus.PAID,
};

/**
 * Что партнёру разрешено ставить самому: только производственные шаги.
 * «Оплачен» — это «владелец заплатил партнёру», такое партнёр за нас не
 * объявляет; «новый»/«отправлен» задаёт владелец. Иначе создание авто-расхода
 * могло бы сработать без явного действия администратора.
 */
export const PARTNER_SETTABLE_STATUSES: EnumStatus[] = [
  EnumStatus.IN_PROGRESS,
  EnumStatus.READY,
];

/** Внутренний статус → код для партнёра. Неизвестное отдаём как есть, в нижнем регистре. */
export function toPartnerStatus(status: string): string {
  return TO_PARTNER[status as EnumStatus] ?? status.toLowerCase();
}

/** Код партнёра → внутренний статус. null, если код не из словаря. */
export function fromPartnerStatus(code: string): EnumStatus | null {
  return FROM_PARTNER[code.trim().toLowerCase()] ?? null;
}
