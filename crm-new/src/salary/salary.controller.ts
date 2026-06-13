import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SalaryService } from './salary.service';
import { DtoCreatePayment } from './dto/create-payment.dto';

@Controller('salary')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class SalaryController {
  constructor(private salaryService: SalaryService) {}

  @Get('summary')
  getSummary() {
    return this.salaryService.getSummary();
  }

  @Get('accruals/:executorId')
  getAccruals(@Param('executorId') executorId: string) {
    return this.salaryService.getAccruals(executorId);
  }

  @Get('payments/:executorId')
  getPayments(@Param('executorId') executorId: string) {
    return this.salaryService.getPayments(executorId);
  }

  @Post('payments')
  createPayment(@Body() dto: DtoCreatePayment) {
    return this.salaryService.createPayment(dto);
  }
}
