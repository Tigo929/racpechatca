import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Адрес, по которому сайт отдаёт фотографии заказа.
 *
 * Принимаем только свои ссылки и только два известных вида: папка заказа
 * и архив старого образца. Ссылка приходит с сайта вместе с заявкой, и
 * слать по ней запрос «удали» вслепую нельзя — это чужой адрес в нашем
 * исходящем трафике.
 */
const PHOTOS_URL_RE =
  /^https?:\/\/[^/]+\/api\/leads\/archive\/(?:session\/[0-9a-f-]{36}|lead-[0-9a-f-]+\.zip)$/;

/**
 * Удаление исходников заказа на сайте.
 *
 * Заказ отгружен — отпечатки у человека, и держать его фотографии дальше
 * незачем: это чужие файлы на нашем диске и место, которого на сервере
 * конечное количество. Решение принимает CRM, потому что только она знает
 * статус заказа; сайт по команде удаляет папку.
 *
 * Молчит, когда не настроено: на машине разработчика секрета нет, и
 * ломать из-за этого смену статуса нельзя.
 */
@Injectable()
export class SitePhotosService {
  private readonly logger = new Logger(SitePhotosService.name);

  constructor(private readonly prisma: PrismaService) {}

  private token(): string {
    return (process.env.SITE_PHOTOS_CLEANUP_TOKEN ?? '').trim();
  }

  /** Адрес для удаления: та же ссылка без подписи скачивания. */
  static cleanupUrl(archiveUrl: string): string | null {
    let url: URL;
    try {
      url = new URL(archiveUrl);
    } catch {
      return null;
    }
    const withoutQuery = `${url.origin}${url.pathname}`;
    return PHOTOS_URL_RE.test(withoutQuery) ? withoutQuery : null;
  }

  /**
   * Просит сайт удалить фотографии заказа и забывает ссылку.
   *
   * Ссылку обнуляем только при успехе: пока она на месте, попытку можно
   * повторить — иначе файлы остались бы на диске, а CRM считала бы, что
   * их уже нет.
   */
  async dropForOrder(orderId: string, archiveUrl: string): Promise<boolean> {
    const token = this.token();
    if (!token) return false;

    const url = SitePhotosService.cleanupUrl(archiveUrl);
    if (!url) {
      this.logger.warn(`Заказ ${orderId}: ссылка на фотографии не распознана`);
      return false;
    }

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'x-cleanup-token': token },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        this.logger.warn(
          `Заказ ${orderId}: сайт не удалил фотографии (${response.status})`,
        );
        return false;
      }
    } catch (error) {
      this.logger.warn(
        `Заказ ${orderId}: не достучались до сайта за удалением фотографий: ${String(error)}`,
      );
      return false;
    }

    await this.prisma.orderPhoto.update({
      where: { id: orderId },
      data: { photosArchiveUrl: null },
    });
    this.logger.log(`Заказ ${orderId}: фотографии на сайте удалены`);
    return true;
  }
}
