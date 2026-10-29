import { OrderPhotoService } from './order-photo.service';

/**
 * Сайт сообщил, что фотографии заказа доехали не все.
 *
 * Две вещи сразу: числа в заказе — по ним краснеет карточка — и строка
 * в примечании с сообщением владельцу. Числа важнее: цвет карточки
 * видит тот, кто заказ открыл, а сообщение теряется в потоке.
 *
 * Сайт сообщает о папке при каждом изменении числа файлов, поэтому
 * проверяется и обратный ход: хвост доехал — карточка белеет сама.
 */
describe('недобор фотографий: отчёт сайта', () => {
  type OrderRow = {
    id: string;
    numberOrder: string;
    note: string | null;
  } | null;

  function build(order: OrderRow) {
    const updates: Record<string, unknown>[] = [];
    const alerts: string[] = [];

    const prisma = {
      orderPhoto: {
        findFirst: async () => order,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return {};
        },
      },
    };
    const telegram = {
      sendLeadAlert: async (text: string) => {
        alerts.push(text);
      },
    };
    const service = new OrderPhotoService(
      prisma as never,
      {} as never,
      telegram as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, updates, alerts };
  }

  const ORDER = {
    id: 'o1',
    numberOrder: '20261024-301',
    note: '🆕 Заявка с сайта\nИмя: Анна',
  };

  it('записывает числа — по ним краснеет карточка', async () => {
    const { service, updates } = build(ORDER);

    await service.reportPhotosShortfall({
      uploadId: 'u1',
      expected: 172,
      arrived: 84,
    });

    expect(updates[0]).toMatchObject({ photosExpected: 172, photosArrived: 84 });
  });

  it('дописывает строку в примечание и пишет владельцу', async () => {
    const { service, updates, alerts } = build(ORDER);

    await service.reportPhotosShortfall({
      uploadId: 'u1',
      expected: 172,
      arrived: 84,
    });

    expect(String(updates[0]?.note)).toContain('доехали не все: 84 из 172');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('20261024-301');
  });

  it('повторный отчёт не задваивает строку и не шлёт второе сообщение', async () => {
    // Сайт сообщает при каждом изменении числа файлов: без этого
    // примечание превратилось бы в столбик почти одинаковых строк,
    // а владелец — в человека, который их пролистывает.
    const told = {
      ...ORDER,
      note: `${ORDER.note}\n⚠️ Фотографии доехали не все: 84 из 172. Запросите у клиента остальные до печати.`,
    };
    const { service, updates, alerts } = build(told);

    await service.reportPhotosShortfall({
      uploadId: 'u1',
      expected: 172,
      arrived: 120,
    });

    const note = String(updates[0]?.note);
    expect(note).toContain('120 из 172');
    expect(note).not.toContain('84 из 172');
    expect(alerts).toEqual([]);
  });

  it('хвост доехал — числа сравниваются, строка уходит, тревоги нет', async () => {
    const told = {
      ...ORDER,
      note: `${ORDER.note}\n⚠️ Фотографии доехали не все: 84 из 172. Запросите у клиента остальные до печати.`,
    };
    const { service, updates, alerts } = build(told);

    await service.reportPhotosShortfall({
      uploadId: 'u1',
      expected: 172,
      arrived: 172,
    });

    expect(updates[0]).toMatchObject({
      photosExpected: 172,
      photosArrived: 172,
    });
    expect(String(updates[0]?.note)).not.toContain('доехали не все');
    expect(alerts).toEqual([]);
  });

  it('заказ не найден — молчим, а не падаем', async () => {
    // Заказ удалили или фотографии подчистили после отгрузки.
    const { service, updates, alerts } = build(null);

    await service.reportPhotosShortfall({
      uploadId: 'нет-такой',
      expected: 10,
      arrived: 2,
    });

    expect(updates).toEqual([]);
    expect(alerts).toEqual([]);
  });
});
