import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { OzonApiError } from './ozon/ozon-api.client';

/**
 * Ответ площадки — в текст для человека.
 *
 * OzonApiError собирает внятное объяснение («Ozon ограничил частоту
 * запросов», «Ozon не принял доступы»), но это обычный Error, а не
 * HttpException. Поэтому всё, что не перехватили руками, Nest превращал
 * в 500 «Internal server error»: объяснение оставалось в логе сервера, а
 * в интерфейсе стояла строчка, по которой ничего не понять и нечего делать.
 *
 * Фильтр отдаёт humanMessage в поле `message` — его и показывает
 * интерфейс (utils/get-error-message.ts).
 *
 * Код ответа — всегда 502, независимо от того, что ответил Ozon.
 *
 * Почему не пробрасываем код площадки: 401 от Ozon означает «неверный
 * ключ кабинета», но для браузера 401 означает «сессия истекла» —
 * перехватчик в api/client.ts стирает токен и уводит на логин. То есть
 * чужой просроченный ключ Ozon выкидывал бы сотрудника из CRM. 429 тоже
 * нельзя: он сработал бы как наш собственный лимит частоты.
 *
 * 502 Bad Gateway говорит ровно то, что произошло: мы обратились к
 * внешней системе, и она ответила отказом. Подробности — в тексте.
 */
@Catch(OzonApiError)
export class OzonApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OzonApiExceptionFilter.name);

  catch(error: OzonApiError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Сырой ответ площадки — только в лог: в нём бывают внутренние коды и
    // идентификаторы, которым в интерфейсе делать нечего.
    this.logger.warn(
      `Ozon ответил ${error.status}: ${error.humanMessage}${
        error.details ? ` — ${error.details}` : ''
      }`,
    );

    response.status(HttpStatus.BAD_GATEWAY).json({
      statusCode: HttpStatus.BAD_GATEWAY,
      message: error.humanMessage,
      /** Код площадки — для разбора, интерфейс его не показывает. */
      ozonStatus: error.status,
    });
  }
}
