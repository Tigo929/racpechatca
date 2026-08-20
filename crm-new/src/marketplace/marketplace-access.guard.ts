import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthenticatedRequest } from 'src/auth/authenticated-request';

/**
 * Кабинет принадлежит тому, кто его завёл.
 *
 * В кабинете лежит ключ от чужого магазина Ozon: товары, цены, остатки,
 * заказы. Внешний продавец обязан видеть только свой — иначе один клиент
 * сервиса управляет магазином другого, и это не «неудобно», а утечка.
 *
 * Проверка сделана охранником, а не строкой в каждом методе, намеренно:
 * маршрутов с `accountId` больше двадцати, они в пяти контроллерах и будут
 * добавляться. Забыть строку легко, забыть охранник на контроллере — заметно.
 *
 * Владелец сервиса (ADMIN) видит все кабинеты: это его сервис, ему помогать
 * с разбором ошибок и отключать доступ.
 */
@Injectable()
export class MarketplaceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<
      AuthenticatedRequest & { params?: Record<string, string> }
    >();
    const { user } = req;
    if (!user) throw new ForbiddenException('Недостаточно прав');
    if (user.role === EnumRole.ADMIN) return true;

    const accountId = req.params?.accountId;
    if (accountId) {
      await this.assertOwnsAccount(user.id, accountId);
      return true;
    }

    /*
     * Маршруты по id принта (правка, удаление, добавление цвета) кабинет в
     * адресе не несут — разворачиваем принт в его кабинет. Без этого внешний
     * продавец мог бы править чужие карточки, зная их id.
     */
    const printId = req.params?.id;
    if (printId) {
      const print = await this.prisma.ozonPrint.findUnique({
        where: { id: printId },
        select: { marketplaceAccountId: true },
      });
      if (!print) throw new NotFoundException('Принт не найден');
      await this.assertOwnsAccount(user.id, print.marketplaceAccountId);
      return true;
    }

    /*
     * Маршрут без кабинета и без принта — например, список кабинетов или
     * создание нового. Такие методы обязаны сами ограничиться владельцем
     * (см. MarketplaceAccountService.list/create), поэтому пропускаем.
     */
    return true;
  }

  private async assertOwnsAccount(userId: string, accountId: string) {
    const account = await this.prisma.marketplaceAccount.findUnique({
      where: { id: accountId },
      select: { ownerId: true },
    });
    // «Не найден» и «чужой» отвечаем одинаково: иначе по коду ответа можно
    // перебором узнать, какие кабинеты вообще существуют.
    if (!account || account.ownerId !== userId) {
      throw new NotFoundException('Кабинет не найден');
    }
  }
}
