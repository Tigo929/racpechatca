/**
 * Доступ к базе CRM — только чтение, без исключений.
 *
 * Гарантия read-only держится не на дисциплине автора запросов, а на самой
 * базе: каждый запрос выполняется внутри транзакции, помеченной READ ONLY.
 * Postgres отклонит любую попытку записи, даже если однажды в инструмент
 * просочится UPDATE. Агент, который «поправил» заказ, — это то, чего здесь
 * не должно случиться ни при какой ошибке.
 *
 * Отдельно про таймаут: у инструмента, которым пользуется модель, не должно
 * быть запросов, висящих минутами. Лучше честно отказать, чем занять
 * соединение и заставить ждать человека.
 */

import pg from 'pg';

/** Сколько ждём ответа базы. Дальше — отказ, а не бесконечное ожидание. */
const STATEMENT_TIMEOUT_MS = 15_000;

/**
 * Числа из Postgres приходят строками, когда тип BIGINT: драйвер бережёт
 * точность. Нам суммы нужны числами, и они заведомо влезают в double —
 * это рубли и штуки, а не идентификаторы.
 */
pg.types.setTypeParser(20, (value) => Number(value));
/** NUMERIC: то же самое — суммы расходов приходят как numeric. */
pg.types.setTypeParser(1700, (value) => Number(value));

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL не задан — MCP-серверу нечего читать. См. crm-mcp/README.md',
    );
  }
  pool = new pg.Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'crm-mcp',
  });
  return pool;
}

export interface QueryResult<T> {
  rows: T[];
}

/**
 * Выполнить чтение. Возвращает строки; ошибку не глотает — вызывающий
 * обязан отличить «данных нет» от «база недоступна», это разные ответы.
 */
export async function read<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Соединение уже потеряно — откатывать нечего.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
