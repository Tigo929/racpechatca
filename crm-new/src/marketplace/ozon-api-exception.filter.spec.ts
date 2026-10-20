import type { ArgumentsHost } from '@nestjs/common';
import { OzonApiExceptionFilter } from './ozon-api-exception.filter';
import { OzonApiError } from './ozon/ozon-api.client';

/**
 * Перевод ответа площадки в ответ нашего API.
 *
 * OzonApiError — обычный Error, и всё, что не перехватили руками, Nest
 * отдавал как 500 «Internal server error»: подготовленное объяснение
 * оставалось в логе сервера. Раздел заказов именно так и выглядел.
 */

interface Captured {
  status?: number;
  body?: Record<string, unknown>;
}

function run(error: OzonApiError): Captured {
  const captured: Captured = {};
  // Заглушка ответа express: status() возвращает сам объект, чтобы
  // работала цепочка res.status(...).json(...).
  const response: {
    status: (code: number) => typeof response;
    json: (body: Record<string, unknown>) => typeof response;
  } = {
    status: (code: number) => {
      captured.status = code;
      return response;
    },
    json: (body: Record<string, unknown>) => {
      captured.body = body;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new OzonApiExceptionFilter().catch(error, host);
  return captured;
}

it('отдаёт текст площадки, а не «Internal server error»', () => {
  const result = run(
    new OzonApiError(
      429,
      'Ozon ограничил частоту запросов. Подождите минуту и повторите.',
    ),
  );

  expect(result.body?.message).toBe(
    'Ozon ограничил частоту запросов. Подождите минуту и повторите.',
  );
});

it('всегда 502, даже когда площадка ответила 401', () => {
  /*
   * Главное правило этого фильтра. Для браузера 401 означает «сессия
   * истекла»: перехватчик в api/client.ts стирает токен и уводит на логин.
   * Пробрось мы код площадки — просроченный ключ чужого кабинета Ozon
   * выкидывал бы сотрудника из CRM.
   */
  const result = run(
    new OzonApiError(401, 'Ozon не принял доступы: проверьте Client-Id.'),
  );

  expect(result.status).toBe(502);
  expect(result.body?.statusCode).toBe(502);
});

it('429 площадки тоже не пробрасывается', () => {
  // Иначе он выглядел бы как наш собственный лимит частоты запросов.
  expect(run(new OzonApiError(429, 'Ozon ограничил частоту.')).status).toBe(
    502,
  );
});

it('код площадки остаётся в ответе для разбора', () => {
  const result = run(new OzonApiError(429, 'Ozon ограничил частоту.'));
  expect(result.body?.ozonStatus).toBe(429);
});

it('сырой ответ площадки в тело не попадает', () => {
  // В details бывают внутренние коды и идентификаторы — им в интерфейсе
  // делать нечего, их место в логе.
  const result = run(
    new OzonApiError(400, 'Ozon отклонил запрос.', 'code=16 internal detail'),
  );

  expect(JSON.stringify(result.body)).not.toContain('internal detail');
});

it('недоступность площадки (status 0) тоже объясняется', () => {
  const result = run(new OzonApiError(0, 'Не удалось связаться с Ozon.'));

  expect(result.status).toBe(502);
  expect(result.body?.message).toBe('Не удалось связаться с Ozon.');
});
