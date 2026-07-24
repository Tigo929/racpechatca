import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumStatus } from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { calcOrderTotal } from 'src/order-photo/order-pricing';
import { evaluateScenario, pickRelevantAnswers } from './scenario.engine';
import { findProduct } from './scenario.registry';
import type { Answers, ScenarioProgress } from './scenario.types';

export interface DraftState {
  orderId: string;
  numberOrder: string;
  scenarioKey: string | null;
  answers: Answers;
  progress: ScenarioProgress | null;
}

/**
 * Черновик оформления живёт на самой заявке.
 *
 * Отдельной сущности для него намеренно нет: заявка — это уже заказ в статусе
 * «Обращение», у неё есть номер, история статусов и права доступа. Заводить
 * рядом второй объект значит держать две записи про одного клиента и однажды
 * их рассинхронизировать.
 */
@Injectable()
export class ScenarioDraftService {
  constructor(private readonly prisma: PrismaService) {}

  private toAnswers(raw: unknown): Answers {
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Answers)
      : {};
  }

  private progressOf(key: string | null, answers: Answers): ScenarioProgress | null {
    const product = key ? findProduct(key) : undefined;
    return product ? evaluateScenario(product.scenario, answers) : null;
  }

  async getDraft(orderId: string): Promise<DraftState> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        numberOrder: true,
        scenarioKey: true,
        scenarioAnswers: true,
      },
    });
    if (!order) throw new NotFoundException('Заявка не найдена');

    const answers = this.toAnswers(order.scenarioAnswers);
    return {
      orderId: order.id,
      numberOrder: order.numberOrder,
      scenarioKey: order.scenarioKey,
      answers,
      progress: this.progressOf(order.scenarioKey, answers),
    };
  }

  /**
   * Сохранить то, что менеджер уже выяснил.
   *
   * Ответы дописываются к прежним, а не заменяют их целиком: панель шлёт
   * изменённое поле, и присылать вместе с ним весь черновик значило бы затирать
   * правки, сделанные в соседней вкладке.
   */
  async saveDraft(
    orderId: string,
    patch: { scenarioKey?: string; answers?: Answers },
  ): Promise<DraftState> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        scenarioKey: true,
        scenarioAnswers: true,
      },
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.status !== EnumStatus.LEAD) {
      throw new ConflictException(
        'Заказ уже оформлен — черновик обращения править нельзя.',
      );
    }

    const nextKey = patch.scenarioKey ?? order.scenarioKey;
    const previous = this.toAnswers(order.scenarioAnswers);
    const merged: Answers = { ...previous, ...(patch.answers ?? {}) };

    // Смена продукта посреди разговора: начали оформлять фото, выяснилось, что
    // речь о футболке. Ответы прежнего сценария не должны уехать в новый заказ.
    const product = nextKey ? findProduct(nextKey) : undefined;
    const answers = product ? pickRelevantAnswers(product.scenario, merged) : merged;

    const updated = await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: {
        scenarioKey: nextKey ?? null,
        scenarioAnswers: answers as Prisma.InputJsonObject,
      },
      select: { id: true, numberOrder: true },
    });

    return {
      orderId: updated.id,
      numberOrder: updated.numberOrder,
      scenarioKey: nextKey ?? null,
      answers,
      progress: this.progressOf(nextKey ?? null, answers),
    };
  }

  /**
   * Превратить собранный черновик в заказ.
   *
   * Заявка не копируется в новую запись, а меняет статус: номер, переписка и
   * история остаются те же. Так в общем списке заказов оказывается ровно один
   * заказ, а не заказ плюс осиротевшее обращение.
   */
  async convertToOrder(orderId: string, managerId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        scenarioKey: true,
        scenarioAnswers: true,
      },
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.status !== EnumStatus.LEAD) {
      throw new ConflictException('Из этого обращения заказ уже оформлен.');
    }

    const product = order.scenarioKey ? findProduct(order.scenarioKey) : undefined;
    if (!product) {
      throw new BadRequestException(
        'Не выбран продукт — непонятно, что оформлять.',
      );
    }

    const answers = this.toAnswers(order.scenarioAnswers);
    const progress = evaluateScenario(product.scenario, answers);
    if (!progress.ready) {
      // Перечисляем именно то, чего не хватает: «форма заполнена неверно» —
      // бесполезная ошибка, менеджер должен видеть, что доспросить у клиента.
      throw new BadRequestException(
        `Не хватает данных: ${progress.missing.map((m) => m.label).join(', ')}`,
      );
    }

    const mapping = product.toOrder(answers);

    // Фото идут с договорной ценой (сумма = цене позиции), футболки — по цене за
    // штуку. Признак свободной цены живёт на позиции, а не на заказе, поэтому
    // складываем две группы отдельно, а не одним флагом на весь заказ.
    const itemsTotal =
      calcOrderTotal(mapping.photoItems, 0, true) +
      calcOrderTotal(mapping.tshirtItems, 0);

    const totalOrder =
      itemsTotal + mapping.deliveryCost + mapping.designDevelopmentCost;

    return this.prisma.$transaction(async (tx) => {
      // Обращение могло уйти в работу, пока менеджер собирал данные.
      const fresh = await tx.orderPhoto.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (fresh?.status !== EnumStatus.LEAD) {
        throw new ConflictException('Из этого обращения заказ уже оформлен.');
      }

      for (const item of mapping.photoItems) {
        await tx.itemPhoto.create({
          data: {
            orderId,
            formatPaper: item.formatPaper,
            typePaper: item.typePaper,
            quantity: item.quantity,
            price: item.price,
            pricePosition: item.price,
            isFreePrice: true,
          },
        });
      }

      for (const item of mapping.tshirtItems) {
        await tx.itemTshirt.create({
          data: {
            orderId,
            color: item.color,
            size: item.size,
            gender: item.gender,
            printLocation: item.printLocation,
            printType: item.printType,
            quantity: item.quantity,
            price: item.price,
            pricePosition: item.price * item.quantity,
            clientItem: item.clientItem,
            designNote: item.designNote,
          },
        });
      }

      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: EnumStatus.LEAD,
          toStatus: EnumStatus.NEW,
          changedBy: managerId,
        },
      });

      return tx.orderPhoto.update({
        where: { id: orderId },
        data: {
          status: EnumStatus.NEW,
          statusChangedAt: new Date(),
          processedById: managerId,
          productCategory: mapping.productCategory,
          deliveryMethod: mapping.deliveryMethod,
          deliveryCost: mapping.deliveryCost,
          deadline: mapping.deadline,
          isUrgent: mapping.isUrgent,
          note: mapping.note,
          tshirtModel: mapping.tshirtModel,
          designDevelopmentCost: mapping.designDevelopmentCost,
          totalOrder,
        },
        include: { items: true, tshirtItems: true },
      });
    });
  }
}
