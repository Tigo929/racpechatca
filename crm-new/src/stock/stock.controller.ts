import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { DtoSetStock } from './dto/set-stock.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  list() {
    return this.stockService.list();
  }

  @Patch()
  setQuantity(@Body() dto: DtoSetStock) {
    return this.stockService.setQuantity(dto);
  }
}
