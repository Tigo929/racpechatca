import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketplacePrintStrip } from './MarketplacePrintStrip';
import { marketplacePrint, printScript } from '../../utils/marketplace-print';
import type { OrderPhoto } from '../../types/index';

/**
 * Какой макет печатаем.
 *
 * «ПАПА» кириллицей и «papa» латиницей — разные принты с одинаково
 * выглядящими кодами. Перепутать их значит напечатать не то, что
 * купили: заготовка списана, посылка уехала с чужим принтом. Проверяется
 * то единственное, что от этого спасает, — алфавит, названный словом.
 */

describe('код принта из артикула', () => {
  it('разбирается с конца: цвет и размер отрезаются', () => {
    // В коде принта дефисов сколько угодно — «JDM-1-1».
    expect(marketplacePrint('JDM-1-1-black-S')?.slug).toBe('JDM-1-1');
    expect(marketplacePrint('ПАПА-black-XXL')?.slug).toBe('ПАПА');
  });

  it('алфавит различается', () => {
    expect(printScript('ПАПА')).toBe('cyrillic');
    expect(printScript('papa')).toBe('latin');
  });

  it('буквы двух алфавитов в одном коде — отдельный случай', () => {
    // Так выглядит опечатка в карточке маркетплейса: «papa» с
    // кириллической «а». По такому коду макет не найдётся.
    expect(printScript('pаpa')).toBe('mixed');
  });

  it('артикул не по схеме не разбирается, а не угадывается', () => {
    expect(marketplacePrint('sticker-pack')).toBeNull();
    expect(marketplacePrint('')).toBeNull();
    expect(marketplacePrint(null)).toBeNull();
  });
});

const order = (article: string): OrderPhoto =>
  ({
    tshirtItems: [
      {
        id: 'i1',
        color: 'Чёрный',
        size: 'XXL',
        quantity: 1,
        marketplaceArticle: article,
      },
    ],
  }) as unknown as OrderPhoto;

describe('полоса макета в карточке', () => {
  it('называет алфавит словом, а не только показывает буквы', () => {
    render(<MarketplacePrintStrip order={order('ПАПА-black-XXL')} />);
    expect(screen.getByText('ПАПА')).toBeInTheDocument();
    expect(screen.getByText('кириллица')).toBeInTheDocument();
  });

  it('латинский код подписан своим алфавитом', () => {
    render(<MarketplacePrintStrip order={order('papa-black-XXL')} />);
    expect(screen.getByText('латиница')).toBeInTheDocument();
  });

  it('состав виден рядом — таблицу позиций он заменяет', () => {
    render(<MarketplacePrintStrip order={order('papa-black-XXL')} />);
    expect(screen.getByText(/Чёрный · XXL\(54\) · 1 шт/)).toBeInTheDocument();
  });

  it('смешанный алфавит объясняется прямо', () => {
    render(<MarketplacePrintStrip order={order('pаpa-black-XXL')} />);
    expect(screen.getByText(/похоже на опечатку/)).toBeInTheDocument();
  });

  it('объяснение про алфавиты не висит на каждом заказе', () => {
    // На коде из цифр путать нечего, а лишняя строка на каждой карточке
    // превращается в строку, которую перестают замечать.
    render(<MarketplacePrintStrip order={order('777-black-XXL')} />);
    expect(screen.queryByText(/разные макеты/)).not.toBeInTheDocument();
  });

  it('без артикула полоса не выдумывает подпись', () => {
    const { container } = render(
      <MarketplacePrintStrip order={order('sticker-pack')} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
