import {
  buildStatusSummaryMessage,
  greetingForHour,
  StatusSummaryInput,
} from './status-summary-rules';

const baseStats: StatusSummaryInput = {
  activeCount: 12,
  matchingTotal: 16,
  leadCount: 2,
  newCount: 3,
  inProgressCount: 5,
  readyCount: 2,
  sentUnpaidCount: 1,
  sentUnpaidAmount: 4500,
  paidCount: 40,
  reviewPendingCount: 3,
  reviewRemindedCount: 1,
  overdueCount: 1,
  urgentCount: 1,
  alertCount: 2,
  byProduct: { PHOTO: 10, TSHIRT: 6 },
};

describe('greetingForHour', () => {
  it('утро < 12, день 12-17, вечер 18+', () => {
    expect(greetingForHour(9)).toBe('Доброе утро');
    expect(greetingForHour(14)).toBe('Добрый день');
    expect(greetingForHour(20)).toBe('Добрый вечер');
  });
});

describe('buildStatusSummaryMessage', () => {
  // Москва = UTC+3. 09:00 UTC -> 12:00 МСК.
  const NOW = new Date('2026-07-28T09:00:00Z');

  it('содержит заголовок, время и приветствие', () => {
    const msg = buildStatusSummaryMessage(baseStats, NOW);
    expect(msg).toContain('Сводка по заказам');
    expect(msg).toContain('28.07 12:00');
    expect(msg).toContain('Добрый день');
  });

  it('показывает разбивку по продуктам и основным статусам', () => {
    const msg = buildStatusSummaryMessage(baseStats, NOW);
    expect(msg).toContain('Фото: <b>10</b>');
    expect(msg).toContain('Футболки: <b>6</b>');
    expect(msg).toContain('Новых: <b>3</b>');
    expect(msg).toContain('В работе: <b>5</b>');
    expect(msg).toContain('Оплачено: <b>40</b>');
  });

  it('сумму неоплаченных отправок показывает только если она больше нуля', () => {
    const withAmount = buildStatusSummaryMessage(baseStats, NOW);
    // toLocaleString('ru-RU') разделяет тысячи неразрывным пробелом (не обычным).
    expect(withAmount).toContain(`${(4500).toLocaleString('ru-RU')} ₽`);

    const zeroAmount = buildStatusSummaryMessage(
      { ...baseStats, sentUnpaidCount: 0, sentUnpaidAmount: 0 },
      NOW,
    );
    expect(zeroAmount).not.toContain('₽');
  });

  it('блок «требуют внимания» только если alertCount > 0', () => {
    const withAlert = buildStatusSummaryMessage(baseStats, NOW);
    expect(withAlert).toContain('Требуют внимания');

    const noAlert = buildStatusSummaryMessage(
      { ...baseStats, alertCount: 0 },
      NOW,
    );
    expect(noAlert).not.toContain('Требуют внимания');
  });

  it('блок «без отзыва» только если reviewPendingCount > 0', () => {
    const withReview = buildStatusSummaryMessage(baseStats, NOW);
    expect(withReview).toContain('Без отзыва');

    const noReview = buildStatusSummaryMessage(
      { ...baseStats, reviewPendingCount: 0 },
      NOW,
    );
    expect(noReview).not.toContain('Без отзыва');

    const nullReview = buildStatusSummaryMessage(
      { ...baseStats, reviewPendingCount: null },
      NOW,
    );
    expect(nullReview).not.toContain('Без отзыва');
  });
});
