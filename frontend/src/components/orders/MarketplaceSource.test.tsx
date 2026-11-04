import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useState } from 'react';
import { CreateOrderForm } from './CreateOrderForm';
import { OrderEditForm } from './OrderEditForm';
import { displayOrderNumber } from '../../utils/order-number';
import type { UpdateOrderDto } from '../../types';

/**
 * Заказ с маркетплейса в ручной форме — и почему его там больше нет.
 *
 * Отправления заводит в CRM сам раздел маркетплейсов: он знает номер
 * отправления, кабинет и состав заказа. Галочка «Заказ с маркетплейса» в
 * ручной форме делала то же самое с чужих слов — номер набирали руками, и
 * опечатка делала заказ ненаходимым со стороны кабинета, а кабинета и
 * отправления у такого заказа не было вовсе: ни автосборка, ни отметка
 * выкупа, ни просьба об отзыве его не касались.
 *
 * Поэтому в форме её нет (решение владельца 04.11.2026), и первая проверка
 * здесь сторожит именно отсутствие. Правка карточки — другое дело: заказ,
 * заведённый из кабинета, по-прежнему правят, и эти проверки остались.
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

  it('Ozon и Wildberries выбрать нельзя: такой заказ приходит из кабинета', () => {
    /*
     * Выставленный руками источник площадки заводил заказ-двойник: без
     * отправления и кабинета, но в воронке Ozon — и сверка с кабинетом
     * расходилась на него.
     */
    renderForm();
    const source = screen.getByLabelText('Источник заказа') as HTMLSelectElement;
    expect(Array.from(source.options).map((o) => o.value)).toEqual([
      'AVITO',
      'LOCAL',
      'WEBSITE',
    ]);
  });

  it('галочки «Заказ с маркетплейса» в форме нет — ни у одной категории', () => {
    /*
     * Заказ с площадки заводится из раздела маркетплейсов: там есть номер
     * отправления, кабинет и состав. Набранный руками он выглядел так же,
     * но отправления за ним не стояло — и автосборка, отметка выкупа и
     * просьба об отзыве проходили мимо него.
     */
    renderForm();
    expect(screen.queryByText('Заказ с маркетплейса')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Футболка с принтом'));
    expect(screen.queryByText('Заказ с маркетплейса')).not.toBeInTheDocument();
    // И поля её номера тоже: набирать его в ручной форме больше негде.
    expect(
      screen.queryByLabelText('Номер заказа на площадке'),
    ).not.toBeInTheDocument();
  });

  it('у футболки остались деньги: доставка, срочность, скидка, цена', () => {
    /*
     * Галочка прятала всё это. Убрав её, легко было вместе с ней убрать и
     * показ полей — тогда футболку нельзя было бы продать вообще.
     */
    renderForm();
    fireEvent.click(screen.getByText('Футболка с принтом'));
    expect(screen.getByText('Способ доставки')).toBeInTheDocument();
    expect(screen.getByLabelText('Скидка клиенту, ₽')).toBeInTheDocument();
    expect(screen.getByText('Срочность заказа')).toBeInTheDocument();
    expect(screen.getByText('Требуется разработать дизайн')).toBeInTheDocument();
    expect(screen.getByText(/Цена ₽/)).toBeInTheDocument();
  });
});

/** Правка карточки: форма живёт в состоянии, как в самой панели. */
function renderEdit({
  form: initial,
  marketplacePrint = true,
  marketplacePostingNumber = null,
  productCategory = 'TSHIRT',
}: {
  form: UpdateOrderDto;
  marketplacePrint?: boolean;
  marketplacePostingNumber?: string | null;
  productCategory?: 'PHOTO' | 'TSHIRT' | 'CANVAS';
}) {
  function Form() {
    const [form, setForm] = useState<UpdateOrderDto>(initial);
    return (
      <OrderEditForm
        form={form}
        onChange={setForm}
        onSave={() => {}}
        onCancel={() => {}}
        isPending={false}
        productCategory={productCategory}
        orderTotal={1500}
        marketplacePrint={marketplacePrint}
        marketplacePostingNumber={marketplacePostingNumber}
      />
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>,
  );
}

describe('номер заказа на площадке', () => {
  beforeEach(() => {
    sessionStorage.clear();
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

  it('номер из отправления Ozon показан, но не правится', () => {
    /*
      Номер выдал Ozon. Правка здесь разводит наш номер с тем, что стоит
      в кабинете, — и заказ становится ненаходимым ровно тогда, когда его
      ищут: при отгрузке и при разборе претензии.
    */
    renderEdit({
      form: {
        communicationPlatform: 'OZON',
        deliveryMethod: 'PICKUP',
        marketplaceOrderNumber: '0121078243-0040',
      },
      marketplacePostingNumber: '0121078243-0040-1',
    });
    const field = screen.getByLabelText('Номер заказа на площадке');
    expect(field).toHaveTextContent('0121078243-0040');
    expect(field.tagName).not.toBe('INPUT');
    expect(screen.queryByPlaceholderText('например 0123-4567-8901')).not.toBeInTheDocument();
  });

  it('у заказа с площадки нет доставки, скидки, срочности и предоплаты', () => {
    /*
      Деньги такого заказа считает Ozon: позиции заведены без цены, оплату
      площадка берёт сама. Проставленная вручную сумма попала бы в чек и
      в базу зарплаты, и заказ начал бы расходиться по деньгам с кабинетом.
    */
    renderEdit({
      form: { communicationPlatform: 'OZON', deliveryMethod: 'PICKUP', marketplaceOrderNumber: '0121078243-0040' },
      marketplacePostingNumber: '0121078243-0040-1',
      productCategory: 'TSHIRT',
    });
    expect(screen.queryByLabelText('Способ доставки')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Скидка клиенту')).not.toBeInTheDocument();
    expect(screen.queryByText('Срочный заказ')).not.toBeInTheDocument();
    expect(screen.queryByText('Клиент внёс предоплату')).not.toBeInTheDocument();
    expect(screen.queryByText('Нужен дизайн')).not.toBeInTheDocument();
    // Взамен — объяснение, а не пустое место.
    expect(screen.getByText(/ведёт Ozon/)).toBeInTheDocument();
  });

  it('у обычного заказа деньги на месте', () => {
    // Сторож на перестраховку: признак площадки не должен прятать поля
    // у обычного заказа.
    renderEdit({
      form: { communicationPlatform: 'TELEGRAM', deliveryMethod: 'PICKUP' },
      marketplacePrint: false,
      productCategory: 'TSHIRT',
    });
    expect(screen.getByLabelText('Способ доставки')).toBeInTheDocument();
    expect(screen.getByLabelText('Скидка клиенту')).toBeInTheDocument();
    expect(screen.getByText('Срочный заказ')).toBeInTheDocument();
    expect(screen.getByText('Клиент внёс предоплату')).toBeInTheDocument();
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

  it('у заказа из кабинета источник остался в списке правки', () => {
    /*
      Выбор сузился только для новых заказов. У заведённого из кабинета
      источник Ozon остаётся в списке: иначе правка соседнего поля молча
      переписала бы происхождение на «Авито», и заказ ушёл бы из воронки
      площадки в авитошную.
    */
    renderEdit({
      form: {
        communicationPlatform: 'OZON',
        deliveryMethod: 'PICKUP',
        sourceOrder: 'OZON',
      },
      marketplacePostingNumber: '0121078243-0040-1',
    });
    const source = screen.getByLabelText('Источник заказа') as HTMLSelectElement;
    expect(source.value).toBe('OZON');
    expect(Array.from(source.options).map((o) => o.value)).toContain('OZON');
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
