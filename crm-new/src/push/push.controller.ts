import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-request';
import { PushService } from './push.service';
import { PushEndpointDto, PushSubscribeDto } from './push.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { CRM_MANIFEST } from './push-worker';
import { Throttle } from '@nestjs/throttler';

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

  @Get('manifest.webmanifest')
  manifest(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache');
    res.json(CRM_MANIFEST);
  }

  @Get('sw.js')
  serviceWorker(@Res() res: Response): void {
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  async subscribe(
    @Body() sub: PushSubscribeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.push.saveSubscription(sub, user.id);
    return { ok: true };
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(
    @Body() body: PushEndpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.push.removeSubscription(body.endpoint, user.id);
    return { ok: true };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  test(@Body() body: PushEndpointDto, @CurrentUser() user: AuthenticatedUser) {
    return this.push.testDevice(body.endpoint, user.id);
  }
}
