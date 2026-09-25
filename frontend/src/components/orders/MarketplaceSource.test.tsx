import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useState } from 'react';
import { CreateOrderForm } from './CreateOrderForm';
import { OrderEditForm } from './OrderEditForm';
import { marketplaceSourceOrder } from '../../constants';
import { displayOrderNumber } from '../../utils/order-number';
import type { UpdateOrderDto } from '../../types';
import { ordersApi } from '../../api/orders';

/**
 * Источник заказа с маркетплейса.
 *
 * Заказ на печать принта ведёт сама площадка: «местным» или авитошным он
 * быть не может. Раньше источник подставлялся молча при сохранении — в форме
 * оставалось «Авито», и сотрудник видел одно, а в заказ уходило другое.
 * Теперь отметка ставит Ozon на виду, а сохранение страхует выбор.
 */

vi.mock('../../api/orders', () => ({
  ordersApi: { create: vi.fn() },
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

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CreateOrderForm onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('источник заказа с маркетплейса', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('по умолчанию — Авито: основной ручной канал', () => {
    renderForm();
    const source = screen.getByLabelText('Источник заказа') as HTMLSelectElement;
    expect(source.value).toBe('AVITO');
  });

  it('отметка «Заказ с маркетплейса» ставит Ozon в самой форме', () => {
    renderForm();
    fireEvent.click(screen.getByText('Футболка с принтом'));
    fireEvent.click(screen.getByText('Заказ с маркетплейса'));
    const source = screen.getByLabelText('Источник заказа') as HTMLSelectElement;
    expect(source.value).toBe('OZON');
  });

  it('выбор остаётся за сотрудником: Wildberries не перебивается', () => {
    renderForm();
    fireEvent.click(screen.getByText('Футболка с принтом'));
    fireEvent.click(screen.getByText('Заказ с маркетплейса'));
    const source = screen.getByLabelText('Источник заказа') as HTMLSelectElement;
    fireEvent.change(source, { target: { value: 'WB' } });
    expect(source.value).toBe('WB');
    expect(marketplaceSourceOrder(source.value)).toBe('WB');
  });

  it('сохранение возвращает к Ozon всё, кроме Wildberries', () => {
    // Страховка от восстановленного черновика: там мог остаться источник,
    // выбранный до того, как заказ пометили маркетплейсом.
    expect(marketplaceSourceOrder('AVITO')).toBe('OZON');
    expect(marketplaceSourceOrder('LOCAL')).toBe('OZON');
    expect(marketplaceSourceOrder('WEBSITE')).toBe('OZON');
    expect(marketplaceSourceOrder(undefined)).toBe('OZON');
    expect(marketplaceSourceOrder('WB')).toBe('WB');
  });
});

describe('номер заказа на площадке', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('поле появляется только у заказа с маркетплейса', () => {
    renderForm();
    expect(
      screen.queryByLabelText('Номер заказа на площадке'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Футболка с принтом'));
    fireEvent.click(screen.getByText('Заказ с маркетплейса'));
    expect(screen.getByLabelText('Номер заказа на площадке')).toBeInTheDocument();
  });

  it('без номера заказ с площадки не создаётся', async () => {
    // Иначе заказ нельзя найти в кабинете, а лист согласования уйдёт
    // покупателю подписанным номером, которого он не знает.
    renderForm();
    fireEvent.click(screen.getByText('Футболка с принтом'));
    fireEvent.click(screen.getByText('Заказ с маркетплейса'));
    fireEvent.change(screen.getByPlaceholderText('@username'), {
      target: { value: '@client_test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Создать заявку/i }));
    expect(
      await screen.findByText(/Укажите номер заказа на площадке/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(ordersApi.create).not.toHaveBeenCalled();
    });
  });

  it('правка карточки даёт дописать номер уже созданному заказу', () => {
    // В момент оформления номер знают не всегда, а опечатка делает заказ
    // ненаходимым со стороны кабинета.
    function Form() {
      const [form, setForm] = useState<UpdateOrderDto>({
        communicationPlatform: 'TELEGRAM',
        deliveryMethod: 'PICKUP',
        marketplaceOrderNumber: '',
      });
      return (
        <OrderEditForm
          form={form}
          onChange={setForm}
          onSave={() => {}}
          onCancel={() => {}}
          isPending={false}
          productCategory="TSHIRT"
          orderTotal={1500}
          marketplacePrint
        />
      );
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Form />
      </QueryClientProvider>,
    );
    const field = screen.getByLabelText('Номер заказа на площадке');
    fireEvent.change(field, { target: { value: '0123-4567-8901' } });
    expect(field).toHaveValue('0123-4567-8901');
  });

  it('у обычного заказа поля номера площадки в правке нет', () => {
    function Form() {
      const [form, setForm] = useState<UpdateOrderDto>({
        communicationPlatform: 'TELEGRAM',
        deliveryMethod: 'PICKUP',
      });
      return (
        <OrderEditForm
          form={form}
          onChange={setForm}
          onSave={() => {}}
          onCancel={() => {}}
          isPending={false}
          productCategory="PHOTO"
          orderTotal={500}
        />
      );
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Form />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByLabelText('Номер заказа на площадке'),
    ).not.toBeInTheDocument();
  });

  it('заказ называется номером площадки, обычный — внутренним', () => {
    expect(
      displayOrderNumber({
        numberOrder: '20260925-001',
        marketplaceOrderNumber: '0123-4567-8901',
      }),
    ).toBe('0123-4567-8901');
    expect(displayOrderNumber({ numberOrder: '20260925-001' })).toBe(
      '20260925-001',
    );
    // Пустое значение — это отсутствие номера, а не номер из пустоты.
    expect(
      displayOrderNumber({
        numberOrder: '20260925-001',
        marketplaceOrderNumber: '  ',
      }),
    ).toBe('20260925-001');
  });
});
