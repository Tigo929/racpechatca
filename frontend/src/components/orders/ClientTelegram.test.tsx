import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { OrderContact } from './OrderContact';
import { ordersApi } from '../../api/orders';

/**
 * Два канала у маркетплейсного заказа.
 *
 * Переписка начинается в чате кабинета — там заказ, и там покупателя
 * находят по номеру отправления. Чат кабинета остаётся: ссылка на список
 * чатов и номер под рукой. Но он умеет мало, поэтому в разговоре мы просим
 * написать нам в Telegram; написал — ник записывается здесь, одним
 * нажатием, и дальше открыты оба канала.
 *
 * Подменять канал связи заказа нельзя: по нему считается, откуда заказ и
 * куда звать за отзывом.
 */

vi.mock('../../api/orders', () => ({
  ordersApi: { setClientTelegram: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function show(props: Partial<Parameters<typeof OrderContact>[0]> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OrderContact
        orderId="o1"
        platform="OZON"
        url="1234-0001-1"
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

it('у заказа с Ozon под рукой и номер, и чаты кабинета', () => {
  show();
  expect(screen.getByText('1234-0001-1')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Чаты Ozon/ })).toHaveAttribute(
    'href',
    'https://seller.ozon.ru/app/messenger',
  );
});

it('Telegram не записан — есть кнопка «клиент написал»', () => {
  show();
  expect(
    screen.getByRole('button', { name: /Клиент написал в Telegram/ }),
  ).toBeInTheDocument();
});

it('ник записывается одним нажатием', async () => {
  vi.mocked(ordersApi.setClientTelegram).mockResolvedValue({
    id: 'o1',
    clientTelegram: '@client_name',
  } as never);
  show();

  fireEvent.click(screen.getByRole('button', { name: /Клиент написал в Telegram/ }));
  fireEvent.change(screen.getByLabelText('Telegram клиента'), {
    target: { value: '@client_name' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Записать/ }));

  await waitFor(() =>
    expect(ordersApi.setClientTelegram).toHaveBeenCalledWith('o1', '@client_name'),
  );
});

it('записанный Telegram открывается рядом с чатом площадки', () => {
  // Главное: чат кабинета никуда не делся — у заказа два канала, а не
  // замена одного другим.
  show({ clientTelegram: '@client_name' });

  expect(screen.getByRole('link', { name: /@client_name/ })).toHaveAttribute(
    'href',
    'https://t.me/client_name',
  );
  expect(screen.getByRole('link', { name: /Чаты Ozon/ })).toBeInTheDocument();
});

it('не ушедшая просьба об отзыве названа причиной', () => {
  /*
    Иначе владелец узнаёт о провале только из напоминания в рабочем чате,
    а в карточке всё выглядит как будто клиенту написали.
  */
  show({ clientTelegram: '@client_name', reviewRequestStatus: 'privacy' });
  expect(screen.getByText(/не принимает сообщения/)).toBeInTheDocument();
});

it('у заказа, который и так в Telegram, второго такого канала нет', () => {
  show({ platform: 'TELEGRAM', url: 'https://t.me/client_name' });
  expect(
    screen.queryByRole('button', { name: /Клиент написал в Telegram/ }),
  ).not.toBeInTheDocument();
});
