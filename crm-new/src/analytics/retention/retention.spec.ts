import {
  cutoffFor,
  forecastBytes,
  planRetention,
  RETENTION_NEVER,
  RETENTION_RULES,
} from './retention-policy';
import {
  RETENTION_APPLY_ENV,
  RetentionService,
  type RetentionPrisma,
} from './retention.service';

/**
 * Политика хранения (этап 13, раздел 13): детерминированный план, dry-run по
 * умолчанию, ошибки живут дольше успехов, незакрытые строки очереди и данные
 * не трогаются, удаление — только с двумя независимыми подтверждениями.
 */
const NOW = new Date('2026-09-17T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

type Row = { status: string; startedAt?: Date; processedAt?: Date | null };

function fakePrisma(rows: Record<string, Row[]>) {
  const deleted: Record<string, number> = {};
  const model = (name: string) => {
    const list = rows[name] ?? [];
    const match = (r: Row, where: Record<string, unknown>) => {
      const statuses = (where.status as { in: string[] }).in;
      if (!statuses.includes(r.status)) return false;
      const field = 'startedAt' in where ? 'startedAt' : 'processedAt';
      const cutoff = (where[field] as { lt: Date }).lt;
      const value = r[field];
      return value instanceof Date && value < cutoff;
    };
    return {
      count: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(list.filter((r) => match(r, where)).length),
      ),
      deleteMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const n = list.filter((r) => match(r, where)).length;
        deleted[name] = (deleted[name] ?? 0) + n;
        return Promise.resolve({ count: n });
      }),
    };
  };
  const prisma = {
    metrikaSyncRun: model('metrikaSyncRun'),
    analyticsInsightRun: model('analyticsInsightRun'),
    metrikaOrderOutbox: model('metrikaOrderOutbox'),
  };
  return { prisma: prisma as unknown as RetentionPrisma, raw: prisma, deleted };
}

const DATA = {
  metrikaSyncRun: [
    { status: 'SUCCESS', startedAt: daysAgo(100) }, // старше 90 → под правило
    { status: 'SUCCESS', startedAt: daysAgo(10) }, // свежий
    { status: 'FAILED', startedAt: daysAgo(100) }, // FAILED хранится год
    { status: 'FAILED', startedAt: daysAgo(400) }, // старше года → под правило
    { status: 'RUNNING', startedAt: daysAgo(400) }, // незавершённый — никогда
  ],
  analyticsInsightRun: [
    { status: 'SUCCESS', startedAt: daysAgo(91) },
    { status: 'LOCKED', startedAt: daysAgo(91) },
    { status: 'FAILED', startedAt: daysAgo(91) },
    { status: 'RUNNING', startedAt: daysAgo(91) },
  ],
  metrikaOrderOutbox: [
    { status: 'delivered', processedAt: daysAgo(181) },
    { status: 'skipped', processedAt: daysAgo(181) },
    { status: 'delivered', processedAt: daysAgo(30) },
    { status: 'failed', processedAt: daysAgo(400) }, // никогда
    { status: 'pending', processedAt: null }, // никогда
  ],
};

describe('политика хранения', () => {
  it('правила: ошибки хранятся дольше успехов; pending/processing/failed очереди и данные — в списке «никогда»', () => {
    const sync = RETENTION_RULES.filter((r) => r.table === 'MetrikaSyncRun');
    expect(sync.find((r) => r.statuses.includes('SUCCESS'))?.keepDays).toBe(90);
    expect(sync.find((r) => r.statuses.includes('FAILED'))?.keepDays).toBe(365);
    for (const r of RETENTION_RULES) {
      expect(r.statuses).not.toContain('RUNNING');
      expect(r.statuses).not.toContain('pending');
      expect(r.statuses).not.toContain('processing');
      expect(r.statuses).not.toContain('failed');
    }
    expect(RETENTION_NEVER.map((n) => n.table).join(' ')).toMatch(
      /MetrikaDaily|Snapshot|AnalyticsChange|AnalyticsInsight/,
    );
  });

  it('план детерминирован и ничего не удаляет: одинаковый now → одинаковый план; deleteMany не вызывался', async () => {
    const { prisma, raw } = fakePrisma(DATA);
    const svc = new RetentionService(prisma, () => NOW, {});
    const a = await svc.plan();
    const b = await svc.plan();
    expect(a).toEqual(b);
    expect(a.dryRun).toBe(true);
    expect(
      a.items.map((i) => `${i.table}:${i.statuses.join('/')}=${i.rows}`),
    ).toEqual([
      'MetrikaSyncRun:SUCCESS=1',
      'MetrikaSyncRun:FAILED/PARTIAL=1',
      'AnalyticsInsightRun:SUCCESS/SKIPPED/LOCKED=2',
      'AnalyticsInsightRun:FAILED=0',
      'MetrikaOrderOutbox:delivered/skipped=2',
    ]);
    expect(a.totalRows).toBe(6);
    expect(a.items[0].cutoff).toBe(
      cutoffFor(RETENTION_RULES[0], NOW).toISOString(),
    );
    for (const m of Object.values(raw))
      expect(m.deleteMany).not.toHaveBeenCalled();
  });

  it('apply без --apply → ошибка; с --apply без переменной окружения → ошибка; ничего не удалено', async () => {
    const { prisma, raw } = fakePrisma(DATA);
    const svc = new RetentionService(prisma, () => NOW, {});
    await expect(svc.apply({ confirm: false })).rejects.toThrow(/--apply/);
    await expect(svc.apply({ confirm: true })).rejects.toThrow(
      new RegExp(RETENTION_APPLY_ENV),
    );
    for (const m of Object.values(raw))
      expect(m.deleteMany).not.toHaveBeenCalled();
  });

  it('apply с обоими подтверждениями удаляет ровно строки плана и не касается RUNNING / pending / failed / свежих', async () => {
    const { prisma, deleted } = fakePrisma(DATA);
    const svc = new RetentionService(prisma, () => NOW, {
      [RETENTION_APPLY_ENV]: '1',
    });
    const result = await svc.apply({ confirm: true });
    expect(result.totalRows).toBe(6);
    expect(deleted).toEqual({
      metrikaSyncRun: 2,
      analyticsInsightRun: 2,
      metrikaOrderOutbox: 2,
    });
  });

  it('planRetention работает с любым счётчиком; прогноз роста — линейный', async () => {
    const plan = await planRetention(NOW, () => Promise.resolve(3));
    expect(plan.totalRows).toBe(RETENTION_RULES.length * 3);
    expect(forecastBytes('MetrikaSyncRun', 365)).toBe(288 * 480 * 365);
  });
});
