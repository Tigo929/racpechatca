import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LocalAgentTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization') ?? '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!token) throw new UnauthorizedException('Токен агента не указан.');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const credential = await this.prisma.localAgentCredential.findUnique({
      where: { tokenHash },
      select: { id: true, isActive: true },
    });
    if (!credential?.isActive) {
      throw new UnauthorizedException('Недействительный токен агента.');
    }

    await this.prisma.localAgentCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });
    return true;
  }
}
