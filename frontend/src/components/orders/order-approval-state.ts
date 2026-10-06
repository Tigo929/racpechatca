import type { ApprovalBrief } from '../../types/index';

/**
 * Состояние листа согласования — одной подписью в списке заказов.
 *
 * Статус заказа переключается на «На согласовании» только после того, как
 * Telegram подтвердит доставку листа клиенту. До этого момента заказ с
 * готовым, но не отправленным листом выглядит в списке как любой новый, а
 * неудачная отправка не видна вообще. И то и другое находилось, только если
 * открыть заказ — то есть перебором.
 *
 * Поэтому в списке появляется вторая, более мелкая подпись: не «где заказ по
 * процессу» (это статус), а «что сейчас с макетом». Два разных вопроса — две
 * разные подписи, иначе одна начинает врать про другую.
 */

export interface ApprovalChipView {
  label: string;
  /** Готовые классы Tailwind: собирать их на месте нельзя. */
  className: string;
  /** Подсказка при наведении — что делать с этим состоянием. */
  title: string;
  /** Требует действия от нас, а не от клиента. */
  needsAction: boolean;
}

const CHIP: Record<string, ApprovalChipView> = {
  DRAFT: {
    label: 'макет в работе',
    className: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200/60',
    title: 'Лист согласования начат, но не сформирован',
    needsAction: false,
  },
  READY: {
    label: 'лист не отправлен',
    className: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300/60',
    title: 'Лист сформирован, но клиенту не ушёл — отправьте его',
    needsAction: true,
  },
  SENDING: {
    label: 'лист отправляется',
    className: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/60',
    title: 'Лист передан боту и уходит клиенту',
    needsAction: false,
  },
  ON_REVIEW: {
    label: 'ждём ответа клиента',
    className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300/60',
    title: 'Лист у клиента — ждём «Согласовано» или правки',
    needsAction: false,
  },
  FAILED: {
    label: 'лист не доставлен',
    className: 'bg-red-100 text-red-700 ring-1 ring-red-300/60',
    title: 'Telegram не доставил лист — отправьте заново',
    needsAction: true,
  },
  APPROVED: {
    label: 'макет согласован',
    className: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60',
    title: 'Клиент подтвердил макет — печатаем именно этот',
    needsAction: false,
  },
  CHANGES: {
    label: 'правки от клиента',
    className: 'bg-rose-100 text-rose-700 ring-1 ring-rose-300/60',
    title: 'Клиент попросил переделать — нужна новая версия',
    needsAction: true,
  },
};

/**
 * Что показать по последней версии листа. `null` — у заказа листа нет
 * вовсе, и подпись не нужна: пустое место честнее слова «нет».
 */
export function approvalChip(
  approvals?: readonly ApprovalBrief[] | null,
): ApprovalChipView | null {
  const latest = approvals?.[0];
  if (!latest) return null;

  switch (latest.status) {
    case 'APPROVED':
      return CHIP.APPROVED;
    case 'CHANGES_REQUESTED':
      return CHIP.CHANGES;
    case 'SENT': {
      /*
       * «Ушёл клиенту» — по словам самого листа. Но дошёл ли он, знает
       * только доставка: провал здесь важнее всего остального, потому что
       * клиент при этом не ждёт ответа — он вообще ничего не получил.
       */
      const delivery = latest.telegramDelivery?.status;
      if (delivery === 'FAILED') return CHIP.FAILED;
      if (delivery === 'PENDING' || delivery === 'SENDING') return CHIP.SENDING;
      return CHIP.ON_REVIEW;
    }
    case 'READY':
      // Лист сформирован, но отправки не было: действие за нами.
      return latest.telegramDelivery?.status === 'FAILED'
        ? CHIP.FAILED
        : CHIP.READY;
    default:
      return CHIP.DRAFT;
  }
}
