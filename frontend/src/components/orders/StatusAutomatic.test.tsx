import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { StatusStepper } from './StatusStepper';
import type { OrderPhoto } from '../../types';

/**
 * Шаги, которые ставит система.
 *
 * Проверяется ровно то, о чём просил владелец: по такому шагу нельзя
 * щёлкнуть мышкой — даже администратору, даже когда заказ стоит
 * непосредственно перед ним. Нажатие означало бы «считаем, что событие
 * произошло», а оно не произошло: исполнителю ничего не ушло, посылка
 * никуда не уехала.
 */

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ADMIN' } }),
}));
vi.mock('../../api/partnerSettings', () => ({
  partnerSettingsApi: { get: async () => ({ deliveryPriceYandexPvz: 300 }) },
}));

function wrap(child: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {child}
    </QueryClientProvider>,
  );
}

const marketplaceOrder = (status: string) =>
  ({
    id: 'order',
    productCategory: 'TSHIRT',
    isMarketplacePrint: true,
    deliveryMethod: 'PICKUP',
    status,
  }) as unknown as OrderPhoto;

it.each([
  ['Передан в производство', 'NEW'],
  ['В работе', 'SENT'],
  ['Отгружен', 'IN_PROGRESS'],
])('по шагу «%s» нельзя щёлкнуть мышкой', (label, status) => {
  wrap(<StatusStepper order={marketplaceOrder(status)} />);
  expect(screen.getByRole('button', { name: label })).toBeDisabled();
});

it('подсказка объясняет, чем именно ставится шаг', () => {
  wrap(<StatusStepper order={marketplaceOrder('NEW')} />);
  expect(
    screen.getByRole('button', { name: 'Передан в производство' }),
  ).toHaveAttribute('title', expect.stringContaining('ТЗ-фото'));
  expect(screen.getByRole('button', { name: 'Отгружен' })).toHaveAttribute(
    'title',
    expect.stringContaining('Ozon'),
  );
});

it('ручные шаги футболки остаются доступными', () => {
  // Запрет не должен разрастись: «На согласовании» ставит человек, и без
  // него заказ с площадки не сдвинуть с места вообще.
  wrap(<StatusStepper order={marketplaceOrder('NEW')} />);
  expect(screen.getByRole('button', { name: 'На согласовании' })).toBeEnabled();
});

it('у фото «Выдан клиенту» по-прежнему нажимается', () => {
  // Тот же EnumStatus.SENT, но смысл другой: выдача заказа клиенту, по
  // которой начисляется зарплата. Запрет сюда распространяться не должен.
  wrap(
    <StatusStepper
      order={
        {
          id: 'order',
          productCategory: 'PHOTO',
          deliveryMethod: 'PICKUP',
          status: 'READY',
          executorId: 'executor',
        } as unknown as OrderPhoto
      }
    />,
  );
  expect(screen.getByRole('button', { name: 'Выдан клиенту' })).toBeEnabled();
});
