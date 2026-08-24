import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EnumApprovalSide, EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-request';
import { ApprovalService } from './approval.service';
import { APPROVAL_MAX_BYTES } from './approval-storage.service';
import { DtoCreateApproval } from './dto/create-approval.dto';
import { DtoUpdateApproval } from './dto/update-approval.dto';

const SIDES: Record<string, EnumApprovalSide> = {
  FRONT: 'FRONT',
  BACK: 'BACK',
};

/**
 * Раздел «Согласование»: версии макета футболки для клиента.
 *
 * Права те же, что и на остальную работу с заказом-футболкой: администратор
 * и менеджер по оформлению. Исполнителю согласование не нужно — он получает
 * уже утверждённое ТЗ.
 */
@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  /** История согласований заказа. */
  @Get()
  list(@Query('orderId', ParseUUIDPipe) orderId: string) {
    return this.approvals.list(orderId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.get(id);
  }

  @Post()
  create(
    @Body() dto: DtoCreateApproval,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvals.create(dto, user?.id ?? null);
  }

  /** Автосохранение черновика: цвет, размер, комментарий, размещение принтов. */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoUpdateApproval,
  ) {
    return this.approvals.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.remove(id);
  }

  @Post(':id/print/:side')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: APPROVAL_MAX_BYTES } }),
  )
  uploadPrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('side') side: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file)
      throw new BadRequestException(
        'Не удалось загрузить принт — файл не передан',
      );
    return this.approvals.uploadPrint(id, parseSide(side), file);
  }

  @Delete(':id/print/:side')
  removePrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('side') side: string,
  ) {
    return this.approvals.removePrint(id, parseSide(side));
  }

  /** Сам файл принта — фон для редактора. */
  @Get(':id/print/:side')
  async printFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('side') side: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.approvals.readPrint(id, parseSide(side));
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.end(buffer);
  }

  /**
   * Предпросмотр итогового листа. Рисуется в полном качестве, но никуда не
   * сохраняется: пока сотрудник двигает принт, файлы плодить незачем.
   */
  @Post(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.approvals.preview(id);
    res.setHeader('Content-Type', 'image/png');
    res.end(buffer);
  }

  /** Кнопка «Готово»: сформировать лист и сохранить его в заказе. */
  @Post(':id/finalize')
  finalize(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.finalize(id);
  }

  /** Скачивание готового листа с понятным именем. */
  @Get(':id/file')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.approvals.readSheet(id);
    res.setHeader('Content-Type', 'image/png');
    // filename* с UTF-8: в имени кириллица, и без этого браузер сохранит
    // файл как «_____.png».
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="approval.png"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.end(buffer);
  }
}

function parseSide(value: string): EnumApprovalSide {
  const side = SIDES[value?.toUpperCase()];
  if (!side) throw new BadRequestException('Неизвестная сторона печати');
  return side;
}
