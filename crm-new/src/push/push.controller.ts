import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-request';
import { PushService, type BrowserSubscription } from './push.service';

/**
 * Web Push для уведомлений о заявках.
 *
 * Префикс order-photo-push, а не push: на домене сайта raspechatkaa.ru статику
 * и произвольные пути CRM отдаёт сайт, а всё, что подходит под order-photo,
 * уходит на бэкенд CRM (как с согласованием). Так и service worker, и API
 * работают на обоих доменах без правки nginx на сервере.
 *
 * sw.js и vapid-public-key — БЕЗ авторизации: их запрашивает сам браузер
 * (регистрация SW и подписка идут без заголовка Authorization). Подписка и
 * отписка — под токеном.
 */
@Controller('order-photo-push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('sw.js')
  async serviceWorker(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(this.push.serviceWorkerJs());
  }

  @Get('vapid-public-key')
  async vapidPublicKey(): Promise<{ key: string }> {
    return { key: await this.push.getPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Body() sub: BrowserSubscription,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.push.saveSubscription(sub, user?.id ?? null);
    return { ok: true };
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(
    @Body() body: { endpoint: string },
  ): Promise<{ ok: true }> {
    await this.push.removeSubscription(body?.endpoint);
    return { ok: true };
  }
}
