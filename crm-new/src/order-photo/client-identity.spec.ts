import {
  alreadyAskedIdentities,
  clientIdentity,
  skipAlreadyAsked,
} from './client-identity';

/**
 * Опознание клиента между заказами. Отзыв закреплён за человеком, а не за
 * покупкой: один раз спросили — больше не спрашиваем, сколько бы он ни
 * заказывал потом.
 */
describe('кто перед нами — один и тот же клиент', () => {
  it('ник в Telegram узнаётся и ссылкой, и собакой, и в любом регистре', () => {
    const key = 'tg:ivanov';
    expect(
      clientIdentity({
        communicationPlatform: 'TELEGRAM',
        urlCommunication: 'https://t.me/Ivanov',
      }),
    ).toBe(key);
    expect(
      clientIdentity({
        communicationPlatform: 'OZON',
        urlCommunication: 'https://seller.ozon.ru/chat/42',
        clientTelegram: '@ivanov',
      }),
    ).toBe(key);
  });

  it('покупатель с площадки, написавший в Telegram, — тот же человек', () => {
    // Он купил на Ozon, а до этого заказывал с сайта. Ник один.
    const site = clientIdentity({
      communicationPlatform: 'TELEGRAM',
      urlCommunication: 'https://t.me/petrova',
    });
    const ozon = clientIdentity({
      communicationPlatform: 'OZON',
      urlCommunication: 'https://seller.ozon.ru/chat/777',
      clientTelegram: 'petrova',
    });
    expect(ozon).toBe(site);
  });

  it('номер в MAX сводится к одному виду: 8… и +7… — один человек', () => {
    const a = clientIdentity({
      communicationPlatform: 'MAX',
      urlCommunication: 'https://max.ru/89990001122',
    });
    const b = clientIdentity({
      communicationPlatform: 'MAX',
      urlCommunication: 'https://max.ru/+7 999 000-11-22',
    });
    expect(a).toBe('max:79990001122');
    expect(b).toBe(a);
  });

  it('покупателя Ozon без Telegram опознать нечем — и мы это признаём', () => {
    // Ссылка на чат своя у каждого отправления, идентификатора покупателя
    // площадка не отдаёт. Ключа нет — заказ остаётся сам по себе.
    expect(
      clientIdentity({
        communicationPlatform: 'OZON',
        urlCommunication: 'https://seller.ozon.ru/chat/12345',
      }),
    ).toBeNull();
  });
});

describe('повторная просьба об отзыве', () => {
  const past = [
    {
      communicationPlatform: 'TELEGRAM',
      urlCommunication: 'https://t.me/ivanov',
      clientReviewLeft: true,
      reviewRequestSentAt: null,
    },
    {
      communicationPlatform: 'MAX',
      urlCommunication: 'https://max.ru/89990001122',
      clientReviewLeft: false,
      reviewRequestSentAt: new Date('2026-10-01T10:00:00Z'),
    },
    {
      // Заказ, по которому ничего не было: он никого не закрывает.
      communicationPlatform: 'TELEGRAM',
      urlCommunication: 'https://t.me/novikov',
      clientReviewLeft: false,
      reviewRequestSentAt: null,
    },
  ];

  it('клиент, оставивший отзыв, второй просьбы не получает', () => {
    const asked = alreadyAskedIdentities(past);
    const candidates = [
      {
        id: 'repeat',
        communicationPlatform: 'TELEGRAM',
        urlCommunication: 'https://t.me/ivanov',
      },
      {
        id: 'new',
        communicationPlatform: 'TELEGRAM',
        urlCommunication: 'https://t.me/novikov',
      },
    ];
    expect(skipAlreadyAsked(candidates, asked).map((o) => o.id)).toEqual([
      'new',
    ]);
  });

  it('прочитал и не написал — тоже повод больше не напоминать', () => {
    // Просьба уходила, отзыва нет. Это его право, и напоминать при
    // следующей покупке не нужно.
    const asked = alreadyAskedIdentities(past);
    const again = skipAlreadyAsked(
      [
        {
          id: 'max-repeat',
          communicationPlatform: 'MAX',
          urlCommunication: 'https://max.ru/+79990001122',
        },
      ],
      asked,
    );
    expect(again).toHaveLength(0);
  });

  it('заказ без опознаваемого клиента проходит как раньше', () => {
    // Покупатель Ozon без Telegram: ключа нет, и правило его не трогает —
    // иначе мы молча перестали бы спрашивать отзывы на площадке вообще.
    const asked = alreadyAskedIdentities(past);
    const ozon = [
      {
        id: 'ozon',
        communicationPlatform: 'OZON',
        urlCommunication: 'https://seller.ozon.ru/chat/5',
      },
    ];
    expect(skipAlreadyAsked(ozon, asked)).toHaveLength(1);
  });
});
