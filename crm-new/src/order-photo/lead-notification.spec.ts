import {
  buildLeadNotification,
  pickLeadResponders,
  type NotifiableUser,
} from './lead-notification';

const user = (o: Partial<NotifiableUser>): NotifiableUser => ({
  username: 'someone',
  telegramUsername: 'someone_tg',
  role: 'EXECUTOR',
  isActive: true,
  ...o,
});

describe('кого тегать по заявке с сайта', () => {
  it('менеджеров по оформлению — это их работа', () => {
    const tags = pickLeadResponders([
      user({ role: 'ORDER_MANAGER', telegramUsername: 'alena' }),
      user({ role: 'ADMIN', telegramUsername: 'boss' }),
      user({ role: 'EXECUTOR', telegramUsername: 'printer' }),
    ]);
    expect(tags).toEqual(['@alena']);
  });

  it('нет менеджеров — тегаем админов, чтобы заявка не осталась ничьей', () => {
    const tags = pickLeadResponders([
      user({ role: 'ADMIN', telegramUsername: 'boss' }),
      user({ role: 'EXECUTOR', telegramUsername: 'printer' }),
    ]);
    expect(tags).toEqual(['@boss']);
  });

  it('уволенных не тегаем', () => {
    const tags = pickLeadResponders([
      user({ role: 'ORDER_MANAGER', telegramUsername: 'alena', isActive: false }),
      user({ role: 'ADMIN', telegramUsername: 'boss' }),
    ]);
    expect(tags).toEqual(['@boss']);
  });

  it('без telegramUsername тегать некого — по логину CRM Telegram не найдёт', () => {
    expect(
      pickLeadResponders([user({ role: 'ORDER_MANAGER', telegramUsername: null })]),
    ).toEqual([]);
  });

  it('лишнюю собаку в настройках не дублируем', () => {
    expect(
      pickLeadResponders([user({ role: 'ORDER_MANAGER', telegramUsername: '@alena' })]),
    ).toEqual(['@alena']);
  });
});

describe('текст сообщения', () => {
  it('содержит номер заказа, суть и тег в конце', () => {
    const text = buildLeadNotification(
      {
        numberOrder: '20260815-050',
        name: 'Анна',
        productName: 'Фото 10×15',
        quantity: 40,
        total: 400,
        comment: 'Хочу матовые',
      },
      ['@alena'],
    );

    expect(text).toContain('20260815-050');
    expect(text).toContain('Анна');
    expect(text).toContain('40 шт');
    expect(text).toContain('Хочу матовые');
    // Тег в конце — он попадает в превью уведомления.
    expect(text.trim().endsWith('@alena — заявка ваша, ответьте клиенту')).toBe(true);
  });

  it('когда тегать некого — прямо об этом пишем, а не молчим', () => {
    const text = buildLeadNotification({ numberOrder: '20260815-051' }, []);
    expect(text).toContain('Некого тегнуть');
  });

  it('разметка в имени клиента не ломает сообщение', () => {
    const text = buildLeadNotification(
      { numberOrder: '1', name: 'Аня_*зайка*' },
      ['@alena'],
    );
    expect(text).toContain('Аня\\_\\*зайка\\*');
  });
});

/**
 * Владелец должен видеть заявки лично. Менеджеры в приоритете над админами,
 * поэтому без отдельного списка он в тег не попадал вообще — даже заполнив
 * себе Telegram в профиле.
 */
describe('всегда упоминаемые из настроек', () => {
  const alena = {
    username: 'Archangel_Alena0555',
    telegramUsername: 'Archangel_Alena0555',
    role: 'ORDER_MANAGER',
    isActive: true,
  };

  it('владелец идёт первым и не вытесняет менеджера', () => {
    expect(pickLeadResponders([alena], 'gts224')).toEqual([
      '@gts224',
      '@Archangel_Alena0555',
    ]);
  });

  it('собаку можно писать или не писать', () => {
    expect(pickLeadResponders([], '@gts224')).toEqual(['@gts224']);
  });

  it('несколько через запятую или пробел', () => {
    expect(pickLeadResponders([], 'gts224, second  third')).toEqual([
      '@gts224',
      '@second',
      '@third',
    ]);
  });

  it('повтор не даёт двойного тега', () => {
    expect(pickLeadResponders([alena], 'Archangel_Alena0555')).toEqual([
      '@Archangel_Alena0555',
    ]);
  });

  it('пустая настройка ничего не меняет', () => {
    expect(pickLeadResponders([alena], '')).toEqual(['@Archangel_Alena0555']);
  });
});
