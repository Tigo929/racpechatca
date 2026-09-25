import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CreateOrderForm } from './CreateOrderForm';
import { marketplaceSourceOrder } from '../../constants';

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
