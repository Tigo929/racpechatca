/**
 * Как ответ выглядит для модели.
 *
 * Модель читает текст, а не JSON-дерево. Она лучше отвечает, когда числа
 * уже подписаны словами и сведены в таблицу: тогда ей остаётся объяснить,
 * а не вычислять. Поэтому каждый инструмент возвращает короткую сводку
 * плюс таблицу — и то, и другое текстом.
 *
 * Здесь же живёт главное правило этого сервера: доли и средние считает
 * код, а не модель. Любое «раздели одно на другое» проходит через share()
 * и per(), где деление на ноль даёт «—», а не NaN и не выдумку.
 */

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export function int(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return Math.round(value).toLocaleString('ru-RU');
}

/** Доля в процентах. Ноль в знаменателе — «—», а не 0 % и не деление на ноль. */
export function share(part: number, whole: number): string {
  if (!whole) return '—';
  return `${((part / whole) * 100).toFixed(1)} %`;
}

/** Среднее на штуку: цена заявки, средний чек. Ноль в знаменателе — «—». */
export function per(total: number, count: number): string {
  if (!count) return '—';
  return money(total / count);
}

/** Таблица в тексте: выравнивание по столбцам, чтобы читалась глазами. */
export function table(headers: string[], rows: (string | number)[][]): string {
  if (rows.length === 0) return 'нет данных за период';
  const all = [headers, ...rows.map((r) => r.map(String))];
  const widths = headers.map((_, i) =>
    Math.max(...all.map((row) => (row[i] ?? '').toString().length)),
  );
  const line = (row: string[]) =>
    row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  return [line(headers), line(widths.map((w) => '─'.repeat(w))), ...all.slice(1).map(line)].join('\n');
}

/** Ответ инструмента: заголовок с периодом, сводка, таблица. */
export function answer(parts: {
  title: string;
  period?: string;
  summary?: string[];
  table?: string;
  note?: string;
}): string {
  return [
    parts.period ? `${parts.title} · ${parts.period}` : parts.title,
    '',
    ...(parts.summary?.length ? [...parts.summary, ''] : []),
    ...(parts.table ? [parts.table, ''] : []),
    ...(parts.note ? [parts.note] : []),
  ]
    .join('\n')
    .trimEnd();
}
