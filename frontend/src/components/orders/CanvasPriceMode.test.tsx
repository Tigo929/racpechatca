import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CanvasItemsTable } from './CanvasItemsTable';
import { canvasProductionApi } from '../../api/canvasProduction';
import type { OrderPhoto } from '../../types';

/**
 * Две системы цен производства на холст и торговля в минус.
 *
 * Владелец называет цену клиенту прямо в этот момент, поэтому карточка
 * обязана говорить две вещи: по какому прайсу посчитан долг производству
 * (розница минус скидка или опт) и что заказ уходит ниже себестоимости.
 * Красная цифра со знаком этого не говорит — её читают как заработок.
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

const size = {
  key: '20x30',
  label: '20 × 30 см',
  widthCm: 20,
  heightCm: 30,
  retail: { SYNTHETIC: 630, COTTON: 780 },
  wholesale: { SYNTHETIC: 470, COTTON: 590 },
  cost: { SYNTHETIC: 504, COTTON: 624 },
};

const pricing = (mode: 'RETAIL' | 'WHOLESALE') => ({
  mode,
  modeLabels: {
    RETAIL: 'Розничный прайс со скидкой',
    WHOLESALE: 'Оптовый прайс',
  },
  discountBasisPoints: 2000,
  delivery: { cost: 700, price: 800 },
  materialLabels: { SYNTHETIC: 'Синтетика', COTTON: 'Хлопок' },
  sizes: [
    mode === 'WHOLESALE' ? { ...size, cost: { SYNTHETIC: 470, COTTON: 590 } } : size,
  ],
});

/** Заказ с одной позицией: клиенту названо меньше, чем должны производству. */
const order = (clientPrice: number, contractorPrice: number): OrderPhoto =>
  ({
    id: 'ord-1',
    numberOrder: '20260924-001',
    deliveryMethod: 'PICKUP',
    deliveryCost: 0,
    designDevelopmentCost: 0,
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

function show(row: OrderPhoto, mode: 'RETAIL' | 'WHOLESALE' = 'RETAIL') {
  vi.mocked(canvasProductionApi.pricing).mockResolvedValue(pricing(mode));
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

it('в режиме опта цена производства подписана оптовым прайсом', async () => {
  show(order(2500, 470), 'WHOLESALE');
  // Строку правим — в ней и видно, откуда взялся долг производству.
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));
  expect(await screen.findByText(/опт 470/)).toBeInTheDocument();
  expect(screen.queryByText(/розница/)).not.toBeInTheDocument();
});

it('в розничном режиме подписаны прайс и скидка', async () => {
  show(order(2500, 504), 'RETAIL');
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));
  expect(await screen.findByText(/розница 630\s?₽ − 20%/)).toBeInTheDocument();
});
