import { matchesLineup, normalizeArticle } from './article-lineup';

/**
 * Узнавание своей линейки по артикулу.
 *
 * Цена ошибки здесь высокая и не видна сразу: не узнали артикул —
 * отправление пропало из списка, заказ не заведён, футболка не напечатана,
 * а площадка тем временем считает срок отгрузки и штрафует за срыв.
 */

const PAPA = ['papa-'];

describe('своя линейка', () => {
  it('латиницей — как писали всегда', () => {
    expect(matchesLineup('papa-black-M', PAPA)).toBe(true);
  });

  it('кириллицей — то же слово, та же линейка', () => {
    // Русская раскладка: для площадки это другая строка, для нас — нет.
    expect(matchesLineup('ПАПА-black-M', PAPA)).toBe(true);
    expect(matchesLineup('папа-white-XXL', PAPA)).toBe(true);
  });

  it('вперемешку тоже узнаём', () => {
    // Буквы «а», «р», «о», «с», «е» в двух алфавитах выглядят одинаково,
    // и такую опечатку никто не замечает глазами.
    expect(matchesLineup('pАpА-black-S', PAPA)).toBe(true);
    expect(matchesLineup('ПAПA-white-M', PAPA)).toBe(true);
  });

  it('регистр не важен', () => {
    expect(matchesLineup('PAPA-BLACK-L', PAPA)).toBe(true);
    expect(matchesLineup('Papa-black-l', PAPA)).toBe(true);
  });

  it('пробелы по краям не мешают', () => {
    expect(matchesLineup('  papa-black-M ', PAPA)).toBe(true);
  });

  it('чужая линейка остаётся чужой', () => {
    expect(matchesLineup('labrov-nadpis-black-L', PAPA)).toBe(false);
    expect(matchesLineup('JDM-1-1-black-S', PAPA)).toBe(false);
  });

  it('похожее начало без дефиса не считается своим', () => {
    // «papatya-...» — другой товар, и печатать его по нашему макету нельзя.
    expect(matchesLineup('papatya-black-M', PAPA)).toBe(false);
  });

  it('пустой артикул не подходит ни к чему', () => {
    expect(matchesLineup('', PAPA)).toBe(false);
    expect(matchesLineup(null, PAPA)).toBe(false);
    expect(matchesLineup(undefined, PAPA)).toBe(false);
  });

  it('список начал пуст — показываем всё, а не прячем всё', () => {
    // Фильтр по умолчанию не должен уметь оставить человека без заказов.
    expect(matchesLineup('что-угодно', [])).toBe(true);
  });

  it('начало линейки тоже можно задать кириллицей', () => {
    expect(matchesLineup('papa-black-M', ['ПАПА-'])).toBe(true);
  });
});

describe('приведение артикула к сравнимому виду', () => {
  it('кириллица превращается в латиницу, регистр снимается', () => {
    expect(normalizeArticle('ПАПА-Black-M')).toBe('papa-black-m');
  });

  it('буквы без латинского двойника остаются как есть', () => {
    // «ж» и «ю» ни на что не похожи — подменять их нечем, и чужая линейка
    // от этого своей не станет.
    expect(normalizeArticle('жю-black-M')).toBe('жю-black-m');
  });

  it('пусто остаётся пустым', () => {
    expect(normalizeArticle(null)).toBe('');
  });
});
