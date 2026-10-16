import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { AiService, type AiAnswer } from './ai.service';
import { DtoAskAi } from './dto/ask.dto';

/**
 * Вкладка «ИИ»: разговор с агентом, который видит базу CRM и код проектов.
 *
 * Только администратор. Агент отвечает по всей базе — выручка, зарплаты,
 * себестоимость, — и видеть это исполнителю незачем; к тому же каждый
 * вопрос стоит денег у модели, и бесконтрольный доступ к нему — это
 * бесконтрольный расход.
 */
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Подключён ли агент и что он сейчас видит. */
  @Get('health')
  health(): Promise<Record<string, unknown>> {
    return this.ai.health();
  }

  /**
   * Вопрос агенту.
   *
   * Лимит частоты — не от спама, а от расхода: каждый вопрос это обращения
   * к модели, и случайно зажатая кнопка не должна стоить денег.
   */
  @Post('ask')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  ask(@Body() dto: DtoAskAi): Promise<AiAnswer> {
    return this.ai.ask(dto.question, dto.session);
  }
}
