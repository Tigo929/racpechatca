import { describe, it, expect } from 'vitest';
import { archiveUrlNamedBy, photosArchiveUrl } from './photos-archive';

/**
 * Откуда берётся ссылка на фотографии клиента.
 *
 * Пропустить её значит отправить печатника искать файлы в переписке —
 * то есть вернуть ровно ту работу, ради которой заказ и принимается
 * через форму.
 */
describe('ссылка на фотографии заказа', () => {
  it('у нового заказа берётся из поля', () => {
    expect(
      photosArchiveUrl({
        photosArchiveUrl: 'https://raspechatkaa.ru/api/leads/archive/session/x?token=1',
        note: 'что угодно',
      }),
    ).toBe('https://raspechatkaa.ru/api/leads/archive/session/x?token=1');
  });

  it('у старого — из примечания: колонка появилась позже', () => {
    expect(
      photosArchiveUrl({
        note: 'Телефон: +7900\nАрхив фото: https://raspechatkaa.ru/api/leads/archive/lead-1.zip?token=2\nФото: 40 шт',
      }),
    ).toBe('https://raspechatkaa.ru/api/leads/archive/lead-1.zip?token=2');
  });

  it('поле важнее примечания: там ссылка свежее', () => {
    expect(
      photosArchiveUrl({
        photosArchiveUrl: 'https://raspechatkaa.ru/new',
        note: 'Архив фото: https://raspechatkaa.ru/old',
      }),
    ).toBe('https://raspechatkaa.ru/new');
  });

  it('заказ отгружен — поля нет, кнопки тоже', () => {
    // После отгрузки исходники удаляются, и поле обнуляется: показывать
    // кнопку, которая ведёт в пустоту, хуже, чем не показывать ничего.
    expect(photosArchiveUrl({ photosArchiveUrl: null, note: 'Телефон: +7900' })).toBeNull();
  });

  it('в примечании не ссылка — кнопку не рисуем', () => {
    expect(photosArchiveUrl({ note: 'Архив фото: уточнить у клиента' })).toBeNull();
  });
});

describe('имя скачиваемого архива', () => {
  it('к ссылке добавляется номер заказа', () => {
    // Сайт номера не знает — заказ заводит CRM уже после заявки.
    expect(
      archiveUrlNamedBy('https://site/api/leads/archive/session/x?token=1', '20261016-5'),
    ).toBe('https://site/api/leads/archive/session/x?token=1&name=20261016-5');
  });

  it('у ссылки без параметров — первым параметром', () => {
    expect(archiveUrlNamedBy('https://site/archive', '12')).toBe(
      'https://site/archive?name=12',
    );
  });

  it('номера нет — ссылку не трогаем', () => {
    expect(archiveUrlNamedBy('https://site/archive', null)).toBe(
      'https://site/archive',
    );
  });
});
