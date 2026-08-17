import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'src/generated/prisma/client';
import { EnumMarketplace } from 'src/generated/prisma/enums';
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

type AccountRow = Prisma.MarketplaceAccountGetPayload<object>;

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
    return (
      this.config.get<string>('MARKETPLACE_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      ''
    );
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
    };
  }

  async list(marketplace?: EnumMarketplace): Promise<MarketplaceAccountView[]> {
    const rows = await this.prisma.marketplaceAccount.findMany({
      where: marketplace ? { marketplace } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async getOrFail(id: string): Promise<AccountRow> {
    const row = await this.prisma.marketplaceAccount.findUnique({
      where: { id },
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
  async create(input: CreateAccountInput): Promise<MarketplaceAccountView> {
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
      },
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
      });
      return this.toView(saved);
    }
  }
}
