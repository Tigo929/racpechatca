import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EnumRole } from 'src/generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AnalyticsReportService } from './analytics-report.service';
import CreateReportDto from './dto/create-report.dto';

/**
 * Отчёты для внешнего ИИ из панели (этап 16).
 *
 * Только администратор: в отчёте вся выручка и прибыль бизнеса. Маршруты —
 * тонкая обёртка над очередью: считает генератор этапа 15, здесь только заказ,
 * статус и выдача готового файла. Имя файла и путь приходят из метаданных,
 * пользователь передаёт лишь идентификатор и формат.
 */
interface RequestUser {
  id: string;
  role: string;
}

@Controller('analytics/report')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class AnalyticsReportController {
  constructor(private readonly reports: AnalyticsReportService) {}

  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() me: RequestUser) {
    return this.reports.create(
      { preset: dto.preset, dateFrom: dto.dateFrom, dateTo: dto.dateTo },
      me.id,
    );
  }

  @Get()
  list(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.reports.list(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.reports.get(id);
  }

  /**
   * Скачивание. Формат — только md или html; всё остальное отклоняем, чтобы
   * в путь не попало ничего от пользователя.
   */
  @Get(':id/download')
  @Header('Cache-Control', 'no-store')
  async download(
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    if (format !== 'md' && format !== 'html') {
      throw new BadRequestException('Формат может быть только md или html.');
    }
    const file = await this.reports.download(id, format);
    res.setHeader(
      'Content-Type',
      format === 'md'
        ? 'text/markdown; charset=utf-8'
        : 'text/html; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    // Никаких сторонних скриптов и стилей: html самодостаточен и статичен.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'",
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.content);
  }
}
