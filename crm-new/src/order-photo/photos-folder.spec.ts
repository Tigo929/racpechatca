import { OrderPhotoService } from './order-photo.service';

/**
 * Папка заказа на Яндекс.Диске и связь «папка загрузки → номер заказа».
 *
 * Сайт держит фотографии в папке со случайным номером, а на Диске
 * владельца они ложатся в папку с номером заказа — по нему их и ищут.
 * Номер присваиваем мы, поэтому сайт спрашивает его у нас.
 */
describe('фотографии заказа на Диске', () => {
  function build(order: { id: string; numberOrder: string; note: string | null } | null) {
    const updates: string[] = [];
    const prisma = {
      orderPhoto: {
        findFirst: async () => order,
        update: async ({ data }: { data: { note: string } }) => {
          updates.push(data.note);
          return {};
        },
      },
    };
    const service = new OrderPhotoService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, updates };
  }

  const ORDER = {
    id: 'o1',
    numberOrder: '20261024-301',
    note: '🆕 Заявка с сайта',
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
});
