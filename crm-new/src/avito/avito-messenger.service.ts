import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumAvitoMessageDirection } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AvitoChat,
  AvitoChatUser,
  AvitoMessage,
  AvitoService,
} from './avito.service';

const DEFAULT_SYNC_LIMIT = 50;
const DEFAULT_MESSAGE_LIMIT = 50;

@Injectable()
export class AvitoMessengerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvitoMessengerService.name);
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private syncInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly avito: AvitoService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled =
      this.config.get<string>('AVITO_MESSENGER_POLLING_ENABLED') === 'true';
    if (!enabled || !this.avito.isConfigured) return;

    const intervalMs = Math.max(
      Number(this.config.get<string>('AVITO_MESSENGER_POLLING_INTERVAL_MS')) ||
        60_000,
      15_000,
    );
    this.syncTimer = setInterval(() => {
      void this.syncLatest().catch((err) => {
        this.logger.warn(
          `Avito Messenger sync failed: ${err instanceof Error ? err.message : err}`,
        );
      });
    }, intervalMs);
    void this.syncLatest();
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async syncLatest(limit = DEFAULT_SYNC_LIMIT) {
    if (this.syncInFlight) return { skipped: true };
    this.syncInFlight = true;
    try {
      const { chats } = await this.avito.getChats({
        limit,
        offset: 0,
        chatTypes: ['u2i'],
      });
      let messagesSynced = 0;
      for (const chat of chats) {
        await this.upsertChat(chat);
        messagesSynced += await this.syncMessages(
          chat.id,
          DEFAULT_MESSAGE_LIMIT,
        );
      }
      return { chatsSynced: chats.length, messagesSynced };
    } finally {
      this.syncInFlight = false;
    }
  }

  async listChats(options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }) {
    if (options.unreadOnly) {
      await this.syncLatest(options.limit ?? DEFAULT_SYNC_LIMIT);
    }

    const chats = await this.prisma.avitoChat.findMany({
      where: options.unreadOnly
        ? { messages: { some: { direction: 'IN', isRead: false } } }
        : undefined,
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: options.limit ?? DEFAULT_SYNC_LIMIT,
      skip: options.offset ?? 0,
      include: {
        order: { select: { id: true, numberOrder: true, status: true } },
        _count: {
          select: { messages: { where: { direction: 'IN', isRead: false } } },
        },
      },
    });

    return chats.map((chat) => ({
      ...chat,
      unreadCount: chat._count.messages,
      _count: undefined,
    }));
  }

  async getMessages(
    chatId: string,
    options: { limit?: number; offset?: number },
  ) {
    await this.ensureLocalChat(chatId);
    await this.syncMessages(chatId, options.limit ?? DEFAULT_MESSAGE_LIMIT);
    return this.prisma.avitoMessage.findMany({
      where: { chat: { avitoChatId: chatId } },
      orderBy: { sentAt: 'asc' },
      take: options.limit ?? DEFAULT_MESSAGE_LIMIT,
      skip: options.offset ?? 0,
      include: { sentBy: { select: { id: true, username: true } } },
    });
  }

  async sendText(chatId: string, text: string, sentById: string) {
    const trimmed = text.trim();
    if (!trimmed)
      throw new BadRequestException('Сообщение не может быть пустым.');

    await this.ensureLocalChat(chatId);
    const sent = await this.avito.sendMessage(chatId, trimmed);
    await this.upsertMessage(chatId, sent, sentById);
    await this.syncMessages(chatId, DEFAULT_MESSAGE_LIMIT);

    return this.prisma.avitoMessage.findUnique({
      where: { avitoMessageId: sent.id },
      include: { sentBy: { select: { id: true, username: true } } },
    });
  }

  async markRead(chatId: string) {
    await this.ensureLocalChat(chatId);
    const result = await this.avito.markChatRead(chatId);
    await this.prisma.avitoMessage.updateMany({
      where: { chat: { avitoChatId: chatId }, direction: 'IN', isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result;
  }

  private async ensureLocalChat(chatId: string) {
    const existing = await this.prisma.avitoChat.findUnique({
      where: { avitoChatId: chatId },
      select: { id: true },
    });
    if (existing) return existing;

    const remote = await this.avito.getChat(chatId);
    return this.upsertChat(remote);
  }

  private async syncMessages(chatId: string, limit: number) {
    const messages = await this.avito.getMessages(chatId, { limit, offset: 0 });
    for (const message of messages) {
      await this.upsertMessage(chatId, message);
    }
    return messages.length;
  }

  private async upsertChat(chat: AvitoChat) {
    const accountId = String(await this.avito.getUserId());
    const item = chat.context?.value;
    const client = chat.users?.find((user) => String(user.id) !== accountId);
    const lastMessage = chat.last_message;

    return this.prisma.avitoChat.upsert({
      where: { avitoChatId: chat.id },
      update: {
        avitoAccountId: accountId,
        avitoItemId: item?.id === undefined ? null : String(item.id),
        itemTitle: item?.title ?? null,
        itemUrl: item?.url ?? null,
        itemPrice: item?.price_string ?? null,
        clientAvitoId: client?.id === undefined ? null : String(client.id),
        clientName: client?.name ?? null,
        clientProfileUrl: client?.public_user_profile?.url ?? null,
        clientAvatarUrl: this.avatarUrl(client),
        chatCreatedAt: this.fromUnix(chat.created),
        lastMessageAt: this.fromUnix(lastMessage?.created ?? chat.updated),
        lastMessageText: this.messageText(lastMessage),
        lastMessageType: lastMessage?.type ?? null,
        lastDirection: this.direction(lastMessage?.direction),
      },
      create: {
        avitoChatId: chat.id,
        avitoAccountId: accountId,
        avitoItemId: item?.id === undefined ? null : String(item.id),
        itemTitle: item?.title ?? null,
        itemUrl: item?.url ?? null,
        itemPrice: item?.price_string ?? null,
        clientAvitoId: client?.id === undefined ? null : String(client.id),
        clientName: client?.name ?? null,
        clientProfileUrl: client?.public_user_profile?.url ?? null,
        clientAvatarUrl: this.avatarUrl(client),
        chatCreatedAt: this.fromUnix(chat.created),
        lastMessageAt: this.fromUnix(lastMessage?.created ?? chat.updated),
        lastMessageText: this.messageText(lastMessage),
        lastMessageType: lastMessage?.type ?? null,
        lastDirection: this.direction(lastMessage?.direction),
      },
    });
  }

  private async upsertMessage(
    chatId: string,
    message: AvitoMessage,
    sentById?: string,
  ) {
    const chat = await this.ensureLocalChat(chatId);
    const sentAt = this.fromUnix(message.created) ?? new Date();
    const direction =
      this.direction(message.direction) ?? EnumAvitoMessageDirection.IN;

    return this.prisma.avitoMessage.upsert({
      where: { avitoMessageId: message.id },
      update: {
        authorAvitoId:
          message.author_id === undefined ? null : String(message.author_id),
        direction,
        type: message.type,
        text: this.messageText(message),
        content: this.jsonContent(message.content),
        sentAt,
        isRead: Boolean(message.is_read),
        readAt: this.fromUnix(message.read ?? undefined),
        sentById: sentById ?? undefined,
      },
      create: {
        avitoMessageId: message.id,
        chatId: chat.id,
        authorAvitoId:
          message.author_id === undefined ? null : String(message.author_id),
        direction,
        type: message.type,
        text: this.messageText(message),
        content: this.jsonContent(message.content),
        sentAt,
        isRead: Boolean(message.is_read),
        readAt: this.fromUnix(message.read ?? undefined),
        sentById: sentById ?? null,
      },
    });
  }

  private fromUnix(value?: number | null) {
    return value ? new Date(value * 1000) : null;
  }

  private direction(value?: string): EnumAvitoMessageDirection | null {
    if (value === 'in') return EnumAvitoMessageDirection.IN;
    if (value === 'out') return EnumAvitoMessageDirection.OUT;
    return null;
  }

  private messageText(message?: Pick<AvitoMessage, 'content' | 'type'> | null) {
    if (!message) return null;
    if (typeof message.content?.text === 'string') return message.content.text;
    return message.type === 'deleted' ? 'Сообщение удалено' : null;
  }

  private jsonContent(content?: AvitoMessage['content']): any {
    return content ?? undefined;
  }

  private avatarUrl(user?: AvitoChatUser) {
    return (
      user?.public_user_profile?.avatar?.images?.['128x128'] ??
      user?.public_user_profile?.avatar?.default ??
      null
    );
  }
}
