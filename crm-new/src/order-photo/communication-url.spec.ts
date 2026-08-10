import { EnumCommunication } from 'src/generated/prisma/enums';
import {
  buildCommunicationUrl,
  buildMaxUrl,
  formatPhoneForDisplay,
  normalizePhone,
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
    expect(buildMaxUrl('79991234567', '   ')).toBe('https://max.ru/79991234567');
  });
});

describe('buildCommunicationUrl', () => {
  it('Telegram: @username → ссылка', () => {
    expect(
      buildCommunicationUrl(EnumCommunication.TELEGRAM, '@ivan'),
    ).toBe('https://t.me/ivan');
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
