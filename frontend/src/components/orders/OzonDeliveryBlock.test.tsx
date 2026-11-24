import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { OzonDeliveryBlock } from './OzonDeliveryBlock';
import { ozonDeliveryApi, type DeliveryView } from '../../api/ozonDelivery';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

/** Заявка с сайта — как на скриншоте владельца 24.11: пункт и получатель уже есть. */
const lead: DeliveryView = {
  configured: true,
  pickupPoint: { id: '45433', number: '454-33', address: 'Москва, Маломосковская улица, 14', schedule: 'ежедневно 10:00–22:00' },
  recipientName: 'Виктория Смирнова',
  recipientPhone: '+79161234567',
  blocker: 'Это ещё заявка — сначала переведите её в заказ.',
  defaultParcel: { weightG: 300, lengthMm: 250, widthMm: 180, heightMm: 30 },
  money: { clientPaid: 300, ozonCost: null, ozonCostIsEstimate: true, earned: null },
  shipment: null,
};

function show(view: DeliveryView) {
  vi.spyOn(ozonDeliveryApi, 'view').mockResolvedValue(view);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OzonDeliveryBlock orderId="o1" />
    </QueryClientProvider>,
  );
}

describe('блок «Доставка Ozon»', () => {
  it('заполненное — текстом целиком, без обрезанных полей', async () => {
    show(lead);
    expect(await screen.findByText('Москва, Маломосковская улица, 14')).toBeInTheDocument();
    expect(screen.getByText('Виктория Смирнова')).toBeInTheDocument();
    expect(screen.getByText(/\+79161234567/)).toBeInTheDocument();
    expect(screen.getByText(/300 г · 25 × 18 × 3 см/)).toBeInTheDocument();
    // Полей ввода нет, пока не нажали карандаш.
    expect(screen.queryByPlaceholderText('Имя и фамилия')).toBeNull();
  });

  it('пока заявка — кнопка неактивна и сказано, что сделать', async () => {
    show(lead);
    expect(await screen.findByText(/сначала переведите её в заказ/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать отправление/ })).toBeDisabled();
  });

  it('карандаш открывает поля получателя', async () => {
    show(lead);
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить получателя' }));
    expect(screen.getByPlaceholderText('Имя и фамилия')).toHaveValue('Виктория Смирнова');
  });

  it('после отправки виден заработок', async () => {
    show({
      ...lead,
      blocker: null,
      money: { clientPaid: 300, ozonCost: 117, ozonCostIsEstimate: true, earned: 183 },
    });
    expect(await screen.findByText('+183 ₽')).toBeInTheDocument();
  });
});
