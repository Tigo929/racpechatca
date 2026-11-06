/**
 * Все ли позиции заказа обеспечены макетом.
 *
 * Клиент заказывает несколько футболок разных размеров: S, M, L. Печатают
 * их по трём разным макетам — размер меняет и размер принта, и его
 * положение. Раньше согласование относилось к заказу целиком: сотрудник
 * собирал один лист, отправлял его клиенту и отдавал заказ в производство,
 * а остальные размеры уходили «как-нибудь так». Ошибку видел покупатель.
 *
 * Поэтому правило: по каждой позиции — свой макет, и пока их не столько,
 * сколько позиций, отправка исполнителю закрыта.
 *
 * Количество в позиции значения не имеет: «S × 2» — две одинаковые
 * футболки по одному макету, и второй лист печатнику ничего не добавит.
 */

import { tshirtSizeLabel } from 'src/order-photo/tshirt-size';
import { getTechSpecPaths } from 'src/partner/tech-spec-paths';
import { crmSendsApproval } from './approval-delivery-state';

/** Позиция заказа — ровно то, что нужно для проверки. */
export interface CoveragePosition {
  id: string;
  color: string;
  size: string;
  quantity: number;
}

/** Макет — тоже только то, что решает. */
export interface CoverageApproval {
  /** Позиция, к которой он привязан. null — привязки нет (см. covers). */
  itemId: string | null;
  /** Лист сформирован кнопкой «Готово». Пусто — есть только черновик. */
  previewFile: string | null;
  /** Итог отправки клиенту: 'SENT' — дошло. */
  deliveryStatus: string | null;
}

export interface PositionCoverage {
  position: CoveragePosition;
  /** Лист собран: печатнику есть что дать. */
  ready: boolean;
  /** Лист ушёл клиенту или покупателю. */
  sent: boolean;
  /** Сколько версий макета у этой позиции. */
  versions: number;
}

/**
 * Относится ли макет к позиции.
 *
 * Пустая привязка — это согласование, созданное до того, как макеты стали
 * принадлежать позициям. В заказе с единственной позицией сомнений нет:
 * относиться оно могло только к ней. В заказе с несколькими такой лист не
 * закрывает ничего — и это не строгость ради строгости: именно в таком
 * заказе и неизвестно, какой размер на нём изображён.
 */
function covers(
  approval: CoverageApproval,
  position: CoveragePosition,
  positionCount: number,
): boolean {
  if (approval.itemId) return approval.itemId === position.id;
  return positionCount === 1;
}

/** Состояние макетов по каждой позиции заказа. */
export function approvalCoverage(
  positions: readonly CoveragePosition[],
  approvals: readonly CoverageApproval[],
): PositionCoverage[] {
  return positions.map((position) => {
    const mine = approvals.filter((a) => covers(a, position, positions.length));
    return {
      position,
      ready: mine.some((a) => Boolean(a.previewFile)),
      sent: mine.some((a) => a.deliveryStatus === 'SENT'),
      versions: mine.length,
    };
  });
}

/** Подпись позиции для сообщения человеку: «Чёрный S(46)». */
export function positionLabel(position: CoveragePosition): string {
  return `${position.color} ${tshirtSizeLabel(position.size)}`;
}

/**
 * Что мешает отправить заказ исполнителю. Пустой список — можно.
 *
 * `requireSent` включается там, где макет клиенту отправляет сама CRM:
 * в Telegram и в чате Ozon. В Авито и MAX переписку ведёт человек, и
 * требовать от системы подтверждения отправки нечем — там достаточно
 * собранного листа. Заказ с площадки согласования не ждёт вовсе:
 * покупатель купил то, что на карточке.
 */
export function dispatchBlockers(params: {
  coverage: readonly PositionCoverage[];
  requireSent: boolean;
  techSpecCount: number;
}): string[] {
  const { coverage, requireSent, techSpecCount } = params;
  const blockers: string[] = [];

  const noSheet = coverage.filter((c) => !c.ready);
  if (noSheet.length > 0) {
    blockers.push(
      `Макет не собран по позициям: ${noSheet
        .map((c) => positionLabel(c.position))
        .join(', ')}. ` +
        'Соберите макет на каждую позицию и нажмите в нём «Готово».',
    );
  }

  if (requireSent) {
    const notSent = coverage.filter((c) => c.ready && !c.sent);
    if (notSent.length > 0) {
      blockers.push(
        `Макет не отправлен клиенту: ${notSent
          .map((c) => positionLabel(c.position))
          .join(', ')}. ` +
          'Производство открывается после того, как клиент увидел все макеты.',
      );
    }
  }

  /*
   * ТЗ-файлов не меньше, чем позиций.
   *
   * Исполнитель печатает по файлам из задания, и файл на каждую позицию
   * свой. Один файл на три футболки означает, что две напечатают
   * неизвестно по чему — а узнается это на готовом изделии.
   */
  const needed = Math.max(1, coverage.length);
  if (techSpecCount < needed) {
    blockers.push(
      `ТЗ-файлов ${techSpecCount}, а позиций ${needed}. ` +
        'Прикрепите файл на каждую позицию: печатник берёт из задания ровно то, что в нём есть.',
    );
  }

  return blockers;
}

/** Заказ в том виде, в каком его читает допуск в производство. */
export interface CoverageOrder {
  /** Заказ с площадки: покупатель купил то, что на карточке. */
  isMarketplacePrint: boolean;
  communicationPlatform: string | null;
  tshirtItems: CoveragePosition[];
  techSpecPhotoPath?: string | null;
  techSpecPhotoPaths?: string[] | null;
}

/**
 * Чего не хватает заказу, чтобы уйти исполнителю. Пусто — можно.
 *
 * Отправку клиенту требуем только там, где её выполняет сама CRM: Telegram
 * и чат Ozon. В Авито и MAX переписку ведёт человек, и подтверждения
 * отправки у системы нет — там достаточно собранного листа. Заказ с
 * площадки согласования не ждёт вовсе: лист нужен печатнику, а не
 * покупателю.
 */
export function orderDispatchBlockers(
  order: CoverageOrder,
  approvals: readonly CoverageApproval[],
): string[] {
  return dispatchBlockers({
    coverage: approvalCoverage(order.tshirtItems, approvals),
    requireSent:
      !order.isMarketplacePrint &&
      crmSendsApproval(order.communicationPlatform),
    techSpecCount: getTechSpecPaths(order).length,
  });
}
