import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useState } from 'react';
import { StatusStepper } from './StatusStepper';
import { OrderEditForm } from './OrderEditForm';
import type { OrderPhoto, UpdateOrderDto } from '../../types';

vi.mock('../../context/useAuth', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));
vi.mock('../../api/partnerSettings', () => ({ partnerSettingsApi: { get: async () => ({ deliveryPriceYandexPvz: 300 }) } }));
vi.mock('../../api/canvasProduction', () => ({ canvasProductionApi: { pricing: async () => ({ delivery: { price: 800, cost: 700 } }) } }));
function wrap(child: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{child}</QueryClientProvider>);
}
it.each(['CANVAS', 'TSHIRT'] as const)('%s pickup has no shipment step and can close after readiness', (productCategory) => {
  wrap(<StatusStepper order={{ id: 'order', productCategory, deliveryMethod: 'PICKUP', status: 'READY' } as OrderPhoto} />);
  expect(screen.queryByRole('button', { name: 'Отгрузка создана' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Готов к выдаче' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('button', { name: 'Оплачен' })).toBeEnabled();
});
it('photo pickup requires handover before financial closure', () => {
  wrap(<StatusStepper order={{ id: 'order', productCategory: 'PHOTO', deliveryMethod: 'PICKUP', status: 'READY', executorId: 'executor' } as OrderPhoto} />);
  expect(screen.getByRole('button', { name: 'Выдан клиенту' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Оплачен' })).toBeDisabled();
});
it('canvas courier can create shipment after readiness', () => {
  wrap(<StatusStepper order={{ id: 'order', productCategory: 'CANVAS', deliveryMethod: 'PRODUCTION_MSK', status: 'READY' } as OrderPhoto} />);
  expect(screen.getByRole('button', { name: 'Отгрузка создана' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Оплачен' })).toBeDisabled();
});
it('editing a canvas preserves the production courier option and clears pickup charges', () => {
  function Form() {
    const [form, setForm] = useState<UpdateOrderDto>({ deliveryMethod: 'PRODUCTION_MSK', deliveryCost: 800, communicationPlatform: 'TELEGRAM' });
    return <OrderEditForm form={form} onChange={setForm} onSave={() => {}} onCancel={() => {}} isPending={false} productCategory="CANVAS" orderTotal={1800} />;
  }
  wrap(<Form />);
  const delivery = screen.getAllByRole('combobox')[1];
  expect(delivery).toHaveValue('PRODUCTION_MSK');
  expect(screen.getByRole('option', { name: 'Доставка производства (Москва)' })).toBeInTheDocument();
  fireEvent.change(delivery, { target: { value: 'PICKUP' } });
  expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(0);
  expect(screen.getAllByRole('spinbutton')[0]).toHaveAttribute('readonly');
});
