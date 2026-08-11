import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class SiteLeadTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('CRM_LEAD_TOKEN')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException('Приём заявок с сайта не настроен.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const actual = readBearerToken(request) ?? readHeader(request, 'x-lead-token');
    if (!actual || !constantTimeEqual(actual, expected)) {
      throw new UnauthorizedException('Некорректный токен заявки.');
    }

    return true;
  }
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
