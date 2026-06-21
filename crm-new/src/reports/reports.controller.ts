import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  getMonthly(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    if (isNaN(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('Некорректный год');
    }
    return this.reportsService.getMonthlyReport(y);
  }

  @Get('years')
  getYears() {
    return this.reportsService.getAvailableYears();
  }

  @Get('funnel')
  getFunnel(@Query('year') year?: string) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    if (isNaN(y) || y < 2000 || y > 2100) {
      throw new BadRequestException('Некорректный год');
    }
    return this.reportsService.getFunnelReport(y);
  }

  @Get('weekly')
  getWeekly(@Query('year') year?: string, @Query('month') month?: string) {
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    if (isNaN(y) || y < 2000 || y > 2100) throw new BadRequestException('Некорректный год');
    if (isNaN(m) || m < 1 || m > 12) throw new BadRequestException('Некорректный месяц');
    return this.reportsService.getWeeklyReport(y, m);
  }
}
