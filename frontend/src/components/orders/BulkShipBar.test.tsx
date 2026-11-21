import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { BulkShipBar } from './BulkShipBar';
import { ordersApi } from '../../api/orders';
import type { OrderPhoto } from '../../types/index';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const order = (id: string, numberOrder: string) =>
  ({ id, numberOrder, productCategory: 'PHOTO', status: 'SHIPMENT_CREATED' }) as unknown as OrderPhoto;

function renderBar(onFinished = vi.fn()) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <BulkShipBar
        selected={[order('a', '1001'), order('b', '1002')]}
        onClear={vi.fn()}
        onFinished={onFinished}
      />
    </QueryClientProvider>,
  );
  return { onFinished };
}

describe('BulkShipBar', () => {
  it('без подтверждения ничего не отправляет', () => {
    const spy = vi.spyOn(ordersApi, 'bulkShip');
    renderBar();
    expect(screen.getByText('Выбрано: 2 заказа')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Отметить отправленными/ }));
    expect(screen.getByText(/начислится/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('после подтверждения шлёт выбранные и показывает не прошедшие с причиной', async () => {
    const spy = vi.spyOn(ordersApi, 'bulkShip').mockResolvedValue({
      shipped: 1,
      failed: 1,
      results: [
        { id: 'a', numberOrder: '1001', ok: true },
        { id: 'b', numberOrder: '1002', ok: false, error: 'Не назначен исполнитель' },
      ],
    });
    const { onFinished } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /Отметить отправленными/ }));
    fireEvent.click(screen.getByRole('button', { name: /Да, отправлены/ }));

    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(['b']));
    expect(spy).toHaveBeenCalledWith(['a', 'b']);
    expect(await screen.findByText(/Не назначен исполнитель/)).toBeInTheDocument();
  });
});
