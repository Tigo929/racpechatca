import { describe, expect, it } from 'vitest';
import { getDeadlineInfo, tracksDeadline } from './deadline';

/**
 * Когда у заказа идёт отсчёт срока.
 *
 * Обращение — это ещё не заказ: с человеком не договорились, работа не
 * начата. Надпись «просрочено на два дня» на такой заявке пугает тревогой,
 * на которую нечем ответить, и обесценивает ту же надпись на настоящих
 * заказах.
 */
describe('у кого идёт отсчёт срока', () => {
  it('у обращения отсчёта нет', () => {
    expect(tracksDeadline({ productCategory: 'PHOTO', status: 'LEAD' })).toBe(
      false,
    );
  });

  it('то же обращение в работе уже считается', () => {
    expect(tracksDeadline({ productCategory: 'PHOTO', status: 'NEW' })).toBe(
      true,
    );
  });

  it('у футболок срока нет вовсе: его ведёт партнёр', () => {
    expect(tracksDeadline({ productCategory: 'TSHIRT', status: 'NEW' })).toBe(
      false,
    );
  });

  it('холст считается, как и фото', () => {
    expect(tracksDeadline({ productCategory: 'CANVAS', status: 'READY' })).toBe(
      true,
    );
  });
});

describe('подпись срока', () => {
  const inDays = (days: number) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  it('срок на будущее — спокойный зелёный', () => {
    const info = getDeadlineInfo(inDays(5));
    expect(info.rowClass).toContain('emerald');
  });

  it('просроченный срок назван словами', () => {
    expect(getDeadlineInfo(inDays(-2)).label).toMatch(/просроч/i);
  });

  it('без срока и без даты создания подписи нет', () => {
    expect(getDeadlineInfo(null).label).toBe('');
  });
});
