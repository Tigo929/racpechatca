import { EnumTaskStatus } from 'src/generated/prisma/enums';
import {
  buildDigestMessage,
  daysUntilDeadline,
  formatDeadlineLabel,
  isTaskDueForReminder,
  mentionFor,
  moscowDateKey,
  moscowHour,
  pluralDays,
} from './task-reminder-rules';

// 20 июля 2026, 07:00 UTC = 10:00 по Москве.
const NOW = new Date('2026-07-20T07:00:00Z');

describe('часовой пояс и календарные дни', () => {
  it('считает день и час по Москве, а не по UTC', () => {
    // 21:30 UTC — по Москве уже следующий день, 00:30.
    const lateUtc = new Date('2026-07-20T21:30:00Z');
    expect(moscowDateKey(lateUtc)).toBe('2026-07-21');
    expect(moscowHour(lateUtc)).toBe(0);
    expect(moscowHour(NOW)).toBe(10);
  });

  it('считает календарные дни, а не сутки по 24 часа', () => {
    // Срок сегодня в 23:00 по Москве — это «сегодня», а не «завтра».
    const todayLate = new Date('2026-07-20T20:00:00Z');
    expect(daysUntilDeadline(todayLate, NOW)).toBe(0);
    expect(formatDeadlineLabel(todayLate, NOW)).toBe('сегодня');
  });

  it('распознаёт просрочку и подписывает её по-русски', () => {
    const twoDaysAgo = new Date('2026-07-18T09:00:00Z');
    expect(daysUntilDeadline(twoDaysAgo, NOW)).toBe(-2);
    expect(formatDeadlineLabel(twoDaysAgo, NOW)).toBe('просрочено на 2 дня');
  });

  it('склоняет дни правильно', () => {
    expect(pluralDays(1)).toBe('день');
    expect(pluralDays(3)).toBe('дня');
    expect(pluralDays(5)).toBe('дней');
    expect(pluralDays(11)).toBe('дней');
    expect(pluralDays(21)).toBe('день');
  });
});

describe('кого включаем в дайджест', () => {
  const open = (deadline: Date | null) => ({
    status: EnumTaskStatus.OPEN,
    deadline,
  });

  it('молчит про задачи без срока', () => {
    expect(isTaskDueForReminder(open(null), NOW)).toBe(false);
  });

  it('молчит, пока до срока далеко', () => {
    const inTenDays = new Date('2026-07-30T09:00:00Z');
    expect(isTaskDueForReminder(open(inTenDays), NOW)).toBe(false);
  });

  it('начинает напоминать за три дня до срока', () => {
    const inThreeDays = new Date('2026-07-23T09:00:00Z');
    const inFourDays = new Date('2026-07-24T09:00:00Z');
    expect(isTaskDueForReminder(open(inThreeDays), NOW)).toBe(true);
    expect(isTaskDueForReminder(open(inFourDays), NOW)).toBe(false);
  });

  it('продолжает напоминать о просроченных', () => {
    const yesterday = new Date('2026-07-19T09:00:00Z');
    expect(isTaskDueForReminder(open(yesterday), NOW)).toBe(true);
  });

  it('замолкает, когда задачу закрыли', () => {
    const yesterday = new Date('2026-07-19T09:00:00Z');
    for (const status of [EnumTaskStatus.DONE, EnumTaskStatus.CANCELLED]) {
      expect(isTaskDueForReminder({ status, deadline: yesterday }, NOW)).toBe(
        false,
      );
    }
  });
});

describe('упоминание ответственного', () => {
  it('ставит @ник, когда он задан', () => {
    expect(mentionFor({ username: 'Иван', telegramUsername: 'ivan' })).toBe(
      '@ivan',
    );
  });

  it('не удваивает собачку, если ник ввели с ней', () => {
    expect(mentionFor({ username: 'Иван', telegramUsername: '@ivan' })).toBe(
      '@ivan',
    );
  });

  it('без ника показывает имя из CRM — пинга не будет', () => {
    expect(mentionFor({ username: 'Иван', telegramUsername: null })).toBe(
      'Иван',
    );
  });
});

describe('сообщение дайджеста', () => {
  it('группирует по людям и сортирует просроченное наверх', () => {
    const text = buildDigestMessage(
      [
        {
          assignee: { username: 'Иван', telegramUsername: 'ivan' },
          tasks: [
            {
              title: 'Закупить плёнку',
              deadline: new Date('2026-07-20T15:00:00Z'),
            },
            {
              title: 'Переделать макет',
              deadline: new Date('2026-07-18T09:00:00Z'),
              orderNumber: '202607-015',
            },
          ],
        },
      ],
      NOW,
    );

    const lines = text.split('\n');
    expect(lines[0]).toContain('Задачи на 20.07');
    // Просроченное идёт раньше сегодняшнего.
    const overdueAt = lines.findIndex((l) => l.includes('Переделать макет'));
    const todayAt = lines.findIndex((l) => l.includes('Закупить плёнку'));
    expect(overdueAt).toBeLessThan(todayAt);
    expect(lines[overdueAt]).toContain('🔴');
    expect(lines[overdueAt]).toContain('(заказ 202607-015)');
    expect(lines[todayAt]).toContain('🟡');
    expect(text).toContain('@ivan');
  });

  it('экранирует HTML в теме задачи', () => {
    const text = buildDigestMessage(
      [
        {
          assignee: { username: 'Иван', telegramUsername: null },
          tasks: [
            {
              title: 'Печать <b>10x15</b> & рамки',
              deadline: new Date('2026-07-20T15:00:00Z'),
            },
          ],
        },
      ],
      NOW,
    );
    expect(text).toContain('Печать &lt;b&gt;10x15&lt;/b&gt; &amp; рамки');
  });
});
