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
 * Условий два: по каждой позиции собран макет и ТЗ-файлов не меньше, чем
 * позиций. Больше ничего — в том числе отметки об отправке клиенту.
 *
 * Отправку сюда добавлять нельзя, и это выяснилось на живом заказе: ник
 * клиента вёл не на личный аккаунт, Telegram отказал (`not_user`), и обе
 * доставки остались FAILED. Макеты были собраны, файлы приложены — а заказ
 * в производство не уходил из-за того, до чего менеджеру не дотянуться.
 * Клиент при этом всё равно получает макет: человек отправляет его сам,
 * а в карточке по каждой позиции видно, дошёл ли лист.
 */
export function dispatchBlockers(params: {
  coverage: readonly PositionCoverage[];
  techSpecCount: number;
}): string[] {
  const { coverage, techSpecCount } = params;
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

  /*
   * ТЗ-файлов не меньше, чем позиций.
   *
   * Исполнитель печатает по файлам из задания, и файл на каждую позицию
   * свой. Один файл на три разных размера означает, что два напечатают
   * неизвестно по чему — а узнается это на готовом изделии.
   *
   * Считаем позиции, а не футболки: «S × 3» — три одинаковые футболки по
   * одному файлу, и требовать три копии одного и того же бессмысленно.
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
  tshirtItems: CoveragePosition[];
  techSpecPhotoPath?: string | null;
  techSpecPhotoPaths?: string[] | null;
}

/** Чего не хватает заказу, чтобы уйти исполнителю. Пусто — можно. */
export function orderDispatchBlockers(
  order: CoverageOrder,
  approvals: readonly CoverageApproval[],
): string[] {
  return dispatchBlockers({
    coverage: approvalCoverage(order.tshirtItems, approvals),
    techSpecCount: getTechSpecPaths(order).length,
  });
}
