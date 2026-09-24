import { render, screen, within } from '@testing-library/react';
import { SalesChannelsBlock, SourcesTable } from '../sections';
import type { CrmSlice, SalesChannelRow, Slice, SourceRow } from '../../../types/analytics';

/**
 * Блок «Каналы заказов» (этап 17).
 *
 * Владелец должен видеть сайт и Avito раздельно и вместе с деньгами, а
 * «Не определён» — видеть всегда: спрятанная строка означала бы, что доли
 * каналов посчитаны от неполного целого. Рекламные источники остаются своим
 * блоком: путать происхождение заказа с источником визита нельзя.
 */

const period = { kind: 'days' as const, preset: 'last_7_days' as const, from: '2026-09-15', to: '2026-09-21' };

const row = (over: Partial<SalesChannelRow>): SalesChannelRow => ({
  salesChannel: 'AVITO',
  crmLeads: 0,
  acceptedOrders: 0,
  paidOrders: 0,
  cancelledOrders: 0,
  contractValue: 0,
  paidOrderValue: 0,
  acceptedAov: null,
  paidAov: null,
  realizedOrders: 0,
  realizedRevenue: 0,
  realizedGoodsRevenue: 0,
  cogs: 0,
  grossProfit: 0,
  marginPct: null,
  averageCheck: null,
  ...over,
});

const slice: CrmSlice<SalesChannelRow> = {
  period,
  rows: [
    row({
      salesChannel: 'WEBSITE',
      crmLeads: 9,
      acceptedOrders: 8,
      paidOrders: 1,
      realizedRevenue: 3000,
      cogs: 800,
      grossProfit: 2200,
      averageCheck: 1500,
    }),
    row({
      salesChannel: 'AVITO',
      acceptedOrders: 28,
      paidOrders: 10,
      realizedRevenue: 24000,
      cogs: 6000,
      grossProfit: 18000,
      averageCheck: 2666,
    }),
    row({ salesChannel: 'UNKNOWN', acceptedOrders: 1, realizedRevenue: 1000, cogs: 200, grossProfit: 800 }),
  ],
  quality: { completeness: 'complete', notes: ['UNKNOWN_ORDER_ORIGIN'] },
};

it('22. блок «Каналы заказов» показывает канал, заказы и деньги', () => {
  render(<SalesChannelsBlock slice={slice} />);
  expect(screen.getByText('Каналы заказов')).toBeInTheDocument();
  for (const column of ['Канал', 'Заявки', 'Принято', 'Оплачено', 'Выручка', 'Себестоимость', 'Прибыль', 'Средний чек']) {
    expect(screen.getByText(column)).toBeInTheDocument();
  }
  const website = screen.getByText('Сайт').closest('tr')!;
  expect(within(website).getByText('8')).toBeInTheDocument();
  const avito = screen.getByText('Avito').closest('tr')!;
  expect(within(avito).getByText('28')).toBeInTheDocument();
  // сайт и Avito — разные строки с разными деньгами
  expect(within(website).getByText(/3\s?000/)).toBeInTheDocument();
  expect(within(avito).getByText(/24\s?000/)).toBeInTheDocument();
});

it('23. строка «Не определён» видна и объяснена', () => {
  render(<SalesChannelsBlock slice={slice} />);
  const unknown = screen.getByText('Не определён').closest('tr')!;
  expect(within(unknown).getByText('1')).toBeInTheDocument();
  expect(screen.getByText(/происхождение которых по истории не доказано/)).toBeInTheDocument();
});

it('24. происхождение заказа отделено от источника рекламы', () => {
  const { unmount } = render(<SalesChannelsBlock slice={slice} />);
  expect(screen.getByText(/Это не источник рекламы/)).toBeInTheDocument();
  unmount();

  const sources: Slice<SourceRow> = {
    period,
    rows: [
      {
        trafficSource: 'ad',
        trafficSourceName: 'Переходы по рекламе',
        sourceEngine: 'ya_direct',
        sourceEngineName: 'Яндекс.Директ',
        pageviews: 200,
        visits: 58,
        siteLeads: 9,
        matchedAccepted: 5,
        matchedPaid: 0,
        visitToLead: 15.5,
        visitToAccepted: 8.6,
        visitToPaid: 0,
        leadToAccepted: 55.6,
        acceptedToPaid: 0,
      },
    ],
    totals: {
      visits: 58,
      siteLeads: 9,
      matchedAccepted: 5,
      matchedPaid: 0,
      visitToLead: 15.5,
      visitToAccepted: 8.6,
      visitToPaid: 0,
      leadToAccepted: 55.6,
      acceptedToPaid: 0,
    },
    quality: { completeness: 'complete', notes: [] },
  };
  render(<SourcesTable slice={sources} />);
  // в блоке источников визитов нет каналов заказов — это другое измерение
  expect(screen.queryByText('Avito')).not.toBeInTheDocument();
  expect(screen.getByText(/Яндекс.Директ/)).toBeInTheDocument();
});

it('прибыль канала названа валовой — чистая остаётся одна на бизнес', () => {
  render(<SalesChannelsBlock slice={slice} />);
  expect(screen.getByText(/Прибыль канала — валовая/)).toBeInTheDocument();
  expect(screen.getByText(/по каналам не делятся/)).toBeInTheDocument();
});
