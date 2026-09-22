import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { PaidAtBlock } from './PaidAtBlock';
import { ordersApi } from '../../api/orders';
import type { OrderPhoto } from '../../types';

/**
 * Работа D1. Панель обязана честно показывать, что даты оплаты нет, и давать
 * её указать только администратору — и только пока она пуста.
 */

vi.mock('../../api/orders', () => ({ ordersApi: { setPaidAt: vi.fn() } }));

const auth = { user: { role: 'ADMIN' } as { role: string } | null };
vi.mock('../../context/useAuth', () => ({ useAuth: () => auth }));

const order = (over: Partial<OrderPhoto> = {}): OrderPhoto =>
  ({
    id: 'ord-1',
    numberOrder: '20260909-091',
    status: 'PAID',
    clientPaidAt: null,
    ...over,
  }) as OrderPhoto;

function show(row: OrderPhoto) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PaidAtBlock order={row} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { role: 'ADMIN' };
});

it('оплачен без даты: говорит об этом прямо и предлагает указать', () => {
  show(order());
  expect(screen.getByText('Дата оплаты не указана')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Указать дату оплаты' }),
  ).toBeInTheDocument();
});

it('администратор указывает дату — уходит ровно она', async () => {
  vi.mocked(ordersApi.setPaidAt).mockResolvedValue(
    order({ clientPaidAt: '2026-09-16T00:00:00.000Z' }),
  );
  show(order());

  fireEvent.click(screen.getByRole('button', { name: 'Указать дату оплаты' }));
  fireEvent.change(screen.getByLabelText('Фактическая дата оплаты'), {
    target: { value: '2026-09-16' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

  await waitFor(() =>
    expect(ordersApi.setPaidAt).toHaveBeenCalledWith('ord-1', '2026-09-16'),
  );
});

it('пустую дату сохранить нельзя', () => {
  show(order());
  fireEvent.click(screen.getByRole('button', { name: 'Указать дату оплаты' }));
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
});

it('дата уже есть — показываем её и не даём переписать', () => {
  show(order({ clientPaidAt: '2026-09-14T09:00:00.000Z' }));
  expect(screen.getByText(/Оплата получена/)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Указать дату оплаты' }),
  ).not.toBeInTheDocument();
});

it('не администратор видит пробел, но кнопки не получает', () => {
  auth.user = { role: 'ORDER_MANAGER' };
  show(order());
  expect(screen.getByText('Дата оплаты не указана')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Указать дату оплаты' }),
  ).not.toBeInTheDocument();
});

it('неоплаченный заказ панель не показывает', () => {
  const { container } = show(order({ status: 'SENT' }));
  expect(container).toBeEmptyDOMElement();
});
