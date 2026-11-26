import {
  directReportsConfig,
  fetchSearchQueryReport,
  parseSearchQueryTsv,
} from './direct-search-query-sync';
import { computeSearchQueries } from './ad-search-queries';
import { computeAdPerformance } from './ad-performance';

const range = { from: '2026-11-18', to: '2026-11-24' };
const HEAD =
  'Date\tCampaignId\tAdGroupId\tQuery\tCriterion\tCriterionType\tMatchType\tImpressions\tClicks\tCost';
const config = { token: 't', login: 'l', campaignIds: ['713923503'] };

describe('directReportsConfig', () => {
  it('needs token, login and numeric campaigns', () => {
    expect(directReportsConfig({})).toBeNull();
    expect(
      directReportsConfig({
        YANDEX_DIRECT_REPORTS_TOKEN: 't',
        YANDEX_DIRECT_ANALYTICS_LOGIN: 'l',
        YANDEX_DIRECT_ANALYTICS_CAMPAIGNS: '713923503',
      }),
    ).toEqual(config);
  });
});

describe('parseSearchQueryTsv', () => {
  it('parses rows and merges same query from different ads', () => {
    const tsv = [
      HEAD,
      '2026-11-18\t713923503\t5793378293\tпечать фото\tпечать фото -москва\tKEYWORD\tSYNONYM\t10\t1\t25.50',
      '2026-11-18\t713923503\t5793378293\tпечать фото\tпечать фото -москва\tKEYWORD\tSYNONYM\t5\t1\t20.00',
      '2026-11-19\t713923503\t5793378293\tфото на паспорт\t---autotargeting\tAUTOTARGETING\tNONE\t3\t0\t0',
      '',
    ].join('\n');
    const rows = parseSearchQueryTsv(tsv, range, ['713923503']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      query: 'печать фото',
      impressions: 15,
      clicks: 2,
      spend: 45.5,
    });
    expect(rows[1].criterionType).toBe('AUTOTARGETING');
  });

  it('rejects foreign campaigns, dates and missing columns', () => {
    const row = (d: string, c: string) =>
      `${HEAD}\n${d}\t${c}\t1\tq\tk\tKEYWORD\tNONE\t1\t1\t1`;
    expect(() =>
      parseSearchQueryTsv(row('2026-11-18', '1'), range, ['713923503']),
    ).toThrow();
    expect(() =>
      parseSearchQueryTsv(row('2026-11-30', '713923503'), range, ['713923503']),
    ).toThrow();
    expect(() =>
      parseSearchQueryTsv('Date\tQuery\n', range, ['713923503']),
    ).toThrow(/misses column/);
  });
});

describe('fetchSearchQueryReport', () => {
  const res = (status: number, body = '', retry?: string) => ({
    status,
    headers: { get: (n: string) => (n === 'retryIn' ? (retry ?? null) : null) },
    text: () => Promise.resolve(body),
  });

  it('waits while the report is being built', async () => {
    const answers = [res(201, '', '3'), res(202, '', '2'), res(200, 'TSV')];
    const waits: number[] = [];
    const out = await fetchSearchQueryReport(
      config,
      range,
      () => Promise.resolve(answers.shift()!),
      (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    );
    expect(out).toBe('TSV');
    expect(waits).toEqual([3000, 2000]);
  });

  it('reports API errors without the token', async () => {
    const err = res(
      400,
      JSON.stringify({ error: { error_code: '53', error_detail: 'bad' } }),
    );
    await expect(
      fetchSearchQueryReport(config, range, () => Promise.resolve(err)),
    ).rejects.toThrow('Direct Reports API: HTTP 400 53 bad');
  });
});

describe('computeSearchQueries', () => {
  const perf = computeAdPerformance(
    [
      {
        campaignId: 'c',
        campaignName: 'ЕПК',
        adGroupId: 'g',
        adGroupName: 'Фотки',
        adId: 'a',
        criterion: 'печать фото -москва',
        spend: 100,
        clicks: 4,
      },
      {
        campaignId: 'c',
        campaignName: 'ЕПК',
        adGroupId: 'g',
        adGroupName: 'Фотки',
        adId: 'a',
        criterion: 'Autotargeting',
        spend: 50,
        clicks: 2,
      },
    ],
    [
      {
        status: 'SENT',
        productCategory: 'PHOTO',
        margin: 300,
        clientPaidAt: null,
        totalOrder: 800,
        hasYclid: true,
        utmSource: 'yandex',
        utmMedium: 'cpc',
        utmCampaign: 'c',
        utmContent: 'a',
        utmTerm: 'печать фото',
      },
    ],
  );

  it('attaches keyword leads and sums spend under leadless keywords', () => {
    const block = computeSearchQueries(
      [
        {
          campaignId: 'c',
          adGroupId: 'g',
          query: 'печать фото рядом',
          criterion: 'печать фото -москва',
          matchType: 'SYNONYM',
          impressions: 20,
          clicks: 2,
          spend: 60,
        },
        {
          campaignId: 'c',
          adGroupId: 'g',
          query: 'фото на паспорт',
          criterion: '---autotargeting',
          matchType: 'NONE',
          impressions: 10,
          clicks: 1,
          spend: 50,
        },
        {
          campaignId: 'c',
          adGroupId: 'g',
          query: 'без кликов',
          criterion: '---autotargeting',
          matchType: 'NONE',
          impressions: 5,
          clicks: 0,
          spend: 0,
        },
      ],
      perf,
    );
    expect(block.total).toEqual({
      queries: 3,
      impressions: 35,
      clicks: 3,
      spend: 132,
      spendUnderKeywordsWithoutLeads: 60,
    });
    expect(block.rows.map((r) => r.query)).toEqual([
      'печать фото рядом',
      'фото на паспорт',
    ]);
    expect(block.rows[0]).toMatchObject({
      groupName: 'Фотки',
      keyword: 'печать фото -москва',
      spend: 72,
      ctr: 10,
      keywordLeads: 1,
      keywordPaid: 1,
    });
    expect(block.rows[1]).toMatchObject({
      keyword: 'Автотаргетинг',
      keywordLeads: 0,
    });
  });

  it('limits rows and counts the rest', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      campaignId: 'c',
      adGroupId: 'g',
      query: `q${i}`,
      criterion: 'x',
      matchType: '',
      impressions: 1,
      clicks: 1,
      spend: i + 1,
    }));
    const block = computeSearchQueries(many, perf, 2);
    expect(block.rows.map((r) => r.query)).toEqual(['q4', 'q3']);
    expect(block.hidden).toBe(3);
  });
});
