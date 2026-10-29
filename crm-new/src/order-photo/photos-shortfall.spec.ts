import { photosShortfall, withShortfallLine } from './photos-shortfall';

/**
 * Недобор фотографий.
 *
 * Проверяется граница в обе стороны. Пропустить недобор — заказ уедет
 * в печать неполным. Поднять тревогу зря — красной станет половина
 * списка, и на цвет перестанут смотреть вообще.
 */
describe('недобор фотографий', () => {
  it('доехало меньше обещанного — это недобор', () => {
    expect(photosShortfall({ photosExpected: 172, photosArrived: 84 })).toEqual({
      expected: 172,
      arrived: 84,
      missing: 88,
    });
  });

  it('не хватает одного кадра — тоже недобор', () => {
    // Один потерянный снимок стоит ровно столько же: перепечатка заказа.
    expect(photosShortfall({ photosExpected: 40, photosArrived: 39 })?.missing).toBe(1);
  });

  it('всё доехало — тревожить незачем', () => {
    expect(photosShortfall({ photosExpected: 40, photosArrived: 40 })).toBeNull();
  });

  it('доехало больше обещанного — не недобор', () => {
    // Хвост дошёл после отправки заявки: файлов стало больше, чем было
    // названо. Это не потеря.
    expect(photosShortfall({ photosExpected: 10, photosArrived: 12 })).toBeNull();
  });

  it('пустые числа — значит сверять нечего', () => {
    // Фотографии пришли мимо сайта: в переписке, ссылкой на облако.
    expect(photosShortfall({})).toBeNull();
    expect(photosShortfall({ photosExpected: 10 })).toBeNull();
    expect(photosShortfall({ photosArrived: 0 })).toBeNull();
    expect(photosShortfall({ photosExpected: null, photosArrived: null })).toBeNull();
  });

  it('ноль обещанных — не повод краснеть', () => {
    expect(photosShortfall({ photosExpected: 0, photosArrived: 0 })).toBeNull();
  });

  it('ни одного файла из обещанных — самый громкий случай', () => {
    expect(photosShortfall({ photosExpected: 30, photosArrived: 0 })?.missing).toBe(30);
  });

  it('менеджер подтвердил сбор — тревога снята', () => {
    // Остальные снимки пришли в переписке: сервер этого не увидит никогда,
    // и без ручного снятия карточка осталась бы красной навсегда.
    expect(
      photosShortfall({
        photosExpected: 40,
        photosArrived: 12,
        photosResolvedAt: new Date('2026-10-29T10:00:00Z'),
      }),
    ).toBeNull();
  });

  it('подтверждение строкой из JSON тоже считается', () => {
    // С фронта дата приезжает строкой — пустая строка подтверждением не является.
    expect(
      photosShortfall({
        photosExpected: 40,
        photosArrived: 12,
        photosResolvedAt: '2026-10-29T10:00:00.000Z',
      }),
    ).toBeNull();
    expect(
      photosShortfall({ photosExpected: 40, photosArrived: 12, photosResolvedAt: '' }),
    ).not.toBeNull();
  });
});

describe('строка о недоборе в примечании', () => {
  const line = (arrived: number) =>
    `⚠️ Фотографии доехали не все: ${arrived} из 172. Запросите у клиента остальные до печати.`;

  it('дописывается к примечанию, когда её там не было', () => {
    const result = withShortfallLine('🆕 Заявка с сайта\nИмя: Анна', line(84));
    expect(result.hadLine).toBe(false);
    expect(result.text.split('\n')).toEqual([
      '🆕 Заявка с сайта',
      'Имя: Анна',
      line(84),
    ]);
  });

  it('вторая строка не добавляется — прежняя переписывается', () => {
    // Сайт сообщает о папке при каждом изменении числа файлов: без этого
    // примечание превратилось бы в столбик почти одинаковых строк.
    const first = withShortfallLine('Имя: Анна', line(84));
    const second = withShortfallLine(first.text, line(120));
    expect(second.hadLine).toBe(true);
    expect(second.text.split('\n')).toEqual(['Имя: Анна', line(120)]);
  });

  it('строка стоит там же, где стояла, а не уезжает в конец', () => {
    // Ниже неё бывают указания печатнику — их порядок менять незачем.
    const note = ['Имя: Анна', line(84), '📁 Фотографии на Яндекс.Диске: /заказ'].join(
      '\n',
    );
    expect(withShortfallLine(note, line(120)).text.split('\n')[1]).toBe(line(120));
  });

  it('когда всё доехало, строка убирается целиком', () => {
    const note = ['Имя: Анна', line(84), 'Телефон: +7 900'].join('\n');
    expect(withShortfallLine(note, line(172)).without.split('\n')).toEqual([
      'Имя: Анна',
      'Телефон: +7 900',
    ]);
  });

  it('пустое примечание не превращается в пустую первую строку', () => {
    expect(withShortfallLine(null, line(0)).text).toBe(line(0));
    expect(withShortfallLine('', line(0)).without).toBe('');
  });
});
