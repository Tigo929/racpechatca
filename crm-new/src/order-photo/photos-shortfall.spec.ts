import { OrderPhotoService } from './order-photo.service';
import type { DtoPhotosShortfall } from './dto/photos-shortfall.dto';

/**
 * Заказ, фотографии которого доехали не все.
 *
 * Файлы грузит браузер клиента: закрыл вкладку, ушёл в другое приложение,
 * потерял сеть — хвост не дошёл. Заявка при этом давно в CRM и показывает
 * полный тираж. Так заказ на 172 отпечатка уезжал в печать с 84 файлами,
 * и выяснялось это у печатника.
 *
 * Сообщить нужно двумя способами сразу: письмом в Telegram — чтобы
 * заметили сегодня, и строкой в примечании — чтобы не забыли через
 * неделю, когда заказ дойдёт до печати.
 */
describe('недогруженные фотографии заказа', () => {
  const dto: DtoPhotosShortfall = {
    uploadId: '54e6fc13-62e9-4b89-9ebe-283c5b442111',
    expected: 172,
    arrived: 84,
  };

  function build(options: {
    order?: { id: string; numberOrder: string; note: string | null } | null;
    updateFails?: boolean;
    alertFails?: boolean;
  }) {
    const updates: { id: string; note: string }[] = [];
    const alerts: string[] = [];
    const queries: unknown[] = [];

    const prisma = {
      orderPhoto: {
        findFirst: async (args: unknown) => {
          queries.push(args);
          return options.order === undefined
            ? { id: 'o1', numberOrder: '20261016-261', note: '🆕 Заявка с сайта' }
            : options.order;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { note: string };
        }) => {
          if (options.updateFails) throw new Error('база недоступна');
          updates.push({ id: where.id, note: data.note });
          return {};
        },
      },
    };

    const telegram = {
      sendLeadAlert: async (text: string) => {
        if (options.alertFails) throw new Error('бот недоступен');
        alerts.push(text);
        return true;
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
    );

    return { service, updates, alerts, queries };
  }

  it('находит заказ по номеру папки — своего номера сайт не знает', async () => {
    const { service, queries } = build({});
    await service.reportPhotosShortfall(dto);
    expect(JSON.stringify(queries[0])).toContain(dto.uploadId);
  });

  it('пишет недобор в примечание и не затирает то, что там было', async () => {
    const { service, updates } = build({});
    await service.reportPhotosShortfall(dto);

    expect(updates).toHaveLength(1);
    expect(updates[0]?.note).toContain('🆕 Заявка с сайта');
    expect(updates[0]?.note).toContain('84 из 172');
  });

  it('сообщает владельцу с номером заказа', async () => {
    const { service, alerts } = build({});
    await service.reportPhotosShortfall(dto);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('20261016-261');
    expect(alerts[0]).toContain('84 из 172');
  });

  it('неизвестная папка не роняет запрос', async () => {
    // Заказ удалили или фотографии подчистили после отгрузки: сообщать
    // не о чем, но и падать с ошибкой наружу незачем.
    const { service, updates, alerts } = build({ order: null });
    await expect(service.reportPhotosShortfall(dto)).resolves.toBeUndefined();
    expect(updates).toEqual([]);
    expect(alerts).toEqual([]);
  });

  it('база не записала примечание — сообщение всё равно уходит', async () => {
    const { service, alerts } = build({ updateFails: true });
    await service.reportPhotosShortfall(dto);
    expect(alerts).toHaveLength(1);
  });

  it('бот молчит — примечание всё равно на месте', async () => {
    const { service, updates } = build({ alertFails: true });
    await expect(service.reportPhotosShortfall(dto)).resolves.toBeUndefined();
    expect(updates).toHaveLength(1);
  });
});
