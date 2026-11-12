import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { alreadyAskedIdentities } from './client-identity';

/**
 * Кому про отзыв уже писали — по клиенту, а не по заказу.
 *
 * Отметки об отзыве живут в заказе, и до сих пор так всё и считалось:
 * каждый заказ спрашивал только про себя. Для постоянного заказчика это
 * значило просьбу после каждой покупки — отзыв он оставил после первой,
 * а письма приходили и после второй, и после третьей.
 *
 * Сервис достаёт прошлые заказы, по которым отзыв оставлен или просьба
 * отправлена, и сводит их к ключам клиентов. Дальше оба пути отправки
 * (напоминание владельцу и автоматическая просьба) просеивают своих
 * кандидатов одним и тем же набором.
 *
 * Выборка идёт целиком, без сужения по кандидатам, и это осознанно.
 * Ключ клиента считается в коде — одна функция на весь проект, — а не
 * выражается запросом: повторить нормализацию ника и телефона на SQL
 * значит завести вторую, слегка другую правду о том, кто есть кто.
 * Строк здесь сотни, выбираются пять коротких колонок, и проход этот
 * случается раз в час.
 */
@Injectable()
export class ReviewAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async askedIdentities(): Promise<Set<string>> {
    const rows = await this.prisma.orderPhoto.findMany({
      where: {
        OR: [
          { clientReviewLeft: true },
          { reviewRequestSentAt: { not: null } },
        ],
      },
      select: {
        communicationPlatform: true,
        urlCommunication: true,
        clientTelegram: true,
        clientReviewLeft: true,
        reviewRequestSentAt: true,
      },
    });
    return alreadyAskedIdentities(rows);
  }
}
