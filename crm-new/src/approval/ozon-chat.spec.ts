import { ozonChatId, ozonSheetFileName } from './ozon-chat';

/**
 * Разбор ссылки на чат Ozon.
 *
 * Проверяется не формат ради формата: по этому значению уходит макет
 * покупателю. Лишняя догадка здесь — согласование, ушедшее чужому
 * человеку, поэтому всё непонятное обязано давать `null`.
 */
describe('чат Ozon: идентификатор из заказа', () => {
  const id = '0f8c1a2b-3d4e-4f50-9a6b-7c8d9e0f1a2b';

  it('берёт uuid из ссылки кабинета', () => {
    expect(ozonChatId(`https://seller.ozon.ru/app/messenger?id=${id}`)).toBe(
      id,
    );
  });

  it('принимает сам идентификатор — его тоже копируют', () => {
    expect(ozonChatId(id)).toBe(id);
    expect(ozonChatId(`  ${id.toUpperCase()}  `)).toBe(id);
  });

  it('не путается в соседних параметрах', () => {
    // В ссылке встречаются и другие идентификаторы. Берём строго `id`.
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(
      ozonChatId(
        `https://seller.ozon.ru/app/messenger?posting=${other}&id=${id}&tab=chat`,
      ),
    ).toBe(id);
  });

  it('чужой домен — не наш чат', () => {
    expect(ozonChatId(`https://seller.ozon.ru.example.com/?id=${id}`)).toBe(
      null,
    );
    expect(ozonChatId(`https://t.me/klient?id=${id}`)).toBe(null);
  });

  it('ссылка без идентификатора чата ничего не даёт', () => {
    expect(ozonChatId('https://seller.ozon.ru/app/messenger')).toBe(null);
    expect(ozonChatId('https://seller.ozon.ru/app/messenger?id=12345')).toBe(
      null,
    );
  });

  it('пусто и мусор — это пусто', () => {
    expect(ozonChatId(null)).toBe(null);
    expect(ozonChatId('')).toBe(null);
    expect(ozonChatId('   ')).toBe(null);
    expect(ozonChatId('напишу в чат озона')).toBe(null);
  });
});

describe('чат Ozon: имя файла с макетом', () => {
  it('называется номером заказа и версией', () => {
    expect(ozonSheetFileName('0123-4567-8901', 2)).toBe(
      'maket-0123-4567-8901-v2.jpg',
    );
  });

  it('из номера убирается всё, что ломает имя файла', () => {
    expect(ozonSheetFileName('../../etc/passwd', 1)).toBe(
      'maket-etcpasswd-v1.jpg',
    );
  });

  it('номера нет — файл всё равно получает имя', () => {
    expect(ozonSheetFileName('', 3)).toBe('maket-zakaz-v3.jpg');
  });
});
