import type {
  MetrikaAnalyticsSyncService,
  SyncSummary,
} from './metrika-analytics-sync.service';
import {
  DAILY_WINDOW_DAYS,
  HOURLY_WINDOW_DAYS,
  MetrikaAnalyticsSchedulerService,
  planTick,
} from './metrika-analytics-scheduler.service';

/**
 * Расписание (этап 07, раздел 19): часовой тик — 3 дня, первый тик
 * нового московского дня — 21 день; тики не накладываются друг на друга.
 */
describe('planTick', () => {
  it('суточного пересчёта за сегодня ещё не было → 21 день до сегодняшнего московского числа', () => {
    const plan = planTick(new Date('2026-09-12T21:30:00.000Z'), null);
    expect(plan.trigger).toBe('scheduler:daily');
    expect(plan.range).toEqual({ from: '2026-08-24', to: '2026-09-13' });
    expect(DAILY_WINDOW_DAYS).toBe(21);
  });

  it('суточный уже был сегодня → часовой на 3 дня', () => {
    const plan = planTick(new Date('2026-09-12T10:00:00.000Z'), '2026-09-12');
    expect(plan.trigger).toBe('scheduler:hourly');
    expect(plan.range).toEqual({ from: '2026-09-10', to: '2026-09-12' });
    expect(HOURLY_WINDOW_DAYS).toBe(3);
  });

  it('суточный был вчера, а по Москве уже новый день (21:00 UTC) → снова суточный', () => {
    const plan = planTick(new Date('2026-09-12T21:00:00.000Z'), '2026-09-12');
    expect(plan.trigger).toBe('scheduler:daily');
    expect(plan.range.to).toBe('2026-09-13');
  });
});

function fakeSync(result: Partial<SyncSummary> = {}) {
  const calls: { range: { from: string; to: string }; trigger: string }[] = [];
  let resolveGate: () => void = () => undefined;
  const sync = {
    sync: jest.fn(
      async (opts: {
        range: { from: string; to: string };
        trigger: string;
      }) => {
        calls.push(opts);
        await new Promise<void>((r) => (resolveGate = r));
        const summary: SyncSummary = {
          status: 'SUCCESS',
          batchId: 'b',
          range: opts.range,
          trigger: opts.trigger,
          datasets: [],
          goals: null,
          requests: 0,
          durationMs: 0,
          error: null,
          ...result,
        };
        return summary;
      },
    ),
  } as unknown as MetrikaAnalyticsSyncService;
  return { sync, calls, release: () => resolveGate() };
}

describe('MetrikaAnalyticsSchedulerService.tick', () => {
  it('первый тик — суточный, следующий в тот же день — часовой; после успеха суточный не повторяется', async () => {
    const { sync, calls, release } = fakeSync();
    const now = () => new Date('2026-09-12T10:00:00.000Z');
    const scheduler = new MetrikaAnalyticsSchedulerService(
      sync,
      { enabled: true, configured: true },
      now,
    );

    const first = scheduler.tick();
    release();
    await first;
    const second = scheduler.tick();
    release();
    await second;

    expect(calls.map((c) => c.trigger)).toEqual([
      'scheduler:daily',
      'scheduler:hourly',
    ]);
    expect(calls[0].range).toEqual({ from: '2026-08-23', to: '2026-09-12' });
    expect(calls[1].range).toEqual({ from: '2026-09-10', to: '2026-09-12' });
  });

  it('суточный провалился целиком → на следующем тике повторяется суточный', async () => {
    const { sync, calls, release } = fakeSync({ status: 'FAILED' });
    const scheduler = new MetrikaAnalyticsSchedulerService(
      sync,
      { enabled: true, configured: true },
      () => new Date('2026-09-12T10:00:00.000Z'),
    );
    const t1 = scheduler.tick();
    release();
    await t1;
    const t2 = scheduler.tick();
    release();
    await t2;
    expect(calls.map((c) => c.trigger)).toEqual([
      'scheduler:daily',
      'scheduler:daily',
    ]);
  });

  it('тик во время идущего тика — пропускается, без второго вызова sync', async () => {
    const { sync, calls, release } = fakeSync();
    const scheduler = new MetrikaAnalyticsSchedulerService(
      sync,
      { enabled: true, configured: true },
      () => new Date('2026-09-12T10:00:00.000Z'),
    );
    const running = scheduler.tick();
    await scheduler.tick();
    expect(calls).toHaveLength(1);
    release();
    await running;
  });

  it('LOCKED от сервиса (другой процесс) не считается суточным успехом', async () => {
    const { sync, calls, release } = fakeSync({ status: 'LOCKED' });
    const scheduler = new MetrikaAnalyticsSchedulerService(
      sync,
      { enabled: true, configured: true },
      () => new Date('2026-09-12T10:00:00.000Z'),
    );
    const t1 = scheduler.tick();
    release();
    await t1;
    const t2 = scheduler.tick();
    release();
    await t2;
    expect(calls.map((c) => c.trigger)).toEqual([
      'scheduler:daily',
      'scheduler:daily',
    ]);
  });

  it('выключенный рубильник — таймеры не ставятся', () => {
    jest.useFakeTimers();
    try {
      const { sync } = fakeSync();
      const scheduler = new MetrikaAnalyticsSchedulerService(sync, {
        enabled: false,
        configured: true,
      });
      scheduler.onModuleInit();
      expect(jest.getTimerCount()).toBe(0);
      const on = new MetrikaAnalyticsSchedulerService(sync, {
        enabled: true,
        configured: false,
      });
      on.onModuleInit();
      expect(jest.getTimerCount()).toBe(0);
      const live = new MetrikaAnalyticsSchedulerService(sync, {
        enabled: true,
        configured: true,
      });
      live.onModuleInit();
      expect(jest.getTimerCount()).toBe(2);
      live.onModuleDestroy();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
