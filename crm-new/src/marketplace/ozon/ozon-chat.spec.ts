import {
  canCreateChat,
  chatMatchesPosting,
  isPremiumRequired,
  ozonChatUrl,
  postingOrderNumber,
  OZON_CHAT_URL_TEMPLATE,
} from './ozon-chat';

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

describe('какая переписка относится к отправлению', () => {
  it('номер заказа берётся из номера отправления', () => {
    expect(postingOrderNumber('48866017-0495-1')).toBe('48866017-0495');
    expect(postingOrderNumber('0151387649-0013-3')).toBe('0151387649-0013');
  });

  it('узнаёт чат по номеру заказа в контексте сообщения', () => {
    const messages = [
      { data: ['Здравствуйте'], context: { order_number: '48866017-0495' } },
    ];
    expect(chatMatchesPosting(messages, '48866017-0495-1')).toBe(true);
  });

  it('узнаёт чат по номеру отправления первой строкой', () => {
    // В заказном чате Ozon первой строкой кладёт номер отправления,
    // а контекст у части сообщений пуст.
    const messages = [
      { data: ['48866017-0495-1', 'Здравствуйте'], context: { order_number: '' } },
    ];
    expect(chatMatchesPosting(messages, '48866017-0495-1')).toBe(true);
  });

  it('чужая переписка не считается нашей', () => {
    const messages = [
      { data: ['31951196-0222-1'], context: { order_number: '31951196-0222' } },
    ];
    expect(chatMatchesPosting(messages, '48866017-0495-1')).toBe(false);
  });

  it('пустая история ничего не подтверждает', () => {
    expect(chatMatchesPosting([], '48866017-0495-1')).toBe(false);
    expect(chatMatchesPosting(null, '48866017-0495-1')).toBe(false);
    expect(chatMatchesPosting(undefined, '48866017-0495-1')).toBe(false);
  });

  it('без номера отправления не совпадает ни с чем', () => {
    const messages = [{ data: ['что-то'], context: { order_number: '' } }];
    expect(chatMatchesPosting(messages, '')).toBe(false);
  });
});

describe('отказ площадки', () => {
  it('про подписку узнаётся по ответу Ozon', () => {
    // Иначе 403 переводится как «проверьте ключи», а ключ в порядке:
    // им же работают все остальные методы.
    expect(
      isPremiumRequired(
        's.checkPremiumPlus failed: method is allowed starting from the premium plus subscription',
      ),
    ).toBe(true);
  });

  it('обычный отказ по доступам подпиской не называем', () => {
    expect(isPremiumRequired('invalid api key')).toBe(false);
    expect(isPremiumRequired(undefined)).toBe(false);
  });
});
