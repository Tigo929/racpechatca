import { MARKETPLACE_TSHIRT_STATUS_LABELS } from '../../constants';
import { statusStripe, statusStyle } from '../ui/StatusBadge';
import type { EnumApprovalStatus, EnumStatus } from '../../types/index';

/**
 * Где отправление в нашем процессе — одной подписью в списке.
 *
 * В списке стоял статус площадки, и у всех собранных заказов он один:
 * «Ждёт отгрузки». Для Ozon этого хватает, для работы — нет: по такому
 * столбцу не видно, у какого заказа макет ещё не делали, какой ушёл клиенту
 * на согласование, а какой уже у печатника. Владелец читал один и тот же
 * текст двадцать раз подряд и всё равно открывал заказы по одному.
 *
 * Поэтому столбец показывает наш этап: не заведён → новый → на согласовании →
 * согласован → передан в производство → … → отгружен. Статус площадки
 * остаётся второй строкой, мелким: сроки отгрузки ведёт она.
 *
 * Подписи и цвета берутся оттуда же, откуда их берёт общий список заказов:
 * один и тот же этап не должен называться по-разному на двух экранах.
 */

/** Заказ CRM, заведённый по отправлению. */
export interface MarketplaceCrmOrder {
  id: string;
  numberOrder: string;
  status: EnumStatus;
  /** Последняя версия листа согласования; null — листа ещё нет. */
  approvalStatus: EnumApprovalStatus | null;
}

/**
 * Ключ этапа — по нему работает фильтр. Это не статус заказа: «Не заведён»
 * и «Согласован» статусами не являются вовсе.
 */
export type MarketplaceStageKey =
  | 'NOT_CREATED'
  | 'NEW'
  | 'APPROVAL_SENT'
  | 'APPROVED'
  | 'SENT'
  | 'IN_PROGRESS'
  | 'READY'
  | 'SHIPMENT_CREATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OTHER';

export interface MarketplaceStage {
  key: MarketplaceStageKey;
  label: string;
  /** Подложка значка — готовые классы Tailwind. */
  chip: string;
  /** Полоса слева у строки: тот же смысл, тот же цвет. */
  stripe: string;
}

/**
 * Отправление есть, заказа нет: работать по нему ещё не начинали. Это не
 * «новый заказ», а «его вообще нет в CRM», и путать эти два состояния
 * нельзя — из первого печатник не получит ничего.
 */
const NOT_CREATED: MarketplaceStage = {
  key: 'NOT_CREATED',
  label: 'Не заведён',
  chip: 'bg-gray-100 text-gray-500',
  stripe: 'border-l-gray-300',
};

/**
 * «Согласован» — ответ клиента по макету, а не статус заказа, поэтому
 * своего цвета в палитре статусов у него нет. Бирюзовый свободен: оплаты
 * у маркетплейсных заказов не бывает, а он закреплён за ней.
 */
const APPROVED: MarketplaceStage = {
  key: 'APPROVED',
  label: 'Согласован',
  chip: 'bg-teal-50 text-teal-700',
  stripe: 'border-l-teal-500',
};

/** Статусы до производства: на них ответ по макету ещё меняет картину. */
const BEFORE_PRODUCTION: EnumStatus[] = ['LEAD', 'NEW', 'APPROVAL_SENT'];

/**
 * Этапы, у которых есть свой фильтр. Остальные статусы (унаследованные,
 * «Проблема») попадают в OTHER: заводить им по кнопке незачем, а терять
 * такие заказы из списка нельзя.
 */
const FILTERABLE: EnumStatus[] = [
  'NEW',
  'APPROVAL_SENT',
  'SENT',
  'IN_PROGRESS',
  'READY',
  'SHIPMENT_CREATED',
  'COMPLETED',
  'CANCELLED',
];

function byStatus(status: EnumStatus): MarketplaceStage {
  const style = statusStyle(status);
  return {
    key: FILTERABLE.includes(status)
      ? (status as MarketplaceStageKey)
      : 'OTHER',
    label: MARKETPLACE_TSHIRT_STATUS_LABELS[status] ?? status,
    chip: `${style.bg} ${style.text}`,
    stripe: statusStripe(status),
  };
}

/**
 * Порядок этапов в полосе фильтров — порядок работы, а не алфавит:
 * сверху вниз по нему заказ и движется. Так понятно, где начало очереди,
 * а где её конец.
 */
export const STAGE_ORDER: MarketplaceStageKey[] = [
  'NOT_CREATED',
  'NEW',
  'APPROVAL_SENT',
  'APPROVED',
  'SENT',
  'IN_PROGRESS',
  'READY',
  'SHIPMENT_CREATED',
  'COMPLETED',
  'CANCELLED',
  'OTHER',
];

/**
 * Сколько отправлений на каждом этапе — для полосы фильтров.
 *
 * Показываем только те этапы, которые в выборке есть: пустая кнопка
 * «Готов — 0» занимает место и ничего не говорит. Порядок — рабочий.
 */
export function stageCounts<T extends { crm?: MarketplaceCrmOrder | null }>(
  orders: readonly T[],
): { key: MarketplaceStageKey; label: string; count: number }[] {
  const counted = new Map<MarketplaceStageKey, { label: string; count: number }>();
  for (const order of orders) {
    const stage = marketplaceStage(order.crm);
    const seen = counted.get(stage.key);
    if (seen) seen.count += 1;
    else counted.set(stage.key, { label: stage.label, count: 1 });
  }
  return STAGE_ORDER.filter((key) => counted.has(key)).map((key) => ({
    key,
    label: counted.get(key)!.label,
    count: counted.get(key)!.count,
  }));
}

export function marketplaceStage(
  crm: MarketplaceCrmOrder | null | undefined,
): MarketplaceStage {
  if (!crm) return NOT_CREATED;

  /*
   * «Согласован» живёт между «на согласовании» и «передан в производство»,
   * но собственного статуса у него нет: клиент отвечает по листу, а не по
   * заказу. Поэтому ответ по макету перебивает статус — но только до
   * производства: дальше заказ двигают руками, и его статус точнее.
   *
   * Просьба о правках сюда не попадает намеренно: лист ушёл, ответа «да»
   * нет, работа не двинулась — для списка это по-прежнему «на согласовании».
   */
  if (
    crm.approvalStatus === 'APPROVED' &&
    BEFORE_PRODUCTION.includes(crm.status)
  ) {
    return APPROVED;
  }
  // Обращение — это ещё не заказ в работе, но в CRM он уже заведён.
  if (crm.status === 'LEAD') return byStatus('NEW');
  return byStatus(crm.status);
}
