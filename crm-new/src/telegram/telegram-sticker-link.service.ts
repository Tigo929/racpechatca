import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class TelegramStickerLinkService {
  constructor(private readonly config: ConfigService) {}

  buildStickerUrl(orderId: string): string | null {
    const baseUrl = this.baseUrl();
    const secret = this.secret();
    if (!baseUrl || !secret) return null;

    const token = this.sign(orderId, secret);
    return `${baseUrl}/telegram/tshirt-orders/${encodeURIComponent(
      orderId,
    )}/sticker.pdf?token=${encodeURIComponent(token)}`;
  }

  isValid(orderId: string, token: string): boolean {
    const secret = this.secret();
    if (!secret || !token) return false;

    const expected = this.sign(orderId, secret);
    const expectedBuffer = Buffer.from(expected);
    const tokenBuffer = Buffer.from(token);
    return (
      expectedBuffer.length === tokenBuffer.length &&
      timingSafeEqual(expectedBuffer, tokenBuffer)
    );
  }

  private sign(orderId: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(`tshirt-sticker:${orderId}`)
      .digest('base64url');
  }

  private baseUrl(): string {
    return (this.config.get<string>('PUBLIC_BASE_URL') ?? '').replace(
      /\/+$/,
      '',
    );
  }

  private secret(): string {
    return (
      this.config.get<string>('TELEGRAM_STICKER_SECRET') ||
      this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') ||
      this.config.get<string>('PARTNER_API_TOKEN') ||
      this.config.get<string>('JWT_SECRET') ||
      ''
    );
  }
}
