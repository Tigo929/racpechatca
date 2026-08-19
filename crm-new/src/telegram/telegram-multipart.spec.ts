import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { telegramFetch, telegramFormData } from './telegram-fetch';

/**
 * Файл действительно уезжает в теле запроса.
 *
 * Проверка держится на живом HTTP-сервере, а не на моках, потому что ломалось
 * ровно то, что моком не видно: сериализация тела. Тело собиралось глобальной
 * FormData, а везла его другая сборка undici — та узнаёт только свою FormData,
 * а чужую приводит к строке. В Telegram уходило семнадцать байт текста
 * «[object FormData]», он отвечал «there is no document in the request», а мы
 * показывали «Telegram не принял ТЗ-файл». Текстовые сообщения при этом ходили
 * — они уходят обычным JSON, поэтому поломку было видно только на ТЗ.
 *
 * Мок здесь ничего бы не поймал: он получил бы объект FormData и остался
 * доволен. Ловится это только тем, что реально пришло по проводу.
 */
describe('telegramFetch: файл доезжает в multipart', () => {
  let server: http.Server;
  let url: string;
  let received: { contentType: string | undefined; body: Buffer };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        received = {
          contentType: req.headers['content-type'],
          body: Buffer.concat(chunks),
        };
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve()),
    );
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}/`;
  });

  afterAll(async () => {
    delete process.env.TELEGRAM_PROXY_URL;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('везёт байты файла, а не строку «[object FormData]»', async () => {
    const file = Buffer.alloc(4096, 0x42);
    const form = telegramFormData();
    form.set('chat_id', '-100123');
    form.set('caption', 'ТЗ по заказу');
    form.set(
      'document',
      new Blob([file as unknown as BlobPart], { type: 'application/pdf' }),
      'techspec.pdf',
    );

    await telegramFetch(url, { method: 'POST', body: form });

    expect(received.contentType).toMatch(/^multipart\/form-data; boundary=/);
    // Байты файла на месте — именно этого и не было.
    expect(received.body.includes(file)).toBe(true);
    expect(received.body.toString('latin1')).toContain('filename="techspec.pdf"');
    expect(received.body.toString('utf8')).not.toContain('[object FormData]');
  });

  it('глобальная FormData сюда не годится — это и была поломка', async () => {
    const file = Buffer.alloc(4096, 0x43);
    const wrong = new FormData();
    wrong.set('chat_id', '-100123');
    wrong.set(
      'document',
      new Blob([file as unknown as BlobPart], { type: 'application/pdf' }),
      'techspec.pdf',
    );

    await telegramFetch(url, { method: 'POST', body: wrong });

    // Зафиксировано намеренно: пока это так, telegram.service.ts обязан
    // брать FormData только через telegramFormData().
    expect(received.contentType).not.toMatch(/^multipart\/form-data/);
    expect(received.body.includes(file)).toBe(false);
  });
});
