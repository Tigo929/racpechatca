import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EnumCommunication } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { GREETING_MAX_AGE_MS, SITE_LEAD_PREFIX } from './client-greeting.service';
import {
  GREETING_STUCK_AFTER_MS,
  greetingStuckMessage,
  shouldAlertGreetingStuck,
} from './greeting-stuck';

/** Как часто смотрим на очередь приветствий. */
const SCAN_MS = 10 * 60 * 1000;

/** Первый заход — не в момент запуска: дайте приложению подняться. */
const FIRST_SCAN_MS = 60 * 1000;

/** Сколько заказов называем в сообщении: длинный список не читают. */
const LIST_LIMIT = 10;

/**
 * Сторож первых сообщений клиентам.
 *
 * Отправляет их воркер от лица рабочего аккаунта — бот Telegram писать
 * первым не может. Аккаунт отваливается (отозвали сессию, упал контейнер),
 * и до сих пор это происходило молча: заявки лежали в CRM как обычно, а
 * людям никто не отвечал. Дважды подряд выяснялось случайно, через
 * несколько дней.
 *
 * Чинить отправку отсюда нельзя — доступа к личному аккаунту в CRM нет и
 * быть не должно. Зато отсюда видно очередь, и молчание можно сделать
 * слышным: это и есть вся задача сторожа.
 */
@Injectable()
export class GreetingWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GreetingWatchdogService.name);
  private timer?: NodeJS.Timeout;
  private firstRun?: NodeJS.Timeout;
  private lastAlertAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.scan(), SCAN_MS);
    this.timer.unref();
    this.firstRun = setTimeout(() => void this.scan(), FIRST_SCAN_MS);
    this.firstRun.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    clearTimeout(this.firstRun);
  }

  /**
   * Кому должны были написать и не написали.
   *
   * Окно с двух сторон. Снизу — четверть часа: живой воркер отвечает за
   * секунды, и всё, что висит дольше, он не взял. Сверху — тот же срок
   * давности, по которому работает сама очередь: заявку старше его уже
   * не приветствуют, и тревожить о ней бессмысленно.
   *
   * Возвращает, о скольких сказали, — по этому числу сторожа и проверяют.
   */
  async scan(now: Date = new Date()): Promise<number> {
    let stuck: { numberOrder: string }[];
    try {
      stuck = await this.prisma.orderPhoto.findMany({
        where: {
          clientGreetedAt: null,
          communicationPlatform: EnumCommunication.TELEGRAM,
          externalRequestId: { startsWith: SITE_LEAD_PREFIX },
          createdAt: {
            gte: new Date(now.getTime() - GREETING_MAX_AGE_MS),
            lte: new Date(now.getTime() - GREETING_STUCK_AFTER_MS),
          },
        },
        orderBy: { createdAt: 'asc' },
        take: LIST_LIMIT,
        select: { numberOrder: true },
      });
    } catch (error) {
      // База недоступна — это чужая беда, и о ней скажут другие. Падать
      // здесь нельзя: сторож должен пережить её и проверить снова.
      this.logger.warn(`Не удалось проверить очередь приветствий: ${String(error)}`);
      return 0;
    }

    if (stuck.length === 0) {
      // Очередь разошлась: забываем прошлую тревогу, чтобы следующий
      // отказ прозвучал сразу, а не через шесть часов тишины.
      this.lastAlertAt = null;
      return 0;
    }

    if (!shouldAlertGreetingStuck({ stuck: stuck.length, lastAlertAt: this.lastAlertAt, now })) {
      return 0;
    }

    const orders = stuck.map((row) => row.numberOrder);
    this.logger.warn(
      `Приветствия не уходят: ждут ${orders.length} заявок (${orders.join(', ')})`,
    );
    try {
      await this.telegram.sendLeadAlert(greetingStuckMessage(orders));
    } catch (error) {
      // Не сказали — скажем на следующем заходе: отметку ставим только
      // после успеха, иначе один сбой связи похоронил бы тревогу.
      this.logger.warn(`Не удалось сообщить о приветствиях: ${String(error)}`);
      return 0;
    }
    this.lastAlertAt = now;
    return orders.length;
  }
}
