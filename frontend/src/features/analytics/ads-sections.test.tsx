import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdsTab } from './ads-sections';
import type { AdPerformance, AdStats } from '../../types/ads';

const s = (p: Partial<AdStats>): AdStats => ({
  spend: 0,
  clicks: 0,
  leads: 0,
  paidOrders: 0,
  cancelled: 0,
  revenue: 0,
  costPerLead: null,
  costPerOrder: null,
  spendShare: null,
  roas: null,
  marginBeforeAds: null,
  marginAfterAds: null,
  romi: null,
  paidWithoutCogs: 0,
  ...p,
});

const photo = s({ spend: 10000, leads: 10, paidOrders: 8, revenue: 30000, spendShare: 33.3, marginBeforeAds: 16000, marginAfterAds: 6000, romi: 60 });
const canvas = s({ spend: 3000, leads: 1, paidOrders: 1, revenue: 2000, spendShare: 150, marginBeforeAds: 900, marginAfterAds: -2100, romi: -70 });

const data: AdPerformance = {
  period: { from: '2026-11-01', to: '2026-11-25' },
  spendDays: 25,
  spendLastDate: '2026-11-25',
  totals: {
    ...s({ spend: 15000, clicks: 300, leads: 11, paidOrders: 9, revenue: 32000, costPerLead: 1364, costPerOrder: 1667, spendShare: 46.9, marginBeforeAds: 16900, marginAfterAds: 1900, romi: 12.7 }),
    spendWithoutVat: 12500,
    siteLeads: 20,
    nonAdLeads: 9,
    adLeadsWithKeyword: 10,
    adLeadsWithGroup: 11,
  },
  campaigns: [
    {
      id: '1',
      name: 'ЕПК',
      ...s({ spend: 15000, leads: 11, paidOrders: 9, revenue: 32000, marginAfterAds: 1900, romi: 12.7 }),
      groups: [
        { id: '10', name: 'Фотки', ...photo, keywords: [{ key: 'печать фото', label: 'печать фото', ...photo }] },
        { id: '20', name: 'Холсты', ...canvas, keywords: [{ key: 'autotargeting', label: 'Автотаргетинг', ...canvas }] },
        { id: '30', name: 'футболки', ...s({ spend: 2000 }), keywords: [{ key: 'x', label: 'футболка', ...s({ spend: 2000 }) }] },
      ],
    },
  ],
  quality: {
    spendLastDate: '2026-11-25',
    spendDays: 25,
    periodDays: 25,
    metrikaSyncedAt: new Date().toISOString(),
    siteLeads: 20,
    adLeads: 11,
    leadsClientIdOnly: 6,
    leadsNoIdentity: 3,
    adLeadsWithoutKeyword: 1,
    adLeadsWithoutGroup: 0,
    paidWithoutCogs: 0,
    outboxPending: 2,
    outboxFailed: 1,
  },
};

describe('AdsTab', () => {
  it('judges rows by money left after ads and shows data quality', () => {
    render(<AdsTab data={data} />);
    expect(screen.getByText('Отдача рекламы (ROMI)')).toBeTruthy();
    expect(screen.getAllByText('окупается').length).toBe(2);
    expect(screen.getAllByText('реклама в минус').length).toBe(2);
    expect(screen.getAllByText('почти в ноль').length).toBe(1);
    expect(screen.getAllByText('тратит без заявок').length).toBe(2);
    expect(screen.getByText('Качество данных')).toBeTruthy();
    expect(screen.getByText('Заказы не ушли в Метрику (ошибка)')).toBeTruthy();
    expect(screen.getByText(/1 из 11 рекламных заявок нет ключевого слова/)).toBeTruthy();
  });
});
