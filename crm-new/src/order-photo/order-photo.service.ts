import { fulfillmentError } from './fulfillment';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CANVAS_COURIER_MSK_PRICE,
  leadDeliveryCost as deliveryCostForLead,
} from './free-delivery';
import { attributionFromLead } from './lead-attribution';
import { clientPaidAtPatch, parseClientPaidAt } from './paid-at';
import { clampOrderDiscount, orderTotal } from './order-total';
import {
  deadlineOnAccept,
  DEFAULT_DEADLINE_MS,
} from './deadline-start';
import {
  canvasPositionMoney,
  normalizeAddons,
  type CanvasAddons,
} from './canvas-addons';
import { MANUAL_DEFAULT_ORIGIN } from './order-origin';
import { MetrikaOrderOutboxService } from 'src/metrika/orders/metrika-order-outbox.service';
import { PrismaService } from 'src/prisma/prisma.service';
import DtoCreateOrder from './dto/create-order.dto';
import { calcItemPricePosition } from './order-pricing';
import {
  LeadMoneyError,
  resolveLeadItemsMoney,
  resolveLeadMoney,
} from './lead-pricing';
import {
  buildCommunicationUrl,
  validateCommunicationValue,
} from './communication-url';
import fullDate from 'src/utils/full-date';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import { DtoCreateLead } from './dto/create-lead.dto';
import { DtoPhotosShortfall } from './dto/photos-shortfall.dto';
import {
  CANVAS_FRAME_LABELS,
  findCanvasSize,
} from '../scenarios/products/canvas.pricing';
import { DtoAssignExecutor } from './dto/assign-executor.dto';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumExpenseCategory,
  EnumPrintLocation,
  EnumProductCategory,
  EnumRole,
  EnumStatus,
  EnumTshirtGender,
  type EnumTshirtSize,
} from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import {
  calculateSalarySnapshot,
  calculateManagerSalarySnapshot,
  earnsStaffSalary,
} from 'src/salary/salary-calculation';
import { TelegramService } from 'src/telegram/telegram.service';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
import {
  canvasTermsFrom,
  resolveCanvasPosition,
} from 'src/canvas/canvas-production-price';
import { normalizeMarketplaceNumber } from './order-number';
import { hasTechSpecFiles } from 'src/partner/tech-spec-paths';
import { GulianOutboxService } from 'src/gulian/gulian-outbox.service';
import { TshirtPartnerTelegramService } from './tshirt-partner-telegram.service';
import { SitePhotosService } from './site-photos.service';
import { OrderArchiveService } from './order-archive.service';
import {
  hasProductionItems,
  NO_PRODUCTION_ITEMS_MESSAGE,
} from './tshirt-production-items';
import {
  buildLeadNotification,
  leadContactLine,
  pickLeadResponders,
} from './lead-notification';
import { PushService } from '../push/push.service';

// Сборка ссылки на переписку живёт в communication-url.ts — там же тесты
// на нормализацию телефона для MAX.

const RU_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** «25 июня» — формат срока без зависимости от ICU. */
function formatRuDate(d: Date): string {
  const date = new Date(d);
  return `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`;
}

/** Экранируем спецсимволы для parse_mode=HTML в Telegram. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const DEFAULT_LIST_HIDDEN_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
  EnumStatus.LEAD,
];

const TSHIRT_LIST_HIDDEN_STATUSES: EnumStatus[] = [
  EnumStatus.PAID,
  EnumStatus.LEAD,
];

const CONTROL_CLOSED_STATUSES: EnumStatus[] = [
  EnumStatus.PAID,
  EnumStatus.SENT,
  EnumStatus.DONE,
  EnumStatus.COMPLETED,
  EnumStatus.CANCELLED,
];

// Оплаченная бизнес-семантика: заказ, по которому деньги от клиента получены.
// Только таким заказам можно указать фактическую дату оплаты (работа D1).
const PAID_STATUSES: EnumStatus[] = [EnumStatus.PAID, EnumStatus.COMPLETED];

// «Закрытые» для сортировки списка: оплачен и снятые с потока. Такие заказы
// получают closedAt и опускаются в самый низ, активные (в т.ч. «Отправлен»,
// ждущий оплаты) остаются сверху.
const CLOSED_STATUSES: EnumStatus[] = [
  EnumStatus.PAID,
  EnumStatus.COMPLETED,
  EnumStatus.CANCELLED,
];

/**
 * Статусы, после которых исходники клиента на сайте больше не нужны.
 *
 * Отправлен — значит напечатано и уехало: фотографии сделали свою работу.
 * Дальше по цепочке (оплачен, выполнен) они тем более не нужны, а отмена
 * сюда не входит намеренно — отменённый заказ нередко возвращают в работу,
 * и удалять файлы под ним рано.
 */
const PHOTOS_RELEASED_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
  EnumStatus.READY_FOR_REVIEW,
  EnumStatus.COMPLETED,
];

// «Активные» на дашборде — заказы в работе прямо сейчас. LEAD и SENT не
// считаем: у обращений и неоплаченных отправок есть свои карточки, иначе
// цифра «Активных» не сходится со списком и вводит в заблуждение.
const NOT_ACTIVE_STATUSES: EnumStatus[] = [
  EnumStatus.LEAD,
  EnumStatus.SENT,
  EnumStatus.PAID,
  EnumStatus.COMPLETED,
  EnumStatus.CANCELLED,
];

const READY_STATUSES: EnumStatus[] = [
  EnumStatus.READY,
  EnumStatus.SHIPMENT_CREATED,
  EnumStatus.DONE,
];

const REVIEW_WAITING_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
];

function isExternalProductionCategory(
  productCategory: EnumProductCategory,
): boolean {
  return (
    productCategory === EnumProductCategory.TSHIRT ||
    productCategory === EnumProductCategory.CANVAS
  );
}

/**
 * Показывать ли заказы с маркетплейсов.
 *
 * Пусто в списке футболок означает «скрыть»: это отдельное направление,
 * и в общем списке оно путает. Везде ещё пусто означает «не фильтровать»:
 * в обращениях и поиске по всем продуктам прятать нечего.
 */
function marketplaceWhere(
  marketplace: 'only' | 'exclude' | 'all' | undefined,
  productCategory: EnumProductCategory | undefined,
  options: { applyListStatusDefaults: boolean },
): { isMarketplacePrint?: boolean } {
  if (marketplace === 'only') return { isMarketplacePrint: true };
  if (marketplace === 'exclude') return { isMarketplacePrint: false };
  if (marketplace === 'all') return {};
  const tshirtList =
    options.applyListStatusDefaults &&
    productCategory === EnumProductCategory.TSHIRT;
  return tshirtList ? { isMarketplacePrint: false } : {};
}

function calcCanvasMoney(
  quantity: number,
  clientPrice: number,
  contractorPrice: number,
  addons: CanvasAddons,
) {
  return canvasPositionMoney({ quantity, clientPrice, contractorPrice, addons });
}

/**
 * Нарушение уникального индекса по конкретному полю.
 *
 * Проверяем по форме ошибки, а не через instanceof: класс ошибки Prisma
 * потянул бы рантайм-импорт сгенерированного клиента, а здесь достаточно
 * кода P2002 и имени поля.
 */
function isUniqueViolation(error: unknown, field: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const known = error as { code?: unknown; meta?: { target?: unknown } };
  if (known.code !== 'P2002') return false;
  const target = known.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return typeof target === 'string' && target.includes(field);
}

@Injectable()
export class OrderPhotoService {
  private readonly logger = new Logger(OrderPhotoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
    private readonly telegram: TelegramService,
    private readonly partnerSettings: PartnerSettingsService,
    private readonly tshirtPartnerTelegram: TshirtPartnerTelegramService,
    private readonly gulianOutbox: GulianOutboxService,
    private readonly push: PushService,
    private readonly metrikaOutbox: MetrikaOrderOutboxService,
    private readonly sitePhotos: SitePhotosService,
    private readonly archive: OrderArchiveService,
  ) {}

  async createOrder(dto: DtoCreateOrder, adminId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;

      const now = new Date();
      const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const seqResult = await tx.$queryRaw<{ max: number }[]>`
        SELECT COALESCE(MAX(CAST(SPLIT_PART("numberOrder", '-', 2) AS INTEGER)), 0) AS max
        FROM "OrderPhoto"
        WHERE "numberOrder" LIKE ${monthPrefix + '%'}
      `;
      const lastSeq = Number(seqResult[0]?.max ?? 0);
      const lengthOrder = String(lastSeq + 1).padStart(3, '0');

      const freePrice = dto.freePrice ?? false;
      const productCategory = dto.productCategory ?? EnumProductCategory.PHOTO;

      // Фактическая дата оплаты при заведении уже оплаченного заказа
      // (работа D1). Без оплаченного статуса дату не принимаем: пустое
      // поле честнее выдуманного.
      let createdPaidAt: Date | null = null;
      if (dto.clientPaidAt !== undefined && dto.clientPaidAt !== '') {
        if (!dto.status || !PAID_STATUSES.includes(dto.status)) {
          throw new BadRequestException(
            'Дата оплаты бывает только у оплаченного заказа.',
          );
        }
        createdPaidAt = parseClientPaidAt(dto.clientPaidAt, {
          createdAt: now,
          now,
        });
      }
      if (
        dto.deliveryMethod === EnumDeliveryMethod.PRODUCTION_MSK &&
        productCategory !== EnumProductCategory.CANVAS
      ) {
        throw new BadRequestException(
          'Доставка производства доступна только для холстов.',
        );
      }
      const deliveryCost =
        dto.deliveryMethod === EnumDeliveryMethod.PICKUP ? 0 : dto.deliveryCost;
      if (
        (dto.tshirtItems?.length &&
          productCategory !== EnumProductCategory.TSHIRT) ||
        (dto.canvasItems?.length &&
          productCategory !== EnumProductCategory.CANVAS)
      ) {
        throw new BadRequestException(
          'Позиции не соответствуют категории заказа.',
        );
      }

      // Внешние продукты делает подрядчик, а не наш исполнитель — назначать некого.
      if (dto.executorId && isExternalProductionCategory(productCategory)) {
        throw new BadRequestException(
          'Для заказов этого типа исполнитель не назначается — работу выполняет подрядчик',
        );
      }

      let executor: {
        id: string;
        role: EnumRole;
        isActive: boolean;
      } | null = null;
      if (dto.executorId) {
        executor = await tx.user.findUnique({
          where: { id: dto.executorId },
          select: { id: true, role: true, isActive: true },
        });
        if (!executor) throw new NotFoundException('Исполнитель не найден');
        if (executor.role !== EnumRole.EXECUTOR) {
          throw new BadRequestException(
            'Назначить можно только пользователя с ролью исполнителя',
          );
        }
        if (!executor.isActive) {
          throw new BadRequestException('Исполнитель деактивирован');
        }
      }

      // Себестоимость печати по умолчанию — из настроек партнёра; в позиции
      // можно переопределить. Снимок хранится на позиции, чтобы расчёт не
      // «поехал» при последующем изменении настроек.
      const partnerDefaults =
        productCategory === EnumProductCategory.TSHIRT
          ? await this.partnerSettings.get(tx)
          : null;
      // Позиции считаем независимо от категории: заказ может содержать и обычные
      // позиции, и свободные (произвольные «название — цена»). Свободная цена
      // позиции = её цене (кол-во не умножается).
      const photoCreate = (dto.items ?? []).map((e) => {
        const itemFree = e.isFreePrice ?? freePrice;
        // Печать на изделии заказчика — работа партнёра, просто без заготовки.
        // Термоперенос снимаем из настроек здесь же: если взять его в момент
        // расчёта, изменение умолчаний задним числом сдвинет уже закрытые заказы.
        const printOnClientItem = e.printOnClientItem ?? false;
        return {
          formatPaper: e.formatPaper,
          typePaper: e.typePaper,
          quantity: e.quantity,
          price: e.price,
          isFreePrice: itemFree,
          printOnClientItem,
          thermalCost: printOnClientItem
            ? (partnerDefaults?.thermalTransferCost ?? 70)
            : 0,
          pricePosition: calcItemPricePosition(
            e.price,
            e.quantity,
            0,
            itemFree,
          ),
        };
      });
      const tshirtCreate = (dto.tshirtItems ?? []).map((e) => {
        // Дизайн — часть цены (carve-out), а не надбавка: ограничиваем его
        // суммой позиции, чтобы «моя доля» не превысила цену футболки.
        const lineTotal = e.price * e.quantity;
        const dc = Math.min(e.designCost ?? 0, lineTotal);
        return {
          color: e.color,
          size: e.size,
          printLocation: e.printLocation,
          // Артикул площадки — только у позиций, заведённых из кабинета.
          marketplaceArticle: e.marketplaceArticle?.trim() || null,
          quantity: e.quantity,
          price: e.price,
          pricePosition: lineTotal,
          designCost: dc,
          // Пустое/0 → берём умолчание из настроек (|| , а не ??): 0 у термо
          // или заготовки почти всегда «поле не заполнили», а не «бесплатно».
          thermalCost:
            e.thermalCost || partnerDefaults?.thermalTransferCost || 70,
          blankCost: e.blankCost || partnerDefaults?.blankTshirtCost || 260,
          designUrl: e.designUrl,
          designNote: e.designNote,
          clientItem: e.clientItem ?? false,
        };
      });
      /*
       * Цена производства выводится из действующего прайса (розница минус
       * скидка или опт), а не принимается из тела запроса: занизить
       * себестоимость значит уйти в минус незаметно. Руками её задают только для нестандартного
       * размера, которого в прайсе нет.
       */
      const canvasTerms = canvasTermsFrom(await this.partnerSettings.get(tx));
      const canvasCreate = (dto.canvasItems ?? []).map((e) => {
        const priced = resolveCanvasPosition(e, canvasTerms);
        // Лак и багет: своя цена поставщика и своя цена клиенту, за штуку.
        const addons = normalizeAddons(e);
        return {
          formatCanvas: priced.formatCanvas,
          sizeKey: priced.sizeKey,
          material: priced.material,
          quantity: e.quantity,
          clientPrice: e.clientPrice,
          contractorPrice: priced.contractorPrice,
          ...addons,
          ...calcCanvasMoney(
            e.quantity,
            e.clientPrice,
            priced.contractorPrice,
            addons,
          ),
        };
      });

      // «Разработка дизайна» — отдельная свободная сумма, входит в чек клиента
      // и служит базой премии менеджера по оформлению (не привязана к позициям).
      const contactError = validateCommunicationValue(
        dto.communicationPlatform,
        dto.urlCommunication,
      );
      if (contactError) throw new BadRequestException(contactError);

      const designDevelopmentCost = Math.max(0, dto.designDevelopmentCost ?? 0);
      // Плата за срочность имеет смысл только у срочного заказа.
      const isUrgent = dto.isUrgent ?? false;
      const urgencyFee = isUrgent ? Math.max(0, dto.urgencyFee ?? 0) : 0;

      // Сумма заказа = позиции (фото + футболки + холсты) + доставка + дизайн + срочность.
      // customTotal — ручной итог по позициям; дизайн и срочность добавляются
      // поверх него, чтобы базы зарплат (чек без них) считались чисто.
      const positionsTotal =
        photoCreate.reduce((s, i) => s + i.pricePosition, 0) +
        tshirtCreate.reduce((s, i) => s + i.pricePosition, 0) +
        canvasCreate.reduce((s, i) => s + i.pricePosition, 0);
      // Скидка клиенту: решение владельца по конкретному заказу. Обрезается
      // потолком (товар + дизайн), чтобы не съесть доставку и срочность.
      const discountParts = {
        positionsTotal:
          dto.customTotal != null
            ? dto.customTotal - deliveryCost
            : positionsTotal,
        designDevelopmentCost,
      };
      const discountAmount = clampOrderDiscount(
        dto.discountAmount ?? 0,
        discountParts,
      );
      const totalOrder = orderTotal({
        ...discountParts,
        deliveryCost,
        urgencyFee,
        discountAmount,
      });

      const created = await tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          totalOrder,
          isFreePrice: freePrice,
          // Отсчёт «зависания» стартует с момента создания заказа.
          statusChangedAt: new Date(),
          deadline:
            productCategory === EnumProductCategory.TSHIRT
              ? null
              : new Date(Date.now() + DEFAULT_DEADLINE_MS),

          ...(dto.status ? { status: dto.status } : {}),
          // Заказ, заводимый уже оплаченным, может принести фактическую дату
          // оплаты (работа D1). Проверка выше не даёт принести её заказу,
          // который оплаченным не является.
          ...(createdPaidAt ? { clientPaidAt: createdPaidAt } : {}),
          discountAmount,
          // Источник выбирает сотрудник; не выбрал — текущий основной канал.
          sourceOrder: dto.sourceOrder ?? MANUAL_DEFAULT_ORIGIN,
          communicationPlatform: dto.communicationPlatform,
          urlCommunication: buildCommunicationUrl(
            dto.communicationPlatform,
            dto.urlCommunication,
            (await this.partnerSettings.get(tx)).maxLinkTemplate,
          ),
          deliveryMethod: dto.deliveryMethod,
          deliveryCost,
          designDevelopmentCost,
          urgencyFee,
          note: dto.note,
          isUrgent,
          // Заказ с маркетплейса на печать принта — включает статус
          // «Разработка макета» и «Дизайнер принта» на карточке.
          isMarketplacePrint: dto.isMarketplacePrint ?? false,
          // Номер заказа на площадке. Только у маркетплейсных: у обычного
          // заказа такого номера не бывает, и принести его в карточку
          // нельзя — иначе заказ начал бы называться чужим номером.
          marketplaceOrderNumber: dto.isMarketplacePrint
            ? normalizeMarketplaceNumber(dto.marketplaceOrderNumber)
            : null,
          // Номер отправления — только у заказов, заведённых из кабинета:
          // у заказа, набранного руками, отправления нет.
          marketplacePostingNumber: dto.isMarketplacePrint
            ? normalizeMarketplaceNumber(dto.marketplacePostingNumber)
            : null,
          marketplaceAccountId: dto.isMarketplacePrint
            ? (dto.marketplaceAccountId ?? null)
            : null,
          tshirtModel: dto.tshirtModel,
          productCategory,
          executorId: dto.executorId ?? undefined,
          // Кто оформил заказ — по нему начисляется зарплата менеджеру по
          // оформлению (если создатель — ORDER_MANAGER; см. updateStatusOrder).
          processedById: adminId ?? undefined,
          items: photoCreate.length ? { create: photoCreate } : undefined,
          tshirtItems: tshirtCreate.length
            ? { create: tshirtCreate }
            : undefined,
          canvasItems: canvasCreate.length
            ? { create: canvasCreate }
            : undefined,
        },
        include: {
          items: true,
          tshirtItems: true,
          canvasItems: true,
          executor: {
            select: {
              id: true,
              username: true,
              telegramUsername: true,
              telegramTopicId: true,
              telegramChatId: true,
            },
          },
        },
      });

      if (dto.executorId && adminId) {
        await tx.orderAssignment.create({
          data: {
            orderId: created.id,
            executorId: dto.executorId,
            assignedBy: adminId,
            note: 'Назначен при создании заказа',
          },
        });
      }

      return created;
    });

    if (
      result.executor?.telegramUsername ||
      result.executor?.telegramTopicId != null ||
      result.executor?.telegramChatId
    ) {
      const text = this.buildAssignmentMessage(
        result,
        result.executor.telegramUsername ?? '',
      );
      // Есть тема исполнителя — пишем прямо в неё; иначе в начало чата.
      const threadId =
        result.executor.telegramTopicId != null
          ? String(result.executor.telegramTopicId)
          : undefined;
      this.telegram
        .sendToExecutor(
          text,
          threadId,
          result.executor.username,
          result.executor.telegramUsername ?? undefined,
          result.executor.telegramChatId,
        )
        .catch(() => {});
    }

    return result;
  }

  async createLead(dto: DtoCreateLead) {
    try {
      const created = await this.createLeadTx(dto);
      // Повторная доставка удалённой заявки: заказа нет и уведомлять некого.
      // В лог пишем — иначе «заявка ушла в CRM, а её там нет» выглядит как
      // потеря, и человек идёт искать несуществующий сбой.
      if ('deletedLead' in created) {
        this.logger.warn(
          `Заявка ${dto.leadId ?? '—'} повторно доставлена с сайта, но она удалена (${created.numberOrder}: ${created.reason}). Заказ заново не заводим.`,
        );
        return created;
      }
      // Уведомление вне транзакции и без await на ошибку: Telegram может
      // молчать (блокировки, прокси), но заявка от этого пропасть не должна.
      void this.notifyLead(created, dto);
      return created;
    } catch (error) {
      // Страховка на случай, если доставки пришли в разные процессы и
      // разошлись мимо блокировки: повторная доставка заявки — это норма,
      // а не ошибка. Отдаём уже созданный заказ, иначе сайт получит 500,
      // сочтёт заказ непринятым и будет досылать его до «недоставленных».
      if (dto.leadId && isUniqueViolation(error, 'externalRequestId')) {
        const existing = await this.prisma.orderPhoto.findUnique({
          where: { externalRequestId: dto.leadId },
          include: { items: true, tshirtItems: true, canvasItems: true },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * Сообщает в общий чат о заявке с сайта и тегает того, кто должен ответить.
   *
   * Без этого заявка лежит в разделе обращений молча, пока кто-нибудь не
   * заглянет туда сам, — а клиент в это время ждёт. Упоминание в Telegram
   * даёт push даже при заглушенном чате.
   */
  private async notifyLead(
    created: { numberOrder: string },
    dto: DtoCreateLead,
  ): Promise<void> {
    try {
      const [users, settings] = await Promise.all([
        this.prisma.user.findMany({
          where: { isActive: true },
          select: {
            username: true,
            telegramUsername: true,
            role: true,
            isActive: true,
          },
        }),
        this.prisma.partnerSettings.findUnique({
          where: { id: 'default' },
          select: { leadMentionUsernames: true },
        }),
      ]);
      const text = buildLeadNotification(
        {
          numberOrder: created.numberOrder,
          name: dto.name,
          productName: dto.productName,
          quantity: dto.quantity,
          total: dto.total,
          comment: dto.comment ?? dto.description,
          contact: leadContactLine(dto),
        },
        pickLeadResponders(users, settings?.leadMentionUsernames ?? ''),
      );
      // Заявку с сайта разбирают в личке, а не в общей группе, где она
      // тонет среди задач: владельцу и всем, кто её ведёт.
      await this.telegram.sendLeadAlert(text);
    } catch (error) {
      // Заявка уже принята и лежит в CRM — молчание бота её не отменяет.
      this.logger.warn(
        `Не удалось уведомить о заявке ${created.numberOrder}: ${String(error)}`,
      );
    }
    // Web Push has its own durable queue, populated in createLeadTx. Telegram
    // retries cannot delay it and a process restart cannot lose a committed job.
  }

  /**
   * Номер заказа по папке загрузки сайта.
   *
   * Связь — через ссылку на папку: она записана в заказе и содержит её
   * номер. Отдельного поля заводить не стали, чтобы не держать два
   * источника одной и той же связи.
   */
  async orderNumberByUpload(uploadId: string): Promise<string | null> {
    const order = await this.prisma.orderPhoto.findFirst({
      where: { photosArchiveUrl: { contains: uploadId } },
      orderBy: { createdAt: 'desc' },
      select: { numberOrder: true },
    });
    return order?.numberOrder ?? null;
  }

  /**
   * Фотографии заказа выгружены на Яндекс.Диск владельца.
   *
   * Путь пишем в примечание, а не в новое поле: менеджер читает
   * примечание первым, а поле пришлось бы заводить миграцией, выводить в
   * карточку и поддерживать — ради строки, которую смотрят один раз.
   *
   * Повторная выгрузка строку не задваивает: хвост заказа может доехать
   * позже, и тогда сайт сообщает о той же папке ещё раз.
   */
  async recordPhotosFolder(input: {
    uploadId: string;
    folder: string;
  }): Promise<void> {
    const order = await this.prisma.orderPhoto.findFirst({
      where: { photosArchiveUrl: { contains: input.uploadId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, numberOrder: true, note: true, status: true },
    });
    if (!order) {
      this.logger.warn(
        `Папка Диска ${input.folder}: заказ по ${input.uploadId} не найден`,
      );
      return;
    }

    const line = `📁 Фотографии на Яндекс.Диске: ${input.folder}`;
    const noteDone = Boolean(order.note?.includes(input.folder));
    /*
      Папка создана — это первый шаг производства, и заказ встаёт на него
      сам: раньше менеджер щёлкал статус руками ровно после того, как
      разложил фотографии по папкам.

      Двигаем только из «Новый». Дальше по пути заказ ведёт человек, и
      повторная выгрузка — хвост доехал, папку дополнили — не должна
      тянуть назад заказ, который уже печатают или отправили.
    */
    const advance = order.status === EnumStatus.NEW;
    if (noteDone && !advance) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (!noteDone) {
          await tx.orderPhoto.update({
            where: { id: order.id },
            data: {
              note: [order.note?.trim(), line].filter(Boolean).join('\n'),
            },
          });
        }
        if (!advance) return;

        const history = await tx.statusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: EnumStatus.FOLDER_STRUCTURE_CREATED,
            changedBy: 'site',
          },
        });
        await tx.orderPhoto.update({
          where: { id: order.id },
          data: {
            status: EnumStatus.FOLDER_STRUCTURE_CREATED,
            // Отсчёт «завис» начинается заново: заказ сдвинулся по пути.
            statusChangedAt: new Date(),
          },
        });
        await this.metrikaOutbox.enqueueTransition(tx, {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: EnumStatus.FOLDER_STRUCTURE_CREATED,
          statusHistoryId: history.id,
        });
      });
      if (advance) {
        this.logger.log(
          `Заказ ${order.numberOrder}: папка на Диске создана — статус «Создана папка»`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Не удалось записать папку Диска в заказ ${order.numberOrder}: ${String(error)}`,
      );
    }
  }

  /**
   * Сайт сообщил, что фотографии заказа доехали не все.
   *
   * Файлы грузит браузер клиента, и дойти могут не все: закрыл вкладку,
   * ушёл в другое приложение, потерял сеть. Заявка при этом давно у нас
   * — её отправляют первой, не дожидаясь последнего файла, — и карточка
   * показывает полный тираж. Правда всплывала у печатника, когда в
   * архиве оказывалась половина заказа.
   *
   * Поэтому две вещи сразу: сообщение владельцу и строка в примечании.
   * Сообщение заметят сегодня, примечание переживёт этот день: заказ
   * может уехать в печать через неделю, и тогда вспомнить про недобор
   * будет уже некому.
   *
   * Заказ ищем по ссылке на папку: своего номера сайт не знает, его
   * присваиваем мы.
   */
  async reportPhotosShortfall(dto: DtoPhotosShortfall): Promise<void> {
    const order = await this.prisma.orderPhoto.findFirst({
      where: { photosArchiveUrl: { contains: dto.uploadId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, numberOrder: true, note: true },
    });

    if (!order) {
      // Заказ удалили или фотографии уже подчистили после отгрузки —
      // сообщать не о чем, но знать об этом стоит.
      this.logger.warn(
        `Недобор по папке ${dto.uploadId}: заказ не найден (${dto.arrived} из ${dto.expected})`,
      );
      return;
    }

    const line = `⚠️ Фотографии доехали не все: ${dto.arrived} из ${dto.expected}. Запросите у клиента остальные до печати.`;

    try {
      await this.prisma.orderPhoto.update({
        where: { id: order.id },
        data: { note: [order.note?.trim(), line].filter(Boolean).join('\n') },
      });
    } catch (error) {
      // Примечание не записалось — сообщение всё равно должно уйти.
      this.logger.warn(
        `Не удалось дописать недобор в заказ ${order.numberOrder}: ${String(error)}`,
      );
    }

    try {
      await this.telegram.sendLeadAlert(
        [`⚠️ Заказ ${order.numberOrder}: фотографии доехали не все.`, '', line].join(
          '\n',
        ),
      );
    } catch (error) {
      // Молчание бота не отменяет записи в примечании — она уже на месте.
      this.logger.warn(
        `Не удалось сообщить о недоборе по ${order.numberOrder}: ${String(error)}`,
      );
    }
  }

  private async createLeadTx(dto: DtoCreateLead) {
    return this.prisma.$transaction(async (tx) => {
      // Блокировку берём ДО проверки на повтор. Раньше было наоборот, и это
      // ломалось на бою: две параллельные доставки одной заявки обе не
      // находили заказ, сериализовались на блокировке, и вторая падала на
      // уникальном индексе с 500 — притом что заказ уже был создан. Сайт
      // считал это отказом и досылал заявку по кругу, пока она не уезжала
      // в «недоставленные». Теперь вторая ждёт первую и видит готовый заказ.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;

      if (dto.leadId) {
        const existing = await tx.orderPhoto.findUnique({
          where: { externalRequestId: dto.leadId },
        });
        if (existing) return existing;

        /*
         * Заявку уже удалили руками — заводить её заново нельзя.
         *
         * Сайт досылает недоставленную заявку до семи часов. Без этой
         * проверки заявка, удалённая как дубль или ошибка, возвращалась бы
         * следующей же досылкой — и так по кругу, пока сайт не выдохнется.
         *
         * Отказом не отвечаем: для сайта отказ означает «не доставлено», и
         * он продолжит досылать, а потом положит заявку в «недоставленные»,
         * где её будет разбирать человек. Удаление — это наше решение, а не
         * сбой доставки, поэтому доставку подтверждаем.
         *
         * Восстановленные записи пропускаем: у них заказ снова существует,
         * и его нашла бы проверка выше.
         */
        const deleted = await tx.orderDeletion.findFirst({
          where: { externalRequestId: dto.leadId, restoredAt: null },
          orderBy: { deletedAt: 'desc' },
          select: { numberOrder: true, reason: true, deletedAt: true },
        });
        if (deleted) {
          return {
            deletedLead: true as const,
            numberOrder: deleted.numberOrder,
            reason: deleted.reason,
            deletedAt: deleted.deletedAt,
          };
        }
      }

      const now = new Date();
      const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const seqResult = await tx.$queryRaw<{ max: number }[]>`
        SELECT COALESCE(MAX(CAST(SPLIT_PART("numberOrder", '-', 2) AS INTEGER)), 0) AS max
        FROM "OrderPhoto"
        WHERE "numberOrder" LIKE ${monthPrefix + '%'}
      `;
      const lastSeq = Number(seqResult[0]?.max ?? 0);
      const lengthOrder = String(lastSeq + 1).padStart(3, '0');

      const tgRaw = (
        (dto.telegram ?? '') ||
        (dto.contactMethod === 'telegram' ? (dto.contactValue ?? '') : '')
      )
        .trim()
        .replace(/^@/, '');
      const contactMethod = dto.contactMethod ?? (tgRaw ? 'telegram' : 'max');
      const communicationPlatform =
        contactMethod === 'telegram'
          ? EnumCommunication.TELEGRAM
          : EnumCommunication.MAX;
      const leadSettings = await this.partnerSettings.get(tx);
      const maxLinkTemplate = leadSettings.maxLinkTemplate;
      // Телефона может не быть вовсе: клиент оставляет либо его, либо
      // мессенджер. Поэтому каждая ветка знает запасной вариант — иначе
      // в заказе оказалась бы пустая ссылка на переписку.
      const phone = dto.phone?.trim() ?? '';
      const remoteContact = dto.contactValue?.trim() ?? '';
      const communicationValue =
        contactMethod === 'telegram'
          ? /^https?:\/\//i.test(tgRaw)
            ? tgRaw
            : `@${tgRaw}`
          : contactMethod === 'max'
            ? remoteContact || phone
            : phone || remoteContact;
      const urlCommunication = buildCommunicationUrl(
        communicationPlatform,
        communicationValue,
        maxLinkTemplate,
      );
      const isYandexPvz = dto.delivery === 'yandex_pvz';
      /*
        Доставка до двери по Москве — своя машина производства, то есть
        PRODUCTION_MSK. Бывает только у холста: другой товар с ней пришёл
        бы по ошибке, и заказ разумнее завести самовывозом, чем отбить.
      */
      const isCourierMsk =
        dto.delivery === 'courier_msk' &&
        dto.productCategory === EnumProductCategory.CANVAS;
      const deliveryMethod = isYandexPvz
        ? EnumDeliveryMethod.YANDEX_PVZ
        : isCourierMsk
          ? EnumDeliveryMethod.PRODUCTION_MSK
          : EnumDeliveryMethod.PICKUP;
      // Цену считает сайт (в его форме поля цены нет — клиент её не задаёт),
      // но CRM не принимает числа на веру: сверяем «цена × тираж = итог» и
      // сумму позиции считаем сами. Расхождение — отказ, потому что дальше по
      // этой сумме считается зарплата и расчёт с партнёром.
      let money;
      try {
        /*
          Заявка из нескольких строк («часть с полями, часть без») — это
          не одна позиция с усреднённой ценой: проверяем каждую строку
          отдельно и складываем итог из них.
        */
        money =
          dto.items && dto.items.length > 0
            ? resolveLeadItemsMoney(dto.items)
            : resolveLeadMoney({
                quantity: dto.quantity,
                unitPrice: dto.unitPrice,
                total: dto.total,
              });
      } catch (err) {
        if (err instanceof LeadMoneyError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
      const total = money.pricePosition;

      /*
        Доставка считается ПОСЛЕ суммы позиций: от неё зависит, бесплатна ли
        она. Сайт показывает клиенту итог до отправки заявки, и разойтись эти
        числа не должны — иначе в подтверждении окажется не та сумма, которую
        человеку называли.
      */
      const leadDeliveryCost = isCourierMsk
        ? CANVAS_COURIER_MSK_PRICE
        : deliveryCostForLead({
            yandexPvz: isYandexPvz,
            positionsTotal: total,
            price: leadSettings.deliveryPriceYandexPvz,
          });
      // Пожелания клиента — вверху: их читают в первую очередь, а не ищут
      // среди технических строк вроде yclid и ссылок на архив.
      const clientComment =
        dto.comment?.trim() || dto.description?.trim() || '';
      const noteLines = [
        `🆕 Заявка с сайта`,
        clientComment ? `💬 Клиент просит: ${clientComment}` : null,
        dto.leadId ? `ID заявки: ${dto.leadId}` : null,
        `Имя: ${dto.name}`,
        phone ? `Телефон: ${phone}` : null,
        contactMethod === 'telegram' && tgRaw
          ? `Telegram: ${communicationValue}`
          : null,
        contactMethod === 'max' && dto.contactValue
          ? `MAX: ${dto.contactValue}`
          : null,
        contactMethod === 'email' && dto.contactValue
          ? `Email: ${dto.contactValue}`
          : null,
        dto.productName ? `Товар: ${dto.productName}` : null,
        dto.productSlug ? `Slug: ${dto.productSlug}` : null,
        dto.quantity ? `Тираж: ${dto.quantity} шт` : null,
        dto.unitPrice ? `Цена за шт: ${dto.unitPrice} ₽` : null,
        money.pricePosition ? `Итого: ${money.pricePosition} ₽` : null,
        dto.delivery
          ? `Получение: ${
              dto.delivery === 'yandex_pvz'
                ? 'Яндекс ПВЗ'
                : isCourierMsk
                  ? `доставка до двери по Москве — ${CANVAS_COURIER_MSK_PRICE} ₽`
                  : 'Самовывоз'
            }`
          : null,
        dto.paperType
          ? `Бумага: ${dto.paperType === 'MATTE' ? 'матовая' : 'глянцевая'}`
          : null,
        dto.photosArchiveUrl ? `Архив фото: ${dto.photosArchiveUrl}` : null,
        dto.photosCount != null ? `Фото: ${dto.photosCount} шт` : null,
        dto.photosFailed ? 'Фото загружались, но архив не сохранился' : null,
        dto.canvasSizeLabel || dto.canvasSizeKey
          ? `Холст: ${dto.canvasSizeLabel ?? dto.canvasSizeKey}`
          : null,
        dto.canvasMaterial
          ? `Основа: ${dto.canvasMaterial === 'GLOSS' ? 'глянцевая' : 'матовая'}`
          : null,
        dto.canvasFrame && dto.canvasFrame !== 'NONE'
          ? `Багет: ${CANVAS_FRAME_LABELS[dto.canvasFrame] ?? dto.canvasFrame}`
          : null,
        // Края печатнику нужны всегда, включая вариант по умолчанию:
        // строка «Края: изображение на торцах» — это подтверждение, что
        // клиент выбирал, а не что поле забыли заполнить.
        dto.canvasEdge
          ? `Края: ${
              dto.canvasEdge === 'WHITE'
                ? 'белые, кадр целиком на лицевой стороне'
                : 'изображение продолжается на торцах'
            }`
          : null,
        dto.canvasCrop
          ? `Кадр клиента: ${dto.canvasCrop.width}×${dto.canvasCrop.height} px, смещение ${dto.canvasCrop.x};${dto.canvasCrop.y}`
          : null,
        dto.canvasResolution === 'low'
          ? '⚠ Разрешения на выбранный размер не хватает — клиент предупреждён на сайте'
          : dto.canvasResolution === 'tight'
            ? 'Разрешение впритык — клиент предупреждён на сайте'
            : null,
        dto.cloudLink ? `Ссылка на облако: ${dto.cloudLink}` : null,
        dto.yclid ? `yclid: ${dto.yclid}` : null,
        dto.yandexClientId ? `Yandex ClientID: ${dto.yandexClientId}` : null,
        dto.pageUrl ? `Страница: ${dto.pageUrl}` : null,
        dto.firstTouchUrl
          ? `Первая страница визита: ${dto.firstTouchUrl}`
          : null,
        dto.submittedAt ? `Отправлено на сайте: ${dto.submittedAt}` : null,
      ].filter(Boolean);

      const created = await tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          externalRequestId: dto.leadId,

          status: EnumStatus.LEAD,
          statusChangedAt: new Date(),
          // Та же ссылка, что строкой в примечании. Колонка нужна, чтобы
          // по ней удалить исходники, когда заказ отгружен: держать чужие
          // фотографии дольше работы незачем.
          photosArchiveUrl: dto.photosArchiveUrl ?? null,
          // Происхождение ставит сервер, а не заявка: сайт не может назваться
          // другим каналом, даже если в теле запроса что-то такое придёт
          // (лишние поля отсекает whitelist валидации, см. LeadController).
          sourceOrder: 'WEBSITE',
          communicationPlatform,
          urlCommunication,
          deliveryMethod,
          deliveryCost: leadDeliveryCost,
          // Сумма заказа = позиции + доставка: иначе отчёт вычтет доставку
          // из суммы, где её нет, и «выручка за товар» уйдёт в минус.
          totalOrder: total + leadDeliveryCost,
          productCategory: dto.productCategory ?? EnumProductCategory.PHOTO,
          note: noteLines.join('\n'),
          // Откуда пришёл человек — колонками. Те же данные остаются
          // строками в note выше: их читает менеджер, а колонки — отчёты
          // и импорт заказов в Метрику (см. lead-attribution.ts).
          ...attributionFromLead(dto),
          // Позицию заводим сразу: иначе администратору пришлось бы переносить
          // товар и тираж из примечания руками — это ошибки и потеря времени.
          // Холст заводится в свою таблицу, а не в фото-позиции: у него
          // другая экономика (себестоимость подрядчика по каждой штуке).
          ...buildLeadPosition(dto, money),
        },
        include: { items: true, tshirtItems: true, canvasItems: true },
      });
      await this.push.enqueueLead(tx, created, dto.productName);
      return created;
    });
  }

  async getAllOrders(
    query: DtoAllOrdersforQuery,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = this.buildOrdersWhere(query, currentUserId, currentUserRole, {
      applyListStatusDefaults: true,
    });

    const [orders, count] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: buildOrdersOrderBy(query.sort, query.dir),
        include: {
          items: true,
          tshirtItems: true,
          canvasItems: true,
          executor: { select: { id: true, username: true } },
          /*
           * Последняя версия листа согласования — в список.
           *
           * Статус заказа меняется только после того, как Telegram
           * подтвердит доставку листа. До этого момента заказ с готовым,
           * но не отправленным листом выглядит в списке как любой новый,
           * а неудачная доставка не видна вообще — и то и другое
           * обнаруживалось, только если открыть заказ.
           *
           * Берём одну, самую свежую версию: в списке важно состояние
           * макета сейчас, а история версий живёт в карточке.
           */
          approvals: {
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              version: true,
              status: true,
              finalizedAt: true,
              telegramDelivery: {
                select: { status: true, sentAt: true, errorCode: true },
              },
            },
          },
        },
      }),
      this.prisma.orderPhoto.count({
        where,
      }),
    ]);
    return {
      data: orders,
      meta: {
        page,
        limit,
        quantityElements: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getOrderStats(
    query: DtoAllOrdersforQuery,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const contextWhere = this.buildOrdersWhere(
      query,
      currentUserId,
      currentUserRole,
      { applyListStatusDefaults: false },
    );
    const listWhere = this.buildOrdersWhere(
      query,
      currentUserId,
      currentUserRole,
      {
        applyListStatusDefaults: true,
      },
    );

    const [orders, matchingTotal] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where: contextWhere,
        select: {
          status: true,
          productCategory: true,
          isUrgent: true,
          deadline: true,
          createdAt: true,
          sentAt: true,
          totalOrder: true,
          clientReviewLeft: true,
          reviewReminderNotifiedAt: true,
        },
      }),
      this.prisma.orderPhoto.count({ where: listWhere }),
    ]);

    const byStatus = Object.values(EnumStatus).reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<EnumStatus, number>,
    );
    const byProduct = Object.values(EnumProductCategory).reduce(
      (acc, category) => ({ ...acc, [category]: 0 }),
      {} as Record<EnumProductCategory, number>,
    );

    let activeCount = 0;
    let overdueCount = 0;
    let urgentCount = 0;
    let alertCount = 0;
    let readyCount = 0;
    let sentUnpaidAmount = 0;
    let reviewPendingCount = 0;
    let reviewRemindedCount = 0;

    for (const order of orders) {
      byStatus[order.status] += 1;
      byProduct[order.productCategory] += 1;

      if (!NOT_ACTIVE_STATUSES.includes(order.status)) {
        activeCount += 1;
      }

      if (READY_STATUSES.includes(order.status)) {
        readyCount += 1;
      }

      if (order.status === EnumStatus.SENT) {
        sentUnpaidAmount += order.totalOrder ?? 0;
      }

      const waitsForReview =
        REVIEW_WAITING_STATUSES.includes(order.status) &&
        !(
          order.productCategory === EnumProductCategory.CANVAS &&
          order.status === EnumStatus.SENT
        );
      if (waitsForReview && !order.clientReviewLeft) {
        reviewPendingCount += 1;
        // Уже напомнили в TG, отзыв ещё не отмечен — по этим стоит пройтись.
        if (order.reviewReminderNotifiedAt) reviewRemindedCount += 1;
      }

      // Алерты («требуют внимания») считаем только по заказам, которые видны
      // в рабочем списке: LEAD/SENT/PAID и закрытые не пугают счётчиком,
      // указывающим на невидимые строки.
      const isControlClosed =
        CONTROL_CLOSED_STATUSES.includes(order.status) ||
        order.status === EnumStatus.LEAD;
      const tracksDeadline =
        order.productCategory !== EnumProductCategory.TSHIRT;
      const isUrgent = order.isUrgent && !isControlClosed;
      // «Просрочен» — как в таблице: дедлайн прошёл (< 0). Заказ со сроком
      // «сегодня» показывается отдельно и просроченным не считается.
      const days = this.daysLeft(order.deadline, order.createdAt);
      const isOverdue =
        tracksDeadline && !isControlClosed && days !== null && days < 0;

      if (isUrgent) urgentCount += 1;
      if (isOverdue) overdueCount += 1;
      if (isUrgent || isOverdue) alertCount += 1;
    }

    // Менеджер по оформлению видит заказы и суммы как админ (кроме управления).
    const isAdmin =
      currentUserRole === EnumRole.ADMIN ||
      currentUserRole === EnumRole.ORDER_MANAGER;

    return {
      contextTotal: orders.length,
      matchingTotal,
      activeCount,
      leadCount: byStatus.LEAD,
      newCount: byStatus.NEW,
      inProgressCount:
        byStatus.FOLDER_STRUCTURE_CREATED +
        byStatus.IN_PROGRESS +
        byStatus.PRINTED,
      readyCount,
      sentUnpaidCount: byStatus.SENT,
      sentUnpaidAmount: isAdmin ? sentUnpaidAmount : null,
      paidCount: byStatus.PAID,
      reviewPendingCount: isAdmin ? reviewPendingCount : null,
      reviewRemindedCount: isAdmin ? reviewRemindedCount : null,
      overdueCount,
      urgentCount,
      alertCount,
      byStatus,
      byProduct,
    };
  }

  /**
   * Загрузка по исполнителям: кто сколько тянет прямо сейчас.
   *
   * Нужна, чтобы отбор по исполнителю не был выбором вслепую: в списке сразу
   * видно, у кого сколько активных заказов, что горит и что просрочено. Сюда
   * же попадает строка «Не назначен» — заказ без исполнителя не виден ни в
   * чьей загрузке, и теряются именно такие.
   *
   * Считаем только активные заказы: закрытые и отправленные к нагрузке
   * отношения не имеют, а цифра должна сходиться с рабочим списком.
   */
  async getExecutorWorkload(query: DtoAllOrdersforQuery) {
    const orders = await this.prisma.orderPhoto.findMany({
      where: {
        status: { notIn: NOT_ACTIVE_STATUSES },
        ...(query.productCategory
          ? { productCategory: query.productCategory }
          : {}),
      },
      select: {
        executorId: true,
        status: true,
        productCategory: true,
        isUrgent: true,
        deadline: true,
        createdAt: true,
        totalOrder: true,
      },
    });

    const load = new Map<
      string,
      {
        activeCount: number;
        urgentCount: number;
        overdueCount: number;
        readyCount: number;
        activeAmount: number;
      }
    >();
    const UNASSIGNED = 'none';

    for (const order of orders) {
      const key = order.executorId ?? UNASSIGNED;
      const row = load.get(key) ?? {
        activeCount: 0,
        urgentCount: 0,
        overdueCount: 0,
        readyCount: 0,
        activeAmount: 0,
      };

      row.activeCount += 1;
      row.activeAmount += order.totalOrder ?? 0;
      if (order.isUrgent) row.urgentCount += 1;
      if (READY_STATUSES.includes(order.status)) row.readyCount += 1;
      // Срок считаем так же, как в таблице и в общей статистике: у футболок
      // производство ведёт партнёр, поэтому дедлайн по ним не отслеживается.
      const days = this.daysLeft(order.deadline, order.createdAt);
      if (
        order.productCategory !== EnumProductCategory.TSHIRT &&
        days !== null &&
        days < 0
      ) {
        row.overdueCount += 1;
      }

      load.set(key, row);
    }

    const users = await this.prisma.user.findMany({
      where: {
        role: {
          in: [EnumRole.ADMIN, EnumRole.EXECUTOR, EnumRole.ORDER_MANAGER],
        },
        // Уволенного показываем, только пока на нём висят активные заказы:
        // иначе его строка исчезнет вместе с незакрытой работой.
        OR: [{ isActive: true }, { id: { in: [...load.keys()] } }],
      },
      select: { id: true, username: true, role: true, isActive: true },
      orderBy: { username: 'asc' },
    });

    const empty = {
      activeCount: 0,
      urgentCount: 0,
      overdueCount: 0,
      readyCount: 0,
      activeAmount: 0,
    };

    return [
      ...users.map((user) => ({ ...user, ...(load.get(user.id) ?? empty) })),
      {
        id: UNASSIGNED,
        username: 'Не назначен',
        role: null,
        isActive: true,
        ...(load.get(UNASSIGNED) ?? empty),
      },
    ];
  }

  private buildOrdersWhere(
    query: DtoAllOrdersforQuery,
    currentUserId: string,
    currentUserRole: string,
    options: { applyListStatusDefaults: boolean },
  ): Prisma.OrderPhotoWhereInput {
    // Strip leading @ so "@username" matches "https://t.me/username".
    const searchTerm = query.search?.replace(/^@/, '').trim() || undefined;
    const defaultHiddenStatuses =
      query.productCategory &&
      isExternalProductionCategory(query.productCategory)
        ? TSHIRT_LIST_HIDDEN_STATUSES
        : DEFAULT_LIST_HIDDEN_STATUSES;

    return {
      // Search should still find leads/paid orders by contact or number, but
      // SENT is intentionally hidden from search results unless explicitly
      // selected by the status filter: those orders are already handed off.
      // Review filters keep their wider status scope because the review cards
      // work with sent/paid orders.
      ...(options.applyListStatusDefaults
        ? {
            status: query.status
              ? query.status
              : searchTerm
                ? { not: EnumStatus.SENT }
                : query.reviewLeft !== undefined
                  ? undefined
                  : { notIn: defaultHiddenStatuses },
          }
        : {}),
      sourceOrder: query.sourceOrder,
      productCategory: query.productCategory,
      ...(query.reviewLeft !== undefined
        ? { clientReviewLeft: query.reviewLeft === 'true' }
        : {}),
      /*
       * Заказы с площадок. У них свой раздел, и в общем списке футболок
       * они только мешают: номер отправления вместо номера заказа, чужие
       * сроки, нет оплаты, другой трафик и другая экономика.
       *
       * В списке футболок они скрыты по умолчанию — решает сервер, а не
       * интерфейс. Так правило работает и в браузере со старой страницей
       * в кэше, и в любом другом клиенте: показать их можно, только
       * попросив явно.
       *
       * Прячем по признаку заказа, а не по источнику: признак ставит
       * сервер при заведении с площадки, и подменить его нельзя.
       */
      ...marketplaceWhere(query.marketplace, query.productCategory, options),
      /*
       * Самовывоз или доставка.
       *
       * Способов в базе пять, но для работы их два: заказ, за которым
       * придут, и заказ, который надо успеть отдать в пункт выдачи.
       * Поэтому «доставка» — это «любой способ, кроме самовывоза», а не
       * перечисление: добавится шестой способ — он сам попадёт куда надо.
       */
      ...(query.delivery
        ? {
            deliveryMethod:
              query.delivery === 'pickup'
                ? EnumDeliveryMethod.PICKUP
                : { not: EnumDeliveryMethod.PICKUP },
          }
        : {}),
      // Отбор по исполнителю. Стоит ДО блока роли EXECUTOR намеренно: тот
      // перезаписывает executorId своим идентификатором, и подставить сюда
      // чужого сотрудника через параметр запроса нельзя.
      ...(query.executorId
        ? { executorId: query.executorId === 'none' ? null : query.executorId }
        : {}),
      // Исполнитель видит только свои заказы и только фотопечать: внешние
      // продукты ведут подрядчики, исполнителям там делать нечего. productCategory
      // задаётся здесь жёстко и перекрывает параметр запроса — иначе
      // ?productCategory=TSHIRT открыл бы чужой продукт.
      ...(currentUserRole === EnumRole.EXECUTOR
        ? {
            executorId: currentUserId,
            productCategory: EnumProductCategory.PHOTO,
          }
        : {}),
      ...(searchTerm
        ? {
            OR: [
              { numberOrder: { contains: searchTerm, mode: 'insensitive' } },
              // Заказ с площадки ищут её номером: именно он открыт в кабинете,
              // когда заказ понадобился.
              {
                marketplaceOrderNumber: {
                  contains: searchTerm,
                  mode: 'insensitive',
                },
              },
              {
                urlCommunication: { contains: searchTerm, mode: 'insensitive' },
              },
              { note: { contains: searchTerm, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private daysLeft(deadline: Date | null, createdAt: Date): number | null {
    const due = deadline
      ? new Date(deadline)
      : new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return Math.round(
      (dueDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  async getOrderById(
    idOrder: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      include: {
        items: true,
        tshirtItems: true,
        canvasItems: true,
        executor: { select: { id: true, username: true } },
        accruals: {
          select: {
            id: true,
            status: true,
            salaryAmount: true,
            paidAmount: true,
            rateBasisPoints: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (currentUserRole === EnumRole.EXECUTOR) {
      if (order.productCategory !== EnumProductCategory.PHOTO) {
        throw new ForbiddenException(
          'Этот тип заказа ведёт администратор или менеджер.',
        );
      }
      if (order.executorId !== currentUserId) {
        throw new ForbiddenException('Нет доступа к чужому заказу.');
      }
    }
    return order;
  }

  async assignExecutor(
    orderId: string,
    dto: DtoAssignExecutor,
    adminId: string,
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const isUnassign = !dto.executorId;

    // Внешние продукты уходят подрядчику — своего исполнителя на них не назначаем.
    // Снятие оставляем разрешённым: это аварийный выход для старых заказов.
    if (!isUnassign && isExternalProductionCategory(order.productCategory)) {
      throw new BadRequestException(
        'Для заказов этого типа исполнитель не назначается — работу выполняет подрядчик',
      );
    }

    let executor: {
      id: string;
      username: string;
      rateBasisPoints: number | null;
      isActive: boolean;
      telegramUsername: string | null;
      telegramTopicId: number | null;
      telegramChatId: string | null;
    } | null = null;
    if (!isUnassign) {
      executor = await this.prisma.user.findUnique({
        where: { id: dto.executorId! },
      });
      if (!executor) throw new NotFoundException('Исполнитель не найден');
      if (!executor.isActive)
        throw new BadRequestException('Исполнитель деактивирован');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Если заказ в SENT — управляем начислением исполнителя (не менеджера).
      if (order.status === EnumStatus.SENT) {
        const oldAccrual = await tx.salaryAccrual.findFirst({
          where: {
            orderId,
            kind: 'EXECUTOR',
            status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          },
        });

        if (oldAccrual) {
          if (oldAccrual.paidAmount === 0) {
            await tx.salaryAccrual.delete({ where: { id: oldAccrual.id } });
          } else {
            await tx.salaryAccrual.update({
              where: { id: oldAccrual.id },
              data: { status: 'REVERSED' },
            });
          }
        }

        // Создаём начисление только при назначении (не при снятии)
        if (!isUnassign && executor && executor.rateBasisPoints !== null) {
          const snapshot = calculateSalarySnapshot(
            order.totalOrder,
            order.deliveryCost,
            executor.rateBasisPoints,
            order.urgencyFee,
          );
          await tx.salaryAccrual.create({
            data: { orderId, executorId: dto.executorId!, ...snapshot },
          });
        }
      }

      await tx.orderPhoto.update({
        where: { id: orderId },
        data: { executorId: isUnassign ? null : dto.executorId },
      });

      if (!isUnassign) {
        await tx.orderAssignment.create({
          data: {
            orderId,
            executorId: dto.executorId!,
            assignedBy: adminId,
            note: dto.note,
          },
        });
      }

      return tx.orderPhoto.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          tshirtItems: true,
          canvasItems: true,
          executor: { select: { id: true, username: true } },
          accruals: {
            select: {
              id: true,
              status: true,
              salaryAmount: true,
              paidAmount: true,
              rateBasisPoints: true,
            },
          },
        },
      });
    });

    if (!isUnassign && result) {
      if (
        executor?.telegramUsername ||
        executor?.telegramTopicId != null ||
        executor?.telegramChatId
      ) {
        const text = this.buildAssignmentMessage(
          result,
          executor.telegramUsername ?? '',
        );
        // Если у исполнителя задана тема — задача уходит прямо в его тему
        // («задачи Лёхи»), иначе в начало чата с упоминанием по нику.
        const threadId =
          executor.telegramTopicId != null
            ? String(executor.telegramTopicId)
            : undefined;
        this.telegram
          .sendToExecutor(
            text,
            threadId,
            executor.username,
            executor.telegramUsername ?? undefined,
            executor.telegramChatId,
          )
          .catch(() => {});
      } else {
        this.logger.warn(
          `Заказ ${result.numberOrder}: у исполнителя нет ни Telegram-ника, ни темы — уведомление пропущено`,
        );
      }
    }

    return result;
  }

  /** Текст уведомления в общую группу при назначении исполнителя на заказ. */
  private buildAssignmentMessage(
    order: {
      numberOrder: string;
      deadline: Date | null;
      productCategory: string;
      isFreePrice: boolean | null;
      note: string | null;
      items: {
        formatPaper: string;
        typePaper: string;
        quantity: number;
        isFreePrice?: boolean | null;
      }[];
      tshirtItems: { color: string; size: string; quantity: number }[];
      canvasItems?: {
        formatCanvas: string;
        quantity: number;
      }[];
    },
    username: string,
  ): string {
    // Тег по нику, если он есть. Если исполнителя нашли только по теме (ник не
    // задан) — обходимся без «@»: сообщение и так уходит прямо в его тему.
    const greeting = username.trim()
      ? `🔔 @${username.replace(/^@/, '')}, вам назначена задача!`
      : '🔔 Вам назначена задача!';

    const lines: string[] = [];
    for (const i of order.items) {
      if (order.isFreePrice || i.isFreePrice) {
        lines.push(`• ${escapeHtml(i.formatPaper)} × ${i.quantity} шт`);
      } else {
        const type = i.typePaper === 'GLOSS' ? 'Глянец' : 'Матт';
        lines.push(
          `• ${escapeHtml(i.formatPaper)} (${type}) × ${i.quantity} шт`,
        );
      }
    }
    for (const i of order.tshirtItems) {
      lines.push(
        `• Футболка ${escapeHtml(i.color)}, р-р ${i.size} × ${i.quantity} шт`,
      );
    }
    for (const i of order.canvasItems ?? []) {
      lines.push(`• Холст ${escapeHtml(i.formatCanvas)} × ${i.quantity} шт`);
    }
    if (lines.length === 0) lines.push('• (позиции не добавлены)');

    const deadlineStr = order.deadline
      ? `до ${formatRuDate(order.deadline)}`
      : 'не указан';
    const category =
      order.productCategory === 'TSHIRT'
        ? 'Футболки'
        : order.productCategory === 'CANVAS'
          ? 'Печать на холсте'
          : 'Фотопечать';
    const deadlineLine =
      order.productCategory === 'TSHIRT' ? [] : [`⏳ Срок: ${deadlineStr}`];

    const noteBlock = order.note
      ? [
          '',
          '─────────────────',
          `📝 <b>Примечание:</b>`,
          `<i>${escapeHtml(order.note)}</i>`,
        ]
      : [];

    return [
      greeting,
      '',
      `📋 Заказ: <code>${escapeHtml(order.numberOrder)}</code>`,
      `🏷 Категория: ${category}`,
      ...deadlineLine,
      '',
      '📦 Состав заказа:',
      ...lines,
      ...noteBlock,
    ].join('\n');
  }

  /**
   * Указать фактическую дату оплаты заказу, который уже оплачен, но даты
   * не имеет (работа D1).
   *
   * Так закрывается единственный честный путь для заказов, переведённых в
   * PAID выплатой зарплаты: система дату не выдумывает, её сообщает человек,
   * когда знает. Поэтому действие одноразовое: заполнить пустое поле можно,
   * переписать заполненное — нет, иначе это превратится в редактирование
   * финансовой истории.
   */
  async setClientPaidAt(id: string, value: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        clientPaidAt: true,
        numberOrder: true,
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (!PAID_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Дата оплаты указывается только оплаченному заказу.',
      );
    }
    if (order.clientPaidAt) {
      throw new BadRequestException(
        'Дата оплаты уже зафиксирована и не меняется.',
      );
    }

    const clientPaidAt = parseClientPaidAt(value, {
      createdAt: order.createdAt,
    });
    this.logger.log(
      `Заказ ${order.numberOrder}: указана фактическая дата оплаты ${clientPaidAt.toISOString()}`,
    );
    return this.prisma.orderPhoto.update({
      where: { id },
      data: { clientPaidAt },
      include: {
        items: true,
        tshirtItems: true,
        canvasItems: true,
        executor: { select: { id: true, username: true } },
      },
    });
  }

  async updateStatusOrder(
    id: string,
    dto: UpdateStatus,
    userId: string,
    userRole: string,
  ) {
    const order = await this.getOrderById(id, userId, userRole);

    const isAdmin = userRole === 'ADMIN';
    // Менеджер по оформлению не привязан к заказу как исполнитель, но ведёт
    // любые заказы: проверку «свой заказ» к нему не применяем.
    const isManager = userRole === EnumRole.ORDER_MANAGER;

    const newStatus = dto.status;
    const transitionError = fulfillmentError(order, newStatus);
    if (transitionError) throw new BadRequestException(transitionError);

    // Фактическая дата оплаты (работа D1). Приходит только вместе с PAID и
    // только пока дата не зафиксирована: молча переписывать чужую отметку
    // об оплате нельзя, для исправления есть отдельный разговор с владельцем.
    let explicitPaidAt: Date | null = null;
    if (dto.clientPaidAt !== undefined && dto.clientPaidAt !== '') {
      if (newStatus !== EnumStatus.PAID) {
        throw new BadRequestException(
          'Дату оплаты можно указать только при переводе заказа в «Оплачен».',
        );
      }
      if (order.clientPaidAt) {
        throw new BadRequestException(
          'Дата оплаты уже зафиксирована и не меняется.',
        );
      }
      explicitPaidAt = parseClientPaidAt(dto.clientPaidAt, {
        createdAt: order.createdAt,
      });
    }

    // Исполнитель может двигать рабочий поток в любом направлении до оплаты.
    // PAID закрывает деньги и остаётся админским действием; CANCELLED тоже
    // оставляем админским, потому что это выводит заказ из рабочего процесса.
    // Менеджер по оформлению деньги не закрывает — эти статусы ему тоже нельзя.
    const ADMIN_ONLY_STATUSES: EnumStatus[] = [
      EnumStatus.PAID,
      EnumStatus.CANCELLED,
    ];
    if (!isAdmin) {
      if (newStatus === EnumStatus.SHIPMENT_CREATED && !isManager) {
        throw new ForbiddenException(
          'Создать отгрузку может только администратор или менеджер по оформлению.',
        );
      }
      if (!isManager && order.executorId !== userId) {
        throw new ForbiddenException(
          'Вы не назначены исполнителем этого заказа.',
        );
      }
      if (ADMIN_ONLY_STATUSES.includes(newStatus)) {
        throw new ForbiddenException(
          'Этот статус может установить только администратор.',
        );
      }
    }

    // Защита от «отправлен без исполнителя»: у фото при переходе в SENT
    // начисляется зарплата, а начислять некому — значит исполнитель просто
    // забыт. У внешних продуктов исполнителя нет (их ведёт подрядчик), их не трогаем.
    if (
      newStatus === EnumStatus.SENT &&
      earnsStaffSalary(order.productCategory) &&
      !order.executorId
    ) {
      throw new BadRequestException(
        'Нельзя перевести заказ в «Отправлен» без исполнителя — сначала назначьте исполнителя.',
      );
    }

    if (
      newStatus === EnumStatus.SENT &&
      order.productCategory === EnumProductCategory.TSHIRT
    ) {
      if (!hasTechSpecFiles(order)) {
        throw new BadRequestException(
          'Сначала прикрепите ТЗ-фото, затем переводите заказ в «Отправлен».',
        );
      }
      if (!hasProductionItems(order)) {
        throw new BadRequestException(NO_PRODUCTION_ITEMS_MESSAGE);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "OrderPhoto"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const lockedOrder = await tx.orderPhoto.findUnique({
        where: { id },
        include: {
          items: true,
          tshirtItems: true,
          canvasItems: true,
          executor: { select: { id: true, username: true } },
        },
      });
      if (!lockedOrder) throw new NotFoundException('Заказ не найден');
      // Recheck after locking: delivery/status/assignee may have changed while waiting.
      const lockedError = fulfillmentError(lockedOrder, newStatus);
      if (lockedError) throw new BadRequestException(lockedError);
      if (!isAdmin && !isManager && lockedOrder.executorId !== userId) {
        throw new ForbiddenException(
          'Вы не назначены исполнителем этого заказа.',
        );
      }
      if (
        newStatus === EnumStatus.SENT &&
        earnsStaffSalary(lockedOrder.productCategory) &&
        !lockedOrder.executorId
      ) {
        throw new BadRequestException('Сначала назначьте исполнителя.');
      }
      if (
        newStatus === EnumStatus.SENT &&
        lockedOrder.productCategory === EnumProductCategory.TSHIRT &&
        (!hasTechSpecFiles(lockedOrder) || !hasProductionItems(lockedOrder))
      ) {
        throw new BadRequestException(
          'Для передачи в производство нужны позиции и ТЗ-фото.',
        );
      }
      if (lockedOrder.status === newStatus) return lockedOrder;

      // Записываем историю изменения статуса
      const history = await tx.statusHistory.create({
        data: {
          orderId: id,

          fromStatus: lockedOrder.status,
          toStatus: newStatus,
          changedBy: userId,
        },
      });

      // Уход из «Отправлен» — снимаем незакрытое начисление зарплаты.
      // (Склад футболок отключён: заготовки предоставляет партнёр, свой
      // остаток мы не ведём и при смене статуса ничего не списываем.)
      if (
        lockedOrder.status === EnumStatus.SENT &&
        newStatus !== EnumStatus.SENT &&
        newStatus !== EnumStatus.PAID
      ) {
        // Возврат из «Отправлен» снимает начисления и исполнителя, и менеджера.
        const activeAccruals = await tx.salaryAccrual.findMany({
          where: {
            orderId: id,
            status: { in: ['PENDING', 'SETTLED', 'PARTIALLY_PAID', 'PAID'] },
          },
        });
        if (
          activeAccruals.some((a) => a.paidAmount > 0 || a.status === 'PAID')
        ) {
          throw new ConflictException(
            'Нельзя вернуть заказ из «Отправлен»: по нему уже была выплата зарплаты.',
          );
        }
        if (activeAccruals.length > 0) {
          await tx.salaryAccrual.deleteMany({
            where: { id: { in: activeAccruals.map((a) => a.id) } },
          });
        }
      }

      // При переводе в SENT создаём начисление зарплаты исполнителю.
      // Это должно работать и для админа, и для назначенного исполнителя:
      // пользователь двигает статус, а финансовая целостность остаётся серверной.
      if (
        newStatus === EnumStatus.SENT &&
        lockedOrder.executorId &&
        earnsStaffSalary(lockedOrder.productCategory)
      ) {
        const executor = await tx.user.findUnique({
          where: { id: lockedOrder.executorId },
        });

        if (executor && executor.rateBasisPoints !== null) {
          const existingAccrual = await tx.salaryAccrual.findFirst({
            where: {
              orderId: id,
              kind: 'EXECUTOR',
              status: { not: 'REVERSED' },
            },
          });

          if (!existingAccrual) {
            const snapshot = calculateSalarySnapshot(
              lockedOrder.totalOrder,
              lockedOrder.deliveryCost,
              executor.rateBasisPoints,
              lockedOrder.urgencyFee,
            );

            await tx.salaryAccrual.create({
              data: {
                orderId: id,
                executorId: lockedOrder.executorId,
                kind: 'EXECUTOR',
                ...snapshot,
              },
            });
          }
        }
      }

      // При переводе в SENT начисляем зарплату менеджеру по оформлению:
      // базовая ставка (чек − доставка − дизайн) + премия за дизайн.
      if (
        newStatus === EnumStatus.SENT &&
        lockedOrder.processedById &&
        earnsStaffSalary(lockedOrder.productCategory)
      ) {
        const manager = await tx.user.findUnique({
          where: { id: lockedOrder.processedById },
        });

        if (manager && manager.role === EnumRole.ORDER_MANAGER) {
          const existingManagerAccrual = await tx.salaryAccrual.findFirst({
            where: {
              orderId: id,
              kind: 'MANAGER',
              status: { not: 'REVERSED' },
            },
          });

          if (!existingManagerAccrual) {
            const snapshot = calculateManagerSalarySnapshot(
              lockedOrder.totalOrder,
              lockedOrder.deliveryCost,
              lockedOrder.designDevelopmentCost,
              manager.rateBasisPoints,
              manager.designRateBasisPoints,
              lockedOrder.urgencyFee,
            );

            // Нулевое начисление не создаём (ставки не заданы или суммы нулевые).
            if (snapshot.salaryAmount > 0) {
              await tx.salaryAccrual.create({
                data: {
                  orderId: id,
                  executorId: manager.id,
                  kind: 'MANAGER',
                  salaryBase: snapshot.salaryBase,
                  rateBasisPoints: snapshot.rateBasisPoints,
                  salaryAmount: snapshot.salaryAmount,
                  designBase: snapshot.designBase,
                  designRateBasisPoints: snapshot.designRateBasisPoints,
                  status: snapshot.status,
                },
              });
            }
          }
        }
      }

      // При переводе в PAID автоматически закрываем незакрытый долг по зарплате
      // всем получателям заказа: и исполнителю, и менеджеру по оформлению.
      if (newStatus === EnumStatus.PAID && isAdmin) {
        const pendingAccruals = await tx.salaryAccrual.findMany({
          where: { orderId: id, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        });

        for (const accrual of pendingAccruals) {
          const remaining = accrual.salaryAmount - accrual.paidAmount;
          if (remaining <= 0) continue;
          const payment = await tx.salaryPayment.create({
            data: {
              executorId: accrual.executorId,
              paidById: userId,
              amount: remaining,
              note: `Автовыплата при переводе заказа ${lockedOrder.numberOrder} в «Оплачен»`,
            },
          });
          await tx.salaryAccrual.update({
            where: { id: accrual.id },
            data: { paidAmount: accrual.salaryAmount, status: 'PAID' },
          });
          await tx.paymentAccrualLink.create({
            data: {
              paymentId: payment.id,
              accrualId: accrual.id,
              amount: remaining,
            },
          });
        }
      }

      // Футболки: вознаграждение партнёра — авто-расход на «Оплачен».
      // Считается по позициям заказа и снимается при уходе из «Оплачен».
      if (lockedOrder.productCategory === EnumProductCategory.TSHIRT) {
        await this.partnerSettings.syncRewardExpense(tx, {
          orderId: id,
          orderNumber: lockedOrder.numberOrder,
          // Весь заказ, а не только футболки: печать на изделии заказчика
          // заводится свободной позицией, и партнёру за неё тоже причитается.
          order: lockedOrder,
          isPaid: newStatus === EnumStatus.PAID,
          actingUserId: userId,
          // Тот же принцип, что в отчётах: выручка признаётся по дате отправки,
          // иначе для старых заказов — по дате создания.
          revenueDate: lockedOrder.sentAt ?? lockedOrder.createdAt,
        });
      }

      if (lockedOrder.productCategory === EnumProductCategory.CANVAS) {
        await this.syncCanvasContractorExpense(tx, {
          orderId: id,
          orderNumber: lockedOrder.numberOrder,
          items: lockedOrder.canvasItems,
          isPaid: newStatus === EnumStatus.PAID,
          actingUserId: userId,
          revenueDate: lockedOrder.sentAt ?? lockedOrder.createdAt,
        });
      }

      const updated = await tx.orderPhoto.update({
        where: { id },
        data: {
          status: dto.status,
          // Отсчёт «зависания» начинается заново с каждой сменой статуса.
          statusChangedAt: new Date(),
          // Срок начинает идти, когда обращение стало заказом
          // (правило и почему — в deadline-start.ts).
          ...deadlineOnAccept(lockedOrder, newStatus),
          // Новая отгрузка — новый отсчёт 48 часов. Без сброса повторная
          // поставка осталась бы вообще без напоминаний: счётчик уже полон.
          ...(newStatus === EnumStatus.SHIPMENT_CREATED
            ? { shipmentRemindersSent: 0 }
            : {}),
          // sentAt ставим и при прямом переводе в PAID (минуя SENT — типично
          // для самовывоза): иначе заказ выпадает из напоминаний об отзыве.
          ...((newStatus === EnumStatus.PAID ||
            (newStatus === EnumStatus.SENT &&
              lockedOrder.productCategory !== EnumProductCategory.CANVAS)) &&
          !lockedOrder.sentAt
            ? { sentAt: new Date() }
            : {}),
          ...(newStatus === EnumStatus.COMPLETED
            ? { completedAt: lockedOrder.completedAt ?? new Date() }
            : {}),
          // Первая оплата — один раз и навсегда (см. paid-at.ts). До этого
          // поле не заполнял никто, и отчёты жили на statusChangedAt.
          ...clientPaidAtPatch({
            current: lockedOrder.clientPaidAt,
            next: newStatus,
            explicit: explicitPaidAt,
          }),
          // closedAt: ставим при уходе в закрытые статусы (для сортировки списка),
          // сбрасываем при возврате заказа в работу.
          closedAt: CLOSED_STATUSES.includes(newStatus)
            ? (lockedOrder.closedAt ?? new Date())
            : null,
        },
        include: {
          items: true,
          tshirtItems: true,
          canvasItems: true,
          executor: { select: { id: true, username: true } },
        },
      });

      // Заказ для Метрики — в той же транзакции: заявка стала заказом,
      // оплачен, отменён, возвращён в работу. Внутренние шаги не ставятся.
      // Сама Метрика здесь не вызывается — это делает воркер очереди.
      await this.metrikaOutbox.enqueueTransition(tx, {
        orderId: id,
        fromStatus: lockedOrder.status,
        toStatus: newStatus,
        statusHistoryId: history.id,
      });

      return updated;
    });

    /*
     * Заказ отгружен — исходники на сайте больше не нужны.
     *
     * Отпечатки у человека, а фотографии продолжали бы лежать на диске
     * сайта до истечения общего срока. Удаляем не в транзакции и не
     * блокируя ответ: смена статуса не должна падать из-за того, что сайт
     * в эту секунду недоступен. Ссылка обнуляется только при успехе,
     * поэтому неудачная попытка повторится при следующей смене статуса.
     */
    if (
      PHOTOS_RELEASED_STATUSES.includes(newStatus) &&
      order.photosArchiveUrl
    ) {
      void this.sitePhotos
        .dropForOrder(id, order.photosArchiveUrl)
        .catch(() => undefined);
    }

    return result;
  }

  /**
   * Холсты: цена подрядчика — авто-расход на «Оплачен».
   * Датируем расход периодом заказа, чтобы выручка и себестоимость попадали
   * в один месяц отчёта.
   */
  private async syncCanvasContractorExpense(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      orderNumber: string;
      items: {
        contractorCostPosition: number;
        profitPosition: number;
      }[];
      isPaid: boolean;
      actingUserId: string;
      revenueDate: Date;
    },
  ): Promise<void> {
    const existing = await tx.expenseOrder.findFirst({
      where: {
        orderId: params.orderId,
        category: EnumExpenseCategory.CANVAS_CONTRACTOR,
      },
    });

    if (!params.isPaid) {
      if (existing) {
        await tx.expenseOrder.delete({ where: { id: existing.id } });
      }
      return;
    }

    const contractorCost = params.items.reduce(
      (s, i) => s + (i.contractorCostPosition ?? 0),
      0,
    );
    const profit = params.items.reduce(
      (s, i) => s + (i.profitPosition ?? 0),
      0,
    );

    if (contractorCost <= 0) {
      if (existing)
        await tx.expenseOrder.delete({ where: { id: existing.id } });
      return;
    }

    const note = `Подрядчик по холстам: заказ ${params.orderNumber} (маржа ${profit} ₽)`;

    if (existing) {
      await tx.expenseOrder.update({
        where: { id: existing.id },
        data: { amount: contractorCost, note, createdAt: params.revenueDate },
      });
      return;
    }

    await tx.expenseOrder.create({
      data: {
        category: EnumExpenseCategory.CANVAS_CONTRACTOR,
        amount: contractorCost,
        note,
        orderId: params.orderId,
        createdById: params.actingUserId,
        createdAt: params.revenueDate,
      },
    });
  }

  async dispatchTshirtToPartner(id: string, userId: string, userRole: string) {
    const order = await this.getOrderById(id, userId, userRole);
    if (order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new BadRequestException(
        'Исполнителю отправляются только футболки.',
      );
    }
    if (!hasTechSpecFiles(order)) {
      throw new BadRequestException(
        'Сначала прикрепите ТЗ-фото, затем отправляйте исполнителю.',
      );
    }
    if (!hasProductionItems(order)) {
      throw new BadRequestException(NO_PRODUCTION_ITEMS_MESSAGE);
    }

    await this.tshirtPartnerTelegram.sendOrder(id);

    const sent = await this.prisma.orderPhoto.findUnique({
      where: { id },
      select: { partnerSyncStatus: true, partnerSyncError: true },
    });
    if (sent?.partnerSyncStatus !== 'SENT') {
      throw new BadRequestException(
        sent?.partnerSyncError ?? 'Не удалось отправить ТЗ исполнителю.',
      );
    }

    if (order.status !== EnumStatus.SENT) {
      await this.updateStatusOrder(
        id,
        { status: EnumStatus.SENT },
        userId,
        userRole,
      );
    }

    // Enqueue Gulian CRM event
    const dispatchedOrder = await this.prisma.orderPhoto.findUnique({
      where: { id },
      include: { tshirtItems: true },
    });
    if (dispatchedOrder) {
      try {
        const settings = await this.partnerSettings.get();
        await this.gulianOutbox.enqueue(
          this.prisma,
          {
            id: dispatchedOrder.id,
            numberOrder: dispatchedOrder.numberOrder,
            status: dispatchedOrder.status as any,
            createdAt: dispatchedOrder.createdAt,
            updatedAt: dispatchedOrder.updatedAt,
            executorSentAt: dispatchedOrder.executorSentAt as Date | null,
            sourceRevision: (dispatchedOrder as any).sourceRevision ?? 1,
            partnerTgChatId: (dispatchedOrder as any).partnerTgChatId ?? null,
            partnerTgMessageId:
              (dispatchedOrder as any).partnerTgMessageId ?? null,
            tshirtItems: dispatchedOrder.tshirtItems,
          },
          settings.partnerRateBasisPoints,
        );
      } catch (gulErr) {
        this.logger.warn(`Gulian enqueue failed after dispatch: ${gulErr}`);
      }
    }

    return this.getOrderById(id, userId, userRole);
  }

  async updateOrder(
    idOrder: string,
    dto: DtoUpdateOrder,
    changedBy = 'system',
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OrderPhoto" WHERE "id" = ${idOrder} FOR UPDATE`;
      const order = await tx.orderPhoto.findUnique({
        where: { id: idOrder },
        include: { items: true, tshirtItems: true, canvasItems: true },
      });
      if (!order) throw new NotFoundException('Заказ не найден');
      const deliveryMethod = dto.deliveryMethod ?? order.deliveryMethod;
      const methodChanged = deliveryMethod !== order.deliveryMethod;
      if (
        deliveryMethod === EnumDeliveryMethod.PRODUCTION_MSK &&
        order.productCategory !== EnumProductCategory.CANVAS
      ) {
        throw new BadRequestException(
          'Доставка производства доступна только для холстов.',
        );
      }
      const deliveryCost =
        deliveryMethod === EnumDeliveryMethod.PICKUP &&
        (dto.deliveryMethod !== undefined || dto.deliveryCost !== undefined)
          ? 0
          : (dto.deliveryCost ?? order.deliveryCost);
      if (
        methodChanged &&
        (order.status === EnumStatus.PAID ||
          order.status === EnumStatus.COMPLETED ||
          (order.productCategory === EnumProductCategory.PHOTO &&
            order.status === EnumStatus.SENT))
      ) {
        throw new ConflictException(
          'Нельзя менять способ получения уже выданного или закрытого заказа.',
        );
      }
      // A shipping label belongs to the old delivery method, never to a new one.
      const resetShipment =
        (methodChanged || deliveryMethod === EnumDeliveryMethod.PICKUP) &&
        order.status === EnumStatus.SHIPMENT_CREATED;
      const deliveryChanged = deliveryCost !== order.deliveryCost;
      const designChanged =
        dto.designDevelopmentCost !== undefined &&
        dto.designDevelopmentCost !== order.designDevelopmentCost;
      const urgencyChanged =
        (dto.urgencyFee !== undefined && dto.urgencyFee !== order.urgencyFee) ||
        (dto.isUrgent !== undefined && dto.isUrgent !== order.isUrgent);
      const discountChanged =
        dto.discountAmount !== undefined &&
        dto.discountAmount !== order.discountAmount;
      // Доставка, дизайн, срочность и скидка влияют на сумму заказа и на
      // начисления: скидку мы делим с исполнителем, значит его база тоже
      // меняется и невыплаченное начисление надо пересчитать.
      const financialChanged =
        deliveryChanged || designChanged || urgencyChanged || discountChanged;
      if (financialChanged) {
        if (
          order.status === EnumStatus.PAID ||
          order.status === EnumStatus.COMPLETED
        )
          throw new ConflictException(
            'Финансовые условия закрытого заказа нельзя менять.',
          );
        await this.financialIntegrity.assertOrderFinanciallyEditable(
          idOrder,
          tx,
        );
      }
      const designDevelopmentCost = designChanged
        ? Math.max(0, dto.designDevelopmentCost!)
        : order.designDevelopmentCost;
      // Сняли срочность — снимается и плата за неё, иначе она осталась бы в чеке
      // строкой, которой в заказе больше нет.
      const isUrgent =
        dto.isUrgent !== undefined ? dto.isUrgent : order.isUrgent;
      const urgencyFee = !isUrgent
        ? 0
        : dto.urgencyFee !== undefined
          ? Math.max(0, dto.urgencyFee)
          : order.urgencyFee;
      if (
        dto.urlCommunication !== undefined ||
        dto.communicationPlatform !== undefined
      ) {
        const contactError = validateCommunicationValue(
          dto.communicationPlatform ?? order.communicationPlatform,
          dto.urlCommunication ?? order.urlCommunication,
        );
        if (contactError) throw new BadRequestException(contactError);
      }
      // Позиции заказа — основа суммы. Берём их из самого заказа: правка
      // карточки их не меняет, а вот скидку считать «правкой прежнего
      // итога» нельзя — она зависит от того, из чего этот итог состоит.
      const positionsTotal =
        order.items.reduce((sum, i) => sum + (i.pricePosition ?? 0), 0) +
        order.tshirtItems.reduce((sum, i) => sum + (i.pricePosition ?? 0), 0) +
        order.canvasItems.reduce((sum, i) => sum + (i.pricePosition ?? 0), 0);
      const discountAmount = clampOrderDiscount(
        dto.discountAmount ?? order.discountAmount,
        { positionsTotal, designDevelopmentCost },
      );
      const maxLinkTemplate = (await this.partnerSettings.get(tx))
        .maxLinkTemplate;
      const updated = await tx.orderPhoto.update({
        where: { id: idOrder },
        include: {
          items: true,
          tshirtItems: true,
          canvasItems: true,
          executor: { select: { id: true, username: true } },
        },
        data: {
          sourceOrder: dto.sourceOrder ?? order.sourceOrder,
          communicationPlatform:
            dto.communicationPlatform ?? order.communicationPlatform,
          urlCommunication: dto.urlCommunication
            ? buildCommunicationUrl(
                dto.communicationPlatform ?? order.communicationPlatform,
                dto.urlCommunication,
                maxLinkTemplate,
              )
            : order.urlCommunication,
          deliveryMethod,
          ...(resetShipment
            ? {
                status: EnumStatus.READY,
                statusChangedAt: new Date(),
                shipmentRemindersSent: 0,
              }
            : {}),
          deliveryCost,
          designDevelopmentCost,
          urgencyFee,
          // Сумма = позиции + доставка + дизайн + срочность − скидка.
          // Считаем от позиций, а не «правкой прежнего итога»: со скидкой
          // разностная формула разъезжается, если позиции меняли отдельно.
          totalOrder: orderTotal({
            positionsTotal,
            deliveryCost,
            designDevelopmentCost,
            urgencyFee,
            discountAmount,
          }),
          discountAmount,
          note: dto.note ?? order.note,
          isUrgent,
          tshirtModel: dto.tshirtModel ?? order.tshirtModel,
          // Номер площадки дописывают правкой карточки: в момент оформления
          // его не всегда знают. Пустая строка стирает номер — заказ снова
          // называется внутренним номером. Поле не прислали — не трогаем.
          marketplaceOrderNumber:
            dto.marketplaceOrderNumber === undefined
              ? order.marketplaceOrderNumber
              : normalizeMarketplaceNumber(dto.marketplaceOrderNumber),
          // Предоплата записывается реальной суммой и дальше не пересчитывается:
          // меняется только остаток при правках заказа (см. computePrepayment).
          // null — снять запись (вернуться к ориентиру 50%); undefined — не трогать.
          prepaidAmount:
            dto.prepaidAmount === undefined
              ? order.prepaidAmount
              : dto.prepaidAmount === null
                ? null
                : Math.max(0, dto.prepaidAmount),
        },
      });
      // Доставка/дизайн влияют на сумму → подгоняем невыплаченные начисления.
      if (financialChanged) {
        await this.financialIntegrity.recalcPendingAccrual(
          idOrder,
          updated.totalOrder,
          updated.deliveryCost,
          tx,
        );
      }
      if (resetShipment)
        await tx.statusHistory.create({
          data: {
            orderId: idOrder,
            fromStatus: order.status,
            toStatus: EnumStatus.READY,
            changedBy,
          },
        });
      return updated;
    });
  }

  /** Отметить, оставил ли клиент отзыв (вручную из списка заказов). */
  async setReviewLeft(idOrder: string, value: boolean) {
    await this.getOrderById(idOrder, '', EnumRole.ADMIN);
    return this.prisma.orderPhoto.update({
      where: { id: idOrder },
      data: { clientReviewLeft: value },
      include: {
        items: true,
        tshirtItems: true,
        canvasItems: true,
        executor: { select: { id: true, username: true } },
      },
    });
  }

  /**
   * Удалить заказ — только с объяснением, и обратимо 30 дней.
   *
   * Заявки с сайта иногда приходится удалять: дубль, ошибка, человек
   * передумал. Раньше заказ исчезал молча, и через месяц никто не мог
   * сказать, почему заявок с сайта меньше, чем визитов. Поэтому причина
   * обязательна.
   *
   * Но причины мало: удаляют и по ошибке, а с заказом уходили позиции,
   * история и начисления — восстанавливать было нечего. Теперь перед
   * удалением заказ целиком уезжает в корзину (OrderArchiveService), и
   * месяц его можно вернуть.
   *
   * Сам заказ при этом по-прежнему удаляется физически, а не прячется
   * флагом: заказы читают около девяноста запросов в тридцати модулях, и
   * любой пропущенный «не показывать удалённые» вернул бы удалённый заказ
   * в выручку или в чью-то зарплату, причём молча.
   */
  async deleteOrder(
    idOrder: string,
    reason: string,
    deletedBy?: { id: string; name?: string },
  ) {
    const clean = (reason ?? '').trim();
    if (!clean) {
      throw new BadRequestException(
        'Укажите причину удаления — без неё заявка не удаляется.',
      );
    }
    // Проверка существования и прав — до транзакции, как было: 404 не должен
    // зависеть от того, что происходит внутри.
    await this.getOrderById(idOrder, '', EnumRole.ADMIN);

    return this.prisma.$transaction(async (tx) => {
      // Корзину заполняем первой: если удаление упадёт, транзакция откатит и
      // её, а обратный порядок оставил бы удалённый заказ без объяснения и
      // без снимка.
      await this.archive.capture(tx, idOrder, clean, deletedBy);
      // Удаляем все начисления (любой статус) и их платёжные связи
      const accruals = await tx.salaryAccrual.findMany({
        where: { orderId: idOrder },
        select: { id: true },
      });
      if (accruals.length > 0) {
        const ids = accruals.map((a) => a.id);
        await tx.paymentAccrualLink.deleteMany({
          where: { accrualId: { in: ids } },
        });
        await tx.salaryAccrual.deleteMany({ where: { id: { in: ids } } });
      }

      const deleted = await tx.orderPhoto.delete({
        where: { id: idOrder },
        include: { items: true, tshirtItems: true, canvasItems: true },
      });

      // Про срок возврата говорим сразу: иначе удаление выглядит
      // безвозвратным, и человек идёт заводить заказ заново вместо того,
      // чтобы вернуть его из корзины.
      return {
        message: `Заказ удалён. Его можно вернуть из корзины в течение ${this.archive.retentionDays()} дней`,
        data: deleted,
      };
    });
  }
}

/**
 * Позиция заказа из заявки с сайта.
 *
 * Холст и фотопечать живут в разных таблицах: у холста своя экономика —
 * себестоимость подрядчика фиксируется по каждой штуке, и маржа считается
 * по позиции. Поэтому категория решает, куда лечь заявке.
 *
 * Опции холста (основа, багет), кадрирование и ссылка на файл идут в
 * примечание к заказу: отдельных полей у позиции нет, а заводить миграцию
 * ради четырёх строк текста дороже, чем она того стоит.
 */
function buildLeadPosition(
  dto: DtoCreateLead,
  money: { quantity: number; unitPrice: number; pricePosition: number },
) {
  if (money.quantity <= 0) {
    return {};
  }

  if (dto.productCategory === EnumProductCategory.CANVAS) {
    // Себестоимость берём из прайса — того же, из которого сайт взял цену.
    // Ноль означает, что прайс подрядчика ещё не согласован: тогда маржа
    // по позиции будет завышена, и это видно в отчёте.
    const size = dto.canvasSizeKey
      ? findCanvasSize(dto.canvasSizeKey)
      : undefined;
    const contractorPrice = size?.contractorCost ?? 0;
    const contractorCostPosition = contractorPrice * money.quantity;
    return {
      canvasItems: {
        create: [
          {
            formatCanvas:
              dto.canvasSizeLabel?.trim() ||
              dto.canvasSizeKey?.trim() ||
              dto.productName?.trim() ||
              'Холст с сайта',
            quantity: money.quantity,
            clientPrice: money.unitPrice,
            contractorPrice,
            pricePosition: money.pricePosition,
            contractorCostPosition,
            profitPosition: money.pricePosition - contractorCostPosition,
          },
        ],
      },
    };
  }

  if (dto.productCategory === EnumProductCategory.TSHIRT) {
    // Корпоративная заявка приходит без цены: партию считает менеджер,
    // и позиция по нулю только испортила бы отчёт по марже. Создаём
    // заказ без позиции — менеджер добавит её после расчёта.
    if (money.unitPrice <= 0) {
      return {};
    }
    return {
      tshirtItems: {
        create: [
          {
            color: TSHIRT_COLOR_LABELS[dto.tshirtColor ?? 'black'],
            size: (dto.tshirtSize ?? 'L') as EnumTshirtSize,
            gender: TSHIRT_GENDER_BY_FIT[dto.tshirtFit ?? 'male'],
            printLocation:
              PRINT_LOCATION_BY_PLACEMENT[dto.tshirtPlacement ?? 'front'],
            quantity: money.quantity,
            price: money.unitPrice,
            pricePosition: money.pricePosition,
            // Себестоимость печати — снимок на момент оформления, как и у
            // позиции, заведённой руками: расчёт с партнёром не должен
            // «поехать», если позже поменять значения по умолчанию.
            designNote: buildTshirtNote(dto),
          },
        ],
      },
    };
  }

  /*
   * Несколько позиций: «часть с полями, часть без».
   *
   * Заводим их отдельными строками заказа, а не одной суммой: печатник
   * смотрит именно на строки, и «30 фото 10×15» вместо «20 с полями и
   * 10 без» означает, что половину заказа напечатают не так.
   */
  if (dto.items && dto.items.length > 0) {
    return {
      items: {
        create: dto.items.map((item) => ({
          formatPaper: item.productName.trim() || item.productSlug.trim(),
          typePaper:
            dto.paperType === 'MATTE' ? ('MATTE' as const) : ('GLOSS' as const),
          quantity: item.quantity,
          price: item.unitPrice,
          pricePosition: item.total,
        })),
      },
    };
  }

  return {
    items: {
      create: [
        {
          formatPaper:
            dto.productName?.trim() ||
            dto.productSlug?.trim() ||
            'Заявка с сайта',
          // Бумага из заявки. Раньше здесь стоял жёсткий GLOSS: клиент
          // выбирал матовую, а в позиции заказа неизменно оказывался
          // глянец, и печатали не то, что заказывали.
          typePaper:
            dto.paperType === 'MATTE' ? ('MATTE' as const) : ('GLOSS' as const),
          quantity: money.quantity,
          price: money.unitPrice,
          pricePosition: money.pricePosition,
        },
      ],
    },
  };
}

/**
 * Порядок списка заказов.
 *
 * Без выбора — обычный порядок работы: активные сверху, оплаченные и
 * закрытые вниз, внутри активных срочные выше, дальше по дате. Он
 * отвечает на вопрос «что делать сейчас», и для ежедневной работы это
 * правильнее любой сортировки. Порядок ключей важен: closedAt первым,
 * иначе срочный, но уже оплаченный заказ всплыл бы выше активной работы.
 *
 * С выбором этот порядок отступает целиком. Половинчатое решение —
 * оставить группировку по закрытости и сортировать внутри — выглядит на
 * экране как сломанная сортировка: человек нажал «по сумме» и видит
 * дешёвый заказ выше дорогого, без видимой причины.
 *
 * Срок берём тот, который видно в списке, а не колонку `deadline`.
 * Колонка заполнена не у всех: пустая означает не «без срока», а «срок
 * по умолчанию» — дата создания плюс три дня. Сортировка по самой
 * колонке врала ровно на тех заказах, ради которых её и открывают:
 * заказ, просроченный на шесть дней, уходил в конец списка «сначала
 * ранние», потому что в колонке было пусто.
 *
 * Пусто в `deadlineEffective` остаётся только у футболок — их сроки
 * ведёт партнёр, и в списке отсчёт для них не показан вовсе. Такие
 * заказы уходят в конец при любом направлении: это не «самый ранний» и
 * не «самый поздний» срок, его просто нет.
 */
export function buildOrdersOrderBy(
  sort: 'deadline' | 'total' | undefined,
  dir: 'asc' | 'desc' | undefined,
): Prisma.OrderPhotoOrderByWithRelationInput[] {
  if (!sort) {
    return [
      { closedAt: { sort: 'asc', nulls: 'first' } },
      { isUrgent: 'desc' },
      { createdAt: 'asc' },
    ];
  }

  const direction = dir === 'asc' ? 'asc' : 'desc';
  // Вторым ключом — дата создания: без него две строки с одинаковым
  // сроком меняются местами между страницами, и заказ может показаться
  // дважды или не показаться вовсе.
  return sort === 'deadline'
    ? [
        { deadlineEffective: { sort: direction, nulls: 'last' } },
        { createdAt: 'asc' },
      ]
    : [{ totalOrder: direction }, { createdAt: 'asc' }];
}

/** Подписи цвета футболки: в позиции цвет хранится строкой, а не перечислением. */
const TSHIRT_COLOR_LABELS: Record<'black' | 'white', string> = {
  black: 'Чёрная',
  white: 'Белая',
};

/**
 * Крой сайта → поле gender позиции.
 *
 * Оверсайз — не пол, а посадка, и отдельного поля под него в схеме нет.
 * Кладём его в UNISEX, а сам крой уходит в примечание позиции: потерять
 * его нельзя, печатнику важно, какая заготовка нужна.
 */
const TSHIRT_GENDER_BY_FIT: Record<string, EnumTshirtGender> = {
  male: EnumTshirtGender.MALE,
  female: EnumTshirtGender.FEMALE,
  // Оверсайз — посадка, а не пол: кладём в UNISEX, а сам крой уходит
  // в примечание позиции, потому что печатнику важна заготовка.
  oversize: EnumTshirtGender.UNISEX,
};

const PRINT_LOCATION_BY_PLACEMENT: Record<string, EnumPrintLocation> = {
  front: EnumPrintLocation.FRONT,
  back: EnumPrintLocation.BACK,
  'front-back': EnumPrintLocation.FRONT_BACK,
};

/** Что печатаем и на чём — в примечание позиции, чтобы не искать в переписке. */
function buildTshirtNote(dto: DtoCreateLead): string {
  const parts: string[] = [];
  if (dto.tshirtFit === 'oversize') parts.push('Крой: оверсайз');
  if (dto.tshirtPrintSlug) {
    parts.push(`Готовый принт: ${dto.tshirtPrintName ?? dto.tshirtPrintSlug}`);
  } else {
    parts.push('Принт: макет клиента (ссылка на архив в заказе)');
  }
  const utm = [dto.utmSource, dto.utmMedium, dto.utmCampaign].filter(Boolean);
  if (utm.length > 0) parts.push(`Источник: ${utm.join(' / ')}`);
  return parts.join('. ');
}
