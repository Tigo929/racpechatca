import { SitePhotosService } from './site-photos.service';

/**
 * Удаление фотографий заказа на сайте.
 *
 * Две опасности, и обе дорогие. Удалить рано — остаться без исходников у
 * заказа, который ещё печатают. Не удалить вовсе — копить чужие файлы на
 * диске, пока он не кончится и приём заявок не встанет. Поэтому решение
 * принимает CRM (она знает статус), а адрес проверяется до запроса:
 * ссылка приходит снаружи, и слать по ней «удали» вслепую нельзя.
 */
describe('адрес удаления фотографий', () => {
  it('папка заказа — наш адрес, подпись отбрасывается', () => {
    expect(
      SitePhotosService.cleanupUrl(
        'https://raspechatkaa.ru/api/leads/archive/session/11111111-2222-4333-8444-555555555555?token=abc',
      ),
    ).toBe(
      'https://raspechatkaa.ru/api/leads/archive/session/11111111-2222-4333-8444-555555555555',
    );
  });

  it('архив старого образца тоже узнаётся', () => {
    expect(
      SitePhotosService.cleanupUrl(
        'https://raspechatkaa.ru/api/leads/archive/lead-11111111-2222-3333.zip?token=abc',
      ),
    ).toBe('https://raspechatkaa.ru/api/leads/archive/lead-11111111-2222-3333.zip');
  });

  it('чужой адрес не принимаем', () => {
    // Ссылка приходит с заявкой: подменив её, можно было бы заставить CRM
    // ходить с нашим секретом куда угодно.
    expect(
      SitePhotosService.cleanupUrl('https://evil.example/api/leads/archive/session/x'),
    ).toBeNull();
    expect(
      SitePhotosService.cleanupUrl(
        'https://raspechatkaa.ru/admin/users?token=abc',
      ),
    ).toBeNull();
    expect(SitePhotosService.cleanupUrl('не ссылка')).toBeNull();
  });
});

describe('удаление по команде CRM', () => {
  const ORDER = 'order-1';
  const URL =
    'https://raspechatkaa.ru/api/leads/archive/session/11111111-2222-4333-8444-555555555555?token=abc';

  function build(fetchImpl: jest.Mock) {
    const update = jest.fn().mockResolvedValue({});
    const service = new SitePhotosService({
      orderPhoto: { update },
    } as never);
    global.fetch = fetchImpl as never;
    return { service, update };
  }

  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.SITE_PHOTOS_CLEANUP_TOKEN;
  });

  it('без секрета не ходит никуда', async () => {
    // На машине разработчика секрета нет — это не повод слать запросы
    // в боевой сайт и тем более ронять смену статуса.
    const fetchMock = jest.fn();
    const { service, update } = build(fetchMock);

    expect(await service.dropForOrder(ORDER, URL)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('удалил — забываем ссылку', async () => {
    process.env.SITE_PHOTOS_CLEANUP_TOKEN = 'secret';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const { service, update } = build(fetchMock);

    expect(await service.dropForOrder(ORDER, URL)).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: ORDER },
      data: { photosArchiveUrl: null },
    });
  });

  it('сайт не ответил — ссылку оставляем, чтобы повторить', async () => {
    // Обнулить ссылку после неудачи значит навсегда забыть про файлы:
    // они останутся на диске, а CRM будет считать, что их нет.
    process.env.SITE_PHOTOS_CLEANUP_TOKEN = 'secret';
    const fetchMock = jest.fn().mockRejectedValue(new Error('сеть'));
    const { service, update } = build(fetchMock);

    expect(await service.dropForOrder(ORDER, URL)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('сайт ответил отказом — тоже повторим позже', async () => {
    process.env.SITE_PHOTOS_CLEANUP_TOKEN = 'secret';
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const { service, update } = build(fetchMock);

    expect(await service.dropForOrder(ORDER, URL)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('секрет уходит заголовком, а не в адресе', async () => {
    // В адресе он попал бы в логи сайта, прокси и истории браузера.
    process.env.SITE_PHOTOS_CLEANUP_TOKEN = 'secret';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const { service } = build(fetchMock);

    await service.dropForOrder(ORDER, URL);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('secret');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>)['x-cleanup-token']).toBe(
      'secret',
    );
  });
});
