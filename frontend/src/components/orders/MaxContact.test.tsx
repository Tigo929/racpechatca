import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { OrderContact } from './OrderContact';
import { CreateOrderForm } from './CreateOrderForm';
import { ordersApi } from '../../api/orders';

/**
 * MAX — ссылка на переписку, как у Авито.
 *
 * Раньше в контакте был телефон, из которого сервер собирал
 * `https://max.ru/79991234567`. Ссылка выглядела рабочей, но открывала
 * профиль по номеру, а не диалог по заказу: менеджер всё равно шёл в MAX
 * и искал переписку руками. Адрес диалога у него перед глазами — его и
 * вставляем, как с Авито.
 *
 * Прежние заказы остались со ссылкой из номера. Для них номер по-прежнему
 * виден и копируется: это единственное, по чему там находят человека.
 */

vi.mock('../../api/orders', () => ({
  ordersApi: { create: vi.fn(), setClientTelegram: vi.fn() },
}));
vi.mock('../../api/canvasProduction', () => ({
  canvasProductionApi: { pricing: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../api/users', () => ({
  usersApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../api/partnerSettings', () => ({
  partnerSettingsApi: { get: vi.fn().mockResolvedValue(null) },
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('контакт MAX в карточке', () => {
  it('ссылка на диалог открывается кнопкой, без телефона', () => {
    wrap(
      <OrderContact
        orderId="o1"
        platform="MAX"
        url="https://max.ru/u/aBc123XyZ"
      />,
    );

    expect(
      screen.getByRole('link', { name: /Открыть переписку в MAX/ }),
    ).toHaveAttribute('href', 'https://max.ru/u/aBc123XyZ');
    // Копировать нечего: номера в адресе диалога нет.
    expect(
      screen.queryByRole('button', { name: /Скопировать номер/ }),
    ).not.toBeInTheDocument();
  });

  it('у старого заказа номер виден и копируется', () => {
    // Такая ссылка ведёт на профиль по номеру, а не в диалог: номер —
    // единственное, по чему в этих заказах находят человека.
    wrap(
      <OrderContact
        orderId="o2"
        platform="MAX"
        url="https://max.ru/79991234567"
      />,
    );

    expect(screen.getByText('+7 999 123-45-67')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Скопировать номер/ }),
    ).toBeInTheDocument();
  });
});

describe('поле контакта при выборе MAX', () => {
  function openMax() {
    wrap(<CreateOrderForm onClose={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /MAX/ }));
  }

  it('просит ссылку, а не телефон, и ничего не подставляет', () => {
    openMax();

    const field = screen.getByLabelText('Ссылка на переписку');
    // Раньше поле само заполнялось «+7 » — теперь оно пустое под ссылку.
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'https://max.ru/...');
    expect(screen.queryByText(/Номер телефона в MAX/)).not.toBeInTheDocument();
  });

  it('телефон не проходит — сказано, что вставить вместо него', async () => {
    openMax();

    fireEvent.change(screen.getByLabelText('Ссылка на переписку'), {
      target: { value: '+7 999 123-45-67' },
    });
    fireEvent.change(screen.getByPlaceholderText('Выберите или впишите свой'), {
      target: { value: '10x15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Создать заявку/i }));

    expect(
      await screen.findByText(/нужна ссылка на переписку, а не телефон/),
    ).toBeInTheDocument();
    expect(ordersApi.create).not.toHaveBeenCalled();
  });

  it('ссылка принимается и уезжает в заказ как есть', async () => {
    vi.mocked(ordersApi.create).mockResolvedValue({ id: 'new' } as never);
    openMax();

    fireEvent.change(screen.getByLabelText('Ссылка на переписку'), {
      target: { value: 'https://max.ru/u/aBc123XyZ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Выберите или впишите свой'), {
      target: { value: '10x15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Создать заявку/i }));

    await waitFor(() => expect(ordersApi.create).toHaveBeenCalled());
    expect(vi.mocked(ordersApi.create).mock.calls[0]![0]).toMatchObject({
      communicationPlatform: 'MAX',
      urlCommunication: 'https://max.ru/u/aBc123XyZ',
    });
  });
});
