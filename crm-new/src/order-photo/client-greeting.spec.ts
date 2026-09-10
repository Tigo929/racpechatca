import {
  clientNameFromNote,
  isGreetingStatus,
  telegramUsernameFromUrl,
} from './client-greeting';

/**
 * Разбор данных для первого сообщения клиенту.
 *
 * Ошибка здесь стоит дороже обычной: по разобранному никнейму рабочий
 * аккаунт пишет живому человеку. Промахнулись — сообщение уходит не тому,
 * и вместе с ним уходит имя чужого клиента.
 */
describe('никнейм из ссылки на переписку', () => {
  it.each([
    ['https://t.me/petrov', 'petrov'],
    ['http://t.me/petrov', 'petrov'],
    ['t.me/petrov', 'petrov'],
    ['https://telegram.me/petrov', 'petrov'],
    ['https://t.me/s/petrov', 'petrov'],
    ['@petrov', 'petrov'],
    ['petrov', 'petrov'],
    ['https://t.me/petrov?start=1', 'petrov'],
  ])('%s → %s', (url, expected) => {
    expect(telegramUsernameFromUrl(url)).toBe(expected);
  });

  it('ссылку-приглашение не принимает', () => {
    // t.me/+AbCdEf — это приглашение в чат, а не личный аккаунт.
    expect(telegramUsernameFromUrl('https://t.me/+AbCdEfGh')).toBeNull();
    expect(telegramUsernameFromUrl('https://t.me/joinchat')).toBeNull();
  });

  it('мусор не принимает', () => {
    expect(telegramUsernameFromUrl(null)).toBeNull();
    expect(telegramUsernameFromUrl('')).toBeNull();
    expect(telegramUsernameFromUrl('   ')).toBeNull();
    // Слишком короткий и с недопустимыми знаками.
    expect(telegramUsernameFromUrl('@ab')).toBeNull();
    expect(telegramUsernameFromUrl('@пётр')).toBeNull();
    expect(telegramUsernameFromUrl('+7 900 000-00-00')).toBeNull();
  });
});

describe('имя клиента из примечания', () => {
  const note = [
    '🆕 Заявка с сайта',
    '💬 Клиент просит: к пятнице',
    'ID заявки: web-photo-abc',
    'Имя: Пётр',
    'Телефон: +7 900 000-00-00',
  ].join('\n');

  it('находит строку с именем', () => {
    expect(clientNameFromNote(note)).toBe('Пётр');
  });

  it('без строки имени возвращает null', () => {
    expect(clientNameFromNote('🆕 Заявка с сайта')).toBeNull();
    expect(clientNameFromNote(null)).toBeNull();
  });

  it('мусор вместо имени не отдаёт', () => {
    // Реальный случай из отчёта: клиент вписал «///» вместо имени.
    expect(clientNameFromNote('Имя: ///')).toBeNull();
    expect(clientNameFromNote('Имя:   ')).toBeNull();
  });
});

describe('итоги попытки', () => {
  it('принимает только известные', () => {
    expect(isGreetingStatus('sent')).toBe(true);
    expect(isGreetingStatus('privacy')).toBe(true);
    expect(isGreetingStatus('всё сломалось')).toBe(false);
  });
});
