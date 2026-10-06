import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useOrderAutoAdvance } from './useOrderAutoAdvance';

/**
 * Карточка не закрывается, когда заказ ушёл из списка.
 *
 * Проверяем обещание, а не реализацию: на место ушедшего заказа встаёт тот,
 * который был под ним на экране. Если это сломать, работа по списку опять
 * превратится в поиск места после каждой смены статуса.
 */

interface HarnessProps {
  ids: string[];
  startId?: string | null;
  listKey?: string;
  isFetching?: boolean;
  busy?: boolean;
}

/**
 * Список приходит снаружи — ровно как от сервера после обновления. Повторный
 * render с другим `ids` и есть «заказ ушёл из выборки».
 */
function Harness({
  ids,
  startId = null,
  listKey = 'готово',
  isFetching = false,
  busy = false,
}: HarnessProps) {
  const [selectedId, setSelectedId] = useState<string | null>(startId);
  const { advanceFrom } = useOrderAutoAdvance({
    orders: ids.map((id) => ({ id })),
    selectedId,
    onSelect: setSelectedId,
    listKey,
    isFetching,
    busy,
  });
  return (
    <div>
      <span data-testid="selected">{selectedId ?? 'закрыто'}</span>
      <button onClick={() => selectedId && advanceFrom(selectedId)}>
        Удалить
      </button>
    </div>
  );
}

const selected = () => screen.getByTestId('selected').textContent;

describe('заказ ушёл из списка', () => {
  it('открывается следующий по списку', () => {
    const { rerender } = render(
      <Harness ids={['a', 'b', 'c']} startId="b" />,
    );
    expect(selected()).toBe('b');
    // Сменили статус: заказ больше не подходит под фильтр.
    rerender(<Harness ids={['a', 'c']} startId="b" />);
    expect(selected()).toBe('c');
  });

  it('ушёл последний на странице — открывается тот, кто подтянулся на его место', () => {
    // Так выглядит страница списка: ушедший был последним, снизу пришёл
    // первый заказ следующей страницы.
    const { rerender } = render(<Harness ids={['a', 'b', 'c']} startId="c" />);
    rerender(<Harness ids={['a', 'b', 'd']} startId="c" />);
    expect(selected()).toBe('d');
  });

  it('список закончился — карточка закрывается', () => {
    const { rerender } = render(<Harness ids={['a']} startId="a" />);
    rerender(<Harness ids={[]} startId="a" />);
    expect(selected()).toBe('закрыто');
  });

  it('следующий ищется по прежнему порядку, а не по месту в списке', () => {
    // Пока карточка была открыта, сверху появилась новая заявка. По месту
    // в списке мы бы открыли не того.
    const { rerender } = render(
      <Harness ids={['a', 'b', 'c', 'd']} startId="b" />,
    );
    rerender(<Harness ids={['новая', 'a', 'c', 'd']} startId="b" />);
    expect(selected()).toBe('c');
  });

  it('следующий тоже успел уйти — берём того, кто остался ниже', () => {
    const { rerender } = render(
      <Harness ids={['a', 'b', 'c', 'd']} startId="b" />,
    );
    rerender(<Harness ids={['a', 'd']} startId="b" />);
    expect(selected()).toBe('d');
  });

  it('смена фильтра не считается уходом заказа: карточку не трогаем', () => {
    // Человек сам сменил отбор и смотрит другой список. Прыжок по чужому
    // списку выглядел бы как потеря заказа.
    const { rerender } = render(
      <Harness ids={['a', 'b', 'c']} startId="b" listKey="готово" />,
    );
    rerender(<Harness ids={['x', 'y']} startId="b" listKey="оплачен" />);
    expect(selected()).toBe('b');
  });

  it('пока список в пути, никуда не переходим', () => {
    const { rerender } = render(<Harness ids={['a', 'b', 'c']} startId="b" />);
    rerender(<Harness ids={[]} startId="b" isFetching />);
    expect(selected()).toBe('b');
  });

  it('переход стрелками на другую страницу не путается с уходом заказа', () => {
    const { rerender } = render(<Harness ids={['a', 'b', 'c']} startId="b" />);
    rerender(<Harness ids={['d', 'e']} startId="b" busy />);
    expect(selected()).toBe('b');
  });

  it('только что созданную заявку не закрываем: её в списке и не было', () => {
    render(<Harness ids={['a', 'b']} startId="новая" />);
    expect(selected()).toBe('новая');
  });

  it('удаление: следующий открывается сразу, не дожидаясь списка', () => {
    render(<Harness ids={['a', 'b', 'c']} startId="b" />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(selected()).toBe('c');
  });

  it('удалили последний — карточка закрывается', () => {
    render(<Harness ids={['a', 'b']} startId="b" />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(selected()).toBe('закрыто');
  });

  it('после удаления обновлённый список не уводит ещё раз', () => {
    // Список приходит уже без удалённого заказа. Если считать это уходом
    // открытого заказа, человека перебросило бы через один.
    const { rerender } = render(<Harness ids={['a', 'b', 'c']} startId="b" />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(selected()).toBe('c');
    rerender(<Harness ids={['a', 'c']} startId="b" />);
    expect(selected()).toBe('c');
  });
});
