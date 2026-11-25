import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdsTab } from './ads-sections';
import type { AdPerformance, AdStats } from '../../types/ads';

const s = (p: Partial<AdStats>): AdStats => ({
  spend: 0, clicks: 0, leads: 0, paidOrders: 0, cancelled: 0, revenue: 0,
  costPerLead: null, costPerOrder: null, spendShare: null, ...p,
});

const data: AdPerformance = {
  period: { from: '2026-11-01', to: '2026-11-25' },
  spendDays: 25,
  spendLastDate: '2026-11-25',
  totals: { ...s({ spend: 12000, clicks: 300, leads: 10, paidOrders: 8, revenue: 11000, costPerLead: 1200, costPerOrder: 1500, spendShare: 109.1 }), spendWithoutVat: 10000, siteLeads: 20, nonAdLeads: 10, adLeadsWithKeyword: 9, adLeadsWithGroup: 10 },
  campaigns: [
    {
      id: '1', name: 'ЕПК', ...s({ spend: 12000, leads: 10, paidOrders: 8, revenue: 11000, spendShare: 109.1 }),
      groups: [
        { id: '10', name: 'Фотки', ...s({ spend: 10000, leads: 10, paidOrders: 8, revenue: 30000, spendShare: 33.3 }), keywords: [{ key: 'печать фото', label: 'печать фото', ...s({ spend: 10000, leads: 10, paidOrders: 8, revenue: 30000, spendShare: 33.3 }) }] },
        { id: '20', name: 'футболки', ...s({ spend: 2000 }), keywords: [{ key: 'autotargeting', label: 'Автотаргетинг', ...s({ spend: 2000 }) }] },
      ],
    },
  ],
};

describe('AdsTab', () => {
  it('shows totals and marks what pays off and what burns money', () => {
    render(<AdsTab data={data} />);
    expect(screen.getByText('Цена оплаченного заказа')).toBeTruthy();
    expect(screen.getAllByText('тратит без заявок').length).toBe(2);
    expect(screen.getAllByText('окупается').length).toBe(2);
    expect(screen.getByText('реклама дороже выручки')).toBeTruthy();
    expect(screen.getByText(/1 из 10 рекламных заявок нет ключевого слова/)).toBeTruthy();
  });
});
