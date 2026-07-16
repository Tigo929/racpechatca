import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EnumPartnerSyncStatus,
  EnumPrintLocation,
  EnumPrintType,
  EnumProductCategory,
} from 'src/generated/prisma/enums';

/**
 * Интеграция с CRM партнёра CoolABC — внешняя печать футболок.
 *
 * Контракт (GET {url}/contract): POST c X-CRM-API-Token, 201 при успехе.
 * Один запрос = одна модель+цвет+макет с массивом размеров, поэтому позиции
 * заказа группируются по (цвет, макет, место печати, метод) — на каждую
 * группу отдельный запрос. Идемпотентность — по external_request_id.
 */
@Injectable()
export class CoolabcService {
  private readonly logger = new Logger(CoolabcService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Пустая строка в env (например, из docker-compose) — считаем «не задано».
    this.apiUrl =
      config.get<string>('COOLABC_API_URL') ||
      'https://coolabc.ru/crm/api/integrations/tshirt-print-orders';
    this.apiToken = config.get<string>('COOLABC_API_TOKEN') || '';
  }

  get isConfigured(): boolean {
    return this.apiToken.length > 0;
  }

  /**
   * Отправляет заказ партнёру и сохраняет результат в partnerSync-полях.
   * Ошибки валидации/сети/HTTP не бросаются, а фиксируются в заказе
   * (FAILED + текст), чтобы их было видно в интерфейсе и можно было
   * исправить данные и отправить повторно.
   */
  async sendOrder(orderId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new BadRequestException(
        'Партнёру отправляются только заказы с футболками',
      );
    }

    // Ключ идемпотентности создаём один раз; при повторной отправке
    // переиспользуем, чтобы у партнёра не появились дубли заявок.
    const externalRequestId = order.externalRequestId ?? randomUUID();

    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        externalRequestId,
        partnerSyncStatus: EnumPartnerSyncStatus.PENDING,
        partnerSyncError: null,
      },
    });

    if (!this.isConfigured) {
      return this.markFailed(
        orderId,
        'COOLABC_API_TOKEN не задан — отправка партнёру отключена',
      );
    }

    const validationError = this.validateForPartner(order);
    if (validationError) return this.markFailed(orderId, validationError);

    const groups = this.groupItems(order.tshirtItems);
    const partnerOrderNos: string[] = [];
    const trackingUrls: string[] = [];

    for (let i = 0; i < groups.length; i++) {
      const payload = this.buildPayload(
        order,
        groups[i],
        // Суффикс группы делает id уникальным для каждого макета/цвета и
        // стабильным между повторными отправками (группы отсортированы).
        `${externalRequestId}-g${i + 1}`,
      );

      try {
        const res = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CRM-API-Token': this.apiToken,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15_000),
        });

        const rawBody = await res.text();
        if (!res.ok) {
          this.logger.error(
            `CoolABC: заказ ${order.numberOrder} (группа ${i + 1}/${groups.length}) не принят [${res.status}]: ${rawBody.slice(0, 300)}`,
          );
          return this.markFailed(
            orderId,
            this.describeHttpError(res.status, rawBody, i + 1, groups.length),
            partnerOrderNos,
            trackingUrls,
          );
        }

        const parsed = this.parseAccepted(rawBody);
        if (parsed.orderNo) partnerOrderNos.push(parsed.orderNo);
        if (parsed.trackingUrl) trackingUrls.push(parsed.trackingUrl);
      } catch (err) {
        const message =
          err instanceof Error && err.name === 'TimeoutError'
            ? 'Партнёр не ответил за 15 секунд'
            : err instanceof Error
              ? err.message
              : String(err);
        this.logger.error(
          `CoolABC: сетевая ошибка при отправке заказа ${order.numberOrder}: ${message}`,
        );
        return this.markFailed(orderId, message, partnerOrderNos, trackingUrls);
      }
    }

    this.logger.log(
      `CoolABC: заказ ${order.numberOrder} отправлен → ${partnerOrderNos.join(', ') || 'номер не получен'}`,
    );
    return this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.SENT,
        partnerSyncAt: new Date(),
        partnerSyncError: null,
        partnerOrderNo: partnerOrderNos.join(', ') || null,
        partnerTrackingUrl: trackingUrls.join(', ') || null,
      },
    });
  }

  /** Проверка обязательных полей контракта до отправки — с понятной ошибкой. */
  private validateForPartner(order: {
    clientName: string | null;
    clientPhone: string | null;
    tshirtModel: string | null;
    tshirtItems: { color: string; size: string; designUrl: string | null }[];
  }): string | null {
    const missing: string[] = [];
    if ((order.clientName ?? '').trim().length < 2) {
      missing.push('имя клиента');
    }
    if ((order.clientPhone ?? '').trim().length < 5) {
      missing.push('телефон клиента');
    }
    if ((order.tshirtModel ?? '').trim().length < 2) {
      missing.push('модель футболки');
    }
    if (order.tshirtItems.length === 0) {
      missing.push('позиции-футболки (свободные позиции не отправляются)');
    }
    for (const item of order.tshirtItems) {
      if (!item.designUrl?.startsWith('https://')) {
        missing.push(
          `HTTPS-ссылка на макет у позиции «${item.color}, ${item.size}»`,
        );
        break;
      }
    }
    return missing.length > 0
      ? `Для отправки партнёру не хватает: ${missing.join('; ')}. Заполните через «Изменить» и отправьте повторно.`
      : null;
  }

  /** Одна группа = один запрос партнёру: общий цвет, макет, место и метод печати. */
  private groupItems(
    items: {
      color: string;
      size: string;
      printLocation: EnumPrintLocation;
      printType: EnumPrintType;
      quantity: number;
      price: number;
      designUrl: string | null;
      designNote: string | null;
      clientItem: boolean;
    }[],
  ) {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = [
        item.color,
        item.designUrl ?? '',
        item.printLocation,
        item.printType,
      ].join('|');
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    // Стабильный порядок групп — чтобы суффиксы -gN не менялись при повторе.
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, group]) => group);
  }

  /** Тело запроса по контракту партнёра (GET …/contract). */
  private buildPayload(
    order: {
      numberOrder: string;
      note: string | null;
      isUrgent: boolean;
      urlCommunication: string;
      clientName: string | null;
      clientPhone: string | null;
      tshirtModel: string | null;
    },
    group: {
      color: string;
      size: string;
      printLocation: EnumPrintLocation;
      printType: EnumPrintType;
      quantity: number;
      price: number;
      designUrl: string | null;
      designNote: string | null;
      clientItem: boolean;
    }[],
    externalRequestId: string,
  ) {
    const first = group[0];

    // Один размер может встретиться в нескольких позициях — суммируем.
    const qtyBySize = new Map<string, number>();
    for (const item of group) {
      qtyBySize.set(item.size, (qtyBySize.get(item.size) ?? 0) + item.quantity);
    }

    const totalQty = group.reduce((s, i) => s + i.quantity, 0);
    const totalSum = group.reduce((s, i) => s + i.price * i.quantity, 0);

    const telegram = order.urlCommunication.startsWith('https://t.me/')
      ? `@${order.urlCommunication.slice('https://t.me/'.length)}`
      : undefined;

    const commentParts = [
      order.note,
      first.designNote,
      // Нюансы, которые не выражаются полями контракта.
      first.printLocation === EnumPrintLocation.FRONT_BACK
        ? 'Печать с двух сторон: спереди и сзади.'
        : null,
      first.printLocation === EnumPrintLocation.FULL
        ? 'Полная запечатка изделия.'
        : null,
      first.printLocation === EnumPrintLocation.BY_TZ
        ? 'Размещение печати — по ТЗ (см. макет/комментарий).'
        : null,
      first.printType === EnumPrintType.DTG ? 'Метод печати: DTG.' : null,
      first.clientItem
        ? 'Изделие клиента — печать на футболках заказчика.'
        : null,
      order.isUrgent ? 'СРОЧНЫЙ заказ.' : null,
    ].filter(Boolean);

    return {
      external_request_id: externalRequestId,
      external_order_no: order.numberOrder,
      customer: {
        name: (order.clientName ?? '').trim(),
        phone: (order.clientPhone ?? '').trim(),
        ...(telegram ? { telegram } : {}),
      },
      tshirt_model: (order.tshirtModel ?? '').trim(),
      color: first.color,
      sizes: [...qtyBySize.entries()].map(([size, quantity]) => ({
        size,
        quantity,
      })),
      artwork: {
        file_url: first.designUrl,
        placement: PLACEMENT_MAP[first.printLocation],
      },
      print_method: PRINT_METHOD_MAP[first.printType],
      // Средняя цена за штуку по группе (обычно цена одна на всю группу).
      client_price_per_piece:
        totalQty > 0 ? Math.round(totalSum / totalQty) : 0,
      ...(commentParts.length > 0
        ? { comment: commentParts.join('\n').slice(0, 4000) }
        : {}),
    };
  }

  /** Ответ 201: {status, order_id, order_no, crm_order_url, public_order_url, message}. */
  private parseAccepted(rawBody: string): {
    orderNo: string | null;
    trackingUrl: string | null;
  } {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      return {
        orderNo: typeof body.order_no === 'string' ? body.order_no : null,
        trackingUrl:
          typeof body.public_order_url === 'string'
            ? body.public_order_url
            : null,
      };
    } catch {
      return { orderNo: null, trackingUrl: null };
    }
  }

  /** Ошибка партнёра 4xx/5xx: вытаскиваем message из {ok:false, error, message}. */
  private describeHttpError(
    status: number,
    rawBody: string,
    groupNo: number,
    groupCount: number,
  ): string {
    let detail = rawBody.slice(0, 300);
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof body.message === 'string') detail = body.message;
    } catch {
      // Не JSON — оставляем сырой фрагмент.
    }
    const groupInfo =
      groupCount > 1 ? ` (позиция-группа ${groupNo} из ${groupCount})` : '';
    return `Партнёр отклонил заявку${groupInfo}: HTTP ${status} — ${detail || 'без деталей'}`;
  }

  private markFailed(
    orderId: string,
    error: string,
    partnerOrderNos: string[] = [],
    trackingUrls: string[] = [],
  ) {
    return this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.FAILED,
        partnerSyncError: error,
        // Частично принятые группы сохраняем — повтор их не задублирует
        // (идемпотентность по external_request_id на стороне партнёра).
        ...(partnerOrderNos.length > 0
          ? { partnerOrderNo: partnerOrderNos.join(', ') }
          : {}),
        ...(trackingUrls.length > 0
          ? { partnerTrackingUrl: trackingUrls.join(', ') }
          : {}),
      },
    });
  }
}

/** printLocation → artwork.placement (front|back|left_chest|sleeve|other). */
const PLACEMENT_MAP: Record<EnumPrintLocation, string> = {
  FRONT: 'front',
  BACK: 'back',
  FRONT_BACK: 'other',
  SLEEVE_LEFT: 'sleeve',
  SLEEVE_RIGHT: 'sleeve',
  FULL: 'other',
  BY_TZ: 'other',
};

/** printType → print_method (dtf|silkscreen|embroidery|sublimation|other). */
const PRINT_METHOD_MAP: Record<EnumPrintType, string> = {
  DTF: 'dtf',
  DTG: 'other',
  SILK: 'silkscreen',
  SUBLIMATION: 'sublimation',
};
