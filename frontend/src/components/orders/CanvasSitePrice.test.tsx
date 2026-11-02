import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CanvasItemsTable } from './CanvasItemsTable';
import { canvasProductionApi } from '../../api/canvasProduction';
import type { OrderPhoto } from '../../types';

/**
 * Цена холста при смене размера.
 *
 * Заявка приходит с сайта с размером и ценой этого размера. Менеджер
 * размер правит — клиент передумал, прислал другой кадр, — а цена
 * оставалась от прежнего размера. Заказ на 60×40 уезжал в работу
 * с суммой за 30×40: клиенту уже названа одна цифра, в заказе другая,
 * и разбираться с этим приходилось при оплате.
 *
 * Поэтому цена едет за размером. Источник — тот же список, по которому
 * считает сайт (CANVAS_SIZES, ТЗ блок 11), а не вторая копия прайса:
 * двум копиям однажды разойтись, и тогда сайт и CRM назовут разные
 * суммы за один холст.
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

/** Два размера из настоящего прайса: цены клиента и производства как есть. */
const pricing = {
  mode: 'RETAIL' as const,
  modeLabels: { RETAIL: 'Розничный прайс со скидкой', WHOLESALE: 'Оптовый прайс' },
  discountBasisPoints: 2000,
  delivery: { cost: 700, price: 800 },
  materialLabels: { SYNTHETIC: 'Синтетика', COTTON: 'Хлопок' },
  sizes: [
    {
      key: '30x40',
      label: '30 × 40 см',
      widthCm: 30,
      heightCm: 40,
      retail: { SYNTHETIC: 940, COTTON: 1100 },
      wholesale: { SYNTHETIC: 700, COTTON: 830 },
      cost: { SYNTHETIC: 752, COTTON: 880 },
      clientPrice: 940,
    },
    {
      key: '40x60',
      label: '40 × 60 см',
      widthCm: 40,
      heightCm: 60,
      retail: { SYNTHETIC: 1450, COTTON: 1700 },
      wholesale: { SYNTHETIC: 1080, COTTON: 1280 },
      cost: { SYNTHETIC: 1160, COTTON: 1360 },
      clientPrice: 1450,
    },
  ],
};

const order = (clientPrice: number): OrderPhoto =>
  ({
    id: 'ord-1',
    numberOrder: '20260924-001',
    deliveryMethod: 'PICKUP',
    deliveryCost: 0,
    designDevelopmentCost: 0,
    discountAmount: 0,
    canvasItems: [
      {
        id: 'item-1',
        formatCanvas: '30 × 40 см, синтетика',
        sizeKey: '30x40',
        material: 'SYNTHETIC',
        quantity: 1,
        clientPrice,
        contractorPrice: 752,
        pricePosition: clientPrice,
        contractorCostPosition: 752,
        profitPosition: clientPrice - 752,
      },
    ],
  }) as unknown as OrderPhoto;

function show(row: OrderPhoto) {
  vi.mocked(canvasProductionApi.pricing).mockResolvedValue(pricing);
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

it('смена размера подставляет цену с сайта', async () => {
  show(order(940));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));

  const price = screen.getByLabelText('Цена клиента за штуку');
  expect(price).toHaveValue(940);

  fireEvent.change(screen.getByLabelText('Размер холста'), {
    target: { value: '40x60' },
  });

  // Главное: цена не осталась от прежнего размера.
  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(1450);
});

it('совпадение с сайтом подписано, расхождение — названо', async () => {
  // Цена в заказе ниже витринной: так бывает по договорённости, и это
  // не ошибка — но видеть, насколько она разошлась, менеджер обязан.
  show(order(800));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));
  expect(screen.getByText(/на сайте/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'вернуть' }));
  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(940);
  expect(await screen.findByText('цена с сайта')).toBeInTheDocument();
});

it('у нестандартного размера цену не трогаем', async () => {
  /*
    Сайт такой размер не продаёт, витринной цены у него нет. Подставить
    ноль значило бы молча обнулить то, о чём уже договорились с клиентом.
  */
  show(order(1830));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));
  fireEvent.change(screen.getByLabelText('Размер холста'), { target: { value: '' } });
  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(1830);
  expect(screen.queryByText('цена с сайта')).not.toBeInTheDocument();
});
