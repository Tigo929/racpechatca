import {
  buildSimpleOrdersCsv,
  csvEscape,
  formatCounterDateTime,
  isValidTimeZone,
  SIMPLE_ORDERS_HEADER,
  simpleOrderToCsvLine,
  type SimpleOrderRow,
} from './metrika-order-csv';

/**
 * CSV и даты для simple_orders (этап 06, разделы 11–15, 55–57).
 */
const ROW: SimpleOrderRow = {
  id: '3f1c2a9e-0000-4000-8000-000000000001',
  createDateTime: '2026-09-11 18:30:00',
  clientId: '12345678901234567890',
  status: 'PAID',
  revenue: 1500,
  cost: 420,
};

describe('строка заказа', () => {
  it('заголовок — полный официальный, порядок колонок как в документации', () => {
    expect(SIMPLE_ORDERS_HEADER.join(',')).toBe(
      'id,create_date_time,client_uniq_id,client_ids,emails,phones,order_status,revenue,cost,goals,currency',
    );
  });

  it('заполняем только договорённые колонки; почта, телефон, goals — пустые; валюта RUB явно', () => {
    expect(simpleOrderToCsvLine(ROW)).toBe(
      '3f1c2a9e-0000-4000-8000-000000000001,2026-09-11 18:30:00,,12345678901234567890,,,PAID,1500,420,,RUB',
    );
  });

  it('ClientID на 20 цифр остаётся точной строкой — в number не превращается', () => {
    const line = simpleOrderToCsvLine(ROW);
    expect(line.split(',')[3]).toBe('12345678901234567890');
    // Для сравнения: через number эти цифры уже не пройдут.
    expect(String(Number('12345678901234567890'))).not.toBe('12345678901234567890');
  });

  it('неизвестная себестоимость — пустая колонка, а не 0', () => {
    const line = simpleOrderToCsvLine({ ...ROW, cost: null });
    expect(line.split(',')[8]).toBe('');
  });

  it('файл: заголовок, строки, \\n в конце', () => {
    const csv = buildSimpleOrdersCsv([ROW]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(SIMPLE_ORDERS_HEADER.join(','));
    expect(lines[2]).toBe('');
  });
});

describe('экранирование', () => {
  it('запятая, кавычки, переводы строк — в кавычках, кавычка удваивается; пустое — пустое', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('')).toBe('');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('x\r\ny')).toBe('"x\r\ny"');
  });

  it('экранирование применяется к каждой ячейке строки заказа', () => {
    const line = simpleOrderToCsvLine({ ...ROW, id: 'id,with,"commas"' });
    expect(line.startsWith('"id,with,""commas""",')).toBe(true);
  });
});

describe('дата в часовом поясе счётчика', () => {
  const utc = new Date('2026-01-15T21:30:05Z');

  it('формат yyyy-MM-dd HH:mm:ss, перевод из UTC в пояс счётчика', () => {
    expect(formatCounterDateTime(utc, 'Europe/Moscow')).toBe('2026-01-16 00:30:05');
    expect(formatCounterDateTime(utc, 'UTC')).toBe('2026-01-15 21:30:05');
    expect(formatCounterDateTime(utc, 'Asia/Yekaterinburg')).toBe('2026-01-16 02:30:05');
  });

  it('пояс с летним временем: зимой и летом смещение разное — Intl считает сам', () => {
    expect(formatCounterDateTime(new Date('2026-01-15T12:00:00Z'), 'Europe/Berlin')).toBe(
      '2026-01-15 13:00:00',
    );
    expect(formatCounterDateTime(new Date('2026-07-15T12:00:00Z'), 'Europe/Berlin')).toBe(
      '2026-07-15 14:00:00',
    );
  });

  it('полночь — 00, не 24 (hourCycle h23)', () => {
    expect(formatCounterDateTime(new Date('2026-03-01T00:00:00Z'), 'UTC')).toBe(
      '2026-03-01 00:00:00',
    );
  });

  it('детерминированность: один момент и пояс — всегда одна строка', () => {
    const a = formatCounterDateTime(utc, 'Europe/Moscow');
    const b = formatCounterDateTime(new Date(utc.getTime()), 'Europe/Moscow');
    expect(a).toBe(b);
  });

  it('проверка имени пояса: IANA принимается, мусор — нет', () => {
    expect(isValidTimeZone('Europe/Moscow')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
