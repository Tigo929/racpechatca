import type {
  OpsCondition,
  OpsInput,
  OpsStatus,
  OpsSubsystem,
  SubsystemKey,
} from './ops-contract';

/**
 * Пороги операционных условий (этап 13, раздел 21). Детерминированные:
 * одно и то же состояние базы даёт один и тот же список условий.
 *
 * Синхронизация Метрики идёт каждый час, поэтому «свежие» данные — моложе
 * двух тиков; шесть часов — тот же порог, что CRITICAL_STALE_SECONDS у
 * этапа 12. Замок запуска сигналов — RUN_LOCK_MINUTES = 10 (этап 12), замок
 * зависшей синхронизации — 60 мин (этап 07), зависший processing очереди —
 * 10 мин (этап 06): здесь те же числа, чтобы диагностика и код сходились.
 */
export const OPS_THRESHOLDS = {
  syncStaleSeconds: 2 * 3600,
  syncCriticalSeconds: 6 * 3600,
  syncStuckSeconds: 60 * 60,
  snapshotStaleSeconds: 2 * 3600,
  outboxBacklogPending: 50,
  outboxBacklogOldestSeconds: 2 * 3600,
  outboxStuckProcessingSeconds: 10 * 60,
  growthLagSeconds: 26 * 3600,
  insightsStaleSeconds: 2 * 3600,
  insightsStuckSeconds: 10 * 60,
} as const;

const age = (at: Date | null, now: Date): number | null =>
  at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000)) : null;
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const fmtAge = (s: number | null): string =>
  s === null
    ? 'нет данных'
    : s < 3600
      ? `${Math.round(s / 60)} мин`
      : `${(s / 3600).toFixed(1)} ч`;

/** Класс ошибки Метрики из текста клиента — без деталей, только вид. */
function errorClass(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/не настроен|not_configured/.test(t)) return 'not_configured';
  if (/401|unauthorized|токен/.test(t)) return 'unauthorized';
  if (/403|forbidden|прав/.test(t)) return 'forbidden';
  if (/429|rate/.test(t)) return 'rate_limited';
  if (/50\d|server/.test(t)) return 'server';
  if (/таймаут|timeout/.test(t)) return 'timeout';
  if (/сеть|network|fetch failed/.test(t)) return 'network';
  return 'other';
}

/** Текст ошибки для оператора: коротко и без чего-либо похожего на секрет. */
export function sanitizeError(text: string | null): string | null {
  if (!text) return null;
  return text
    .replace(/(OAuth|Bearer)\s+[A-Za-z0-9_.-]{8,}/g, '$1 <скрыто>')
    .replace(/y0_[A-Za-z0-9_-]{10,}/g, '<скрыто>')
    .replace(/postgres(ql)?:\/\/[^\s]+/g, 'postgresql://<скрыто>')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_.-]+/g, '<скрыто>')
    .slice(0, 200);
}

export function computeOpsStatus(input: OpsInput, now: Date): OpsStatus {
  const T = OPS_THRESHOLDS;
  const conditions: OpsCondition[] = [];
  const add = (c: OpsCondition) => conditions.push(c);
  const sub: Partial<Record<SubsystemKey, OpsSubsystem>> = {};

  // ── database / crmBusiness ────────────────────────────────────────────────
  const db = input.database;
  if (!db.reachable) {
    sub.database = { state: 'FAILED', detail: 'база недоступна' };
    sub.crmBusiness = {
      state: 'FAILED',
      detail: 'база недоступна — заказы не читаются',
    };
    add({
      code: 'DATABASE_UNAVAILABLE',
      severity: 'CRITICAL',
      source: 'database',
      detail: 'SELECT 1 не выполняется',
      since: null,
      operatorAction:
        'Проверить контейнер postgres и место на диске; аналитика вторична — сначала CRM.',
    });
  } else {
    const mismatch =
      db.pendingMigrations.length > 0 ||
      db.unknownMigrations.length > 0 ||
      db.rolledBackMigrations > 0;
    sub.database = mismatch
      ? {
          state: 'DEGRADED',
          detail: `миграции: не применено ${db.pendingMigrations.length}, неизвестных базе ${db.unknownMigrations.length}, откаченных ${db.rolledBackMigrations}`,
        }
      : {
          state: 'HEALTHY',
          detail: `миграций применено ${db.appliedMigrations}`,
        };
    sub.crmBusiness = {
      state: 'HEALTHY',
      detail: 'заказы, задачи и отчёты не зависят от аналитики',
    };
    if (mismatch)
      add({
        code: 'DATABASE_MIGRATION_MISMATCH',
        severity: db.pendingMigrations.length > 0 ? 'CRITICAL' : 'WARNING',
        source: 'database',
        detail: `не применено на диске: ${db.pendingMigrations.join(', ') || '—'}; неизвестных базе: ${db.unknownMigrations.join(', ') || '—'}; rolled_back: ${db.rolledBackMigrations}`,
        since: null,
        operatorAction:
          'Сверить образ и базу: миграции применяются только на старте контейнера (prisma migrate deploy); migrate dev / resolve на бою запрещены.',
      });
  }

  // ── metrikaApi ────────────────────────────────────────────────────────────
  const lastSyncErr = input.sync.lastRun?.lastError ?? null;
  const cls = errorClass(lastSyncErr);
  if (!input.flags.metrikaConfigured) {
    sub.metrikaApi = {
      state: 'DISABLED',
      detail:
        'счётчик или токен не заданы — аналитика без данных, CRM работает',
    };
    add({
      code: 'METRIKA_NOT_CONFIGURED',
      severity: 'WARNING',
      source: 'metrikaApi',
      detail:
        'YANDEX_METRIKA_COUNTER_ID / YANDEX_METRIKA_OAUTH_TOKEN не заданы (значения не раскрываются)',
      since: null,
      operatorAction:
        'Задать переменные в .env и пересоздать backend; до этого синхронизация и очередь заказов ждут.',
    });
  } else if (
    input.sync.lastRun?.status === 'FAILED' &&
    (cls === 'unauthorized' || cls === 'forbidden')
  ) {
    sub.metrikaApi = {
      state: 'FAILED',
      detail: `последний ответ Метрики: ${cls}`,
    };
  } else if (input.sync.lastRun?.status === 'FAILED' && cls) {
    sub.metrikaApi = {
      state: 'DEGRADED',
      detail: `последний ответ Метрики: ${cls}`,
    };
  } else {
    sub.metrikaApi = { state: 'HEALTHY', detail: 'последний обмен без ошибок' };
  }

  // ── metrikaAnalyticsSync ─────────────────────────────────────────────────
  const dataAge = age(input.sync.lastSuccessAt, now);
  const runningAge = age(input.sync.oldestRunningStartedAt, now);
  if (!input.flags.analyticsSyncEnabled) {
    sub.metrikaAnalyticsSync = {
      state: 'DISABLED',
      detail: 'расписание выключено (YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED)',
    };
  } else if (!input.flags.metrikaConfigured) {
    sub.metrikaAnalyticsSync = {
      state: 'DISABLED',
      detail: 'клиент Метрики не настроен — расписание не запущено',
    };
  } else {
    if (runningAge !== null && runningAge > T.syncStuckSeconds) {
      add({
        code: 'METRIKA_SYNC_STUCK',
        severity: 'CRITICAL',
        source: 'metrikaAnalyticsSync',
        detail: `запуск в статусе RUNNING уже ${fmtAge(runningAge)} (порог ${fmtAge(T.syncStuckSeconds)})`,
        since: iso(input.sync.oldestRunningStartedAt),
        operatorAction:
          'Следующая синхронизация закроет строку как FAILED сама (этап 07); если контейнер жив и тиков нет — проверить лог и перезапустить backend.',
      });
    }
    if (
      input.sync.lastRun &&
      (input.sync.lastRun.status === 'FAILED' ||
        input.sync.lastRun.status === 'PARTIAL')
    ) {
      add({
        code: 'METRIKA_SYNC_FAILED',
        severity:
          dataAge !== null && dataAge > T.syncCriticalSeconds
            ? 'CRITICAL'
            : 'WARNING',
        source: 'metrikaAnalyticsSync',
        detail: `последний запуск (${input.sync.lastRun.trigger}) — ${input.sync.lastRun.status}${cls ? `, класс ошибки ${cls}` : ''}; неудачных за 24 ч: ${input.sync.failedLast24h}`,
        since: iso(input.sync.lastRun.startedAt),
        operatorAction:
          cls === 'unauthorized' || cls === 'forbidden'
            ? 'Проверить токен и права доступа к счётчику (runbook ротации секретов); повторы бессмысленны.'
            : 'Дождаться следующего тика; если FAILED повторяется — смотреть lastError в журнале MetrikaSyncRun.',
      });
    }
    if (dataAge !== null && dataAge > T.syncStaleSeconds) {
      add({
        code: 'METRIKA_SYNC_STALE',
        severity: dataAge > T.syncCriticalSeconds ? 'CRITICAL' : 'WARNING',
        source: 'metrikaAnalyticsSync',
        detail: `последняя успешная синхронизация ${fmtAge(dataAge)} назад (порог ${fmtAge(T.syncStaleSeconds)})`,
        since: iso(input.sync.lastSuccessAt),
        operatorAction:
          'Проверить, жив ли планировщик (лог «scheduler:hourly») и отвечает ли Метрика; данные дашборда устарели, но читаются.',
      });
    } else if (dataAge === null) {
      add({
        code: 'METRIKA_SYNC_STALE',
        severity: 'WARNING',
        source: 'metrikaAnalyticsSync',
        detail: 'успешных синхронизаций ещё не было',
        since: null,
        operatorAction:
          'Дождаться первого тика после старта (через ~90 с) или запустить metrika:sync вручную.',
      });
    }
    const failed = conditions.some((c) => c.code === 'METRIKA_SYNC_FAILED');
    const stale = conditions.some((c) => c.code === 'METRIKA_SYNC_STALE');
    const stuck = conditions.some((c) => c.code === 'METRIKA_SYNC_STUCK');
    sub.metrikaAnalyticsSync = stuck
      ? {
          state: 'FAILED',
          detail: `RUNNING ${fmtAge(runningAge)} — зависший запуск`,
        }
      : failed && input.sync.runningCount > 0
        ? { state: 'RECOVERING', detail: 'после неудачи идёт новый запуск' }
        : failed
          ? {
              state: 'FAILED',
              detail: `последний запуск ${input.sync.lastRun?.status ?? 'FAILED'}`,
            }
          : stale
            ? { state: 'STALE', detail: `данные ${fmtAge(dataAge)} назад` }
            : {
                state: 'HEALTHY',
                detail: `данные ${fmtAge(dataAge)} назад, последний день ${input.sync.lastDataDay ?? '—'}`,
              };
  }

  // ── metrikaOrdersOutbox ──────────────────────────────────────────────────
  const ob = input.outbox;
  const oldestPendingAge = age(ob.oldestPendingAt, now);
  const oldestFailedAge = age(ob.oldestFailedAt, now);
  const processingAge = age(ob.oldestProcessingLockedAt, now);
  if (!input.flags.ordersSyncEnabled) {
    sub.metrikaOrdersOutbox = {
      state: 'DISABLED',
      detail: `отправка выключена (YANDEX_METRIKA_ORDERS_SYNC_ENABLED); в очереди pending ${ob.pending}`,
    };
  } else {
    if (ob.failed > 0)
      add({
        code: 'OUTBOX_FAILED',
        severity: 'WARNING',
        source: 'metrikaOrdersOutbox',
        detail: `failed ${ob.failed}, старейшая ${fmtAge(oldestFailedAge)}; failed блокирует более поздние переходы того же заказа`,
        since: iso(ob.oldestFailedAt),
        operatorAction:
          'metrika:orders:status → причина; после устранения (токен, права, файл) — requeue, либо skip.',
      });
    if (
      ob.pending > T.outboxBacklogPending ||
      (oldestPendingAge !== null &&
        oldestPendingAge > T.outboxBacklogOldestSeconds)
    )
      add({
        code: 'OUTBOX_BACKLOG',
        severity: 'WARNING',
        source: 'metrikaOrdersOutbox',
        detail: `pending ${ob.pending}, старейшая ${fmtAge(oldestPendingAge)} (пороги ${T.outboxBacklogPending} / ${fmtAge(T.outboxBacklogOldestSeconds)})`,
        since: iso(ob.oldestPendingAt),
        operatorAction:
          'Проверить, работает ли воркер (лог каждые 30 с) и не молчит ли Метрика (429/5xx → повторы по расписанию).',
      });
    if (
      processingAge !== null &&
      processingAge > T.outboxStuckProcessingSeconds
    )
      add({
        code: 'OUTBOX_STUCK',
        severity: 'WARNING',
        source: 'metrikaOrdersOutbox',
        detail: `processing держится ${fmtAge(processingAge)} (порог ${fmtAge(T.outboxStuckProcessingSeconds)})`,
        since: iso(ob.oldestProcessingLockedAt),
        operatorAction:
          'Воркер вернёт строку в pending сам при следующем проходе; если нет — backend не запущен.',
      });
    sub.metrikaOrdersOutbox = conditions.some((c) => c.code === 'OUTBOX_FAILED')
      ? { state: 'FAILED', detail: `failed ${ob.failed}` }
      : conditions.some(
            (c) => c.code === 'OUTBOX_BACKLOG' || c.code === 'OUTBOX_STUCK',
          )
        ? {
            state: 'DEGRADED',
            detail: `pending ${ob.pending}, processing ${ob.processing}`,
          }
        : {
            state: 'HEALTHY',
            detail: `pending ${ob.pending}, delivered ${ob.delivered}, skipped ${ob.skipped}`,
          };
  }

  // ── periodSnapshots ──────────────────────────────────────────────────────
  const snapAge = age(input.snapshots.lastFetchedAt, now);
  if (!input.flags.analyticsSyncEnabled || !input.flags.metrikaConfigured) {
    sub.periodSnapshots = {
      state: 'DISABLED',
      detail: 'обновляются только тиком расписания',
    };
  } else if (snapAge === null || snapAge > T.snapshotStaleSeconds) {
    add({
      code: 'SNAPSHOT_STALE',
      severity: 'WARNING',
      source: 'periodSnapshots',
      detail: `снимки пресетов обновлялись ${fmtAge(snapAge)} назад (порог ${fmtAge(T.snapshotStaleSeconds)})`,
      since: iso(input.snapshots.lastFetchedAt),
      operatorAction:
        'Снимки обновляются после каждого тика; если синхронизация здорова, а снимки нет — смотреть лог MetrikaPeriodSnapshotService.',
    });
    sub.periodSnapshots = {
      state: 'STALE',
      detail: `${input.snapshots.count} снимков, обновление ${fmtAge(snapAge)} назад`,
    };
  } else {
    sub.periodSnapshots = {
      state: 'HEALTHY',
      detail: `${input.snapshots.count} снимков, обновление ${fmtAge(snapAge)} назад`,
    };
  }

  // ── analyticsDashboard / behaviorAnalytics ───────────────────────────────
  sub.analyticsDashboard = input.flags.dashboardEnabled
    ? { state: 'HEALTHY', detail: 'раздел включён; читает только Postgres' }
    : {
        state: 'DISABLED',
        detail: 'ANALYTICS_DASHBOARD_ENABLED=false — API 404, пункт меню скрыт',
      };
  sub.behaviorAnalytics = !input.flags.dashboardEnabled
    ? { state: 'DISABLED', detail: 'вместе с дашбордом' }
    : sub.metrikaAnalyticsSync?.state === 'STALE' ||
        sub.metrikaAnalyticsSync?.state === 'FAILED'
      ? {
          state: 'STALE',
          detail:
            'данные поведения — те же дневные агрегаты, что у синхронизации',
        }
      : { state: 'HEALTHY', detail: 'правила этапа 10 считаются из агрегатов' };

  // ── growthEvaluations ────────────────────────────────────────────────────
  const growthAge = age(input.growth.lastScheduledEvaluationAt, now);
  if (!input.flags.growthEnabled || !input.flags.dashboardEnabled) {
    sub.growthEvaluations = {
      state: 'DISABLED',
      detail: 'ANALYTICS_GROWTH_ENABLED=false — хук не подключён',
    };
  } else if (
    input.growth.activeChanges > 0 &&
    input.flags.analyticsSyncEnabled &&
    (growthAge === null || growthAge > T.growthLagSeconds)
  ) {
    add({
      code: 'GROWTH_RUN_FAILED',
      severity: 'WARNING',
      source: 'growthEvaluations',
      detail: `активных изменений ${input.growth.activeChanges}, последняя автооценка ${fmtAge(growthAge)} назад (порог ${fmtAge(T.growthLagSeconds)})`,
      since: iso(input.growth.lastScheduledEvaluationAt),
      operatorAction:
        'Хук growth:evaluate идёт после успешного тика раз в новый день; смотреть лог «Рост: автооценка» и ошибки хука.',
    });
    sub.growthEvaluations = {
      state: 'DEGRADED',
      detail: `автооценка отстаёт: ${fmtAge(growthAge)}`,
    };
  } else {
    sub.growthEvaluations = {
      state: 'HEALTHY',
      detail: `активных изменений ${input.growth.activeChanges}, автооценка ${fmtAge(growthAge)} назад`,
    };
  }

  // ── automatedInsights ────────────────────────────────────────────────────
  const ins = input.insights;
  const insRunningAge = age(ins.oldestRunningStartedAt, now);
  const insSuccessAge = age(ins.lastSuccessAt, now);
  if (!input.flags.insightsEnabled || !input.flags.dashboardEnabled) {
    sub.automatedInsights = {
      state: 'DISABLED',
      detail:
        'ANALYTICS_INSIGHTS_ENABLED=false — API 404 до валидации, хук не подключён',
    };
  } else {
    if (insRunningAge !== null && insRunningAge > T.insightsStuckSeconds)
      add({
        code: 'INSIGHTS_RUN_STUCK',
        severity: 'WARNING',
        source: 'automatedInsights',
        detail: `запуск RUNNING уже ${fmtAge(insRunningAge)} (замок ${fmtAge(T.insightsStuckSeconds)})`,
        since: iso(ins.oldestRunningStartedAt),
        operatorAction:
          'Следующий запуск закроет строку как FAILED и продолжит сам (идемпотентно); вмешательство не требуется.',
      });
    if (ins.lastRun?.status === 'FAILED')
      add({
        code: 'INSIGHTS_RUN_FAILED',
        severity: 'WARNING',
        source: 'automatedInsights',
        detail: `последний запуск ${ins.lastRun.kind} — FAILED: ${
          ins.lastRun.errors
            .map((e) => sanitizeError(e))
            .join('; ')
            .slice(0, 160) || 'без текста'
        }`,
        since: iso(ins.lastRun.startedAt),
        operatorAction:
          'Синхронизация от этого не страдает; смотреть errors в AnalyticsInsightRun, следующий тик повторит запуск.',
      });
    const stuck = conditions.some((c) => c.code === 'INSIGHTS_RUN_STUCK');
    const failed = conditions.some((c) => c.code === 'INSIGHTS_RUN_FAILED');
    sub.automatedInsights = stuck
      ? { state: 'FAILED', detail: `RUNNING ${fmtAge(insRunningAge)}` }
      : failed && ins.oldestRunningStartedAt
        ? { state: 'RECOVERING', detail: 'после FAILED идёт новый запуск' }
        : failed
          ? { state: 'FAILED', detail: 'последний запуск FAILED' }
          : insSuccessAge !== null &&
              insSuccessAge > T.insightsStaleSeconds &&
              input.flags.analyticsSyncEnabled
            ? {
                state: 'STALE',
                detail: `последний успешный запуск ${fmtAge(insSuccessAge)} назад`,
              }
            : {
                state: 'HEALTHY',
                detail: `активных карточек ${ins.openCards}, последний запуск ${ins.lastRun ? `${ins.lastRun.kind} ${fmtAge(age(ins.lastRun.startedAt, now))} назад` : 'ещё не было'}`,
              };
  }

  const order: Record<'CRITICAL' | 'WARNING', number> = {
    CRITICAL: 0,
    WARNING: 1,
  };
  conditions.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] || a.code.localeCompare(b.code),
  );

  return {
    generatedAt: now.toISOString(),
    timezone: 'Europe/Moscow',
    build: input.build,
    flags: input.flags,
    subsystems: sub as Record<SubsystemKey, OpsSubsystem>,
    conditions,
    thresholds: { ...T },
    database: {
      reachable: db.reachable,
      appliedMigrations: db.appliedMigrations,
      lastMigration: db.lastMigration,
      pendingMigrations: db.pendingMigrations,
      unknownMigrations: db.unknownMigrations,
      rolledBackMigrations: db.rolledBackMigrations,
    },
    sync: {
      lastSuccessAt: iso(input.sync.lastSuccessAt),
      dataAgeSeconds: dataAge,
      lastDataDay: input.sync.lastDataDay,
      lastRunStatus: input.sync.lastRun?.status ?? null,
      lastRunTrigger: input.sync.lastRun?.trigger ?? null,
      lastError: sanitizeError(lastSyncErr),
      runningCount: input.sync.runningCount,
      oldestRunningAgeSeconds: runningAge,
      failedLast24h: input.sync.failedLast24h,
    },
    outbox: {
      pending: ob.pending,
      processing: ob.processing,
      failed: ob.failed,
      delivered: ob.delivered,
      skipped: ob.skipped,
      oldestPendingAgeSeconds: oldestPendingAge,
      oldestFailedAgeSeconds: oldestFailedAge,
      lastDeliveredAt: iso(ob.lastDeliveredAt),
    },
    snapshots: {
      count: input.snapshots.count,
      lastFetchedAt: iso(input.snapshots.lastFetchedAt),
      ageSeconds: snapAge,
    },
    growth: {
      activeChanges: input.growth.activeChanges,
      lastScheduledEvaluationAt: iso(input.growth.lastScheduledEvaluationAt),
      ageSeconds: growthAge,
    },
    insights: {
      lastRunKind: ins.lastRun?.kind ?? null,
      lastRunStatus: ins.lastRun?.status ?? null,
      lastRunAt: iso(ins.lastRun?.startedAt ?? null),
      lastSuccessAt: iso(ins.lastSuccessAt),
      lastErrors: (ins.lastRun?.errors ?? [])
        .map((e) => sanitizeError(e) ?? '')
        .filter(Boolean),
      oldestRunningAgeSeconds: insRunningAge,
      openCards: ins.openCards,
    },
  };
}
