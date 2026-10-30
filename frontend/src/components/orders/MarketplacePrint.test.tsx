import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarketplacePrintStrip } from './MarketplacePrintStrip';
import {
  hasConfusablePrints,
  marketplacePrint,
  pluralShirts,
  printKey,
  printScript,
} from '../../utils/marketplace-print';
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

describe('один код в двух алфавитах', () => {
  it('«ПАПА» и «papa» — одно и то же слово', () => {
    // Сравнением строк это не поймать: для машины у них не совпадает
    // ни одна буква.
    expect(printKey('ПАПА')).toBe(printKey('papa'));
  });

  it('разные принты остаются разными', () => {
    expect(printKey('JDM-1-1')).not.toBe(printKey('ПАПА'));
    expect(hasConfusablePrints(['JDM-1-1', 'ПАПА'])).toBe(false);
  });

  it('оба алфавита в одном заказе — находим', () => {
    expect(hasConfusablePrints(['ПАПА', 'papa'])).toBe(true);
  });

  it('два одинаковых макета путаницей не считаются', () => {
    // Две футболки одного принта разного цвета — обычный заказ.
    expect(hasConfusablePrints(['papa', 'papa'])).toBe(false);
  });

  it('футболки склоняются по-русски', () => {
    expect(pluralShirts(1)).toBe('футболка');
    expect(pluralShirts(2)).toBe('футболки');
    expect(pluralShirts(5)).toBe('футболок');
    expect(pluralShirts(11)).toBe('футболок');
    expect(pluralShirts(22)).toBe('футболки');
  });
});

const order = (...articles: string[]): OrderPhoto =>
  ({
    tshirtItems: articles.map((article, i) => ({
      id: `i${i}`,
      color: 'Чёрный',
      size: 'XXL',
      quantity: 1,
      marketplaceArticle: article,
    })),
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

describe('заказ больше чем на одну футболку', () => {
  it('число футболок названо в заголовке', () => {
    // Заказ на две выглядел точно так же, как на одну, — и читался
    // как одна.
    render(<MarketplacePrintStrip order={order('papa-black-L', 'papa-white-XL')} />);
    expect(screen.getByText(/2 футболки в заказе/)).toBeInTheDocument();
  });

  it('два макета в одном алфавите — предупреждение без паники', () => {
    render(<MarketplacePrintStrip order={order('papa-black-L', 'JDM-1-1-black-S')} />);
    expect(screen.getByText(/2 разных макета/)).toBeInTheDocument();
  });

  it('ПАПА и papa в одном заказе — самая громкая тревога', () => {
    render(<MarketplacePrintStrip order={order('ПАПА-black-L', 'papa-white-XL')} />);
    expect(
      screen.getByText(/оба макета сразу — и кириллицей, и латиницей/),
    ).toBeInTheDocument();
  });

  it('позиции пронумерованы, когда их несколько', () => {
    render(<MarketplacePrintStrip order={order('ПАПА-black-L', 'papa-white-XL')} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('на заказе из одной футболки номера и предупреждений нет', () => {
    // Лишняя разметка на каждом обычном заказе превращается в шум,
    // который перестают замечать — вместе с настоящей тревогой.
    render(<MarketplacePrintStrip order={order('papa-black-XXL')} />);
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.queryByText(/разных макета/)).not.toBeInTheDocument();
    expect(screen.getByText('Макет')).toBeInTheDocument();
  });

  it('две одинаковые футболки одной позицией всё равно считаются двумя', () => {
    const two = {
      tshirtItems: [
        {
          id: 'i1',
          color: 'Чёрный',
          size: 'XXL',
          quantity: 2,
          marketplaceArticle: 'papa-black-XXL',
        },
      ],
    } as unknown as OrderPhoto;
    render(<MarketplacePrintStrip order={two} />);
    expect(screen.getByText(/2 футболки в заказе/)).toBeInTheDocument();
  });
});
