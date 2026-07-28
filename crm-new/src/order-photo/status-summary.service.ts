import { Injectable } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { TelegramService } from 'src/telegram/telegram.service';
import { OrderPhotoService } from './order-photo.service';
import { buildStatusSummaryMessage } from './status-summary-rules';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';

export interface StatusSummaryResult {
  sent: boolean;
  message: string;
}

/**
 * Ручная «сводка по заказам» в рабочий чат (Настройки → кнопка «Отправить
 * сейчас»). В отличие от плана дня (10:00, по исполнителям) — это админский
 * снимок всей воронки: столько же раз в день, сколько нужно (обычно утром,
 * чтобы понять фронт работ, и вечером — что сделано).
 */
@Injectable()
export class StatusSummaryService {
  constructor(
    private readonly orderPhotoService: OrderPhotoService,
    private readonly telegram: TelegramService,
  ) {}

  async runNow(
    now: Date = new Date(),
    opts: { dryRun?: boolean } = {},
  ): Promise<StatusSummaryResult> {
    // Пустой запрос + роль ADMIN: полный контекст без сужения по исполнителю,
    // суммы и счётчики отзывов включены (как в getOrderStats для админа).
    const stats = await this.orderPhotoService.getOrderStats(
      new DtoAllOrdersforQuery(),
      '',
      EnumRole.ADMIN,
    );
    const message = buildStatusSummaryMessage(stats, now);

    if (opts.dryRun) {
      return { sent: false, message };
    }

    const sent = await this.telegram.sendToGroup(message);
    return { sent, message };
  }
}
