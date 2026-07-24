import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { AvitoService } from './avito.service';

/**
 * Служебные ручки Avito. Только админ: здесь видно, живы ли ключи, и отзывы
 * магазина. Ошибку связи отдаём как ok:false, а не 500 — «Авито недоступен»
 * это состояние интеграции, а не поломка CRM.
 */
@Controller('avito')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class AvitoController {
  constructor(private readonly avito: AvitoService) {}

  @Get('status')
  async status() {
    if (!this.avito.isConfigured) {
      return { configured: false, ok: false, error: 'Ключи Avito не заданы' };
    }
    try {
      const [account, rating] = await Promise.all([
        this.avito.getAccount(),
        this.avito.getRating(),
      ]);
      return {
        configured: true,
        ok: true,
        account: {
          id: account.id,
          name: account.name,
          profileUrl: account.profile_url,
        },
        rating: {
          score: rating.rating.score,
          reviewsCount: rating.rating.reviewsCount,
        },
      };
    } catch (err) {
      return {
        configured: true,
        ok: false,
        error: err instanceof Error ? err.message : 'Неизвестная ошибка',
      };
    }
  }

  @Get('reviews')
  async reviews(@Query('limit') limit = 20, @Query('offset') offset = 0) {
    const data = await this.avito.getReviews(Math.min(Number(limit) || 20, 50), Number(offset) || 0);
    return {
      total: data.total,
      reviews: data.reviews.map((r) => ({
        id: r.id,
        score: r.score,
        text: r.text,
        author: r.sender?.name ?? '',
        itemTitle: r.item?.title ?? '',
        createdAt: new Date(r.createdAt * 1000).toISOString(),
        canAnswer: r.canAnswer,
      })),
    };
  }
}
