import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ClientTextFallback } from './ClientTextFallback';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

describe('окно «текст клиенту», когда буфер не дался', () => {
  it('показывает текст целиком', () => {
    render(<ClientTextFallback text="Здравствуйте! Ваш заказ готов." title="Готовность" onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Здравствуйте! Ваш заказ готов.')).toBeInTheDocument();
  });

  it('на телефоне — «Поделиться» отдаёт текст в системное меню отправки', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    render(<ClientTextFallback text="Текст" title="Готовность" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Поделиться/ }));
    expect(share).toHaveBeenCalledWith({ text: 'Текст' });
    Reflect.deleteProperty(navigator, 'share');
  });
});
