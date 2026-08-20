import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'src/generated/prisma/client';
import { EnumMarketplace, EnumRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { decryptSecret, encryptSecret, secretHint } from './secret-box';
import { OzonApiError, type OzonCredentials } from './ozon/ozon-api.client';
import { OzonService } from './ozon/ozon.service';

/**
 * Кабинеты маркетплейсов: хранение доступов и проверка связи.
 *
 * Наружу ключ не отдаётся ни при каких условиях — только хвост из четырёх
 * символов. Расшифровка живёт здесь и вызывается только внутренними сервисами
 * интеграции (импорт товаров, цены, остатки — следующие этапы).
 */

/** Карточка кабинета для интерфейса: без секретов. */
export interface MarketplaceAccountView {
  id: string;
  marketplace: EnumMarketplace;
  title: string;
  externalId: string;
  apiKeyHint: string;
  isActive: boolean;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckError: string | null;
  lastCheckInfo: unknown;
  /**
   * Чей магазин. У владельца сервиса кабинетов несколько продавцов, и без
   * подписи невозможно понять, чьи товары сейчас на экране — а править чужие,
   * думая, что свои, дороже, чем не увидеть их вовсе.
   *
   * Пусто — кабинет самого владельца сервиса.
   */
  owner: { id: string; username: string } | null;
}

export interface CreateAccountInput {
  marketplace: EnumMarketplace;
  title: string;
  externalId: string;
  apiKey: string;
}

export interface UpdateAccountInput {
  title?: string;
  externalId?: string;
  /** Пустая строка = «ключ не меняем»: форма не показывает старый ключ. */
  apiKey?: string;
  isActive?: boolean;
}

// Владелец подтягивается вместе с кабинетом: без него в списке не отличить,
// чей это магазин.
const ACCOUNT_INCLUDE = {
  owner: { select: { id: true, username: true } },
} satisfies Prisma.MarketplaceAccountInclude;

type AccountRow = Prisma.MarketplaceAccountGetPayload<{
  include: typeof ACCOUNT_INCLUDE;
}>;

@Injectable()
export class MarketplaceAccountService {
  private readonly logger = new Logger(MarketplaceAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ozon: OzonService,
  ) {}

  /**
   * Мастер-ключ шифрования. Отдельный MARKETPLACE_SECRET предпочтителен, но
   * если его не завели — берём JWT_SECRET, чтобы интеграция работала сразу
   * после деплоя, а не падала на первом сохранении ключа.
   */
  private get masterSecret(): string {
    // Именно «пустое считаем незаданным»: в docker-compose переменная
    // объявлена как ${MARKETPLACE_SECRET:-}, то есть в контейнер она приходит
    // пустой строкой. С проверкой на null такой секрет прошёл бы дальше и
    // шифрование упало бы уже на сохранении ключа.
    const own = this.config.get<string>('MARKETPLACE_SECRET')?.trim();
    if (own) return own;
    return this.config.get<string>('JWT_SECRET')?.trim() ?? '';
  }

  private toView(row: AccountRow): MarketplaceAccountView {
    return {
      id: row.id,
      marketplace: row.marketplace,
      title: row.title,
      externalId: row.externalId,
      apiKeyHint: row.apiKeyHint,
      isActive: row.isActive,
      lastCheckAt: row.lastCheckAt?.toISOString() ?? null,
      lastCheckOk: row.lastCheckOk,
      lastCheckError: row.lastCheckError,
      lastCheckInfo: row.lastCheckInfo ?? null,
      owner: row.owner ? { id: row.owner.id, username: row.owner.username } : null,
    };
  }

  /**
   * Кабинеты, доступные вызывающему.
   *
   * `ownerId` пустой — видит только владелец сервиса: это его собственные
   * кабинеты, заведённые до появления внешних продавцов. Внешнему продавцу
   * отдаём строго свои: в чужом кабинете лежит ключ от чужого магазина.
   */
  async list(
    marketplace: EnumMarketplace | undefined,
    viewer: { id: string; role: EnumRole },
  ): Promise<MarketplaceAccountView[]> {
    const rows = await this.prisma.marketplaceAccount.findMany({
      where: {
        ...(marketplace ? { marketplace } : {}),
        ...(viewer.role === EnumRole.ADMIN ? {} : { ownerId: viewer.id }),
      },
      orderBy: { createdAt: 'asc' },
      include: ACCOUNT_INCLUDE,
    });
    return rows.map((r) => this.toView(r));
  }

  async getOrFail(id: string): Promise<AccountRow> {
    const row = await this.prisma.marketplaceAccount.findUnique({
      where: { id },
      include: ACCOUNT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Кабинет маркетплейса не найден');
    return row;
  }

  /**
   * Добавляет кабинет и сразу проверяет связь: человек нажал «Подключить» —
   * он ждёт ответа «работает / не работает», а не молчаливой записи в базу.
   * Неудачная проверка не отменяет сохранение: ключ можно поправить, а если
   * Ozon просто лежит — доступы терять незачем.
   */
  async create(
    input: CreateAccountInput,
    ownerId: string,
  ): Promise<MarketplaceAccountView> {
    const apiKey = input.apiKey.trim();
    const externalId = input.externalId.trim();
    if (!apiKey || !externalId) {
      throw new BadRequestException('Нужны и Client-Id, и Api-Key');
    }

    const duplicate = await this.prisma.marketplaceAccount.findUnique({
      where: {
        marketplace_externalId: { marketplace: input.marketplace, externalId },
      },
    });
    if (duplicate) {
      throw new ConflictException('Такой кабинет уже подключён');
    }

    const created = await this.prisma.marketplaceAccount.create({
      data: {
        marketplace: input.marketplace,
        title: input.title.trim() || 'Кабинет',
        externalId,
        apiKeySecret: encryptSecret(apiKey, this.masterSecret),
        apiKeyHint: secretHint(apiKey),
        // Кабинет принадлежит тому, кто его завёл: по этому полю внешний
        // продавец потом видит его, а чужие — нет.
        ownerId,
      },
      include: ACCOUNT_INCLUDE,
    });

    return this.check(created.id);
  }

  async update(
    id: string,
    input: UpdateAccountInput,
  ): Promise<MarketplaceAccountView> {
    await this.getOrFail(id);
    const apiKey = input.apiKey?.trim();

    const updated = await this.prisma.marketplaceAccount.update({
      where: { id },
      data: {
        title: input.title?.trim() || undefined,
        externalId: input.externalId?.trim() || undefined,
        isActive: input.isActive,
        ...(apiKey
          ? {
              apiKeySecret: encryptSecret(apiKey, this.masterSecret),
              apiKeyHint: secretHint(apiKey),
            }
          : {}),
      },
      include: ACCOUNT_INCLUDE,
    });

    // Доступы поменялись — старый результат проверки больше ничего не значит.
    if (apiKey || input.externalId) return this.check(id);
    return this.toView(updated);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.getOrFail(id);
    await this.prisma.marketplaceAccount.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Доступы кабинета для внутренних сервисов интеграции. Единственное место,
   * где ключ существует в открытом виде, — и оно не покидает бэкенд.
   */
  async credentials(id: string): Promise<OzonCredentials> {
    const row = await this.getOrFail(id);
    return {
      clientId: row.externalId,
      apiKey: decryptSecret(row.apiKeySecret, this.masterSecret),
    };
  }

  /** Проверка связи с площадкой; результат сохраняем на карточке кабинета. */
  async check(id: string): Promise<MarketplaceAccountView> {
    const row = await this.getOrFail(id);

    if (row.marketplace !== EnumMarketplace.OZON) {
      throw new BadRequestException(
        'Проверка пока реализована только для Ozon',
      );
    }

    try {
      const creds = await this.credentials(id);
      const info = await this.ozon.checkConnection(creds);
      const saved = await this.prisma.marketplaceAccount.update({
        where: { id },
        data: {
          lastCheckAt: new Date(),
          lastCheckOk: true,
          lastCheckError: null,
          lastCheckInfo: info as unknown as Prisma.InputJsonValue,
        },
        include: ACCOUNT_INCLUDE,
      });
      return this.toView(saved);
    } catch (e) {
      const message =
        e instanceof OzonApiError
          ? e.humanMessage
          : e instanceof Error
            ? e.message
            : 'Неизвестная ошибка проверки';
      this.logger.warn(`Проверка кабинета ${row.title}: ${message}`);
      const saved = await this.prisma.marketplaceAccount.update({
        where: { id },
        data: {
          lastCheckAt: new Date(),
          lastCheckOk: false,
          lastCheckError: message,
        },
        include: ACCOUNT_INCLUDE,
      });
      return this.toView(saved);
    }
  }
}
