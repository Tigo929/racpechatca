import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { AvitoService } from './avito.service';
import { AvitoMessengerService } from './avito-messenger.service';
import { DtoAvitoChatQuery } from './dto/avito-chat-query.dto';
import { DtoSendAvitoMessage } from './dto/send-avito-message.dto';

/**
 * Служебные ручки Avito. Только админ: здесь видно, живы ли ключи, и отзывы
 * магазина. Ошибку связи отдаём как ok:false, а не 500 — «Авито недоступен»
 * это состояние интеграции, а не поломка CRM.
 */
@Controller('avito')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class AvitoController {
  constructor(
    private readonly avito: AvitoService,
    private readonly messenger: AvitoMessengerService,
  ) {}

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
    const data = await this.avito.getReviews(
      Math.min(Number(limit) || 20, 50),
      Number(offset) || 0,
    );
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

  @Post('messenger/sync')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  syncMessenger(@Query('limit') limit = 50) {
    return this.messenger.syncLatest(Math.min(Number(limit) || 50, 100));
  }

  @Get('messenger/chats')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  getChats(@Query() query: DtoAvitoChatQuery) {
    return this.messenger.listChats({
      limit: query.limit,
      offset: query.offset,
      unreadOnly: query.unreadOnly,
    });
  }

  @Get('messenger/chats/:chatId/messages')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  getMessages(
    @Param('chatId') chatId: string,
    @Query() query: DtoAvitoChatQuery,
  ) {
    return this.messenger.getMessages(chatId, {
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('messenger/chats/:chatId/messages')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  sendMessage(
    @Param('chatId') chatId: string,
    @Body() dto: DtoSendAvitoMessage,
    @CurrentUser() user: { id: string },
  ) {
    return this.messenger.sendText(chatId, dto.text, user.id);
  }

  @Post('messenger/chats/:chatId/read')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  markRead(@Param('chatId') chatId: string) {
    return this.messenger.markRead(chatId);
  }
}
