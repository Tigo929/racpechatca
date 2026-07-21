import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { mapPartnerStage, shouldAdvanceTo } from './partner-status';

const POLL_INTERVAL_MS = 30 * 1000; // каждые 30 секунд — «почти мгновенно»
const POLL_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Тянет статус футболочных заказов из CRM партнёра.
 *
 * Партнёр не шлёт нам смену статуса сам — но у него есть эндпоинт, который
 * отдаёт производственную стадию по external_request_id. Мы периодически его
 * опрашиваем и двигаем свой заказ вперёд («В работе» / «Готов»). Так синхрон
 * работает без единой правки на стороне партнёра.
 */
@Injectable()
export class PartnerStatusPollService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PartnerStatusPollService.name);
  private readonly statusUrlBase: string;
  private readonly token: string;
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Эндпоинт статуса = базовый вебхук партнёра + /{external_request_id}.
    this.statusUrlBase = (config.get<string>('PARTNER_WEBHOOK_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    this.token = (config.get<string>('PARTNER_WEBHOOK_TOKEN') ?? '').trim();
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.poll().catch((err: unknown) => {
        this.logger.error('Partner status poll failed', err);
      });
    }, POLL_INTERVAL_MS);
    this.startupTimer = setTimeout(() => {
      this.poll().catch((err: unknown) => {
        this.logger.error('Initial partner status poll failed', err);
      });
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  async poll(): Promise<void> {
    if (this.running) return;
    if (!this.statusUrlBase || !this.token) return; // вебхук не настроен
    this.running = true;
    try {
      // Заказы «в руках у партнёра»: доставлены (partnerSyncStatus=SENT) и ещё
      // не закрыты. Рабочий статус может быть любым — владелец мог не двигать
      // его руками (напр. остаться NEW), синхрон всё равно должен работать.
      const orders = await this.prisma.orderPhoto.findMany({
        where: {
          productCategory: 'TSHIRT',
          partnerSyncStatus: 'SENT',
          externalRequestId: { not: null },
          status: { notIn: [EnumStatus.PAID, EnumStatus.CANCELLED] },
        },
        take: POLL_LIMIT,
        select: {
          id: true,
          numberOrder: true,
          status: true,
          externalRequestId: true,
        },
      });

      for (const order of orders) {
        const stage = await this.fetchStage(order.externalRequestId!);
        if (!stage) continue;
        const target = mapPartnerStage(stage);
        if (!target) continue;
        if (!shouldAdvanceTo(order.status, target)) continue;

        await this.prisma.$transaction([
          this.prisma.statusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: target,
              changedBy: 'partner-poll',
            },
          }),
          this.prisma.orderPhoto.update({
            where: { id: order.id },
            data: { status: target, statusChangedAt: new Date() },
          }),
        ]);
        this.logger.log(
          `Заказ ${order.numberOrder}: партнёр → «${stage}», статус ${order.status} → ${target}`,
        );
      }
    } finally {
      this.running = false;
    }
  }

  /** Возвращает production_stage партнёра или null при любой ошибке. */
  private async fetchStage(externalRequestId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.statusUrlBase}/${externalRequestId}`, {
        headers: { 'X-Partner-Token': this.token },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        production_stage?: string;
        status?: string;
      };
      return body.production_stage ?? body.status ?? null;
    } catch {
      return null;
    }
  }
}
