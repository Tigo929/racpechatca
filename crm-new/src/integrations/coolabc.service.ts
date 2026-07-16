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
  EnumProductCategory,
} from 'src/generated/prisma/enums';

/**
 * Интеграция с CRM партнёра CoolABC — внешняя печать футболок.
 *
 * POST {COOLABC_API_URL} с заголовком X-CRM-API-Token.
 * Обязательные поля контракта: external_request_id (идемпотентность)
 * и external_order_no (наш номер). Номер у партнёра: GLN-xxxxx-наш_номер.
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
   * Не бросает исключений при сетевых/HTTP-ошибках — ошибка фиксируется
   * в заказе (FAILED + текст), чтобы её было видно в интерфейсе и можно
   * было отправить повторно.
   */
  async sendOrder(orderId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { items: true, tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new BadRequestException(
        'Партнёру отправляются только заказы с футболками',
      );
    }

    // Ключ идемпотентности создаём один раз; при повторной отправке
    // переиспользуем, чтобы у партнёра не появился дубль заказа.
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

    const payload = this.buildPayload(order, externalRequestId);

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
          `CoolABC: заказ ${order.numberOrder} не отправлен [${res.status}]: ${rawBody.slice(0, 300)}`,
        );
        return this.markFailed(
          orderId,
          `HTTP ${res.status}: ${rawBody.slice(0, 300) || 'пустой ответ'}`,
        );
      }

      const partnerOrderNo = this.extractPartnerOrderNo(rawBody);
      this.logger.log(
        `CoolABC: заказ ${order.numberOrder} отправлен` +
          (partnerOrderNo ? ` → ${partnerOrderNo}` : ''),
      );
      return this.prisma.orderPhoto.update({
        where: { id: orderId },
        data: {
          partnerSyncStatus: EnumPartnerSyncStatus.SENT,
          partnerSyncAt: new Date(),
          partnerSyncError: null,
          partnerOrderNo,
        },
      });
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
      return this.markFailed(orderId, message);
    }
  }

  /**
   * Тело запроса к партнёру. Все поля контракта собраны здесь — если партнёр
   * уточнит контракт (/tshirt-print-orders/contract), править только эту функцию.
   */
  private buildPayload(
    order: {
      numberOrder: string;
      note: string | null;
      isUrgent: boolean;
      deliveryMethod: string;
      items: { formatPaper: string; quantity: number; isFreePrice: boolean }[];
      tshirtItems: {
        color: string;
        size: string;
        gender: string;
        printLocation: string;
        printType: string;
        quantity: number;
        designUrl: string | null;
        designNote: string | null;
        clientItem: boolean;
      }[];
    },
    externalRequestId: string,
  ) {
    return {
      external_request_id: externalRequestId,
      external_order_no: order.numberOrder,
      comment: order.note ?? undefined,
      is_urgent: order.isUrgent,
      items: [
        ...order.tshirtItems.map((i) => ({
          product: 'tshirt',
          color: i.color,
          size: i.size,
          gender: i.gender,
          print_location: i.printLocation,
          print_type: i.printType,
          quantity: i.quantity,
          design_url: i.designUrl ?? undefined,
          comment: i.designNote ?? undefined,
          client_item: i.clientItem,
        })),
        // Свободные позиции заказа футболок (кружки, баннеры и т.п.) —
        // передаём как произвольный товар с названием.
        ...order.items.map((i) => ({
          product: 'custom',
          name: i.formatPaper,
          quantity: i.quantity,
        })),
      ],
    };
  }

  /** Достаём номер заказа партнёра (GLN-...) из ответа, формат которого может отличаться. */
  private extractPartnerOrderNo(rawBody: string): string | null {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      const source = (
        typeof body.data === 'object' && body.data !== null ? body.data : body
      ) as Record<string, unknown>;
      for (const key of [
        'order_no',
        'order_number',
        'orderNo',
        'orderNumber',
        'number',
        'crm_order_no',
      ]) {
        const value = source[key];
        if (typeof value === 'string' && value.length > 0) return value;
      }
    } catch {
      // Ответ не JSON — номер не извлечь, но отправка успешна.
    }
    return null;
  }

  private markFailed(orderId: string, error: string) {
    return this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        partnerSyncStatus: EnumPartnerSyncStatus.FAILED,
        partnerSyncError: error,
      },
    });
  }
}
