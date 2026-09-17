/**
 * Политика хранения журналов аналитики (этап 13, раздел 13; RETENTION_POLICY.md).
 *
 * Что растёт и почему: журнал синхронизации Метрики пишет 12 строк каждый
 * час (~288/сутки, ~105 тыс./год), журнал сигналов — 24 строки/сутки,
 * очередь заказов — строка на каждый переход статуса. Всё остальное либо
 * данные (дневные агрегаты — ~200 строк/сутки, хранятся всегда), либо
 * ограничено upsert-ом (снимки пресетов), либо аудит (оценки этапа 11,
 * карточки и версии этапа 12) — не удаляется.
 *
 * Принципы: детерминированно (одинаковый момент → одинаковый план),
 * ошибки хранятся дольше успехов (evidence), удаляются только завершённые
 * строки, dry-run — по умолчанию, реальное удаление — только явным флагом
 * и переменной окружения, на production — только отдельным rollout.
 */

export type RetentionTable =
  | 'MetrikaSyncRun'
  | 'AnalyticsInsightRun'
  | 'MetrikaOrderOutbox';

export interface RetentionRule {
  table: RetentionTable;
  /** Какие статусы попадают под правило. */
  statuses: string[];
  /** Хранить не меньше этого числа дней (по startedAt / processedAt / updatedAt). */
  keepDays: number;
  /** Зачем правило именно такое — для оператора и отчёта. */
  rationale: string;
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    table: 'MetrikaSyncRun',
    statuses: ['SUCCESS'],
    keepDays: 90,
    rationale:
      'успешные часовые запуски: свежесть данных и диагностика смотрят на последние часы, аудит — на квартал',
  },
  {
    table: 'MetrikaSyncRun',
    statuses: ['FAILED', 'PARTIAL'],
    keepDays: 365,
    rationale: 'неудачи — evidence для разбора инцидентов, хранятся год',
  },
  {
    table: 'AnalyticsInsightRun',
    statuses: ['SUCCESS', 'SKIPPED', 'LOCKED'],
    keepDays: 90,
    rationale:
      'часовые запуски движка сигналов без ошибок; карточки и версии (аудит выводов) не трогаются',
  },
  {
    table: 'AnalyticsInsightRun',
    statuses: ['FAILED'],
    keepDays: 365,
    rationale: 'ошибки запусков — evidence, хранятся год',
  },
  {
    table: 'MetrikaOrderOutbox',
    statuses: ['delivered', 'skipped'],
    keepDays: 180,
    rationale:
      'доставленные и пропущенные переходы: сопоставление с uploading_id Метрики нужно полгода; pending / processing / failed не удаляются никогда',
  },
] as const;

/** Таблицы, которые политика не трогает — перечислены явно, чтобы это было решением, а не забытым случаем. */
export const RETENTION_NEVER: readonly { table: string; reason: string }[] = [
  {
    table: 'MetrikaDaily* (12 таблиц агрегатов)',
    reason:
      'это сами данные дашборда; ~200 строк/сутки, пресет 90/365 дней и окна этапов 11–12 читают историю',
  },
  {
    table: 'MetrikaPeriodSnapshot / MetrikaPeriodGoalSnapshot',
    reason: 'ограничены upsert-ом по пресету — не растут',
  },
  {
    table: 'AnalyticsChange / AnalyticsChangeEvaluation',
    reason: 'реестр изменений и неизменяемые версии оценок — аудит этапа 11',
  },
  {
    table: 'AnalyticsInsight / AnalyticsInsightVersion',
    reason:
      'карточки-эпизоды и неизменяемые версии — жизненный цикл и аудит этапа 12',
  },
  {
    table: 'MetrikaOrderOutbox (pending / processing / failed)',
    reason: 'незакрытые переходы; failed ждёт requeue/skip оператора',
  },
];

export interface RetentionPlanItem extends RetentionRule {
  /** Строки старше этого момента подпадают под удаление. */
  cutoff: string;
  rows: number;
}

export interface RetentionPlan {
  generatedAt: string;
  dryRun: true;
  items: RetentionPlanItem[];
  totalRows: number;
  never: typeof RETENTION_NEVER;
}

const DAY_MS = 86_400_000;

export function cutoffFor(rule: RetentionRule, now: Date): Date {
  return new Date(now.getTime() - rule.keepDays * DAY_MS);
}

/** Поле времени, по которому считается возраст строки. */
export function ageField(table: RetentionTable): 'startedAt' | 'processedAt' {
  return table === 'MetrikaOrderOutbox' ? 'processedAt' : 'startedAt';
}

/** Счётчик подходящих строк — единственное, что план читает из базы. */
export type RetentionCounter = (
  rule: RetentionRule,
  cutoff: Date,
) => Promise<number>;

export async function planRetention(
  now: Date,
  count: RetentionCounter,
): Promise<RetentionPlan> {
  const items: RetentionPlanItem[] = [];
  for (const rule of RETENTION_RULES) {
    const cutoff = cutoffFor(rule, now);
    items.push({
      ...rule,
      cutoff: cutoff.toISOString(),
      rows: await count(rule, cutoff),
    });
  }
  return {
    generatedAt: now.toISOString(),
    dryRun: true,
    items,
    totalRows: items.reduce((s, i) => s + i.rows, 0),
    never: RETENTION_NEVER,
  };
}

/**
 * Прогноз роста журналов без удаления (для RETENTION_POLICY.md): строк в сутки
 * по факту production 09.2026 и байт на строку из pg_total_relation_size.
 */
export const GROWTH_MODEL = {
  MetrikaSyncRun: { rowsPerDay: 288, bytesPerRow: 480 },
  AnalyticsInsightRun: { rowsPerDay: 24, bytesPerRow: 3000 },
  MetrikaOrderOutbox: { rowsPerDay: 5, bytesPerRow: 2400 },
  'MetrikaDaily*': { rowsPerDay: 196, bytesPerRow: 400 },
} as const;

export function forecastBytes(
  table: keyof typeof GROWTH_MODEL,
  days: number,
): number {
  const m = GROWTH_MODEL[table];
  return m.rowsPerDay * m.bytesPerRow * days;
}
