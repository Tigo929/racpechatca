/**
 * Разбор ответов Ozon, формат которых мы знаем не до конца.
 *
 * Документация Ozon Delivery API закрыта от автоматического чтения, и часть
 * ответов (создание заказа, информация об отправлении, этикетка) мы видим
 * только на живых данных. Поэтому ищем поле по имени в глубину, а не по
 * жёсткому пути: переименование вложенности у Ozon не должно ломать CRM.
 */

/** Первое значение-строка/число у ключа, подходящего под шаблон. */
export function deepFind(
  value: unknown,
  key: RegExp,
  depth = 0,
): string | null {
  if (depth > 8 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, key, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [k, v] of entries) {
    if (key.test(k) && (typeof v === 'string' || typeof v === 'number')) {
      return String(v);
    }
  }
  for (const [, v] of entries) {
    const found = deepFind(v, key, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

/** Объект-отправление с данным номером внутри ответа (или весь ответ). */
export function findPosting(value: unknown, postingNumber: string): unknown {
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > 8 || v === null || typeof v !== 'object') return null;
    if (Array.isArray(v)) {
      for (const item of v) {
        const f = walk(item, depth + 1);
        if (f) return f;
      }
      return null;
    }
    const obj = v as Record<string, unknown>;
    const num = obj.posting_number;
    if (
      (typeof num === 'string' || typeof num === 'number') &&
      String(num) === postingNumber
    ) {
      return obj;
    }
    for (const child of Object.values(obj)) {
      const f = walk(child, depth + 1);
      if (f) return f;
    }
    return null;
  };
  return walk(value, 0) ?? value;
}

/** Статус отправления в ответе Ozon. */
export function postingStatus(posting: unknown): string | null {
  return deepFind(
    posting,
    /^(status|state|status_name|posting_status|current_status)$/i,
  );
}

/** PDF этикетки из JSON: base64 в одном из полей. */
export function labelFromJson(value: unknown): Buffer | null {
  const b64 = deepFind(
    value,
    /^(file_content|content|file|label|pdf|data|label_content)$/i,
  );
  if (!b64 || b64.length < 100) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    return buf.subarray(0, 4).toString() === '%PDF' ? buf : null;
  } catch {
    return null;
  }
}

/** Ссылка на этикетку, если Ozon отдаёт её адресом. */
export function labelUrl(value: unknown): string | null {
  const url = deepFind(value, /(url|link)$/i);
  return url && /^https?:\/\//.test(url) ? url : null;
}
