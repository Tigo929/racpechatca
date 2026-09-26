import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { OrderNavigator } from './OrderNavigator';
import { useArrowNavigation, useOrderNavigation } from './useOrderNavigation';

/**
 * Ход по заказам из открытой карточки.
 *
 * Проверяем не кнопки, а обещание: «следующий» — это тот заказ, который
 * стоит следующим в списке на экране, даже когда он лежит на другой
 * странице. Иначе человек, который смотрит заказы подряд, доходит до конца
 * страницы и снова остаётся один на один со списком.
 */

const PAGE_SIZE = 3;

/** Три страницы по три заказа: a1..a3, b1..b3, c1..c3. */
const pages: Record<number, { id: string }[]> = {
  1: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
  2: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
  3: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
};

function Harness({ startId = 'a1', startPage = 1 }: { startId?: string; startPage?: number }) {
  const [page, setPage] = useState(startPage);
  const [selectedId, setSelectedId] = useState<string | null>(startId);
  const orders = pages[page];
  const nav = useOrderNavigation({
    orders,
    selectedId,
    onSelect: setSelectedId,
    page,
    totalPages: 3,
    totalItems: 9,
    pageSize: PAGE_SIZE,
    onPageChange: setPage,
    isFetching: false,
  });
  useArrowNavigation(!!selectedId, nav);
  return (
    <div>
      <span data-testid="selected">{selectedId ?? 'нет'}</span>
      <OrderNavigator
        position={nav.position}
        total={nav.total}
        canPrev={nav.canPrev}
        canNext={nav.canNext}
        onPrev={nav.prev}
        onNext={nav.next}
        busy={nav.busy}
      />
      <input aria-label="поле" />
    </div>
  );
}

const selected = () => screen.getByTestId('selected').textContent;
const next = () => screen.getByRole('button', { name: 'Следующий заказ' });
const prev = () => screen.getByRole('button', { name: 'Предыдущий заказ' });

describe('переход между заказами', () => {
  it('ведёт по списку и показывает место во всей выборке', () => {
    render(<Harness />);
    expect(screen.getByText('1 из 9')).toBeInTheDocument();
    fireEvent.click(next());
    expect(selected()).toBe('a2');
    expect(screen.getByText('2 из 9')).toBeInTheDocument();
    fireEvent.click(prev());
    expect(selected()).toBe('a1');
  });

  it('на краю страницы переходит на соседнюю, а не упирается', () => {
    // Ради этого всё и делалось: страницы — устройство списка, а смотрят
    // заказы подряд.
    render(<Harness startId="a3" />);
    fireEvent.click(next());
    expect(selected()).toBe('b1');
    expect(screen.getByText('4 из 9')).toBeInTheDocument();
  });

  it('назад с начала страницы открывает последний заказ предыдущей', () => {
    render(<Harness startId="b1" startPage={2} />);
    fireEvent.click(prev());
    expect(selected()).toBe('a3');
    expect(screen.getByText('3 из 9')).toBeInTheDocument();
  });

  it('на первом заказе выборки назад нельзя, на последнем — вперёд', () => {
    render(<Harness startId="a1" />);
    expect(prev()).toBeDisabled();
    expect(next()).toBeEnabled();
  });

  it('последний заказ выборки закрывает движение вперёд', () => {
    render(<Harness startId="c3" startPage={3} />);
    expect(next()).toBeDisabled();
    expect(prev()).toBeEnabled();
  });

  it('стрелки на клавиатуре делают то же, что кнопки', () => {
    render(<Harness />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(selected()).toBe('a2');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(selected()).toBe('a1');
  });

  it('в поле ввода стрелки остаются стрелками', () => {
    // В правке заказа те же клавиши двигают курсор по тексту; перехватить их
    // там значит сломать ввод.
    render(<Harness />);
    const field = screen.getByLabelText('поле');
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(selected()).toBe('a1');
  });

  it('счётчик исчезает, если открытого заказа в списке больше нет', () => {
    // Сменили фильтр при открытой карточке: «0 из 9» и мёртвые стрелки
    // человеку ничего не говорят.
    render(
      <OrderNavigator
        position={0}
        total={9}
        canPrev={false}
        canNext={false}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Следующий заказ' })).not.toBeInTheDocument();
  });

  it('единственный заказ обходится без стрелок', () => {
    render(
      <OrderNavigator
        position={1}
        total={1}
        canPrev={false}
        canNext={false}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Следующий заказ' })).not.toBeInTheDocument();
  });
});
