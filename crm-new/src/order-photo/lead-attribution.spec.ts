import { attributionFromLead } from './lead-attribution';

/**
 * Атрибуция заявки → колонки заказа.
 *
 * Сторож на две вещи: ни одно из восьми полей не теряется по дороге
 * (utm_content и utm_term пропадали именно так — принимались и никуда
 * не писались), и отсутствие атрибуции даёт честные null, а не пустые
 * строки, по которым потом нельзя отличить «не было» от «было пустое».
 */
describe('атрибуция заявки с сайта', () => {
  it('сценарий A: полная атрибуция доходит до всех девяти полей', () => {
    // pageUrl — страница, на которой отправлена заявка; в колонку она
    // ложится под именем conversionPageUrl. Страница входа — не она.
    expect(
      attributionFromLead({
        yandexClientId: '1741367582193847',
        yclid: '1234567890123456789',
        utmSource: 'yandex',
        utmMedium: 'cpc',
        utmCampaign: 'holst-msk',
        utmContent: 'banner-1',
        utmTerm: 'печать на холсте',
        pageUrl: 'https://raspechatkaa.ru/interer/holst?utm_source=yandex',
        firstTouchUrl: 'https://raspechatkaa.ru/?utm_source=yandex&utm_medium=cpc',
      }),
    ).toEqual({
      yandexClientId: '1741367582193847',
      yclid: '1234567890123456789',
      utmSource: 'yandex',
      utmMedium: 'cpc',
      utmCampaign: 'holst-msk',
      utmContent: 'banner-1',
      utmTerm: 'печать на холсте',
      conversionPageUrl: 'https://raspechatkaa.ru/interer/holst?utm_source=yandex',
      firstTouchUrl: 'https://raspechatkaa.ru/?utm_source=yandex&utm_medium=cpc',
    });
  });

  it('сценарий B: без атрибуции — все поля null, заявка не ломается', () => {
    expect(attributionFromLead({})).toEqual({
      yandexClientId: null,
      yclid: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      conversionPageUrl: null,
      firstTouchUrl: null,
    });
  });

  it('пустые строки и пробелы — это отсутствие, а не значение', () => {
    const result = attributionFromLead({
      yandexClientId: '   ',
      yclid: '',
      utmSource: '  yandex  ',
      utmMedium: null,
      pageUrl: undefined,
    });
    expect(result.yandexClientId).toBeNull();
    expect(result.yclid).toBeNull();
    expect(result.utmSource).toBe('yandex');
    expect(result.utmMedium).toBeNull();
    expect(result.conversionPageUrl).toBeNull();
  });

  it('идентификаторы остаются строками — числовой ClientID не округляется', () => {
    // 17 значащих цифр: в number такое уже не влезает без потери точности.
    const id = '17413675821938471';
    expect(attributionFromLead({ yandexClientId: id }).yandexClientId).toBe(id);
  });

  it('частичная атрибуция: что пришло — сохранено, остальное null', () => {
    const result = attributionFromLead({ yclid: 'abc', utmTerm: 'фото 10x15' });
    expect(result.yclid).toBe('abc');
    expect(result.utmTerm).toBe('фото 10x15');
    expect(result.utmSource).toBeNull();
    expect(result.yandexClientId).toBeNull();
  });
});
