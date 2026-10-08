import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  OzonApiClient,
  OzonApiError,
  type OzonCredentials,
} from './ozon/ozon-api.client';
import {
  OZON_CHAT_URL_ENV,
  OZON_CHAT_URL_TEMPLATE,
  ozonChatUrl,
  type OzonChatStartResponse,
} from './ozon/ozon-chat';

/**
 * Чат с покупателем: получить ссылку и положить её в заказ CRM.
 *
 * Раньше ссылку вставляли руками: оператор шёл в кабинет, открывал чат,
 * копировал адрес. Шаг лишний, и чаще его просто пропускали — тогда в поле
 * связи оставался номер отправления, а бот, прося отзыв, отправлял клиента
 * в общий список заказов вместо его переписки.
 *
 * Делается по нажатию, а не само при заведении заказа. Ozon отдаёт адрес
 * чата только вместе с его созданием: автоматический вызов открыл бы пустой
 * чат с каждым покупателем, включая тех, кто писать не собирался. Нажатие —
 * это и есть «я иду писать».
 */
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
   * Открыть (или получить уже открытый) чат по отправлению и сохранить
   * ссылку в заказе CRM.
   *
   * Ozon по тому же номеру отправления возвращает тот же чат, поэтому
   * повторное нажатие второй переписки не создаёт.
   */
  async openForPosting(
    creds: OzonCredentials,
    postingNumber: string,
  ): Promise<{ chatId: string; url: string; savedToOrder: boolean }> {
    let res: OzonChatStartResponse;
    try {
      res = await this.api.post<OzonChatStartResponse>(creds, '/v1/chat/start', {
        posting_number: postingNumber,
      });
    } catch (error) {
      if (error instanceof OzonApiError) {
        throw new BadRequestException(
          `Ozon не открыл чат по отправлению ${postingNumber}: ${error.message}`,
        );
      }
      throw error;
    }

    const chatId = res.result?.chat_id ?? '';
    const url = ozonChatUrl(chatId, this.template);
    if (!url) {
      throw new BadRequestException(
        'Ozon не вернул чат по этому отправлению — возможно, переписка по нему уже закрыта',
      );
    }

    /*
     * Ссылка кладётся в то же поле, куда её вставляли руками: по нему
     * работает и карточка заказа, и просьба об отзыве. Отдельное поле
     * развело бы два адреса одной и той же переписки.
     */
    const saved = await this.prisma.orderPhoto.updateMany({
      where: { marketplacePostingNumber: postingNumber },
      data: { urlCommunication: url },
    });

    return { chatId, url, savedToOrder: saved.count > 0 };
  }
}
