import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ItemsTable } from './ItemsTable';
import { PAPER_TYPE_STYLES } from '../../utils/paper-type';
import type { ItemPhoto, OrderPhoto } from '../../types/index';

/**
 * Матовая бумага в таблице позиций.
 *
 * По умолчанию печатаем глянец, и матовый заказ легко напечатать «как
 * обычно»: слово «Матт» серым текстом в ряду серых ячеек такую ошибку не
 * останавливает. Поэтому у типа бумаги свой цвет строки и свой бейдж, а
 * в заголовке — сколько всего матовых снимков.
 */

vi.mock('../../api/orders', () => ({
  ordersApi: {
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
  },
}));
vi.mock('../../context/useAuth', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }));

function item(over: Partial<ItemPhoto>): ItemPhoto {
  return {
    id: over.id ?? 'i1',
    createdAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '2026-11-08T09:00:00.000Z',
    orderId: 'o1',
    formatPaper: '10×15',
    typePaper: 'GLOSS',
    quantity: 10,
    price: 15,
    pricePosition: 150,
    ...over,
  } as ItemPhoto;
}

function show(items: ItemPhoto[], over: Partial<OrderPhoto> = {}) {
  const order = { id: 'o1', items, ...over } as OrderPhoto;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ItemsTable order={order} />
    </QueryClientProvider>,
  );
}

/** Класс строки позиции с этим форматом. */
function rowClass(container: HTMLElement, format: string): string {
  const cell = screen.getByText(format);
  const row = cell.closest('tr');
  expect(row).toBeTruthy();
  expect(container.contains(row)).toBe(true);
  return row!.className;
}

describe('тип бумаги в позициях', () => {
  it('матовая строка окрашена не так, как глянцевая', () => {
    const { container } = show([
      item({ id: 'g', formatPaper: '10×15', typePaper: 'GLOSS' }),
      item({ id: 'm', formatPaper: 'Polaroid', typePaper: 'MATTE' }),
    ]);
    expect(rowClass(container, 'Polaroid')).toContain(PAPER_TYPE_STYLES.MATTE.row);
    expect(rowClass(container, '10×15')).toContain(PAPER_TYPE_STYLES.GLOSS.row);
    expect(rowClass(container, '10×15')).not.toContain(PAPER_TYPE_STYLES.MATTE.row);
  });

  it('в заголовке сказано, сколько матовых снимков печатать', () => {
    show([
      item({ id: 'g', formatPaper: '10×15', typePaper: 'GLOSS', quantity: 100 }),
      item({ id: 'm', formatPaper: 'Polaroid', typePaper: 'MATTE', quantity: 12 }),
    ]);
    expect(screen.getByText('Матт — 12 шт')).toBeInTheDocument();
  });

  it('заказ целиком глянцевый — подписи про матт нет', () => {
    // Иначе на неё перестанут смотреть, а она и есть весь смысл затеи.
    show([item({ formatPaper: '10×15', typePaper: 'GLOSS' })]);
    expect(screen.queryByText(/Матт —/)).toBeNull();
  });

  it('позиция со свободной ценой остаётся без цвета и с прочерком', () => {
    const { container } = show([
      item({ id: 'f', formatPaper: 'Фотоальбом', typePaper: 'GLOSS', isFreePrice: true }),
    ]);
    const cls = rowClass(container, 'Фотоальбом');
    expect(cls).not.toContain(PAPER_TYPE_STYLES.GLOSS.row);
    expect(cls).not.toContain(PAPER_TYPE_STYLES.MATTE.row);
    // Прочерк именно в колонке «Тип» (вторая ячейка строки), а не в цене.
    const cells = screen.getByText('Фотоальбом').closest('tr')!.querySelectorAll('td');
    expect(cells[1].textContent).toBe('—');
  });

  it('в заказе со свободной ценой колонки типа нет — и красить нечего', () => {
    const { container } = show(
      [item({ formatPaper: 'Съёмка', typePaper: 'MATTE' })],
      { isFreePrice: true },
    );
    expect(screen.queryByText('Матт')).toBeNull();
    expect(rowClass(container, 'Съёмка')).not.toContain(PAPER_TYPE_STYLES.MATTE.row);
  });
});
