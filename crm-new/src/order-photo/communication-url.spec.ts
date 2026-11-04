import { EnumCommunication } from 'src/generated/prisma/enums';
import {
  buildCommunicationUrl,
  buildMaxUrl,
  formatPhoneForDisplay,
  normalizePhone,
  validateCommunicationValue,
} from './communication-url';

describe('normalizePhone', () => {
  it('принимает то, как номер реально пишут', () => {
    expect(normalizePhone('+7 999 123-45-67')).toBe('79991234567');
    expect(normalizePhone('8 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone('79991234567')).toBe('79991234567');
    expect(normalizePhone('9991234567')).toBe('79991234567');
  });

  it('не выдаёт номер за мусор', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('@username')).toBeNull();
  });
});

describe('formatPhoneForDisplay', () => {
  it('человекочитаемый вид', () => {
    expect(formatPhoneForDisplay('79991234567')).toBe('+7 999 123-45-67');
  });
});

describe('buildMaxUrl', () => {
  it('подставляет телефон в шаблон', () => {
    expect(buildMaxUrl('79991234567', 'https://max.ru/{phone}')).toBe(
      'https://max.ru/79991234567',
    );
    expect(buildMaxUrl('79991234567', 'https://max.ru/{phone_plus}')).toBe(
      'https://max.ru/+79991234567',
    );
  });

  it('пустой шаблон — падаем на значение по умолчанию', () => {
    expect(buildMaxUrl('79991234567', '   ')).toBe(
      'https://max.ru/79991234567',
    );
  });
});

describe('buildCommunicationUrl', () => {
  it('Telegram: @username → ссылка', () => {
    expect(buildCommunicationUrl(EnumCommunication.TELEGRAM, '@ivan')).toBe(
      'https://t.me/ivan',
    );
  });

  it('MAX: телефон → ссылка по шаблону', () => {
    expect(
      buildCommunicationUrl(
        EnumCommunication.MAX,
        '+7 999 123-45-67',
        'https://max.ru/{phone}',
      ),
    ).toBe('https://max.ru/79991234567');
  });

  it('MAX: готовую ссылку не трогаем', () => {
    const url = 'https://max.ru/u/some-id';
    expect(buildCommunicationUrl(EnumCommunication.MAX, url)).toBe(url);
  });

  it('Авито: ссылка сохраняется как есть', () => {
    const url = 'https://www.avito.ru/messenger/123';
    expect(buildCommunicationUrl(EnumCommunication.AVITO, url)).toBe(url);
  });
});

describe('contact validation shared by create and edit', () => {
  it('accepts Telegram handles and stored Telegram links', () => {
    expect(
      validateCommunicationValue(EnumCommunication.TELEGRAM, '@client'),
    ).toBeNull();
    expect(
      validateCommunicationValue(
        EnumCommunication.TELEGRAM,
        'https://t.me/client',
      ),
    ).toBeNull();
    expect(
      validateCommunicationValue(EnumCommunication.TELEGRAM, '@'),
    ).not.toBeNull();
    expect(
      validateCommunicationValue(
        EnumCommunication.TELEGRAM,
        'https://example.com/client',
      ),
    ).not.toBeNull();
  });
  it('rejects empty contacts and executable links', () => {
    expect(
      validateCommunicationValue(EnumCommunication.AVITO, ''),
    ).not.toBeNull();
    expect(
      validateCommunicationValue(EnumCommunication.OZON, 'javascript:alert(1)'),
    ).not.toBeNull();
  });

  it('принимает номер отправления как контакт заказа с Ozon', () => {
    // Переписки по заказу на Ozon не существует: покупатель пишет
    // в кабинет, ссылки на конкретный чат нет. Контактом служит номер
    // отправления — по нему заказ находят в кабинете. Без этого заказ,
    // заведённый из кабинета, вообще нельзя было создать.
    for (const posting of [
      '0189070451-0031-1',
      '48912345-0031',
      '12345678',
    ]) {
      expect(
        validateCommunicationValue(EnumCommunication.OZON, posting),
      ).toBeNull();
    }
  });

  it('не принимает под видом номера отправления что попало', () => {
    for (const bad of [
      'отправление 0189070451',
      'javascript:alert(1)',
      '123',
      '0189070451-',
    ]) {
      expect(
        validateCommunicationValue(EnumCommunication.OZON, bad),
      ).not.toBeNull();
    }
  });

  it('ссылка на кабинет Ozon по-прежнему годится', () => {
    expect(
      validateCommunicationValue(
        EnumCommunication.OZON,
        'https://seller.ozon.ru/app/fbs',
      ),
    ).toBeNull();
  });

  it('Авито без ссылки не принимается: там переписка есть', () => {
    expect(
      validateCommunicationValue(EnumCommunication.AVITO, '0189070451-0031-1'),
    ).not.toBeNull();
  });

  it('MAX принимает ссылку на переписку — как Авито', () => {
    for (const url of [
      'https://max.ru/u/abc123',
      'https://web.max.ru/chat/42',
      // Старая, собранная из телефона: по ней заведены прежние заказы,
      // и отбивать её при правке карточки нельзя.
      'https://max.ru/79991234567',
    ]) {
      expect(validateCommunicationValue(EnumCommunication.MAX, url)).toBeNull();
    }
  });

  it('MAX не принимает телефон и говорит, что делать', () => {
    /*
      Из телефона мы собирали `max.ru/<номер>`. Ссылка выглядела рабочей,
      но вела на профиль по номеру, а не в переписку по заказу — менеджер
      всё равно открывал MAX и искал диалог руками. Теперь контакт — адрес
      самого диалога, а телефон отбивается с подсказкой.
    */
    const error = validateCommunicationValue(
      EnumCommunication.MAX,
      '+7 999 123-45-67',
    );
    expect(error).not.toBeNull();
    expect(error).toContain('ссылка на переписку');
    expect(error).toContain('скопируйте адрес');
  });

  it('телефон из заявки с сайта по-прежнему превращается в ссылку', () => {
    // На сайте клиент оставляет номер, и другого контакта у нас нет:
    // ссылку собираем мы, по шаблону из настроек.
    expect(
      buildCommunicationUrl(EnumCommunication.MAX, '+7 999 123-45-67'),
    ).toBe('https://max.ru/79991234567');
  });
});
