import { Injectable, Logger } from '@nestjs/common';
import { MarketplaceAccountService } from 'src/marketplace/marketplace-account.service';
import {
  OzonApiClient,
  OzonApiError,
  type OzonCredentials,
} from 'src/marketplace/ozon/ozon-api.client';
import { ozonChatId, ozonSheetFileName } from './ozon-chat';

/**
 * Отправка листа согласования в чат с покупателем на Ozon.
 *
 * В Telegram за нас пишет userbot: личные сообщения от имени аккаунта
 * иначе не отправить. Здесь посредник не нужен — ключи от кабинета лежат
 * в самой CRM, и она пишет покупателю напрямую Seller API.
 *
 * Поэтому и очереди второй нет: строка отправки та же самая
 * (ApprovalTelegramDelivery), просто её забирает не воркер, а запрос,
 * которым менеджер нажал кнопку.
 */

/** Ozon принимает файл одним куском в base64, без отдельной загрузки. */
interface OzonChatStartResponse {
  result?: { chat_id?: string };
}

/** Что именно не получилось — этот код видит менеджер в карточке. */
export class OzonChatError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OzonChatError';
  }
}

@Injectable()
export class ApprovalOzonChatService {
  private readonly logger = new Logger(ApprovalOzonChatService.name);

  constructor(
    private readonly accounts: MarketplaceAccountService,
    private readonly api: OzonApiClient,
  ) {}

  /**
   * Доступы кабинета, из которого заведён заказ.
   *
   * Кабинет удаляли и пересоздавали, и часть старых заказов ссылается на
   * кабинет, которого больше нет. Писать в такой чат нечем — говорим об
   * этом прямо, а не падаем пятисоткой.
   */
  private async credentials(
    marketplaceAccountId: string | null,
  ): Promise<OzonCredentials> {
    if (!marketplaceAccountId) {
      throw new OzonChatError(
        'ozon_no_account',
        'У заказа не указан кабинет Ozon — писать покупателю нечем.',
      );
    }
    try {
      return await this.accounts.credentials(marketplaceAccountId);
    } catch {
      throw new OzonChatError(
        'ozon_no_account',
        'Кабинет Ozon этого заказа недоступен: проверьте доступы в разделе маркетплейсов.',
      );
    }
  }

  /**
   * Идентификатор чата с покупателем.
   *
   * Сначала берём из ссылки, записанной в заказе: менеджер уже отвечает по
   * ней руками, и это самый надёжный адрес. Если ссылки нет — просим чат у
   * площадки по номеру отправления: Ozon либо вернёт уже существующий, либо
   * откроет новый. Метод идемпотентный, лишней переписки от него не
   * появляется.
   */
  async resolveChatId(order: {
    urlCommunication: string | null;
    marketplacePostingNumber: string | null;
    marketplaceAccountId: string | null;
  }): Promise<string> {
    const fromUrl = ozonChatId(order.urlCommunication);
    if (fromUrl) return fromUrl;

    if (!order.marketplacePostingNumber) {
      throw new OzonChatError(
        'ozon_no_chat',
        'В заказе нет ни ссылки на чат Ozon, ни номера отправления — непонятно, кому писать.',
      );
    }

    const creds = await this.credentials(order.marketplaceAccountId);
    let started: OzonChatStartResponse;
    try {
      started = await this.api.post<OzonChatStartResponse>(
        creds,
        '/v1/chat/start',
        { posting_number: order.marketplacePostingNumber },
      );
    } catch (error) {
      throw this.translate(error, 'открыть чат с покупателем');
    }
    const chatId = started.result?.chat_id;
    if (!chatId) {
      throw new OzonChatError(
        'ozon_no_chat',
        'Ozon не открыл чат по этому отправлению. Возможно, срок переписки по заказу уже истёк.',
      );
    }
    return chatId;
  }

  /**
   * Пишет покупателю: сначала текст, следом макет.
   *
   * Порядок важен. Ozon не умеет подписывать файл — это два отдельных
   * сообщения, и одно из них может не уйти. Текстом мы объясняем, что
   * сейчас придёт; если следом не уедет картинка, отправка целиком
   * считается неудачной, а повтор отправит оба сообщения заново.
   * Обратный порядок оставил бы покупателя с картинкой без объяснения —
   * а это и есть то, ради чего затевалось согласование.
   */
  async send(input: {
    marketplaceAccountId: string | null;
    chatId: string;
    text: string;
    image: Buffer;
    orderNumber: string | number;
    version: number;
  }): Promise<void> {
    const creds = await this.credentials(input.marketplaceAccountId);

    try {
      await this.api.post(creds, '/v1/chat/send/message', {
        chat_id: input.chatId,
        text: input.text,
      });
    } catch (error) {
      throw this.translate(error, 'отправить сообщение');
    }

    try {
      await this.api.post(creds, '/v1/chat/send/file', {
        chat_id: input.chatId,
        base64_content: input.image.toString('base64'),
        name: ozonSheetFileName(input.orderNumber, input.version),
      });
    } catch (error) {
      // Текст покупатель уже получил. Говорим об этом прямо: при повторе
      // сообщение придёт второй раз, и менеджер должен это знать заранее.
      const translated = this.translate(error, 'отправить макет');
      this.logger.warn(
        `Чат Ozon ${input.chatId}: текст ушёл, макет — нет (${translated.code})`,
      );
      throw new OzonChatError(
        'ozon_file',
        `Сообщение покупателю ушло, а макет — нет: ${translated.message}`,
      );
    }
  }

  /**
   * Ответ площадки — в код, понятный карточке заказа.
   *
   * Отдельный разбор, а не «Ozon вернул ошибку»: менеджеру нужно знать,
   * чинить ли доступы, ждать ли, или писать покупателю руками, потому что
   * окно переписки закрылось.
   */
  private translate(error: unknown, action: string): OzonChatError {
    if (!(error instanceof OzonApiError)) {
      const reason = error instanceof Error ? error.message : String(error);
      return new OzonChatError(
        'ozon_unavailable',
        `Не удалось ${action}: ${reason}`,
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new OzonChatError('ozon_keys', error.humanMessage);
    }
    if (error.status === 429) {
      return new OzonChatError('ozon_flood', error.humanMessage);
    }
    if (error.status >= 500 || error.status === 0) {
      return new OzonChatError('ozon_unavailable', error.humanMessage);
    }
    // 404 и 400 от чатов означают почти всегда одно: чата нет или он уже
    // закрыт. Ozon разрешает писать ограниченное время после доставки.
    if (/chat/i.test(error.details ?? error.humanMessage)) {
      return new OzonChatError(
        'ozon_chat_closed',
        'Ozon не принял сообщение в этот чат: переписка закрыта или чат не найден. Напишите покупателю из кабинета.',
      );
    }
    return new OzonChatError('ozon_rejected', error.humanMessage);
  }
}
