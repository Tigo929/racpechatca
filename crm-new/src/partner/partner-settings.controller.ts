import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { PartnerSettingsService } from './partner-settings.service';
import { DtoUpdatePartnerSettings } from './dto/update-partner-settings.dto';

/** Настройки расчёта с партнёром (себестоимость, ставка, имя). Только админ. */
@Controller('partner-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class PartnerSettingsController {
  constructor(private readonly settings: PartnerSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(@Body() dto: DtoUpdatePartnerSettings) {
    return this.settings.update(dto);
  }
}
