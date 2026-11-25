import {
  computeAdPerformance,
  economics,
  isAdLead,
  normalizeKeyword,
  type LeadInput,
  type SpendDetailInput,
} from './ad-performance';
import { bareAdId, parseDetailRow } from './direct-spend-detail-sync';

const spend = (p: Partial<SpendDetailInput>): SpendDetailInput => ({
  campaignId: '1',
  campaignName: 'ЕПК',
  adGroupId: '10',
  adGroupName: 'Фото',
  adId: '100',
  criterion: 'печать фото москва -холст',
  spend: 1000,
  clicks: 10,
  ...p,
});
const lead = (p: Partial<LeadInput>): LeadInput => ({
  status: 'SENT',
  productCategory: 'PHOTO',
  margin: 700,
  clientPaidAt: null,
  totalOrder: 1500,
  hasYclid: true,
  utmSource: 'yandex',
  utmMedium: 'cpc',
  utmCampaign: '1',
  utmContent: '100',
  utmTerm: 'печать фото москва',
  ...p,
});

describe('normalizeKeyword', () => {
  it('matches utm_term with the criterion Metrika reports', () => {
    expect(normalizeKeyword('печать фото москва -холст')).toBe(
      'печать фото москва',
    );
    expect(normalizeKeyword('печать%20фото%20москва')).toBe(
      'печать фото москва',
    );
    expect(normalizeKeyword('Печать фотографий в Москве -10х15')).toBe(
      'печать фотографий в москве',
    );
    expect(normalizeKeyword('---autotargeting')).toBe('autotargeting');
    expect(normalizeKeyword('Autotargeting')).toBe('autotargeting');
    expect(normalizeKeyword('футболка с принтом -!своим -со')).toBe(
      'футболка с принтом',
    );
    expect(normalizeKeyword(null)).toBe('');
  });
});

describe('isAdLead', () => {
  it('needs a Direct click tag, not just any utm', () => {
    expect(isAdLead(lead({}))).toBe(true);
    expect(isAdLead(lead({ hasYclid: false }))).toBe(true);
    expect(
      isAdLead(
        lead({ hasYclid: false, utmSource: 'avito', utmMedium: 'referral' }),
      ),
    ).toBe(false);
    expect(
      isAdLead(lead({ hasYclid: false, utmSource: null, utmMedium: null })),
    ).toBe(false);
  });
});

describe('computeAdPerformance', () => {
  it('attributes leads by ad → group and keyword, prices with VAT, SENT counts as paid', () => {
    const r = computeAdPerformance(
      [
        spend({}),
        spend({
          adGroupId: '20',
          adGroupName: 'Холсты',
          adId: '200',
          criterion: 'Autotargeting',
          spend: 500,
        }),
      ],
      [
        lead({}),
        lead({ status: 'NEW', totalOrder: 900 }),
        lead({ status: 'CANCELLED' }),
        lead({ hasYclid: false, utmSource: null, utmMedium: null }),
      ],
    );
    expect(r.totals.spend).toBe(1800);
    expect(r.totals.spendWithoutVat).toBe(1500);
    expect(r.totals.leads).toBe(3);
    expect(r.totals.paidOrders).toBe(1);
    expect(r.totals.revenue).toBe(1500);
    expect(r.totals.costPerLead).toBe(600);
    expect(r.totals.costPerOrder).toBe(1800);
    expect(r.totals.nonAdLeads).toBe(1);
    expect(r.totals.siteLeads).toBe(4);
    const [photo, canvas] = r.campaigns[0].groups;
    expect(photo.name).toBe('Фото');
    expect(photo.leads).toBe(3);
    expect(photo.keywords[0].label).toBe('печать фото москва -холст');
    expect(photo.keywords[0].costPerLead).toBe(400);
    expect(canvas.leads).toBe(0);
    expect(canvas.costPerLead).toBeNull();
    expect(canvas.keywords[0].label).toBe('Автотаргетинг');
  });

  it('keeps leads without ad/keyword visible instead of guessing', () => {
    const r = computeAdPerformance(
      [spend({}), spend({ adGroupId: '20', adId: '200' })],
      [lead({ utmContent: null, utmTerm: null })],
    );
    const unknown = r.campaigns[0].groups.find((g) => g.id === '');
    expect(unknown?.name).toBe('Группа не определена');
    expect(unknown?.keywords[0].label).toBe('Ключ не передан');
    expect(r.totals.adLeadsWithGroup).toBe(0);
    expect(unknown?.costPerLead).toBeNull();
    expect(unknown?.spendShare).toBeNull();
  });

  it('finds the group by keyword when it lives in exactly one group', () => {
    const r = computeAdPerformance(
      [
        spend({}),
        spend({ adGroupId: '20', adId: '200', criterion: 'печать фото' }),
      ],
      [lead({ utmContent: null, utmTerm: 'печать фото' })],
    );
    expect(r.campaigns[0].groups.find((g) => g.id === '20')?.leads).toBe(1);
  });

  it('paid date counts even before the status moves', () => {
    const r = computeAdPerformance(
      [spend({})],
      [lead({ status: 'IN_PROGRESS', clientPaidAt: new Date() })],
    );
    expect(r.totals.paidOrders).toBe(1);
  });
});

describe('Direct spend detail parsing', () => {
  it('strips the ad id prefix to match utm_content', () => {
    expect(bareAdId('M-1919748389799625446')).toBe('1919748389799625446');
    const row = parseDetailRow(
      {
        dimensions: [
          { name: '2026-11-02' },
          { id: '713923503', name: 'ЕПК' },
          { id: '5793382910', name: 'Фотки' },
          { id: 'M-1919749774929306100', name: 'Печать фотографий' },
          { id: '11.0', name: 'Autotargeting' },
        ],
        metrics: [11030.771, 356],
      },
      { from: '2026-11-01', to: '2026-11-25' },
      ['713923503'],
    );
    expect(row).toMatchObject({
      adId: '1919749774929306100',
      adGroupName: 'Фотки',
      criterion: 'Autotargeting',
      clicks: 356,
    });
  });
  it('rejects rows of campaigns outside the allowlist', () => {
    expect(() =>
      parseDetailRow(
        {
          dimensions: [{ name: '2026-11-02' }, { id: '999' }, {}, {}, {}],
          metrics: [1, 1],
        },
        { from: '2026-11-01', to: '2026-11-25' },
        ['713923503'],
      ),
    ).toThrow();
  });
});

describe('economics (контрольный пример ТЗ)', () => {
  it('25 000 расхода, 80 000 выручки, 30 000 себестоимости', () => {
    expect(economics(25000, 80000, 80000 - 30000)).toEqual({
      marginBeforeAds: 50000,
      marginAfterAds: 25000,
      roas: 320,
      spendShare: 31.25,
      romi: 100,
    });
  });
  it('null на нулевом знаменателе и без себестоимости', () => {
    expect(economics(0, 0, null)).toEqual({
      marginBeforeAds: null,
      marginAfterAds: null,
      roas: null,
      spendShare: null,
      romi: null,
    });
  });
});

describe('оплата и маржа как в P&L', () => {
  it('«Отправлен» — оплата у фото, но не у футболок и холстов', () => {
    const r = computeAdPerformance(
      [spend({})],
      [
        lead({}),
        lead({ productCategory: 'TSHIRT' }),
        lead({ productCategory: 'CANVAS' }),
        lead({ productCategory: 'TSHIRT', status: 'PAID', margin: 1600 }),
      ],
    );
    expect(r.totals.paidOrders).toBe(2);
    expect(r.totals.marginBeforeAds).toBe(2300);
    expect(r.totals.marginAfterAds).toBe(2300 - 1200);
  });
  it('заказ без себестоимости в маржу не входит, но число таких заказов видно', () => {
    const r = computeAdPerformance(
      [spend({})],
      [lead({}), lead({ margin: null })],
    );
    expect(r.totals.paidOrders).toBe(2);
    expect(r.totals.marginBeforeAds).toBe(700);
    expect(r.totals.marginAfterAds).toBe(700 - 1200);
    expect(r.totals.paidWithoutCogs).toBe(1);
  });
});
