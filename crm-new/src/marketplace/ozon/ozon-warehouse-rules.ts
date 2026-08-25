/**
 * Правила про склады Ozon. Чистые функции без базы и сети — проверяются
 * тестами целиком, сервис только тянет данные и зовёт их.
 */

/** Склад, как его отдаёт /v2/warehouse/list. Поля необязательные: площадка
 * добавляет и убирает их без предупреждения, и падать из-за этого нельзя. */
export interface RawWarehouse {
  warehouse_id?: number;
  name?: string;
  status?: string;
}

/** Склад в том виде, в каком его хранит и показывает CRM. */
export interface WarehouseState {
  warehouseId: number;
  name: string;
  status: string | null;
  isEditable: boolean;
  disabledReason: string | null;
}

/**
 * Статусы, при которых писать остаток бессмысленно.
 *
 * Список намеренно закрытый и работает как чёрный, а не белый: неизвестный
 * статус считаем рабочим. Ozon добавляет статусы молча, и белый список
 * означал бы, что однажды утром все склады разом стали недоступны, а
 * человек не может проставить остатки и не понимает почему. Ошибка в
 * другую сторону дешевле: площадка откажет по конкретной паре, отказ
 * будет виден в отчёте и объяснён её же словами.
 */
const NOT_EDITABLE: Record<string, string> = {
  disabled: 'Склад выключен в кабинете Ozon',
  blocked: 'Склад заблокирован площадкой',
  disabled_due_to_limit: 'Склад отключён: превышен лимит заказов',
  error: 'Ozon сообщает об ошибке склада',
};

/** Можно ли писать остатки на склад с таким статусом. */
export function editability(status: string | null | undefined): {
  isEditable: boolean;
  disabledReason: string | null;
} {
  const key = (status ?? '').trim().toLowerCase();
  const reason = NOT_EDITABLE[key];
  return reason
    ? { isEditable: false, disabledReason: reason }
    : { isEditable: true, disabledReason: null };
}

/**
 * Ответ площадки → строки для базы.
 *
 * Склад без идентификатора пропускаем: писать на него нечем, а показать
 * в списке значит дать выбрать то, что не сработает. Безымянный склад
 * называем по идентификатору — пустая строка в списке хуже технического
 * номера.
 */
export function toWarehouseStates(raw: RawWarehouse[]): WarehouseState[] {
  const seen = new Set<number>();
  const result: WarehouseState[] = [];

  for (const item of raw) {
    const id = item.warehouse_id;
    if (typeof id !== 'number' || !Number.isFinite(id)) continue;
    // Повтор в ответе площадки — редкость, но уникальный ключ в базе
    // упал бы на нём целиком, а вместе с ним и вся синхронизация.
    if (seen.has(id)) continue;
    seen.add(id);

    const status = item.status?.trim() || null;
    result.push({
      warehouseId: id,
      name: item.name?.trim() || `Склад ${id}`,
      status,
      ...editability(status),
    });
  }

  return result;
}

/**
 * Сколько живёт снимок списка складов.
 *
 * Пятнадцать минут: список меняется раз в месяцы, а окно массового
 * изменения остатков открывают десятки раз в день. Кнопка обновления
 * рядом есть всегда — ждать истечения срока никому не придётся.
 */
export const WAREHOUSE_CACHE_TTL_MS = 15 * 60 * 1000;

/** Пора ли обновить список. Пусто (никогда не синхронизировали) — пора. */
export function isStale(
  syncedAt: Date | null,
  now: Date,
  ttlMs: number = WAREHOUSE_CACHE_TTL_MS,
): boolean {
  if (!syncedAt) return true;
  return now.getTime() - syncedAt.getTime() >= ttlMs;
}

/**
 * Порядок показа: сначала те, на которые можно писать, внутри — по имени.
 *
 * Недоступные не прячем (ТЗ §6 требует показать их выключенными с
 * объяснением), но и первыми они стоять не должны.
 */
export function sortForPicker<T extends { isEditable: boolean; name: string }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    if (a.isEditable !== b.isEditable) return a.isEditable ? -1 : 1;
    return a.name.localeCompare(b.name, 'ru');
  });
}
