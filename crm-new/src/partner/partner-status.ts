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

/**
 * Стадия производства в CRM партнёра → наш статус футболочного заказа.
 * Партнёр отдаёт production_stage: planning/queued/in_work/qc/ready/done.
 *   план              → ещё не начал, статус не двигаем (null)
 *   очередь/работа/ОТК → «В работе»
 *   готово/закрыто     → «Готов»
 */
const PARTNER_STAGE_MAP: Record<string, EnumStatus> = {
  queued: EnumStatus.IN_PROGRESS,
  in_work: EnumStatus.IN_PROGRESS,
  qc: EnumStatus.IN_PROGRESS,
  ready: EnumStatus.READY,
  done: EnumStatus.READY,
};

export function mapPartnerStage(stage: string | null | undefined): EnumStatus | null {
  if (!stage) return null;
  return PARTNER_STAGE_MAP[stage.trim().toLowerCase()] ?? null;
}

/**
 * Порядок в потоке — чтобы двигать заказ только вперёд и не перебивать
 * «Оплачен» (финальный статус владельца). Чем больше, тем дальше по процессу.
 */
const FLOW_RANK: Partial<Record<EnumStatus, number>> = {
  [EnumStatus.NEW]: 0,
  [EnumStatus.SENT]: 1,
  [EnumStatus.IN_PROGRESS]: 2,
  [EnumStatus.READY]: 3,
  [EnumStatus.PAID]: 4,
};

/** Двигаем статус к target только если это шаг ВПЕРЁД (и не из PAID). */
export function shouldAdvanceTo(
  current: EnumStatus,
  target: EnumStatus,
): boolean {
  if (current === EnumStatus.PAID) return false;
  const c = FLOW_RANK[current] ?? -1;
  const t = FLOW_RANK[target] ?? -1;
  return t > c;
}
