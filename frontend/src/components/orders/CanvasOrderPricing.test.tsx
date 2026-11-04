import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CreateOrderForm } from './CreateOrderForm';
import { ordersApi } from '../../api/orders';
import { canvasProductionApi } from '../../api/canvasProduction';

/**
 * Новая заявка на холст: цена берётся из прайса, а не вписывается руками.
 *
 * В форме стояла константа 1500 ₽ на любой размер. Прайс на 30×40 называет
 * 940, на 40×60 — 1450: заказ уходил по цене, которой нет ни на сайте, ни
 * в прайсе, а заработок считался от этого же случайного числа. Выбор
 * размера был свободным — можно было вписать формат словами и назначить
 * любую цену, и тогда сверить позицию было вообще не с чем.
 *
 * Поэтому: размер только из прайса, цена едет за размером и материалом,
 * допы доезжают до сервера вместе с позицией.
 */

vi.mock('../../api/orders', () => ({ ordersApi: { create: vi.fn() } }));
vi.mock('../../api/canvasProduction', () => ({
  canvasProductionApi: { pricing: vi.fn() },
}));
vi.mock('../../api/users', () => ({ usersApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/partnerSettings', () => ({
  partnerSettingsApi: { get: vi.fn().mockResolvedValue(null) },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

/** Два размера настоящего прайса: 30×40 и 40×60, оптовый режим. */
const pricing = {
  mode: 'WHOLESALE' as const,
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

async function renderCanvasForm() {
  vi.mocked(canvasProductionApi.pricing).mockResolvedValue(pricing);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CreateOrderForm onClose={() => {}} onCreated={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText('Печать на холсте'));
  fireEvent.change(screen.getByPlaceholderText('@username'), {
    target: { value: '@client_test' },
  });
  // Цена подставляется, когда приедет прайс.
  await waitFor(() => {
    expect(screen.getByLabelText('Клиент ₽/шт')).toHaveValue(940);
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

it('цена новой позиции — прайсовая, а не константа', async () => {
  await renderCanvasForm();
  expect(screen.getByLabelText('Клиент ₽/шт')).toHaveValue(940);
});

it('смена размера меняет цену клиенту', async () => {
  await renderCanvasForm();

  fireEvent.change(screen.getByLabelText('Размер'), { target: { value: '40x60' } });

  expect(screen.getByLabelText('Клиент ₽/шт')).toHaveValue(1450);
});

it('смена материала меняет цену клиенту: хлопок дороже', async () => {
  await renderCanvasForm();

  fireEvent.change(screen.getByLabelText('Материал'), { target: { value: 'COTTON' } });

  expect(screen.getByLabelText('Клиент ₽/шт')).toHaveValue(1180);
});

it('размер выбирается только из прайса', async () => {
  // Свободный формат означал цену «на глаз»: сверить её не с чем, и
  // заработок по позиции считался от произвольного числа.
  await renderCanvasForm();

  const options = Array.from(
    screen.getByLabelText('Размер').querySelectorAll('option'),
  ).map((o) => (o as HTMLOptionElement).value);
  expect(options).toEqual(['30x40', '40x60']);
});

it('видно, сколько должны производству и сколько заработали', async () => {
  await renderCanvasForm();

  fireEvent.change(screen.getByLabelText('Размер'), { target: { value: '40x60' } });

  expect(screen.getByText('Должен производству')).toBeInTheDocument();
  // 1450 клиенту − 770 производству = 680 заработка.
  expect(screen.getAllByText('1 450 ₽').length).toBeGreaterThan(0);
  expect(screen.getAllByText('770 ₽').length).toBeGreaterThan(0);
  expect(screen.getAllByText('680 ₽').length).toBeGreaterThan(0);
});

it('позиция уходит на сервер с размером, материалом и допами', async () => {
  /*
    Допы раньше терялись: лак и багет можно было отметить, увидеть с ними
    маржу — и создать заказ без них. Клиенту называлась одна сумма,
    в заказе оказывалась другая.
  */
  vi.mocked(ordersApi.create).mockResolvedValue({ id: 'canvas-order' } as never);
  await renderCanvasForm();

  fireEvent.click(screen.getByLabelText('Багет'));
  fireEvent.change(screen.getByLabelText('Багет: цена клиенту'), {
    target: { value: '1500' },
  });
  fireEvent.change(screen.getByLabelText('Багет: цена поставщика'), {
    target: { value: '900' },
  });

  fireEvent.click(screen.getByRole('button', { name: /Создать заявку/i }));

  await waitFor(() => expect(ordersApi.create).toHaveBeenCalled());
  const payload = vi.mocked(ordersApi.create).mock.calls[0]![0] as {
    canvasItems: Record<string, unknown>[];
  };
  expect(payload.canvasItems[0]).toMatchObject({
    sizeKey: '30x40',
    material: 'SYNTHETIC',
    quantity: 1,
    clientPrice: 940,
    frame: true,
    frameClientPrice: 1500,
    frameContractorPrice: 900,
  });
  // Цену производства полотна форма не присылает: её ставит сервер по прайсу.
  expect(payload.canvasItems[0]).not.toHaveProperty('contractorPrice');
});
