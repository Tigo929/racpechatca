import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { OzonOrderModal } from './OzonOrderModal';
import { ozonOrdersApi, type OzonOrder } from '../../api/ozonOrders';

/**
 * Отправление Ozon как заказ CRM.
 *
 * Главное обещание: выбора у человека нет — цвет, размер и принт выведены
 * из артикула, и видно это до заведения заказа. Второе: артикул чужой схемы
 * не пускает заказ дальше, потому что ошибка в цвете видна только после
 * печати, когда заготовка уже списана.
 */

vi.mock('../../api/ozonOrders', async () => {
  const actual = await vi.importActual<typeof import('../../api/ozonOrders')>(
    '../../api/ozonOrders',
  );
  return {
    ...actual,
    ozonOrdersApi: {
      list: vi.fn(),
      crmOrder: vi.fn().mockResolvedValue(null),
      createCrmOrder: vi.fn().mockResolvedValue({ orderId: 'o1', created: true }),
    },
  };
});
vi.mock('../orders/OrderDetail', () => ({
  OrderDetail: ({ orderId }: { orderId: string }) => (
    <div data-testid="order-detail">карточка {orderId}</div>
  ),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const order = (items: OzonOrder['items']): OzonOrder =>
  ({
    postingNumber: '0189070451-0031-1',
    orderNumber: '48912345-0031',
    status: 'awaiting_deliver',
    statusLabel: 'Ждёт отгрузки',
    group: 'to_ship',
    createdAt: null,
    shipmentDate: null,
    shipmentOverdue: false,
    deliveringDate: null,
    trackingNumber: null,
    deliveryMethod: null,
    warehouse: null,
    cancelReason: null,
    items,
    total: 0,
    payout: 0,
  }) as OzonOrder;

const item = (offerId: string, quantity = 1): OzonOrder['items'][number] => ({
  offerId,
  name: '',
  sku: offerId,
  quantity,
  price: 1290,
});

function show(o: OzonOrder) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OzonOrderModal accountId="acc" order={o} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('отправление Ozon в CRM', () => {
  beforeEach(() => vi.clearAllMocks());

  it('показывает, что будет заведено, до создания заказа', async () => {
    show(order([item('JDM-1-1-black-S'), item('labrov-nadpis-white-XXL', 2)]));
    expect(await screen.findByText(/Чёрный · S · принт/)).toBeInTheDocument();
    expect(screen.getByText(/Белый · XXL · принт/)).toBeInTheDocument();
    expect(screen.getByText(/× 2 шт/)).toBeInTheDocument();
  });

  it('стикер показан хвостом номера отправления', async () => {
    show(order([item('JDM-1-1-black-S')]));
    expect(await screen.findByText('…0311')).toBeInTheDocument();
  });

  it('чужой артикул не даёт завести заказ', async () => {
    // Подставить цвет наугад нельзя: ошибку видно только после печати.
    show(order([item('JDM-1-1-black-S'), item('sticker-pack')]));
    expect(await screen.findByText(/собраны не по схеме/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Завести в CRM/ }),
    ).not.toBeInTheDocument();
  });

  it('заводит заказ одним нажатием — по номеру отправления', async () => {
    show(order([item('JDM-1-1-black-S')]));
    fireEvent.click(await screen.findByRole('button', { name: /Завести в CRM/ }));
    await waitFor(() => {
      expect(ozonOrdersApi.createCrmOrder).toHaveBeenCalledWith(
        'acc',
        '0189070451-0031-1',
      );
    });
    // Что дальше открывается карточка — проверяет следующий тест: связь
    // отправления с заказом приходит с сервера, а не из ответа на создание.
  });
  it('уже заведённое отправление сразу открывает карточку заказа', async () => {
    vi.mocked(ozonOrdersApi.crmOrder).mockResolvedValue({
      id: 'o42',
      numberOrder: '20260928-2',
      marketplaceOrderNumber: '48912345-0031',
    });
    show(order([item('JDM-1-1-black-S')]));
    expect(await screen.findByTestId('order-detail')).toHaveTextContent('o42');
  });
});
