import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { OrdersTab } from './OrdersTab';
import { ozonOrdersApi, type OzonOrder } from '../../api/ozonOrders';

/**
 * Поиск отправления в списке заказов Ozon.
 *
 * Проверяем связку целиком, а не только правило совпадения: строка
 * действительно сокращает список и действительно смотрит мимо выбранной
 * группы. Иначе найденный заказ прятался бы за фильтром, выбранным пять
 * минут назад, — и поиском бы не пользовались.
 */

vi.mock('../../api/ozonOrders', async () => {
  const actual = await vi.importActual<typeof import('../../api/ozonOrders')>(
    '../../api/ozonOrders',
  );
  return {
    ...actual,
    ozonOrdersApi: { list: vi.fn(), crmOrder: vi.fn(), createCrmOrder: vi.fn() },
  };
});
vi.mock('../orders/OrderDetail', () => ({
  OrderDetail: () => <div />,
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

function order(over: Partial<OzonOrder>): OzonOrder {
  return {
    postingNumber: '88870356-0049-1',
    orderNumber: '88870356-0049',
    status: 'delivered',
    statusLabel: 'Доставлен',
    group: 'delivered',
    createdAt: '2026-10-02T10:18:00.000Z',
    shipmentDate: null,
    shipmentOverdue: false,
    deliveringDate: null,
    trackingNumber: null,
    deliveryMethod: null,
    warehouse: null,
    cancelReason: null,
    items: [{ offerId: 'papa-black-m', name: 'Футболка', sku: '1', quantity: 1, price: 1000 }],
    total: 1000,
    payout: 900,
    crm: null,
    ...over,
  } as OzonOrder;
}

/** Отгруженный заказ с перепиской и ником — его и будем искать. */
const target = order({
  postingNumber: '79170791-0245-1',
  orderNumber: '79170791-0245',
  group: 'to_ship',
  statusLabel: 'Ждёт отгрузки',
  crm: {
    id: 'o1',
    numberOrder: '20261026-311',
    status: 'NEW',
    approvalStatus: null,
    communicationPlatform: 'OZON',
    urlCommunication: 'https://seller.ozon.ru/app/chat/79170791-0245',
    clientTelegram: '@ivan_petrov',
  },
});

function show() {
  vi.mocked(ozonOrdersApi.list).mockResolvedValue({
    orders: [target, order({}), order({ postingNumber: '11112222-0001-1', orderNumber: '11112222-0001' })],
    hasNext: false,
    stale: false,
    refreshedAt: '2026-11-08T10:00:00.000Z',
    hiddenByCatalog: 0,
  });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OrdersTab accountId="acc" />
    </QueryClientProvider>,
  );
}

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('Поиск отправления'), { target: { value } });

/*
 * Строка есть и в таблице, и в карточках для телефона: в DOM присутствуют
 * обе, прячет лишнюю только CSS. Поэтому считаем совпадения, а не ищем одно.
 */
const shown = (posting: string) => screen.queryAllByText(posting).length > 0;

describe('поиск в списке заказов Ozon', () => {
  it('сужает список до найденного отправления', async () => {
    show();
    await screen.findAllByText('79170791-0245-1');
    type('79170791');
    expect(shown('79170791-0245-1')).toBe(true);
    expect(shown('11112222-0001-1')).toBe(false);
    expect(screen.getByText(/Найдено отправлений: 1/)).toBeInTheDocument();
  });

  it('находит по нику в Telegram и по чату площадки', async () => {
    show();
    await screen.findAllByText('79170791-0245-1');
    for (const query of ['@ivan_petrov', 'seller.ozon.ru/app/chat/79170791-0245', '20261026-311']) {
      type(query);
      expect(shown('79170791-0245-1')).toBe(true);
      expect(shown('11112222-0001-1')).toBe(false);
    }
  });

  it('ищет мимо выбранной группы', async () => {
    // Открыт «Нужно отгрузить», а искомый заказ доставлен: без этого
    // правила человек получил бы пустой экран и решил, что заказа нет.
    show();
    await screen.findAllByText('79170791-0245-1');
    type('11112222');
    expect(shown('11112222-0001-1')).toBe(true);
  });

  it('пустая строка возвращает список как был', async () => {
    show();
    await screen.findAllByText('79170791-0245-1');
    type('11112222');
    expect(shown('79170791-0245-1')).toBe(false);
    type('');
    expect(shown('79170791-0245-1')).toBe(true);
    expect(screen.queryByText(/Найдено отправлений/)).toBeNull();
  });
});
