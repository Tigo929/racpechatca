/**
 * Куда проставлять остаток после публикации карточки.
 *
 * Раньше склад не выбирался вовсе: брался первый из ответа площадки.
 * У продавца с несколькими складами товар оказывался доступен только
 * в одном городе, и объяснения этому в интерфейсе не было — настройки
 * складов там просто не существовало.
 *
 * Правила собраны здесь и без обращения к базе: остаток на чужом или
 * закрытом складе — это товар, который нельзя купить, и такую ошибку
 * надо ловить тестом, а не на живом кабинете.
 */

/** Склад из нашего снимка кабинета — ровно те поля, что решают выбор. */
export interface WarehouseState {
  warehouseId: number;
  name: string;
  isEditable: boolean;
  disabledReason: string | null;
  archived: boolean;
}

export interface WarehouseChoice {
  /** Склады, на которые пишем остаток. */
  targets: number[];
  /**
   * Что не так с выбором — показываем рядом с настройкой и пишем в журнал.
   * Пустой массив значит «выбор исполним целиком».
   */
  warnings: string[];
  /**
   * Выбор пуст, и мы вернулись к прежнему поведению. Отдельным признаком,
   * а не догадкой по длине списка: сообщение об этом должно отличаться от
   * «вы выбрали склад, но он закрыт».
   */
  usedFallback: boolean;
}

/**
 * Разбор выбора продавца против нынешнего состояния кабинета.
 *
 * @param selected warehouse_id, отмеченные в шаблоне
 * @param known    склады из снимка кабинета
 */
export function resolveDefaultWarehouses(
  selected: number[],
  known: WarehouseState[],
): WarehouseChoice {
  const byId = new Map(known.map((w) => [w.warehouseId, w]));
  const usable = (w: WarehouseState) => w.isEditable && !w.archived;

  if (selected.length === 0) {
    // Пустой выбор — прежнее поведение: первый рабочий склад. Считать
    // пустоту за «все склады» нельзя: у продавца, который настройку
    // не открывал, остаток внезапно уехал бы на все точки сразу.
    const first = known.find(usable);
    return {
      targets: first ? [first.warehouseId] : [],
      warnings: first
        ? []
        : ['В кабинете не видно ни одного склада, на который можно писать остаток.'],
      usedFallback: true,
    };
  }

  const targets: number[] = [];
  const warnings: string[] = [];

  for (const id of selected) {
    const warehouse = byId.get(id);
    if (!warehouse) {
      // Склад удалён из кабинета: строку в снимке мы храним ради истории,
      // но в новых публикациях не используем (ТЗ §14).
      warnings.push(`Склад ${id} больше не виден в кабинете — остаток на него не пойдёт.`);
      continue;
    }
    if (warehouse.archived) {
      warnings.push(`Склад «${warehouse.name}» удалён в кабинете — остаток на него не пойдёт.`);
      continue;
    }
    if (!warehouse.isEditable) {
      const why = warehouse.disabledReason ?? 'площадка не разрешает запись';
      warnings.push(`Склад «${warehouse.name}» недоступен: ${why}.`);
      continue;
    }
    targets.push(warehouse.warehouseId);
  }

  // Один и тот же склад, отмеченный дважды, — это один склад: повтор
  // означал бы две записи остатка подряд, вторая перебила бы первую.
  const unique = [...new Set(targets)];

  if (unique.length === 0 && selected.length > 0) {
    warnings.push('Ни один выбранный склад не доступен — остаток не проставлен.');
  }

  return { targets: unique, warnings, usedFallback: false };
}
