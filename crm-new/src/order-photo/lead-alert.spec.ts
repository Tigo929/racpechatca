import {
  ALERT_LIFETIME_MS,
  alertExpired,
  humanAge,
  lateNotice,
  moscowStamp,
  nextAlertDelayMs,
  withLateNotice,
} from './lead-alert';

/**
 * Очередь уведомлений о заявках.
 *
 * 13 ноября 2026 перестал отвечать посредник, через которого сервер ходит в
 * Telegram, и бот молчал сутки с лишним. Уведомления о четырёх заявках
 * ушли в лог и пропали: заказы лежали в CRM, а владелец о них не знал.
 * Эти тесты стерегут поведение очереди, которая эту потерю закрывает.
 */
describe('паузы между попытками', () => {
  it('растут от полуминуты и упираются в потолок', () => {
    expect(nextAlertDelayMs(1)).toBe(30_000);
    expect(nextAlertDelayMs(2)).toBe(60_000);
    expect(nextAlertDelayMs(3)).toBe(120_000);
    expect(nextAlertDelayMs(10)).toBe(15 * 60_000);
  });

  it('на большом числе попыток не переполняются, а держат потолок', () => {
    // Канал может молчать сутками: к сотой попытке 2**99 — это бесконечность,
    // и строка ушла бы в «следующая попытка никогда».
    expect(nextAlertDelayMs(100)).toBe(15 * 60_000);
    expect(Number.isFinite(nextAlertDelayMs(1000))).toBe(true);
  });
});

describe('когда сдаёмся', () => {
  const start = new Date('2026-11-14T10:00:00Z');

  it('сутки молчания — ещё ждём: прошлая поломка длилась дольше', () => {
    const day = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    expect(alertExpired(start, day)).toBe(false);
  });

  it('через неделю перестаём: заявке уведомление уже не поможет', () => {
    expect(
      alertExpired(start, new Date(start.getTime() + ALERT_LIFETIME_MS + 1000)),
    ).toBe(true);
  });
});

describe('пометка о задержке', () => {
  const sent = new Date('2026-11-12T18:48:01Z'); // 21:48 по Москве

  it('свежее уведомление уходит как есть', () => {
    const text = withLateNotice(
      'Новая заявка',
      sent,
      new Date(sent.getTime() + 5 * 60_000),
    );
    expect(text).toBe('Новая заявка');
  });

  it('догоняющее уведомление честно говорит, что заявка не сегодняшняя', () => {
    // Иначе канал оживает, в чат падают четыре «новая заявка» из разных
    // дней, и по ним звонят как по горячим.
    const now = new Date(sent.getTime() + 26 * 60 * 60 * 1000);
    const text = withLateNotice('Новая заявка', sent, now);
    expect(text).toContain('Уведомление запоздало');
    expect(text).toContain('12.11 в 21:48');
    expect(text).toContain('1 дн назад');
    expect(text.endsWith('Новая заявка')).toBe(true);
  });

  it('время заявки показываем по Москве, а не по UTC', () => {
    expect(moscowStamp(sent)).toBe('12.11 в 21:48');
  });

  it('возраст называем словами, без секунд и дробей', () => {
    expect(humanAge(35 * 60_000)).toBe('35 мин');
    expect(humanAge(6 * 60 * 60_000)).toBe('6 ч');
    expect(humanAge(50 * 60 * 60_000)).toBe('2 дн');
  });

  it('порог задержки — десять минут, а не любая секунда', () => {
    // Обычная отправка занимает доли секунды, но воркер может подобрать
    // строку и через минуту — пугать этим незачем.
    expect(lateNotice(sent, new Date(sent.getTime() + 9 * 60_000))).toBeNull();
    expect(
      lateNotice(sent, new Date(sent.getTime() + 11 * 60_000)),
    ).not.toBeNull();
  });
});
