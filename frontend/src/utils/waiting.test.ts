import { describe, it, expect } from 'vitest';
import {
  formatWaiting,
  waitingClass,
  waitingMs,
  waitingTone,
} from './waiting';

/**
 * Время ожидания заявки.
 *
 * Первые минуты решают, купит человек у нас или у того, кто ответил
 * быстрее. Ошибка здесь не ломает систему — она тихо стоит денег:
 * заявка, которая выглядит свежей, хотя висит второй час.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NOW = new Date('2026-10-16T12:00:00Z').getTime();

function lead(minutesAgo: number) {
  return {
    status: 'LEAD' as const,
    createdAt: new Date(NOW - minutesAgo * MIN).toISOString(),
  };
}

describe('счётчик ожидания', () => {
  it('считает время с момента заявки', () => {
    expect(waitingMs(lead(7), NOW)).toBe(7 * MIN);
  });

  it('у принятой в работу заявки счётчика нет', () => {
    // Дальше у заказа свой срок; второй таймер рядом только путал бы.
    expect(waitingMs({ ...lead(7), status: 'NEW' }, NOW)).toBeNull();
    expect(waitingMs({ ...lead(7), status: 'SENT' }, NOW)).toBeNull();
  });

  it('часы разошлись — показываем ноль, а не минус', () => {
    expect(waitingMs(lead(-5), NOW)).toBe(0);
  });

  it('битая дата не роняет список', () => {
    expect(waitingMs({ status: 'LEAD', createdAt: 'не дата' }, NOW)).toBeNull();
  });
});

describe('цвет ожидания', () => {
  it('до десяти минут — спокойный', () => {
    expect(waitingTone(3 * MIN)).toBe('fresh');
  });

  it('после десяти — пора ответить', () => {
    expect(waitingTone(12 * MIN)).toBe('soon');
  });

  it('после получаса — человек ждёт долго', () => {
    expect(waitingTone(45 * MIN)).toBe('late');
  });

  it('после двух часов — красный', () => {
    // Столько ждать никто не станет: заявка, скорее всего, уже чужая.
    expect(waitingTone(3 * HOUR)).toBe('lost');
    expect(waitingTone(30 * HOUR)).toBe('lost');
  });

  it('у каждой ступени свой цвет', () => {
    const tones = ['fresh', 'soon', 'late', 'lost'] as const;
    const classes = tones.map(waitingClass);
    expect(new Set(classes).size).toBe(tones.length);
  });
});

describe('подпись ожидания', () => {
  it('меньше минуты — «только что»', () => {
    expect(formatWaiting(20 * 1000)).toBe('только что');
  });

  it('минуты, часы и дни читаются как в разговоре', () => {
    expect(formatWaiting(7 * MIN)).toBe('7 мин');
    expect(formatWaiting(2 * HOUR + 15 * MIN)).toBe('2 ч 15 мин');
    expect(formatWaiting(3 * HOUR)).toBe('3 ч');
    expect(formatWaiting(27 * HOUR)).toBe('1 д 3 ч');
    expect(formatWaiting(48 * HOUR)).toBe('2 д');
  });
});
