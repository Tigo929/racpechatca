import {
  buildYclidConversionsCsv,
  isValidYclid,
  targetFor,
  yclidChannelEnabled,
  yclidTargetsFromEnv,
  YCLID_CONVERSION_HEADER,
} from './metrika-yclid-conversions';

/**
 * Канал офлайн-конверсий по метке клика Директа.
 *
 * Он существует ради заказов, у которых нет ClientID: счётчик грузится
 * только после согласия на cookie, а yclid приходит прямо в адресе и от
 * согласия не зависит. Без этого канала Директ не узнаёт, что его клик
 * закончился оплаченным заказом.
 *
 * Главная защита здесь — выключенность по умолчанию: на общие цели канал
 * дал бы двойной счёт вместе с загрузкой заказов CDP.
 */
describe('канал yclid', () => {
  it('по умолчанию выключен: без целей в настройках наружу ничего не уйдёт', () => {
    const targets = yclidTargetsFromEnv({});
    expect(yclidChannelEnabled(targets)).toBe(false);
    expect(targetFor('PAID', targets)).toBe('');
  });

  it('включается целями из настроек', () => {
    const targets = yclidTargetsFromEnv({
      YANDEX_METRIKA_YCLID_TARGET_PAID: ' crm_paid_ad ',
    });
    expect(yclidChannelEnabled(targets)).toBe(true);
    expect(targetFor('PAID', targets)).toBe('crm_paid_ad');
    // Перехода без своей цели не отправляем, а не подставляем соседнюю.
    expect(targetFor('CANCELLED', targets)).toBe('');
  });

  it('рабочие переходы считаются созданием заказа', () => {
    const targets = {
      CREATED: 'crm_created_ad',
      PAID: 'crm_paid_ad',
      CANCELLED: 'crm_cancel_ad',
    };
    expect(targetFor('IN_PROGRESS', targets)).toBe('crm_created_ad');
    expect(targetFor('PAID', targets)).toBe('crm_paid_ad');
    expect(targetFor('CANCELLED', targets)).toBe('crm_cancel_ad');
  });

  it('метку клика проверяем: мусор не выдаётся за идентификатор', () => {
    expect(isValidYclid('16387464521234567')).toBe(true);
    expect(isValidYclid('ABC-def_123')).toBe(true);
    expect(isValidYclid('нет')).toBe(false);
    expect(isValidYclid('')).toBe(false);
    expect(isValidYclid(null)).toBe(false);
    expect(isValidYclid('x'.repeat(65))).toBe(false);
  });

  it('файл конверсий — официальные колонки и валюта', () => {
    const csv = buildYclidConversionsCsv([
      {
        yclid: '16387464521234567',
        target: 'crm_paid_ad',
        dateTime: 1_757_000_000,
        price: 1500,
      },
    ]);
    const [header, row] = csv.trimEnd().split('\n');
    expect(header).toBe(YCLID_CONVERSION_HEADER.join(','));
    expect(row).toBe('16387464521234567,crm_paid_ad,1757000000,1500,RUB');
  });

  it('персональных данных в файле нет по построению', () => {
    const csv = buildYclidConversionsCsv([
      {
        yclid: '16387464521234567',
        target: 'crm_paid_ad',
        dateTime: 1,
        price: 0,
      },
    ]);
    expect(csv).not.toMatch(/@|\+7|phone|email/i);
  });
});
