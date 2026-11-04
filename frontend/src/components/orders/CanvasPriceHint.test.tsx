import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CanvasItemsTable } from './CanvasItemsTable';
import { canvasProductionApi } from '../../api/canvasProduction';
import type { OrderPhoto } from '../../types';

/**
 * Откуда взялся долг производству и торговля в минус.
 *
 * Владелец называет цену клиенту прямо в этот момент, поэтому карточка
 * обязана говорить две вещи: сколько стоит размер по оптовому прайсу (это
 * и есть долг производству) и что заказ уходит ниже себестоимости. Красная
 * цифра со знаком второго не говорит — её читают как заработок.
 *
 * Прежняя система «розница минус 20%» отменена, и подпись «розница … − 20%»
 * в интерфейсе появляться не должна: по ней себестоимость выше настоящей,
 * а решение о цене принимается по этой самой подписи.
 */

vi.mock('../../api/orders', () => ({
  ordersApi: {
    addCanvasItem: vi.fn(),
    updateCanvasItem: vi.fn(),
    deleteCanvasItem: vi.fn(),
  },
}));
vi.mock('../../api/canvasProduction', () => ({
  canvasProductionApi: { pricing: vi.fn() },
}));
vi.mock('../../context/useAuth', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));

/** 20×30 синтетика: 630 ₽ клиенту, 470 ₽ производству — строка из прайса. */
const pricing = () => ({
  delivery: { cost: 700, price: 800 },
  materialLabels: { SYNTHETIC: 'Синтетика', COTTON: 'Хлопок' },
  sizes: [
    {
      key: '20x30',
      label: '20 × 30 см',
      widthCm: 20,
      heightCm: 30,
      retail: { SYNTHETIC: 630, COTTON: 780 },
      wholesale: { SYNTHETIC: 470, COTTON: 590 },
      cost: { SYNTHETIC: 470, COTTON: 590 },
      /* Витринная цена: по ней подставляется «клиент / шт» при смене размера. */
      clientPrice: 630,
    },
  ],
});

/** Заказ с одной позицией холста. */
const order = (
  clientPrice: number,
  contractorPrice: number,
  discountAmount = 0,
): OrderPhoto =>
  ({
    id: 'ord-1',
    numberOrder: '20260924-001',
    deliveryMethod: 'PICKUP',
    deliveryCost: 0,
    designDevelopmentCost: 0,
    discountAmount,
    canvasItems: [
      {
        id: 'item-1',
        formatCanvas: '20 × 30 см, синтетика',
        sizeKey: '20x30',
        material: 'SYNTHETIC',
        quantity: 1,
        clientPrice,
        contractorPrice,
        pricePosition: clientPrice,
        contractorCostPosition: contractorPrice,
        profitPosition: clientPrice - contractorPrice,
      },
    ],
  }) as unknown as OrderPhoto;

function show(row: OrderPhoto) {
  vi.mocked(canvasProductionApi.pricing).mockResolvedValue(pricing());
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CanvasItemsTable order={row} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('заказ ниже себестоимости назван словами, а не только красной цифрой', async () => {
  // Ровно случай владельца: клиенту названо 1 500, должны производству 1 700.
  show(order(1500, 1700));
  const warning = await screen.findByText(/Заказ в минус: производству отдадите на/);
  // Ровно та цифра, которую владелец должен увидеть до того, как назовёт цену.
  expect(warning.textContent).toMatch(/200\s?₽ больше/);
});

it('прибыльный заказ предупреждения не показывает', async () => {
  show(order(2500, 1700));
  expect(await screen.findByText('Моя прибыль')).toBeInTheDocument();
  expect(screen.queryByText(/Заказ в минус/)).not.toBeInTheDocument();
});

it('цена производства подписана оптовым прайсом, а не розницей со скидкой', async () => {
  show(order(2500, 470));
  // Строку правим — в ней и видно, откуда взялся долг производству.
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));
  expect(await screen.findByText(/опт 470/)).toBeInTheDocument();
  // 630 − 20% = 504: себестоимость по отменённой договорённости.
  expect(screen.queryByText(/розница/)).not.toBeInTheDocument();
  expect(screen.queryByText(/− 20%/)).not.toBeInTheDocument();
  expect(screen.queryByText(/504/)).not.toBeInTheDocument();
});

it('скидка клиенту вычитается из моего заработка', async () => {
  // 2 500 клиенту, 470 производству, скидка 300 → заработок 1 730 ₽.
  show(order(2500, 470, 300));
  expect(await screen.findByText('Скидка клиенту')).toBeInTheDocument();
  const profitRow = (await screen.findByText('Моя прибыль')).closest('div')!;
  expect(profitRow.textContent).toMatch(/1\s?730/);
});

it('скидка может увести заказ в минус, и это видно', async () => {
  // 600 клиенту при долге 470 — прибыль 130 ₽; скидка 300 уводит в −170 ₽.
  show(order(600, 470, 300));
  expect(
    await screen.findByText(/Заказ в минус: производству отдадите на/),
  ).toBeInTheDocument();
});
