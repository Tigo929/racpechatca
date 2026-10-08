import { canCreateChat, ozonChatUrl, OZON_CHAT_URL_TEMPLATE } from './ozon-chat';

/**
 * Ссылка на чат с покупателем.
 *
 * Эта ссылка уходит в заказ и оттуда — в просьбу об отзыве клиенту.
 * Поэтому собранный «почти адрес» хуже его отсутствия: оператор пойдёт
 * по нему в пустоту, а клиент получит нерабочую ссылку.
 */
describe('адрес чата Ozon', () => {
  it('собирается из идентификатора по шаблону', () => {
    expect(ozonChatUrl('232582ce-8a39-45ed-931c-c979850aed65')).toBe(
      'https://seller.ozon.ru/app/chat/232582ce-8a39-45ed-931c-c979850aed65',
    );
  });

  it('шаблон можно заменить, не трогая код', () => {
    // Документация адрес кабинета не описывает — если он изменится, правка
    // должна стоить настройки, а не релиза.
    expect(
      ozonChatUrl('232582ce-8a39-45ed-931c-c979850aed65', 'https://x.ru/c/{chatId}'),
    ).toBe('https://x.ru/c/232582ce-8a39-45ed-931c-c979850aed65');
  });

  it('шаблон без места под идентификатор не превращает ссылку в обрубок', () => {
    expect(ozonChatUrl('232582ce-8a39-45ed-931c-c979850aed65', 'https://x.ru/c')).toBe(
      OZON_CHAT_URL_TEMPLATE.replace(
        '{chatId}',
        '232582ce-8a39-45ed-931c-c979850aed65',
      ),
    );
  });

  it('без идентификатора ссылки нет', () => {
    expect(ozonChatUrl(null)).toBeNull();
    expect(ozonChatUrl(undefined)).toBeNull();
    expect(ozonChatUrl('   ')).toBeNull();
  });

  it('чужая строка в адрес не подставляется', () => {
    // Идентификатор уходит прямо в ссылку: всё, что не похоже на uuid,
    // отбрасываем, иначе в адресе окажется что угодно.
    expect(ozonChatUrl('../../admin')).toBeNull();
    expect(ozonChatUrl('abc')).toBeNull();
    expect(ozonChatUrl('<script>alert(1)</script>')).toBeNull();
  });
});

describe('можно ли открыть чат по отправлению', () => {
  it('площадка перечисляет действия сама', () => {
    expect(canCreateChat(['can_create_chat', 'ship'])).toBe(true);
    expect(canCreateChat(['ship'])).toBe(false);
  });

  it('действий нет — чат не предлагаем', () => {
    expect(canCreateChat(null)).toBe(false);
    expect(canCreateChat(undefined)).toBe(false);
    expect(canCreateChat([])).toBe(false);
  });
});
