import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CanvasItemsTable } from './CanvasItemsTable';
import { canvasProductionApi } from '../../api/canvasProduction';
import type { OrderPhoto } from '../../types';

/**
 * Цена холста привязана к размеру, а не вписана руками.
 *
 * У каждого размера в прайсе две цены: розничная — её платит клиент, и
 * оптовая — её платим мы. Разница и есть заработок, поэтому обе должны
 * ехать за размером. Пока цена оставалась от прежнего размера, заказ на
 * 40×60 уезжал в работу с суммой за 30×40: клиенту названа одна цифра,
 * в заказе другая, а в финансовом отчёте — заработок, посчитанный не от
 * прайса.
 *
 * Материал тянет цену так же, как размер: хлопок дороже и клиенту, и нам.
 *
 * Фактическая цена остаётся исправляемой — договориться можно иначе, — но
 * расхождение с прайсом названо, и прайсовая цена возвращается нажатием.
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
  delivery: { cost: 700, price: 800 },
  materialLabels: { SYNTHETIC: 'Синтетика', COTTON: 'Хлопок' },
  sizes: [
    {
      key: '30x40',
      label: '30 × 40 см',
      widthCm: 30,
      heightCm: 40,
      retail: { SYNTHETIC: 940, COTTON: 1180 },
      wholesale: { SYNTHETIC: 470, COTTON: 590 },
      cost: { SYNTHETIC: 470, COTTON: 590 },
      clientPrice: 940,
    },
    {
      key: '40x60',
      label: '40 × 60 см',
      widthCm: 40,
      heightCm: 60,
      retail: { SYNTHETIC: 1450, COTTON: 1870 },
      wholesale: { SYNTHETIC: 770, COTTON: 990 },
      cost: { SYNTHETIC: 770, COTTON: 990 },
      clientPrice: 1450,
    },
  ],
};

/** Заказ с одной позицией 30×40 из прайса. */
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
        contractorPrice: 470,
        pricePosition: clientPrice,
        contractorCostPosition: 470,
        profitPosition: clientPrice - 470,
      },
    ],
  }) as unknown as OrderPhoto;

/** Старая позиция: размера из прайса у неё нет. */
const legacyOrder = (): OrderPhoto =>
  ({
    id: 'ord-2',
    numberOrder: '20260924-002',
    deliveryMethod: 'PICKUP',
    deliveryCost: 0,
    designDevelopmentCost: 0,
    discountAmount: 0,
    canvasItems: [
      {
        id: 'item-2',
        formatCanvas: 'Модульный, 3 части',
        sizeKey: null,
        material: null,
        quantity: 1,
        clientPrice: 5000,
        contractorPrice: 3000,
        pricePosition: 5000,
        contractorCostPosition: 3000,
        profitPosition: 2000,
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

it('смена размера подставляет цену этого размера', async () => {
  show(order(940));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));

  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(940);

  fireEvent.change(screen.getByLabelText('Размер холста'), {
    target: { value: '40x60' },
  });

  // Главное: цена не осталась от прежнего размера.
  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(1450);
});

it('смена материала тоже меняет цену: хлопок дороже', async () => {
  /*
    Хлопок дороже и клиенту, и нам. Пока цена не ехала за материалом,
    хлопковый холст продавался по цене синтетики — то есть почти в
    себестоимость, и это нигде не было видно.
  */
  show(order(940));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));

  fireEvent.change(screen.getByLabelText('Материал'), {
    target: { value: 'COTTON' },
  });

  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(1180);
});

it('совпадение с прайсом подписано, расхождение — названо', async () => {
  // Цена в заказе ниже прайсовой: так бывает по договорённости, и это
  // не ошибка — но видеть, насколько она разошлась, владелец обязан.
  show(order(800));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));
  expect(screen.getByText(/по прайсу/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'вернуть' }));
  expect(screen.getByLabelText('Цена клиента за штуку')).toHaveValue(940);
  expect(await screen.findByText('цена по прайсу')).toBeInTheDocument();
});

it('новую позицию нельзя завести мимо прайса', async () => {
  /*
    Размер «словами» тянул за собой цену «на глаз»: сверить её не с чем,
    и заработок по такой позиции считался от произвольного числа.
    Нестандартное заводится свободной позицией заказа.
  */
  show(order(940));
  fireEvent.click(await screen.findByRole('button', { name: /Добавить/ }));

  const sizes = screen.getAllByLabelText('Размер холста');
  const options = Array.from(
    sizes[sizes.length - 1]!.querySelectorAll('option'),
  ).map((o) => (o as HTMLOptionElement).value);
  expect(options).toEqual(['30x40', '40x60']);
});

it('у новой позиции цена сразу прайсовая', async () => {
  // Раньше в новой строке стояло 1500 ₽ — цена, которой в прайсе нет.
  show(order(940));
  fireEvent.click(await screen.findByRole('button', { name: /Добавить/ }));

  const prices = screen.getAllByLabelText('Цена клиента за штуку');
  expect(prices[prices.length - 1]).toHaveValue(940);
});

it('пока строку правят, видно выручку, себестоимость и заработок', async () => {
  /*
    На их месте стояли прочерки: во что превращается строка, было видно
    только после сохранения. Для расчёта «зарабатываю я на этом или нет»
    это и есть главные три числа.
  */
  show(order(940));
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));

  fireEvent.change(screen.getByLabelText('Размер холста'), {
    target: { value: '40x60' },
  });

  // 1450 клиенту − 770 производству = 680 заработка.
  expect(screen.getByText('1 450 ₽')).toBeInTheDocument();
  // 770 ₽ стоит и подписью под ценой производства, и в клетке себестоимости.
  expect(screen.getAllByText('770 ₽').length).toBeGreaterThan(0);
  expect(screen.getByText('680 ₽')).toBeInTheDocument();
});

it('старая позиция без размера правится по-прежнему руками', async () => {
  /*
    Такие позиции остались от заявок, заведённых до прайса. Отбить их
    правку значило бы запереть заказ, который уже в работе.
  */
  show(legacyOrder());
  fireEvent.click(await screen.findByLabelText('Редактировать позицию'));

  expect(screen.getByLabelText('Подпись позиции')).toHaveValue('Модульный, 3 части');
  expect(screen.getByLabelText('Цена производства за штуку')).toHaveValue(3000);
});
