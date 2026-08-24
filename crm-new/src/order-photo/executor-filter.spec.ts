import { OrderPhotoService } from './order-photo.service';
import { EnumRole, EnumStatus } from 'src/generated/prisma/enums';
import type DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';

/**
 * Отбор заказов по исполнителю.
 *
 * Проверяем не «фильтр работает», а границу доступа: параметр запроса не
 * должен открывать исполнителю чужую загрузку. Роль EXECUTOR видит только
 * свои заказы, и подстановка чужого идентификатора в адрес обязана
 * оставаться безрезультатной — иначе отбор превращается в дыру.
 */

interface OrdersWhere {
  executorId?: string | null;
  status?: unknown;
  productCategory?: unknown;
}

/** Сервис с подставным Prisma: нас интересует только собранное условие where. */
function serviceWithSpy() {
  let where: OrdersWhere | undefined;
  const findMany = (args: { where: OrdersWhere }) => {
    where = args.where;
    return Promise.resolve([]);
  };
  const prisma = {
    orderPhoto: { findMany, count: () => Promise.resolve(0) },
    // getAllOrders складывает оба запроса в одну транзакцию.
    $transaction: (calls: Promise<unknown>[]) => Promise.all(calls),
  };
  const service = new OrderPhotoService(
    prisma as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
  return { service, whereOf: () => where };
}

const ADMIN_ID = 'admin-id';
const OTHER_EXECUTOR = '22222222-2222-4222-8222-222222222222';
const SOME_EXECUTOR = '11111111-1111-4111-8111-111111111111';

function query(
  extra: Partial<DtoAllOrdersforQuery> = {},
): DtoAllOrdersforQuery {
  return { page: 1, limit: 10, ...extra };
}

describe('отбор заказов по исполнителю', () => {
  it('администратор видит заказы выбранного сотрудника', async () => {
    const { service, whereOf } = serviceWithSpy();
    await service.getAllOrders(
      query({ executorId: SOME_EXECUTOR }),
      ADMIN_ID,
      EnumRole.ADMIN,
    );
    expect(whereOf()?.executorId).toBe(SOME_EXECUTOR);
  });

  it('«none» отбирает заказы, на которых нет исполнителя', async () => {
    const { service, whereOf } = serviceWithSpy();
    await service.getAllOrders(
      query({ executorId: 'none' }),
      ADMIN_ID,
      EnumRole.ADMIN,
    );
    expect(whereOf()?.executorId).toBeNull();
  });

  it('без параметра отбор по исполнителю не навязывается', async () => {
    const { service, whereOf } = serviceWithSpy();
    await service.getAllOrders(query(), ADMIN_ID, EnumRole.ADMIN);
    expect(whereOf()?.executorId).toBeUndefined();
  });

  it('исполнитель не увидит чужие заказы, подставив чужой идентификатор', async () => {
    const { service, whereOf } = serviceWithSpy();
    await service.getAllOrders(
      query({ executorId: OTHER_EXECUTOR }),
      'executor-id',
      EnumRole.EXECUTOR,
    );
    // Роль перезаписывает параметр собственным идентификатором.
    expect(whereOf()?.executorId).toBe('executor-id');
  });

  it('исполнитель не может запросить и «ничьи» заказы', async () => {
    const { service, whereOf } = serviceWithSpy();
    await service.getAllOrders(
      query({ executorId: 'none' }),
      'executor-id',
      EnumRole.EXECUTOR,
    );
    expect(whereOf()?.executorId).toBe('executor-id');
  });

  it('отбор по исполнителю не отменяет прочие условия списка', async () => {
    const { service, whereOf } = serviceWithSpy();
    await service.getAllOrders(
      query({
        executorId: SOME_EXECUTOR,
        status: EnumStatus.READY,
        productCategory: 'PHOTO',
      }),
      ADMIN_ID,
      EnumRole.ADMIN,
    );
    expect(whereOf()?.status).toBe(EnumStatus.READY);
    expect(whereOf()?.productCategory).toBe('PHOTO');
  });
});
