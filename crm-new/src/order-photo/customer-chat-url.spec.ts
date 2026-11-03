import { EnumCommunication } from 'src/generated/prisma/enums';
import { customerChat } from './customer-chat-url';

/**
 * Ссылка на переписку в сообщении владельцу.
 *
 * Ошибка здесь тихая и обидная: Telegram рисует ссылкой любой href, и
 * владелец видит «открыть переписку», которая никуда не ведёт. Понять это
 * можно только нажав — то есть в тот момент, когда он собирался написать
 * покупателю.
 *
 * Отдельно сторожим Ozon: в поле связи у заказа лежит то ссылка на чат из
 * кабинета, то просто номер отправления, и правило проверки это разрешает
 * (communication-url.ts). Номер адресом быть не может.
 */
describe('ссылка на переписку с покупателем', () => {
  it('Ozon: из ссылки кабинета собирается адрес чата', () => {
    const chat = customerChat({
      communicationPlatform: EnumCommunication.OZON,
      urlCommunication:
        'https://seller.ozon.ru/app/messenger?id=0b5f0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      marketplacePostingNumber: '0189070451-0031-1',
    });
    expect(chat.href).toBe(
      'https://seller.ozon.ru/app/messenger?id=0b5f0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    );
    expect(chat.hint).toBeNull();
  });

  it('Ozon: номер отправления не выдаётся за ссылку', () => {
    // Раньше номер подставлялся в href как есть.
    const chat = customerChat({
      communicationPlatform: EnumCommunication.OZON,
      urlCommunication: '0189070451-0031-1',
      marketplacePostingNumber: '0189070451-0031-1',
    });
    expect(chat.href).toBe('https://seller.ozon.ru/app/messenger');
    expect(chat.hint).toContain('0189070451-0031-1');
  });

  it('Ozon: без ссылки и без номера ведём хотя бы в переписки', () => {
    const chat = customerChat({
      communicationPlatform: EnumCommunication.OZON,
      urlCommunication: '',
      marketplacePostingNumber: null,
    });
    expect(chat.href).toBe('https://seller.ozon.ru/app/messenger');
    expect(chat.hint).toBeNull();
  });

  it('Ozon: чужой домен с похожим именем не принимаем', () => {
    // seller.ozon.ru.example.com — не наш кабинет.
    const chat = customerChat({
      communicationPlatform: EnumCommunication.OZON,
      urlCommunication:
        'https://seller.ozon.ru.example.com/app/messenger?id=0b5f0a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
      marketplacePostingNumber: '0189070451-0031-1',
    });
    expect(chat.href).toBe('https://seller.ozon.ru/app/messenger');
  });

  it('Авито и Telegram: готовый адрес остаётся как есть', () => {
    expect(
      customerChat({
        communicationPlatform: EnumCommunication.AVITO,
        urlCommunication: 'https://www.avito.ru/profile/messenger/channel/u2i-abc',
      }).href,
    ).toBe('https://www.avito.ru/profile/messenger/channel/u2i-abc');

    expect(
      customerChat({
        communicationPlatform: EnumCommunication.TELEGRAM,
        urlCommunication: 'https://t.me/ivan',
      }).href,
    ).toBe('https://t.me/ivan');
  });

  it('не адрес — не ссылка, а подсказка', () => {
    // Телефон в поле связи бывает у MAX и у заказов, заведённых руками.
    const chat = customerChat({
      communicationPlatform: EnumCommunication.MAX,
      urlCommunication: '+7 999 123-45-67',
    });
    expect(chat.href).toBeNull();
    expect(chat.hint).toBe('+7 999 123-45-67');
  });
});
