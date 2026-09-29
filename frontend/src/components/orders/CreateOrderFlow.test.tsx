import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CreateOrderForm } from './CreateOrderForm';
import { ordersApi } from '../../api/orders';

/**
 * Что происходит сразу после создания заявки.
 *
 * Окно закрывалось, и человек оставался перед списком: чтобы отправить
 * подтверждение или записать оплату, он искал только что созданный заказ
 * глазами. А делать это нужно сразу — разговор с клиентом идёт прямо
 * сейчас. Поэтому форма обязана сказать, какую карточку открыть.
 */

vi.mock('../../api/orders', () => ({
  ordersApi: { create: vi.fn() },
}));
vi.mock('../../api/canvasProduction', () => ({
  canvasProductionApi: { pricing: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../api/users', () => ({ usersApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/partnerSettings', () => ({
  partnerSettingsApi: { get: vi.fn().mockResolvedValue(null) },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

function renderForm(onCreated: (id: string) => void, onClose = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateOrderForm onClose={onClose} onCreated={onCreated} />
    </QueryClientProvider>,
  );
}

/** Минимум, без которого форма не отдаётся: контакт и формат позиции. */
function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText('@username'), {
    target: { value: '@client_test' },
  });
  fireEvent.change(screen.getByPlaceholderText('Выберите или впишите свой'), {
    target: { value: '10x15' },
  });
}

describe('после создания заявки', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('карточка созданной заявки открывается сразу', async () => {
    vi.mocked(ordersApi.create).mockResolvedValue({ id: 'new-order' } as never);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderForm(onCreated, onClose);

    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Создать заявку/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new-order');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('обращение открывается так же — по нему тоже идёт разговор', async () => {
    vi.mocked(ordersApi.create).mockResolvedValue({ id: 'new-lead' } as never);
    const onCreated = vi.fn();
    renderForm(onCreated);

    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Записать обращение/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new-lead');
    });
  });

  it('неудачное создание не открывает ничего', async () => {
    // Иначе человек увидит пустую карточку и решит, что заявка есть.
    vi.mocked(ordersApi.create).mockRejectedValue(new Error('сервер недоступен'));
    const onCreated = vi.fn();
    const onClose = vi.fn();
    renderForm(onCreated, onClose);

    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Создать заявку/i }));

    await waitFor(() => {
      expect(ordersApi.create).toHaveBeenCalled();
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
