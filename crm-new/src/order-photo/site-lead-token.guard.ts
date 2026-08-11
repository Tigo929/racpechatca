import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/** Насколько старой может быть подпись. Защита от повторной отправки. */
const MAX_SIGNATURE_AGE_SECONDS = 300;

type SignedRequest = Request & { rawBody?: Buffer };

/**
 * Доступ к приёму заявок с сайта.
 *
 * Два рубежа, как принято для вебхуков (схема Stripe/GitHub):
 *  1. Машинный токен — подтверждает, что запрос вообще от нашего сайта.
 *  2. Подпись тела (HMAC-SHA256) с меткой времени — подтверждает, что тело
 *     не подменили по дороге и запрос не переигрывают повторно.
 *
 * Подпись включается постепенно: пока `CRM_LEAD_REQUIRE_SIGNATURE` не равен
 * `true`, запрос без подписи проходит (но подпись, если она есть, всё равно
 * проверяется). Так можно выкатить CRM раньше сайта и не потерять заявки.
 */
@Injectable()
export class SiteLeadTokenGuard implements CanActivate {
  private readonly logger = new Logger(SiteLeadTokenGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.config.get<string>('CRM_LEAD_TOKEN')?.trim();
    if (!expectedToken) {
      throw new ServiceUnavailableException('Приём заявок с сайта не настроен.');
    }

    const request = context.switchToHttp().getRequest<SignedRequest>();
    const actualToken =
      readBearerToken(request) ?? readHeader(request, 'x-lead-token');
    if (!actualToken || !constantTimeEqual(actualToken, expectedToken)) {
      throw new UnauthorizedException('Некорректный токен заявки.');
    }

    this.verifySignature(request);
    return true;
  }

  private verifySignature(request: SignedRequest): void {
    const secret = this.config.get<string>('CRM_LEAD_SIGNING_SECRET')?.trim();
    const required =
      this.config.get<string>('CRM_LEAD_REQUIRE_SIGNATURE') === 'true';

    const signature = readHeader(request, 'x-lead-signature');
    const timestamp = readHeader(request, 'x-lead-timestamp');

    if (!signature || !timestamp) {
      if (required) {
        throw new UnauthorizedException('Заявка без подписи.');
      }
      // Переходный период: сайт ещё не подписывает — пропускаем по токену.
      return;
    }
    if (!secret) {
      // Подпись пришла, а проверить нечем — это ошибка настройки, а не клиента.
      this.logger.error(
        'Пришла подписанная заявка, но CRM_LEAD_SIGNING_SECRET не задан',
      );
      if (required) throw new UnauthorizedException('Подпись не настроена.');
      return;
    }

    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) {
      throw new UnauthorizedException('Подпись просрочена.');
    }

    // Подписываем «метка.тело» — метка внутри подписи, иначе её можно подменить.
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (!constantTimeEqual(stripPrefix(signature), expected)) {
      throw new UnauthorizedException('Подпись заявки не совпадает.');
    }
  }
}

/** Принимаем и «sha256=<hex>», и голый hex — обе формы встречаются. */
function stripPrefix(signature: string): string {
  return signature.trim().replace(/^sha256=/i, '');
}

function readBearerToken(request: Request): string | null {
  const header = readHeader(request, 'authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function readHeader(request: Request, name: string): string | null {
  const value = request.headers[name];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
