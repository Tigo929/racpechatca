import { parseNoteAttribution } from './note-attribution';

/**
 * Разбор примечания заказа. Форматы — из приёма заявки с сайта, как они
 * реально лежат в базе (см. комментарий модуля).
 */
describe('атрибуция из note', () => {
  const note = [
    '🆕 Заявка с сайта',
    '💬 Клиент просит: побыстрее, пожалуйста',
    'ID заявки: web-photo-0123456789abcdef0123456789abcdef',
    'Имя: Тест',
    'Телефон: +7 900 000-00-00',
    'Товар: Фото 10×15 с полями',
    'Slug: foto-10x15-s-polyami',
    'Тираж: 50 шт',
    'yclid: 1133445566778899001',
    'Yandex ClientID: 17841234567890123456',
    'Страница: https://raspechatkaa.ru/catalog/foto-10x15-s-polyami?utm_source=yandex',
    'Отправлено на сайте: 2026-09-02T10:08:12.142Z',
  ].join('\n');

  it('все три значения из настоящего примечания', () => {
    expect(parseNoteAttribution(note)).toEqual({
      yandexClientId: '17841234567890123456',
      yclid: '1133445566778899001',
      conversionPageUrl:
        'https://raspechatkaa.ru/catalog/foto-10x15-s-polyami?utm_source=yandex',
      failures: [],
    });
  });

  it('только ClientID — остальное null, без ошибок', () => {
    const r = parseNoteAttribution('Имя: Тест\nYandex ClientID: 1234567890\nТовар: Холст');
    expect(r.yandexClientId).toBe('1234567890');
    expect(r.yclid).toBeNull();
    expect(r.conversionPageUrl).toBeNull();
    expect(r.failures).toEqual([]);
  });

  it('пусто и произвольный текст — всё null', () => {
    expect(parseNoteAttribution(null).yandexClientId).toBeNull();
    expect(parseNoteAttribution('').yclid).toBeNull();
    const r = parseNoteAttribution('Клиент просил перезвонить после 18:00. Страница в паспорте 5.');
    expect(r).toEqual({ yandexClientId: null, yclid: null, conversionPageUrl: null, failures: [] });
  });

  it('лишние пробелы и CRLF не мешают', () => {
    const r = parseNoteAttribution('  Yandex ClientID:   555555555  \r\nyclid:\t777777777\r\n');
    expect(r.yandexClientId).toBe('555555555');
    expect(r.yclid).toBe('777777777');
  });

  it('маркер не в начале строки — не значение', () => {
    // Менеджер дописал в примечание фразу с тем же словом.
    const r = parseNoteAttribution('Клиент спрашивал, что такое Yandex ClientID: объяснил');
    expect(r.yandexClientId).toBeNull();
    expect(r.failures).toEqual([]);
  });

  it('повреждённое значение — ошибка разбора, а не данные', () => {
    const r = parseNoteAttribution(
      'Yandex ClientID: не_число\nyclid: 12 34\nСтраница: raspechatkaa.ru/holst',
    );
    expect(r.yandexClientId).toBeNull();
    expect(r.yclid).toBeNull();
    expect(r.conversionPageUrl).toBeNull();
    expect(r.failures.sort()).toEqual(['conversionPageUrl', 'yandexClientId', 'yclid']);
  });

  it('несколько маркеров — берётся первый', () => {
    const r = parseNoteAttribution('Yandex ClientID: 111111111\nYandex ClientID: 222222222');
    expect(r.yandexClientId).toBe('111111111');
  });

  it('страница без http — не адрес', () => {
    expect(parseNoteAttribution('Страница: /interer/holst').conversionPageUrl).toBeNull();
  });
});
