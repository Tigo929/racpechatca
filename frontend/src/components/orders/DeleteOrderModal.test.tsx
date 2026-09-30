import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DeleteOrderModal } from './DeleteOrderModal';

/**
 * Удаление заявки — только с причиной.
 *
 * Ради этого всё и делается: раньше заказ исчезал по вопросу «Удалить?»,
 * и через месяц никто не мог сказать, почему заявок с сайта меньше, чем
 * визитов. Тесты сторожат именно обязательность причины.
 */

function show(onConfirm = vi.fn(), onCancel = vi.fn(), isPending = false) {
  render(
    <DeleteOrderModal
      orderNumber="20260930-1"
      isPending={isPending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

// Подпись меняется на «Удаляю…» во время запроса — ищем по роли и обеим.
const deleteButton = () =>
  screen.getByRole('button', { name: /Удалить$|Удаляю…/ });
const reasonField = () => screen.getByLabelText('Причина удаления');

describe('окно удаления заявки', () => {
  it('без причины удалить нельзя', () => {
    show();
    expect(deleteButton()).toBeDisabled();
  });

  it('отписка из пары знаков причиной не считается', () => {
    show();
    fireEvent.change(reasonField(), { target: { value: '  х ' } });
    expect(deleteButton()).toBeDisabled();
  });

  it('с причиной удаляет и отдаёт её текст', () => {
    const { onConfirm } = show();
    fireEvent.change(reasonField(), {
      target: { value: '  дубль заявки — клиент отправил дважды  ' },
    });
    expect(deleteButton()).toBeEnabled();
    fireEvent.click(deleteButton());
    // Пробелы по краям обрезаются: в статистике они дали бы две разные причины.
    expect(onConfirm).toHaveBeenCalledWith('дубль заявки — клиент отправил дважды');
  });

  it('номер заявки виден в заголовке — удаляют не глядя иначе', () => {
    show();
    expect(screen.getByText(/20260930-1/)).toBeInTheDocument();
  });

  it('во время удаления повторное нажатие не проходит', () => {
    const { onConfirm } = show(vi.fn(), vi.fn(), true);
    fireEvent.change(reasonField(), { target: { value: 'передумали' } });
    expect(deleteButton()).toBeDisabled();
    fireEvent.click(deleteButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('отмена ничего не удаляет', () => {
    const { onConfirm, onCancel } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
