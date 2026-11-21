import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ClientContactService } from './client-contact.service';
import {
  DtoClientContactExport,
  DtoClientContactQuery,
  DtoUpdateClientContact,
} from './dto/client-contact.dto';

/** «Клиенты»: контакты, которые остаются после удаления заказа. Только админ. */
@Controller('client-contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class ClientContactController {
  constructor(private readonly contacts: ClientContactService) {}

  @Get()
  list(@Query() query: DtoClientContactQuery) {
    return this.contacts.list(query);
  }

  // Выше ':id', иначе «export» прочитался бы как идентификатор.
  @Get('export')
  async export(@Query() query: DtoClientContactExport, @Res() res: Response) {
    const csv = await this.contacts.exportCsv(!query.all);
    const name = query.all ? 'clients-all' : 'clients-promo';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    res.send(csv);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoUpdateClientContact,
  ) {
    return this.contacts.update(id, dto);
  }
}
