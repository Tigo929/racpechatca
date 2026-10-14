import { TelegramService } from './telegram.service';

/**
 * Куда бот пишет.
 *
 * Общая группа превратилась в поток: туда шли и задачи исполнителям,
 * и заявки с сайта, и напоминания об отгрузке. Нужное тонуло, и читать
 * группу перестали — а это ровно то состояние, в котором пропускают
 * заявку с деньгами.
 *
 * Поэтому адрес у каждого сообщения свой, и проверяется он здесь:
 * ошибка в маршруте не падает, она просто уводит сообщение не туда.
 */
describe('адреса сообщений бота', () => {
  const service = (env: Record<string, string>) => {
    const sent: { chatId: string; text: string; threadId?: string }[] = [];
    const instance = new TelegramService({
      get: (key: string) => env[key],
    } as never);
    // sendMessage — единственная дверь наружу: подменяем её и смотрим,
    // с каким адресом её позвали.
    (instance as unknown as Record<string, unknown>).sendMessage = async (
      chatId: string,
      text: string,
      threadId?: string,
    ) => {
      sent.push({ chatId, text, threadId });
      return true;
    };
    return { instance, sent };
  };

  const BASE = {
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_GROUP_CHAT_ID: '-100111',
  };

  it('заявка с сайта уходит владельцу в личку, а не в группу', () => {
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_OWNER_CHAT_ID: '555',
    });
    return instance.sendToOwner('Заявка').then(() => {
      expect(sent).toHaveLength(1);
      expect(sent[0].chatId).toBe('555');
    });
  });

  it('личка не настроена — заявка всё равно доходит, в группу', async () => {
    // Молчание хуже лишнего адресата: заявка — это деньги.
    const { instance, sent } = service(BASE);
    await instance.sendToOwner('Заявка');
    expect(sent[0].chatId).toBe('-100111');
  });

  it('задача Алексею уходит в его тему', async () => {
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_EXECUTOR_CHAT_ID: '-100222',
      TELEGRAM_EXECUTOR_ALEXEY_THREAD_ID: '10815',
      TELEGRAM_EXECUTOR_MAXIM_THREAD_ID: '10813',
    });
    await instance.sendToExecutor('Задача', undefined, 'Alexey_Semenov');
    expect(sent[0]).toMatchObject({ chatId: '-100222', threadId: '10815' });
  });

  it('задача Максиму — в его', async () => {
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_EXECUTOR_CHAT_ID: '-100222',
      TELEGRAM_EXECUTOR_ALEXEY_THREAD_ID: '10815',
      TELEGRAM_EXECUTOR_MAXIM_THREAD_ID: '10813',
    });
    await instance.sendToExecutor('Задача', undefined, 'Maxim_Kuzmin');
    expect(sent[0].threadId).toBe('10813');
  });

  it('тема из карточки сотрудника важнее только тогда, когда своей нет', async () => {
    // Темы по именам — запасной путь для давно заведённых исполнителей;
    // у нового сотрудника тема берётся из его карточки в CRM.
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_EXECUTOR_CHAT_ID: '-100222',
    });
    await instance.sendToExecutor('Задача', '777', 'Новый_Сотрудник');
    expect(sent[0].threadId).toBe('777');
  });

  it('у исполнителя есть личка — пишем туда, а не в тему', async () => {
    // Личное сообщение видно сразу; в теме его всё равно нужно найти.
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_EXECUTOR_CHAT_ID: '-100222',
      TELEGRAM_EXECUTOR_MAXIM_THREAD_ID: '10813',
    });
    await instance.sendToExecutor(
      'Задача',
      '10813',
      'Maxim_Kuzmin',
      'm_k_a_202',
      '543304870',
    );
    expect(sent[0]).toMatchObject({ chatId: '543304870', threadId: undefined });
  });

  it('личка пустая — остаётся прежний путь через тему', async () => {
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_EXECUTOR_CHAT_ID: '-100222',
      TELEGRAM_EXECUTOR_MAXIM_THREAD_ID: '10813',
    });
    await instance.sendToExecutor('Задача', undefined, 'Maxim_Kuzmin', undefined, '');
    expect(sent[0]).toMatchObject({ chatId: '-100222', threadId: '10813' });
  });

  it('исполнитель неизвестен — пишем в чат исполнителей без темы', async () => {
    const { instance, sent } = service({
      ...BASE,
      TELEGRAM_EXECUTOR_CHAT_ID: '-100222',
    });
    await instance.sendToExecutor('Задача');
    expect(sent[0]).toMatchObject({ chatId: '-100222', threadId: undefined });
  });
});
