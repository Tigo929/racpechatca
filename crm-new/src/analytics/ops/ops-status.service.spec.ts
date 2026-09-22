import { PrismaService } from 'src/prisma/prisma.service';
import { OpsStatusService } from './ops-status.service';

/**
 * Этап 13, FIX_02 (22.09.2026). Диагностика спрашивала у журнала оценок роста
 * несуществующее значение trigger ('scheduled' вместо 'scheduler', который
 * пишет этап 11) — ответ всегда был пустой, и на боевом стенде висел
 * GROWTH_RUN_FAILED при исправно работающей автооценке.
 *
 * Тесты идут через фальшивую базу, которая фильтрует строки ровно по
 * переданному where: опечатка в значении снова даст «оценок нет» и уронит
 * первый же случай, а не пройдёт мимо, как проходит сверка строк.
 *
 * Семантику этапа 11 здесь не трогаем: провалившийся автопрогон строки не
 * пишет, поэтому «свежий провал» выглядит как отсутствие свежей оценки — это
 * и есть существующий контракт, он закреплён отдельным случаем.
 */

const HOUR = 3600_000;
const NOW = new Date('2026-09-22T12:00:00.000Z');

interface EvaluationRow {
  trigger: string;
  evaluatedAt: Date;
}

interface DbState {
  activeChanges: number;
  evaluations: EvaluationRow[];
}

/** Запросы, которые диагностика отправила в журнал оценок — для проверки фильтра. */
const evaluationQueries: { trigger?: unknown }[] = [];

function fakePrisma(state: DbState): PrismaService {
  const none = { findFirst: () => Promise.resolve(null) };
  const zero = () => Promise.resolve(0);
  const prisma = {
    $queryRaw: () => Promise.resolve([] as unknown[]),
    metrikaSyncRun: {
      ...none,
      findMany: () => Promise.resolve([]),
      count: zero,
    },
    metrikaDailyTraffic: none,
    metrikaOrderOutbox: { ...none, groupBy: () => Promise.resolve([]) },
    metrikaPeriodSnapshot: { ...none, count: zero },
    analyticsChange: { count: () => Promise.resolve(state.activeChanges) },
    analyticsChangeEvaluation: {
      findFirst: (args: { where: { trigger?: unknown } }) => {
        evaluationQueries.push(args.where);
        const rows = state.evaluations
          .filter((r) => r.trigger === args.where.trigger)
          .sort((a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime());
        return Promise.resolve(rows[0] ?? null);
      },
    },
    analyticsInsightRun: none,
    analyticsInsight: { count: zero },
    analyticsReport: { ...none, count: zero },
  };
  return prisma as unknown as PrismaService;
}

function service(
  state: Partial<DbState> = {},
  env: NodeJS.ProcessEnv = {},
): OpsStatusService {
  return new OpsStatusService(
    fakePrisma({ activeChanges: 1, evaluations: [], ...state }),
    () => NOW,
    '/nonexistent-migrations',
    {
      ANALYTICS_DASHBOARD_ENABLED: 'true',
      ANALYTICS_GROWTH_ENABLED: 'true',
      YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: 'true',
      ...env,
    },
  );
}

const scheduler = (hoursAgo: number): EvaluationRow => ({
  trigger: 'scheduler',
  evaluatedAt: new Date(NOW.getTime() - hoursAgo * HOUR),
});
const manual = (hoursAgo: number): EvaluationRow => ({
  trigger: 'manual',
  evaluatedAt: new Date(NOW.getTime() - hoursAgo * HOUR),
});

describe('OpsStatusService: свежесть автооценки роста (FIX_02)', () => {
  beforeEach(() => {
    evaluationQueries.length = 0;
  });

  it('спрашивает именно то значение trigger, которое пишет этап 11', async () => {
    await service().collect();
    expect(evaluationQueries).toEqual([{ trigger: 'scheduler' }]);
  });

  it('свежий успешный автопрогон: подсистема здорова, GROWTH_RUN_FAILED нет', async () => {
    const status = await service({
      activeChanges: 2,
      evaluations: [scheduler(3), manual(40)],
    }).status();

    expect(status.growth.lastScheduledEvaluationAt).toBe(
      scheduler(3).evaluatedAt.toISOString(),
    );
    expect(status.growth.ageSeconds).toBe(3 * 3600);
    expect(status.subsystems.growthEvaluations.state).toBe('HEALTHY');
    expect(status.conditions.map((c) => c.code)).not.toContain(
      'GROWTH_RUN_FAILED',
    );
  });

  it('провалившийся автопрогон (строки нет, последняя автооценка старше порога) → GROWTH_RUN_FAILED', async () => {
    const status = await service({
      activeChanges: 1,
      evaluations: [scheduler(30)],
    }).status();

    // словарь этапа 13: условие GROWTH_RUN_FAILED переводит подсистему в DEGRADED
    expect(status.subsystems.growthEvaluations.state).toBe('DEGRADED');
    expect(status.conditions.map((c) => c.code)).toContain('GROWTH_RUN_FAILED');
  });

  it('ручная оценка не подменяет свежесть автооценки', async () => {
    const status = await service({
      activeChanges: 1,
      evaluations: [manual(1), scheduler(30)],
    }).status();

    expect(status.growth.lastScheduledEvaluationAt).toBe(
      scheduler(30).evaluatedAt.toISOString(),
    );
    expect(status.subsystems.growthEvaluations.state).toBe('DEGRADED');
    expect(status.conditions.map((c) => c.code)).toContain('GROWTH_RUN_FAILED');
  });

  it('автооценок не было вовсе при активном изменении → GROWTH_RUN_FAILED (контракт не изменился)', async () => {
    const status = await service({
      activeChanges: 1,
      evaluations: [manual(2)],
    }).status();

    expect(status.growth.lastScheduledEvaluationAt).toBeNull();
    expect(status.conditions.map((c) => c.code)).toContain('GROWTH_RUN_FAILED');
  });

  it('активных изменений нет — оценивать нечего, подсистема здорова', async () => {
    const status = await service({
      activeChanges: 0,
      evaluations: [],
    }).status();

    expect(status.subsystems.growthEvaluations.state).toBe('HEALTHY');
    expect(status.conditions.map((c) => c.code)).not.toContain(
      'GROWTH_RUN_FAILED',
    );
  });

  it('раздел роста выключен — подсистема DISABLED, свежесть не требуется', async () => {
    const status = await service(
      { activeChanges: 3, evaluations: [] },
      { ANALYTICS_GROWTH_ENABLED: 'false' },
    ).status();

    expect(status.subsystems.growthEvaluations.state).toBe('DISABLED');
    expect(status.conditions.map((c) => c.code)).not.toContain(
      'GROWTH_RUN_FAILED',
    );
  });
});
