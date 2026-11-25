import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { EnumStatus } from 'src/generated/prisma/enums';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderPhotoService } from 'src/order-photo/order-photo.service';
import { normalizePhone } from 'src/order-photo/client-contact';
import { OzonDeliveryClient, OzonDeliveryError } from './ozon-delivery.client';
import {
  ACTIVE_STATUSES,
  defaultParcel,
  mapOzonStatus,
  rubles,
  scheduleText,
  shipmentBlocker,
  type Parcel,
  type ShipmentStatus,
} from './ozon-shipment';
import {
  deepFind,
  findPosting,
  labelFromJson,
  labelUrl,
  postingStatus,
} from './ozon-json';

/** Пункт выдачи в том виде, в каком его хранит заказ. */
export interface PickupPoint {
  id: string;
  number: string | null;
  address: string | null;
  schedule: string | null;
  name: string | null;
}

interface PointInfo {
  delivery_point_id: number;
  name?: string;
  delivery_point_number?: string;
  full_address?: string;
  is_active?: boolean;
  schedule?: {
    date?: string;
    periods?: { from_local?: string; to_local?: string }[];
  }[];
}

const ORDER_SELECT = {
  id: true,
  numberOrder: true,
  productCategory: true,
  deliveryMethod: true,
  status: true,
  totalOrder: true,
  prepaidAmount: true,
  clientPaidAt: true,
  pickupPointId: true,
  recipientPhone: true,
  recipientName: true,
} as const;

/** Сколько ждать пункт выдачи до напоминания владельцу. */
export const PICKUP_REMIND_AFTER_DAYS = 4;

@Injectable()
export class OzonShipmentService {
  private readonly logger = new Logger(OzonShipmentService.name);
  private shipmentMethodId: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ozon: OzonDeliveryClient,
    private readonly orders: OrderPhotoService,
  ) {}

  private wrap(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof OzonDeliveryError) {
      if (error.status === 503)
        throw new ServiceUnavailableException(error.message);
      throw new BadRequestException(error.message);
    }
    this.logger.error('Ozon Доставка: неожиданная ошибка', error as Error);
    throw new ServiceUnavailableException(
      'Ozon Доставка не ответила. Попробуйте ещё раз через минуту.',
    );
  }

  /**
   * Метод доставки в кабинете («Сдаю в ПВЗ — Сиреневый бульвар»).
   *
   * В API он виден только как shipment_method_ids у пунктов выдачи. Можно
   * задать явно (OZON_DELIVERY_SHIPMENT_METHOD_ID), иначе берём из списка.
   */
  private async methodId(): Promise<number> {
    const fromEnv = Number(process.env.OZON_DELIVERY_SHIPMENT_METHOD_ID);
    if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
    if (this.shipmentMethodId) return this.shipmentMethodId;
    const res = await this.ozon.post<{
      delivery_points?: { shipment_method_ids?: number[] }[];
    }>('/v1/delivery-point/list', { pagination: { limit: 5 } });
    const id = res.delivery_points?.find((p) => p.shipment_method_ids?.length)
      ?.shipment_method_ids?.[0];
    if (!id) {
      throw new OzonDeliveryError(
        'В кабинете Ozon Доставки нет метода доставки. Добавьте его в разделе «Методы доставки».',
        400,
      );
    }
    this.shipmentMethodId = id;
    return id;
  }

  /** Пункт выдачи по номеру из Ozon (id или «56-27»). */
  async pickupPoint(idOrNumber: string): Promise<PickupPoint> {
    try {
      const raw = idOrNumber.trim();
      const id = /^\d+$/.test(raw)
        ? Number(raw)
        : Number(raw.replace(/\D/g, ''));
      if (!id)
        throw new BadRequestException('Укажите номер пункта выдачи Ozon.');
      const res = await this.ozon.post<{ delivery_points?: PointInfo[] }>(
        '/v1/delivery-point/info',
        { delivery_point_ids: [id] },
      );
      const p = res.delivery_points?.[0];
      if (!p)
        throw new NotFoundException(`Пункт выдачи ${raw} не найден в Ozon.`);
      if (p.is_active === false) {
        throw new BadRequestException(
          `Пункт выдачи ${raw} сейчас не работает — выберите другой.`,
        );
      }
      return {
        id: String(p.delivery_point_id),
        number: p.delivery_point_number ?? null,
        address: p.full_address ?? null,
        schedule: scheduleText(p.schedule),
        name: p.name ?? null,
      };
    } catch (e) {
      this.wrap(e);
    }
  }

  /** Записать в заказ пункт выдачи и получателя. */
  async setDelivery(
    orderId: string,
    patch: {
      pickupPoint?: string | null;
      recipientName?: string | null;
      recipientPhone?: string | null;
    },
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: { id: true, ozonShipment: { select: { status: true } } },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const active =
      order.ozonShipment &&
      ACTIVE_STATUSES.includes(order.ozonShipment.status as ShipmentStatus) &&
      order.ozonShipment.status !== 'CREATED';
    const data: Prisma.OrderPhotoUpdateInput = {};
    if (patch.pickupPoint !== undefined) {
      if (active) {
        throw new ConflictException(
          'Отправление уже создано — пункт выдачи поменять нельзя. Отмените отправление.',
        );
      }
      if (patch.pickupPoint) {
        const p = await this.pickupPoint(patch.pickupPoint);
        data.pickupPointId = p.id;
        data.pickupPointNumber = p.number;
        data.pickupPointAddress = p.address;
        data.pickupPointSchedule = p.schedule;
      } else {
        data.pickupPointId = null;
        data.pickupPointNumber = null;
        data.pickupPointAddress = null;
        data.pickupPointSchedule = null;
      }
    }
    if (patch.recipientName !== undefined)
      data.recipientName = patch.recipientName?.trim() || null;
    if (patch.recipientPhone !== undefined) {
      const phone = patch.recipientPhone?.trim()
        ? normalizePhone(patch.recipientPhone)
        : null;
      if (patch.recipientPhone?.trim() && !phone) {
        throw new BadRequestException(
          'Телефон получателя не похож на российский номер.',
        );
      }
      data.recipientPhone = phone;
    }
    await this.prisma.orderPhoto.update({ where: { id: orderId }, data });
    return this.view(orderId);
  }

  /** Есть ли у клиента аккаунт Ozon на этот телефон (без него посылку не выдать). */
  async checkClient(phone: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new BadRequestException('Неверный телефон');
    try {
      const res = await this.ozon.post<{ can_be_delivered?: boolean }>(
        '/v1/delivery/check-client',
        { phone_number: normalized },
      );
      return Boolean(res.can_be_delivered);
    } catch (e) {
      this.wrap(e);
    }
  }

  private postingPayload(
    requestId: number,
    methodId: number,
    parcel: Parcel,
    declared: number,
  ) {
    return {
      request_id: requestId,
      shipment_method_id: methodId,
      dimensions: {
        weight_g: parcel.weightG,
        length_mm: parcel.lengthMm,
        width_mm: parcel.widthMm,
        height_mm: parcel.heightMm,
      },
      declared_value: { amount: declared.toFixed(2), currency_code: 'RUB' },
    };
  }

  /** Предварительная цена и срок — без создания отправления. */
  async quote(orderId: string, parcelIn?: Partial<Parcel>) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: ORDER_SELECT,
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (!order.pickupPointId)
      throw new BadRequestException('Сначала выберите пункт выдачи.');
    const phone = normalizePhone(order.recipientPhone);
    if (!phone)
      throw new BadRequestException('Сначала укажите телефон получателя.');
    const parcel = {
      ...defaultParcel(order.productCategory),
      ...clean(parcelIn),
    };
    try {
      const res = await this.ozon.post<{
        results?: { posting?: Record<string, unknown>; error?: unknown }[];
      }>('/v1/order/checkout', {
        recipient: { phone_number: phone },
        delivery: {
          delivery_point: { delivery_point_id: Number(order.pickupPointId) },
        },
        postings: [
          this.postingPayload(
            1,
            await this.methodId(),
            parcel,
            declaredValue(order.totalOrder),
          ),
        ],
      });
      const posting = res.results?.[0]?.posting;
      if (!posting) {
        throw new OzonDeliveryError(
          `Ozon не посчитал доставку: ${JSON.stringify(res.results?.[0]?.error ?? res).slice(0, 300)}`,
          400,
        );
      }
      return {
        parcel,
        deliveryCost: rubles(posting.estimated_delivery_cost),
        insuranceCost: rubles(posting.estimated_insurance_cost),
        days: Number(posting.estimated_delivery_days) || null,
      };
    } catch (e) {
      this.wrap(e);
    }
  }

  /**
   * Создать отправление: заказ в Ozon → подтверждение → этикетка готова.
   *
   * Если Ozon создал заказ, но не подтвердил (обычно — нет денег на
   * балансе), строка остаётся CREATED с понятной ошибкой: повторное нажатие
   * подтвердит то же отправление, второго не появится.
   */
  async create(
    orderId: string,
    parcelIn: Partial<Parcel> | undefined,
    user: { id: string; role: string },
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: { ...ORDER_SELECT, ozonShipment: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const blocker = shipmentBlocker(order);
    if (blocker) throw new BadRequestException(blocker);

    let shipment = order.ozonShipment;
    if (
      shipment &&
      !['CANCELLED', 'ERROR', 'CREATED'].includes(shipment.status)
    ) {
      throw new ConflictException('Отправление по заказу уже создано.');
    }
    // Уже создан в Ozon, но не подтверждён — только подтверждаем.
    if (shipment?.status === 'CREATED' && shipment.postingNumber) {
      return this.approve(orderId, user);
    }

    const parcel = {
      ...defaultParcel(order.productCategory),
      ...clean(parcelIn),
    };
    const declared = declaredValue(order.totalOrder);
    const phone = normalizePhone(order.recipientPhone)!;

    try {
      if (!(await this.checkClient(phone))) {
        throw new BadRequestException(
          `У получателя нет аккаунта Ozon на номер ${phone}. Попросите клиента войти в приложение Ozon с этим номером (или дать другой) — без аккаунта Ozon не выдаст посылку.`,
        );
      }
      const quote = await this.quote(orderId, parcel);
      const methodId = await this.methodId();

      // Строку заводим ДО запроса: requestId — наш ключ к ответу Ozon.
      const base = {
        weightG: parcel.weightG,
        lengthMm: parcel.lengthMm,
        widthMm: parcel.widthMm,
        heightMm: parcel.heightMm,
        declaredValue: declared,
        estimatedCost: quote.deliveryCost,
        estimatedInsurance: quote.insuranceCost,
        estimatedDays: quote.days,
        createdById: user.id,
        status: 'CREATED',
        lastError: null,
        postingNumber: null,
        ozonOrderNumber: null,
        ozonStatus: null,
        cancelledAt: null,
      };
      shipment = shipment
        ? await this.prisma.ozonShipment.update({
            where: { id: shipment.id },
            data: base,
          })
        : await this.prisma.ozonShipment.create({ data: { orderId, ...base } });

      const res = await this.ozon.post<unknown>('/v1/order/create', {
        order_external_id: order.numberOrder,
        recipient: {
          phone_number: phone,
          full_name: order.recipientName,
          name: order.recipientName,
        },
        delivery: {
          delivery_point: { delivery_point_id: Number(order.pickupPointId) },
        },
        postings: [
          {
            ...this.postingPayload(
              shipment.requestId,
              methodId,
              parcel,
              declared,
            ),
            posting_external_id: order.numberOrder,
            description: `Заказ ${order.numberOrder}`,
          },
        ],
      });
      const postingNumber = deepFind(res, /^posting_number$/i);
      const ozonOrderNumber =
        deepFind(res, /^order_number$/i) ?? deepFind(res, /^order_id$/i);
      if (!postingNumber) {
        const why = deepFind(res, /^(message|error)$/i);
        await this.prisma.ozonShipment.update({
          where: { id: shipment.id },
          data: {
            status: 'ERROR',
            lastError: why ?? 'Ozon не вернул номер отправления',
            raw: res as Prisma.InputJsonValue,
          },
        });
        throw new OzonDeliveryError(
          why ?? 'Ozon не вернул номер отправления',
          400,
        );
      }
      await this.prisma.ozonShipment.update({
        where: { id: shipment.id },
        data: {
          postingNumber,
          ozonOrderNumber,
          raw: res as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      if (shipment) {
        const message = e instanceof Error ? e.message : String(e);
        await this.prisma.ozonShipment
          .update({ where: { id: shipment.id }, data: { lastError: message } })
          .catch(() => undefined);
      }
      this.wrap(e);
    }
    return this.approve(orderId, user);
  }

  /** Подтвердить готовность к отгрузке. Здесь Ozon проверяет баланс. */
  async approve(orderId: string, user: { id: string; role: string }) {
    const shipment = await this.prisma.ozonShipment.findUnique({
      where: { orderId },
    });
    if (!shipment?.postingNumber)
      throw new NotFoundException('Отправления нет.');
    try {
      await this.ozon.post('/v1/posting/approve', {
        posting_number: shipment.postingNumber,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.ozonShipment.update({
        where: { id: shipment.id },
        data: { lastError: message },
      });
      this.wrap(e);
    }
    await this.prisma.ozonShipment.update({
      where: { id: shipment.id },
      data: { status: 'APPROVED', approvedAt: new Date(), lastError: null },
    });
    await this.markShipmentCreated(orderId, user);
    return this.view(orderId);
  }

  /** Заказ — в «Отгрузка создана»: это и есть созданное отправление. */
  private async markShipmentCreated(
    orderId: string,
    user: { id: string; role: string },
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (
      !order ||
      ['SHIPMENT_CREATED', 'SENT', 'PAID', 'COMPLETED', 'DONE'].includes(
        order.status,
      )
    )
      return;
    try {
      await this.orders.updateStatusOrder(
        orderId,
        { status: EnumStatus.SHIPMENT_CREATED },
        user.id,
        user.role,
      );
    } catch (e) {
      // Переход может быть запрещён правилами статусов — отправление от этого
      // не страдает, статус заказа поправят руками.
      this.logger.warn(
        `Статус «Отгрузка создана» не поставлен (${orderId}): ${(e as Error).message}`,
      );
    }
  }

  /** Этикетка PDF. */
  async label(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    const shipment = await this.prisma.ozonShipment.findUnique({
      where: { orderId },
      include: { order: { select: { numberOrder: true } } },
    });
    if (!shipment?.postingNumber)
      throw new NotFoundException('Отправления нет — этикетки тоже.');
    if (shipment.status === 'CREATED') {
      throw new BadRequestException(
        'Отправление не подтверждено — этикетки ещё нет. Нажмите «Подтвердить».',
      );
    }
    try {
      const res = await this.ozon.raw('/v1/posting/label', {
        posting_number: shipment.postingNumber,
      });
      const type = res.headers.get('content-type') ?? '';
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!res.ok) {
        throw new OzonDeliveryError(
          `Ozon не отдал этикетку (${res.status}): ${bytes.toString('utf8').slice(0, 300)}`,
          res.status,
        );
      }
      let pdf: Buffer | null =
        bytes.subarray(0, 4).toString() === '%PDF' ? bytes : null;
      if (!pdf && /json/.test(type)) {
        const json = JSON.parse(bytes.toString('utf8')) as unknown;
        pdf = labelFromJson(json);
        const url = pdf ? null : labelUrl(json);
        if (url) {
          const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
          const b = Buffer.from(await r.arrayBuffer());
          if (b.subarray(0, 4).toString() === '%PDF') pdf = b;
        }
      }
      if (!pdf)
        throw new OzonDeliveryError(
          'Ozon вернул этикетку в незнакомом формате.',
          502,
        );
      return {
        buffer: pdf,
        filename: `ozon-${shipment.order.numberOrder}.pdf`,
      };
    } catch (e) {
      this.wrap(e);
    }
  }

  /**
   * Этикетка Ozon для вклейки в «Печать PDF» (наклейка на пакет).
   *
   * null — по заказу нет отправления Ozon, вклеивать нечего. missing —
   * отправление есть, но этикетку получить нельзя (ещё не подтверждено,
   * Ozon готовит, сбой) — печать наклейки от этого не ломается, человеку
   * говорим причину.
   */
  async labelForSticker(
    orderId: string,
  ): Promise<{ buffer: Buffer } | { missing: string } | null> {
    const shipment = await this.prisma.ozonShipment.findUnique({
      where: { orderId },
      select: { status: true, postingNumber: true },
    });
    if (!shipment?.postingNumber) return null;
    if (['CANCELLED', 'RETURNED', 'DELIVERED'].includes(shipment.status)) {
      return null;
    }
    try {
      const { buffer } = await this.label(orderId);
      return { buffer };
    } catch (e) {
      return { missing: (e as Error).message };
    }
  }

  /** Этикетки пачкой — одним PDF, по порядку заказов. */
  async labels(orderIds: string[]) {
    const merged = await PDFDocument.create();
    const failed: string[] = [];
    for (const id of [...new Set(orderIds)]) {
      try {
        const { buffer } = await this.label(id);
        const doc = await PDFDocument.load(buffer);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } catch (e) {
        const order = await this.prisma.orderPhoto.findUnique({
          where: { id },
          select: { numberOrder: true },
        });
        failed.push(`${order?.numberOrder ?? id}: ${(e as Error).message}`);
      }
    }
    if (merged.getPageCount() === 0) {
      throw new BadRequestException(`Ни одной этикетки: ${failed.join('; ')}`);
    }
    return { buffer: Buffer.from(await merged.save()), failed };
  }

  /** Отменить отправление (пока клиент его не получил). */
  async cancel(orderId: string) {
    const shipment = await this.prisma.ozonShipment.findUnique({
      where: { orderId },
    });
    if (!shipment) throw new NotFoundException('Отправления нет.');
    if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(shipment.status)) {
      throw new BadRequestException('Это отправление уже не отменить.');
    }
    if (shipment.postingNumber) {
      try {
        await this.ozon.post('/v1/posting/cancel', {
          posting_number: shipment.postingNumber,
        });
      } catch (e) {
        this.wrap(e);
      }
    }
    /*
     * Ozon принимает отмену асинхронно: 22.11.2026 запрос в «forming» вернул
     * {}, а отправление всё равно дошло до «ready_for_shipping». Поэтому
     * не верим ответу на слово — сразу спрашиваем статус.
     */
    if (!shipment.postingNumber) {
      await this.prisma.ozonShipment.update({
        where: { id: shipment.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), lastError: null },
      });
      return this.view(orderId);
    }
    await new Promise((r) => setTimeout(r, 3000));
    const change = await this.sync(orderId).catch(() => null);
    const after = await this.prisma.ozonShipment.findUnique({
      where: { id: shipment.id },
    });
    if (
      !change &&
      after &&
      !['CANCELLED', 'RETURNING', 'RETURNED'].includes(after.status)
    ) {
      await this.prisma.ozonShipment.update({
        where: { id: shipment.id },
        data: {
          lastError:
            'Отмена отправлена в Ozon, но он её пока не подтвердил. Нажмите «Обновить статус» через минуту; если не отменится — не сдавайте посылку и отмените в кабинете Ozon Доставки.',
        },
      });
    }
    return this.view(orderId);
  }

  /** Подтянуть статус одного отправления. Возвращает, что изменилось. */
  async sync(orderId: string): Promise<{ from: string; to: string } | null> {
    const shipment = await this.prisma.ozonShipment.findUnique({
      where: { orderId },
    });
    if (!shipment?.postingNumber) return null;
    const res = await this.ozon.post<unknown>('/v1/posting/info', {
      posting_numbers: [shipment.postingNumber],
    });
    const posting = findPosting(res, shipment.postingNumber);
    const ozonStatus = postingStatus(posting);
    const mapped = mapOzonStatus(ozonStatus);
    const now = new Date();
    const next = mapped && mapped !== shipment.status ? mapped : null;
    // Фактическая стоимость, если Ozon её уже показывает.
    const actual = rubles(
      deepFind(
        posting,
        /^(actual_delivery_cost|delivery_cost|total_cost|cost)$/i,
      ),
    );
    await this.prisma.ozonShipment.update({
      where: { id: shipment.id },
      data: {
        ozonStatus,
        ozonStatusAt:
          ozonStatus !== shipment.ozonStatus ? now : shipment.ozonStatusAt,
        lastSyncedAt: now,
        raw: posting as Prisma.InputJsonValue,
        ...(actual !== null && actual > 0 ? { actualCost: actual } : {}),
        ...(next
          ? {
              status: next,
              ...(next === 'IN_TRANSIT' && !shipment.shippedAt
                ? { shippedAt: now }
                : {}),
              ...(next === 'AT_PICKUP_POINT' && !shipment.arrivedAt
                ? { arrivedAt: now }
                : {}),
              ...(next === 'DELIVERED' ? { deliveredAt: now } : {}),
              ...(next === 'RETURNED' ? { returnedAt: now } : {}),
              ...(next === 'CANCELLED' ? { cancelledAt: now } : {}),
            }
          : {}),
      },
    });
    return next ? { from: shipment.status, to: next } : null;
  }

  /** Блок «Доставка» для карточки заказа. */
  async view(orderId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        ...ORDER_SELECT,
        deliveryCost: true,
        pickupPointNumber: true,
        pickupPointAddress: true,
        pickupPointSchedule: true,
        ozonShipment: true,
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const s = order.ozonShipment;
    const ozonCost = s
      ? (s.actualCost ?? sum(s.estimatedCost, s.estimatedInsurance))
      : null;
    return {
      configured: this.ozon.configured,
      pickupPoint: order.pickupPointId
        ? {
            id: order.pickupPointId,
            number: order.pickupPointNumber,
            address: order.pickupPointAddress,
            schedule: order.pickupPointSchedule,
          }
        : null,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      blocker: shipmentBlocker(order),
      defaultParcel: defaultParcel(order.productCategory),
      money: {
        clientPaid: order.deliveryCost ?? 0,
        ozonCost,
        ozonCostIsEstimate: s ? s.actualCost === null : true,
        earned: ozonCost === null ? null : (order.deliveryCost ?? 0) - ozonCost,
      },
      shipment: s
        ? {
            status: s.status,
            ozonStatus: s.ozonStatus,
            postingNumber: s.postingNumber,
            ozonOrderNumber: s.ozonOrderNumber,
            parcel: {
              weightG: s.weightG,
              lengthMm: s.lengthMm,
              widthMm: s.widthMm,
              heightMm: s.heightMm,
            },
            estimatedCost: s.estimatedCost,
            estimatedInsurance: s.estimatedInsurance,
            estimatedDays: s.estimatedDays,
            actualCost: s.actualCost,
            createdAt: s.createdAt,
            approvedAt: s.approvedAt,
            shippedAt: s.shippedAt,
            arrivedAt: s.arrivedAt,
            deliveredAt: s.deliveredAt,
            returnedAt: s.returnedAt,
            cancelledAt: s.cancelledAt,
            lastSyncedAt: s.lastSyncedAt,
            lastError: s.lastError,
          }
        : null,
    };
  }
}

function sum(a: number | null, b: number | null): number | null {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

/** Объявленная стоимость — сумма заказа, но не меньше 100 ₽. */
function declaredValue(total: number | null): number {
  return Math.max(100, Math.round(total ?? 0));
}

function clean(p?: Partial<Parcel>): Partial<Parcel> {
  const out: Partial<Parcel> = {};
  for (const k of ['weightG', 'lengthMm', 'widthMm', 'heightMm'] as const) {
    const v = Number(p?.[k]);
    if (Number.isFinite(v) && v > 0) out[k] = Math.round(v);
  }
  return out;
}
