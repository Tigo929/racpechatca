import { describe, expect, it } from 'vitest';
import {
  PAPER_TYPE_STYLES,
  mattePhotoCount,
  paperTypeStyle,
} from './paper-type';

/**
 * Цвет типа бумаги.
 *
 * Проверяем не оттенок, а смысл: у глянца и матта цвета обязаны
 * различаться, у позиции со свободной ценой цвета нет вовсе, а счётчик
 * матовых снимков считает снимки, а не строки. Если глянец и матт когда-
 * нибудь сольются в один цвет, матовый заказ снова напечатают на глянце —
 * ровно то, от чего эти цвета и заведены.
 */

describe('цвета типа бумаги', () => {
  it('глянец и матт различимы — иначе цвет бесполезен', () => {
    expect(PAPER_TYPE_STYLES.GLOSS.badge).not.toBe(PAPER_TYPE_STYLES.MATTE.badge);
    expect(PAPER_TYPE_STYLES.GLOSS.row).not.toBe(PAPER_TYPE_STYLES.MATTE.row);
    expect(PAPER_TYPE_STYLES.GLOSS.field).not.toBe(PAPER_TYPE_STYLES.MATTE.field);
  });

  it('подписи берутся из общего словаря, а не вписаны заново', () => {
    expect(PAPER_TYPE_STYLES.GLOSS.label).toBe('Глянец');
    expect(PAPER_TYPE_STYLES.MATTE.label).toBe('Матт');
  });

  it('у каждого типа свой цвет', () => {
    expect(paperTypeStyle({ typePaper: 'GLOSS' })).toBe(PAPER_TYPE_STYLES.GLOSS);
    expect(paperTypeStyle({ typePaper: 'MATTE' })).toBe(PAPER_TYPE_STYLES.MATTE);
  });

  it('позиция со свободной ценой цвета не получает', () => {
    // Там тип бумаги остался 'GLOSS' только потому, что поле обязательное:
    // печатать по нему ничего не будут, и «глянец» на фотоальбоме — вранье.
    expect(paperTypeStyle({ typePaper: 'GLOSS', isFreePrice: true })).toBeNull();
  });

  it('незнакомый тип не красим, а не падаем', () => {
    expect(paperTypeStyle({ typePaper: 'SATIN' })).toBeNull();
    expect(paperTypeStyle({ typePaper: '' })).toBeNull();
  });
});

describe('сколько матовой бумаги готовить', () => {
  it('считает снимки, а не строки', () => {
    expect(
      mattePhotoCount([
        { typePaper: 'MATTE', quantity: 20 },
        { typePaper: 'MATTE', quantity: 5 },
      ]),
    ).toBe(25);
  });

  it('глянцевые позиции в счёт не идут', () => {
    expect(
      mattePhotoCount([
        { typePaper: 'GLOSS', quantity: 100 },
        { typePaper: 'MATTE', quantity: 4 },
      ]),
    ).toBe(4);
  });

  it('матовых нет — ноль, подписи не будет', () => {
    expect(mattePhotoCount([{ typePaper: 'GLOSS', quantity: 30 }])).toBe(0);
    expect(mattePhotoCount([])).toBe(0);
  });

  it('свободная позиция в счёт не идёт даже с типом MATTE', () => {
    expect(
      mattePhotoCount([{ typePaper: 'MATTE', quantity: 3, isFreePrice: true }]),
    ).toBe(0);
  });
});
