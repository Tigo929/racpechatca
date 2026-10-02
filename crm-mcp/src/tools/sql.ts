/**
 * Прямой доступ к данным: описание схемы и произвольный читающий запрос.
 *
 * Это запасной выход, а не главный вход. Двадцать семь инструментов рядом
 * отвечают на вопросы о деле готовыми числами, и вот почему они остаются
 * главными: в CRM у каждого слова своё определение. «Выручка» — это правило
 * признания из P&L-отчёта, «оплачен» — заполненная дата оплаты, а не статус,
 * «заявка с рекламы» — метка клика. Модель, пишущая SQL сама, этих
 * определений не знает и выдумает свои — уверенно и неотличимо от правды.
 *
 * Поэтому здесь: запрос пропускается только читающий, строки ограничены,
 * личные данные вырезаются, а в каждом ответе написано, что числа в нём —
 * собственная арифметика модели, а не показатели CRM.
 */

import { z } from 'zod';
import { read } from '../db.js';
import { answer, int, table } from '../format.js';
import { MAX_ROWS, guardSelect, isRedactedColumn } from '../sql-guard.js';
import type { Tool } from './types.js';

/** Предел длины ответа: таблица в сто столбцов не поможет ни модели, ни человеку. */
const MAX_ANSWER_CHARS = 12_000;

/** Как показать значение из базы одной ячейкой. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export const schemaDescribe: Tool = {
  name: 'schema_describe',
  title: 'Какие данные есть в базе',
  description:
    'Таблицы базы CRM с колонками, типами и числом строк — чтобы знать, из чего можно собрать запрос в sql_select. ' +
    'Отвечает на «что вообще есть в базе». Самих данных не отдаёт, только устройство. ' +
    'Несколько таблиц скрыты (переписка с клиентами, ключи доступа) — их и в sql_select нельзя.',
  schema: {
    table: z
      .string()
      .optional()
      .describe('Часть имени таблицы, чтобы показать её колонки. Пусто — список всех таблиц с числом строк.'),
  },
  async run(args) {
    const filter = (args.table as string | undefined)?.trim();

    if (!filter) {
      const tables = await read<{ name: string; strok: number; kolonok: number }>(
        `SELECT c.relname AS name,
                GREATEST(c.reltuples, 0)::bigint AS strok,
                (SELECT count(*) FROM information_schema.columns k
                  WHERE k.table_schema = 'public' AND k.table_name = c.relname)::int AS kolonok
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY strok DESC`,
      );
      return answer({
        title: `Таблицы базы CRM: ${tables.length}`,
        table: table(
          ['таблица', 'строк (примерно)', 'колонок'],
          tables.map((t) => [t.name, int(t.strok), int(t.kolonok)]),
        ),
        note:
          'Число строк приблизительное — из статистики Postgres, точное считается запросом. ' +
          'Чтобы увидеть колонки, вызовите этот же инструмент с именем таблицы.',
      });
    }

    const columns = await read<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name ILIKE $1
        ORDER BY table_name, ordinal_position`,
      [`%${filter}%`],
    );

    if (columns.length === 0) {
      return answer({
        title: `Таблица «${filter}»`,
        summary: ['Такой таблицы нет. Вызовите инструмент без имени, чтобы увидеть список.'],
      });
    }

    const names = [...new Set(columns.map((c) => c.table_name))];
    return answer({
      title: names.length === 1 ? `Таблица ${names[0]}` : `Таблицы: ${names.join(', ')}`,
      table: table(
        ['таблица', 'колонка', 'тип', 'может быть пусто', 'значение по умолчанию'],
        columns.map((c) => [
          c.table_name,
          isRedactedColumn(c.column_name) ? `${c.column_name} (скрывается)` : c.column_name,
          c.data_type,
          c.is_nullable === 'YES' ? 'да' : 'нет',
          c.column_default ? c.column_default.slice(0, 30) : '—',
        ]),
      ),
      note:
        'Колонки с пометкой «скрывается» в ответах sql_select заменяются на «скрыто»: это телефоны, ссылки на переписку, ключи и тексты сообщений. ' +
        'Имена в кавычках: в запросах пишите "OrderPhoto", "createdAt" — регистр имеет значение.',
    });
  },
};

export const sqlSelect: Tool = {
  name: 'sql_select',
  title: 'Свой запрос к базе (только чтение)',
  description:
    'Выполнить свой SELECT к базе CRM, когда готовые инструменты не отвечают на вопрос — например, найти заказы по редкому признаку или пересчитать что-то в своём разрезе. ' +
    'Только чтение: INSERT, UPDATE, DELETE и прочая запись отклоняются, изменить данные через этот инструмент невозможно. ' +
    'Строк не больше ' +
    MAX_ROWS +
    ', личные данные (телефоны, ссылки на переписку, ключи, тексты сообщений) вырезаются, часть таблиц закрыта. ' +
    'ВАЖНО: числа, полученные этим инструментом, — ваша собственная арифметика, а НЕ показатели CRM. ' +
    'Для выручки, окупаемости рекламы, зарплаты и прочих денег берите готовые инструменты: у них определения совпадают с отчётами CRM, а у вашего запроса — нет. ' +
    'Устройство таблиц смотрите в schema_describe.',
  schema: {
    query: z
      .string()
      .min(10)
      .describe(
        'Один SELECT (или WITH … SELECT). Имена таблиц и колонок в двойных кавычках: SELECT "numberOrder" FROM "OrderPhoto" WHERE status = \'NEW\'.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_ROWS)
      .optional()
      .describe(`Сколько строк вернуть, не больше ${MAX_ROWS}. По умолчанию ${MAX_ROWS}.`),
  },
  async run(args) {
    const raw = String(args.query ?? '');
    const limit = typeof args.limit === 'number' ? args.limit : MAX_ROWS;
    const guarded = guardSelect(raw, limit);

    const rows = await read<Record<string, unknown>>(guarded.sql);

    if (rows.length === 0) {
      return answer({
        title: 'Свой запрос к базе',
        summary: ['Запрос выполнен, строк не вернулось. Это пустой результат, а не ошибка.'],
        note: 'Если ожидали строки — проверьте регистр имён: в этой базе "OrderPhoto", а не orderphoto.',
      });
    }

    const columns = Object.keys(rows[0] as Record<string, unknown>);
    const redacted = columns.filter((c) => isRedactedColumn(c));
    const body = rows.map((row) =>
      columns.map((c) => (isRedactedColumn(c) ? 'скрыто' : cell(row[c]))),
    );

    let rendered = table(columns, body);
    let cut = false;
    if (rendered.length > MAX_ANSWER_CHARS) {
      const lines = rendered.split('\n');
      const kept: string[] = [];
      let size = 0;
      for (const line of lines) {
        if (size + line.length > MAX_ANSWER_CHARS) break;
        kept.push(line);
        size += line.length + 1;
      }
      rendered = kept.join('\n');
      cut = true;
    }

    const notes = [
      'Числа в этой таблице посчитаны вашим запросом, а не CRM: с отчётами и дашбордом они могут не совпасть. Для денег берите готовые инструменты.',
      redacted.length
        ? `Скрыты колонки: ${redacted.join(', ')} — личные данные и секреты наружу не отдаются.`
        : '',
      rows.length >= guarded.limit
        ? `Показаны первые ${int(guarded.limit)} строк — возможно, есть ещё. Сузьте запрос или посчитайте агрегатом.`
        : '',
      cut ? 'Ответ обрезан по длине: столбцов или текста слишком много.' : '',
    ].filter(Boolean);

    return answer({
      title: `Свой запрос к базе: строк ${rows.length}`,
      table: rendered,
      note: notes.join(' '),
    });
  },
};

export const sqlTools = [schemaDescribe, sqlSelect];
