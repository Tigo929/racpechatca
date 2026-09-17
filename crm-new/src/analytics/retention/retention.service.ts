import type { PrismaService } from '../../prisma/prisma.service';
import {
  ageField,
  planRetention,
  type RetentionPlan,
  type RetentionRule,
} from './retention-policy';

/** Минимальный срез Prisma, который нужен политике хранения. */
export type RetentionPrisma = Pick<
  PrismaService,
  'metrikaSyncRun' | 'analyticsInsightRun' | 'metrikaOrderOutbox'
>;

export const RETENTION_APPLY_ENV = 'ANALYTICS_RETENTION_APPLY';

export interface RetentionApplyResult {
  applied: true;
  deleted: {
    table: string;
    statuses: string[];
    cutoff: string;
    rows: number;
  }[];
  totalRows: number;
}

/**
 * Dry-run и (только по явному разрешению) применение политики хранения.
 * Удаляются исключительно завершённые строки журналов старше порога правила;
 * данные, снимки, реестр изменений, карточки и версии не затрагиваются.
 */
export class RetentionService {
  constructor(
    private readonly prisma: RetentionPrisma,
    private readonly now: () => Date = () => new Date(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  /** План без единой записи в базу: только count по каждому правилу. */
  plan(): Promise<RetentionPlan> {
    return planRetention(this.now(), (rule, cutoff) =>
      this.count(rule, cutoff),
    );
  }

  /**
   * Применение. Два независимых условия — флаг вызова и переменная окружения —
   * чтобы ни скрипт, ни человек не удалили ничего «случайно». В production
   * выполняется только отдельным rollout (13_RELIABILITY_SECURITY.md § 13).
   */
  async apply(options: { confirm: boolean }): Promise<RetentionApplyResult> {
    if (!options.confirm)
      throw new Error(
        'Удаление не подтверждено: нужен флаг --apply (без него — только dry-run).',
      );
    if ((this.env[RETENTION_APPLY_ENV] ?? '') !== '1')
      throw new Error(
        `Удаление запрещено окружением: задайте ${RETENTION_APPLY_ENV}=1 только в окне согласованного rollout.`,
      );
    const plan = await this.plan();
    const deleted: RetentionApplyResult['deleted'] = [];
    for (const item of plan.items) {
      if (item.rows === 0) {
        deleted.push({
          table: item.table,
          statuses: item.statuses,
          cutoff: item.cutoff,
          rows: 0,
        });
        continue;
      }
      const result = await this.delete(item, new Date(item.cutoff));
      deleted.push({
        table: item.table,
        statuses: item.statuses,
        cutoff: item.cutoff,
        rows: result,
      });
    }
    return {
      applied: true,
      deleted,
      totalRows: deleted.reduce((s, d) => s + d.rows, 0),
    };
  }

  private where(rule: RetentionRule, cutoff: Date) {
    const field = ageField(rule.table);
    return { status: { in: rule.statuses }, [field]: { lt: cutoff } };
  }

  private count(rule: RetentionRule, cutoff: Date): Promise<number> {
    const where = this.where(rule, cutoff);
    switch (rule.table) {
      case 'MetrikaSyncRun':
        return this.prisma.metrikaSyncRun.count({ where });
      case 'AnalyticsInsightRun':
        return this.prisma.analyticsInsightRun.count({ where });
      case 'MetrikaOrderOutbox':
        return this.prisma.metrikaOrderOutbox.count({ where });
    }
  }

  private async delete(rule: RetentionRule, cutoff: Date): Promise<number> {
    const where = this.where(rule, cutoff);
    switch (rule.table) {
      case 'MetrikaSyncRun':
        return (await this.prisma.metrikaSyncRun.deleteMany({ where })).count;
      case 'AnalyticsInsightRun':
        return (await this.prisma.analyticsInsightRun.deleteMany({ where }))
          .count;
      case 'MetrikaOrderOutbox':
        return (await this.prisma.metrikaOrderOutbox.deleteMany({ where }))
          .count;
    }
  }
}
