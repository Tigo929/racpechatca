import { Client } from 'pg';

/**
 * Распределённая блокировка синхронизации (этап 07, раздел 21).
 *
 * Одновременно должна работать одна синхронизация — из любого процесса:
 * второй контейнер после выкладки, ручной запуск из CLI рядом с
 * расписанием. Для этого — advisory lock PostgreSQL на уровне сессии:
 * `pg_try_advisory_lock` берётся мгновенно или не берётся вовсе, и
 * отпускается сам, если процесс упал вместе с соединением.
 *
 * Соединение — отдельное, не из пула Prisma: сессионная блокировка живёт
 * в конкретном соединении, а пул отдаёт запросы кому попало, и «отпустить»
 * могло бы уйти не туда, где «взяли». Пока синхронизация идёт (минуты),
 * это соединение просто держится открытым.
 */

/** Ключ блокировки. В проекте занят 1001 (нумерация заказов); этот — этапа 07. */
export const METRIKA_SYNC_LOCK_KEY = 700_701;

export type ReleaseLock = () => Promise<void>;

export interface SyncLock {
  /** Взять блокировку без ожидания; null — занята. */
  tryAcquire(): Promise<ReleaseLock | null>;
}

export class PgAdvisoryLock implements SyncLock {
  constructor(
    private readonly connectionString: string,
    private readonly key: number = METRIKA_SYNC_LOCK_KEY,
  ) {}

  async tryAcquire(): Promise<ReleaseLock | null> {
    const client = new Client({ connectionString: this.connectionString });
    await client.connect();
    try {
      const { rows } = await client.query<{ ok: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS ok',
        [this.key],
      );
      if (!rows[0]?.ok) {
        await client.end();
        return null;
      }
    } catch (error) {
      await client.end().catch(() => undefined);
      throw error;
    }
    return async () => {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [this.key]);
      } finally {
        await client.end().catch(() => undefined);
      }
    };
  }
}

/** Для тестов и одного процесса: та же семантика без базы. */
export class InMemoryLock implements SyncLock {
  private held = false;

  tryAcquire(): Promise<ReleaseLock | null> {
    if (this.held) return Promise.resolve(null);
    this.held = true;
    return Promise.resolve(() => {
      this.held = false;
      return Promise.resolve();
    });
  }
}
