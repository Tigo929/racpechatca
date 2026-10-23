import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumProductCategory } from 'src/generated/prisma/enums';
import { PartnerTokenGuard } from './partner-token.guard';
import { TechSpecStorageService } from './tech-spec-storage.service';
import { getTechSpecPathAt } from './tech-spec-paths';

/**
 * Поиск заказа по номеру отправления Ozon — для сборки.
 *
 * На столе упаковки сканируют стикер площадки и хотят увидеть макет.
 * В руках у сборщика только номер отправления; наш номер заказа он не
 * знает и знать не должен.
 *
 * Раньше этот путь шёл через кабинет маркетплейса
 * (`/marketplace/ozon/{account}/orders/{posting}/crm-order`), и это
 * требовало доступа к кабинету — то есть к ключу Ozon: товары, цены,
 * остатки, отгрузки. Ради одной строчки «какой это заказ» отдавать ключ
 * от магазина нельзя, а после пересоздания кабинета 20 октября этот путь
 * ещё и перестал работать.
 *
 * Здесь тот же вопрос решается по партнёрскому токену, который у сборки
 * уже есть, и наружу уходит ровно столько, сколько нужно, чтобы забрать
 * макет: наш идентификатор и номер заказа. Ни кабинета, ни ключей, ни
 * цен, ни покупателя.
 */
@Controller('partner/ozon/postings')
@UseGuards(PartnerTokenGuard)
export class PartnerOzonController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TechSpecStorageService,
  ) {}

  /** Наш заказ по номеру отправления площадки. */
  @Get(':posting/crm-order')
  async findByPosting(@Param('posting') posting: string) {
    const order = await this.orderFor(posting);
    // Наружу — только то, чем забирают макет. Ни сумм, ни покупателя.
    return { id: order.id, numberOrder: order.numberOrder };
  }

  /**
   * Сразу макет по номеру отправления — без промежуточного запроса.
   *
   * Сборке нужен не идентификатор, а картинка: один запрос вместо двух
   * на каждый отсканированный стикер.
   */
  @Get(':posting/techspec-photo')
  async techSpecPhoto(
    @Param('posting') posting: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.streamTechSpec(posting, 0, res);
  }

  /** Конкретный файл из набора, номер начинается с нуля. */
  @Get(':posting/techspec-photo/:index')
  async techSpecPhotoByIndex(
    @Param('posting') posting: string,
    @Param('index') indexRaw: string,
    @Res() res: Response,
  ): Promise<void> {
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Некорректный номер ТЗ-файла');
    }
    await this.streamTechSpec(posting, index, res);
  }

  private async streamTechSpec(
    posting: string,
    index: number,
    res: Response,
  ): Promise<void> {
    const order = await this.orderFor(posting);
    const filename = getTechSpecPathAt(order, index);
    if (!filename) {
      throw new NotFoundException('ТЗ-фото не прикреплено');
    }
    const { buffer, contentType } = await this.storage.read(filename);
    res.setHeader('Content-Type', contentType);
    res.end(buffer);
  }

  /**
   * Заказ по номеру отправления — или понятный отказ.
   *
   * Только футболки: партнёр печатает их, и разворачивать по этому пути
   * фотозаказы ему незачем. Номеров отправлений у них всё равно нет, но
   * ограничение ставим явно — границу прав нельзя оставлять на «и так
   * не получится».
   *
   * Самый свежий, если номер почему-то повторился: заводят заказ по
   * отправлению один раз, но спорить с базой из-за этого не нужно.
   */
  private async orderFor(posting: string) {
    const number = posting.trim();
    /*
      Номер отправления — цифры и дефисы («0112649382-0047-1»). Проверяем
      не ради базы (запрос параметризован), а чтобы мусор в адресе не
      превращался в поиск по всей таблице.
    */
    if (!/^[0-9][0-9-]{3,39}$/.test(number)) {
      throw new BadRequestException('Некорректный номер отправления');
    }

    const order = await this.prisma.orderPhoto.findFirst({
      where: {
        marketplacePostingNumber: number,
        productCategory: EnumProductCategory.TSHIRT,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        numberOrder: true,
        techSpecPhotoPath: true,
        techSpecPhotoPaths: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Заказ по этому отправлению не найден');
    }
    return order;
  }
}
