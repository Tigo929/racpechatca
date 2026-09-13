/**
 * Короткий серверный кэш дашборда (этап 09, раздел 33).
 *
 * Метрики уже локальные, но обзор за 30 дней — это ~30 SQL-запросов и P&L
 * за два периода. Руководитель открывает несколько вкладок подряд и жмёт
 * «обновить»; 45 секунд кэша убирают повторную работу, а свежее данных
 * всё равно не бывает — таблицы Метрики обновляются раз в час. Ключ —
 * вид отчёта + период (сравнение выводится из периода детерминированно).
 * Один процесс — одна карта; на нескольких контейнерах кэши независимы,
 * что для 45 секунд безвредно.
 */

export const DASHBOARD_CACHE_TTL_MS = 45_000;

interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

export class DashboardCache {
  private readonly entries = new Map<string, Entry<unknown>>();

  constructor(
    private readonly ttlMs: number = DASHBOARD_CACHE_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Значение по ключу; при промахе — вычислить и запомнить (промис, чтобы параллельные запросы делили одну работу). */
  getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    const at = this.now();
    if (hit && hit.expiresAt > at) return hit.value as Promise<T>;
    const value = compute().catch((error: unknown) => {
      // Ошибку не кэшируем: следующий запрос попробует снова.
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { value, expiresAt: at + this.ttlMs });
    return value;
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
