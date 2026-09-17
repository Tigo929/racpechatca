/**
 * Операционная диагностика аналитики (этап 13, разделы 5–6, 21).
 *
 * Единый словарь состояний подсистем и детерминированные условия для
 * оператора. Это НЕ деловые сигналы этапа 12: здесь только «работает ли
 * конвейер», без выводов о клиентах. Ответ не содержит секретов, адресов
 * баз, ClientID и персональных данных — только состояния, счётчики, времена
 * и короткие тексты ошибок (классы), уже очищенные клиентом Метрики.
 */

export type SubsystemState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'STALE'
  | 'FAILED'
  | 'DISABLED'
  | 'RECOVERING';

export const SUBSYSTEM_KEYS = [
  'crmBusiness',
  'database',
  'metrikaApi',
  'metrikaOrdersOutbox',
  'metrikaAnalyticsSync',
  'periodSnapshots',
  'behaviorAnalytics',
  'growthEvaluations',
  'automatedInsights',
  'analyticsDashboard',
] as const;
export type SubsystemKey = (typeof SUBSYSTEM_KEYS)[number];

export const CONDITION_CODES = [
  'METRIKA_NOT_CONFIGURED',
  'METRIKA_SYNC_STALE',
  'METRIKA_SYNC_FAILED',
  'METRIKA_SYNC_STUCK',
  'OUTBOX_BACKLOG',
  'OUTBOX_FAILED',
  'OUTBOX_STUCK',
  'SNAPSHOT_STALE',
  'GROWTH_RUN_FAILED',
  'INSIGHTS_RUN_FAILED',
  'INSIGHTS_RUN_STUCK',
  'DATABASE_MIGRATION_MISMATCH',
  'DATABASE_UNAVAILABLE',
] as const;
export type ConditionCode = (typeof CONDITION_CODES)[number];

export type ConditionSeverity = 'WARNING' | 'CRITICAL';

export interface OpsCondition {
  code: ConditionCode;
  severity: ConditionSeverity;
  /** Подсистема-источник. */
  source: SubsystemKey;
  /** Что именно наблюдается — числа и времена, без секретов и PII. */
  detail: string;
  /** С какого момента (ISO) условие держится, если известно. */
  since: string | null;
  /** Что делать оператору — одно предложение. */
  operatorAction: string;
}

export interface OpsSubsystem {
  state: SubsystemState;
  detail: string;
}

/** Сырые факты для расчёта — то, что собирает сервис из базы и окружения. */
export interface OpsInput {
  build: string | null;
  flags: {
    analyticsSyncEnabled: boolean;
    ordersSyncEnabled: boolean;
    dashboardEnabled: boolean;
    growthEnabled: boolean;
    insightsEnabled: boolean;
    /** Счётчик и токен Метрики заданы (значения не раскрываются). */
    metrikaConfigured: boolean;
  };
  database: {
    reachable: boolean;
    /** Названия миграций на диске, которых нет в _prisma_migrations как применённых. */
    pendingMigrations: string[];
    /** Применённые в базе, но отсутствующие на диске (образ старше базы). */
    unknownMigrations: string[];
    rolledBackMigrations: number;
    appliedMigrations: number;
    lastMigration: string | null;
  };
  sync: {
    lastSuccessAt: Date | null;
    /** Последний завершённый запуск (любой набор): статус и ошибка. */
    lastRun: {
      status: string;
      trigger: string;
      startedAt: Date;
      finishedAt: Date | null;
      lastError: string | null;
    } | null;
    runningCount: number;
    oldestRunningStartedAt: Date | null;
    failedLast24h: number;
    /** Последний день с данными трафика (YYYY-MM-DD, Europe/Moscow). */
    lastDataDay: string | null;
  };
  outbox: {
    pending: number;
    processing: number;
    failed: number;
    delivered: number;
    skipped: number;
    oldestPendingAt: Date | null;
    oldestFailedAt: Date | null;
    oldestProcessingLockedAt: Date | null;
    lastDeliveredAt: Date | null;
  };
  snapshots: {
    count: number;
    lastFetchedAt: Date | null;
  };
  growth: {
    activeChanges: number;
    lastScheduledEvaluationAt: Date | null;
  };
  insights: {
    lastRun: {
      kind: string;
      status: string;
      startedAt: Date;
      finishedAt: Date | null;
      errors: string[];
    } | null;
    lastSuccessAt: Date | null;
    oldestRunningStartedAt: Date | null;
    openCards: number;
  };
}

export interface OpsStatus {
  generatedAt: string;
  timezone: 'Europe/Moscow';
  build: string | null;
  flags: OpsInput['flags'];
  subsystems: Record<SubsystemKey, OpsSubsystem>;
  conditions: OpsCondition[];
  thresholds: Record<string, number>;
  database: {
    reachable: boolean;
    appliedMigrations: number;
    lastMigration: string | null;
    pendingMigrations: string[];
    unknownMigrations: string[];
    rolledBackMigrations: number;
  };
  sync: {
    lastSuccessAt: string | null;
    dataAgeSeconds: number | null;
    lastDataDay: string | null;
    lastRunStatus: string | null;
    lastRunTrigger: string | null;
    lastError: string | null;
    runningCount: number;
    oldestRunningAgeSeconds: number | null;
    failedLast24h: number;
  };
  outbox: {
    pending: number;
    processing: number;
    failed: number;
    delivered: number;
    skipped: number;
    oldestPendingAgeSeconds: number | null;
    oldestFailedAgeSeconds: number | null;
    lastDeliveredAt: string | null;
  };
  snapshots: {
    count: number;
    lastFetchedAt: string | null;
    ageSeconds: number | null;
  };
  growth: {
    activeChanges: number;
    lastScheduledEvaluationAt: string | null;
    ageSeconds: number | null;
  };
  insights: {
    lastRunKind: string | null;
    lastRunStatus: string | null;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastErrors: string[];
    oldestRunningAgeSeconds: number | null;
    openCards: number;
  };
}
