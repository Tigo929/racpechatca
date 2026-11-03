import { ReviewReminderService } from './review-reminder.service';

/**
 * Сообщение владельцу о том, что пора просить отзыв.
 *
 * Отправляет просьбу человек: в Telegram первым пишет только живой аккаунт,
 * а на площадке переписка модерируется, и фоновая рассылка там — путь к
 * блокировке. Значит, всё, что нужно для отправки, должно быть в этом
 * сообщении: с кем говорить, по какому поводу и что именно сказать.
 *
 * Сторожим две ошибки, которые видно только в телефоне у владельца.
 * Первая — ссылка в никуда: Telegram рисует ссылкой любой href, и номер
 * отправления, подставленный адресом, выглядел как рабочая ссылка.
 * Вторая — не та дата: у заказа с площадки поводом служит выкуп, у своего —
 * наша отправка, и подписаны они должны быть по-разному.
 */
describe('сообщение «пора попросить отзыв»', () => {
  const service = new ReviewReminderService({} as never, {} as never);
  const render = (order: Record<string, unknown>): string =>
    (
      service as unknown as {
        buildGroupNotification: (o: unknown) => string;
      }
    ).buildGroupNotification(order);

  const marketplace = {
    numberOrder: '20261103-007',
    productCategory: 'TSHIRT',
    sourceOrder: 'OZON',
    sentAt: new Date('2026-10-20T09:00:00.000Z'),
    marketplaceDeliveredAt: new Date('2026-11-03T12:30:00.000Z'),
    marketplacePostingNumber: '0189070451-0031-1',
    communicationPlatform: 'OZON',
  };

  it('у заказа с площадки поводом названа дата выкупа', () => {
    const text = render({
      ...marketplace,
      urlCommunication:
        'https://seller.ozon.ru/app/messenger?id=0b5f0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    });
    expect(text).toContain('Выкуплен:');
    expect(text).not.toContain('Отправлен:');
    expect(text).toContain(
      '<a href="https://seller.ozon.ru/app/messenger?id=0b5f0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b">',
    );
    // Номер отправления нужен и сам по себе: по нему заказ ищут в кабинете.
    expect(text).toContain('<code>0189070451-0031-1</code>');
  });

  it('номер отправления не превращается в ссылку', () => {
    // Так было до 03.11.2026: href="0189070451-0031-1" — нажатие в никуда.
    const text = render({
      ...marketplace,
      urlCommunication: '0189070451-0031-1',
    });
    expect(text).not.toContain('href="0189070451-0031-1"');
    expect(text).toContain('https://seller.ozon.ru/app/messenger');
    expect(text).toContain('найдите чат по отправлению 0189070451-0031-1');
  });

  it('у своего заказа поводом остаётся наша отправка', () => {
    const text = render({
      numberOrder: '20261030-012',
      productCategory: 'PHOTO',
      sourceOrder: 'WEBSITE',
      sentAt: new Date('2026-10-30T07:15:00.000Z'),
      marketplaceDeliveredAt: null,
      marketplacePostingNumber: null,
      communicationPlatform: 'TELEGRAM',
      urlCommunication: 'https://t.me/ivan',
    });
    expect(text).toContain('Отправлен:');
    expect(text).not.toContain('Выкуплен:');
    expect(text).not.toContain('Отправление:');
  });

  it('несёт готовый текст для клиента', () => {
    // Владелец копирует его нажатием — для этого <pre>.
    const text = render({ ...marketplace, urlCommunication: '' });
    expect(text).toContain('<pre>');
    expect(text).toContain('Как вам футболка');
    expect(text).toContain('ozon.ru');
  });
});
