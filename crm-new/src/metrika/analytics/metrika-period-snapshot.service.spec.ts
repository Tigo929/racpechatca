import type { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaApiError } from '../metrika-api.client';
import type {
  MetrikaGoal,
  MetrikaStatsQuery,
  MetrikaStatsResponse,
} from '../metrika.types';
import {
  MetrikaPeriodSnapshotService,
  type SnapshotsClient,
} from './metrika-period-snapshot.service';

/**
 * Снимки периодов (этап 08, раздел 8): один запрос без измерений на период,
 * upsert по (periodStart, periodEnd, scope); ошибка одного пресета не
 * ломает остальные; SUM(daily users) здесь не существует в принципе.
 */
function fakePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  const upsert = jest.fn(
    async ({
      where,
      create,
      update,
    }: {
      where: {
        periodStart_periodEnd_metricScope: {
          periodStart: Date;
          periodEnd: Date;
          metricScope: string;
        };
      };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const k = where.periodStart_periodEnd_metricScope;
      const key = `${k.periodStart.toISOString()}|${k.periodEnd.toISOString()}|${k.metricScope}`;
      const existing = rows.get(key);
      rows.set(key, existing ? { ...existing, ...update } : create);
      return Promise.resolve(rows.get(key));
    },
  );
  // Этап 10: снимки посетителей по целям — отдельная таблица с ключом (период, цель).
  const goalRows = new Map<string, Record<string, unknown>>();
  const goalUpsert = jest.fn(
    ({
      where,
      create,
      update,
    }: {
      where: {
        periodStart_periodEnd_goalId: {
          periodStart: Date;
          periodEnd: Date;
          goalId: number;
        };
      };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const k = where.periodStart_periodEnd_goalId;
      const key = `${k.periodStart.toISOString()}|${k.periodEnd.toISOString()}|${k.goalId}`;
      const existing = goalRows.get(key);
      goalRows.set(key, existing ? { ...existing, ...update } : create);
      return Promise.resolve(goalRows.get(key));
    },
  );
  return {
    rows,
    goalRows,
    prisma: {
      metrikaPeriodSnapshot: { upsert },
      metrikaPeriodGoalSnapshot: { upsert: goalUpsert },
    } as unknown as PrismaService,
    upsert,
  };
}

/** Две поведенческие цели в счётчике: начало формы и заявка. */
const BEHAVIOR_GOALS: MetrikaGoal[] = [
  {
    id: 611379430,
    name: 'form_started',
    type: 'action',
    conditions: [{ type: 'contain', url: 'form_started' }],
  },
  {
    id: 611379890,
    name: 'lead_submitted',
    type: 'action',
    conditions: [{ type: 'contain', url: 'lead_submitted' }],
  },
  { id: 596990603, name: 'CRM: Заказ создан', type: 'cdp_order_in_progress' },
];

/** Ответ на запрос посетителей по целям: [visits, users(form_started), users(lead)]. */
const GOAL_USERS_ROW = { dimensions: [], metrics: [250, 13, 3] };

function fakeClient(
  handler: (q: MetrikaStatsQuery) => Partial<MetrikaStatsResponse> | Error,
): { client: SnapshotsClient; calls: MetrikaStatsQuery[] } {
  const calls: MetrikaStatsQuery[] = [];
  return {
    calls,
    client: {
      isConfigured: () => true,
      getGoals: () => Promise.resolve(BEHAVIOR_GOALS),
      getStats: (q) => {
        calls.push(q);
        const isGoalUsers = q.metrics.some(
          (m) => m.endsWith('users') && m.includes('goal'),
        );
        const out = isGoalUsers ? { data: [GOAL_USERS_ROW] } : handler(q);
        if (out instanceof Error) return Promise.reject(out);
        return Promise.resolve({
          query: {
            ids: [1],
            dimensions: [],
            metrics: q.metrics,
            date1: q.date1,
            date2: q.date2,
          },
          data: [{ dimensions: [], metrics: [250, 160, 610] }],
          total_rows: 1,
          sampled: false,
          sample_share: 1,
          data_lag: 0,
          ...out,
        });
      },
    },
  };
}

const NOW = new Date('2026-09-12T21:30:00.000Z');

describe('MetrikaPeriodSnapshotService', () => {
  it('refreshRange: один запрос без измерений за весь период, upsert с users из ответа', async () => {
    const { prisma, rows } = fakePrisma();
    const { client, calls } = fakeClient(() => ({}));
    const s = new MetrikaPeriodSnapshotService(prisma, client, () => NOW);
    const out = await s.refreshRange(
      { from: '2026-09-06', to: '2026-09-12' },
      'last_7_days',
    );
    // Два запроса за период: сводка счётчика и посетители по поведенческим целям.
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      date1: '2026-09-06',
      date2: '2026-09-12',
      dimensions: undefined,
      metrics: ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews'],
    });
    expect(calls[1]).toMatchObject({
      date1: '2026-09-06',
      date2: '2026-09-12',
      metrics: [
        'ym:s:visits',
        'ym:s:goal611379430users',
        'ym:s:goal611379890users',
      ],
    });
    expect(out).toMatchObject({
      status: 'SUCCESS',
      users: 160,
      visits: 250,
      pageviews: 610,
      sampled: false,
      requests: 2,
      goalUsers: 2,
    });
    const stored = [...rows.values()][0];
    expect(stored).toMatchObject({
      users: 160,
      visits: 250,
      pageviews: 610,
      preset: 'last_7_days',
      metricScope: 'counter',
      sampled: false,
      sampleShare: 1,
    });
    expect((stored.periodStart as Date).toISOString()).toBe(
      '2026-09-06T00:00:00.000Z',
    );
  });

  it('этап 10: посетители по целям за период — строка на цель, ключ (период, цель), 0 явно', async () => {
    const { prisma, goalRows } = fakePrisma();
    const { client } = fakeClient(() => ({}));
    const s = new MetrikaPeriodSnapshotService(prisma, client, () => NOW);
    await s.refreshRange(
      { from: '2026-09-06', to: '2026-09-12' },
      'last_7_days',
    );
    expect(goalRows.size).toBe(2);
    const byGoal = Object.fromEntries(
      [...goalRows.values()].map((r) => [r.goalIdentifier as string, r]),
    );
    expect(byGoal.form_started).toMatchObject({
      users: 13,
      preset: 'last_7_days',
      sampled: false,
    });
    expect(byGoal.lead_submitted).toMatchObject({ users: 3 });
    // повтор — обновление, не вторая строка
    await s.refreshRange(
      { from: '2026-09-06', to: '2026-09-12' },
      'last_7_days',
    );
    expect(goalRows.size).toBe(2);
  });

  it('повторный снимок того же периода обновляет строку, а не создаёт вторую', async () => {
    const { prisma, rows } = fakePrisma();
    let users = 100;
    const { client } = fakeClient(() => ({
      data: [{ dimensions: [], metrics: [200, users, 500] }],
    }));
    const s = new MetrikaPeriodSnapshotService(prisma, client, () => NOW);
    await s.refreshRange({ from: '2026-09-06', to: '2026-09-12' });
    users = 105;
    await s.refreshRange({ from: '2026-09-06', to: '2026-09-12' });
    expect(rows.size).toBe(1);
    expect([...rows.values()][0].users).toBe(105);
  });

  it('refreshPresets: восемь пресетов, ошибка одного не мешает остальным', async () => {
    const { prisma, rows } = fakePrisma();
    const { client, calls } = fakeClient((q) =>
      q.date1 === q.date2 && q.date1 === '2026-09-13'
        ? new MetrikaApiError('server', 503, 'Метрика недоступна.')
        : {},
    );
    const s = new MetrikaPeriodSnapshotService(prisma, client, () => NOW);
    const out = await s.refreshPresets();
    expect(out).toHaveLength(8);
    expect(out.map((o) => o.preset)).toEqual([
      'today',
      'yesterday',
      'last_7_days',
      'previous_7_days',
      'last_30_days',
      'previous_30_days',
      'current_month',
      'previous_month',
    ]);
    const failed = out.filter((o) => o.status === 'FAILED');
    expect(failed).toHaveLength(1);
    expect(failed[0].preset).toBe('today');
    expect(failed[0].error).toContain('503');
    expect(rows.size).toBe(7);
    // 7 удачных пресетов × (сводка + цели) + 1 неудачная сводка
    expect(calls).toHaveLength(15);
  });

  it('семплированный ответ → повтор с accuracy=full, признак сохраняется честно', async () => {
    const { prisma, rows } = fakePrisma();
    const { client, calls } = fakeClient((q) =>
      q.accuracy === 'full'
        ? { sampled: false }
        : { sampled: true, sample_share: 0.5 },
    );
    const s = new MetrikaPeriodSnapshotService(prisma, client, () => NOW);
    const out = await s.refreshRange({ from: '2026-08-14', to: '2026-09-12' });
    // сводка (выборка) + повтор с accuracy=full + посетители по целям
    expect(calls).toHaveLength(3);
    expect(out.requests).toBe(3);
    expect(out.sampled).toBe(false);
    expect([...rows.values()][0]).toMatchObject({
      requestCount: 2,
      sampled: false,
    });
  });

  it('клиент не настроен — FAILED без запросов и без записи', async () => {
    const { prisma, rows } = fakePrisma();
    const { client, calls } = fakeClient(() => ({}));
    const s = new MetrikaPeriodSnapshotService(
      prisma,
      { ...client, isConfigured: () => false },
      () => NOW,
    );
    const out = await s.refreshRange({ from: '2026-09-06', to: '2026-09-12' });
    expect(out.status).toBe('FAILED');
    expect(calls).toHaveLength(0);
    expect(rows.size).toBe(0);
  });
});
