import { computeSpendMetrics, sumAdSpend, type AdSpendRow } from './ad-spend';
import { parseSpendCsv, parseMoney, parseSpendDate } from './ad-spend-import';

/**
 * Экономика рекламы.
 *
 * Здесь проверяется не арифметика деления, а два правила, ради которых всё
 * и сделано: рекламе приписываются только заказы сайта, и окупаемость не
 * показывается, пока связь «клик → заказ» не доказана на большинстве
 * заказов. Красивый ROAS при покрытии в треть — это решение о бюджете,
 * принятое по выдуманному числу.
 */

const row = (over: Partial<AdSpendRow> = {}): AdSpendRow => ({
  date: '2026-09-01',
  source: 'YANDEX_DIRECT',
  campaignId: '123',
  campaignName: 'Фотопечать',
  spend: 1000,
  clicks: 100,
  impressions: 5000,
  ...over,
});

const outcome = (
  over: Partial<Parameters<typeof computeSpendMetrics>[1]> = {},
) => ({
  siteLeads: 20,
  acceptedOrders: 10,
  paidOrders: 5,
  revenue: 50_000,
  grossProfit: 30_000,
  identityCoveragePct: 80,
  ...over,
});

describe('сводка расходов', () => {
  it('складывает деньги, клики и показы, считает дни и кампании', () => {
    const totals = sumAdSpend([
      row(),
      row({ date: '2026-09-02', spend: 500, clicks: 40, impressions: 2000 }),
      row({ date: '2026-09-02', campaignId: '456', spend: 300 }),
    ]);
    expect(totals).toEqual({
      spend: 1800,
      clicks: 240,
      impressions: 12_000,
      days: 2,
      campaigns: 2,
    });
  });
});

describe('окупаемость', () => {
  it('считает цену заявки, заказа и оплаты', () => {
    const m = computeSpendMetrics(
      sumAdSpend([row({ spend: 10_000 })]),
      outcome(),
    );
    expect(m.status).toBe('AVAILABLE');
    expect(m.cpl).toBe(500); // 10 000 / 20 заявок
    expect(m.cpa).toBe(1000); // 10 000 / 10 принятых
    expect(m.cpo).toBe(2000); // 10 000 / 5 оплаченных
    expect(m.roas).toBe(5); // 50 000 выручки на 10 000 расхода
    expect(m.romi).toBe(2); // (30 000 − 10 000) / 10 000
  });

  it('без расходов — статус, а не нули: ноль читается как «реклама бесплатна»', () => {
    const m = computeSpendMetrics(sumAdSpend([]), outcome());
    expect(m.status).toBe('UNAVAILABLE_NO_SPEND_DATA');
    expect(m.cpl).toBeNull();
    expect(m.roas).toBeNull();
    expect(m.attributionReliable).toBe(false);
  });

  it('покрытие атрибуции ниже половины — цена заявки есть, окупаемости нет', () => {
    const m = computeSpendMetrics(
      sumAdSpend([row({ spend: 10_000 })]),
      outcome({ identityCoveragePct: 30 }),
    );
    expect(m.status).toBe('ATTRIBUTION_COVERAGE_TOO_LOW');
    // Деньги потрачены и заявки пришли — это измерено.
    expect(m.cpl).toBe(500);
    // А вот что из выручки принесла реклама — не доказано.
    expect(m.roas).toBeNull();
    expect(m.romi).toBeNull();
    expect(m.attributionReliable).toBe(false);
  });

  it('расход без результата виден, а не прячется', () => {
    const m = computeSpendMetrics(
      sumAdSpend([row({ spend: 7000 })]),
      outcome({
        siteLeads: 0,
        acceptedOrders: 0,
        paidOrders: 0,
        revenue: 0,
        grossProfit: 0,
      }),
    );
    expect(m.spend).toBe(7000);
    expect(m.cpl).toBeNull(); // делить на ноль заявок нечем
    expect(m.roas).toBe(0);
  });
});

describe('разбор выгрузки кабинета', () => {
  it('понимает русский заголовок, точку с запятой и запятую в числах', () => {
    const csv = [
      'Дата;Кампания;№ кампании;Показы;Клики;Расход (руб.)',
      '24.09.2026;Фотопечать;123;5 000;100;1 234,56',
      '25.09.2026;Фотопечать;123;4 000;80;987,00',
    ].join('\n');
    const { rows, errors } = parseSpendCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        date: '2026-09-24',
        campaignId: '123',
        campaignName: 'Фотопечать',
        spend: 1235,
        clicks: 100,
        impressions: 5000,
      },
      {
        date: '2026-09-25',
        campaignId: '123',
        campaignName: 'Фотопечать',
        spend: 987,
        clicks: 80,
        impressions: 4000,
      },
    ]);
  });

  it('понимает английский заголовок и ISO-даты', () => {
    const csv = 'date,campaignId,cost,clicks\n2026-09-24,777,1500,42';
    const { rows } = parseSpendCsv(csv);
    expect(rows[0]).toMatchObject({
      date: '2026-09-24',
      campaignId: '777',
      spend: 1500,
    });
  });

  it('разбивку глубже дня схлопывает, иначе расход занизится', () => {
    // Кабинет умеет отдавать строки по объявлениям: три строки одного дня
    // и одной кампании — это один расход, а не три конкурирующих.
    const csv = [
      'date,campaignId,cost,clicks',
      '2026-09-24,1,100,10',
      '2026-09-24,1,200,20',
      '2026-09-24,2,50,5',
    ].join('\n');
    const { rows } = parseSpendCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ campaignId: '1', spend: 300, clicks: 30 });
  });

  it('непонятная строка не роняет импорт, а попадает в ошибки с номером', () => {
    const csv = 'date,cost\n2026-09-24,1000\nвчера,много\n2026-09-25,500';
    const { rows, errors } = parseSpendCsv(csv);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(3);
    expect(errors[0]?.reason).toMatch(/дата/);
  });

  it('файл без нужных колонок отвергается целиком с объяснением', () => {
    const { rows, errors } = parseSpendCsv('foo,bar\n1,2');
    expect(rows).toEqual([]);
    expect(errors[0]?.reason).toMatch(/даты и расхода/);
  });

  it('форматы чисел и дат', () => {
    expect(parseMoney('1 234,56')).toBe(1235);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('нет')).toBeNull();
    expect(parseSpendDate('24/09/2026')).toBe('2026-09-24');
    expect(parseSpendDate('2026-09-24 00:00:00')).toBe('2026-09-24');
    expect(parseSpendDate('позавчера')).toBeNull();
  });
});
