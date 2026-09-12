import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { calendarDateIn, rollingWindow, type DateRange } from './metrika-dates';
import type { MetrikaAnalyticsSyncService } from './metrika-analytics-sync.service';

/**
 * Расписание синхронизации отчётов (этап 07, разделы 19 и 21).
 *
 * Каждый час пересчитывается скользящее окно в 3 дня: данные Метрики
 * дозревают (data lag), цели доатрибутируются, заказы из CRM
 * сопоставляются с визитами позже самого визита. Раз в сутки окно
 * расширяется до 21 дня — ровно на глубину сопоставления заказов CRM с
 * ClientID в Метрике: оплата, пришедшая через две недели после визита,
 * меняет цифры того визита.
 *
 * Суточный пересчёт заменяет часовой (21 день включает 3), а не идёт
 * рядом. Он запускается первым тиком нового московского дня, для
 * которого его ещё не было — так после рестарта суточный прогон не
 * теряется и не дублируется.
 *
 * Перекрытий нет: внутри процесса — флаг `running`, между процессами —
 * advisory lock в сервисе синхронизации. Повтор после сбоя — следующий
 * тик: окно скользящее, пропущенный час ничего не теряет.
 *
 * Рубильник YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: выключен — расписания
 * нет, ручная команда `metrika:sync` работает всё равно.
 */

export const HOURLY_WINDOW_DAYS = 3;
export const DAILY_WINDOW_DAYS = 21;
const TICK_INTERVAL_MS = 60 * 60_000;
/** Первый тик — через полторы минуты после старта: приложение уже поднялось, миграции прошли. */
const FIRST_TICK_DELAY_MS = 90_000;

export interface SchedulerOptions {
  enabled: boolean;
  configured: boolean;
}

export type TickKind = 'scheduler:hourly' | 'scheduler:daily';

export interface TickPlan {
  trigger: TickKind;
  range: DateRange;
}

/**
 * Что делать на этом тике: суточный пересчёт, если для сегодняшнего
 * московского числа его ещё не было, иначе часовой.
 */
export function planTick(now: Date, lastDailyDate: string | null): TickPlan {
  const today = calendarDateIn(now);
  if (lastDailyDate !== today) {
    return {
      trigger: 'scheduler:daily',
      range: rollingWindow(DAILY_WINDOW_DAYS, now),
    };
  }
  return {
    trigger: 'scheduler:hourly',
    range: rollingWindow(HOURLY_WINDOW_DAYS, now),
  };
}

@Injectable()
export class MetrikaAnalyticsSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MetrikaAnalyticsSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private firstTick: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  /** Московское число, за которое суточный пересчёт уже прошёл успешно (или частично). */
  private lastDailyDate: string | null = null;

  constructor(
    private readonly sync: MetrikaAnalyticsSyncService,
    private readonly options: SchedulerOptions,
    private readonly now: () => Date = () => new Date(),
  ) {}

  onModuleInit() {
    if (!this.options.enabled) {
      this.logger.log(
        'Метрика: синхронизация отчётов по расписанию выключена (YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED) — только ручной запуск',
      );
      return;
    }
    if (!this.options.configured) {
      this.logger.warn(
        'Метрика: синхронизация отчётов включена, но клиент не настроен (нет счётчика или токена) — расписание не запущено',
      );
      return;
    }
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.firstTick = setTimeout(() => void this.tick(), FIRST_TICK_DELAY_MS);
    this.logger.log(
      `Метрика: синхронизация отчётов по расписанию запущена (каждый час — ${HOURLY_WINDOW_DAYS} дня, раз в сутки — ${DAILY_WINDOW_DAYS} день)`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.firstTick) clearTimeout(this.firstTick);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const plan = planTick(this.now(), this.lastDailyDate);
      const summary = await this.sync.sync({
        range: plan.range,
        trigger: plan.trigger,
      });
      if (
        plan.trigger === 'scheduler:daily' &&
        (summary.status === 'SUCCESS' || summary.status === 'PARTIAL')
      ) {
        this.lastDailyDate = calendarDateIn(this.now());
      }
      if (summary.status === 'FAILED' || summary.status === 'PARTIAL') {
        this.logger.warn(
          `Метрика: тик ${plan.trigger} ${plan.range.from}..${plan.range.to} завершился ${summary.status}${summary.error ? ` — ${summary.error}` : ''}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Метрика: ошибка тика синхронизации отчётов',
        error as Error,
      );
    } finally {
      this.running = false;
    }
  }
}
