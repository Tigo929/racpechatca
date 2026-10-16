import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerMarkdown } from './AnswerMarkdown';

/**
 * Ответ агента должен читаться, а не расшифровываться.
 *
 * Модель отвечает разметкой: таблицами сводит деньги, в обратных кавычках
 * даёт путь к файлу. Пока это показывалось как есть, человек видел
 * «**Выручка** | 264 685 ₽ |» и сам искал в этом число. Поэтому проверяем
 * не «есть ли текст», а превратилась ли разметка в настоящие элементы.
 */
describe('ответ агента', () => {
  it('таблица становится таблицей', () => {
    render(
      <AnswerMarkdown
        text={'| Что | Факт |\n|---|---|\n| Выручка | 264 685 ₽ |\n| Чек | 1 776 ₽ |'}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Факт' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '264 685 ₽' })).toBeInTheDocument();
  });

  it('жирное становится жирным, а не звёздочками', () => {
    const { container } = render(<AnswerMarkdown text="**Выручка** за месяц" />);
    expect(container.querySelector('strong')?.textContent).toBe('Выручка');
    expect(container.textContent).not.toContain('**');
  });

  it('путь к файлу остаётся моноширинным — его копируют', () => {
    const { container } = render(
      <AnswerMarkdown text="Смотри `crm-new/src/order-photo/order-photo.service.ts`" />,
    );
    expect(container.querySelector('code')?.textContent).toContain('order-photo.service.ts');
  });

  it('список становится списком', () => {
    const { container } = render(<AnswerMarkdown text={'- первый\n- второй'} />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('html из ответа не выполняется', () => {
    // Агент пересказывает чужие данные — примечания клиентов, названия
    // товаров. Вставлять это как разметку страницы нельзя.
    const { container } = render(
      <AnswerMarkdown text={'<img src=x onerror="alert(1)">Примечание клиента'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Примечание клиента');
  });
});
