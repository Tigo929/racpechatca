import { OrderPhotoService } from './order-photo.service';

/**
 * Папка заказа на Яндекс.Диске и связь «папка загрузки → номер заказа».
 *
 * Сайт держит фотографии в папке со случайным номером, а на Диске
 * владельца они ложатся в папку с номером заказа — по нему их и ищут.
 * Номер присваиваем мы, поэтому сайт спрашивает его у нас.
 */
describe('фотографии заказа на Диске', () => {
  function build(
    order:
      | { id: string; numberOrder: string; note: string | null; status: string }
      | null,
  ) {
    const updates: string[] = [];
    const statuses: string[] = [];
    const history: { from: string; to: string; by: string }[] = [];
    const metrika: string[] = [];

    const write = {
      orderPhoto: {
        update: async ({ data }: { data: { note?: string; status?: string } }) => {
          if (data.note !== undefined) updates.push(data.note);
          if (data.status !== undefined) statuses.push(data.status);
          return {};
        },
      },
      statusHistory: {
        create: async ({
          data,
        }: {
          data: { fromStatus: string; toStatus: string; changedBy: string };
        }) => {
          history.push({
            from: data.fromStatus,
            to: data.toStatus,
            by: data.changedBy,
          });
          return { id: 'h1' };
        },
      },
    };

    const prisma = {
      orderPhoto: {
        findFirst: async () => order,
        update: write.orderPhoto.update,
      },
      $transaction: async (fn: (tx: typeof write) => Promise<unknown>) =>
        fn(write),
    };
    const service = new OrderPhotoService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        enqueueTransition: async (
          _tx: unknown,
          move: { toStatus: string },
        ) => {
          metrika.push(move.toStatus);
        },
      } as never,
      {} as never,
    );
    return { service, updates, statuses, history, metrika };
  }

  const ORDER = {
    id: 'o1',
    numberOrder: '20261024-301',
    note: '🆕 Заявка с сайта',
    status: 'NEW',
  };

  it('называет номер заказа по папке загрузки', async () => {
    const { service } = build(ORDER);

    await expect(
      service.orderNumberByUpload('54e6fc13-62e9-4b89-9ebe-283c5b442111'),
    ).resolves.toBe('20261024-301');
  });

  it('заказа ещё нет — отвечаем пусто, а не выдумываем', async () => {
    // Заявка может быть в пути: выгрузка подождёт следующего захода.
    const { service } = build(null);

    await expect(service.orderNumberByUpload('нет-такой')).resolves.toBeNull();
  });

  it('путь к папке дописывается в примечание', async () => {
    const { service, updates } = build(ORDER);

    await service.recordPhotosFolder({
      uploadId: 'u1',
      folder: '/1Распечатка/2Ресеил/1Входные фотки/20261024-301',
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toContain('🆕 Заявка с сайта');
    expect(updates[0]).toContain('20261024-301');
  });

  it('повторная выгрузка не задваивает строку', async () => {
    /*
      Хвост заказа может доехать позже, и сайт сообщит о той же папке
      ещё раз. Примечание не должно расти при каждом заходе.
    */
    const folder = '/1Распечатка/2Ресеил/1Входные фотки/20261024-301';
    const { service, updates } = build({
      ...ORDER,
      note: `🆕 Заявка с сайта\n📁 Фотографии на Яндекс.Диске: ${folder}`,
    });

    await service.recordPhotosFolder({ uploadId: 'u1', folder });

    expect(updates).toEqual([]);
  });

  it('неизвестная папка не роняет запрос', async () => {
    const { service } = build(null);

    await expect(
      service.recordPhotosFolder({ uploadId: 'u1', folder: '/x' }),
    ).resolves.toBeUndefined();
  });

  it('заказ встаёт на «Создана папка»', async () => {
    // Раньше менеджер щёлкал этот статус руками ровно после того, как
    // разложил фотографии по папкам.
    const { service, statuses, history, metrika } = build(ORDER);

    await service.recordPhotosFolder({ uploadId: 'u1', folder: '/x/20261024-301' });

    expect(statuses).toEqual(['FOLDER_STRUCTURE_CREATED']);
    expect(history).toEqual([
      { from: 'NEW', to: 'FOLDER_STRUCTURE_CREATED', by: 'site' },
    ]);
    expect(metrika).toEqual(['FOLDER_STRUCTURE_CREATED']);
  });

  it('заказ в работе назад не тянется', async () => {
    /*
      Хвост доехал позже, папку дополнили — и повторное сообщение не
      должно вернуть на первый шаг заказ, который уже печатают.
    */
    const { service, statuses } = build({ ...ORDER, status: 'PRINTED' });

    await service.recordPhotosFolder({ uploadId: 'u1', folder: '/x/20261024-301' });

    expect(statuses).toEqual([]);
  });

  it('обращение остаётся обращением', async () => {
    // С клиентом ещё не договорились: тянуть заявку в производство рано.
    const { service, statuses } = build({ ...ORDER, status: 'LEAD' });

    await service.recordPhotosFolder({ uploadId: 'u1', folder: '/x/20261024-301' });

    expect(statuses).toEqual([]);
  });
});
