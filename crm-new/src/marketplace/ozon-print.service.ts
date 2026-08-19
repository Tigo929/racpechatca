import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { EnumTshirtGender, EnumTshirtSize } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  buildOfferId,
  colorCodeFor,
  normalizeSlug,
  slugify,
} from './ozon/ozon-attributes';

/**
 * Принты (карточки товара) и их варианты цвет×размер. Не знает про Ozon API —
 * только заводит черновики и складывает их отношения; отправкой занимается
 * OzonImportService.
 */

export interface ColorGroupInput {
  colorLabel: string;
  colorDictionaryValueId: number;
  /** Латинский код цвета для артикула; пусто — выводим из подписи. */
  colorCode?: string;
  /** Главное фото этого цвета; пусто — берём фото принта. */
  mainPhotoUrl?: string;
  sizes: EnumTshirtSize[];
}

export interface CreatePrintInput {
  slug?: string;
  /** Значение «Объединить на одной карточке»; пусто — берём код принта. */
  unionKey?: string;
  name: string;
  description?: string;
  hashtags?: string;
  mainPhotoUrl: string;
  extraPhotoUrls?: string[];
  price: number;
  oldPrice?: number;
  gender?: EnumTshirtGender;
  patternTags?: string[];
  colorGroups: ColorGroupInput[];
}

const PRINT_INCLUDE = {
  variants: { orderBy: [{ colorLabel: 'asc' }, { size: 'asc' }] },
} satisfies Prisma.OzonPrintInclude;

@Injectable()
export class OzonPrintService {
  constructor(private readonly prisma: PrismaService) {}

  async list(marketplaceAccountId: string) {
    return this.prisma.ozonPrint.findMany({
      where: { marketplaceAccountId },
      include: PRINT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrFail(id: string) {
    const print = await this.prisma.ozonPrint.findUnique({
      where: { id },
      include: PRINT_INCLUDE,
    });
    if (!print) throw new NotFoundException('Принт не найден');
    return print;
  }

  /** Создаёт принт со всеми вариантами (цвет×размер) сразу — черновик. */
  async create(marketplaceAccountId: string, input: CreatePrintInput) {
    this.validateColorGroups(input.colorGroups);

    // Введённый вручную код принта («JDM-1-1») сохраняем как есть, включая
    // регистр — он совпадает с именем папки макетов у продавца.
    const slug = input.slug?.trim()
      ? normalizeSlug(input.slug)
      : slugify(input.name);
    if (!slug)
      throw new BadRequestException(
        'Не удалось построить артикул из названия — заполните поле «Слаг» вручную',
      );

    /*
     * Второй принт с тем же кодом — ловушка, из-за которой цвета не
     * объединяются в Ozon.
     *
     * Объединение работает по атрибуту 8292: у вариантов одного принта
     * unionKey общий, а у нового принта он свой. То есть чёрный и белый,
     * заведённые как два принта JDM-1-1, попадут в Ozon двумя разными
     * карточками и никогда не сольются — при этом в CRM выглядят похоже.
     *
     * Уникальность в базе стоит на unionKey, а не на коде, поэтому дубль
     * проходил молча. Проверяем явно и объясняем, что делать вместо этого.
     */
    const existing = await this.prisma.ozonPrint.findFirst({
      where: { marketplaceAccountId, slug },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Принт «${slug}» уже заведён. Чтобы добавить цвет, откройте его карточку и нажмите «Добавить цвет в группу» — новый принт с тем же кодом создаст в Ozon вторую карточку, и объединить их будет нельзя.`,
      );
    }

    try {
      return await this.prisma.ozonPrint.create({
        data: {
          marketplaceAccountId,
          slug,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          hashtags: input.hashtags?.trim() || null,
          mainPhotoUrl: input.mainPhotoUrl.trim(),
          extraPhotoUrls:
            input.extraPhotoUrls?.map((u) => u.trim()).filter(Boolean) ?? [],
          price: input.price,
          oldPrice: input.oldPrice ?? null,
          gender: input.gender ?? EnumTshirtGender.UNISEX,
          patternTags: input.patternTags ?? [],
          /*
           * Ключ объединения — сам код принта, а не случайная строка.
           * В кабинете Ozon это поле так и заполняют: «Объединить на одной
           * карточке» = JDM-1-1. Тогда чёрная и белая футболки с одним
           * принтом сходятся в одну карточку по определению, без всякой
           * синхронизации, а значение остаётся читаемым человеком.
           */
          unionKey: input.unionKey?.trim() || slug,
          variants: {
            create: this.flattenVariants(slug, input.colorGroups),
          },
        },
        include: PRINT_INCLUDE,
      });
    } catch (e) {
      throw this.translateUniqueError(e, slug);
    }
  }

  /** Массовое создание за один запрос — та же валидация на каждый принт. */
  async createBulk(marketplaceAccountId: string, inputs: CreatePrintInput[]) {
    if (!inputs.length) throw new BadRequestException('Список принтов пуст');

    /*
     * Все коды проверяем до первой записи.
     *
     * Раньше принты создавались по одному и падение на втором оставляло
     * первый в базе: пользователь видел ошибку «такой артикул уже есть»,
     * обновлял страницу — и находил принт в черновиках. Дальше повтор
     * упирался в им же созданную запись, и выйти из круга было нельзя.
     *
     * Проверка до записи убирает самый частый случай целиком: ошибка
     * приходит раньше, чем что-либо сохранено.
     */
    const slugs = inputs.map((i) =>
      i.slug?.trim() ? normalizeSlug(i.slug) : slugify(i.name),
    );

    const seen = new Set<string>();
    for (const slug of slugs) {
      if (seen.has(slug)) {
        throw new BadRequestException(
          `Код принта «${slug}» повторяется в списке — у каждой карточки он должен быть свой.`,
        );
      }
      seen.add(slug);
    }

    const existing = await this.prisma.ozonPrint.findMany({
      where: { marketplaceAccountId, slug: { in: slugs } },
      select: { slug: true },
    });
    if (existing.length) {
      const names = existing.map((e) => e.slug).join(', ');
      throw new BadRequestException(
        `Уже заведены принты: ${names}. Чтобы добавить цвет, откройте карточку и нажмите «Добавить цвет в группу».`,
      );
    }

    const created: Awaited<ReturnType<typeof this.create>>[] = [];
    // Дальше — по одному: остальные отказы (например, от Ozon) редки, и
    // построчный результат важнее отката.
    for (const input of inputs) {
      created.push(await this.create(marketplaceAccountId, input));
    }
    return created;
  }

  /**
   * Добавляет ещё одну цветовую партию в уже существующую карточку — это и
   * есть «объединение в группу» из требования: тот же unionKey, новые
   * варианты стартуют черновиком независимо от статуса самого принта.
   */
  async addColorGroup(printId: string, group: ColorGroupInput) {
    const print = await this.getOrFail(printId);
    this.validateColorGroups([group]);

    try {
      await this.prisma.ozonVariant.createMany({
        data: this.flattenVariants(print.slug, [group]).map((v) => ({
          ...v,
          printId,
        })),
      });
    } catch (e) {
      throw this.translateUniqueError(e, print.slug);
    }
    return this.getOrFail(printId);
  }

  async update(
    printId: string,
    dto: Partial<
      Pick<
        CreatePrintInput,
        | 'name'
        | 'description'
        | 'hashtags'
        | 'mainPhotoUrl'
        | 'extraPhotoUrls'
        | 'price'
        | 'oldPrice'
        | 'gender'
        | 'patternTags'
      >
    >,
  ) {
    await this.getOrFail(printId);
    return this.prisma.ozonPrint.update({
      where: { id: printId },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description !== undefined
            ? dto.description?.trim() || null
            : undefined,
        hashtags:
          dto.hashtags !== undefined ? dto.hashtags?.trim() || null : undefined,
        mainPhotoUrl: dto.mainPhotoUrl?.trim(),
        extraPhotoUrls: dto.extraPhotoUrls
          ?.map((u) => u.trim())
          .filter(Boolean),
        price: dto.price,
        oldPrice: dto.oldPrice,
        gender: dto.gender,
        patternTags: dto.patternTags,
      },
      include: PRINT_INCLUDE,
    });
  }

  /** Удаляет запись у нас. Если варианты уже ушли в Ozon — там карточка остаётся, здесь только теряем отслеживание. */
  async remove(printId: string) {
    await this.getOrFail(printId);
    await this.prisma.ozonPrint.delete({ where: { id: printId } });
    return { ok: true as const };
  }

  private validateColorGroups(groups: ColorGroupInput[]): void {
    if (!groups.length) {
      throw new BadRequestException('Нужен хотя бы один цвет с размерами');
    }
    for (const g of groups) {
      if (!g.colorLabel?.trim())
        throw new BadRequestException('У цветовой партии не указан цвет');
      if (!g.colorDictionaryValueId)
        throw new BadRequestException(
          `Для цвета «${g.colorLabel}» не выбрано значение из справочника Ozon`,
        );
      if (!g.sizes.length)
        throw new BadRequestException(
          `Для цвета «${g.colorLabel}» не выбран ни один размер`,
        );
    }
  }

  private flattenVariants(
    slug: string,
    groups: ColorGroupInput[],
  ): Prisma.OzonVariantCreateManyPrintInput[] {
    return groups.flatMap((g) => {
      const colorCode = g.colorCode?.trim() || colorCodeFor(g.colorLabel);
      const mainPhotoUrl = g.mainPhotoUrl?.trim() || null;
      return g.sizes.map((size) => ({
        colorLabel: g.colorLabel.trim(),
        colorDictionaryValueId: g.colorDictionaryValueId,
        colorCode,
        // Фото у цвета, а не у размера: размеры одного цвета снимают одну и
        // ту же футболку. Дублируется по вариантам потому, что в Ozon
        // картинки живут на offer_id, а он у каждого размера свой.
        mainPhotoUrl,
        size,
        offerId: buildOfferId(slug, colorCode, size),
      }));
    });
  }

  /** P2002 (уникальный артикул/unionKey уже существует) — в понятную ошибку. */
  private translateUniqueError(e: unknown, slug: string): Error {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const rawTarget = e.meta?.target;
      const target = Array.isArray(rawTarget)
        ? rawTarget.join(',')
        : typeof rawTarget === 'string'
          ? rawTarget
          : '';
      if (target.includes('offerId')) {
        return new ConflictException(
          `Артикул с принтом «${slug}» и таким размером уже существует — возможно, этот цвет/размер уже добавлены`,
        );
      }
      return new ConflictException('Такая запись уже существует');
    }
    return e instanceof Error ? e : new Error(String(e));
  }
}
