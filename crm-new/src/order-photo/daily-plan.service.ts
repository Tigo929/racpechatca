import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EnumProductCategory } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { moscowDateKey } from 'src/tasks/task-reminder-rules';
import {
  PLAN_IN_WORK_STATUSES,
  PlanGroup,
  buildDailyPlanMessage,
  isWithinPlanWindow,
} from './daily-plan-rules';

const SCAN_INTERVAL_MS = 60 * 60 * 1000;
const STATE_ID = 'default';

export interface PlanResult {
  empty: boolean;
  sent: boolean;
  orderCount: number;
  message: string | null;
}

/**
 * Раз в день (10:00 по Москве) шлёт в рабочий чат «план дня»: по каждому
 * исполнителю — его заказы в работе, сначала срочные/горящие. Уходит в общую
 * группу (тема General), рядом с уведомлениями о назначении заказов.
 *
 * Проверка ежечасная и догоняет пропуск (перезагрузка в 10:00 не съедает день),
 * а отметка о дне последней отправки лежит в AppState — рестарт не даёт
 * повторной рассылки.
 */
@Injectable()
export class DailyPlanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyPlanService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Daily plan scan failed', err);
      });
    }, SCAN_INTERVAL_MS);

    this.startupTimer = setTimeout(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Initial daily plan scan failed', err);
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  /** Плановый путь: окно 10:00–21:59 по Москве + защита от повтора за день. */
  async scanAndNotify(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      if (!isWithinPlanWindow(now)) return;
      const todayKey = moscowDateKey(now);

      const state = await this.prisma.appState.findUnique({
        where: { id: STATE_ID },
      });
      if (state?.dailyPlanLastSentOn === todayKey) return;

      const result = await this.buildAndSend(now);

      // Пусто — помечаем день обработанным, чтобы не сканировать до вечера.
      if (result.empty) {
        await this.markSent(todayKey);
        return;
      }
      if (!result.sent) {
        this.logger.warn('Daily plan not delivered, will retry next hour');
        return;
      }
      await this.markSent(todayKey);
      this.logger.log(`Daily plan sent: ${result.orderCount} order(s)`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Ручной запуск (админский эндпоинт): шлём сейчас, игнорируя окно/дедуп.
   * dryRun=true — только собрать текст и вернуть, ничего не отправляя.
   */
  async runNow(
    now: Date = new Date(),
    opts: { dryRun?: boolean } = {},
  ): Promise<PlanResult> {
    if (opts.dryRun) {
      const built = await this.buildPlan(now);
      return { ...built, sent: false };
    }
    const result = await this.buildAndSend(now);
    if (!result.empty && result.sent) {
      await this.markSent(moscowDateKey(now));
    }
    return result;
  }

  /** Собирает план из заказов в работе и шлёт в группу (тема General). */
  private async buildAndSend(now: Date): Promise<PlanResult> {
    const built = await this.buildPlan(now);
    if (built.empty || built.message === null) {
      return { ...built, sent: false };
    }
    const sent = await this.telegram.sendToGroup(built.message);
    return { ...built, sent };
  }

  /** Формирует текст плана из заказов в работе (без отправки). */
  private async buildPlan(
    now: Date,
  ): Promise<Omit<PlanResult, 'sent'>> {
    const [orders, unassignedCount] = await Promise.all([
      this.prisma.orderPhoto.findMany({
        where: {
          executorId: { not: null },
          productCategory: EnumProductCategory.PHOTO,
          status: { in: PLAN_IN_WORK_STATUSES },
        },
        select: {
          numberOrder: true,
          deadline: true,
          createdAt: true,
          isUrgent: true,
          executorId: true,
          executor: { select: { username: true, telegramUsername: true } },
          items: { select: { formatPaper: true, quantity: true } },
        },
      }),
      this.prisma.orderPhoto.count({
        where: {
          executorId: null,
          productCategory: EnumProductCategory.PHOTO,
          status: { in: PLAN_IN_WORK_STATUSES },
        },
      }),
    ]);

    const byExecutor = new Map<string, PlanGroup>();
    for (const order of orders) {
      if (!order.executorId || !order.executor) continue;
      let group = byExecutor.get(order.executorId);
      if (!group) {
        group = { executor: order.executor, orders: [] };
        byExecutor.set(order.executorId, group);
      }
      group.orders.push({
        numberOrder: order.numberOrder,
        deadline: order.deadline,
        createdAt: order.createdAt,
        isUrgent: order.isUrgent,
        items: order.items,
      });
    }

    const groups = [...byExecutor.values()];
    if (groups.length === 0 && unassignedCount === 0) {
      return { empty: true, orderCount: 0, message: null };
    }

    const message = buildDailyPlanMessage(groups, now, unassignedCount);
    return { empty: false, orderCount: orders.length, message };
  }

  private async markSent(dayKey: string) {
    await this.prisma.appState.upsert({
      where: { id: STATE_ID },
      update: { dailyPlanLastSentOn: dayKey },
      create: { id: STATE_ID, dailyPlanLastSentOn: dayKey },
    });
  }
}
