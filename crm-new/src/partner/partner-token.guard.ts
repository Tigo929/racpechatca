import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Аутентификация партнёра к нашему API по статическому токену.
 * Партнёр присылает его в заголовке `X-Partner-Token` (или `Authorization:
 * Bearer <token>`). Значение — из env PARTNER_API_TOKEN.
 */
@Injectable()
export class PartnerTokenGuard implements CanActivate {
  private readonly token: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('PARTNER_API_TOKEN') || '';
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.token) {
      throw new UnauthorizedException('Партнёрский API не настроен');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.header('x-partner-token') ?? '';
    const bearer = (req.header('authorization') ?? '').replace(
      /^Bearer\s+/i,
      '',
    );
    const provided = header || bearer;

    if (!provided || !this.safeEqual(provided, this.token)) {
      throw new UnauthorizedException('Неверный партнёрский токен');
    }
    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
