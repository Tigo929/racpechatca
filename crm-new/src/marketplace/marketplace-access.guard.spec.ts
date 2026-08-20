import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccessGuard } from './marketplace-access.guard';

/**
 * Кто до какого кабинета допущен.
 *
 * В кабинете лежит ключ от чужого магазина Ozon. Ошибка здесь — не «неудобно»,
 * а один клиент сервиса управляет магазином другого, поэтому проверяется
 * каждый случай, включая обход по id принта: кабинета в адресе там нет, и без
 * разворота принта в кабинет чужие карточки правились бы свободно.
 */
describe('MarketplaceAccessGuard', () => {
  const ctxFor = (
    user: { id: string; role: EnumRole } | undefined,
    params: Record<string, string> = {},
  ) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
    }) as never;

  const guardWith = (
    account: { ownerId: string | null } | null,
    print: { marketplaceAccountId: string } | null = null,
  ) =>
    new MarketplaceAccessGuard({
      marketplaceAccount: { findUnique: jest.fn().mockResolvedValue(account) },
      ozonPrint: { findUnique: jest.fn().mockResolvedValue(print) },
    } as never);

  const client = { id: 'user-1', role: EnumRole.MARKETPLACE_CLIENT };

  it('админ проходит к любому кабинету — это его сервис', async () => {
    const guard = guardWith({ ownerId: 'кто-то другой' });
    await expect(
      guard.canActivate(
        ctxFor({ id: 'admin', role: EnumRole.ADMIN }, { accountId: 'acc-9' }),
      ),
    ).resolves.toBe(true);
  });

  it('внешний продавец проходит к своему кабинету', async () => {
    const guard = guardWith({ ownerId: 'user-1' });
    await expect(
      guard.canActivate(ctxFor(client, { accountId: 'acc-1' })),
    ).resolves.toBe(true);
  });

  it('к чужому кабинету не проходит', async () => {
    const guard = guardWith({ ownerId: 'user-2' });
    await expect(
      guard.canActivate(ctxFor(client, { accountId: 'acc-2' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('к кабинету владельца сервиса (без хозяина) не проходит', async () => {
    // ownerId пустой у кабинетов, заведённых до появления внешних продавцов.
    // Это кабинеты владельца, и отдавать их клиенту нельзя.
    const guard = guardWith({ ownerId: null });
    await expect(
      guard.canActivate(ctxFor(client, { accountId: 'acc-0' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('чужой и несуществующий кабинет неотличимы по ответу', async () => {
    // Иначе перебором можно узнать, какие кабинеты вообще есть в системе.
    const missing = guardWith(null);
    const foreign = guardWith({ ownerId: 'user-2' });
    const err = async (g: MarketplaceAccessGuard) => {
      try {
        await g.canActivate(ctxFor(client, { accountId: 'acc-x' }));
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(await err(missing)).toBe(await err(foreign));
  });

  it('по id принта разворачивает кабинет и не пускает к чужому', async () => {
    const foreign = guardWith({ ownerId: 'user-2' }, { marketplaceAccountId: 'acc-2' });
    await expect(
      guard_(foreign, { id: 'print-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const own = guardWith({ ownerId: 'user-1' }, { marketplaceAccountId: 'acc-1' });
    await expect(guard_(own, { id: 'print-1' })).resolves.toBe(true);
  });

  it('несуществующий принт — не найден, а не «можно»', async () => {
    const guard = guardWith(null, null);
    await expect(
      guard_(guard, { id: 'print-нет' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('без пользователя не пускает вовсе', async () => {
    const guard = guardWith({ ownerId: 'user-1' });
    await expect(
      guard.canActivate(ctxFor(undefined, { accountId: 'acc-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  function guard_(g: MarketplaceAccessGuard, params: Record<string, string>) {
    return g.canActivate(ctxFor(client, params));
  }
});
