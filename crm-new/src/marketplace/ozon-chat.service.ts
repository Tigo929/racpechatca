import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  OzonApiClient,
  OzonApiError,
  type OzonCredentials,
} from './ozon/ozon-api.client';
import {
  chatMatchesPosting,
  isPremiumRequired,
  OZON_CHAT_URL_ENV,
  OZON_CHAT_URL_TEMPLATE,
  ozonChatUrl,
  PREMIUM_REQUIRED_MESSAGE,
  type OzonChatListItem,
  type OzonChatMessage,
  type OzonChatStartResponse,
} from './ozon/ozon-chat';

/**
 * Чат с покупателем: найти переписку по отправлению и положить ссылку
 * в заказ CRM.
 *
 * Ссылку вставляли руками: сходить в кабинет, найти заказ, открыть чат,
 * скопировать адрес. Шаг лишний, и чаще его просто пропускали — тогда
 * в поле связи оставался номер отправления, а бот, прося отзыв, отправлял
 * покупателя в общий список заказов вместо его переписки.
 *
 * Сначала ищем уже существующий чат: Ozon отдаёт список переписок и их
 * историю, а в сообщениях есть номер заказа — по нему чат и узнаётся.
 * Создание чата своей рукой (/v1/chat/start) площадка разрешает только
 * с подпиской Premium Plus, поэтому оно здесь — запасной путь, а не
 * основной: без подписки оно просто откажет, и мы честно об этом скажем.
 */

/** Сколько свежих переписок просматриваем в поисках нужной. */
const SCAN_CHATS = 40;

/** Сколько сообщений смотрим в каждой: номер заказа есть в самых первых. */
const SCAN_MESSAGES = 10;

@Injectable()
export class OzonChatService {
  private readonly logger = new Logger(OzonChatService.name);

  constructor(
    private readonly api: OzonApiClient,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get template(): string {
    return (
      this.config.get<string>(OZON_CHAT_URL_ENV)?.trim() ||
      OZON_CHAT_URL_TEMPLATE
    );
  }

  /**
   * Найти переписку по отправлению и сохранить ссылку в заказе CRM.
   */
  async openForPosting(
    creds: OzonCredentials,
    postingNumber: string,
  ): Promise<{
    chatId: string;
    url: string;
    savedToOrder: boolean;
    /** Нашли готовую переписку или пришлось просить площадку открыть новую. */
    existing: boolean;
  }> {
    const found = await this.findExisting(creds, postingNumber);
    const chatId = found ?? (await this.startChat(creds, postingNumber));

    const url = ozonChatUrl(chatId, this.template);
    if (!url) {
      throw new BadRequestException(
        'Ozon вернул переписку без опознавательного номера — открыть её не получится',
      );
    }

    /*
     * Ссылка кладётся в то же поле, куда её вставляли руками: по нему
     * работает и карточка заказа, и просьба об отзыве. Отдельное поле
     * развело бы два адреса одной переписки.
     */
    const saved = await this.prisma.orderPhoto.updateMany({
      where: { marketplacePostingNumber: postingNumber },
      data: { urlCommunication: url },
    });

    return { chatId, url, savedToOrder: saved.count > 0, existing: Boolean(found) };
  }

  /**
   * Переписка, которую покупатель уже начал.
   *
   * Список чатов площадка отдаёт без привязки к заказу, поэтому связь
   * берётся из истории: в сообщениях есть номер заказа, а первой строкой
   * заказного чата — номер отправления.
   *
   * Смотрим свежие переписки и останавливаемся на первой подходящей:
   * у заказа, по которому сейчас работают, чат почти всегда среди последних,
   * а перебирать всю историю кабинета на каждое нажатие нельзя.
   */
  private async findExisting(
    creds: OzonCredentials,
    postingNumber: string,
  ): Promise<string | null> {
    let chats: OzonChatListItem[];
    try {
      const res = await this.api.post<{ chats?: OzonChatListItem[] }>(
        creds,
        '/v3/chat/list',
        { limit: SCAN_CHATS },
      );
      chats = res.chats ?? [];
    } catch (error) {
      // Список недоступен — не повод падать: ниже попробуем открыть чат сами.
      this.logger.warn(
        `Не удалось получить список чатов Ozon: ${(error as Error).message}`,
      );
      return null;
    }

    const buyerChats = chats
      .map((item) => item.chat)
      .filter((chat): chat is NonNullable<OzonChatListItem['chat']> =>
        Boolean(chat?.chat_id && chat.chat_type === 'BUYER_SELLER'),
      )
      // Свежие — первыми: нужный чат почти всегда среди них.
      .sort((a, b) => (b!.created_at ?? '').localeCompare(a!.created_at ?? ''));

    for (const chat of buyerChats) {
      const chatId = chat!.chat_id!;
      try {
        const history = await this.api.post<{ messages?: OzonChatMessage[] }>(
          creds,
          '/v3/chat/history',
          { chat_id: chatId, limit: SCAN_MESSAGES, direction: 'Backward' },
        );
        if (chatMatchesPosting(history.messages, postingNumber)) return chatId;
      } catch (error) {
        // Одна недоступная переписка не должна прерывать поиск остальных.
        this.logger.warn(
          `Не прочитать историю чата ${chatId}: ${(error as Error).message}`,
        );
      }
    }
    return null;
  }

  /**
   * Попросить площадку открыть переписку. Работает только с подпиской
   * Premium Plus — без неё Ozon отвечает отказом, и об этом нужно сказать
   * прямо, а не списывать на ключи доступа.
   */
  private async startChat(
    creds: OzonCredentials,
    postingNumber: string,
  ): Promise<string> {
    let res: OzonChatStartResponse;
    try {
      res = await this.api.post<OzonChatStartResponse>(creds, '/v1/chat/start', {
        posting_number: postingNumber,
      });
    } catch (error) {
      if (error instanceof OzonApiError) {
        throw new BadRequestException(
          isPremiumRequired(`${error.details ?? ''} ${error.message}`)
            ? PREMIUM_REQUIRED_MESSAGE
            : `Ozon не открыл чат по отправлению ${postingNumber}: ${error.message}`,
        );
      }
      throw error;
    }

    const chatId = (res.result?.chat_id ?? '').trim();
    if (!chatId) {
      throw new BadRequestException(
        `Переписки по отправлению ${postingNumber} пока нет: покупатель вам ещё не писал`,
      );
    }
    return chatId;
  }
}
