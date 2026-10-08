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

export interface MarketplaceStage {
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
  label: 'Согласован',
  chip: 'bg-teal-50 text-teal-700',
  stripe: 'border-l-teal-500',
};

/** Статусы до производства: на них ответ по макету ещё меняет картину. */
const BEFORE_PRODUCTION: EnumStatus[] = ['LEAD', 'NEW', 'APPROVAL_SENT'];

function byStatus(status: EnumStatus): MarketplaceStage {
  const style = statusStyle(status);
  return {
    label: MARKETPLACE_TSHIRT_STATUS_LABELS[status] ?? status,
    chip: `${style.bg} ${style.text}`,
    stripe: statusStripe(status),
  };
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
