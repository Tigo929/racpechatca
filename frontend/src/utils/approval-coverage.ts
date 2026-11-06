/**
 * Все ли позиции заказа обеспечены макетом — зеркало серверного правила
 * (crm-new/src/approval/approval-coverage.ts), и ответы обязаны совпадать.
 *
 * Здесь оно нужно, чтобы человек видел состояние до нажатия: какой размер
 * ещё без макета и почему кнопка «Отправить исполнителю» закрыта. Решение
 * всё равно принимает сервер — он же и откажет, назвав ту же причину.
 */

import { TSHIRT_SIZE_LABELS } from '../constants';
import type { ItemTshirt, PrintApproval } from '../types/index';

/**
 * Где CRM отправляет макет клиенту сама. В Авито и MAX переписку ведёт
 * человек, и подтверждения отправки у системы нет.
 */
const CRM_SENDS_APPROVAL = ['TELEGRAM', 'OZON'];

export interface PositionCoverage {
  position: ItemTshirt;
  /** Лист собран: печатнику есть что дать. */
  ready: boolean;
  /** Лист ушёл клиенту или покупателю. */
  sent: boolean;
  /** Версии макета этой позиции, свежие сверху. */
  approvals: PrintApproval[];
}

/**
 * Относится ли макет к позиции.
 *
 * Пустая привязка — согласование, созданное до того, как макеты стали
 * принадлежать позициям. В заказе с единственной позицией сомнений нет;
 * в заказе с несколькими такой лист не закрывает ничего — именно там и
 * неизвестно, какой размер на нём изображён.
 */
function covers(
  approval: PrintApproval,
  position: ItemTshirt,
  positionCount: number,
): boolean {
  if (approval.itemId) return approval.itemId === position.id;
  return positionCount === 1;
}

export function approvalCoverage(
  positions: ItemTshirt[],
  approvals: PrintApproval[],
): PositionCoverage[] {
  return positions.map((position) => {
    const mine = approvals.filter((a) =>
      covers(a, position, positions.length),
    );
    return {
      position,
      ready: mine.some((a) => Boolean(a.previewFile)),
      sent: mine.some((a) => a.telegramDelivery?.status === 'SENT'),
      approvals: mine,
    };
  });
}

/** Макеты, которые ни к одной позиции не относятся. */
export function orphanApprovals(
  positions: ItemTshirt[],
  approvals: PrintApproval[],
): PrintApproval[] {
  return approvals.filter(
    (approval) =>
      !positions.some((position) =>
        covers(approval, position, positions.length),
      ),
  );
}

/** Подпись позиции: «Чёрный S(46)». */
export function positionLabel(position: ItemTshirt): string {
  return `${position.color} ${TSHIRT_SIZE_LABELS[position.size] ?? position.size}`;
}

/** Требуется ли отметка об отправке клиенту до производства. */
export function requiresClientSend(
  communicationPlatform: string,
  marketplace: boolean,
): boolean {
  return !marketplace && CRM_SENDS_APPROVAL.includes(communicationPlatform);
}

/** Что мешает отправить заказ исполнителю. Пусто — можно. */
export function dispatchBlockers(params: {
  coverage: PositionCoverage[];
  requireSent: boolean;
  techSpecCount: number;
}): string[] {
  const { coverage, requireSent, techSpecCount } = params;
  const blockers: string[] = [];

  const noSheet = coverage.filter((c) => !c.ready);
  if (noSheet.length > 0) {
    blockers.push(
      `Макет не собран: ${noSheet.map((c) => positionLabel(c.position)).join(', ')}`,
    );
  }

  if (requireSent) {
    const notSent = coverage.filter((c) => c.ready && !c.sent);
    if (notSent.length > 0) {
      blockers.push(
        `Макет не отправлен клиенту: ${notSent
          .map((c) => positionLabel(c.position))
          .join(', ')}`,
      );
    }
  }

  const needed = Math.max(1, coverage.length);
  if (techSpecCount < needed) {
    blockers.push(
      `ТЗ-файлов ${techSpecCount}, а позиций ${needed} — нужен файл на каждую`,
    );
  }

  return blockers;
}
